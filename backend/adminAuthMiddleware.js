const jwt = require('jsonwebtoken');
const { JWT_SECRET } = process.env;

const adminAuthenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        return res.status(401).json({ message: 'Unauthorized: No token provided.' });
    }

    jwt.verify(token, JWT_SECRET, async (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Forbidden: Invalid or expired token.' });
        }

        const db = req.app.get('db');
        try {
            const dbUser = await db.get('SELECT id, username, is_admin FROM users WHERE id = ?', user.id);
            if (!dbUser || dbUser.is_admin !== 1) {
                return res.status(403).json({ message: 'Forbidden: Admin access required.' });
            }
            req.user = dbUser; // Attach admin user info to request
            next();
        } catch (dbError) {
            next(dbError);
        }
    });
};

module.exports = { adminAuthenticateToken };