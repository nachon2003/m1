const path = require('path');
const fs = require('fs').promises;
const { RSI, SMA } = require('technicalindicators');
const { spawn } = require('child_process');
const { 
    aiSignalCache, 
    isSupportedForexPair,
    getOhlcData, // (แก้ไข) เปลี่ยนชื่อฟังก์ชันที่ import
    getPipValue // (ใหม่) Import getPipValue จาก dataHelpers
} = require('./dataHelpers');

const { PYTHON_EXECUTABLE } = process.env;

const getDecimalPlaces = (symbol) => {
    const normalized = symbol.toUpperCase();
    if (normalized.includes('JPY') || normalized.includes('XAU')) return 2;
    return 4; // Most forex pairs
};

/**
 * (ปรับปรุงครั้งใหญ่) เปลี่ยนมาใช้การคำนวณแนวรับ-แนวต้านแบบไดนามิก
 * โดยการหาจุด Swing Points (Fractals) ที่สำคัญจากข้อมูลย้อนหลัง
 * @param {Array<object>} ohlcData - ข้อมูล OHLC ย้อนหลัง
 * @param {number} lookback - จำนวนแท่งเทียนที่จะมองย้อนกลับไป
 * @returns {{supports: number[], resistances: number[]}}
 */ 
const findDynamicLevels = (ohlcData, lookback = 100) => {
    // (ใหม่) กรองข้อมูล Outliers ออกก่อน
    // คำนวณค่าเฉลี่ยและ Standard Deviation ของราคาปิด
    const closes = ohlcData.map(d => d.close);
    const mean = closes.reduce((a, b) => a + b, 0) / closes.length;
    const stdDev = Math.sqrt(closes.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / closes.length);

    // กรองข้อมูลที่อยู่ห่างจากค่าเฉลี่ยเกิน 5 เท่าของ Standard Deviation ออกไป
    const filteredData = ohlcData.filter(d => 
        Math.abs(d.high - mean) < 5 * stdDev &&
        Math.abs(d.low - mean) < 5 * stdDev
    );

    const supports = [];
    const resistances = [];
    const highs = filteredData.map(d => d.high);
    const lows = filteredData.map(d => d.low);
    const currentPrice = filteredData[filteredData.length - 1].close;

    // Fractal ต้องการข้อมูล 5 แท่ง (2 แท่งซ้าย, แท่งกลาง, 2 แท่งขวา)
    // เราจะเริ่มตรวจสอบจากแท่งที่ 3 จากท้ายสุด (index: length - 3)
    const startIndex = highs.length - 3;
    const endIndex = Math.max(2, highs.length - lookback);

    for (let i = startIndex; i >= endIndex; i--) {
        // ตรวจหา Fractal Up (แนวต้าน)
        const isUpFractal = highs[i] > highs[i - 1] && highs[i] > highs[i - 2] &&
                              highs[i] > highs[i + 1] && highs[i] > highs[i + 2];
        if (isUpFractal && highs[i] > currentPrice) { // ต้องอยู่สูงกว่าราคาปัจจุบัน
            resistances.push(highs[i]);
        }

        // ตรวจหา Fractal Down (แนวรับ)
        const isDownFractal = lows[i] < lows[i - 1] && lows[i] < lows[i - 2] &&
                                lows[i] < lows[i + 1] && lows[i] < lows[i + 2];
        if (isDownFractal && lows[i] < currentPrice) { // ต้องอยู่ต่ำกว่าราคาปัจจุบัน
            supports.push(lows[i]);
        }
    }

    // --- (ใหม่) เพิ่มแผนสำรอง ในกรณีที่หา Fractal ไม่เจอ ---
    // ถ้ายังหาแนวต้านไม่เจอ (เช่น ในสภาวะ Uptrend แรงๆ) ให้ใช้ Highest High ในช่วง lookback
    if (resistances.length === 0 && filteredData.length >= lookback) {
        const recentHighs = filteredData.slice(-lookback).map(d => d.high);
        resistances.push(Math.max(...recentHighs));
    }

    // ถ้ายังหาแนวรับไม่เจอ ให้ใช้ Lowest Low ในช่วง lookback
    if (supports.length === 0 && filteredData.length >= lookback) {
        const recentLows = filteredData.slice(-lookback).map(d => d.low);
        supports.push(Math.min(...recentLows));
    }

    return {
        // คืนค่าที่ไม่ซ้ำกันและเรียงลำดับแล้ว
        supports: [...new Set(supports)].sort((a, b) => b - a), // เรียงจากมากไปน้อย (หาตัวที่ใกล้ที่สุด)
        resistances: [...new Set(resistances)].sort((a, b) => a - b), // เรียงจากน้อยไปมาก (หาตัวที่ใกล้ที่สุด)
    };
};

