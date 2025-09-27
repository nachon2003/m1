// src/pages/ResetPasswordPage.js
import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import './ResetPasswordPage.css'; // สร้างไฟล์ CSS ใหม่

const ResetPasswordPage = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('token');

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!token) {
            setError('Invalid or missing reset token.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            setError("Password must be at least 8 characters, and include an uppercase letter, a lowercase letter, and a number.");
            return;
        }

        setIsLoading(true);
        try {
            const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
            const response = await fetch(`${apiUrl}/api/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword }),
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to reset password.');
            }

            setSuccess(data.message || 'Password has been reset successfully! You can now log in.');
            setTimeout(() => navigate('/'), 3000); // กลับไปหน้าหลักหลังจาก 3 วินาที

        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="reset-password-container">
            <div className="reset-password-box">
                <h2>Set New Password</h2>
                {!token && <p className="error-message">No reset token found. Please request a new link.</p>}
                
                {success ? (
                    <div className="success-container">
                        <p className="success-message">{success}</p>
                        <Link to="/" className="auth-button login">Go to Login</Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        {error && <p className="error-message">{error}</p>}
                        <div className="form-group">
                            <label htmlFor="new-password">New Password</label>
                            <input type="password" id="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required disabled={isLoading} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="confirm-password">Confirm New Password</label>
                            <input type="password" id="confirm-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required disabled={isLoading} />
                        </div>
                        <button type="submit" className="submit-button" disabled={isLoading || !token}>
                            {isLoading ? 'Resetting...' : 'Reset Password'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ResetPasswordPage;