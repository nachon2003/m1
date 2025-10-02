// (แก้ไข) เพิ่มข้อมูล Mock ให้มีจำนวนมากกว่า 100 แท่ง เพื่อให้ AI สามารถทำงานได้เมื่อ API หลักล่ม
const generateMockData = (startPrice, numPoints) => {
    const data = [];
    let currentPrice = startPrice;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - numPoints);

    for (let i = 0; i < numPoints; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);

        const open = currentPrice;
        const change = (Math.random() - 0.5) * (startPrice * 0.01); // Fluctuation up to 1%
        const close = open + change;
        const high = Math.max(open, close) + (Math.random() * (startPrice * 0.005));
        const low = Math.min(open, close) - (Math.random() * (startPrice * 0.005));
        const volume = Math.floor(Math.random() * 100000) + 50000;

        data.push({
            time: date,
            open: parseFloat(open.toFixed(4)),
            high: parseFloat(high.toFixed(4)),
            low: parseFloat(low.toFixed(4)),
            close: parseFloat(close.toFixed(4)),
            volume: volume
        });

        currentPrice = close;
    }
    return data;
};

const mockOhlcData = {
    "EUR/USD": generateMockData(1.0850, 150),
    "GBP/USD": generateMockData(1.2700, 150),
    "USD/JPY": generateMockData(157.00, 150),
    "USD/CAD": generateMockData(1.3700, 150),
    "USD/CHF": generateMockData(0.9000, 150),
    "XAU/USD": generateMockData(2350.00, 150),
};

module.exports = mockOhlcData;