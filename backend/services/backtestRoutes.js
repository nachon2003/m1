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

        // (แก้ไข) ไม่ต้องทำการสรุปผลลัพธ์ แต่ส่งข้อมูลทั้งหมดกลับไปให้ Frontend จัดการ
        // และเรียงลำดับข้อมูลตาม Symbol และ Timeframe
        backtestResults.sort((a, b) => a.symbol.localeCompare(b.symbol) || a.timeframe.localeCompare(b.timeframe));
        res.json(backtestResults);
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