import React from 'react';

// Props ที่รับเข้ามาจะตรงกับที่ App.js ส่งให้ในปัจจุบัน
function TradeSignalDetails({ aiSignal, isLoading, timeframe, livePrice }) {
    if (isLoading) {
        return (
            <div className="trade-details-container loading">
                <p>กำลังวิเคราะห์สัญญาณซื้อขาย...</p>
            </div>
        );
    }

    // เงื่อนไขการตรวจสอบว่ามีข้อมูลครบถ้วนหรือไม่ ก่อนแสดงผล
    // --- MODIFIED: ตรวจสอบเงื่อนไขใหม่ที่ต้องการ entryZoneStart และ entryZoneEnd ---
    if (!aiSignal || aiSignal.signal === 'HOLD' || aiSignal.signal === 'ERROR' || !aiSignal.entryZoneStart || !aiSignal.entryZoneEnd) {
        return (
            <div className="trade-details-container no-signal">
                <p>ยังไม่มีสัญญาณซื้อขายที่ชัดเจนในขณะนี้</p>
            </div>
        );
    }

    // --- MODIFIED: ดึงค่าจาก aiSignal object ตามโครงสร้างใหม่ ---
    const { signal, symbol, entryZoneStart, entryZoneEnd, takeProfitPrice, stopLossPrice, reasoning } = aiSignal;

    const isJpyPair = symbol && symbol.toUpperCase().includes('JPY');
    const isGoldPair = symbol && symbol.toUpperCase().includes('XAU');

    // Logic ตรวจสอบคู่เงินเพื่อกำหนดจำนวนทศนิยม
    const decimalPlaces = isJpyPair || isGoldPair ? 2 : 5;

    // --- NEW: คำนวณ Risk-Reward Ratio จากค่าที่ได้รับมาโดยตรง ---
    // ใช้ราคาเฉลี่ยของโซนเป็นจุดเข้าอ้างอิงในการคำนวณ
    const avgEntryPrice = (entryZoneStart + entryZoneEnd) / 2;
    let riskRewardRatio = 'N/A';
    if (signal === 'BUY') {
        const potentialReward = Math.abs(takeProfitPrice - avgEntryPrice);
        const potentialRisk = Math.abs(avgEntryPrice - stopLossPrice);
        if (potentialRisk > 0) {
            riskRewardRatio = (potentialReward / potentialRisk).toFixed(1);
        }
    } else { // 'SELL'
        const potentialReward = Math.abs(avgEntryPrice - takeProfitPrice);
        const potentialRisk = Math.abs(stopLossPrice - avgEntryPrice);
        if (potentialRisk > 0) {
            riskRewardRatio = (potentialReward / potentialRisk).toFixed(1);
        }
    }
     
    const signalClass = signal.toLowerCase();

    return (
        <div className={`trade-details-container ${signalClass}`}>
            <h3 className="trade-details-title">สัญญาณซื้อขายสำหรับ {symbol}</h3>
            <div className="trade-details-grid">
                <div className="trade-detail-item">
                    <span className="trade-detail-label">สัญญาณ</span>
                    <span className={`trade-detail-value signal-${signalClass}`}>{signal}</span>
                </div>
                <div className="trade-detail-item">
                    <span className="trade-detail-label">โซนราคาเข้า (Entry Zone)</span>
                    <span className="trade-detail-value">{`${entryZoneStart.toFixed(decimalPlaces)} - ${entryZoneEnd.toFixed(decimalPlaces)}`}</span>
                </div>
                <div className="trade-detail-item">
                    <span className="trade-detail-label">ราคาทำกำไร (Take Profit)</span>
                    <span className="trade-detail-value">{takeProfitPrice.toFixed(decimalPlaces)}</span>
                </div>
                <div className="trade-detail-item">
                    <span className="trade-detail-label">ราคาตัดขาดทุน (Stop Loss)</span>
                    <span className="trade-detail-value">{stopLossPrice.toFixed(decimalPlaces)}</span>
                </div>
                <div className="trade-detail-item">
                    <span className="trade-detail-label">Risk:Reward</span>
                    <span className="trade-detail-value">{riskRewardRatio !== 'N/A' ? `1 : ${riskRewardRatio}` : 'N/A'}</span>
                </div>
                {reasoning && (
                    <div className="trade-detail-item reasoning">
                        <span className="trade-detail-label">AI's Reasoning</span>
                        <span className="trade-detail-value">{reasoning}</span>
                    </div>
                )}
            </div>
        </div>
    );
}

export default TradeSignalDetails;
