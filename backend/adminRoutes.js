const express = require('express');
const router = express.Router();
const { adminAuthenticateToken } = require('./adminAuthMiddleware');
const { sendReplyNotificationEmail } = require('./emailService'); // (ใหม่) Import email service

/**
 * =======================================================================
 * User Management Routes
 * =======================================================================
 */

/**
 * @route   GET /api/admin/users
 * @desc    (Admin) ดึงรายชื่อผู้ใช้ทั้งหมด
 * @access  Admin
 */
router.get('/users', adminAuthenticateToken, async (req, res, next) => {
    const db = req.app.get('db');
    try {
        // ดึงข้อมูลผู้ใช้ทั้งหมด ยกเว้นรหัสผ่าน
        const users = await db.all('SELECT id, username, email, is_admin, created_at FROM users ORDER BY id ASC');
        res.json(users);
    } catch (error) {
        next(error);
    }
});

/**
 * @route   PUT /api/admin/users/:id/role
 * @desc    (Admin) อัปเดตบทบาทของผู้ใช้ (is_admin)
 * @access  Admin
 */
router.put('/users/:id/role', adminAuthenticateToken, async (req, res, next) => {
    const { id } = req.params;
    const { isAdmin } = req.body; // รับค่า is_admin (true/false)
    const db = req.app.get('db');

    if (parseInt(id, 10) === req.user.id) {
        return res.status(400).json({ message: "Admins cannot change their own role." });
    }

    try {
        await db.run('UPDATE users SET is_admin = ? WHERE id = ?', [isAdmin ? 1 : 0, id]);
        res.json({ message: `User role updated successfully.` });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   DELETE /api/admin/users/:id
 * @desc    (Admin) ลบผู้ใช้และข้อมูลที่เกี่ยวข้องทั้งหมด
 * @access  Admin
 */
router.delete('/users/:id', adminAuthenticateToken, async (req, res, next) => {
    const { id } = req.params;
    const db = req.app.get('db');

    // ป้องกันไม่ให้แอดมินลบตัวเอง
    if (parseInt(id, 10) === req.user.id) {
        return res.status(400).json({ message: "Admins cannot delete their own account." });
    }

    try {
        // ใช้ Transaction เพื่อให้แน่ใจว่าทุกอย่างจะถูกลบพร้อมกันทั้งหมด
        // หรือจะไม่เกิดอะไรขึ้นเลยถ้ามีข้อผิดพลาด
        await db.exec('BEGIN TRANSACTION');

        // 1. ลบการตอบกลับใน Ticket ทั้งหมดของผู้ใช้
        await db.run('DELETE FROM ticket_replies WHERE user_id = ?', id);
        // 2. ลบ Ticket ทั้งหมดของผู้ใช้
        await db.run('DELETE FROM support_tickets WHERE user_id = ?', id);
        // 3. ลบประวัติการเทรดทั้งหมดของผู้ใช้
        await db.run('DELETE FROM signal_records WHERE user_id = ?', id);
        // 4. สุดท้าย, ลบตัวผู้ใช้ออกจากระบบ
        await db.run('DELETE FROM users WHERE id = ?', id);

        // ยืนยัน Transaction
        await db.exec('COMMIT');

        res.json({ message: `User with ID ${id} and all associated data has been deleted.` });
    } catch (error) {
        await db.exec('ROLLBACK'); // ย้อนกลับการเปลี่ยนแปลงทั้งหมดหากเกิดข้อผิดพลาด
        next(error);
    }
});
/**
 * @route   GET /api/admin/tickets
 * @desc    (Admin) ดึง Support Ticket ทั้งหมด
 * @access  Admin
 */
router.get('/tickets', adminAuthenticateToken, async (req, res, next) => {
    const db = req.app.get('db');
    try {
        // Join กับตาราง users เพื่อเอา username ของผู้ที่สร้าง ticket
        const tickets = await db.all(`
            SELECT t.*, u.username 
            FROM support_tickets t
            JOIN users u ON t.user_id = u.id
            ORDER BY t.created_at DESC
        `);
        res.json(tickets);
    } catch (error) {
        next(error);
    }
});

/**
 * @route   GET /api/admin/tickets/:id
 * @desc    (Admin) ดึงข้อมูล Ticket เดียวพร้อมการตอบกลับทั้งหมด
 * @access  Admin
 */
router.get('/tickets/:id', adminAuthenticateToken, async (req, res, next) => {
    const { id } = req.params;
    const db = req.app.get('db');
    try {
        const ticket = await db.get('SELECT t.*, u.username FROM support_tickets t JOIN users u ON t.user_id = u.id WHERE t.id = ?', id);
        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found.' });
        }
        const replies = await db.all('SELECT r.*, u.username, u.is_admin FROM ticket_replies r JOIN users u ON r.user_id = u.id WHERE r.ticket_id = ? ORDER BY r.created_at ASC', id);
        res.json({ ...ticket, replies });
    } catch (error) {
        next(error);
    }
});

/**
 * @route   POST /api/admin/tickets/:id/reply
 * @desc    (Admin) ตอบกลับ Ticket
 * @access  Admin
 */
router.post('/tickets/:id/reply', adminAuthenticateToken, async (req, res, next) => {
    const { message } = req.body;
    const { id: ticket_id } = req.params;
    const user_id = req.user.id; // Admin's ID
    const db = req.app.get('db');

    if (!message) {
        return res.status(400).json({ message: 'Reply message cannot be empty.' });
    }

    try {
        await db.run('INSERT INTO ticket_replies (ticket_id, user_id, message) VALUES (?, ?, ?)', [ticket_id, user_id, message]);
        // (Optional) Update ticket status to 'in_progress'
        await db.run("UPDATE support_tickets SET status = 'in_progress' WHERE id = ? AND status = 'open'", [ticket_id]);

        // (ใหม่) ส่งอีเมลแจ้งเตือนผู้ใช้
        const ticketOwner = await db.get('SELECT u.email FROM support_tickets t JOIN users u ON t.user_id = u.id WHERE t.id = ?', ticket_id);
        if (ticketOwner && ticketOwner.email) {
            await sendReplyNotificationEmail({
                recipientEmail: ticketOwner.email,
                ticketId: parseInt(ticket_id, 10),
                replierName: req.user.username // ชื่อแอดมินที่ตอบ
            });
        }

        // (ใหม่) ส่งแจ้งเตือนผ่าน WebSocket ไปยังผู้ใช้
        const wss = req.app.get('wss');
        if (wss) {
            const ticketOwnerForWs = await db.get('SELECT user_id FROM support_tickets WHERE id = ?', ticket_id);
            const userIdsToNotify = new Set([ticketOwnerForWs.user_id]); // แจ้งเตือนเจ้าของ Ticket

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

/**
 * @route   PUT /api/admin/tickets/:id/status
 * @desc    (Admin) อัปเดตสถานะของ Ticket
 * @access  Admin
 */
router.put('/tickets/:id/status', adminAuthenticateToken, async (req, res, next) => {
    const { status } = req.body;
    const { id } = req.params;
    const db = req.app.get('db');

    if (!['open', 'in_progress', 'closed'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status.' });
    }

    try {
        await db.run(
            'UPDATE support_tickets SET status = ? WHERE id = ?',
            [status, id]
        );
        res.json({ message: `Ticket #${id} status updated to ${status}.` });
    } catch (error) {
        next(error);
    }
});

module.exports = router;