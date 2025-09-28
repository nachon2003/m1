// server.js
require('dotenv').config({ path: require('path').resolve(__dirname, './.env') }); // ระบุ Path ให้ชัดเจน
// ...

// backend/server.js
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { SMA, RSI, MACD, Stochastic } = require('technicalindicators'); // Import indicators
const bcrypt = require('bcrypt'); // ADDED
const jwt = require('jsonwebtoken'); // ADDED
const path = require('path'); // Import path for correct file paths
const { spawn } = require('child_process'); // Import child_process for spawning Python script
const multer = require('multer'); // 1. Import multer
const fs = require('fs').promises; // Use the promises version for convenience with async/await
const WebSocket = require('ws'); // 1. Import WebSocket library
const { initializeDatabase } = require('./database'); // Import database initializer
const NodeCache = require('node-cache');
const { authenticateToken } = require('./authMiddleware');
const { sendPasswordResetEmail } = require('./emailService');

const PYTHON_EXECUTABLE = process.env.PYTHON_EXECUTABLE || 'python'; // Use from .env or default to 'python'

// =======================================================================
// >>>>>>>>>>>>>>>>> Configure Your API Keys Here <<<<<<<<<<<<<<<<<
const TWELVEDATA_API_KEY = process.env.TWELVEDATA_API_KEY; // Your Twelve Data API Key from .env
const GNEWS_API_KEY = process.env.GNEWS_API_KEY; // Your GNews API Key from .env
const JWT_SECRET = process.env.JWT_SECRET; // ADDED
const SALT_ROUNDS = 10; // For bcrypt password hashing // ADDED
// =======================================================================

