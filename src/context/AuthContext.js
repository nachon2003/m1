import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import eventBus from '../eventBus';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(() => localStorage.getItem('token'));
    const [isAuthLoading, setIsAuthLoading] = useState(true);

    const isLoggedIn = !!token && !!user;

    const saveSession = (userData, userToken) => {
        setToken(userToken);
        setUser(userData);
        localStorage.setItem('token', userToken);
    };

    const clearSession = useCallback(() => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
    }, []);

    useEffect(() => {
        const verifyToken = async () => {
            if (token) {
                try {
                    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
                    const response = await fetch(`${apiUrl}/api/auth/verify`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (response.ok) {
                        const userData = await response.json();
                        setUser(userData);
                    } else {
                        clearSession();
                    }
                } catch (error) {
                    console.error("Token verification failed:", error);
                    clearSession();
                }
            }
            setIsAuthLoading(false);
        };
        verifyToken();
    }, [token, clearSession]);

    const login = async (username, password) => {
        try {
            const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
            const response = await fetch(`${apiUrl}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            const data = await response.json();
            if (response.ok) {
                saveSession(data.user, data.token);
                return { success: true };
            } else {
                return { success: false, message: data.message };
            }
        } catch (error) {
            return { success: false, message: 'Network error or server is down.' };
        }
    };

    const register = async (username, password, email) => {
        try {
            const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
            const response = await fetch(`${apiUrl}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, email }),
            });
            const data = await response.json();
            return { success: response.ok, message: data.message };
        } catch (error) {
            return { success: false, message: 'Network error or server is down.' };
        }
    };

    const logout = () => {
        clearSession();
        eventBus.dispatchEvent(new CustomEvent('show-notification', {
            detail: { message: 'Logged out successfully.', type: 'info' }
        }));
    };

    const changePassword = async (currentPassword, newPassword) => {
        try {
            const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
            const response = await fetch(`${apiUrl}/api/auth/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ currentPassword, newPassword }),
            });
            const data = await response.json();
            return { success: response.ok, message: data.message };
        } catch (error) {
            return { success: false, message: 'Network error or server is down.' };
        }
    };

    const updateUserProfile = (newProfileData) => {
        setUser(currentUser => ({ ...currentUser, ...newProfileData }));
    };

    const updateEmail = async (newEmail) => {
        try {
            const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
            const response = await fetch(`${apiUrl}/api/auth/update-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ email: newEmail }),
            });
            const data = await response.json();
            if (response.ok) {
                updateUserProfile({ email: newEmail });
            }
            return { success: response.ok, message: data.message };
        } catch (error) {
            return { success: false, message: 'Network error or server is down.' };
        }
    };

    // --- (ใหม่) เพิ่มฟังก์ชันนี้เข้ามา ---
    const requestPasswordReset = async (email) => {
        try {
            const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
            const response = await fetch(`${apiUrl}/api/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const data = await response.json();
            // เราจะคืนค่า success เป็น true เสมอเพื่อความปลอดภัย
            // และใช้ message จาก backend
            return { success: true, message: data.message };
        } catch (error) {
            console.error("Password reset request failed:", error);
            return { success: false, message: 'A network error occurred. Please try again.' };
        }
    };

    const value = {
        isLoggedIn,
        user,
        token,
        isAuthLoading,
        login,
        register,
        logout,
        changePassword,
        updateUserProfile,
        updateEmail,
        requestPasswordReset, // <-- (ใหม่) ส่งฟังก์ชันนี้ผ่าน Context
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    return useContext(AuthContext);
};
