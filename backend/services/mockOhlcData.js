const mockOhlcData = {
    "EUR/USD": [
        { "time": new Date("2024-04-01T00:00:00.000Z"), "open": 1.078, "high": 1.082, "low": 1.077, "close": 1.081 },
        { "time": new Date("2024-04-02T00:00:00.000Z"), "open": 1.081, "high": 1.085, "low": 1.080, "close": 1.083 },
        { "time": new Date("2024-04-03T00:00:00.000Z"), "open": 1.083, "high": 1.087, "low": 1.082, "close": 1.085 },
        { "time": new Date("2024-04-04T00:00:00.000Z"), "open": 1.085, "high": 1.089, "low": 1.084, "close": 1.088 },
        { "time": new Date("2024-04-05T00:00:00.000Z"), "open": 1.088, "high": 1.092, "low": 1.087, "close": 1.090 },
        { "time": new Date("2024-04-08T00:00:00.000Z"), "open": 1.090, "high": 1.094, "low": 1.089, "close": 1.091 },
        { "time": new Date("2024-04-09T00:00:00.000Z"), "open": 1.091, "high": 1.095, "low": 1.090, "close": 1.093 },
        { "time": new Date("2024-04-10T00:00:00.000Z"), "open": 1.093, "high": 1.097, "low": 1.092, "close": 1.095 },
        { "time": new Date("2024-04-11T00:00:00.000Z"), "open": 1.095, "high": 1.099, "low": 1.094, "close": 1.098 },
        { "time": new Date("2024-04-12T00:00:00.000Z"), "open": 1.098, "high": 1.102, "low": 1.097, "close": 1.100 },
        { "time": new Date("2024-04-15T00:00:00.000Z"), "open": 1.100, "high": 1.104, "low": 1.099, "close": 1.101 },
        { "time": new Date("2024-04-16T00:00:00.000Z"), "open": 1.101, "high": 1.105, "low": 1.100, "close": 1.103 }
    ],
    "GBP/USD": [
        { "time": new Date("2024-04-01T00:00:00.000Z"), "open": 1.260, "high": 1.265, "low": 1.258, "close": 1.262 },
        { "time": new Date("2024-04-02T00:00:00.000Z"), "open": 1.262, "high": 1.267, "low": 1.260, "close": 1.264 },
        { "time": new Date("2024-04-03T00:00:00.000Z"), "open": 1.264, "high": 1.269, "low": 1.262, "close": 1.266 },
        { "time": new Date("2024-04-04T00:00:00.000Z"), "open": 1.266, "high": 1.271, "low": 1.264, "close": 1.268 },
        { "time": new Date("2024-04-05T00:00:00.000Z"), "open": 1.268, "high": 1.273, "low": 1.266, "close": 1.270 },
        { "time": new Date("2024-04-08T00:00:00.000Z"), "open": 1.270, "high": 1.275, "low": 1.268, "close": 1.271 },
        { "time": new Date("2024-04-09T00:00:00.000Z"), "open": 1.271, "high": 1.276, "low": 1.270, "close": 1.273 },
        { "time": new Date("2024-04-10T00:00:00.000Z"), "open": 1.273, "high": 1.278, "low": 1.272, "close": 1.275 },
        { "time": new Date("2024-04-11T00:00:00.000Z"), "open": 1.275, "high": 1.280, "low": 1.274, "close": 1.278 },
        { "time": new Date("2024-04-12T00:00:00.000Z"), "open": 1.278, "high": 1.283, "low": 1.277, "close": 1.280 },
        { "time": new Date("2024-04-15T00:00:00.000Z"), "open": 1.280, "high": 1.285, "low": 1.279, "close": 1.281 },
        { "time": new Date("2024-04-16T00:00:00.000Z"), "open": 1.281, "high": 1.286, "low": 1.280, "close": 1.283 }
    ],
    "USD/JPY": [
        { "time": new Date("2024-04-01T00:00:00.000Z"), "open": 151.5, "high": 152.0, "low": 151.3, "close": 151.8 },
        { "time": new Date("2024-04-02T00:00:00.000Z"), "open": 151.8, "high": 152.3, "low": 151.6, "close": 152.1 },
        { "time": new Date("2024-04-03T00:00:00.000Z"), "open": 152.1, "high": 152.6, "low": 151.9, "close": 152.4 },
        { "time": new Date("2024-04-04T00:00:00.000Z"), "open": 152.4, "high": 152.9, "low": 152.2, "close": 152.7 },
        { "time": new Date("2024-04-05T00:00:00.000Z"), "open": 152.7, "high": 153.2, "low": 152.5, "close": 153.0 },
        { "time": new Date("2024-04-08T00:00:00.000Z"), "open": 153.0, "high": 153.5, "low": 152.8, "close": 153.1 },
        { "time": new Date("2024-04-09T00:00:00.000Z"), "open": 153.1, "high": 153.6, "low": 153.0, "close": 153.3 },
        { "time": new Date("2024-04-10T00:00:00.000Z"), "open": 153.3, "high": 153.8, "low": 153.2, "close": 153.5 },
        { "time": new Date("2024-04-11T00:00:00.000Z"), "open": 153.5, "high": 154.0, "low": 153.4, "close": 153.8 },
        { "time": new Date("2024-04-12T00:00:00.000Z"), "open": 153.8, "high": 154.3, "low": 153.7, "close": 154.0 },
        { "time": new Date("2024-04-15T00:00:00.000Z"), "open": 154.0, "high": 154.5, "low": 153.9, "close": 154.1 },
        { "time": new Date("2024-04-16T00:00:00.000Z"), "open": 154.1, "high": 154.6, "low": 154.0, "close": 154.3 }
    ],
    "XAU/USD": [
        { "time": new Date("2024-04-01T00:00:00.000Z"), "open": 2230, "high": 2240, "low": 2225, "close": 2235 },
        { "time": new Date("2024-04-02T00:00:00.000Z"), "open": 2235, "high": 2245, "low": 2230, "close": 2240 },
        { "time": new Date("2024-04-03T00:00:00.000Z"), "open": 2240, "high": 2250, "low": 2235, "close": 2245 },
        { "time": new Date("2024-04-04T00:00:00.000Z"), "open": 2245, "high": 2255, "low": 2240, "close": 2250 },
        { "time": new Date("2024-04-05T00:00:00.000Z"), "open": 2250, "high": 2260, "low": 2245, "close": 2255 },
        { "time": new Date("2024-04-08T00:00:00.000Z"), "open": 2255, "high": 2265, "low": 2250, "close": 2258 },
        { "time": new Date("2024-04-09T00:00:00.000Z"), "open": 2258, "high": 2268, "low": 2255, "close": 2262 },
        { "time": new Date("2024-04-10T00:00:00.000Z"), "open": 2262, "high": 2272, "low": 2260, "close": 2268 },
        { "time": new Date("2024-04-11T00:00:00.000Z"), "open": 2268, "high": 2278, "low": 2265, "close": 2275 },
        { "time": new Date("2024-04-12T00:00:00.000Z"), "open": 2275, "high": 2285, "low": 2270, "close": 2280 },
        { "time": new Date("2024-04-15T00:00:00.000Z"), "open": 2280, "high": 2290, "low": 2275, "close": 2282 },
        { "time": new Date("2024-04-16T00:00:00.000Z"), "open": 2282, "high": 2292, "low": 2280, "close": 2288 }
    ]
};

module.exports = mockOhlcData;