// src/components/MultiTimeframeAnalysis.js
import React from 'react';
import './MultiTimeframeAnalysis.css';

// Helper to determine class based on trend
const getTrendClass = (trend) => {
    if (!trend) return 'sideways';
    const lowerTrend = trend.toLowerCase();
    if (lowerTrend.includes('up')) return 'uptrend';
    if (lowerTrend.includes('down')) return 'downtrend';
    return 'sideways';
};

const TimeframeCard = ({ timeframe, data }) => {
    if (!data) {
        return (
            <div className="timeframe-card loading-card">
                <h4 className="timeframe-title">{timeframe.toUpperCase()}</h4>
                <p>Loading...</p>
            </div>
        );
    }

    const trendClass = getTrendClass(data.trend);

    return (
        <div className={`timeframe-card ${trendClass}`}>
            <h4 className="timeframe-title">{timeframe.toUpperCase()}</h4>
            <div className="analysis-item trend-item">
                <span className="analysis-label">Trend</span>
                <span className={`analysis-value trend-value ${trendClass}`}>{data.trend || 'N/A'}</span>
            </div>
            <div className="analysis-item">
                <span className="analysis-label">Support</span>
                <span className="analysis-value support-value">{data.support?.toFixed(4) || 'N/A'}</span>
            </div>
            <div className="analysis-item">
                <span className="analysis-label">Resistance</span>
                <span className="analysis-value resistance-value">{data.resistance?.toFixed(4) || 'N/A'}</span>
            </div>
        </div>
    );
};

const MultiTimeframeAnalysis = ({ analysisData, isLoading }) => {
    if (isLoading) {
        return (
            <div className="multi-timeframe-container">
                <h3 className="container-title">Multi-Timeframe Analysis</h3>
                <div className="analysis-grid">
                    {['15m', '1h', '4h', '1d'].map(tf => <TimeframeCard key={tf} timeframe={tf} data={null} />)}
                </div>
            </div>
        );
    }

    if (!analysisData || !analysisData.analysis) {
        return (
            <div className="multi-timeframe-container">
                <h3 className="container-title">Multi-Timeframe Analysis</h3>
                <p className="analysis-error">Could not load analysis data for {analysisData?.symbol}.</p>
            </div>
        );
    }

    const timeframes = ['15m', '1h', '4h', '1d'];

    return (
        <div className="multi-timeframe-container">
            <h3 className="container-title">Multi-Timeframe Analysis for {analysisData.symbol}</h3>
            <div className="analysis-grid">
                {timeframes.map(tf => <TimeframeCard key={tf} timeframe={tf} data={analysisData.analysis[tf]} />)}
            </div>
        </div>
    );
};

export default MultiTimeframeAnalysis;