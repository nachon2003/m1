import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './PredictionStats.css';
import { useAuth } from '../context/AuthContext'; // 1. Import useAuth

const PredictionStats = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const { token } = useAuth(); // 2. Get token from auth context

    useEffect(() => {
        // 3. ถ้าไม่มี token (ยังไม่ login) ก็ไม่ต้อง fetch
        if (!token) {
            setLoading(false);
            // อาจจะแสดงข้อความให้ login ก่อน หรือซ่อน component นี้ไปเลย
            return;
        }

        const fetchStats = async () => {
            setLoading(true);
            setError('');
            try {
                // 4. แก้ไข: เรียก API endpoint ที่ถูกต้อง (/api/statistics)
                const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
                const response = await axios.get(`${apiUrl}/api/statistics`, {
                    headers: { 'Authorization': `Bearer ${token}` } // 5. ส่ง token ไปด้วย
                });
                setStats(response.data);
            } catch (err) {
                console.error("Error fetching prediction stats:", err);
                setError('Failed to load statistics.');
                // ไม่ใช้ข้อมูลจำลองแล้ว เพื่อให้เห็น error จริงๆ
                setStats({
                    totalTrades: 0,
                    wins: 0,
                    losses: 0,
                    winRate: 0,
                });
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [token]); // 6. ให้ useEffect ทำงานใหม่เมื่อ token เปลี่ยน (เช่น หลัง login)

    // ถ้ายังไม่ login ก็ไม่ต้องแสดงผลอะไรเลย
    if (!token) {
        return null;
    }
    if (loading) {
        return <div className="stats-container loading">กำลังโหลดสถิติ...</div>;
    }

    // ไม่แสดงอะไรเลยถ้ามี error ร้ายแรงและไม่มีข้อมูล stats
    if (error && !stats) {
        return <div className="stats-container error">{error}</div>;
    }

    return (
        <div className="stats-container">
            <h3 className="stats-title">Your Trading Statistics</h3>
            {error && <p className="stats-warning">{error}</p>}
            {stats && (
                <div className="stats-grid">
                    <div className="stat-item"><span className="stat-label">Total Trades</span><span className="stat-value">{stats.totalTrades}</span></div>
                    <div className="stat-item win"><span className="stat-label">Wins</span><span className="stat-value">{stats.wins}</span></div>
                    <div className="stat-item loss"><span className="stat-label">Losses</span><span className="stat-value">{stats.losses}</span></div>
                    <div className="stat-item win-rate"><span className="stat-label">Win Rate</span><span className="stat-value">{stats.winRate.toFixed(1)}%</span></div>
                </div>
            )}
        </div>
    );
};

export default PredictionStats;