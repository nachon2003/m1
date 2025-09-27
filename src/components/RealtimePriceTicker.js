// src/components/RealtimePriceTicker.js
import React, { useState, useEffect } from 'react';
import './RealtimePriceTicker.css';

// Component นี้จะรับ props เพิ่มเติมคือ isConnected
function RealtimePriceTicker({ symbols, livePrices, error, isConnected }) {
    // State สำหรับเก็บข้อมูลราคา, ทิศทางการเปลี่ยนแปลง, และตัวกระตุ้น animation
    const [priceData, setPriceData] = useState({});

    // Effect นี้จะทำงานเมื่อ livePrices ที่เป็น prop เปลี่ยนไป
    useEffect(() => {
        if (!livePrices) return;
        
        // อัปเดต state โดยเปรียบเทียบราคใหม่กับราคาเก่า
        setPriceData(currentPriceData => {
            const updatedData = {}; // เริ่มต้นด้วย object ใหม่
            
            // วนลูปตาม symbols ที่รับมาเพื่อรักษาลำดับการแสดงผล
            for (const symbol of symbols) {
                const newPrice = livePrices[symbol];
                const oldData = currentPriceData[symbol];

                if (newPrice !== undefined && newPrice !== null) {
                    const oldPrice = oldData ? oldData.price : null;
                    
                    let change = 'same';
                    if (oldPrice !== null && newPrice > oldPrice) {
                        change = 'positive'; // ราคาขึ้น
                    } else if (oldPrice !== null && newPrice < oldPrice) {
                        change = 'negative'; // ราคาลง
                    }
                    
                    // เพิ่ม flash: true เพื่อกระตุ้น animation ทุกครั้งที่อัปเดต
                    updatedData[symbol] = { price: newPrice, change: change, flash: true };
                } else {
                    // หากไม่มีราคาใหม่ ให้ใช้ข้อมูลเดิมไปก่อนเพื่อป้องกันการกระพริบ
                    updatedData[symbol] = oldData || { price: null, change: 'same', flash: false };
                }
            }
            return updatedData;
        });
    }, [livePrices, symbols]);

    // Effect นี้จะรับผิดชอบในการลบสถานะ 'flash' ออกหลังจาก animation ทำงานเสร็จ
    useEffect(() => {
        if (Object.keys(priceData).length === 0) return;

        const timer = setTimeout(() => {
            setPriceData(currentData => {
                const newData = { ...currentData };
                let needsUpdate = false;
                for (const symbol in newData) {
                    if (newData[symbol].flash) {
                        newData[symbol] = { ...newData[symbol], flash: false };
                        needsUpdate = true;
                    }
                }
                // อัปเดต state ก็ต่อเมื่อมีการเปลี่ยนแปลงจริงๆ เพื่อป้องกัน loop ไม่รู้จบ
                return needsUpdate ? newData : currentData;
            });
        }, 500); // ระยะเวลานี้ควรตรงกับเวลาของ CSS animation

        return () => clearTimeout(timer);
    }, [priceData]);

    return (
        <div className="realtime-price-ticker">
            <div className="ticker-header">
                <h3>Live Prices</h3>
                <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
                    {isConnected ? '● Connected' : '○ Disconnected'}
                </span>
            </div>
            {error && <div className="ticker-error">{error}</div>}
            <div className="price-list">
                {/* วนลูปจาก props.symbols เพื่อรับประกันลำดับที่ถูกต้องเสมอ */}
                {symbols.map((symbol) => {
                    const data = priceData[symbol];
                    // ถ้ายังไม่มีข้อมูลสำหรับ symbol นี้ ก็ยังไม่ต้องแสดงผล
                    if (!data) return null;

                    const priceClass = `price ${data.change || ''} ${data.flash ? 'flash-update' : ''}`;

                    // Logic สำหรับกำหนดจำนวนทศนิยมที่ถูกต้อง
                    const isJpyOrGold = symbol.toUpperCase().includes('JPY') || symbol.toUpperCase().includes('XAU');
                    const decimalPlaces = isJpyOrGold ? 2 : 5; // ทองคำและ JPY ใช้ 2 ตำแหน่ง, อื่นๆ ใช้ 5

                    return (
                        <div key={symbol} className="price-item">
                            <span>{symbol}:</span>
                            <span className={priceClass}>{data.price !== null ? data.price.toFixed(decimalPlaces) : 'N/A'}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default RealtimePriceTicker;