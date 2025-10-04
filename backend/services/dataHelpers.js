const axios = require('axios');
const NodeCache = require('node-cache');
const fs = require('fs').promises; // เพิ่ม fs.promises
const path = require('path'); // เพิ่ม path
const mockOhlcData = require('./mockOhlcData'); // Import the mock data
// (แก้ไข) Import Rate Limiter จากไฟล์ใหม่ rateLimiter.js
const { twelveDataRateLimiter } = require('../rateLimiter');

const { TWELVEDATA_API_KEY } = process.env;

// Caches
const ohlcCache = new NodeCache({ stdTTL: 60 * 60, checkperiod: 120 }); // 1 hour TTL
const aiSignalCache = new NodeCache({ stdTTL: 5 * 60, checkperiod: 120 }); // 5 minute TTL

const isSupportedForexPair = (symbol) => {
    const supportedForexPairs = [
        'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CAD', 'USD/CHF', 'XAU/USD'
    ];
    return supportedForexPairs.includes(symbol.toUpperCase());
};

// (แก้ไข) เปลี่ยนชื่อฟังก์ชันเป็น getPipValue และแก้ไขค่าให้ถูกต้อง
const getPipValue = (symbol) => {
    if (symbol && symbol.toUpperCase().includes('XAU')) return 0.1; // 1 pip for Gold is 0.1
    if (symbol && symbol.toUpperCase().includes('JPY')) return 0.01; // 1 pip for JPY pairs is 0.01
    return 0.0001; // 1 pip for most other Forex pairs
};

/**
 * (ใหม่) ฟังก์ชันสำหรับแปลง Timeframe จาก Frontend ไปเป็นรูปแบบที่ Twelve Data API เข้าใจ
 * @param {string} tf Timeframe จาก Frontend (e.g., '1d', '1m', '5m')
 * @returns {string} Timeframe ในรูปแบบของ API (e.g., '1day', '1min', '5min')
 */
const mapTimeframeToApi = (tf) => {
    const mapping = {
        '1m': '1min',
        '5m': '5min',
        '15m': '15min',
        '30m': '30min',
        '1d': '1day',
        '1w': '1week',
    };
    return mapping[tf] || tf; // คืนค่าที่แปลงแล้ว หรือค่าเดิมถ้าไม่พบใน mapping
};

