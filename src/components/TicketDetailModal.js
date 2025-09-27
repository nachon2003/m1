import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import './TicketDetailModal.css';
import eventBus from '../eventBus'; // (ใหม่) Import Event Bus

const TicketDetailModal = ({ isOpen, onClose, ticketId, isAdminView, markTicketAsRead }) => {
    const { token, user: currentUser } = useAuth(); // (แก้ไข) ดึงข้อมูลผู้ใช้ปัจจุบันมาด้วย
    const [ticket, setTicket] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [replyMessage, setReplyMessage] = useState('');

    const fetchTicketDetails = useCallback(async () => {
        if (!ticketId || !token) return;
        setIsLoading(true);
        setError('');
        const apiUrl = isAdminView 
            ? `${process.env.REACT_APP_API_URL}/api/admin/tickets/${ticketId}`
            : `${process.env.REACT_APP_API_URL}/api/support/tickets/${ticketId}`;

        try {
            const response = await fetch(apiUrl, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch ticket details.');
            const data = await response.json();
            setTicket(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [ticketId, token, isAdminView]);

    useEffect(() => {
        if (isOpen) {
            fetchTicketDetails();
            // (ใหม่) เมื่อเปิด modal นี้ ให้เรียกฟังก์ชันเพื่อลบ ID ออกจากรายการที่ยังไม่อ่าน
            if (ticketId && markTicketAsRead) {
                markTicketAsRead(ticketId);
            }
        }
    }, [isOpen, ticketId, fetchTicketDetails, markTicketAsRead]);

    // (ใหม่) Effect สำหรับดักฟัง event การตอบกลับใหม่
    useEffect(() => {
        const handleNewReply = (event) => {
            // ตรวจสอบว่าการตอบกลับใหม่เป็นของ Ticket ที่กำลังเปิดอยู่หรือไม่
            if (isOpen && event.detail && event.detail.ticketId === ticketId) {
                console.log(`Refreshing ticket #${ticketId} due to real-time update.`);
                fetchTicketDetails();
            }
        };

        eventBus.addEventListener('new-reply', handleNewReply);

        // Cleanup listener เมื่อ component ถูก unmount
        return () => eventBus.removeEventListener('new-reply', handleNewReply);
    }, [isOpen, ticketId, fetchTicketDetails]); // fetchTicketDetails is stable, kept for ESLint rule

    const handleReplySubmit = async (e) => {
        e.preventDefault();
        if (!replyMessage.trim()) return;

        setIsLoading(true);
        // (แก้ไข) เลือก API endpoint ที่ถูกต้องตามบทบาทของผู้ใช้
        const apiUrl = isAdminView
            ? `${process.env.REACT_APP_API_URL}/api/admin/tickets/${ticketId}/reply`
            : `${process.env.REACT_APP_API_URL}/api/support/tickets/${ticketId}/reply`;

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ message: replyMessage })
            });
            if (!response.ok) throw new Error('Failed to send reply.');
            setReplyMessage('');
            fetchTicketDetails(); // Refresh details to show new reply
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content ticket-detail-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Ticket Details {ticket ? `(#${ticket.id})` : ''}</h2>
                    <button onClick={onClose} className="close-button">&times;</button>
                </div>
                <div className="modal-body">
                    {isLoading && !ticket && <p>Loading details...</p>}
                    {error && <p className="error-message">{error}</p>}
                    {ticket && (
                        <>
                            <div className="ticket-info">
                                <p><strong>Subject:</strong> {ticket.subject}</p>
                                <p><strong>From:</strong> {ticket.username}</p>
                                <p><strong>Status:</strong> <span className={`ticket-status status-${ticket.status}`}>{ticket.status}</span></p>
                            </div>
                            <div className="conversation-container">
                                {/* (แก้ไข) ตรวจสอบว่าข้อความแรกเป็นของผู้ใช้ปัจจุบันหรือไม่ */}
                                <div className={`message-item ${ticket.user_id === currentUser.id ? 'my-message' : 'their-message'}`}>
                                    <p className="message-author">{ticket.username} (User)</p>
                                    <div className={`message-bubble ${ticket.user_id === currentUser.id ? 'my-bubble' : 'their-bubble'}`}>
                                        {ticket.message}
                                    </div>
                                    <p className="message-timestamp">{new Date(ticket.created_at).toLocaleString()}</p>
                                </div>
                                {ticket.replies.map(reply => (
                                    // (แก้ไข) ตรวจสอบว่าข้อความตอบกลับเป็นของผู้ใช้ปัจจุบันหรือไม่
                                    <div key={reply.id} className={`message-item ${reply.user_id === currentUser.id ? 'my-message' : 'their-message'}`}>
                                        <p className="message-author">
                                            {reply.username} {reply.is_admin ? '(Admin)' : ''}
                                        </p>
                                        <div className={`message-bubble ${reply.user_id === currentUser.id ? 'my-bubble' : 'their-bubble'}`}>
                                            {reply.message}
                                        </div>
                                        <p className="message-timestamp">{new Date(reply.created_at).toLocaleString()}</p>
                                    </div>
                                ))}
                            </div>
                            {/* (แก้ไข) แสดงฟอร์มตอบกลับสำหรับทั้งแอดมินและผู้ใช้ ถ้า ticket ยังไม่ปิด */}
                            {ticket.status !== 'closed' && (
                                <form onSubmit={handleReplySubmit} className="reply-form">
                                    <textarea value={replyMessage} onChange={e => setReplyMessage(e.target.value)} placeholder="Type your reply..." required />
                                    <button type="submit" disabled={isLoading || !replyMessage.trim()} title="Send Reply">
                                        {isLoading ? <div className="spinner-small"></div> : <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>}
                                    </button>
                                </form>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TicketDetailModal;