// --- Startup API Key Check ---
// A simple check to ensure the key exists. The API provider will validate it.
if (!TWELVEDATA_API_KEY) {
    console.error('\x1b[31m%s\x1b[0m', 'FATAL ERROR: TWELVEDATA_API_KEY is not found in your backend/.env file.');
    process.exit(1);
}
if (!JWT_SECRET) { // ADDED
    console.error('\x1b[31m%s\x1b[0m', 'FATAL ERROR: JWT_SECRET is not found in your backend/.env file.');
    console.error('Please add a long, random string for JWT_SECRET to your .env file.');
    process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001; // (แก้ไข) ใช้ Port จาก Environment Variable ของ Render

// 2. ตั้งค่า Multer สำหรับการอัปโหลดไฟล์
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, 'public/uploads');
        // ตรวจสอบและสร้างโฟลเดอร์ถ้ายังไม่มี
        fs.mkdir(uploadPath, { recursive: true }).then(() => {
            cb(null, uploadPath);
        }).catch(err => cb(err));
    },
    filename: function (req, file, cb) {
        // สร้างชื่อไฟล์ที่ไม่ซ้ำกันโดยใช้ timestamp และชื่อไฟล์เดิม
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// (แก้ไข) Import Rate Limiter จากไฟล์ที่แยกไว้
const { twelveDataRateLimiter } = require('./rateLimiter');

// =======================================================================
// Caching Setup with node-cache
// stdTTL: Standard Time-to-Live in seconds for every new entry.
// checkperiod: How often the cache checks for expired keys (in seconds).
const ohlcCache = new NodeCache({ stdTTL: 60 * 60, checkperiod: 120 }); // 1 hour TTL
const newsCache = new NodeCache({ stdTTL: 5 * 60, checkperiod: 120 }); // 5 minute TTL

// --- (แก้ไข) ตั้งค่า CORS ให้ปลอดภัยสำหรับ Production ---
// กำหนด URL ของ Frontend ที่จะอนุญาตให้เรียก API ได้
const allowedOrigins = [
    'https://m1-two-topaz.vercel.app', // (สำคัญ) ตรวจสอบให้แน่ใจว่านี่คือ URL ที่ถูกต้องของ Vercel App ของคุณ
    'http://localhost:3000'           // URL สำหรับการพัฒนาบนเครื่อง (dev server)
];

const corsOptions = {
  origin: (origin, callback) => {
    // อนุญาตถ้า origin อยู่ใน allowedOrigins
    // หรือถ้า request ไม่มี origin (เช่น การเรียกผ่าน Postman หรือ server-to-server)
    if (allowedOrigins.includes(origin) || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // อนุญาตให้ส่งข้อมูล credentials (เช่น Authorization header)
};

app.use(cors(corsOptions)); // ใช้ cors middleware พร้อมกับ options ที่กำหนด

app.use(express.json());

// Serve static files from the backend's public directory (for uploads)
app.use(express.static(path.join(__dirname, 'public')));

// =======================================================================
// >>>>>>>>>>>>>>>>> API Route Registration <<<<<<<<<<<<<<<<<
// =======================================================================
// สำหรับทุก request ที่ขึ้นต้นด้วย /api/ai ให้ส่งไปที่ aiRoutes.js
// (ย้ายมาจากด้านบนเพื่อความเป็นระเบียบ)
const aiRoutes = require('./aiRoutes');
app.use('/api/ai', aiRoutes);
// (ใหม่) ลงทะเบียน Route สำหรับ Technical Analysis
const technicalRoutes = require('./technicalRoutes');
app.use('/api/technical', technicalRoutes);
// (ใหม่) ลงทะเบียน Route สำหรับ Training Pipeline
const trainingRoutes = require('./trainingRoutes');
app.use('/api/training', trainingRoutes);
// (ใหม่) ลงทะเบียน Route สำหรับ Support System
const supportRoutes = require('./supportRoutes');
app.use('/api/support', supportRoutes);
// (ใหม่) ลงทะเบียน Route สำหรับ Admin Dashboard
const adminRoutes = require('./adminRoutes');
app.use('/api/admin', adminRoutes);
// (ใหม่) ลงทะเบียน Route สำหรับ Backtest Results
const backtestRoutes = require('./services/backtestRoutes');
app.use('/api/backtest', backtestRoutes);

// Helper to check if a symbol is a supported forex pair
// Helper to get point size (pip/point) for each symbol
function getPointSize(symbol) {
    if (symbol && symbol.toUpperCase() === 'XAU/USD') return 0.01; // Gold uses 0.01
    return 0.0001; // Forex pairs use 0.0001
}
const isSupportedForexPair = (symbol) => {
    const supportedForexPairs = [
        'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CAD', 'USD/CHF', 'XAU/USD'
    ];
    return supportedForexPairs.includes(symbol.toUpperCase());
};

// (ลบออก) Middleware ที่ไม่ได้ใช้แล้ว เพราะเราจะไปเรียก Rate Limiter ในฟังก์ชันที่เรียก API โดยตรง
// const enforceTwelveDataRateLimit = async (req, res, next) => { ... };
// app.use('/api/ai-signal', enforceTwelveDataRateLimit);
// app.use('/api/ohlc-data', enforceTwelveDataRateLimit);
// app.use('/api/fetch-and-save-ohlc-for-training', enforceTwelveDataRateLimit);

// --- (DEPRECATED) Endpoint for live prices via polling ---
// This endpoint is kept for reference but is replaced by the WebSocket implementation.
// app.get('/api/live-prices', enforceTwelveDataRateLimit, async (req, res) => {
//     const { symbols } = req.query;

//     // The symbols will come as a single comma-separated string from the frontend
//     if (!symbols || typeof symbols !== 'string') {
//         return res.status(400).json({ error: "Symbols are required and must be a comma-separated string." });
//     }

//     try {
//         // Construct a single URL for all symbols to make one API call instead of many
//         const twelveDataUrl = `https://api.twelvedata.com/price?symbol=${symbols}&apikey=${TWELVEDATA_API_KEY}`;
        
//         console.log(`Fetching batch live prices from Twelve Data for: ${symbols}`);
//         const response = await axios.get(twelveDataUrl);

//         // Handle potential API error response for the whole batch
//         if (response.data.code >= 400) {
//              console.error(`Failed to get live prices from Twelve Data:`, response.data);
//              return res.status(response.data.code).json({ error: response.data.message });
//         }

//         const pricesObject = {};
//         // The response for multiple symbols is an object like: { "EUR/USD": { "price": "1.085" }, ... }
//         for (const symbol in response.data) {
//             if (response.data[symbol] && response.data[symbol].price) {
//                 pricesObject[symbol] = parseFloat(response.data[symbol].price);
//             } else {
//                 console.warn(`Could not retrieve price for symbol: ${symbol} in batch request.`);
//                 pricesObject[symbol] = null;
//             }
//         }

//         res.json(pricesObject);
//     } catch (error) {
//         console.error("Error fetching live prices:", error);
//         if (error.response) {
//             console.error(`Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}`);
//             return res.status(error.response.status).json({ error: "Failed to fetch live prices from provider.", details: error.response.data });
//         }
//         return res.status(500).json({ error: "A server error occurred while fetching live prices." });
//     }
// });



// =======================================================================
// Helper functions for Data Fetching and Indicator Calculations
// =======================================================================

// Function to get historical OHLC data from Twelve Data
// interval '1day' for daily data
const getOhlcDailyData = async (symbol) => {
    const normalizedSymbol = symbol.toUpperCase();
    
    // Check cache first using node-cache's .get() method
    const cachedData = ohlcCache.get(normalizedSymbol);
    if (cachedData) {
        console.log(`Serving Forex OHLC data for ${normalizedSymbol} from cache (Twelve Data).`);
        return cachedData;
    }

    try {
        // Twelve Data API for forex historical data
        // For full historical data, Twelve Data's free tier has limitations.
        // We'll aim for `outputsize=5000` which is a common max for free/low-tier plans.
        const twelveDataUrl = `https://api.twelvedata.com/time_series?symbol=${normalizedSymbol}&interval=1day&outputsize=5000&apikey=${TWELVEDATA_API_KEY}`;

        console.log(`Fetching OHLC data from Twelve Data for ${normalizedSymbol} (Daily, outputsize=5000)...`);
        const tdResponse = await axios.get(twelveDataUrl);

        if (tdResponse.data && tdResponse.data.values && tdResponse.data.values.length > 0) {
            const ohlcData = tdResponse.data.values.map(d => ({
                time: new Date(d.datetime), // Twelve Data uses 'datetime'
                open: parseFloat(d.open),
                high: parseFloat(d.high),
                low: parseFloat(d.low),
                close: parseFloat(d.close),
            })).reverse(); // Twelve Data returns newest first, reverse to get oldest first

            console.log(`Successfully fetched ${ohlcData.length} OHLC data points from Twelve Data.`);
            // Set data in cache. The TTL is handled automatically.
            ohlcCache.set(normalizedSymbol, ohlcData);
            return ohlcData;
        } else if (tdResponse.data && tdResponse.data.code && tdResponse.data.message) {
            console.error(`[Twelve Data Error] for OHLC daily: ${tdResponse.data.message} (Code: ${tdResponse.data.code})`);
            return null;
        }
        else {
            console.error("Twelve Data OHLC daily API error or invalid response format.");
            return null;
        }
    } catch (error) {
        console.error(`Error fetching OHLC data from Twelve Data for ${normalizedSymbol}:`, error.message);
        if (error.response) {
            console.error(`Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}`);
        }
        return null;
    }
};

// Helper to save OHLC data to a CSV file for Python training
const saveOhlcDataToCsv = async (ohlcData) => {
    const csvFilePath = path.join(__dirname, '../ai_model', 'ohlc_data.csv');
    console.log(`Attempting to save OHLC data to: ${csvFilePath}`);

    if (!ohlcData || ohlcData.length === 0) {
        console.warn("No OHLC data to save to CSV.");
        return false;
    }

    // Prepare CSV header
    const csvHeader = 'time,open,high,low,close\n'; // CSV Header

    // Prepare CSV rows
    const csvRows = ohlcData.map(d => {
        const date = new Date(d.time).toISOString().split('T')[0]; // Format date as YYYY-MM-DD
        return `${date},${d.open},${d.high},${d.low},${d.close}`;
    }).join('\n');
    
    const csvContent = csvHeader + csvRows;

    try {
        // Ensure the directory exists
        const dir = path.dirname(csvFilePath);
        await fs.mkdir(dir, { recursive: true }); // Create directory if it doesn't exist

        await fs.writeFile(csvFilePath, csvContent);
        console.log(`OHLC data successfully saved to ${csvFilePath}`);
        return true;
    } catch (error) {
        console.error(`Error saving OHLC data to CSV at ${csvFilePath}:`, error.message);
        return false;
    }
};

// Helper for ta.highest (Pine Script)
const calculateHighest = (highs, length) => {
    if (!highs || highs.length < length) return null;
    let highestValue = -Infinity;
    for (let i = 0; i < length; i++) {
        if (highs[highs.length - 1 - i] > highestValue) {
            highestValue = highs[highs.length - 1 - i];
        }
    }
    return highestValue;
};

// Helper for ta.lowest (Pine Script)
const calculateLowest = (lows, length) => {
    if (!lows || lows.length < length) return null;
    let lowestValue = Infinity;
    for (let i = 0; i < length; i++) {
        if (lows[lows.length - 1 - i] < lowestValue) {
            lowestValue = lows[lows.length - 1 - i];
        }
    }
    return lowestValue;
};

// Helper for ta.crossover (Pine Script)
const isCrossover = (seriesA, seriesB) => {
    if (!seriesA || !seriesB || seriesA.length < 2 || seriesB.length < 2) return false;
    const currentA = seriesA[seriesA.length - 1];
    const prevA = seriesA[seriesA.length - 2];
    const currentB = seriesB[seriesB.length - 1];
    const prevB = seriesB[seriesB.length - 2];

    return prevA <= prevB && currentA > currentB;
};

// Helper for ta.crossunder (Pine Script)
const isCrossunder = (seriesA, seriesB) => {
    if (!seriesA || !seriesB || seriesA.length < 2 || seriesB.length < 2) return false;
    const currentA = seriesA[seriesA.length - 1];
    const prevA = seriesA[seriesA.length - 2];
    const currentB = seriesB[seriesB.length - 1];
    const prevB = seriesB[seriesB.length - 2];

    return prevA >= prevB && currentA < currentB;
};

// =======================================================================
// AI Signal & Market Strength Endpoints
// (หมายเหตุ) Endpoints เหล่านี้ถูกย้ายไปที่ routes/aiRoutes.js แล้ว
// =======================================================================
// =======================================================================
// Profile & User Management Endpoints
// =======================================================================

// (ใหม่) Endpoint สำหรับตรวจสอบ Token และดึงข้อมูลผู้ใช้
app.get('/api/auth/verify', authenticateToken, async (req, res) => {
    const db = req.app.get('db');
    try {
        // ดึงข้อมูลผู้ใช้จากฐานข้อมูลโดยใช้ ID ที่ได้จาก token
        const user = await db.get('SELECT id, username, email, is_admin, profile_image_url FROM users WHERE id = ?', req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        // ไม่ต้องส่ง password_hash กลับไป
        res.json(user);
    } catch (error) {
        console.error('Error verifying token and fetching user:', error);
        res.status(500).json({ message: 'Server error during token verification.' });
    }
});


// --- Get Current User Endpoint (from token) ---
app.get('/api/auth/me', authenticateToken, async (req, res) => {
    const db = req.app.get('db');
    try {
        // (แก้ไข) เปลี่ยน SELECT ให้ดึงข้อมูลทั้งหมด (*) เพื่อให้ได้ is_admin มาด้วย
        const user = await db.get('SELECT * FROM users WHERE id = ?', req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        // (แก้ไข) ลบ password_hash ออกก่อนส่งกลับไปให้ client
        const { password_hash, ...userResponse } = user;
        res.json({ user: userResponse });
    } catch (error) {
        console.error('Error fetching current user:', error);
        res.status(500).json({ message: 'Server error.' });
    }
});

// --- Upload Profile Image Endpoint ---
app.post('/api/auth/upload-profile-image', authenticateToken, upload.single('profileImage'), async (req, res) => { // PROTECTED
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }

    const db = req.app.get('db');
    const user_id = req.user.id; // Get user ID from authenticated token
    const imageUrl = `/uploads/${req.file.filename}`; // Path ที่จะใช้ใน frontend

    try {
        await db.run('UPDATE users SET profile_image_url = ? WHERE id = ?', [imageUrl, user_id]); // UPDATE DB
        console.log(`User ${user_id} updated profile picture. Saved as: ${req.file.filename}`);
        res.json({ message: 'Profile image uploaded successfully!', imageUrl: imageUrl });
    } catch (error) {
        console.error('Failed to update profile image in database:', error);
        res.status(500).json({ message: 'Server error: Failed to update profile image path.' });
    }
});

// --- Change Password Endpoint ---
app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const db = req.app.get('db');
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Current and new passwords are required.' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ message: 'New password must be at least 6 characters long.' });
    }

    try {
        // 1. Get the current user's hashed password
        const user = await db.get('SELECT password_hash FROM users WHERE id = ?', userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // 2. Compare the provided current password with the stored hash
        const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Incorrect current password.' });
        }

        // 3. Hash the new password and update the database
        const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
        await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [newPasswordHash, userId]);

        res.status(200).json({ message: 'Password changed successfully.' });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ message: 'Server error while changing password.' });
    }
});

