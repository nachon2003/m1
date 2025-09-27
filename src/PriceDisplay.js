import React, { useState, useEffect } from 'react';

function PriceDisplay() {
  const [prices, setPrices] = useState({
    bitcoin: { usd: null, usd_24hr_change: null },
    ethereum: { usd: null, usd_24hr_change: null }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        // เปลี่ยน URL ให้เรียกผ่าน Proxy
        const response = await fetch('/api/data/1h'); // Use a default timeframe like '1h'
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }
        const combinedData = await response.json();

        const marketData = combinedData.marketData; // Extract market data from the combined response

        if (marketData) {
            setPrices({
              bitcoin: {
                usd: marketData.bitcoin.usd,
                usd_24hr_change: marketData.bitcoin.usd_24hr_change
              },
              ethereum: {
                usd: marketData.ethereum.usd,
                usd_24hr_change: marketData.ethereum.usd_24hr_change
              }
            });
        } else {
            console.warn("Market data not available from combined API.");
            setPrices({ // Set to null if data is missing
                bitcoin: { usd: null, usd_24hr_change: null },
                ethereum: { usd: null, usd_24hr_change: null }
            });
        }
      } catch (e) {
        console.error("Error fetching market data from combined API:", e);
        setError("Failed to load market data. " + e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPrices();
    // ปรับแก้: เปลี่ยนการดึงข้อมูลเป็นทุกๆ 5 นาที (300,000 ms) เพื่อป้องกัน Rate Limit
    // 5 minutes * 60 seconds/minute * 1000 ms/second = 300000 ms
    const intervalId = setInterval(fetchPrices, 300000);

    return () => clearInterval(intervalId); // Cleanup interval on component unmount
  }, []); // Empty dependency array means this runs once on mount

  if (loading) {
    return <div className="price-display">Loading market data...</div>;
  }

  if (error) {
    return <div className="price-display" style={{ color: 'red' }}>Error: {error}</div>;
  }

  const formatPrice = (price) => {
    // Changed to display USD
    return price !== null ? `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A';
  };

  const formatChange = (change) => {
    if (change === null || change === undefined) return 'N/A';
    const isPositive = change >= 0;
    const sign = isPositive ? '+' : '';
    const className = isPositive ? 'positive' : 'negative';
    return (
      <span className={className}>
        {sign}{change.toFixed(2)}%
      </span>
    );
  };

  return (
    <div className="price-display">
      <div className="price-card">
        <h3>Bitcoin (BTC)</h3>
        <p>{formatPrice(prices.bitcoin.usd)}</p>
        <p className="change">24h Change: {formatChange(prices.bitcoin.usd_24hr_change)}</p>
      </div>
      <div className="price-card">
        <h3>Ethereum (ETH)</h3>
        <p>{formatPrice(prices.ethereum.usd)}</p>
        <p className="change">24h Change: {formatChange(prices.ethereum.usd_24hr_change)}</p>
      </div>
    </div>
  );
}

export default PriceDisplay;