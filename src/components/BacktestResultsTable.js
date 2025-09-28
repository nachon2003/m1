import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import './BacktestResultsTable.css';

// (ใหม่) กำหนดลำดับของ Timeframe ที่จะแสดงในตาราง
const TIMEFRAME_ORDER = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];

const BacktestResultsTable = () => {
    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const { token } = useAuth();

    useEffect(() => {
        const fetchBacktestResults = async () => {
            if (!token) return;

            setIsLoading(true);
            setError(null);
            try {
                // (แก้ไข) สร้าง URL เต็มโดยใช้ Environment Variable
                const apiUrl = `${process.env.REACT_APP_API_URL}/api/backtest/results`;
                const response = await fetch(apiUrl, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch backtest results');
                }

                const data = await response.json();
                setResults(data);
            } catch (err) {
                setError(err.message);
                console.error("Error fetching backtest results:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchBacktestResults();
    }, [token]);

    // (ใหม่) ใช้ useMemo เพื่อประมวลผลข้อมูลและจัดกลุ่มใหม่เมื่อ results เปลี่ยนแปลง
    const pivotData = useMemo(() => {
        if (!results || results.length === 0) {
            return [];
        }

        const grouped = results.reduce((acc, current) => {
            const { symbol, timeframe, win_rate_pct } = current;
            if (!acc[symbol]) {
                // (ใหม่) เพิ่ม property สำหรับเก็บค่า Win Rate ทั้งหมด
                acc[symbol] = { symbol, all_win_rates: [] };
            }
            // เก็บ Win Rate ของแต่ละ Timeframe
            acc[symbol][timeframe] = win_rate_pct;
            // (ใหม่) เก็บ Win Rate ลงใน array เพื่อหาค่าเฉลี่ย
            if (typeof win_rate_pct === 'number' && !isNaN(win_rate_pct)) {
                acc[symbol].all_win_rates.push(win_rate_pct);
            }
            return acc;
        }, {});

        // (ใหม่) แปลง Object, คำนวณค่าเฉลี่ย, และจัดเรียง
        return Object.values(grouped).map(row => {
            const validRates = row.all_win_rates;
            if (validRates.length > 0) {
                row.average_win_rate = validRates.reduce((sum, val) => sum + val, 0) / validRates.length;
            } else {
                row.average_win_rate = null;
            }
            return row;
        });
    }, [results]);

    // (ใหม่) คำนวณค่าเฉลี่ยสำหรับแถวสรุป
    const averageData = useMemo(() => {
        if (pivotData.length === 0) {
            return null;
        }
        const averages = { symbol: 'Average' };

        // (ใหม่) คำนวณค่าเฉลี่ยของคอลัมน์ "Avg. Win Rate"
        const overallAvgRates = pivotData.map(row => row.average_win_rate).filter(val => typeof val === 'number');
        if (overallAvgRates.length > 0) {
            averages.average_win_rate = overallAvgRates.reduce((sum, val) => sum + val, 0) / overallAvgRates.length;
        }

        // คำนวณค่าเฉลี่ยของแต่ละ Timeframe (เหมือนเดิม)
        TIMEFRAME_ORDER.forEach(tf => {
            const validValues = pivotData
                .map(row => row[tf])
                .filter(val => typeof val === 'number' && !isNaN(val));
            
            if (validValues.length > 0) {
                averages[tf] = validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
            } else {
                averages[tf] = null;
            }
        });
        return averages;
    }, [pivotData]);

    const formatNumber = (num, decimals = 2) => {
        if (typeof num !== 'number' || isNaN(num)) {
            return 'N/A';
        }
        return num.toFixed(decimals);
    };

    // (ใหม่) ฟังก์ชันสำหรับกำหนด Class สีตามค่า Win Rate (Heatmap Style)
    const getWinRateClass = (winRate) => {
        if (typeof winRate !== 'number' || isNaN(winRate)) {
            return 'rate-nodata';
        }
        if (winRate > 55) return 'rate-high';
        if (winRate > 50) return 'rate-mid';
        if (winRate < 40) return 'rate-very-low';
        if (winRate < 45) return 'rate-low';
        return 'rate-neutral';
    };

    if (isLoading) {
        return <div className="loading-spinner">Loading backtest results...</div>;
    }

    if (error) {
        return <div className="error-message">Error: {error}</div>;
    }

    if (pivotData.length === 0) {
        return <p>No backtest results found. Please run the backtest scripts first.</p>;
    }

    return (
        <div className="backtest-results-container">
            <h3 className="backtest-title">AI Model Win Rate [%] by Timeframe</h3>
            <p className="backtest-subtitle">
                Comparing Win Rate of the Random Forest model across all timeframes.
            </p>
            <div className="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Symbol</th>
                            <th className="avg-col">Avg. Win Rate</th>
                            {/* (ใหม่) สร้าง Header ของตารางตามลำดับ Timeframe */}
                            {TIMEFRAME_ORDER.map(tf => (
                                <th key={tf}>{tf.toUpperCase()}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {pivotData.map((row) => (
                            <tr key={row.symbol}>
                                <td>{row.symbol}</td>
                                {/* (ใหม่) เพิ่มคอลัมน์สำหรับ Avg. Win Rate */}
                                <td className={`avg-col ${getWinRateClass(row.average_win_rate)}`}>
                                    {formatNumber(row.average_win_rate, 1)}%
                                </td>
                                {/* (ใหม่) วนลูปเพื่อแสดง Win Rate ของแต่ละ Timeframe */}
                                {TIMEFRAME_ORDER.map(tf => {
                                    const winRate = row[tf];
                                    // (แก้ไข) ใช้ฟังก์ชันใหม่ในการกำหนด Class
                                    return (
                                        <td key={tf} className={getWinRateClass(winRate)}>
                                            {formatNumber(winRate, 1)}%
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                    {/* (ใหม่) เพิ่มส่วนท้ายของตาราง (tfoot) สำหรับแสดงค่าเฉลี่ย */}
                    {averageData && (
                        <tfoot>
                            <tr className="average-row">
                                <td>{averageData.symbol}</td>
                                {/* (ใหม่) แสดงค่าเฉลี่ยของคอลัมน์ Avg. Win Rate */}
                                <td className={`avg-col ${getWinRateClass(averageData.average_win_rate)}`}>
                                    {formatNumber(averageData.average_win_rate, 1)}%
                                </td>
                                {TIMEFRAME_ORDER.map(tf => {
                                    const avgWinRate = averageData[tf];
                                    // (แก้ไข) ใช้ฟังก์ชันใหม่ในการกำหนด Class
                                    return (
                                        <td key={`avg-${tf}`} className={getWinRateClass(avgWinRate)}>
                                            {formatNumber(avgWinRate, 1)}%
                                        </td>
                                    );
                                })}
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </div>
    );
};

export default BacktestResultsTable;