// (ใหม่) Endpoint สำหรับอัปเดตข้อมูลผู้ใช้ (เช่น อีเมล)
app.put('/api/auth/me', authenticateToken, async (req, res, next) => {
    const { email } = req.body;
    const userId = req.user.id;
    const db = req.app.get('db');

    if (!email) {
        return res.status(400).json({ message: 'Email is required.' });
    }

    // (Optional but recommended) Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Invalid email format.' });
    }

    try {
        // ตรวจสอบว่าอีเมลใหม่นี้ถูกใช้โดยผู้ใช้อื่นแล้วหรือยัง
        const existingEmailUser = await db.get('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
        if (existingEmailUser) {
            return res.status(409).json({ message: 'This email is already in use by another account.' });
        }

        // อัปเดตอีเมลในฐานข้อมูล
        await db.run('UPDATE users SET email = ? WHERE id = ?', [email, userId]);

        res.status(200).json({ message: 'Profile updated successfully.', email: email });
    } catch (error) {
        next(error); // ส่ง error ไปให้ Global Error Handler
    }
});

// =======================================================================
// Trade History & Statistics Endpoints
// =======================================================================
app.get('/api/statistics', authenticateToken, async (req, res) => { // PROTECTED
    try {
        const db = req.app.get('db');
        const userId = req.user.id;
        // (แก้ไข) เปลี่ยนไปใช้ตาราง signal_records และนับเฉพาะ trade ที่ปิดแล้ว (status != 'open')
        const closedTrades = await db.all("SELECT symbol, pnl FROM signal_records WHERE user_id = ? AND status != 'open'", userId);

        const totalTrades = closedTrades.length;
        // (แก้ไข) ตรรกะการนับ win/loss จากคอลัมน์ pnl
        const winningTrades = closedTrades.filter(t => t.pnl > 0);
        const losingTrades = closedTrades.filter(t => t.pnl < 0);

        // ถ้าไม่มีข้อมูลเทรดเลย ให้ส่งค่าเริ่มต้นกลับไป
        if (totalTrades === 0) {
            return res.json({ totalTrades: 0, wins: 0, losses: 0, winRate: 0, averageProfit: 0, averageLoss: 0, bestPair: 'N/A' });
        }

        // คำนวณค่าต่างๆ
        const winRate = (winningTrades.length / totalTrades) * 100;
        const totalProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
        const totalLoss = losingTrades.reduce((sum, t) => sum + t.pnl, 0);
        const averageProfit = winningTrades.length > 0 ? totalProfit / winningTrades.length : 0;
        const averageLoss = losingTrades.length > 0 ? totalLoss / losingTrades.length : 0;

        // (แก้ไข) คำนวณคู่เงินที่ทำกำไรดีที่สุดจาก closedTrades
        const profitByPair = closedTrades.reduce((acc, trade) => {
            acc[trade.symbol] = (acc[trade.symbol] || 0) + trade.pnl;
            return acc;
        }, {});

        let bestPair = 'N/A';
        if (Object.keys(profitByPair).length > 0) {
            bestPair = Object.entries(profitByPair).reduce((best, current) => {
                return current[1] > best[1] ? current : best;
            })[0];
            // ถ้ากำไรสูงสุดยังติดลบ ก็ไม่แสดง
            if (profitByPair[bestPair] <= 0) {
                bestPair = 'N/A';
            }
        }

        res.json({
            totalTrades,
            wins: winningTrades.length,
            losses: losingTrades.length,
            winRate,
            averageProfit,
            averageLoss,
            bestPair
        });
    } catch (error) {
        console.error('Failed to calculate statistics from database:', error);
        res.status(500).json({ message: 'Failed to calculate statistics.' });
    }
});

