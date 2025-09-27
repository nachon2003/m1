import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import './SupportModal.css';
import TicketDetailModal from './TicketDetailModal'; // (ใหม่) Import

const SupportModal = ({ isOpen, onClose, unreadTicketIds, markTicketAsRead }) => {
    const { token } = useAuth();
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [tickets, setTickets] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    // (ใหม่) State สำหรับจัดการ Modal รายละเอียด
    const [selectedTicketId, setSelectedTicketId] = useState(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    const fetchTickets = useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/support/tickets`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch tickets.');
            const data = await response.json();
            setTickets(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    useEffect(() => {
        if (isOpen) {
            fetchTickets();
        }
    }, [isOpen, fetchTickets]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setSuccess('');
        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/support/tickets`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ subject, message })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Failed to create ticket.');
            
            setSuccess('Your support ticket has been submitted successfully!');
            setSubject('');
            setMessage('');
            fetchTickets(); // Refresh the ticket list
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleViewTicket = (ticketId) => {
        setSelectedTicketId(ticketId);
        setIsDetailModalOpen(true);
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content support-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Support Center</h2>
                    <button onClick={onClose} className="close-button">&times;</button>
                </div>
                <div className="modal-body">
                    <div className="support-form-container">
                        <h3>Submit a New Ticket</h3>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label htmlFor="subject">Subject</label>
                                <input type="text" id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} required />
                            </div>
                            <div className="form-group">
                                <label htmlFor="message">Message</label>
                                <textarea id="message" rows="5" value={message} onChange={(e) => setMessage(e.target.value)} required ></textarea>
                            </div>
                            {error && <p className="error-message">{error}</p>}
                            {success && <p className="success-message">{success}</p>}
                            <button type="submit" className="submit-button" disabled={isLoading}>
                                {isLoading ? 'Submitting...' : 'Submit Ticket'}
                            </button>
                        </form>
                    </div>
                    <div className="ticket-history-container">
                        <h3>Your Ticket History</h3>
                        {isLoading && tickets.length === 0 && <p>Loading tickets...</p>}
                        <div className="tickets-list">
                            {tickets.length > 0 ? (
                                tickets.map(ticket => (
                                    <div 
                                        key={ticket.id} 
                                        className={`ticket-item ${unreadTicketIds.includes(ticket.id) ? 'unread' : ''}`} 
                                        onClick={() => handleViewTicket(ticket.id)}>
                                        <div className="ticket-header">
                                            <span className={`ticket-status status-${ticket.status}`}>{ticket.status}</span>
                                            <span className="ticket-date">{new Date(ticket.created_at).toLocaleString()}</span>
                                        </div>
                                        <p className="ticket-subject">{ticket.subject}</p>
                                    </div>
                                ))
                            ) : !isLoading && (
                                <p>You have no support tickets.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            {/* (แก้ไข) ส่ง props ที่จำเป็นลงไป */}
            <TicketDetailModal 
                isOpen={isDetailModalOpen}
                onClose={() => setIsDetailModalOpen(false)}
                ticketId={selectedTicketId}
                isAdminView={false}
                markTicketAsRead={markTicketAsRead}
            />
        </div>
    );
};

export default SupportModal;