// backend/authMiddleware.js
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = process.env;

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        return res.status(401).json({ message: 'Unauthorized: No token provided.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.log('JWT Verification Error:', err.message);
            return res.status(403).json({ message: 'Forbidden: Invalid or expired token.' });
        }
        req.user = user;
        next();
    });
};

module.exports = { authenticateToken };
