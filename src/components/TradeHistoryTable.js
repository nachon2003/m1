import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './TradeHistoryTable.css';

const TradeHistoryTable = () => {
    const [history, setHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const { token } = useAuth();

    useEffect(() => {
        const fetchHistory = async () => {
            if (!token) return;

            setIsLoading(true);
            setError(null);
            try {
                // (แก้ไข) สร้าง URL เต็มโดยใช้ Environment Variable
                const apiUrl = `${process.env.REACT_APP_API_URL}/api/statistics/trade-history`;
                const response = await fetch(apiUrl, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch trade history');
                }

                const data = await response.json();
                setHistory(data);
            } catch (err) {
                setError(err.message);
                console.error("Error fetching trade history:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchHistory();
    }, [token]);

    const formatNumber = (num, decimals = 2) => {
        if (typeof num !== 'number' || isNaN(num)) {
            return '-';
        }
        return num.toFixed(decimals);
    };

    const getStatusClass = (status) => {
        if (status.includes('tp')) return 'status-tp';
        if (status.includes('sl')) return 'status-sl';
        return `status-${status}`;
    };

    if (isLoading) {
        return <div className="loading-spinner">Loading Trade History...</div>;
    }

    if (error) {
        return <div className="error-message">Error: {error}</div>;
    }

    if (history.length === 0) {
        return <p>No trade history found.</p>;
    }

    return (
        <div className="trade-history-container">
            <h3 className="history-title">Trade History</h3>
            <div className="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Symbol</th>
                            <th>Signal</th>
                            <th>Status</th>
                            <th>Open Price</th>
                            <th>Close Price</th>
                            <th>P/L</th>
                        </tr>
                    </thead>
                    <tbody>
                        {history.map((trade) => (
                            <tr key={trade.id}>
                                <td>{new Date(trade.created_at).toLocaleDateString()}</td>
                                <td>{trade.symbol}</td>
                                <td>{trade.signal}</td>
                                <td className={getStatusClass(trade.status)}>{trade.status.replace('_', ' ')}</td>
                                <td>{formatNumber(trade.open_price, 4)}</td>
                                <td>{formatNumber(trade.close_price, 4)}</td>
                                <td className={trade.pnl > 0 ? 'positive' : (trade.pnl < 0 ? 'negative' : '')}>{formatNumber(trade.pnl, 2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TradeHistoryTable;