const generateFullAiSignal = async ({ symbol, timeframe = '4h', forceSignal = null, userId, db }) => {
    if (!symbol) {
        throw new Error("Symbol is required.");
    }
 
    if (!isSupportedForexPair(symbol)) {
        throw new Error(`Unsupported forex symbol: ${symbol}`);
    }
 
    const normalizedSymbol = symbol.toUpperCase();
 
    // --- (ปรับปรุง) กำหนดให้ใช้ Random Forest เป็นหลักตามโครงสร้างโปรเจกต์ ---
    const modelType = 'rf'; // ใช้ Random Forest เป็นโมเดลหลัก
    // (แก้ไข) ปรับ Path ให้ถูกต้องมากขึ้น
    const pythonScriptPath = path.resolve(__dirname, '..', '..', 'ai_model', 'predict_random_forest_signal.py');
    // (อัปเดต) เพิ่ม timeframe เข้าไปใน cacheKey เพื่อให้แคชแยกตาม Timeframe
    const cacheKey = `${normalizedSymbol}_${timeframe}_RF_ANALYSIS`;
    // (อัปเดต) สร้างชื่อไฟล์โมเดลให้ตรงกับ Timeframe ที่ร้องขอ
    const modelFileName = `${normalizedSymbol.replace('/', '_')}_${timeframe}_random_forest.joblib`;
    const python_sequence_length = 100; // (แก้ไข) ปรับกลับมาเป็น 100 หลังจากเอา MA_200 ออก
 
    // Check cache first, but only if not forcing a signal
    if (!forceSignal) {
        const cachedSignal = aiSignalCache.get(cacheKey);
        if (cachedSignal) {
            console.log(`Serving ${modelType.toUpperCase()} AI Signal for ${normalizedSymbol} (${timeframe}) from cache.`);
            return cachedSignal;
        }
    }
 
    try {
        await fs.access(pythonScriptPath);
    } catch (fileNotFoundError) {
        const errorMessage = `AI model script not found at ${pythonScriptPath}.`;
        console.error(errorMessage);
        throw new Error(errorMessage);
    }
 
    // --- (ปรับปรุง) สร้างโครงสร้างข้อมูลผลลัพธ์เริ่มต้น ---
    let aiSignalData = {
        symbol: normalizedSymbol,
        signal: 'HOLD',
        entryZoneStart: null,
        entryZoneEnd: null,
        takeProfitPrice: null,
        stopLossPrice: null,
        reasoning: null,
        trend: 'N/A',
        volume: 'N/A',
        buyer_percentage: 50, // ค่าเริ่มต้น
        confidence: 'N/A',
        support: 'N/A',
        resistance: 'N/A'
    };
 
    try {
        // (แก้ไข) เรียกใช้ getOhlcData และส่ง timeframe ไปด้วย
        const ohlcData = await getOhlcData(normalizedSymbol, timeframe);
 
        if (!ohlcData || ohlcData.length === 0) {
            throw new Error(`Could not get sufficient OHLC data for ${normalizedSymbol} (${timeframe}).`);
        }
 
        const closes = ohlcData.map(d => d.close);
        const highs = ohlcData.map(d => d.high);
        const lows = ohlcData.map(d => d.low);
        const currentClose = closes[closes.length - 1];
        const volumes = ohlcData.map(d => d.volume).filter(Boolean); // (ใหม่) ดึงข้อมูล Volume
        const decimalPlaces = getDecimalPlaces(normalizedSymbol);
 
        // --- (ปรับปรุง) ย้ายการคำนวณทั้งหมดไปให้ Python จัดการ ---
        try {
            if (closes.length < python_sequence_length) {
                throw new Error(`Not enough historical data (${closes.length} bars) for Python AI (needs ${python_sequence_length}).`);
            }
 
            // ส่งข้อมูล OHLC ย้อนหลังตามที่ Python ต้องการ
            const dataForPython = ohlcData
                .slice(-python_sequence_length)
                // (แก้ไข) ส่งข้อมูล OHLC ไปตรงๆ โดยไม่ต้องเพิ่ม Pivot Points
                // เพราะโมเดลไม่ได้ถูกเทรนด้วยข้อมูลนี้
                .map(d => ({ open: d.open, high: d.high, low: d.low, close: d.close }));
 
            const pythonArgs = [normalizedSymbol, JSON.stringify(dataForPython), modelFileName];

 
            const pythonOutput = await new Promise((resolve, reject) => {
                let output = '';
                let errorOutput = '';
                const pythonProcess = spawn(PYTHON_EXECUTABLE, [pythonScriptPath, ...pythonArgs]);
                pythonProcess.stdout.on('data', (data) => output += data.toString());
                pythonProcess.stderr.on('data', (data) => errorOutput += data.toString());
                pythonProcess.on('close', (code) => {
                    if (code === 0) {
                        resolve(output);
                    } else {
                        // (แก้ไข) เพิ่ม stdout เข้าไปใน Error message เพื่อให้เห็นข้อความ Error ที่แท้จริงจาก Python
                        const fullError = `Python script exited with code ${code}. Stderr: ${errorOutput.trim() || 'N/A'}. Stdout: ${output.trim() || 'N/A'}`;
                        reject(new Error(fullError));
                    }
                });
                pythonProcess.on('error', (err) => reject(new Error(`Failed to start Python subprocess: ${err.message}`)));
            });
 
            const result = JSON.parse(pythonOutput);
            if (result.error) throw new Error(`AI model script returned an error: ${result.error}`);
 
            // นำผลลัพธ์จาก Python มาใส่ใน object ของเรา
            Object.assign(aiSignalData, result); // result จะมี signal, trend, volume, buyer_percentage, confidence
            console.log(`Python ${modelType.toUpperCase()} Model Output:`, result);
 
        } catch (aiError) {
            // (ปรับปรุง) จัดการกับ Error ที่เกิดจากการหาไฟล์โมเดลไม่เจอ
            if (aiError.message.includes('Model file not found')) {
                aiSignalData.reasoning = `AI model for ${timeframe} timeframe not found. Please train the model for this timeframe.`;
            } else {
                aiSignalData.reasoning = `AI analysis failed: ${aiError.message}. The system will default to HOLD.`;
            }
            console.error(`[AI Prediction Failed for ${normalizedSymbol}]`, aiError.message);
            aiSignalData.signal = 'HOLD'; // ถ้า Python error ให้เป็น HOLD
        }
 
        // --- (ปรับปรุงครั้งใหญ่) เปลี่ยนมาใช้การคำนวณแนวรับ-แนวต้านแบบไดนามิก ---
        // (แก้ไข) ปรับ lookback period เป็น 24 แท่งตามที่ต้องการ
        const { supports, resistances } = findDynamicLevels(ohlcData, 24);
        // (แก้ไข) ใช้ค่าแรกที่ได้จากฟังก์ชันโดยตรง เพราะมันคือค่าสูงสุด/ต่ำสุดในช่วงนั้นแล้ว
        const nearestSupport = supports[0];
        const nearestResistance = resistances[0];
        // (แก้ไข) เปลี่ยนจากการส่ง 'N/A' เป็น null เพื่อให้ Frontend จัดการได้ง่ายขึ้น
        // และป้องกันข้อผิดพลาด .toFixed is not a function
        aiSignalData.support = nearestSupport ? parseFloat(nearestSupport.toFixed(decimalPlaces)) : null;
        aiSignalData.resistance = nearestResistance ? parseFloat(nearestResistance.toFixed(decimalPlaces)) : null;
 
        // (แก้ไข) เรียกใช้ Pip Value จากศูนย์กลาง
        const pipValue = getPipValue(normalizedSymbol);

        // (ปรับปรุง) กำหนดค่า SL/TP ตามที่ผู้ใช้ต้องการ (500-1000 จุด หรือ 50-100 pips) และ R:R 1:2
        const slPipsFallback = 50; // 50 pips (500 points)
        const tpPipsFallback = 100; // 100 pips (1000 points)
        const slBufferPips = 20; // ระยะห่างจากแนวรับ/แนวต้านสำหรับตั้ง SL (20 pips)
 
        // ถ้าสัญญาณเป็น BUY และมีแนวรับที่เหมาะสม
        if (aiSignalData.signal === 'BUY') {
            if (nearestSupport) { // แผน A: ใช้แนวรับ
                aiSignalData.entryZoneStart = nearestSupport + (10 * pipValue); // เข้าใกล้แนวรับ
                aiSignalData.entryZoneEnd = nearestSupport;
                aiSignalData.stopLossPrice = nearestSupport - (slBufferPips * pipValue);
                // TP คำนวณจาก SL เพื่อให้ได้ R:R 1:2
                const riskDistance = aiSignalData.entryZoneStart - aiSignalData.stopLossPrice;
                aiSignalData.takeProfitPrice = aiSignalData.entryZoneStart + (riskDistance * 2);
            } else { // แผน B (Fallback): ใช้ราคาปัจจุบัน
                aiSignalData.entryZoneStart = currentClose;
                aiSignalData.entryZoneEnd = currentClose - (10 * pipValue); // โซนย่อตัวเล็กน้อย
                aiSignalData.stopLossPrice = currentClose - (slPipsFallback * pipValue);
                aiSignalData.takeProfitPrice = currentClose + (tpPipsFallback * pipValue);
            }
        } else if (aiSignalData.signal === 'SELL') {
            if (nearestResistance) { // แผน A: ใช้แนวต้าน
                aiSignalData.entryZoneStart = nearestResistance - (10 * pipValue); // เข้าใกล้แนวต้าน
                aiSignalData.entryZoneEnd = nearestResistance;
                aiSignalData.stopLossPrice = nearestResistance + (slBufferPips * pipValue);
                // TP คำนวณจาก SL เพื่อให้ได้ R:R 1:2
                const riskDistance = aiSignalData.stopLossPrice - aiSignalData.entryZoneStart;
                aiSignalData.takeProfitPrice = aiSignalData.entryZoneStart - (riskDistance * 2);
            } else { // แผน B (Fallback): ใช้ราคาปัจจุบัน
                aiSignalData.entryZoneStart = currentClose;
                aiSignalData.entryZoneEnd = currentClose + (10 * pipValue); // โซนดีดตัวเล็กน้อย
                aiSignalData.stopLossPrice = currentClose + (slPipsFallback * pipValue);
                aiSignalData.takeProfitPrice = currentClose - (tpPipsFallback * pipValue);
            }
        }
 
        // --- (ย้ายมาไว้ตรงนี้) คำนวณ Trend และ Volume หลังจากจัดการทุกอย่างเสร็จสิ้น ---
        // เพื่อให้แน่ใจว่าค่านี้จะถูกคำนวณและส่งกลับไปเสมอ
        const sma20 = SMA.calculate({ period: 20, values: closes });
        if (sma20.length > 0) {
            const lastSma = sma20[sma20.length - 1];
            if (currentClose > lastSma) {
                aiSignalData.trend = 'Uptrend';
            } else if (currentClose < lastSma) {
                aiSignalData.trend = 'Downtrend';
            } else {
                aiSignalData.trend = 'Sideways';
            }
        }

        // (แก้ไข) เปลี่ยนมาใช้ Volatility (ATR) เป็นตัวแทนของ Volume
        // เนื่องจากข้อมูล Volume ของ Forex ไม่มีมาตรฐาน
        try {
            const atrInput = { high: highs, low: lows, close: closes, period: 14 };
            const atrResult = require('technicalindicators').ATR.calculate(atrInput);
            if (atrResult.length > 20) {
                const lastAtr = atrResult[atrResult.length - 1];
                const avgAtr = SMA.calculate({ period: 20, values: atrResult }).pop();
                if (lastAtr > avgAtr * 1.2) {
                    aiSignalData.volume = 'High'; // Volatility สูง
                } else {
                    aiSignalData.volume = 'Normal'; // Volatility ปกติ
                }
            }
        } catch (e) {
            // ไม่ต้องทำอะไรถ้าคำนวณไม่ได้
        }

        // (แก้ไข) บันทึก Signal ที่ไม่ใช่ HOLD ลงในฐานข้อมูลตามโครงสร้างใหม่
        if (userId && db && aiSignalData.signal && aiSignalData.signal !== 'HOLD') {
            try {
                await db.run(
                    'INSERT INTO signal_records (user_id, symbol, timeframe, source, signal, open_price, predicted_price, stop_loss_price, entry_zone_start, entry_zone_end) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [
                        userId,
                        normalizedSymbol,
                        timeframe,
                        'ai',
                        aiSignalData.signal,
                        null, // (แก้ไข) ราคาเปิดจะเป็น null เพราะเราจะรอให้ราคาเข้าโซนก่อน
                        aiSignalData.takeProfitPrice,
                        aiSignalData.stopLossPrice,
                        aiSignalData.entryZoneStart, // (แก้ไข) เพิ่มค่าที่ขาดไป
                        aiSignalData.entryZoneEnd    // (แก้ไข) เพิ่มค่าที่ขาดไป
                    ]
                );
                console.log(`[DB] Saved AI signal '${aiSignalData.signal}' for ${normalizedSymbol} (${timeframe})`);
            } catch (dbError) {
                console.error(`[DB] Failed to save AI signal:`, dbError);
            }
        }

        if (!forceSignal) aiSignalCache.set(cacheKey, aiSignalData);
        return aiSignalData;
 
    } catch (error) {
        console.error(`[FATAL] Error in generateFullAiSignal for ${normalizedSymbol}:`, error.message);
        throw error;
    }
};