// (ใหม่) Endpoint สำหรับดึงข้อมูลสรุปของสัญญาณที่เคยสร้าง
app.get('/api/statistics/signal-summary', authenticateToken, async (req, res) => {
    try {
        const db = req.app.get('db');
        const userId = req.user.id;

        // นับจำนวนสัญญาณทั้งหมดที่สร้างโดย AI
        const aiSignalCounts = await db.all(
            `SELECT signal, COUNT(*) as count FROM signal_records WHERE user_id = ? AND source = 'ai' GROUP BY signal`,
            userId
        );

        // นับจำนวนสัญญาณทั้งหมดที่สร้างโดย Technical Analysis
        const techSignalCounts = await db.all(
            `SELECT signal, COUNT(*) as count FROM signal_records WHERE user_id = ? AND source = 'technical' GROUP BY signal`,
            userId
        );

        res.json({
            ai: aiSignalCounts,
            technical: techSignalCounts
        });

    } catch (error) {
        console.error('Failed to calculate signal summary from database:', error);
        res.status(500).json({ message: 'Failed to calculate signal summary.' });
    }
});

// (ใหม่) Endpoint สำหรับดึงประวัติการเทรดทั้งหมดเพื่อแสดงในตาราง
app.get('/api/statistics/trade-history', authenticateToken, async (req, res) => {
    try {
        const db = req.app.get('db');
        const userId = req.user.id;

        const history = await db.all(
            `SELECT * FROM signal_records WHERE user_id = ? ORDER BY created_at DESC`,
            userId
        );
        res.json(history);
    } catch (error) {
        console.error('Failed to fetch trade history from database:', error);
        res.status(500).json({ message: 'Failed to retrieve trade history.' });
    }
});

