// src/components/admin/UserManagement.js
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import './UserManagement.css';

const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const { token, user: adminUser } = useAuth();

    const fetchUsers = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await fetch('/api/admin/users', {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Failed to fetch users.');
            }
            const data = await response.json();
            setUsers(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const handleRoleChange = async (userId, newIsAdmin) => {
        if (!window.confirm(`Are you sure you want to ${newIsAdmin ? 'grant admin rights to' : 'revoke admin rights from'} this user?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/users/${userId}/role`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ isAdmin: newIsAdmin }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Failed to update role.');
            }
            // Refresh user list after successful update
            fetchUsers();
        } catch (err) {
            alert(`Error: ${err.message}`);
        }
    };

    const handleDeleteUser = async (userId, username) => {
        // ใช้ prompt เพื่อให้แอดมินพิมพ์ชื่อผู้ใช้เพื่อยืนยันการลบ
        const confirmation = window.prompt(`To delete the user "${username}", please type their username to confirm:`);
        if (confirmation !== username) {
            if (confirmation !== null) { // ถ้าผู้ใช้กด Cancel, prompt จะคืนค่า null
                alert("Username does not match. Deletion cancelled.");
            }
            return;
        }

        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Failed to delete user.');
            alert(data.message); // แจ้งเตือนว่าลบสำเร็จ
            fetchUsers(); // รีเฟรชรายการผู้ใช้
        } catch (err) {
            alert(`Error: ${err.message}`);
        }
    };

    if (isLoading) {
        return <div className="loading-spinner">Loading users...</div>;
    }

    if (error) {
        return <div className="error-message">{error}</div>;
    }

    return (
        <div className="user-management-container">
            <h2>User Management</h2>
            <table className="users-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Username</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Created At</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map(user => (
                        <tr key={user.id}>
                            <td>{user.id}</td>
                            <td>{user.username}</td>
                            <td>{user.email || 'N/A'}</td>
                            <td>
                                <span className={`role-badge ${user.is_admin ? 'role-admin' : 'role-user'}`}>
                                    {user.is_admin ? 'Admin' : 'User'}
                                </span>
                            </td>
                            <td>{new Date(user.created_at).toLocaleDateString()}</td>
                            <td>
                                {user.id !== adminUser.id && (
                                    <div className="action-buttons-cell">
                                        {user.is_admin ? (
                                            <button className="action-button revoke" onClick={() => handleRoleChange(user.id, false)}>Revoke Admin</button>
                                        ) : (
                                            <button className="action-button grant" onClick={() => handleRoleChange(user.id, true)}>Make Admin</button>
                                        )}
                                        {/* ปุ่มลบผู้ใช้ */}
                                        <button className="action-button delete" onClick={() => handleDeleteUser(user.id, user.username)}>Delete</button>
                                    </div>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default UserManagement;