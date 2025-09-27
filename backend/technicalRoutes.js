const express = require('express');
const router = express.Router();
const { generateTechnicalAnalysis } = require('./services/technicalAnalysisService');
const { authenticateToken } = require('./authMiddleware'); // (แก้ไข) เปลี่ยน path

/**
 * POST /api/technical/analyze
 * Endpoint สำหรับขอผลการวิเคราะห์ทางเทคนิค
 */
router.post('/analyze', authenticateToken, async (req, res, next) => {
    const { symbol, timeframe } = req.body;
    const userId = req.user.id;
    const db = req.app.get('db');

    if (!symbol || !timeframe) {
        return res.status(400).json({ error: "Symbol and timeframe are required." });
    }

    try {
        const analysisResult = await generateTechnicalAnalysis(symbol, timeframe, userId, db);
        res.json(analysisResult);
    } catch (error) {
        console.error(`[API ERROR] /api/technical/analyze for ${symbol}:`, error.message);
        next(error);
    }
});

module.exports = router;
