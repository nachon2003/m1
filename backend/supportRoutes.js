const express = require('express');
const router = express.Router();
const { authenticateToken } = require('./authMiddleware');
const { sendNewTicketEmailToAdmins, sendReplyNotificationEmail } = require('./emailService'); // (ใหม่) Import email service

/**
 * @route   POST /api/support/tickets
 * @desc    สร้าง Support Ticket ใหม่
 * @access  Private
 */
router.post('/tickets', authenticateToken, async (req, res, next) => {
    const { subject, message } = req.body;
    const userId = req.user.id;
    const db = req.app.get('db');

    if (!subject || !message) {
        return res.status(400).json({ message: 'Subject and message are required.' });
    }

    try {
        const result = await db.run(
            'INSERT INTO support_tickets (user_id, subject, message) VALUES (?, ?, ?)',
            [userId, subject, message]
        );
        const newTicketId = result.lastID;

        // (ใหม่) ส่งอีเมลแจ้งเตือนแอดมิน
        await sendNewTicketEmailToAdmins({
            ticketId: newTicketId,
            subject: subject,
            user: req.user.username,
            db: db // (ใหม่) ส่ง db object เข้าไป
        });

        res.status(201).json({ message: 'Support ticket created successfully.', ticketId: newTicketId });
    } catch (error) {
        console.error('Error creating support ticket:', error);
        next(error);
    }
});

/**
 * @route   GET /api/support/tickets
 * @desc    ดึงประวัติ Ticket ทั้งหมดของผู้ใช้
 * @access  Private
 */
router.get('/tickets', authenticateToken, async (req, res, next) => {
    const userId = req.user.id;
    const db = req.app.get('db');

    try {
        const tickets = await db.all(
            'SELECT * FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );
        res.json(tickets);
    } catch (error) {
        console.error('Error fetching support tickets:', error);
        next(error);
    }
});

/**
 * @route   GET /api/support/tickets/:id
 * @desc    ดึงข้อมูล Ticket เดียวพร้อมการตอบกลับทั้งหมด (สำหรับเจ้าของ Ticket)
 * @access  Private
 */
router.get('/tickets/:id', authenticateToken, async (req, res, next) => {
    const { id } = req.params;
    const userId = req.user.id;
    const db = req.app.get('db');

    try {
        const ticket = await db.get('SELECT t.*, u.username FROM support_tickets t JOIN users u ON t.user_id = u.id WHERE t.id = ? AND t.user_id = ?', [id, userId]);
        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found or you do not have permission to view it.' });
        }
        const replies = await db.all('SELECT r.*, u.username, u.is_admin FROM ticket_replies r JOIN users u ON r.user_id = u.id WHERE r.ticket_id = ? ORDER BY r.created_at ASC', id);
        
        res.json({ ...ticket, replies });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/support/tickets/:id/reply
 * @desc    (User) ตอบกลับ Ticket
 * @access  Private
 */
router.post('/tickets/:id/reply', authenticateToken, async (req, res, next) => {
    const { message } = req.body;
    const { id: ticket_id } = req.params;
    const user_id = req.user.id;
    const db = req.app.get('db');

    if (!message) {
        return res.status(400).json({ message: 'Reply message cannot be empty.' });
    }

    try {
        await db.run('INSERT INTO ticket_replies (ticket_id, user_id, message) VALUES (?, ?, ?)', [ticket_id, user_id, message]);
        await db.run("UPDATE support_tickets SET status = 'in_progress' WHERE id = ? AND status = 'closed'", [ticket_id]);

        // (ใหม่) ส่งอีเมลแจ้งเตือนแอดมิน
        await sendNewTicketEmailToAdmins({
            ticketId: parseInt(ticket_id, 10),
            subject: `New Reply`, // อาจจะดึง subject จริงมาใส่
            user: req.user.username,
            db: db // (ใหม่) ส่ง db object เข้าไป
        });

        // (ใหม่) ส่งแจ้งเตือนผ่าน WebSocket ไปยังแอดมิน
        const wss = req.app.get('wss');
        if (wss) {
            const admins = await db.all('SELECT id FROM users WHERE is_admin = 1');
            const adminIds = admins.map(a => a.id);
            const userIdsToNotify = new Set(adminIds); // แจ้งเตือนแอดมินทุกคน

            const payload = JSON.stringify({
                type: 'NEW_REPLY',
                data: { ticketId: parseInt(ticket_id, 10) }
            });

            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN && client.userId && userIdsToNotify.has(client.userId)) {
                    client.send(payload);
                }
            });
        }
        res.status(201).json({ message: 'Reply sent successfully.' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;