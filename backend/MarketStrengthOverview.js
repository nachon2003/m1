import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './MarketStrengthOverview.css'; // เราจะสร้างไฟล์ CSS นี้ในขั้นตอนถัดไป

/**
 * คอมโพเนนต์สำหรับแสดงการ์ดข้อมูลของแต่ละคู่เงิน
 */
const StrengthCard = ({ data }) => {
    // กรณีที่ข้อมูลของคู่นี้มีปัญหา (เช่น Python script error)
    if (data.signal === 'ERROR') {
        return (
            <div className="strength-card error">
                <h3 className="symbol">{data.symbol}</h3>
                <div className="signal-container">
                    <span className="signal-text">ERROR</span>
                </div>
                <p className="details">Could not fetch signal.</p>
            </div>
        );
    }

    // กำหนดสีตาม Signal
    const signalClass = data.signal.toLowerCase(); // 'buy', 'sell', or 'hold'

    return (
        <div className={`strength-card ${signalClass}`}>
            <h3 className="symbol">{data.symbol}</h3>
            <div className="signal-container">
                <span className="signal-text">{data.signal}</span>
            </div>
            <div className="details">
                <p>Confidence: <strong>{data.confidence}</strong></p>
                <p>Predicted: <span>{data.predictedPrice}</span></p>
                <p>Last: <span>{data.lastKnownPrice}</span></p>
            </div>
        </div>
    );
};

/**
 * คอมโพเนนต์หลักสำหรับแสดงภาพรวม Market Strength
 */
const MarketStrengthOverview = () => {
    const [marketData, setMarketData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchMarketStrength = async () => {
            try {
                // ตั้งค่า isLoading เป็น true ก่อนเริ่ม fetch
                setIsLoading(true);
                setError(null);

                // เรียก API ที่เราสร้างไว้
                const response = await axios.get('http://localhost:3001/api/market-strength');

                // เมื่อได้ข้อมูลแล้ว ให้ set state
                setMarketData(response.data);

            } catch (err) {
                console.error("Failed to fetch market strength:", err);
                setError('Could not load market data. Please try again later.');
                setMarketData([]); // เคลียร์ข้อมูลหากเกิด error
            } finally {
                // ไม่ว่าจะสำเร็จหรือล้มเหลว ให้ตั้งค่า isLoading เป็น false
                setIsLoading(false);
            }
        };

        fetchMarketStrength();

        // ปรับแก้: ตั้งค่าให้ fetch ข้อมูลใหม่ทุกๆ 5 นาที (300,000 ms)
        // 5 minutes * 60 seconds/minute * 1000 ms/second = 300000 ms
        const intervalId = setInterval(fetchMarketStrength, 300000);

        // Cleanup function: จะถูกเรียกเมื่อคอมโพเนนต์ถูก unmount
        return () => clearInterval(intervalId);

    }, []); // dependency array ว่างเปล่า หมายถึงให้ useEffect ทำงานแค่ครั้งแรกที่ component โหลด

    // แสดง UI ขณะกำลังโหลดข้อมูล
    if (isLoading && marketData.length === 0) {
        return <div className="loading-container"><h2>Loading Market Overview...</h2></div>;
    }

    // แสดง UI เมื่อเกิด Error
    if (error) {
        return <div className="error-container"><h2>{error}</h2></div>;
    }

    // แสดง UI หลักเมื่อมีข้อมูลแล้ว
    return (
        <div className="market-strength-container">
            <h2>Market Strength Overview {isLoading && <span className="reloading-indicator">(Reloading...)</span>}</h2>
            <div className="cards-grid">
                {marketData.map((pairData, index) => (
                    <StrengthCard key={index} data={pairData} />
                ))}
            </div>
        </div>
    );
};

export default MarketStrengthOverview;