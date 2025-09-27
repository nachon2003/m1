const express = require('express');
const router = express.Router();
const { getOhlcData } = require('./services/dataHelpers');

/**
 * GET /api/training/ohlc-data
 * Endpoint for training scripts to fetch raw OHLC data.
 */
router.get('/ohlc-data', async (req, res, next) => {
    const { symbol, timeframe } = req.query;

    if (!symbol || !timeframe) {
        return res.status(400).json({ error: "Symbol and timeframe are required." });
    }

    try {
        const ohlcData = await getOhlcData(symbol, timeframe);
        // The data from getOhlcData already has Date objects, which is fine for JSON serialization.
        res.json({ ohlcData });
    } catch (error) {
        console.error(`[API ERROR] /api/training/ohlc-data for ${symbol}:`, error.message);
        next(error);
    }
});

module.exports = router;