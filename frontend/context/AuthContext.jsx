import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API_URL = 'http://localhost:5000/api/v1';

// Configure axios to include credentials (cookies) in every request
axios.defaults.withCredentials = true;

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        const storedUser = localStorage.getItem('testnexa_user');
        return storedUser ? JSON.parse(storedUser) : null;
    });
    const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('testnexa_token'));
    const [isLoading, setIsLoading] = useState(true);
    const [pendingAction, setPendingAction] = useState(null);
    const [guestGenerationsUsed, setGuestGenerationsUsed] = useState(() => {
        const stored = localStorage.getItem('testnexa_guest_count');
        return stored ? parseInt(stored, 10) : 0;
    });

    const GUEST_LIMIT = 2;

    const checkAuth = async () => {
        const token = localStorage.getItem('testnexa_token');
        if (!token) {
            setIsLoading(false);
            return;
        }

        try {
            const response = await axios.get(`${API_URL}/auth/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.success) {
                setUser(response.data.user);
                setIsAuthenticated(true);
            } else {
                // If backend says token is invalid
                logout();
            }
        } catch (error) {
            console.error('Check auth error:', error);
            logout();
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const handleUrlToken = async () => {
            const params = new URLSearchParams(window.location.search);
            const token = params.get('token');

            if (token) {
                // Save token to localStorage
                localStorage.setItem('testnexa_token', token);

                // Remove token from URL for clean history
                const url = new URL(window.location);
                url.searchParams.delete('token');
                window.history.replaceState({}, document.title, url.pathname);

                // Now check auth with this new token
                await checkAuth();
            } else {
                // Normal check
                await checkAuth();
            }
        };

        handleUrlToken();
    }, []);

    // Execute pending action after successful login
    useEffect(() => {
        if (isAuthenticated && pendingAction) {
            const action = pendingAction;
            setPendingAction(null);
            // Execute the pending action
            if (typeof action === 'function') {
                action();
            }
        }
    }, [isAuthenticated, pendingAction]);

    const login = async (email, password) => {
        try {
            const response = await axios.post(`${API_URL}/auth/login`, { email, password });
            if (response.data.success) {
                const { user, token } = response.data;
                localStorage.setItem('testnexa_token', token);
                localStorage.setItem('testnexa_user', JSON.stringify(user));
                setUser(user);
                setIsAuthenticated(true);
                return { success: true };
            }
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Login failed. Please check your credentials.'
            };
        }
    };

    const register = async (name, email, password) => {
        try {
            const response = await axios.post(`${API_URL}/auth/register`, { name, email, password });
            if (response.data.success) {
                const { user, token } = response.data;
                localStorage.setItem('testnexa_token', token);
                localStorage.setItem('testnexa_user', JSON.stringify(user));
                setUser(user);
                setIsAuthenticated(true);
                return { success: true };
            }
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Registration failed.'
            };
        }
    };

    const loginWithGoogle = () => {
        window.location.href = `${API_URL}/auth/google`;
    };

    const loginWithGitHub = () => {
        window.location.href = `${API_URL}/auth/github`;
    };

    const logout = async () => {
        try {
            // Call backend logout
            await axios.post(`${API_URL}/auth/logout`);

            // Clear local state
            localStorage.removeItem('testnexa_token');
            localStorage.removeItem('testnexa_user');
            setUser(null);
            setIsAuthenticated(false);
        } catch (error) {
            console.error('Logout failed:', error);
            // Still clear local state on error
            localStorage.removeItem('testnexa_token');
            localStorage.removeItem('testnexa_user');
            setUser(null);
            setIsAuthenticated(false);
        }
    };

    const forgotPassword = async (email) => {
        try {
            const response = await axios.post(`${API_URL}/auth/forgot-password`, { email });
            return {
                success: true,
                message: response.data.message
            };
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Failed to send reset email.'
            };
        }
    };

    const resetPassword = async (token, newPassword) => {
        try {
            const response = await axios.put(`${API_URL}/auth/reset-password/${token}`, { password: newPassword });
            if (response.data.success) {
                return { success: true };
            }
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Failed to reset password. The link might be invalid or expired.'
            };
        }
    };

    const incrementGuestUsage = () => {
        const newCount = guestGenerationsUsed + 1;
        setGuestGenerationsUsed(newCount);
        localStorage.setItem('testnexa_guest_count', newCount.toString());
    };

    const canGenerateAsGuest = () => {
        return guestGenerationsUsed < GUEST_LIMIT;
    };

    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated,
            isLoading,
            login,
            register,
            loginWithGoogle,
            loginWithGitHub,
            logout,
            forgotPassword,
            resetPassword,
            checkAuth,
            pendingAction,
            setPendingAction,
            guestGenerationsUsed,
            incrementGuestUsage,
            canGenerateAsGuest,
            GUEST_LIMIT
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
