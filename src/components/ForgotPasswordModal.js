// src/components/ForgotPasswordModal.js
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './ForgotPasswordModal.css'; // สร้างไฟล์ CSS ใหม่
import './LoginModal.css'; // นำสไตล์บางส่วนมาใช้ร่วมกัน

const ForgotPasswordModal = ({ isOpen, onClose, onSwitchToLogin }) => {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const { requestPasswordReset } = useAuth(); // เราจะเพิ่มฟังก์ชันนี้ใน AuthContext

    if (!isOpen) {
        return null;
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setIsLoading(true);

        try {
            // สมมติว่า requestPasswordReset จะคืนค่า { success: true, message: '...' }
            const result = await requestPasswordReset(email);
            if (result.success) {
                setSuccess(result.message);
                // ไม่ต้องปิด modal ทันที เพื่อให้ผู้ใช้อ่านข้อความได้
            } else {
                setError(result.message || 'Something went wrong. Please try again.');
            }
        } catch (err) {
            setError(err.message || 'An unexpected error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content forgot-password-modal" onClick={(e) => e.stopPropagation()}>
                <button className="close-button" onClick={onClose}>&times;</button>
                <h2>Reset Password</h2>
                
                {success ? (
                    <div className="success-container">
                        <p className="success-message">{success}</p>
                        <button onClick={onSwitchToLogin} className="switch-link">Back to Login</button>
                    </div>
                ) : (
                    <>
                        <p className="modal-prompt">Enter your account's email address and we will send you a link to reset your password.</p>
                        {error && <p className="error-message">{error}</p>}
                        <form onSubmit={handleSubmit} className="forgot-password-form">
                            <div className="form-group">
                                <label htmlFor="reset-email">Email Address</label>
                                <input
                                    type="email"
                                    id="reset-email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    disabled={isLoading}
                                    autoComplete="email"
                                />
                            </div>
                            <button type="submit" className="login-submit-button" disabled={isLoading}>
                                {isLoading ? 'Sending...' : 'Send Reset Link'}
                            </button>
                        </form>
                        <p className="switch-form-prompt"><button onClick={onSwitchToLogin} className="switch-link">Back to Login</button></p>
                    </>
                )}
            </div>
        </div>
    );
};

export default ForgotPasswordModal;