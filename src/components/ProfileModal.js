// src/components/ProfileModal.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './ProfileModal.css';

const ProfileModal = ({ isOpen, onClose }) => {
    const { user, changePassword, updateEmail } = useAuth(); // (ใหม่) ดึงฟังก์ชัน updateEmail
    
    // (ใหม่) ใช้ state แยกสำหรับ email เพื่อให้แก้ไขได้
    const [email, setEmail] = useState(user?.email || '');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        setEmail(user?.email || '');
    }, [user]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (newPassword !== confirmPassword) {
            setError("รหัสผ่านใหม่ไม่ตรงกัน");
            return;
        }

        // เพิ่มการตรวจสอบความซับซ้อนของรหัสผ่านให้ปลอดภัยยิ่งขึ้น
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            setError("รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร, ประกอบด้วยตัวพิมพ์ใหญ่, พิมพ์เล็ก, และตัวเลข");
            return;
        }

        setIsLoading(true);
        const result = await changePassword(currentPassword, newPassword);
        setIsLoading(false);

        if (result.success) {
            setSuccess(result.message || 'เปลี่ยนรหัสผ่านสำเร็จ!');
            setTimeout(() => {
                handleClose();
            }, 2000);
        } else {
            setError(result.message || 'การเปลี่ยนรหัสผ่านล้มเหลว');
        }
    };

    // (ใหม่) ฟังก์ชันสำหรับบันทึกอีเมล
    const handleEmailSave = async () => {
        if (!email) {
            setError("Email cannot be empty.");
            return;
        }
        setIsLoading(true);
        setError('');
        setSuccess('');

        try {
            const result = await updateEmail(email);
            if (result.success) {
                setSuccess(result.message || 'Email updated successfully!');
            } else {
                setError(result.message || 'Failed to update email.');
            }
        } catch (err) {
            setError(err.message || 'An unexpected error occurred.');
        } finally {
            setIsLoading(false);
        }
    };


    const handleClose = () => {
        // รีเซ็ตค่าทั้งหมดเมื่อปิดหน้าต่าง
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setError('');
        setSuccess('');
        setEmail(user?.email || ''); // รีเซ็ตอีเมลกลับเป็นค่าเดิม
        onClose();
    };

    if (!isOpen) {
        return null;
    }

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="modal-content profile-modal" onClick={e => e.stopPropagation()}>
                <button className="close-button" onClick={handleClose}>&times;</button>
                <h2>โปรไฟล์ของฉัน</h2>
                
                <div className="profile-section email-section">
                    <h3 className="section-title">ข้อมูลบัญชี</h3>
                    <div className="form-group">
                        <label htmlFor="profile-email">Email</label>
                        <input
                            type="email"
                            id="profile-email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={isLoading}
                            placeholder={user?.email ? '' : 'เพิ่มอีเมลของคุณ'}
                        />
                    </div>
                    <button onClick={handleEmailSave} className="submit-button" disabled={isLoading || email === (user?.email || '')}>บันทึกอีเมล</button>
                </div>

                <div className="profile-section">
                    <h3 className="section-title">เปลี่ยนรหัสผ่าน</h3>
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label htmlFor="current-password">รหัสผ่านปัจจุบัน</label>
                            <input
                                type="password"
                                id="current-password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                required
                                disabled={isLoading}
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="new-password">รหัสผ่านใหม่</label>
                            <input
                                type="password"
                                id="new-password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                                disabled={isLoading}
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="confirm-password">ยืนยันรหัสผ่านใหม่</label>
                            <input
                                type="password"
                                id="confirm-password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                disabled={isLoading}
                            />
                        </div>
                        {error && <p className="error-message">{error}</p>}
                        {success && <p className="success-message">{success}</p>}
                        <button type="submit" className="submit-button" disabled={isLoading || !currentPassword || !newPassword}>
                            {isLoading ? 'กำลังบันทึก...' : 'เปลี่ยนรหัสผ่าน'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ProfileModal;