// =======================================================================
// Authentication Endpoints
// =======================================================================

// --- Register Endpoint ---
app.post('/api/auth/register', async (req, res) => {
    const { username, password, email } = req.body; // (ใหม่) รับ email
    const db = req.app.get('db');

    if (!username || !password || !email) { // (แก้ไข) ตรวจสอบ email ด้วย
        return res.status(400).json({ message: 'Username, password, and email are required.' });
    }
    if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    try {
        // Check if user already exists
        const existingUser = await db.get('SELECT * FROM users WHERE username = ?', username);
        if (existingUser) {
            return res.status(409).json({ message: 'Username already taken.' });
        }
        // (ใหม่) ตรวจสอบว่าอีเมลซ้ำหรือไม่
        const existingEmail = await db.get('SELECT * FROM users WHERE email = ?', email);
        if (existingEmail) {
            return res.status(409).json({ message: 'Email already in use.' });
        }

        // Hash the password
        const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

        // Insert new user into the database
        const result = await db.run(
            'INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)', // (แก้ไข) เพิ่ม email
            [username, password_hash, email] // (แก้ไข) เพิ่ม email
        );

        // (แก้ไข) ดึงข้อมูลผู้ใช้ใหม่ทั้งหมดเพื่อให้ได้ is_admin มาด้วย
        const user = await db.get('SELECT * FROM users WHERE id = ?', result.lastID);

        // Create a JWT token
        const expiresInSeconds = 24 * 60 * 60; // 1 day in seconds
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: expiresInSeconds });

        // (แก้ไข) เตรียมข้อมูลผู้ใช้เพื่อส่งกลับ (โดยลบ password_hash ออก)
        const { password_hash: removed_hash, ...userResponse } = user;

        res.status(201).json({
            message: 'User registered successfully.',
            token,
            user: userResponse, // ส่งข้อมูลผู้ใช้ที่สมบูรณ์กลับไป
            expiresIn: expiresInSeconds // เพิ่ม expiresIn เพื่อให้ Frontend คำนวณวันหมดอายุได้
        });

    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).json({ message: 'Server error during registration.' });
    }
});

// --- Login Endpoint ---
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    const db = req.app.get('db');

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }

    try {
        // Find user by username
        const user = await db.get('SELECT * FROM users WHERE username = ?', username);
        if (!user) {
            return res.status(401).json({ message: 'Invalid username or password.' }); // Use a generic message for security
        }

        // Compare password with the stored hash
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid username or password.' }); // Generic message
        }

        // User is authenticated, create a JWT token
        const userPayload = { id: user.id, username: user.username };
        const expiresInSeconds = 24 * 60 * 60; // 1 day in seconds
        const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: expiresInSeconds });

        // Prepare user object to send back (without the password hash)
        const { password_hash, ...userResponse } = user;

        res.status(200).json({ message: 'Login successful.', token, user: userResponse, expiresIn: expiresInSeconds });

    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ message: 'Server error during login.' });
    }
});

// --- Forgot Password Endpoint ---
app.post('/api/auth/forgot-password', async (req, res, next) => {
    const { email } = req.body;
    const db = req.app.get('db');

    if (!email) {
        return res.status(400).json({ message: 'Email is required.' });
    }

    try {
        const user = await db.get('SELECT id, email FROM users WHERE email = ?', email);

        // เพื่อความปลอดภัย, เราจะส่งข้อความสำเร็จเสมอไม่ว่าจะเจออีเมลในระบบหรือไม่
        // เพื่อป้องกันไม่ให้ผู้ไม่หวังดีใช้ฟังก์ชันนี้เพื่อเช็คว่าอีเมลใดมีอยู่ในระบบบ้าง
        if (user) {
            // สร้าง Reset Token ที่มีอายุ 1 ชั่วโมง
            const resetToken = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '1h' });

            // ส่งอีเมลพร้อมลิงก์สำหรับรีเซ็ต
            await sendPasswordResetEmail({ recipientEmail: user.email, resetToken });
        }

        res.status(200).json({ message: 'If an account with that email exists, a password reset link has been sent.' });

    } catch (error) {
        next(error);
    }
});

