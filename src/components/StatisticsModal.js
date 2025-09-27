import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import BacktestDashboard from './BacktestDashboard'; // (ใหม่) Import BacktestDashboard
import './StatisticsModal.css';

const StatisticsModal = ({ isOpen, onClose }) => {
    const [stats, setStats] = useState(null);
    const [history, setHistory] = useState([]);
    // (ลบ) ไม่ต้องใช้ backtestResults state แยกแล้ว เพราะ BacktestDashboard จัดการเอง
    // (ใหม่) State สำหรับจัดการการเรียงข้อมูล
    const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'descending' });

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const { token } = useAuth();

    useEffect(() => {
        if (!isOpen || !token) return;

        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                // (แก้ไข) เรียก API สำหรับ stats และ history พร้อมกัน
                const [statsRes, historyRes] = await Promise.all([
                    fetch(`${process.env.REACT_APP_API_URL}/api/statistics`, {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    }),
                    fetch(`${process.env.REACT_APP_API_URL}/api/statistics/trade-history`, {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    }),
                ]);

                if (!statsRes.ok) throw new Error('Failed to fetch statistics.');
                if (!historyRes.ok) throw new Error('Failed to fetch trade history.');

                const statsData = await statsRes.json();
                const historyData = await historyRes.json();

                setStats(statsData);
                setHistory(historyData);

            } catch (err) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();

    }, [isOpen, token]);

    // (ใหม่) ฟังก์ชันสำหรับจัดการการเรียงข้อมูล
    const sortedHistory = React.useMemo(() => {
        let sortableItems = [...history];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                if (a[sortConfig.key] < b[sortConfig.key]) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (a[sortConfig.key] > b[sortConfig.key]) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [history, sortConfig]);

    // (ใหม่) ฟังก์ชันสำหรับเปลี่ยนการตั้งค่าการเรียงข้อมูลเมื่อคลิกที่ Header
    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    // (ใหม่) ฟังก์ชันสำหรับแสดงลูกศรบอกทิศทางการเรียงข้อมูล
    const getSortDirectionClass = (name) => sortConfig.key === name ? sortConfig.direction : '';

    if (!isOpen) return null;

    const formatPrice = (price, symbol) => {
        if (price === null || price === undefined) return 'N/A';
        const isJpyOrGold = symbol && (symbol.toUpperCase().includes('JPY') || symbol.toUpperCase().includes('XAU'));
        return price.toFixed(isJpyOrGold ? 2 : 4);
    }

    const renderStatsSummary = () => (
        <div className="stats-summary-grid">
            <div className="stat-card">
                <h4>Total Trades</h4>
                <p>{stats.totalTrades}</p>
            </div>
            <div className="stat-card win">
                <h4>Wins</h4>
                <p>{stats.wins}</p>
            </div>
            <div className="stat-card loss">
                <h4>Losses</h4>
                <p>{stats.losses}</p>
            </div>
            <div className="stat-card win-rate">
                <h4>Win Rate</h4>
                <p>{stats.winRate.toFixed(1)}%</p>
            </div>
        </div>
    );

    const renderHistoryTable = () => (
        <div className="stats-table-container">
            <table className="stats-table">
                <thead>
                    <tr>
                        {/* (แก้ไข) เพิ่ม onClick และ className ให้กับ Header ของตาราง */}
                        <th onClick={() => requestSort('created_at')} className={getSortDirectionClass('created_at')}>วันที่</th>
                        <th onClick={() => requestSort('symbol')} className={getSortDirectionClass('symbol')}>สินทรัพย์</th>
                        <th onClick={() => requestSort('timeframe')} className={getSortDirectionClass('timeframe')}>TF</th>
                        <th onClick={() => requestSort('source')} className={getSortDirectionClass('source')}>Source</th>
                        <th onClick={() => requestSort('signal')} className={getSortDirectionClass('signal')}>สัญญาณ</th>
                        <th onClick={() => requestSort('open_price')} className={getSortDirectionClass('open_price')}>ราคาเปิด</th>
                        <th onClick={() => requestSort('predicted_price')} className={getSortDirectionClass('predicted_price')}>ราคาเป้าหมาย (TP)</th>
                        <th onClick={() => requestSort('stop_loss_price')} className={getSortDirectionClass('stop_loss_price')}>ราคาตัดขาดทุน (SL)</th>
                        <th onClick={() => requestSort('close_price')} className={getSortDirectionClass('close_price')}>ราคาปิด</th>
                        <th onClick={() => requestSort('pnl')} className={getSortDirectionClass('pnl')}>P/L</th>
                        <th onClick={() => requestSort('status')} className={getSortDirectionClass('status')}>สถานะ</th>
                    </tr>
                </thead>
                <tbody>
                    {/* (แก้ไข) เปลี่ยนไปใช้ sortedHistory แทน history */}
                    {sortedHistory.map(trade => {
                        // (แก้ไข) เพิ่มการตรวจสอบข้อมูลก่อนใช้งาน เพื่อป้องกัน Error
                        const signal = trade.signal || '';
                        const timeframe = trade.timeframe || '';
                        const source = trade.source || '';
                        const status = trade.status || 'pending'; // (แก้ไข) ถ้าไม่มี status ให้ถือว่าเป็น 'pending'

                        const isBuy = signal.toUpperCase().includes('BUY');
                        const pnlClass = trade.pnl > 0 ? 'profit' : trade.pnl < 0 ? 'loss' : '';

                        return (
                            <tr key={trade.id}>
                                <td>{new Date(trade.created_at).toLocaleString()}</td>
                                <td>{trade.symbol}</td>
                                <td>{timeframe.toUpperCase()}</td>
                                <td className={`source-${source.toLowerCase()}`}>{source.toUpperCase()}</td>
                                <td className={isBuy ? 'signal-buy' : 'signal-sell'}>{signal}</td>
                                <td>{formatPrice(trade.open_price, trade.symbol)}</td>
                                <td className="price-tp">{formatPrice(trade.predicted_price, trade.symbol)}</td>
                                <td className="price-sl">{formatPrice(trade.stop_loss_price, trade.symbol)}</td>
                                <td>{formatPrice(trade.close_price, trade.symbol)}</td>
                                <td className={pnlClass}>
                                    {trade.pnl !== null ? formatPrice(trade.pnl, trade.symbol) : 'N/A'}
                                </td>
                                <td className={`status-${status.toLowerCase()}`}>{status.replace('_', ' ').toUpperCase()}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content stats-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Trade History & Performance</h2>
                    <button onClick={onClose} className="close-button">&times;</button>
                </div>
                <div className="modal-body">
                    {isLoading && <p>Loading history...</p>}
                    {error && <p className="error-message">{error}</p>}
                    {!isLoading && !error && (
                        <>
                            {stats && renderStatsSummary()}
                            <h4>Trade Log</h4>
                            {history.length > 0 ? renderHistoryTable() : <p>No trade history found.</p>}
                            <BacktestDashboard />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StatisticsModal;