const { SMA, RSI, MACD, Stochastic, BollingerBands } = require('technicalindicators');
const { getOhlcData, findKeyLevels, isSupportedForexPair, getPipValue } = require('./dataHelpers');

const getDecimalPlaces = (symbol) => {
    const normalized = symbol.toUpperCase();
    if (normalized.includes('JPY') || normalized.includes('XAU')) return 2;
    return 4; // Most forex pairs
};

/**
 * คำนวณสัญญาณจาก Indicators ต่างๆ และสรุปเป็นผลลัพธ์
 * @param {string} symbol - คู่เงิน
 * @param {string} timeframe - Timeframe
 * @returns {Promise<object>} ผลการวิเคราะห์ทางเทคนิค
 */
const generateTechnicalAnalysis = async (symbol, timeframe, userId, db) => {
    if (!isSupportedForexPair(symbol)) {
        throw new Error(`Unsupported forex symbol: ${symbol}`);
    }
    const normalizedSymbol = symbol.toUpperCase();

    const ohlcData = await getOhlcData(symbol, timeframe);
    if (!ohlcData || ohlcData.length < 50) { // ต้องการข้อมูลอย่างน้อย 50 แท่ง
        return { summary: 'Not Enough Data', indicators: {}, signalDetails: null };
    }

    const closes = ohlcData.map(d => d.close);
    const highs = ohlcData.map(d => d.high);
    const lows = ohlcData.map(d => d.low);
    const currentClose = closes[closes.length - 1];

    // --- (ใหม่) สร้าง Object สำหรับเก็บผลลัพธ์ ---
    const result = {
        summary: 'NEUTRAL',
        indicators: {},
        signalDetails: null // จะถูกเติมเมื่อมีสัญญาณ BUY/SELL
    };

    // --- คำนวณ Indicators และ Score ---
    let score = 0;

    // 1. RSI
    const rsiResult = RSI.calculate({ values: closes, period: 14 });
    const lastRsi = rsiResult[rsiResult.length - 1];
    if (lastRsi > 70) { result.indicators.RSI = 'SELL'; score--; }
    else if (lastRsi < 30) { result.indicators.RSI = 'BUY'; score++; }
    else { result.indicators.RSI = 'NEUTRAL'; }

    // 2. Stochastic
    const stochInput = { high: highs, low: lows, close: closes, period: 14, signalPeriod: 3 };
    const stochResult = Stochastic.calculate(stochInput);
    const lastStoch = stochResult[stochResult.length - 1];
    if (lastStoch.k > 80) { result.indicators.Stochastic = 'SELL'; score--; }
    else if (lastStoch.k < 20) { result.indicators.Stochastic = 'BUY'; score++; }
    else { result.indicators.Stochastic = 'NEUTRAL'; }

    // 3. MACD
    const macdInput = { values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false };
    const macdResult = MACD.calculate(macdInput);
    const lastMacd = macdResult[macdResult.length - 1];
    if (lastMacd.MACD > lastMacd.signal) { result.indicators.MACD = 'BUY'; score++; }
    else if (lastMacd.MACD < lastMacd.signal) { result.indicators.MACD = 'SELL'; score--; }
    else { result.indicators.MACD = 'NEUTRAL'; }

    // 4. Moving Average Crossover
    const smaFast = SMA.calculate({ period: 9, values: closes });
    const smaSlow = SMA.calculate({ period: 21, values: closes });
    if (smaFast[smaFast.length - 1] > smaSlow[smaSlow.length - 1]) { result.indicators.MA_Cross = 'BUY'; score++; }
    else if (smaFast[smaFast.length - 1] < smaSlow[smaSlow.length - 1]) { result.indicators.MA_Cross = 'SELL'; score--; }
    else { result.indicators.MA_Cross = 'NEUTRAL'; }

    // 5. (NEW) Bollinger Bands %B
    const bbandsInput = { period: 20, values: closes, stdDev: 2 };
    const bbandsResult = BollingerBands.calculate(bbandsInput);
    const lastBband = bbandsResult[bbandsResult.length - 1];
    const percentB = (currentClose - lastBband.lower) / (lastBband.upper - lastBband.lower);
    if (percentB > 1.0) { result.indicators.BBands = 'SELL'; score--; } // Price closed above the upper band
    else if (percentB < 0.0) { result.indicators.BBands = 'BUY'; score++; } // Price closed below the lower band
    else { result.indicators.BBands = 'NEUTRAL'; }

    // สรุปผลจาก Score
    if (score >= 3) result.summary = 'STRONG BUY'; // 3 of 5 indicators agree
    else if (score >= 1) result.summary = 'BUY'; // At least one net BUY signal
    else if (score <= -3) result.summary = 'STRONG SELL';
    else if (score <= -1) result.summary = 'SELL'; // At least one net SELL signal

    // --- (ใหม่) คำนวณแผนการเทรดถ้ามีสัญญาณ ---
    const hasBuySignal = result.summary.includes('BUY');
    const hasSellSignal = result.summary.includes('SELL');

    if (hasBuySignal || hasSellSignal) {
        const { supports, resistances } = findKeyLevels(highs, lows, 100);
        const nearestSupport = supports.find(s => s < currentClose);
        const nearestResistance = resistances.find(r => r > currentClose);
        // (แก้ไข) เรียกใช้ Pip Value จากศูนย์กลาง
        const pipValue = getPipValue(symbol);
        const slBufferPips = 20;
        const takeProfitPips = 500; // Aim for a 500 pip take profit

        if (hasBuySignal && nearestSupport) {
            const entryZoneStart = nearestSupport + (20 * pipValue);
            const entryZoneEnd = nearestSupport;
            const stopLossPrice = nearestSupport - (slBufferPips * pipValue);
            const takeProfitPrice = entryZoneStart + (takeProfitPips * pipValue); // (แก้ไข) ตรวจสอบให้แน่ใจว่าเป็นการบวกสำหรับสัญญาณ BUY
            result.signalDetails = { entryZoneStart, entryZoneEnd, stopLossPrice, takeProfitPrice };
        } else if (hasBuySignal) { // แผน B (Fallback) สำหรับ BUY
            const slPips = 80;
            const entryZoneStart = currentClose;
            const entryZoneEnd = currentClose - (15 * pipValue);
            const stopLossPrice = currentClose - (slPips * pipValue);
            const takeProfitPrice = entryZoneStart + (takeProfitPips * pipValue); // (แก้ไข) อ้างอิงจาก entryZoneStart ที่เป็นราคาปัจจุบัน
            result.signalDetails = { entryZoneStart, entryZoneEnd, stopLossPrice, takeProfitPrice };
        }else if (hasSellSignal && nearestResistance) {
            const entryZoneStart = nearestResistance - (20 * pipValue);
            const entryZoneEnd = nearestResistance;
            const stopLossPrice = nearestResistance + (slBufferPips * pipValue);
            const takeProfitPrice = entryZoneStart - (takeProfitPips * pipValue);
            result.signalDetails = { entryZoneStart, entryZoneEnd, stopLossPrice, takeProfitPrice };
        } else if (hasSellSignal) { // แผน B (Fallback) สำหรับ SELL
            const slPips = 80;
            const entryZoneStart = currentClose;
            const entryZoneEnd = currentClose + (15 * pipValue);
            const stopLossPrice = currentClose + (slPips * pipValue);
            const takeProfitPrice = entryZoneStart - (takeProfitPips * pipValue); // (แก้ไข) อ้างอิงจาก entryZoneStart ที่เป็นราคาปัจจุบัน
            result.signalDetails = { entryZoneStart, entryZoneEnd, stopLossPrice, takeProfitPrice };
        }
    }

    // (แก้ไข) บันทึก Signal ที่ไม่ใช่ NEUTRAL ลงในฐานข้อมูลตามโครงสร้างใหม่
    if (userId && db && result.summary && result.summary !== 'NEUTRAL') {
        try {
            await db.run(
                'INSERT INTO signal_records (user_id, symbol, timeframe, source, signal, open_price, predicted_price, stop_loss_price, entry_zone_start, entry_zone_end) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    userId,
                    normalizedSymbol,
                    timeframe,
                    'technical',
                    result.summary,
                    null, // (แก้ไข) ราคาเปิดจะเป็น null เพราะเราจะรอให้ราคาเข้าโซนก่อน
                    result.signalDetails ? result.signalDetails.takeProfitPrice : null,
                    result.signalDetails ? result.signalDetails.stopLossPrice : null,
                    result.signalDetails ? result.signalDetails.entryZoneStart : null, // (แก้ไข) เพิ่มค่าที่ขาดไป
                    result.signalDetails ? result.signalDetails.entryZoneEnd : null    // (แก้ไข) เพิ่มค่าที่ขาดไป
                ]
            );
            console.log(`[DB] Saved Technical signal '${result.summary}' for ${normalizedSymbol} (${timeframe})`);
        } catch (dbError) {
            console.error(`[DB] Failed to save Technical signal:`, dbError);
        }
    }

    return result; // (แก้ไข) เปลี่ยนชื่อตัวแปรที่ return
};

module.exports = { generateTechnicalAnalysis };
