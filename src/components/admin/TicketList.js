// src/components/admin/TicketList.js
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import TicketDetailModal from '../TicketDetailModal';
import './TicketList.css';

const TicketList = () => {
    const { token } = useAuth();
    const [tickets, setTickets] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedTicketId, setSelectedTicketId] = useState(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    const fetchTickets = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await fetch(`/api/admin/tickets`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || 'Failed to fetch tickets.');
            }
            const data = await response.json();
            setTickets(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    useEffect(() => {
        if (token) {
            fetchTickets();
        }
    }, [token, fetchTickets]);

    const handleStatusChange = async (ticketId, newStatus) => {
        try {
            const response = await fetch(`/api/admin/tickets/${ticketId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: newStatus })
            });
            if (!response.ok) throw new Error('Failed to update status.');
            
            setTickets(prevTickets => 
                prevTickets.map(t => t.id === ticketId ? { ...t, status: newStatus } : t)
            );
        } catch (err) {
            alert(`Error updating status: ${err.message}`);
        }
    };

    const handleViewTicket = (ticketId) => {
        setSelectedTicketId(ticketId);
        setIsDetailModalOpen(true);
    };

    if (isLoading) return <div className="loading-spinner">Loading tickets...</div>;
    if (error) return <div className="error-message">{error}</div>;

    return (
        <>
            <div className="admin-table-container">
                <table className="admin-tickets-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>User</th>
                            <th>Subject</th>
                            <th>Date</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tickets.map(ticket => (
                            <tr key={ticket.id}>
                                <td>#{ticket.id}</td>
                                <td>{ticket.username}</td>
                                <td>{ticket.subject}</td>
                                <td>{new Date(ticket.created_at).toLocaleString()}</td>
                                <td><span className={`ticket-status status-${ticket.status}`}>{ticket.status}</span></td>
                                <td>
                                    <div className="action-buttons">
                                        <button className="view-button" onClick={() => handleViewTicket(ticket.id)}>View & Reply</button>
                                        <select value={ticket.status} onChange={(e) => handleStatusChange(ticket.id, e.target.value)} className="status-select">
                                            <option value="open">Open</option>
                                            <option value="in_progress">In Progress</option>
                                            <option value="closed">Closed</option>
                                        </select>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <TicketDetailModal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} ticketId={selectedTicketId} isAdminView={true} onUpdate={fetchTickets} />
        </>
    );
};

export default TicketList;