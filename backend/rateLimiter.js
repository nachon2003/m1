// (แก้ไข) เปลี่ยนมาใช้ Rate Limiter แบบ Promise-based Queue
// เพื่อให้สามารถเรียกใช้จากส่วนไหนของ Backend ก็ได้ (ไม่ใช่แค่ Middleware)

const TWELVEDATA_RATE_LIMIT_MS = 8000; // 8 calls per minute (7500ms) + buffer
let lastApiCallTimestamp = 0;
let apiCallQueue = Promise.resolve();

const twelveDataRateLimiter = (source = 'Unknown') => {
    const now = Date.now();
    const timeSinceLastCall = now - lastApiCallTimestamp;
    const waitTime = timeSinceLastCall < TWELVEDATA_RATE_LIMIT_MS
        ? TWELVEDATA_RATE_LIMIT_MS - timeSinceLastCall
        : 0;

    if (waitTime > 0) {
        console.warn(`[Rate Limit] Centralized limiter activated by "${source}". Waiting for ${waitTime}ms.`);
    }

    const waitPromise = new Promise(resolve => setTimeout(resolve, waitTime));

    // เพิ่ม Promise ใหม่เข้าไปในคิว และอัปเดตคิวให้เป็น Promise ล่าสุด
    apiCallQueue = apiCallQueue.then(() => waitPromise).then(() => {
        lastApiCallTimestamp = Date.now(); // อัปเดต timestamp หลังจากรอ
    });

    return apiCallQueue;
};

module.exports = { twelveDataRateLimiter };