// --- Reset Password Endpoint ---
app.post('/api/auth/reset-password', async (req, res, next) => {
    const { token, newPassword } = req.body;
    const db = req.app.get('db');

    if (!token || !newPassword) {
        return res.status(400).json({ message: 'Token and new password are required.' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    try {
        // 1. ตรวจสอบความถูกต้องของ Token
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;

        // 2. Hash รหัสผ่านใหม่
        const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

        // 3. อัปเดตรหัสผ่านในฐานข้อมูล
        await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [newPasswordHash, userId]);

        res.status(200).json({ message: 'Password has been reset successfully.' });

    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            return res.status(400).json({ message: 'Invalid or expired password reset token.' });
        }
        next(error);
    }
});

// =======================================================================
// END AI Signal Endpoint
// =======================================================================


// Endpoint for OHLC Data (using Twelve Data for Forex Daily)
app.get('/api/ohlc-data', async (req, res) => {
    const { timeframe, symbol } = req.query;

    if (!symbol) {
        return res.status(400).json({ error: "Symbol is required." });
    }
    if (!isSupportedForexPair(symbol)) {
        return res.status(400).json({ error: `Unsupported forex symbol: ${symbol}` });
    }

    if (timeframe !== '1d') {
        console.warn(`Attempted to fetch non-daily OHLC for ${symbol}. The free tier of Twelve Data supports various intervals, but we're configured for '1day'.`);
        // For actual production, you'd integrate proper intraday data if needed.
        // For Twelve Data, you might be able to fetch different intervals if needed by updating this logic
        return res.json({ ohlcData: [] }); 
    }

    const ohlcData = await getOhlcDailyData(symbol); // Use the shared helper function

    if (ohlcData) {
        // Filter OHLC data to only include the necessary fields for chart
        const chartOhlcData = ohlcData.map(d => ({
            time: d.time.getTime() / 1000, // Convert Date object to Unix timestamp in seconds
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
        }));
        return res.json({ ohlcData: chartOhlcData });
    } else {
        return res.status(500).json({ error: "Failed to fetch OHLC data for chart." });
    }
});

// Endpoint to fetch and save full OHLC data for training (newly added endpoint)
app.get('/api/fetch-and-save-ohlc-for-training', async (req, res) => {
    // (แก้ไข) รับ symbol โดยตรงจาก query string เพื่อให้ยืดหยุ่น
    const symbol = req.query.symbol || 'EUR/USD';

    if (!isSupportedForexPair(symbol)) {
        return res.status(400).json({ error: `Unsupported forex symbol: ${symbol}` });
    }

    // getOhlcDailyData is now configured for Twelve Data with outputsize=5000
    const ohlcData = await getOhlcDailyData(symbol); 

    if (ohlcData) {
        const saved = await saveOhlcDataToCsv(ohlcData);
        if (saved) {
            res.json({ success: true, message: `Successfully fetched and saved OHLC data for ${symbol}. Now you can run your Python training script.` });
        } else {
            res.status(500).json({ success: false, message: 'Failed to save OHLC data to CSV.' });
        }
    } else {
        res.status(500).json({ success: false, message: 'Could not fetch OHLC data from Twelve Data for training.' });
    }
});


app.get('/api/news', async (req, res) => {
    const { query = 'forex', lang = 'en', country = 'us', max = 10 } = req.query;

    if (!GNEWS_API_KEY || GNEWS_API_KEY === 'YOUR_GNEWS_API_KEY_HERE' || GNEWS_API_KEY === 'ec0cbcd2f1f5b26a60eb15028bf45b9e') {
        console.error("\x1b[31m%s\x1b[0m", "ERROR: GNews API Key is not configured. Please add GNEWS_API_KEY to your backend/.env file.");
        return res.status(500).json({ error: "GNews API Key is missing. Please configure it." });
    }

    const cacheKey = `${query}-${lang}-${country}-${max}`;

    // Check cache
    const cachedData = newsCache.get(cacheKey);
    if (cachedData) {
        console.log(`Serving news for "${query}" from cache.`);
        return res.json(cachedData);
    }

    console.log(`Fetching new news for "${query}" from GNews API...`);
    try {
        const gnewsUrl = `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=${lang}&country=${country}&max=${max}&apikey=${GNEWS_API_KEY}`;
        const response = await axios.get(gnewsUrl);

        if (response.data && response.data.articles) {
            const filteredArticles = response.data.articles.filter(
                article => article.title && article.image && article.url && article.description
            );

            const newsData = {
                articles: filteredArticles
            };

            newsCache.set(cacheKey, newsData);
            console.log(`Successfully fetched ${filteredArticles.length} news articles for "${query}".`);
            return res.json(newsData);
        } else if (response.data && response.data.errors) {
            console.error(`GNews API Error: ${JSON.stringify(response.data.errors)}`);
            return res.status(400).json({ error: response.data.errors.join(', ') });
        } else {
            console.error("GNews API: Unexpected response format for news:", JSON.stringify(response.data));
            return res.status(500).json({ error: "Failed to parse news data from API." });
        }
    } catch (error) {
        // Log the detailed error from the provider
        console.error(`Error fetching news for "${query}" from GNews API:`, error.message);
        if (error.response) {
            console.error(`GNews API Error - Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}`);
            
            // Extract a more specific error message if available
            const providerError = error.response.data.errors ? error.response.data.errors.join(', ') : 'Failed to fetch news from provider.';
            
            // Return the provider's status code and error message to the client
            return res.status(error.response.status).json({ error: providerError, details: error.response.data });
        }
        // Handle network errors (e.g., DNS, connection refused) where error.response is not available
        console.error('Network or other error occurred while trying to contact GNews API. This is not an API error but a connection problem.');
        return res.status(500).json({ error: "Failed to fetch news.", details: "Could not connect to the news provider." });
    }
});

// (แก้ไข) Serve static files from the 'build' directory (the output of `npm run build`)
// This is crucial for serving your React build files from the root of the project
app.use(express.static(path.join(__dirname, '..', 'build')));

// (แก้ไข) For any other requests that don't match an API route, serve the index.html file from the 'build' directory
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'build', 'index.html'));
});

