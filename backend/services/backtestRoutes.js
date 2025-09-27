// backend/backtestRoutes.js
const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { authenticateToken } = require('../authMiddleware');

/**
 * @route   GET /api/backtest/results
 * @desc    Get all backtest result statistics
 * @access  Private
 */
router.get('/results', authenticateToken, async (req, res, next) => {
    // (แก้ไข) ปรับ Path ให้ถูกต้องโดยการถอยขึ้นไป 2 ระดับจาก 'services' เพื่อไปยัง root ของโปรเจกต์
    const resultsDir = path.join(__dirname, '..', '..', 'ai_model', 'results', 'backtests');
    
    try {
        // 1. ตรวจสอบว่าโฟลเดอร์เก็บผลลัพธ์มีอยู่จริงหรือไม่
        await fs.access(resultsDir);

        // 2. อ่านไฟล์ทั้งหมดในโฟลเดอร์
        const files = await fs.readdir(resultsDir);

        // 3. กรองเฉพาะไฟล์สถิติ (.json)
        const statsFiles = files.filter(file => file.endsWith('_stats.json'));

        if (statsFiles.length === 0) {
            return res.json([]); // ส่ง Array ว่างกลับไปถ้าไม่พบไฟล์ผลลัพธ์
        }

        // 4. อ่านและแปลงข้อมูลจากแต่ละไฟล์
        const backtestResults = await Promise.all(
            statsFiles.map(async (file) => {
                const filePath = path.join(resultsDir, file);
                const fileContent = await fs.readFile(filePath, 'utf8');
                return JSON.parse(fileContent);
            })
        );

        // (ใหม่) 5. สรุปผลลัพธ์โดยการหาค่าเฉลี่ยของแต่ละ Symbol จากทุก Timeframe
        const aggregatedResults = {};

        for (const result of backtestResults) {
            const symbol = result.symbol;
            if (!symbol) continue;

            // ถ้ายังไม่มี Symbol นี้ใน object ให้สร้างขึ้นมาก่อน
            if (!aggregatedResults[symbol]) {
                aggregatedResults[symbol] = {
                    symbol: symbol,
                    return_pct: 0,
                    buy_and_hold_return_pct: 0,
                    max_drawdown_pct: 0,
                    win_rate_pct: 0,
                    total_trades: 0,
                    profit_factor: 0,
                    sharpe_ratio: 0,
                    duration_days: 0,
                    count: 0 // ตัวนับจำนวน Timeframe
                };
            }

            // รวมค่าสถิติต่างๆ
            const stats = aggregatedResults[symbol];
            stats.return_pct += result.return_pct || 0;
            stats.buy_and_hold_return_pct += result.buy_and_hold_return_pct || 0;
            stats.max_drawdown_pct += result.max_drawdown_pct || 0;
            stats.win_rate_pct += result.win_rate_pct || 0;
            stats.total_trades += result.total_trades || 0;
            stats.profit_factor += result.profit_factor || 0;
            stats.sharpe_ratio += result.sharpe_ratio || 0;
            stats.duration_days += result.duration_days || 0;
            stats.count++;
        }

        // 6. คำนวณค่าเฉลี่ยและจัดรูปแบบข้อมูลใหม่
        const finalResults = Object.values(aggregatedResults).map(stats => ({
            symbol: stats.symbol,
            return_pct: stats.return_pct / stats.count,
            buy_and_hold_return_pct: stats.buy_and_hold_return_pct / stats.count,
            max_drawdown_pct: stats.max_drawdown_pct / stats.count,
            win_rate_pct: stats.win_rate_pct / stats.count,
            total_trades: stats.total_trades / stats.count, // ค่าเฉลี่ยจำนวนเทรด
            profit_factor: stats.profit_factor / stats.count,
            sharpe_ratio: stats.sharpe_ratio / stats.count,
            duration_days: stats.duration_days / stats.count,
        }));

        res.json(finalResults);
    } catch (error) {
        // ถ้าไม่พบโฟลเดอร์ ให้ส่ง Array ว่างกลับไปพร้อมกับ log แจ้งเตือน
        if (error.code === 'ENOENT') {
            console.warn(`Backtest results directory not found at: ${resultsDir}`);
            return res.json([]);
        }
        next(error); // ส่ง error อื่นๆ ไปให้ error handler จัดการ
    }
});

module.exports = router;