/**
 * Wrapper function for general market analysis.
 * This function is called by the '/analyze' route.
 * @param {string} symbol The currency pair.
 * @param {string} timeframe The requested timeframe (currently unused by the model but kept for API consistency).
 * @returns {Promise<object>} The analysis result from the AI model.
 */
const getMarketAnalysis = async (symbol, timeframe, userId, db) => {
    // (อัปเดต) ส่ง timeframe ที่ได้รับมาต่อไปยังฟังก์ชันหลัก
    return generateFullAiSignal({ symbol, timeframe, userId, db });
};

/**
 * Wrapper function for generating a specific BUY/SELL signal.
 * This function is called by the '/request-signal' route.
 * @param {string} symbol The currency pair.
 * @param {string} signalType The forced signal type ('BUY' or 'SELL'). (ปัจจุบันไม่ได้ใช้งานแล้ว)
 * @param {string} timeframe The requested timeframe.
 * @returns {Promise<object>} The signal result from the AI model, with the signal potentially forced.
 */
const generateSpecificSignal = async (symbol, signalType, timeframe, userId, db) => {
    // (อัปเดต) ส่ง timeframe ที่ได้รับมาต่อไปยังฟังก์ชันหลัก
    return generateFullAiSignal({ symbol, timeframe, forceSignal: signalType, userId, db });
};

module.exports = { 
    getMarketAnalysis, 
    generateSpecificSignal 
};