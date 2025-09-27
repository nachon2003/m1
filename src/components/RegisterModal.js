import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './RegisterModal.css'; // ใช้ CSS แยกสำหรับ Register
import './LoginModal.css'; // นำ style บางส่วนจาก Login มาใช้

function RegisterModal({ isOpen, onClose, onSwitchToLogin }) {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState(''); // (ใหม่) เพิ่ม state สำหรับ email
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { register } = useAuth();
    // (ลบ) ไม่จำเป็นต้องใช้ useEffect ในส่วนนี้แล้ว เพราะ AuthProvider จัดการการรีเซ็ต state ให้แล้ว

    useEffect(() => {
        // ล้างข้อมูลในฟอร์มเมื่อ modal ถูกปิด
        // เพื่อให้แน่ใจว่าเมื่อเปิดใหม่อีกครั้ง จะไม่มีข้อมูลเก่าค้างอยู่
        if (!isOpen) {
            // ใช้ setTimeout เพื่อให้ state update หลังจาก animation การปิดจบลง
            const timer = setTimeout(() => {
                setUsername('');
                setEmail('');
                setPassword('');
                setConfirmPassword('');
                setError('');
                setSuccess('');
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    if (!isOpen) {
        return null;
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!username || !email || !password || !confirmPassword) {
            setError('Please fill in all fields.');
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        // เพิ่มการตรวจสอบความซับซ้อนของรหัสผ่าน
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
        if (!passwordRegex.test(password)) {
            setError("Password must be at least 8 characters, and include an uppercase letter, a lowercase letter, and a number.");
            return;
        }

        setIsLoading(true);
        try {
            const result = await register(username, password, email);
            if (result.success) {
                setSuccess('Registration successful! Redirecting to login...');
                setTimeout(() => {
                    onSwitchToLogin();
                }, 2000); // หน่วงเวลา 2 วินาทีเพื่อให้ผู้ใช้อ่านข้อความ
            } else {
                setError(result.message || 'Registration failed. Please try again.');
            }
        } catch (err) {
            setError('An unexpected error occurred. Please try again later.');
            console.error("Registration error:", err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content register-modal" onClick={(e) => e.stopPropagation()}>
                <button className="close-button" onClick={onClose}>&times;</button>
                <h2>Create Account</h2>
                {success && <p className="success-message">{success}</p>}
                {error && <p className="error-message">{error}</p>}
                <form onSubmit={handleSubmit} className="register-form">
                    <div className="form-group">
                        <label htmlFor="reg-username">Username</label>
                        <input type="text" id="reg-username" value={username} onChange={(e) => setUsername(e.target.value)} required disabled={isLoading} autoComplete="username" />
                    </div>
                    <div className="form-group">
                        <label htmlFor="reg-email">Email</label>
                        <input type="email" id="reg-email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isLoading} autoComplete="email" />
                    </div>
                    <div className="form-group">
                        <label htmlFor="reg-password">Password</label>
                        <input type="password" id="reg-password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isLoading} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="confirm-password">Confirm Password</label>
                        <input type="password" id="confirm-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required disabled={isLoading} />
                    </div>
                    <button type="submit" className="register-submit-button" disabled={isLoading}>
                        {isLoading ? 'Signing Up...' : 'Sign Up'}
                    </button>
                </form>
                <p className="switch-form-prompt">Already have an account? <button onClick={onSwitchToLogin} className="switch-link" disabled={isLoading}>Login here</button></p>
            </div>
        </div>
    );
}

export default RegisterModal;