// d:\new project + AI Model\new project\src\App.js
import React, { useState, useEffect, useCallback } from 'react'; // (ใหม่) เพิ่ม Route และ Routes
import { Routes, Route, Link } from 'react-router-dom';
import './App.css';
import TradingViewChart from './components/TradingViewChart';
import { useAuth } from './context/AuthContext';
import RegisterModal from './components/RegisterModal';
import LoginModal from './components/LoginModal';
import NewsModal from './components/NewsModal'; 
import ProfileModal from './components/ProfileModal';
import StatisticsModal from './components/StatisticsModal';
import SupportModal from './components/SupportModal'; // (ใหม่) Import Support Modal
import TradeSignalDetails from './components/TradeSignalDetails';
import MarketAnalysisPanel from './components/MarketAnalysisPanel';
import ForgotPasswordModal from './components/ForgotPasswordModal'; // (ใหม่) Import Forgot Password Modal
import TechnicalSignalPanel from './components/TechnicalSignalPanel'; // (ใหม่) Import component ใหม่
import ResetPasswordPage from './pages/ResetPasswordPage'; // (ใหม่) Import หน้า Reset Password
import ThemeSwitcher from './components/ThemeSwitcher';
import AdminDashboard from './pages/AdminDashboard'; // (ใหม่) Import Admin Dashboard
import RealtimePriceTicker from './components/RealtimePriceTicker';
import StrengthChart from './components/StrengthChart';
import eventBus from './eventBus'; // (ใหม่) Import Event Bus
import NotificationContainer from './components/NotificationContainer'; // (ใหม่) Import Notification Container

// Define symbol categories
const symbolCategories = [
    {
        label: 'Forex Pairs',
        symbols: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CAD', 'USD/CHF']
    },
    {
        label: 'Assets',
        symbols: ['XAU/USD']
    }
];

// Create a flat list of all symbols for fetching prices, etc.
const allSymbols = symbolCategories.flatMap(category => category.symbols);
// --- NEW: Define all supported timeframes ---
const SUPPORTED_TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];

const TradingPlatform = ({
    selectedSymbol,
    handleSymbolChange,
    timeframe,
    handleTimeframeChange,
    theme,
    livePrices,
    livePricesError,
    isPriceWsConnected,
    // NEW Props for on-demand AI
    marketAnalysis,
    technicalAnalysis, // (ใหม่) ส่งข้อมูล technical
    tradeSignal,
    isAnalyzing,
    isRequestingSignal,
    onRequestNewSignal,
    onRequestAutoSignal, // (ใหม่) รับฟังก์ชัน auto signal
    user
}) => (
    <div className="app-container">
        <aside className="App-sidebar">
            <h2>Forex Pairs</h2>
            <div className="selector-container">
                <label htmlFor="symbol-select">Select Pair</label>
                <select id="symbol-select" value={selectedSymbol} onChange={(e) => handleSymbolChange(e.target.value)} className="custom-select">
                    {symbolCategories.map((category) => (
                        <optgroup key={category.label} label={category.label}>
                            {category.symbols.map((symbol) => (
                                <option key={symbol} value={symbol}>
                                    {symbol}
                                </option>
                            ))}
                        </optgroup>
                    ))}
                </select>
            </div>
            <RealtimePriceTicker symbols={allSymbols} livePrices={livePrices} error={livePricesError} isConnected={isPriceWsConnected} />
            {/* StrengthChart now uses marketAnalysis for the selected symbol as its data source */}
            <StrengthChart symbols={allSymbols} signalsData={marketAnalysis ? { [marketAnalysis.symbol]: marketAnalysis } : {}} />
        </aside>
        <main className="App-main">
            <div className="selector-container timeframe-selector">
                <label htmlFor="timeframe-select">Timeframe</label>
                <select id="timeframe-select" value={timeframe} onChange={(e) => handleTimeframeChange(e.target.value)} className="custom-select">
                    {SUPPORTED_TIMEFRAMES.map((tf) => (
                        <option key={tf} value={tf}>{tf.toUpperCase()}</option>
                    ))}
                </select>
            </div>
            <TradingViewChart symbol={selectedSymbol.replace('/', '')} timeframe={timeframe} theme={theme} />
            <div className="main-bottom-panels">
                <MarketAnalysisPanel 
                    aiSignal={marketAnalysis} 
                    isLoading={isAnalyzing} 
                    isRequestingSignal={isRequestingSignal} 
                    symbol={selectedSymbol} // (แก้ไข) ส่ง symbol ไปให้ MarketAnalysisPanel
                    onRequestNewSignal={onRequestNewSignal} 
                    onRequestAutoSignal={onRequestAutoSignal} // (ใหม่) ส่งฟังก์ชัน auto signal ต่อไป
                />
                <TechnicalSignalPanel // (ใหม่) เพิ่ม Panel ใหม่
                    analysis={technicalAnalysis}
                    isLoading={isAnalyzing}
                    symbol={selectedSymbol}
                />
                <TradeSignalDetails 
                    aiSignal={tradeSignal} 
                    livePrice={livePrices[selectedSymbol]} 
                    isLoading={isRequestingSignal} 
                    timeframe={timeframe} 
                />
            </div>
        </main>
    </div>
);

