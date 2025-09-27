import React from 'react';
import './OpenTradesPanel.css';

// ฟังก์ชันสำหรับคำนวณกำไร/ขาดทุน (P/L) และ Pips (ฉบับปรับปรุงให้แม่นยำ) - allSignalsData is no longer needed for conversion
const calculateTradeMetrics = (trade, currentPrice, allLivePrices) => {
    if (!currentPrice || !trade || !trade.entryPrice || !trade.symbol) {
        return { pnl: 0, pips: 0 };
    }

    const priceDiff = trade.signal === 'BUY' 
        ? currentPrice - trade.entryPrice 
        : trade.entryPrice - currentPrice;

    // --- การคำนวณ Pips ---
    // ตรวจสอบว่าเป็นคู่เงิน JPY หรือทอง (XAU)
    const isJpy = trade.symbol && trade.symbol.toUpperCase().includes('JPY');
    const isGold = trade.symbol && trade.symbol.toUpperCase().includes('XAU');
    // กำหนดค่าของ 1 pip
    const pipValue = (isJpy || isGold) ? 0.01 : 0.0001;
    const pips = priceDiff / pipValue;

    // --- การคำนวณ P/L เป็นจำนวนเงิน ---
    // P/L = (ความต่างของราคา) * (ขนาดสัญญา) * (ขนาด Lot)
    // สำหรับ XAU/USD, ขนาดสัญญา (Contract Size) คือ 100 ออนซ์ต่อ lot
    // สำหรับคู่เงิน Forex ส่วนใหญ่, ขนาดสัญญาคือ 100,000 หน่วยต่อ lot
    const contractSize = isGold ? 100 : 100000;
    const pnlInQuoteCurrency = priceDiff * contractSize * trade.lotSize;

    const [baseCurrency, quoteCurrency] = trade.symbol.split('/');

    let pnlInUsd = 0;

    if (quoteCurrency === 'USD') {
        // กรณีที่ 1: Quote currency คือ USD (เช่น EUR/USD). P/L เป็น USD อยู่แล้ว
        pnlInUsd = pnlInQuoteCurrency;
    } else if (baseCurrency === 'USD') {
        // กรณีที่ 2: Base currency คือ USD (เช่น USD/JPY). P/L เป็น JPY.
        // ต้องหารด้วยราคาปัจจุบันเพื่อแปลงเป็น USD
        pnlInUsd = pnlInQuoteCurrency / currentPrice;
    } else {
        // กรณีที่ 3: Cross-currency (เช่น EUR/JPY, EUR/GBP). P/L เป็น Quote currency (JPY, GBP).
        // ต้องหาคู่เงินสำหรับแปลงค่าเป็น USD
        const conversionPairToUsd = `${quoteCurrency}/USD`; // เช่น GBP/USD
        const conversionPairFromUsd = `USD/${quoteCurrency}`; // เช่น USD/JPY

        const conversionRate = allLivePrices[conversionPairToUsd] || (allLivePrices[conversionPairFromUsd] ? 1 / allLivePrices[conversionPairFromUsd] : null);

        if (conversionRate) {
            if (!isNaN(conversionRate) && conversionRate > 0) {
                if (allLivePrices[conversionPairToUsd]) {
                    // สำหรับ EUR/GBP, P/L เป็น GBP. เราจะคูณด้วยเรท GBP/USD
                    pnlInUsd = pnlInQuoteCurrency * conversionRate;
                } else {
                    // สำหรับ EUR/JPY, P/L เป็น JPY. เราจะหารด้วยเรท USD/JPY
                    pnlInUsd = pnlInQuoteCurrency * conversionRate; // The rate is already inverted
                }
            } else {
                return { pnl: NaN, pips }; // ไม่สามารถคำนวณ P/L ได้
            }
        } else {
            return { pnl: NaN, pips }; // ไม่มีข้อมูลสำหรับแปลงค่า
        }
    }
    
    return { pnl: pnlInUsd, pips };
};

function OpenTradesPanel({ trades, livePrices, onCloseTrade, onCloseAllTrades }) {
    if (!trades || trades.length === 0) {
        return (
            <div className="open-trades-panel">
                <h4>Open Trades (0)</h4>
                <div className="no-open-trades">
                    <p>ยังไม่มีรายการเทรดที่เปิดอยู่</p>
                </div>
            </div>
        );
    }

    const totalPL = trades.reduce((acc, trade) => {
        // Use livePrices for the most accurate current price
        const currentPrice = livePrices[trade.symbol] ? parseFloat(livePrices[trade.symbol]) : null;
        const { pnl } = currentPrice ? calculateTradeMetrics(trade, currentPrice, livePrices) : { pnl: 0 };
        
        // บวกค่า P/L ก็ต่อเมื่อเป็นตัวเลขที่ถูกต้องเท่านั้น
        return !isNaN(pnl) ? acc + pnl : acc;
    }, 0);

    const totalPLClass = totalPL >= 0 ? 'profit' : 'loss';

    return (
        <div className="open-trades-panel">
            <div className="panel-header">
                <h4>Open Trades ({trades.length})</h4>
                <div className="total-pl">
                    {trades.length > 1 && (
                        <button className="close-all-button" onClick={onCloseAllTrades}>
                            Close All
                        </button>
                    )}
                    Total P/L: <span className={totalPLClass}>${totalPL.toFixed(2)}</span>
                </div>
            </div>
            <div className="trades-list">
                <div className="trade-item header">
                    <span>Symbol</span>
                    <span>Type</span>
                    <span>Lot</span>
                    <span>Entry Price</span>
                    <span>Current Price</span>
                    <span>P/L (Pips)</span>
                    <span>Action</span>
                </div>
                {trades.map(trade => {
                    // Use livePrices for the most accurate current price
                    const currentPrice = livePrices[trade.symbol] ? parseFloat(livePrices[trade.symbol]) : null;
                    
                    const { pnl, pips } = currentPrice
                        ? calculateTradeMetrics(trade, currentPrice, livePrices)
                        : { pnl: 0, pips: 0 };

                    const pnlClass = pnl >= 0 ? 'profit' : 'loss';
                    const decimalPlaces = (trade.symbol && (trade.symbol.toUpperCase().includes('JPY') || trade.symbol.toUpperCase().includes('XAU'))) ? 2 : 4;

                    return (
                        <div key={trade.id} className="trade-item">
                            <span>{trade.symbol}</span>
                            <span className={`signal-${trade.signal.toLowerCase()}`}>{trade.signal}</span>
                            <span>{trade.lotSize.toFixed(2)}</span>
                            <span>{trade.entryPrice.toFixed(decimalPlaces)}</span>
                            <span>{currentPrice ? currentPrice.toFixed(decimalPlaces) : 'N/A'}</span>
                            <span className={pnlClass}>
                                {currentPrice && !isNaN(pnl) ? (
                                    <>
                                        ${pnl.toFixed(2)}
                                        <span className="pips-value">({pips.toFixed(1)} pips)</span>
                                    </>
                                ) : 'Calculating...'}
                            </span>
                            <span>
                                <button className="close-trade-button" onClick={() => onCloseTrade(trade.id)}>
                                    Close
                                </button>
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default OpenTradesPanel;
