// (แก้ไข) เปลี่ยนมาใช้ Rate Limiter แบบ Promise-based Queue
// เพื่อให้สามารถเรียกใช้จากส่วนไหนของ Backend ก็ได้ (ไม่ใช่แค่ Middleware)

const TWELVEDATA_RATE_LIMIT_MS = 8000; // 8 calls per minute (7500ms) + buffer
let lastApiCallTimestamp = 0;
let apiCallQueue = Promise.resolve();

const twelveDataRateLimiter = (source = 'Unknown') => {
    // (แก้ไข) ปรับปรุง Logic ทั้งหมดเพื่อป้องกัน Race Condition
    // โดยการคำนวณและจองเวลาที่จะเรียก API ครั้งถัดไปไว้ใน Promise chain
    apiCallQueue = apiCallQueue.then(() => {
        const now = Date.now();
        const timeSinceLastCall = now - lastApiCallTimestamp;
        const waitTime = timeSinceLastCall < TWELVEDATA_RATE_LIMIT_MS
            ? TWELVEDATA_RATE_LIMIT_MS - timeSinceLastCall
            : 0;
        
        if (waitTime > 0) {
            console.warn(`[Rate Limit] Centralized limiter activated by "${source}". Waiting for ${waitTime}ms.`);
        }
        
        // (สำคัญ) อัปเดต timestamp ของการเรียกครั้งถัดไปทันที
        lastApiCallTimestamp = now + waitTime;
        return new Promise(resolve => setTimeout(resolve, waitTime));
    });

    return apiCallQueue;
};

module.exports = { twelveDataRateLimiter };
