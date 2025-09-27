import React from 'react';
import './TechnicalSignalPanel.css';

const getSignalClass = (signal) => {
    if (!signal) return 'neutral';
    const lowerSignal = signal.toLowerCase();
    if (lowerSignal.includes('buy')) return 'buy';
    if (lowerSignal.includes('sell')) return 'sell';
    return 'neutral';
};

const TechnicalSignalPanel = ({ analysis, isLoading, symbol }) => {
    if (isLoading) {
        return (
            <div className="technical-signal-panel loading-state">
                <p>Loading Technicals...</p>
            </div>
        );
    }

    if (!analysis || !analysis.summary) {
        return (
            <div className="technical-signal-panel placeholder">
                <p>Technical analysis unavailable.</p>
            </div>
        );
    }

    const summaryClass = getSignalClass(analysis.summary);
    const details = analysis.signalDetails;

    const isJpyOrGold = symbol && (symbol.toUpperCase().includes('JPY') || symbol.toUpperCase().includes('XAU'));
    const decimalPlaces = isJpyOrGold ? 2 : 4;

    return (
        <div className="technical-signal-panel">
            <h4 className="panel-title">Technical Summary</h4>
            <div className={`summary-signal ${summaryClass}`}>
                {analysis.summary}
            </div>

            {/* (ใหม่) ส่วนแสดงรายละเอียดแผนการเทรด */}
            {details && (
                <div className="trade-plan-details">
                    <div className="plan-item">
                        <span className="plan-label">Entry Zone</span>
                        <span className="plan-value">{details.entryZoneStart.toFixed(decimalPlaces)} - {details.entryZoneEnd.toFixed(decimalPlaces)}</span>
                    </div>
                    <div className="plan-item">
                        <span className="plan-label">Take Profit</span>
                        <span className="plan-value tp">{details.takeProfitPrice.toFixed(decimalPlaces)}</span>
                    </div>
                    <div className="plan-item">
                        <span className="plan-label">Stop Loss</span>
                        <span className="plan-value sl">{details.stopLossPrice.toFixed(decimalPlaces)}</span>
                    </div>
                </div>
            )}

            {/* (แก้ไข) เปลี่ยนจาก Grid เป็น Table เพื่อความดูง่าย */}
            <table className="indicator-table">
                <tbody>
                    {Object.entries(analysis.indicators).map(([name, signal]) => (
                        <tr key={name}>
                            <td>{name.replace('_', ' ')}</td>
                            <td className={`indicator-signal ${getSignalClass(signal)}`}>
                                {signal}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default TechnicalSignalPanel;