function App() {
    const defaultSymbol = 'EUR/USD';
    const defaultTimeframe = '1d';

    // --- State Management ---
    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
    const [selectedSymbol, setSelectedSymbol] = useState(defaultSymbol);
    const [timeframe, setTimeframe] = useState(defaultTimeframe);
    const [error, setError] = useState(null);
    
    // --- NEW AI State Management ---
    const [marketAnalysis, setMarketAnalysis] = useState(null); // For general analysis
    const [technicalAnalysis, setTechnicalAnalysis] = useState(null); // (ใหม่) State สำหรับ Technical Analysis
    const [tradeSignal, setTradeSignal] = useState(null); // For specific BUY/SELL signal
    const [isAnalyzing, setIsAnalyzing] = useState(false); // Loading state for the main button
    const [lastAnalysisTime, setLastAnalysisTime] = useState(null); // NEW: State for last update time
    const [isRequestingSignal, setIsRequestingSignal] = useState(false); // Loading state for BUY/SELL buttons

    // --- Modal and Auth State ---
    const [isNewsModalOpen, setIsNewsModalOpen] = useState(false);
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
    const [isSupportModalOpen, setIsSupportModalOpen] = useState(false); // (ใหม่) State สำหรับ Support Modal
    const [isForgotPasswordModalOpen, setIsForgotPasswordModalOpen] = useState(false); // (ใหม่) State สำหรับ Forgot Password
    const [unreadTicketIds, setUnreadTicketIds] = useState([]); // (ใหม่) State สำหรับเก็บ Ticket ที่ยังไม่อ่าน
    const { isLoggedIn, user, logout, isAuthLoading, token } = useAuth(); // (แก้ไข) ดึง token มาจาก useAuth

    // --- Live Price State ---
    const [livePrices, setLivePrices] = useState({});
    const [livePricesError, setLivePricesError] = useState(null);
    const [isPriceWsConnected, setIsPriceWsConnected] = useState(false);

    // --- Theme Management ---
    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
    };

    useEffect(() => {
        document.body.className = '';
        document.body.classList.add(`${theme}-theme`);
    }, [theme]);

    // --- Live Price WebSocket Effect ---
    useEffect(() => {
        if (!isLoggedIn) {
            setLivePrices({});
            setLivePricesError(null);
            setIsPriceWsConnected(false);
            return;
        }

        const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:3001';
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('WebSocket Connected for Live Prices');
            setIsPriceWsConnected(true);
            setLivePricesError(null);
            // (ใหม่) ส่ง Token เพื่อยืนยันตัวตนเมื่อเชื่อมต่อสำเร็จ
            if (token) {
                ws.send(JSON.stringify({ type: 'AUTH', token: token }));
            }
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                // (แก้ไข) ปรับปรุงตรรกะการจัดการข้อความ WebSocket ให้ถูกต้อง
                if (data.type === 'NEW_REPLY') {
                    // 1. ถ้าเป็นข้อความแจ้งเตือนเรื่องแชท
                    console.log('New reply notification received:', data.data);
                    eventBus.dispatchEvent(new CustomEvent('new-reply', { detail: data.data }));
                    // (ใหม่) ส่ง event เพื่อแสดง toast notification
                    eventBus.dispatchEvent(new CustomEvent('show-notification', {
                        detail: { message: `You have a new reply in Ticket #${data.data.ticketId}`, type: 'info' }
                    }));
                    // (ใหม่) เพิ่ม ID ของ ticket ที่มีการตอบกลับใหม่เข้ามาใน state
                    setUnreadTicketIds(prev => [...new Set([...prev, data.data.ticketId])]);
                } else if (data.error) {
                    // 2. ถ้าเป็นข้อความ error
                    // Handle rate limit error specifically
                    if (data.type === 'RATE_LIMIT') {
                        console.warn('Live price updates paused due to rate limit.');
                        setLivePricesError(data.message); // Show "Auto-retrying..."
                    } else {
                        const errorMessage = data.details || data.message;
                        console.error('Error from server via WebSocket:', data.message, errorMessage);
                        setLivePricesError(errorMessage);
                    }
                } else {
                    // 3. ถ้าไม่มี type หรือ error ให้ถือว่าเป็นข้อมูลราคา
                    setLivePricesError(null);
                    setLivePrices(prevPrices => ({ ...prevPrices, ...data }));
                }
            } catch (error) {
                console.error('Failed to parse WebSocket message:', event.data, error);
                setLivePricesError('Received invalid data from server.');
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket Error:', error);
            setIsPriceWsConnected(false);
            setLivePricesError('Connection to the price server failed.');
        };

        ws.onclose = () => {
            console.log('WebSocket for prices disconnected.');
            setIsPriceWsConnected(false);
        };

        return () => {
            ws.close();
        };
    }, [isLoggedIn, token]); 

    // --- NEW: AI Interaction Handlers ---
    const handleStartAnalysis = useCallback(async () => {
        if (!isLoggedIn) return;
        setIsAnalyzing(true);
        setError(null);
        // (ใหม่) รีเซ็ต state ทั้งหมด
        setMarketAnalysis(null);
        setTechnicalAnalysis(null);
        setTradeSignal(null);

        try {
            // (ใหม่) เรียก API ทั้งสองพร้อมกัน
            const aiPromise = fetch(`${process.env.REACT_APP_API_URL}/api/ai/analyze`, { 
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` // (แก้ไข) เพิ่ม Authorization header
                },
                body: JSON.stringify({ symbol: selectedSymbol, timeframe: timeframe })
            });
            const techPromise = fetch(`${process.env.REACT_APP_API_URL}/api/technical/analyze`, { 
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` // (แก้ไข) เพิ่ม Authorization header
                },
                body: JSON.stringify({ symbol: selectedSymbol, timeframe: timeframe })
            });

            const [aiResponse, techResponse] = await Promise.all([aiPromise, techPromise]);

            if (!aiResponse.ok) throw new Error('AI analysis failed.');
            if (!techResponse.ok) throw new Error('Technical analysis failed.');

            const aiData = await aiResponse.json();
            const techData = await techResponse.json();

            setMarketAnalysis(aiData);
            setTechnicalAnalysis(techData);
            setLastAnalysisTime(new Date()); // NEW: Set the current time on successful analysis
        } catch (err) {
            setError(err.message);
            console.error("Error starting AI analysis:", err);
        } finally {
            setIsAnalyzing(false);
        }
    }, [isLoggedIn, selectedSymbol, timeframe, token]); // (แก้ไข) เพิ่ม token ใน dependency array

    const handleRequestNewSignal = useCallback(async (signalType) => {
        if (!isLoggedIn || !selectedSymbol) return;
        setIsRequestingSignal(true);
        setError(null);
        setTradeSignal(null);

        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/ai/request-signal`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` // (แก้ไข) เพิ่ม Authorization header
                },
                body: JSON.stringify({ signalType, symbol: selectedSymbol, timeframe: timeframe }),
            });
            if (!response.ok) {
                throw new Error(`Failed to get ${signalType} signal.`);
            }
            const data = await response.json();
            setTradeSignal(data);
        } catch (err) {
            setError(err.message);
            console.error("Error requesting specific signal:", err);
        } finally {
            setIsRequestingSignal(false);
        }
    }, [isLoggedIn, selectedSymbol, timeframe, token]); // (แก้ไข) เพิ่ม token ใน dependency array

    // (ใหม่) ฟังก์ชันสำหรับให้ AI ตัดสินใจเลือกสัญญาณที่ดีที่สุดเอง
    const handleRequestAutoSignal = useCallback(async () => {
        if (!marketAnalysis || !marketAnalysis.trend) {
            // ถ้ายังไม่มีผลวิเคราะห์ ให้แจ้งผู้ใช้ก่อน
            alert("Please run AI Analysis first to determine the market trend.");
            return;
        }

        const trend = marketAnalysis.trend.toLowerCase();
        let signalToRequest = null;

        if (trend.includes('up')) {
            signalToRequest = 'BUY';
        } else if (trend.includes('down')) {
            signalToRequest = 'SELL';
        }

        if (signalToRequest) {
            await handleRequestNewSignal(signalToRequest);
        } else {
            alert(`AI cannot determine a clear signal from the current trend ("${marketAnalysis.trend}").`);
        }
    }, [marketAnalysis, handleRequestNewSignal]);

    // --- UI Handlers ---
    const handleSymbolChange = (symbol) => {
        setSelectedSymbol(symbol);
        // --- NEW: Reset states and trigger analysis after a short delay ---
        setMarketAnalysis(null);
        setTechnicalAnalysis(null);
        setTradeSignal(null);
        setError(null);
        setLastAnalysisTime(null);

        // Set a brief timeout to allow live prices to update for the new symbol
        // before triggering the analysis.
        setTimeout(() => {
            handleStartAnalysis();
        }, 1500);

        // It's good practice to clear the timeout if the component unmounts
        // or if the symbol changes again quickly.
        // return () => clearTimeout(analysisTimeout);
    };

    // (ใหม่) ฟังก์ชันสำหรับลบ ticket ID ออกจากรายการที่ยังไม่อ่าน
    const markTicketAsRead = useCallback((ticketId) => {
        setUnreadTicketIds(prev => prev.filter(id => id !== ticketId));
    }, []); // setUnreadTicketIds is stable and doesn't need to be a dependency
    const handleTimeframeChange = (newTimeframe) => {
        setTimeframe(newTimeframe);
        // --- NEW: Reset states and trigger analysis when timeframe changes ---
        setMarketAnalysis(null);
        setTechnicalAnalysis(null);
        setTradeSignal(null);
        handleStartAnalysis(); // เรียกวิเคราะห์ใหม่ทันที
    };
    const openNewsModal = () => setIsNewsModalOpen(true);
    const closeNewsModal = () => setIsNewsModalOpen(false);
    const openStatsModal = () => setIsStatsModalOpen(true);
    const closeStatsModal = () => setIsStatsModalOpen(false);
    const openSupportModal = () => setIsSupportModalOpen(true); // (ใหม่)
    const closeSupportModal = () => setIsSupportModalOpen(false); // (ใหม่)
    const closeProfileModal = () => setIsProfileModalOpen(false);
    const openProfileModal = () => setIsProfileModalOpen(true); // (ใหม่)

    // (ใหม่) Handlers สำหรับ Forgot Password
    const openForgotPasswordModal = () => {
        setIsLoginModalOpen(false);
        setIsForgotPasswordModalOpen(true);
    };
    const closeForgotPasswordModal = () => setIsForgotPasswordModalOpen(false);

    const openLoginModal = () => {
        setIsRegisterModalOpen(false);
        setIsForgotPasswordModalOpen(false); // ปิดหน้าต่างลืมรหัสผ่าน (ถ้าเปิดอยู่)
        setIsLoginModalOpen(true);
    };
    const openRegisterModal = () => {
        setIsLoginModalOpen(false);
        setIsRegisterModalOpen(true);
    };

    // (ใหม่) สร้างฟังก์ชันสำหรับสลับกลับมาหน้า Login โดยเฉพาะ
    const switchToLogin = () => openLoginModal();

    const handleAuthClick = () => {
        if (isLoggedIn) {
            logout();
            alert('ออกจากระบบสำเร็จ!');
        } else {
            openLoginModal();
        }
    };

    // --- Render Logic ---
    if (isAuthLoading) {
        return <div className="loading-fullscreen"><span>Loading Application...</span></div>;
    }

    return (
        <div className={`App ${theme}-theme`}>
            <NotificationContainer /> {/* (ใหม่) เพิ่ม Notification Container ที่นี่ */}
            <header className="App-header">
                <div className="header-left">
                    {/* Top-bar signal display is removed to simplify the UI */}
                </div>
                <div className="header-right">
                    <ThemeSwitcher theme={theme} toggleTheme={toggleTheme} />
                    {/* (แก้ไข) เพิ่ม class 'has-unread' เมื่อมี ticket ที่ยังไม่อ่าน */}
                    <button className={`support-button ${unreadTicketIds.length > 0 ? 'has-unread' : ''}`} onClick={openSupportModal}>
                        Support
                    </button> 
                    {isLoggedIn && <button className="stats-button" onClick={openStatsModal}>Statistics</button>}
                    <button className="news-button" onClick={openNewsModal}>News</button>
                    {isLoggedIn ? (
                        <>
                            {/* (แก้ไข) ปรับเงื่อนไขการแสดงผลปุ่ม Admin ให้ยืดหยุ่นขึ้น (ใช้ == แทน ===) */}
                            {user && user.is_admin === 1 && (
                                <Link to="/admin" className="auth-button admin-button">Admin</Link>
                            )}
                            <span className="user-greeting">Welcome, {user.username}!</span>
                            {/* <img
                                src={user.profile_image_url ? `${process.env.REACT_APP_API_URL}${user.profile_image_url}` : 'https://via.placeholder.com/40'}
                                alt="Profile"
                                className="header-profile-pic"
                            /> */}
                            <button className="profile-button" onClick={openProfileModal}>Profile</button>
                            <button className="auth-button logout" onClick={handleAuthClick}>Logout</button>
                        </>
                    ) : (
                        <>
                            <button className="auth-button login" onClick={openLoginModal}>Login</button>
                            <button className="auth-button register" onClick={openRegisterModal}>Register</button>
                        </>
                    )}
                </div>
            </header>

            {/* (ใหม่) ใช้ React Router ในการสลับหน้า */}
            <Routes>
                {/* (แก้ไข) ปรับเงื่อนไขการเข้าถึงหน้า Admin ให้สอดคล้องกัน */}
                <Route path="/admin" element={isLoggedIn && user?.is_admin === 1 ? <AdminDashboard /> : <div className="login-prompt-container"><h2>Access Denied</h2><p>You do not have permission to view this page.</p><Link to="/">Go to Homepage</Link></div>} />
                {/* (ใหม่) เพิ่ม Route สำหรับหน้า Reset Password */}
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/" element={
                    isLoggedIn ? (
                        <div className="trading-platform-wrapper">
                            <div className="ai-controls">
                                <button
                                    onClick={handleStartAnalysis}
                                    className="start-ai-button"
                                    disabled={isAnalyzing || isRequestingSignal}
                                >
                                    {isAnalyzing ? (
                                        <>
                                            <div className="spinner"></div>
                                            <span>Analyzing...</span>
                                        </>
                                    ) : (
                                        <>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                                            <span>Start AI Analysis</span>
                                        </>
                                    )}
                                </button>
                                {(isAnalyzing || marketAnalysis) && (
                                    <div className="analysis-status">
                                        <span className="status-label">
                                            {isAnalyzing 
                                                ? `Analyzing:` 
                                                : `Last Analysis:`
                                            }
                                        </span>                                
                                        {!isAnalyzing && lastAnalysisTime && (
                                            <span className="last-update-time">({lastAnalysisTime.toLocaleTimeString()})</span>
                                        )}
                                        <span className="status-symbol">{isAnalyzing ? selectedSymbol : (marketAnalysis && marketAnalysis.symbol)}</span>
                                    </div>
                                )}
                                {error && <p className="error-message">{error}</p>}
                            </div>
                            <TradingPlatform
                                selectedSymbol={selectedSymbol}
                                handleSymbolChange={handleSymbolChange}
                                timeframe={timeframe}
                                handleTimeframeChange={handleTimeframeChange}
                                theme={theme}
                                livePrices={livePrices}
                                livePricesError={livePricesError}
                                isPriceWsConnected={isPriceWsConnected}
                                marketAnalysis={marketAnalysis}
                                technicalAnalysis={technicalAnalysis}
                                tradeSignal={tradeSignal}
                                isAnalyzing={isAnalyzing}
                                isRequestingSignal={isRequestingSignal}
                                onRequestNewSignal={handleRequestNewSignal}
                                onRequestAutoSignal={handleRequestAutoSignal} // (ใหม่) ส่งฟังก์ชันใหม่
                            />
                        </div>
                    ) : (
                        <div className="login-prompt-container">
                            <div className="login-prompt-box">
                                <h2>ปลดล็อกศักยภาพการเทรดของคุณ</h2>
                                <p>กรุณาเข้าสู่ระบบเพื่อเข้าถึงสัญญาณ AI, กราฟขั้นสูง และสถิติส่วนตัว</p>
                                <button className="auth-button login" onClick={handleAuthClick}>เข้าสู่ระบบเพื่อเริ่มต้น</button>
                                <p className="register-prompt">ยังไม่มีบัญชี? <button onClick={openRegisterModal} className="switch-link">สมัครสมาชิกที่นี่</button></p>
                            </div>
                        </div>
                    )
                } />
            </Routes>

            <ProfileModal isOpen={isProfileModalOpen} onClose={closeProfileModal} />
            <StatisticsModal isOpen={isStatsModalOpen} onClose={closeStatsModal} />
            <SupportModal 
                isOpen={isSupportModalOpen} 
                onClose={closeSupportModal} 
                unreadTicketIds={unreadTicketIds}
                markTicketAsRead={markTicketAsRead}
            />
            <NewsModal isOpen={isNewsModalOpen} onClose={closeNewsModal} />
            <LoginModal 
                isOpen={isLoginModalOpen} 
                onClose={() => setIsLoginModalOpen(false)} 
                onSwitchToRegister={openRegisterModal}
                onForgotPassword={openForgotPasswordModal} // (ใหม่) ส่ง prop ไปยัง LoginModal
            />
            <RegisterModal isOpen={isRegisterModalOpen} onClose={() => setIsRegisterModalOpen(false)} onSwitchToLogin={switchToLogin} />
            <ForgotPasswordModal 
                isOpen={isForgotPasswordModalOpen}
                onClose={closeForgotPasswordModal}
                onSwitchToLogin={switchToLogin} // (ใหม่) ส่ง prop สำหรับปุ่ม "Back to Login"
            />
        </div>
    );
}

export default App;