// =======================================================================
// Centralized Error Handling Middleware
// =======================================================================
// This middleware catches all errors passed via next(error).
// It MUST be the last `app.use()` call before `app.listen()`.
app.use((err, req, res, next) => {
    // Log the full error for debugging purposes on the server
    console.error(`[Global Error Handler] Path: ${req.path}`, err);

    // Default to 500 Internal Server Error if no status code is set on the error
    const statusCode = err.statusCode || 500;
    const message = err.message || 'An unexpected error occurred on the server.';

    // Send a structured error response to the client
    res.status(statusCode).json({
        success: false,
        error: {
            message: message,
            details: err.details || null
        }
    });
});

// 2. เปลี่ยน app.listen เป็น server.listen และย้ายไปอยู่ใน async function
// เพื่อให้เราสามารถเชื่อมต่อฐานข้อมูลให้เสร็จก่อนเริ่ม server
let server;

initializeDatabase().then(db => {
    app.set('db', db); // ทำให้เราสามารถเข้าถึง db connection จาก req object ได้ (req.app.get('db'))

    server = app.listen(PORT, () => {
        console.log(`Backend server listening at http://localhost:${PORT}`);
        setupWebSocketServer(); // เริ่ม WebSocket server หลังจาก HTTP server พร้อม
    });
});

// =======================================================================
// WebSocket Server Setup for Real-time Price Updates
// =======================================================================

// 3. สร้าง WebSocket Server และผูกเข้ากับ HTTP server
let wss;

function setupWebSocketServer() {
    wss = new WebSocket.Server({ server });
const broadcastLivePrices = async () => {
    // ถ้าไม่มี client เชื่อมต่ออยู่ ก็ไม่ต้องทำอะไร
    if (wss.clients.size === 0) {
        return;
    }

    const symbols = 'EUR/USD,GBP/USD,USD/JPY,USD/CAD,USD/CHF,XAU/USD';

    try {
        // (เพิ่ม) เรียกใช้ Rate Limiter ก่อนยิง API
        await twelveDataRateLimiter('WSS broadcastLivePrices');

        // Switched to the /quote endpoint for more robust data fetching.
        const twelveDataUrl = `https://api.twelvedata.com/quote?symbol=${symbols}&apikey=${TWELVEDATA_API_KEY}`;
        const response = await axios.get(twelveDataUrl);

        if (response.data.code >= 400) {
            const errorMessage = response.data.message || '';
            let errorPayload;

            // (เพิ่มใหม่) ตรวจจับข้อความ error เกี่ยวกับ Rate Limit โดยเฉพาะ
            if (errorMessage.includes('API credits')) {
                console.warn(`[WSS] Twelve Data rate limit exceeded. Pausing for next minute.`);
                errorPayload = JSON.stringify({
                    error: true,
                    type: 'RATE_LIMIT', // ส่ง type ใหม่เพื่อให้ Frontend รู้
                    message: 'Rate limit reached. Auto-retrying...'
                });
            } else {
                console.error(`[WSS] Failed to get live prices from Twelve Data:`, response.data);
                errorPayload = JSON.stringify({
                    error: true,
                    message: `Failed to fetch live prices from provider.`,
                    details: errorMessage
                });
            }
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) client.send(errorPayload);
            });
            return;
        }

        const pricesObject = {};
        for (const symbol in response.data) {
            // For the /quote endpoint, the current price is in the 'close' field.
            // We also check that the status is not 'error' for that specific symbol.
            if (response.data[symbol] && response.data[symbol].close && response.data[symbol].status !== 'error') {
                pricesObject[symbol] = parseFloat(response.data[symbol].close);
            }
        }

        const dataToSend = JSON.stringify(pricesObject);

        // ส่งข้อมูลไปยังทุก client ที่เชื่อมต่ออยู่
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(dataToSend);
            }
        });
    } catch (error) {
        console.error("[WSS] Error fetching/broadcasting live prices:", error.message);
        // Also send an error message to clients on network/other failures.
        const errorPayload = JSON.stringify({
            error: true,
            message: 'A server error occurred while fetching live prices.',
            details: error.message
        });
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) client.send(errorPayload);
        });
    }
};

// 4. Use a recursive setTimeout loop instead of setInterval for safer async operations.
// This ensures that one broadcast completes before the next one is scheduled, preventing overlaps
// if the API call takes longer than the interval.
const scheduleBroadcast = () => {
    // (แก้ไข) ปรับความถี่ในการเรียกซ้ำเป็นทุกๆ 8 วินาที (8,000 ms) ตามที่ผู้ใช้ต้องการ
    setTimeout(async () => {
        await broadcastLivePrices();
        scheduleBroadcast(); // Schedule the next broadcast
    }, 60000); 
};
scheduleBroadcast(); // Start the broadcast loop

// 5. จัดการเมื่อมี client ใหม่เชื่อมต่อเข้ามา
wss.on('connection', ws => {
    console.log('[WSS] A client connected.');

    // (ใหม่) จัดการเมื่อได้รับข้อความจาก client
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            // จัดการข้อความยืนยันตัวตน
            if (data.type === 'AUTH' && data.token) {
                jwt.verify(data.token, JWT_SECRET, (err, user) => {
                    if (err) {
                        console.error('[WSS] Auth failed:', err.message);
                        ws.terminate(); // ปิดการเชื่อมต่อถ้า token ไม่ถูกต้อง
                    } else {
                        ws.userId = user.id; // ผูก userId เข้ากับ WebSocket connection
                        console.log(`[WSS] Client authenticated for userId: ${ws.userId}`);
                    }
                });
            }
        } catch (e) {
            console.error('[WSS] Failed to parse message:', message, e);
        }
    });

    ws.on('close', () => {
        console.log(`[WSS] Client disconnected (userId: ${ws.userId || 'unauthenticated'})`);
    });
});
}

