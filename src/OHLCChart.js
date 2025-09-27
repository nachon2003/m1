import React, { useEffect, useRef } from 'react';

function OHLCChart({ selectedSymbol, timeframe, selectedSymbolType }) {
    const widgetContainerRef = useRef(null); // สร้าง ref เพื่ออ้างถึง div ที่จะฝัง widget

    useEffect(() => {
        const currentContainer = widgetContainerRef.current;

        // ตรวจสอบว่ามี container ref อยู่ก่อนดำเนินการต่อ
        if (!currentContainer) {
            console.warn("OHLCChart: widgetContainerRef.current is null on effect run. Skipping widget initialization.");
            return;
        }

        // แปลง selectedSymbol ให้เป็นรูปแบบที่ TradingView เข้าใจ
        let tvSymbol = '';
        if (selectedSymbolType === 'forex') {
            // TradingView มักใช้ FX_IDC: สำหรับคู่เงิน Forex
            // ตัวอย่าง: EUR/USD -> FX_IDC:EURUSD
            // ลองเปลี่ยนไปใช้ Symbol แบบไม่มี Prefix (เช่น 'USDJPY') เพื่อให้ TradingView เลือกแหล่งข้อมูลมาตรฐาน
            // ซึ่งมีโอกาสตรงกับแหล่งข้อมูลของ AI มากกว่า
            tvSymbol = selectedSymbol.toUpperCase().replace('/', '');
        } else {
            // ถ้าไม่ใช่ forex ก็ใช้ symbol ตรงๆ (หรือจัดการประเภทอื่นๆ)
            tvSymbol = selectedSymbol.toUpperCase();
        }

        // แปลง timeframe ให้เป็นรูปแบบที่ TradingView เข้าใจ
        const tvInterval = timeframe === '1d' ? 'D' :
                           timeframe === '1h' ? '60' :
                           timeframe === '4h' ? '240' : // TradingView ใช้ '240' สำหรับ 4 ชั่วโมง
                           timeframe === '15m' ? '15' : 'D'; // '15' สำหรับ 15 นาที

        // ลบเนื้อหาของวิดเจ็ตเก่าออกก่อนที่จะสร้างใหม่
        // นี่เป็นวิธีที่ดีในการ "รีเฟรช" วิดเจ็ตเมื่อ symbol หรือ timeframe เปลี่ยน
        currentContainer.innerHTML = '';

        // สร้าง script element สำหรับโหลด TradingView Widget แบบ Dynamic
        const script = document.createElement('script');
        script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
        script.type = "text/javascript";
        script.async = true; // โหลด script แบบ asynchronous

        // กำหนด configuration สำหรับ TradingView Widget
        const widgetConfig = {
            "allow_symbol_change": true, // อนุญาตให้ผู้ใช้เปลี่ยนคู่เงินบน chart
            "calendar": false,           // ไม่แสดงปฏิทินข่าวสาร
            "details": false,            // ไม่แสดงรายละเอียด
            "hide_side_toolbar": true,   // ซ่อนแถบเครื่องมือด้านข้าง
            "hide_top_toolbar": false,   // แสดงแถบเครื่องมือด้านบน
            "hide_legend": false,        // แสดง legend
            "hide_volume": false,        // แสดง volume
            "hotlist": false,            // ไม่แสดง Hotlist
            "interval": tvInterval,      // ช่วงเวลาของแท่งเทียน (เช่น D, 60, 240, 15)
            "locale": "en",              // ภาษา
            "save_image": true,          // อนุญาตให้บันทึกรูปภาพ chart
            "style": "1",                // รูปแบบ chart (Candles)
            "symbol": tvSymbol,          // สัญลักษณ์คู่เงิน (เช่น FX_IDC:EURUSD)
            "theme": "dark",             // ธีมของ chart (dark/light)
            "timezone": "Etc/UTC",       // Timezone
            "backgroundColor": "#1a1e26", // สีพื้นหลังของ chart
            "gridColor": "rgba(46, 46, 46, 0.06)", // สีของเส้น Grid
            "watchlist": [],             // ไม่แสดง Watchlist
            "withdateranges": false,     // ไม่แสดง Date Ranges
            "compareSymbols": [],        // ไม่เปรียบเทียบกับสัญลักษณ์อื่น
            "studies": [],               // ไม่แสดง Indicator อื่นๆ
            "autosize": true,            // **สำคัญมาก: ให้ widget ปรับขนาดอัตโนมัติตาม container**
            "width": "100%",             // กำหนดความกว้างของ widget ให้เต็ม container
            "height": "100%"             // กำหนดความสูงของ widget ให้เต็ม container
        };

        // ใส่ config object เข้าไปใน script tag
        script.innerHTML = JSON.stringify(widgetConfig);

        // เพิ่ม script tag เข้าไปใน div container
        currentContainer.appendChild(script);

        // Cleanup function ที่จะรันเมื่อ component unmount หรือ dependencies เปลี่ยน
        return () => {
            if (currentContainer) {
                currentContainer.innerHTML = ''; // ล้างเนื้อหาเพื่อลบ widget เก่า
            }
        };
    }, [selectedSymbol, timeframe, selectedSymbolType]); // Dependencies: rerender เมื่อค่าเหล่านี้เปลี่ยน

    return (
        <div
            className="tradingview-widget-container"
            ref={widgetContainerRef} // เชื่อมต่อ ref กับ div นี้
            style={{
                width: '100%',
                height: '100%', // ให้ div นี้ขยายเต็ม parent
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
            }}
        >
            {/* div นี้ TradingView จะใช้เป็น container จริงๆ */}
            {/* เราไม่จำเป็นต้องใส่ style={{ height: '100%', width: '100%' }} ซ้ำแล้ว */}
            <div className="tradingview-widget-container__widget"></div>

            {/* ส่วนของ Copyright ของ TradingView */}
            <div className="tradingview-widget-copyright" style={{ color: '#b0b0b0', fontSize: '11px', textAlign: 'right', paddingRight: '10px', marginTop: 'auto' }}>
                <a
                    href="https://www.tradingview.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#8a2be2', textDecoration: 'none' }}
                >
                    <span className="blue-text">Track all markets on TradingView</span>
                </a>
            </div>
        </div>
    );
}

export default OHLCChart;