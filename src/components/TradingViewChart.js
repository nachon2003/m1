// src/components/TradingViewChart.js

import React, { useEffect, useRef, memo } from 'react';

// Mapping for our app's timeframe to TradingView's interval format
const timeframeToInterval = {
    '1m': '1',
    '5m': '5',
    '15m': '15',
    '30m': '30',
    '1h': '60',
    '4h': '240',
    '1d': 'D',
    '1w': 'W',
};

// We receive symbol and timeframe as props now
const TradingViewChart = ({ symbol = 'EURUSD', timeframe = '1d', theme = 'dark' }) => {
    const container = useRef(null);

    useEffect(() => {
        // This effect will now re-run whenever 'symbol' or 'timeframe' changes
        
        // Ensure the container is empty before creating a new widget
        if (container.current) {
            container.current.innerHTML = '';
        }

        // Check if the TradingView library is available
        if (window.TradingView && container.current) {
            new window.TradingView.widget({
                "width": "100%",
                "height": "500px", // เพิ่มความสูงเพื่อให้ดูกราฟง่ายขึ้น
                "symbol": `FX_IDC:${symbol}`, // <-- ใช้ symbol จาก props
                "interval": timeframeToInterval[timeframe] || 'D', // <-- ใช้ timeframe จาก props
                "timezone": "Asia/Bangkok", // เปลี่ยนเป็น Timezone ของไทย
                "theme": theme, // <-- ใช้ theme จาก props
                "style": "1",
                "locale": "en",
                // --- NEW: เพิ่ม Timeframe ที่ต้องการให้เลือกได้บนกราฟ ---
                "timeframes": [
                    "1", // 1m
                    "5", // 5m
                    "15", // 15m
                    "30", // 30m
                    "60", // 1h
                    "240", // 4h
                    "D", // 1d
                    "W" // 1w
                ],
                "toolbar_bg": "#f1f3f6",
                "enable_publishing": false,
                "allow_symbol_change": false, // ปิดไม่ให้ผู้ใช้เปลี่ยนคู่เงินจากในกราฟโดยตรง
                "container_id": container.current.id
            });
        }

        // The cleanup function is now implicitly handled by clearing the innerHTML
        // at the start of the effect on every run.
    }, [symbol, timeframe, theme]); // <-- Dependency array ensures this runs on change

    return (
        <div 
            id="tradingview_widget_container" 
            ref={container} 
            style={{ height: '500px', width: '100%' }} 
        />
    );
};

// Use React.memo for performance optimization. It prevents the component from
// re-rendering if its props (symbol, timeframe) have not changed.
export default memo(TradingViewChart);