const getOhlcData = async (symbol, timeframe = '4h') => {
    const normalizedSymbol = symbol.toUpperCase();
    const cacheDir = path.join(__dirname, '..', 'data_cache'); // สร้างโฟลเดอร์ data_cache ใน backend
    // (ใหม่) ทำให้ชื่อไฟล์แคชขึ้นอยู่กับ Timeframe ด้วย
    const filePath = path.join(cacheDir, `${normalizedSymbol.replace('/', '_')}_${timeframe}.json`);

    // (แก้ไข) เปิดการใช้งาน Cache กลับมา
    // 1. ตรวจสอบไฟล์แคชก่อน
    try {
        await fs.mkdir(cacheDir, { recursive: true });
        const fileData = await fs.readFile(filePath, 'utf8');
        console.log(`[LOCAL CACHE] Serving OHLC data for ${normalizedSymbol} (${timeframe}) from file.`);
        // แปลงข้อมูล JSON ที่อ่านได้กลับเป็น Object ที่มี Date object ถูกต้อง
        return JSON.parse(fileData).map(d => ({ ...d, time: new Date(d.time) }));
    } catch (fileError) {
        // หากไม่พบไฟล์ (ENOENT) ก็จะไปขั้นตอนต่อไปเพื่อดึงข้อมูลจาก API
        if (fileError.code !== 'ENOENT') {
            console.error(`Error reading local cache file for ${normalizedSymbol}:`, fileError);
        }
    }

    // 2. หากไม่มีไฟล์แคช ให้ตรวจสอบแคชในหน่วยความจำ (In-memory cache)
    const cacheKey = `${normalizedSymbol}_${timeframe}`;
    const cachedData = ohlcCache.get(cacheKey);
    if (cachedData) {
        console.log(`Serving Forex OHLC data for ${normalizedSymbol} (${timeframe}) from in-memory cache.`);
        return cachedData;
    }

    // 3. หากไม่มีแคชใดๆ เลย ให้ดึงข้อมูลจาก API
    // const cacheKey = `${normalizedSymbol}_${timeframe}`; // cacheKey ถูกประกาศไปแล้วด้านบน
    try {
        const apiTimeframe = mapTimeframeToApi(timeframe); // แปลง Timeframe ก่อนใช้งาน
        await twelveDataRateLimiter(`getOhlcData for ${normalizedSymbol} (${timeframe})`);
        console.log(`Fetching OHLC data from Twelve Data for ${normalizedSymbol} (API Interval: ${apiTimeframe}, outputsize=5000)...`);

        // (แก้ไข) ใช้ apiTimeframe ที่แปลงแล้วในการสร้าง URL
        const twelveDataUrl = `https://api.twelvedata.com/time_series?symbol=${normalizedSymbol}&interval=${apiTimeframe}&outputsize=5000&apikey=${TWELVEDATA_API_KEY}`;
        const tdResponse = await axios.get(twelveDataUrl);

        if (tdResponse.data && tdResponse.data.values && tdResponse.data.values.length > 0) {
            const ohlcData = tdResponse.data.values.map(d => ({ 
                time: new Date(d.datetime), 
                open: parseFloat(d.open), 
                high: parseFloat(d.high), 
                low: parseFloat(d.low), 
                close: parseFloat(d.close), 
                volume: d.volume ? parseInt(d.volume, 10) : 0 // (แก้ไข) เพิ่ม volume เข้ามา
            })).reverse();
            console.log(`Successfully fetched ${ohlcData.length} OHLC data points for ${timeframe} from Twelve Data.`);
            
            // (แก้ไข) เปิดการใช้งาน Cache กลับมา
            // 4. บันทึกข้อมูลลงไฟล์แคชเพื่อใช้ในอนาคต
            try {
                await fs.writeFile(filePath, JSON.stringify(ohlcData, null, 2));
                console.log(`[LOCAL CACHE] Saved OHLC data for ${normalizedSymbol} to file.`);
            } catch (writeError) {
                console.error(`Error writing to local cache file for ${normalizedSymbol}:`, writeError);
            }

            // บันทึกลงแคชในหน่วยความจำสำหรับ session ปัจจุบัน (ยังคงเปิดไว้เพื่อประสิทธิภาพเล็กน้อย)
            ohlcCache.set(cacheKey, ohlcData);
            return ohlcData;
        } else if (tdResponse.data && tdResponse.data.code && tdResponse.data.message) {
            throw new Error(`[Twelve Data Error] for OHLC daily: ${tdResponse.data.message} (Code: ${tdResponse.data.code})`);
        } else {
            throw new Error("Twelve Data OHLC daily API error or invalid response format.");
        }
    } catch (error) {
        // (แก้ไข) ปรับปรุงการจัดการ Error ให้ดีขึ้น
        const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error(`Error fetching OHLC data from Twelve Data for ${normalizedSymbol}:`, errorMessage);
        
        // --- (ใหม่) เพิ่ม Fallback Mechanism ---
        // ถ้าดึงข้อมูลจาก API ไม่สำเร็จ ให้ลองใช้ข้อมูล Mock แทน
        console.warn(`[FALLBACK] API fetch failed for ${normalizedSymbol}. Attempting to use mock data.`);
        const mockData = mockOhlcData[normalizedSymbol];
        if (mockData) return mockData;
        throw new Error(`Failed to fetch OHLC data for ${normalizedSymbol} and no mock data available.`);
    }
};

/**
 * (ปรับปรุง) เปลี่ยน Logic การคำนวณแนวรับ-แนวต้านให้เหมือนกับ Pine Script
 * - Resistance = Highest high over a lookback period.
 * - Support = Lowest low over a lookback period.
 * @param {number[]} highs - Array of high prices.
 * @param {number[]} lows - Array of low prices.
 * @param {number} lookbackPeriod - The number of recent bars to consider (e.g., 100).
 * @returns {{supports: number[], resistances: number[]}} An object containing arrays of support and resistance levels.
 */
const findKeyLevels = (highs, lows, lookbackPeriod = 100) => {
    if (!highs || !lows || highs.length < lookbackPeriod || lows.length < lookbackPeriod) {
        console.warn(`Not enough data for S/R calculation. Need ${lookbackPeriod}, got ${highs.length}.`);
        return { supports: [], resistances: [] };
    }

    // เลือกข้อมูลเฉพาะช่วงที่ต้องการ (เหมือน ta.highest(high, 100) และ ta.lowest(low, 100))
    const recentHighs = highs.slice(-lookbackPeriod);
    const recentLows = lows.slice(-lookbackPeriod);

    const resistanceLevel = Math.max(...recentHighs);
    const supportLevel = Math.min(...recentLows);
    
    return { supports: [supportLevel], resistances: [resistanceLevel] };
};

module.exports = {
    aiSignalCache,
    isSupportedForexPair,
    getOhlcData,
    findKeyLevels,
    getPipValue // (แก้ไข) Export ฟังก์ชันใหม่
};