// backend/emailService.js
const nodemailer = require('nodemailer');

/**
 * สร้าง transporter สำหรับส่งอีเมล
 * - ถ้ามี EMAIL_USER และ EMAIL_PASS ใน .env จะใช้ Gmail
 * - มิฉะนั้น จะใช้ Ethereal สำหรับการทดสอบ
 */
const createTransporter = async () => {
    // ตรวจสอบว่ามีการตั้งค่า Gmail ใน .env หรือไม่
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        console.log('📧 Using Gmail SMTP for sending emails.');
        return nodemailer.createTransport({
            service: 'gmail', // ใช้ service ของ Gmail โดยตรง
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS, // ควรเป็น App Password ของ Google
            },
        });
    } else {
        // ถ้าไม่มีการตั้งค่า Gmail ให้ใช้ Ethereal สำหรับทดสอบ
        console.log('⚠️ Gmail credentials not found in .env, falling back to Ethereal for testing.');
        let testAccount = await nodemailer.createTestAccount();
        console.log('📧 Ethereal test account created. Preview emails at:', nodemailer.getTestMessageUrl(null));
        return nodemailer.createTransport({
            host: 'smtp.ethereal.email', port: 587, secure: false,
            auth: { user: testAccount.user, pass: testAccount.pass },
        });
    }
};

/**
 * ส่งอีเมลแจ้งเตือนแอดมินเมื่อมี Ticket ใหม่หรือมีการตอบกลับจากผู้ใช้
 * @param {object} details - { ticketId, subject, user, db }
 */
const sendNewTicketEmailToAdmins = async ({ ticketId, subject, user, db }) => {
    try {
        const transporter = await createTransporter();
        const admins = await db.all('SELECT email FROM users WHERE is_admin = 1');
        const adminEmails = admins.map(a => a.email).filter(Boolean);

        if (adminEmails.length === 0) {
            console.log('No admin emails found to send notification.');
            return;
        }

        const mailOptions = {
            from: '"Support System" <noreply@yourapp.com>',
            to: adminEmails.join(', '),
            subject: `[New/Updated Ticket #${ticketId}] ${subject}`,
            text: `A new ticket or reply has been submitted by user: ${user}.\n\nTicket ID: ${ticketId}\nSubject: ${subject}\n\nPlease log in to the admin dashboard to respond.`,
            html: `<p>A new ticket or reply has been submitted by user: <strong>${user}</strong>.</p>
                   <p><strong>Ticket ID:</strong> ${ticketId}</p>
                   <p><strong>Subject:</strong> ${subject}</p>
                   <p>Please log in to the admin dashboard to respond.</p>`,
        };

        let info = await transporter.sendMail(mailOptions);
        console.log('Admin notification email sent: %s', info.messageId);
        if (process.env.NODE_ENV !== 'production') {
            console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
        }
    } catch (error) {
        console.error('Error sending new ticket email to admins:', error);
    }
};

/**
 * ส่งอีเมลแจ้งเตือนผู้ใช้เมื่อแอดมินตอบกลับ Ticket
 * @param {object} details - { recipientEmail, ticketId, replierName }
 */
const sendReplyNotificationEmail = async ({ recipientEmail, ticketId, replierName }) => {
    if (!recipientEmail) {
        console.log(`Cannot send reply notification for ticket #${ticketId}: No recipient email.`);
        return;
    }
    try {
        const transporter = await createTransporter();
        const mailOptions = {
            from: '"Support System" <noreply@yourapp.com>',
            to: recipientEmail,
            subject: `Re: Your Support Ticket #${ticketId} has a new reply`,
            text: `Hello,\n\n${replierName} has replied to your support ticket #${ticketId}.\n\nPlease log in to view the reply.`,
            html: `<p>Hello,</p><p><strong>${replierName}</strong> has replied to your support ticket #${ticketId}.</p><p>Please log in to view the reply.</p>`,
        };

        let info = await transporter.sendMail(mailOptions);
        console.log('User reply notification email sent: %s', info.messageId);
        if (process.env.NODE_ENV !== 'production') {
            console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
        }
    } catch (error) {
        console.error('Error sending reply notification email to user:', error);
    }
};

/**
 * (ใหม่) ส่งอีเมลสำหรับรีเซ็ตรหัสผ่าน
 * @param {object} details - { recipientEmail, resetToken }
 */
const sendPasswordResetEmail = async ({ recipientEmail, resetToken }) => {
    if (!recipientEmail) {
        console.log(`Cannot send password reset email: No recipient email provided.`);
        return;
    }
    try {
        const transporter = await createTransporter();
        // (สำคัญ) เปลี่ยน 'http://localhost:3000' เป็น URL ของ Frontend จริงๆ ของคุณเมื่อนำขึ้น Production
        const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

        const mailOptions = {
            from: '"Support System" <noreply@yourapp.com>',
            to: recipientEmail,
            subject: 'Your Password Reset Request',
            text: `You requested a password reset. Click the link below to reset your password:\n\n${resetUrl}\n\nIf you did not request this, please ignore this email.`,
            html: `<p>You requested a password reset. Click the link below to reset your password:</p>
                   <p><a href="${resetUrl}">${resetUrl}</a></p>
                   <p>If you did not request this, please ignore this email.</p>`,
        };

        let info = await transporter.sendMail(mailOptions);
        console.log('Password reset email sent: %s', info.messageId);
    } catch (error) {
        console.error('Error sending password reset email:', error);
    }
};

module.exports = {
    sendNewTicketEmailToAdmins,
    sendReplyNotificationEmail,
    sendPasswordResetEmail, // (ใหม่) Export ฟังก์ชันใหม่
};