const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
// (สำคัญ) Import service ที่จัดการ logic ของ AI
const { authenticateToken } = require('./authMiddleware'); // (แก้ไข) เปลี่ยน path
const { getMarketAnalysis, generateSpecificSignal } = require('./services/aiService');

/**
 * POST /api/ai/analyze
 * Endpoint หลักสำหรับขอผลการวิเคราะห์จาก AI
 * Frontend จะเรียกใช้ endpoint นี้เมื่อกดปุ่ม "Start AI Analysis"
 * Body: { "symbol": "EUR/USD", "timeframe": "1d" }
 */
router.post('/analyze', authenticateToken, async (req, res, next) => {
    const { symbol, timeframe } = req.body;
    const userId = req.user.id;
    const db = req.app.get('db');

    if (!symbol) {
        return res.status(400).json({ error: "Symbol is required." });
    }

    try {
        // เรียกใช้ฟังก์ชันจาก aiService เพื่อทำการวิเคราะห์
        const analysisResult = await getMarketAnalysis(symbol, timeframe, userId, db);
        res.json(analysisResult);
    } catch (error) {
        console.error(`[API ERROR] /api/ai/analyze for ${symbol}:`, error.message);
        // ส่ง error ไปให้ global error handler จัดการ (ถ้ามี)
        next(error); 
    }
});

/**
 * POST /api/ai/request-signal
 * Endpoint สำหรับบังคับสัญญาณ BUY หรือ SELL
 * Frontend จะเรียกใช้ endpoint นี้เมื่อกดปุ่ม "BUY" หรือ "SELL"
 * Body: { "symbol": "EUR/USD", "signalType": "BUY", "timeframe": "1d" }
 */
router.post('/request-signal', authenticateToken, async (req, res, next) => {
    const { symbol, signalType, timeframe } = req.body;
    const userId = req.user.id;
    const db = req.app.get('db');

    if (!symbol || !signalType) {
        return res.status(400).json({ error: "Symbol and signalType are required." });
    }

    try {
        // เรียกใช้ฟังก์ชันจาก aiService เพื่อสร้างสัญญาณตามที่ร้องขอ
        const signalResult = await generateSpecificSignal(symbol, signalType, timeframe, userId, db);
        res.json(signalResult);
    } catch (error) {
        console.error(`[API ERROR] /api/ai/request-signal for ${symbol}:`, error.message);
        next(error);
    }
});

/**
 * GET /api/ai/performance
 * Endpoint สำหรับดึงข้อมูลสถิติของโมเดล AI ที่ฝึกไว้
 * (ย้ายมาจาก server.js)
 */
router.get('/performance', async (req, res) => {
    // This logic is now handled by aiRoutes.js
    // The implementation can be copied from the old server.js or rewritten.
    // For now, returning a placeholder.
    res.json({ message: "AI performance endpoint is active." });
});


module.exports = router;
