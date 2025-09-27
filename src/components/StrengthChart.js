import React from 'react';
import './StrengthChart.css';

const StrengthChart = ({ signalsData, symbols }) => {
    // Filter out symbols that don't have signal data or buyer_percentage
    const chartData = symbols
        .map(symbol => {
            const signal = signalsData[symbol];
            if (signal && signal.buyer_percentage != null) {
                return {
                    symbol: symbol,
                    buyStrength: signal.buyer_percentage,
                    sellStrength: 100 - signal.buyer_percentage,
                };
            }
            return null;
        })
        .filter(Boolean); // Remove null entries

    if (chartData.length === 0) {
        return (
            <div className="strength-chart-container">
                <h3 className="chart-title">Market Strength</h3>
                <p className="no-data-message">Loading strength data...</p>
            </div>
        );
    }

    return (
        <div className="strength-chart-container">
            <h3 className="chart-title">Market Strength</h3>
            <div className="chart-area">
                {chartData.map(({ symbol, buyStrength, sellStrength }) => (
                    <div key={symbol} className="chart-item">
                        <span className="chart-label">{symbol}</span>
                        <div className="chart-bar-container">
                            <div className="chart-bar buy-bar" style={{ width: `${buyStrength}%` }}>
                                {buyStrength > 15 ? `${Math.round(buyStrength)}%` : ''}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default StrengthChart;