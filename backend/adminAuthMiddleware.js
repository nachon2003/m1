// backend/adminAuthMiddleware.js
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

const adminAuthenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        return res.status(401).json({ message: 'Authentication token required.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const db = req.app.get('db');
        
        // ดึงข้อมูลผู้ใช้จาก DB เพื่อตรวจสอบว่าเป็นแอดมินจริงหรือไม่
        const user = await db.get('SELECT id, username, is_admin FROM users WHERE id = ?', decoded.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        if (!user.is_admin) {
            return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
        }

        req.user = user; // เก็บข้อมูลผู้ใช้ (ที่เป็นแอดมิน) ไว้ใน request
        next();
    } catch (err) {
        return res.status(403).json({ message: 'Invalid or expired token.' });
    }
};

module.exports = { adminAuthenticateToken };