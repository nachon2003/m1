import React from 'react';
import BacktestResultsTable from './BacktestResultsTable'; // (ใหม่) Import คอมโพเนนต์ที่เราสร้าง
import TradeHistoryTable from './TradeHistoryTable'; // (ใหม่) Import ตารางประวัติการเทรด
import './StatisticsModal.css'; // เราจะสร้างไฟล์ CSS นี้ด้วย

const StatisticsModal = ({ isOpen, onClose }) => {
    if (!isOpen) {
        return null;
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content statistics-modal" onClick={e => e.stopPropagation()}>
                <button className="close-button" onClick={onClose}>&times;</button>
                <h2>Model & Strategy Statistics</h2>
                
                {/* ส่วนแสดงผลลัพธ์ Backtest */}
                <div className="stats-section">
                    <BacktestResultsTable />
                </div>

                {/* (ใหม่) ส่วนแสดงประวัติการเทรด */}
                <div className="stats-section">
                    <TradeHistoryTable />
                </div>

            </div>
        </div>
    );
};

export default StatisticsModal;