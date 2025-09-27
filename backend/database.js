// backend/database.js
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

const dbFilePath = path.join(__dirname, 'data', 'trading_app.db');

// ฟังก์ชันสำหรับเปิดการเชื่อมต่อและสร้างตารางหากยังไม่มี
async function initializeDatabase() {
    // ตรวจสอบและสร้างโฟลเดอร์ถ้ายังไม่มี
    const fs = require('fs').promises;
    await fs.mkdir(path.dirname(dbFilePath), { recursive: true });

    const db = await open({
        filename: dbFilePath,
        driver: sqlite3.Database
    });

    console.log('Connected to the SQLite database.');

    // (แก้ไข) ลบตาราง trade_history เดิมออก และรวมการเก็บประวัติไว้ที่ signal_history ที่เดียว
    // await db.exec(`DROP TABLE IF EXISTS trade_history;`); // หากต้องการลบตารางเก่าทิ้ง
    // (แก้ไข) เปลี่ยนชื่อตารางเป็น signal_records เพื่อบังคับให้สร้างใหม่ด้วย schema ที่ถูกต้อง
    // ป้องกันปัญหาจาก DB เก่าที่ผู้ใช้อาจจะมีอยู่
    await db.exec(`
        CREATE TABLE IF NOT EXISTS signal_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            symbol TEXT NOT NULL,
            timeframe TEXT NOT NULL,
            source TEXT NOT NULL, -- 'ai' or 'technical'
            signal TEXT NOT NULL, -- e.g., 'BUY', 'SELL', 'HOLD'
            open_price REAL,      -- ราคา ณ เวลาที่เกิดสัญญาณ
            predicted_price REAL, -- ราคาเป้าหมาย (Take Profit)
            stop_loss_price REAL, -- ราคาตัดขาดทุน
            entry_zone_start REAL, -- (ใหม่) ราคาเริ่มต้นของโซนเข้า
            entry_zone_end REAL,   -- (ใหม่) ราคาท้ายสุดของโซนเข้า
            close_price REAL,     -- ราคาปิดจริง (จะถูกอัปเดตในอนาคต)
            status TEXT DEFAULT 'pending', -- (แก้ไข) เปลี่ยนสถานะเริ่มต้นเป็น 'pending' (รอเข้าโซน)
            pnl REAL,             -- (ใหม่) กำไร/ขาดทุน
            closed_at DATETIME,   -- (ใหม่) เวลาที่ปิด
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`);

    // (ใหม่) สร้างตารางสำหรับระบบ Support Ticket
    await db.exec(`
        CREATE TABLE IF NOT EXISTS support_tickets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            subject TEXT NOT NULL,
            message TEXT NOT NULL,
            status TEXT DEFAULT 'open', -- 'open', 'in_progress', 'closed'
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    `);

    // (ใหม่) สร้างตารางสำหรับเก็บการตอบกลับใน Support Ticket
    await db.exec(`
        CREATE TABLE IF NOT EXISTS ticket_replies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL, -- ID ของคนที่ตอบ (อาจจะเป็น user หรือ admin)
            message TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (ticket_id) REFERENCES support_tickets (id),
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    `);

    // สร้างตาราง users
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL, -- (ใหม่) เพิ่มคอลัมน์ email
            password_hash TEXT NOT NULL,
            profile_image_url TEXT,
            is_admin INTEGER DEFAULT 0, -- (ใหม่) เพิ่มคอลัมน์สำหรับระบุว่าเป็นแอดมินหรือไม่ (0 = false, 1 = true)
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
    `);

    return db;
}

module.exports = { initializeDatabase };