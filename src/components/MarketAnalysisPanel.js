import React from 'react';
import './MarketAnalysisPanel.css';

const MarketAnalysisPanel = ({ aiSignal, isLoading, isRequestingSignal, symbol, onRequestNewSignal, onRequestAutoSignal }) => {

    // ตรวจสอบว่ามีข้อมูลสำหรับแสดงผลหรือไม่
    const hasAnalysisData = aiSignal && aiSignal.trend && aiSignal.volume && aiSignal.buyer_percentage != null;

    // (ใหม่) เพิ่ม Logic การกำหนดทศนิยมสำหรับคู่เงินต่างๆ
    const isJpyOrGold = symbol && (symbol.toUpperCase().includes('JPY') || symbol.toUpperCase().includes('XAU'));
    const decimalPlaces = isJpyOrGold ? 2 : 4;

    // ฟังก์ชันสำหรับกำหนดสีของ Trend
    const getTrendClass = (trend) => {
        if (!trend) return '';
        const lowerTrend = trend.toLowerCase();
        if (lowerTrend.includes('strong up')) return 'trend-strong-up';
        if (lowerTrend.includes('up')) return 'trend-up';
        if (lowerTrend.includes('strong down')) return 'trend-strong-down';
        if (lowerTrend.includes('down')) return 'trend-down';
        return 'trend-sideways';
    };

    return (
        <div className="analysis-panel">
            <div className="panel-header">
                <h3>AI Market Analysis</h3>
                <span className="panel-symbol">{symbol}</span>
            </div>

            {isLoading && !hasAnalysisData ? (
                 <div className="placeholder-content loading">
                    <div className="spinner-large"></div>
                    <p>กำลังวิเคราะห์ข้อมูล...</p>
                </div>
            ) : hasAnalysisData ? (
                <>
                    <div className="analysis-grid">
                        {/* Trend Card */}
                        <div className={`analysis-card ${getTrendClass(aiSignal.trend)}`}>
                            <div className="card-label">Trend</div>
                            <div className="card-value">{aiSignal.trend}</div>
                        </div>

                        {/* (แก้ไข) Volume Card: แสดงก็ต่อเมื่อมีข้อมูล Volume ที่ไม่ใช่ 'Not Available' */}
                        {aiSignal.volume && aiSignal.volume !== 'Not Available' && (
                            <div className={`analysis-card volume-${aiSignal.volume?.toLowerCase()}`}>
                                <div className="card-label">Volume</div>
                                <div className="card-value">{aiSignal.volume}</div>
                            </div>
                        )}

                        {/* (ใหม่) Support Card */}
                        <div className="analysis-card support">
                            <div className="card-label">Support</div>
                            <div className="card-value">{aiSignal.support ? aiSignal.support.toFixed(decimalPlaces) : 'N/A'}</div>
                        </div>

                        {/* (ใหม่) Resistance Card */}
                        <div className="analysis-card resistance">
                            <div className="card-label">Resistance</div>
                            <div className="card-value">{aiSignal.resistance ? aiSignal.resistance.toFixed(decimalPlaces) : 'N/A'}</div>
                        </div>

                    </div>

                    {/* Buy/Sell Pressure Bar Section */}
                    <div className="pressure-bar-section">
                        <div className="pressure-bar-label">
                            <span>Buy Pressure ({aiSignal.buyer_percentage.toFixed(0)}%)</span>
                            <span>Sell Pressure ({(100 - aiSignal.buyer_percentage).toFixed(0)}%)</span>
                        </div>
                        <div className="pressure-bar">
                            <div className="buy-pressure" style={{ width: `${aiSignal.buyer_percentage}%` }}></div>
                        </div>
                    </div>
                </>
            ) : (
                <div className="placeholder-content">
                    <p>กดปุ่ม "Start AI Analysis" เพื่อดูข้อมูล</p>
                </div>
            )}

            {/* ส่วนสำหรับร้องขอ Signal จะแสดงอยู่ด้านล่างเสมอ */}
            <div className="signal-request-section">
                <p className="request-prompt">
                    {hasAnalysisData 
                        ? 'ต้องการเข้าเทรดตอนนี้? ร้องขอสัญญาณที่เฉพาะเจาะจงจาก AI' 
                        : 'ยังไม่มีข้อมูลวิเคราะห์, ลองร้องขอสัญญาณใหม่จาก AI'}
                </p>
                <div className="signal-request-buttons">
                    {/* (แก้ไข) เปลี่ยนจาก 2 ปุ่ม เป็นปุ่มเดียว */}
                    <button
                        className="request-button auto-signal"
                        onClick={onRequestAutoSignal}
                        disabled={isRequestingSignal}
                    >
                        {isRequestingSignal ? 'กำลังวิเคราะห์...' : 'ร้องขอสัญญาณ'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MarketAnalysisPanel;
