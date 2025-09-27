// src/components/NewsModal.js
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './NewsModal.css'; // เราจะสร้างไฟล์ CSS นี้ในขั้นตอนต่อไป

const NewsModal = ({ isOpen, onClose }) => {
    const [news, setNews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // useCallback เพื่อป้องกันการสร้างฟังก์ชันซ้ำซ้อนในทุก render
    const fetchNews = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
            const response = await axios.get(`${apiUrl}/api/news`, {
                params: {
                    query: 'forex OR currency OR economy', // ค้นหาข่าวที่เกี่ยวข้องกับ forex, currency, economy
                    lang: 'en', // ภาษาอังกฤษ
                    country: 'us', // ประเทศสหรัฐอเมริกา (เลือกประเทศที่ต้องการได้)
                    max: 15 // จำนวนข่าวสูงสุด
                }
            });
            if (response.data && response.data.articles) {
                setNews(response.data.articles);
            } else {
                setError("No articles found or unexpected data format.");
                setNews([]);
            }
        } catch (err) {
            console.error("Error fetching news:", err);
            // ปรับปรุงการแสดงผล Error ให้เข้าใจง่ายขึ้น
            if (err.message === 'Network Error') {
                setError('Unable to connect to the server. Please ensure the backend is running and accessible.');
            } else {
                setError(`Failed to load news: ${err.response ? err.response.data.error : err.message}`);
            }
            setNews([]);
        } finally {
            setLoading(false);
        }
    }, []); // ไม่มี dependencies เพราะเราไม่ต้องการให้ fetchNews เปลี่ยนแปลงเมื่อ component re-renders

    useEffect(() => {
        if (isOpen) {
            fetchNews();
        }
    }, [isOpen, fetchNews]); // เรียก fetchNews เมื่อ modal ถูกเปิด (isOpen เปลี่ยนเป็น true)

    if (!isOpen) {
        return null; // ถ้า modal ไม่ได้เปิด ก็ไม่ต้อง render อะไรเลย
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}> {/* ป้องกันคลิกที่เนื้อหาแล้วปิด Modal */}
                <button className="close-button" onClick={onClose}>&times;</button>
                <h2>Forex & Economy News</h2>
                {loading && <p>Loading news...</p>}
                {error && <p className="error-message">{error}</p>}
                {!loading && !error && news.length === 0 && <p>No news available at the moment.</p>}
                <div className="news-list">
                    {news.map((article, index) => (
                        <div key={index} className="news-item">
                            {article.image && (
                                <img src={article.image} alt={article.title} className="news-image" />
                            )}
                            <div className="news-text-content">
                                <h3><a href={article.url} target="_blank" rel="noopener noreferrer">{article.title}</a></h3>
                                <p className="news-description">{article.description}</p>
                                <p className="news-source-date">
                                    Source: {article.source && article.source.name ? article.source.name : 'N/A'} - {new Date(article.publishedAt).toLocaleDateString()}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default NewsModal;