// =======================================================================
// (ใหม่) Background Worker สำหรับตรวจสอบและปิด Trade
// =======================================================================

/**
 * คำนวณกำไร/ขาดทุน (P/L) เป็นหน่วยของ Quote Currency
 * @param {object} trade - ข้อมูล trade จากฐานข้อมูล
 * @param {number} closePrice - ราคาที่ปิด trade
 * @returns {number} ค่า P/L
 */
function calculatePnl(trade, closePrice) {
    if (!trade || !trade.open_price || !closePrice) return 0;

    const priceDiff = trade.signal.toUpperCase().includes('BUY')
        ? closePrice - trade.open_price
        : trade.open_price - closePrice;

    // (แก้ไข) ปรับปรุงการคำนวณ P/L สำหรับ XAU/USD
    // สำหรับ XAU/USD, 1 pip คือการเปลี่ยนแปลง 0.1, แต่ P/L คือความต่างของราคาตรงๆ
    // สำหรับ Forex, P/L คือความต่างของราคา
    // เนื่องจากเรายังไม่ได้ใช้ Lot Size, P/L จะเป็นแค่ priceDiff
    return priceDiff;
}

/**
 * ฟังก์ชันหลักของ Worker ที่จะทำงานเป็นรอบๆ
 */
async function checkOpenSignals() {
    console.log('[WORKER] Running job to check open signals...');
    const db = app.get('db');
    if (!db) {
        console.error('[WORKER] Database not initialized. Skipping job.');
        return;
    }

    try {
        // (แก้ไข) ดึงสัญญาณทั้งหมดที่ยังไม่ปิด (ทั้ง pending และ open)
        const activeSignals = await db.all("SELECT * FROM signal_records WHERE status = 'open' OR status = 'pending'");
        if (activeSignals.length === 0) {
            console.log('[WORKER] No active signals to check.');
            return;
        }

        // ดึงราคาปัจจุบันของทุก Symbol ที่มี trade เปิดอยู่
        const symbolsToFetch = [...new Set(activeSignals.map(s => s.symbol))];
        const symbolsQuery = symbolsToFetch.join(',');
        const quoteUrl = `https://api.twelvedata.com/quote?symbol=${symbolsQuery}&apikey=${TWELVEDATA_API_KEY}`;
        
        await twelveDataRateLimiter('Signal Check Worker');
        const response = await axios.get(quoteUrl);
        const livePrices = response.data;

        for (const signal of activeSignals) {
            const currentPrice = livePrices[signal.symbol] ? parseFloat(livePrices[signal.symbol].close) : null;
            if (!currentPrice) continue;

            if (signal.status === 'pending') {
                // --- ส่วนจัดการ Pending Signals ---
                const isBuy = signal.signal.toUpperCase().includes('BUY');
                const entryZoneStart = signal.entry_zone_start;
                const entryZoneEnd = signal.entry_zone_end;

                // ตรวจสอบว่าราคาปัจจุบันเข้าโซนหรือไม่
                const hasEnteredZone = isBuy
                    ? currentPrice <= entryZoneStart && currentPrice >= entryZoneEnd
                    : currentPrice >= entryZoneStart && currentPrice <= entryZoneEnd;

                if (hasEnteredZone) {
                    // อัปเดตสถานะเป็น 'open' และบันทึกราคาเปิด
                    await db.run("UPDATE signal_records SET status = 'open', open_price = ? WHERE id = ?", [currentPrice, signal.id]);
                    console.log(`[WORKER] Signal #${signal.id} (${signal.symbol}) has been opened at price ${currentPrice}`);
                }

            } else if (signal.status === 'open') {
                // --- ส่วนจัดการ Open Signals (เหมือนเดิม) ---
                let closePrice = null;
                let newStatus = null;

                if (signal.signal.toUpperCase().includes('BUY') && currentPrice >= signal.predicted_price) {
                    newStatus = 'closed_tp';
                    closePrice = signal.predicted_price;
                } else if (signal.signal.toUpperCase().includes('BUY') && currentPrice <= signal.stop_loss_price) {
                    newStatus = 'closed_sl';
                    closePrice = signal.stop_loss_price;
                } else if (signal.signal.toUpperCase().includes('SELL') && currentPrice <= signal.predicted_price) {
                    newStatus = 'closed_tp';
                    closePrice = signal.predicted_price;
                } else if (signal.signal.toUpperCase().includes('SELL') && currentPrice >= signal.stop_loss_price) {
                    newStatus = 'closed_sl';
                    closePrice = signal.stop_loss_price;
                }

                if (newStatus && closePrice) {
                    const pnl = calculatePnl(signal, closePrice);
                    await db.run(
                        "UPDATE signal_records SET status = ?, close_price = ?, pnl = ?, closed_at = datetime('now') WHERE id = ?",
                        [newStatus, closePrice, pnl, signal.id]
                    );
                    console.log(`[WORKER] Closed signal #${signal.id} (${signal.symbol}) with status: ${newStatus}, P/L: ${pnl.toFixed(4)}`);
                }
            }
        }
        console.log('[WORKER] Finished checking active signals.');
    } catch (error) {
        console.error('[WORKER] Error checking open signals:', error.message);
    }
}

// ตั้งเวลาให้ Worker ทำงานทุกๆ 5 นาที (300,000 ms)
setInterval(checkOpenSignals, 300000);