import React, { useState, useEffect } from 'react';
import eventBus from '../eventBus';
import './NotificationContainer.css';

const Notification = ({ message, type, onDismiss }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onDismiss();
        }, 5000); // Auto-dismiss after 5 seconds

        return () => clearTimeout(timer);
    }, [onDismiss]);

    return (
        <div className={`notification-item ${type}`} onClick={onDismiss}>
            <p>{message}</p>
        </div>
    );
};

const NotificationContainer = () => {
    const [notifications, setNotifications] = useState([]);

    useEffect(() => {
        const handleShowNotification = (event) => {
            const { message, type = 'info' } = event.detail;
            const newNotification = { id: Date.now(), message, type };
            setNotifications(prev => [...prev, newNotification]);
        };

        eventBus.addEventListener('show-notification', handleShowNotification);
        return () => eventBus.removeEventListener('show-notification', handleShowNotification);
    }, []);

    const dismissNotification = (id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    return (
        <div className="notification-container">
            {notifications.map(n => (
                <Notification key={n.id} {...n} onDismiss={() => dismissNotification(n.id)} />
            ))}
        </div>
    );
};

export default NotificationContainer;