import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './LoginModal.css';

function LoginModal({ isOpen, onClose, onSwitchToRegister, onForgotPassword }) { // (ใหม่) เพิ่ม onForgotPassword
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const { login } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); // Clear previous errors
    if (!username || !password) {
      setError('Please enter username and password.');
      return;
    }
    // (แก้ไข) ลบ rememberMe ออกจากการเรียก login เพราะฟังก์ชันใน AuthContext ไม่ได้รับค่านี้
    // การจัดการ "Remember Me" ควรทำผ่านการตั้งค่าวันหมดอายุของ token/session ในฝั่ง Backend
    const result = await login(username, password);
    if (result.success) {
      onClose();
    } else {
      setError(result.message || 'Login failed. Please check your credentials.');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content login-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>&times;</button>
        <h2>Login</h2>
        {error && <p className="error-message">{error}</p>}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <div className="form-group form-row">
            <label htmlFor="rememberMe" className="checkbox-label">
              <input
                id="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              {' '}Remember me
            </label>
            <button type="button" onClick={onForgotPassword} className="switch-link forgot-password-link">
              Forgot Password?
            </button>
          </div>

          <button type="submit" className="login-submit-button">Sign In</button>
        </form>

        <p className="switch-form-prompt">
          Don't have an account?{' '}
          <button onClick={onSwitchToRegister} className="switch-link">Register here</button>
        </p>
      </div>
    </div>
  );
}

export default LoginModal;
