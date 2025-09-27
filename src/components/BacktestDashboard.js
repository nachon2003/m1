import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import './BacktestDashboard.css';

const BacktestDashboard = () => {
    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const { token } = useAuth();

    const fetchBacktestResults = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
            const response = await fetch(`${apiUrl}/api/backtest/results`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch backtest results. Please try again later.');
            }

            const data = await response.json();
            setResults(data);
        } catch (err) {
            setError(err.message);
            console.error("Error fetching backtest results:", err);
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    useEffect(() => {
        if (token) {
            fetchBacktestResults();
        }
    }, [token, fetchBacktestResults]);

    const formatNumber = (num, precision = 2) => {
        if (typeof num !== 'number') return 'N/A';
        return num.toFixed(precision);
    };

    const getRowClass = (result) => {
        if (result.return_pct > 0 && result.win_rate_pct > 50) return 'row-profit';
        if (result.return_pct < 0) return 'row-loss';
        return '';
    };

    if (isLoading) {
        return <div className="backtest-container loading">Loading Backtest Results...</div>;
    }

    if (error) {
        return <div className="backtest-container error">Error: {error}</div>;
    }

    if (results.length === 0) {
        return (
            <div className="backtest-container no-results">
                <h2>AI Model Backtest Results</h2>
                <p>No backtest results found. Please run the backtesting script first.</p>
            </div>
        );
    }

    return (
        <div className="backtest-container">
            <div className="backtest-header">
                <h2>AI Model Backtest Results</h2>
                <button onClick={fetchBacktestResults} className="refresh-button" disabled={isLoading}>
                    {isLoading ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>
            <div className="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>Symbol</th>
                            <th>Return [%]</th>
                            <th>Buy & Hold [%]</th>
                            <th>Max Drawdown [%]</th>
                            <th>Win Rate [%]</th>
                            <th># Trades</th>
                            <th>Profit Factor</th>
                            <th>Sharpe Ratio</th>
                            <th>Duration (Days)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {results.map((result, index) => (
                            <tr key={index} className={getRowClass(result)}>
                                <td>{result.symbol}</td>
                                <td className={result.return_pct > 0 ? 'text-profit' : 'text-loss'}>
                                    {formatNumber(result.return_pct)}
                                </td>
                                <td>{formatNumber(result.buy_and_hold_return_pct)}</td>
                                <td className="text-loss">{formatNumber(result.max_drawdown_pct)}</td>
                                <td className={result.win_rate_pct > 50 ? 'text-profit' : 'text-loss'}>
                                    {formatNumber(result.win_rate_pct)}
                                </td>
                                <td>{result.total_trades}</td>
                                <td>{formatNumber(result.profit_factor)}</td>
                                <td>{formatNumber(result.sharpe_ratio)}</td>
                                <td>{result.duration_days}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default BacktestDashboard;