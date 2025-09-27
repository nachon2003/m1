import React, { useState } from 'react';
import TicketList from '../components/admin/TicketList';
import UserManagement from '../components/admin/UserManagement';
import { Link } from 'react-router-dom'; // (ใหม่) Import Link
import './AdminDashboard.css';

const AdminDashboard = () => {
    // 2. ใช้ State เพื่อสลับมุมมองระหว่าง Ticket และ User
    const [activeView, setActiveView] = useState('tickets'); 

    return (
        <div className="admin-dashboard-container">
            <header className="admin-header"> 
                <div className="admin-header-left"> {/* (ใหม่) เพิ่ม div ครอบหัวข้อและปุ่มย้อนกลับ */}
                    <h1>Admin Dashboard</h1>
                    <Link to="/" className="back-to-app-button">← Back to App</Link>
                </div>
                {/* 3. สร้างปุ่มสำหรับสลับมุมมอง */}
                <nav className="admin-nav">
                    <button 
                        onClick={() => setActiveView('tickets')}
                        className={activeView === 'tickets' ? 'active' : ''}
                    >
                        Support Tickets
                    </button>
                    <button 
                        onClick={() => setActiveView('users')}
                        className={activeView === 'users' ? 'active' : ''}
                    >
                        User Management
                    </button>
                </nav>
            </header>
            <main className="admin-main-content">
                {/* 4. แสดงคอมโพเนนต์ตาม State ที่เลือก */}
                {activeView === 'tickets' && <TicketList />}
                {activeView === 'users' && <UserManagement />}
            </main>
        </div>
    );
};

export default AdminDashboard;