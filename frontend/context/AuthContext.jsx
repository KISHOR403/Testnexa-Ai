import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { workspaceService } from '../services/workspaceService';

const AuthContext = createContext(null);

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

// Configure axios to include credentials (cookies) in every request
axios.defaults.withCredentials = true;

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        const storedUser = localStorage.getItem('testnexa_user');
        return storedUser ? JSON.parse(storedUser) : null;
    });
    const [currentWorkspace, setCurrentWorkspace] = useState(() => {
        const stored = localStorage.getItem('testnexa_workspace');
        return stored ? JSON.parse(stored) : null;
    });
    const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('testnexa_token'));
    const [isLoading, setIsLoading] = useState(true);
    const [isSigningOut, setIsSigningOut] = useState(false);
    const [activeSessions, setActiveSessions] = useState([]);
    const [pendingAction, setPendingAction] = useState(null);
    const [guestGenerationsUsed, setGuestGenerationsUsed] = useState(() => {
        const stored = localStorage.getItem('testnexa_guest_count');
        return stored ? parseInt(stored, 10) : 0;
    });

    const isSigningOutRef = useRef(false);
    const GUEST_LIMIT = 2;

    const clearLocalAuthState = useCallback(() => {
        localStorage.removeItem('testnexa_token');
        localStorage.removeItem('testnexa_user');
        localStorage.removeItem('testnexa_workspace');
        setUser(null);
        setCurrentWorkspace(null);
        setIsAuthenticated(false);
        setActiveSessions([]);
    }, []);

    const fetchCurrentWorkspace = useCallback(async () => {
        const token = localStorage.getItem('testnexa_token');
        if (!token) return null;
        try {
            setIsLoadingWorkspace(true);
            const ws = await workspaceService.getCurrentWorkspace();
            if (ws) {
                setCurrentWorkspace(ws);
                localStorage.setItem('testnexa_workspace', JSON.stringify(ws));
            }
            return ws;
        } catch (err) {
            console.warn('Failed to load active workspace:', err.message);
            return null;
        } finally {
            setIsLoadingWorkspace(false);
        }
    }, []);

    const checkAuth = useCallback(async () => {
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
                fetchCurrentWorkspace();
            } else {
                clearLocalAuthState();
            }
        } catch (error) {
            console.warn('Check auth error (session invalid or expired):', error.response?.status || error.message);
            clearLocalAuthState();
        } finally {
            setIsLoading(false);
        }
    }, [clearLocalAuthState, fetchCurrentWorkspace]);

    // Centralized real logout function
    const logout = useCallback(async () => {
        if (isSigningOutRef.current) return;
        isSigningOutRef.current = true;
        setIsSigningOut(true);

        const token = localStorage.getItem('testnexa_token');

        try {
            // Call backend logout endpoint with credentials & Authorization header
            await axios.post(`${API_URL}/auth/logout`, {}, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                withCredentials: true,
                timeout: 6000
            });
        } catch (error) {
            console.warn('Backend logout request note:', error.response?.data?.message || error.message);
        } finally {
            // Clear local auth storage and state
            clearLocalAuthState();

            // Broadcast multi-tab logout notification
            try {
                if (window.BroadcastChannel) {
                    const bc = new BroadcastChannel('testnexa_auth');
                    bc.postMessage({ type: 'LOGOUT' });
                    bc.close();
                }
                localStorage.setItem('testnexa_logout_event', String(Date.now()));
            } catch (e) {
                // Ignore cross-tab broadcast errors
            }

            setIsSigningOut(false);
            isSigningOutRef.current = false;

            // Redirect cleanly to login page
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
    }, [clearLocalAuthState]);

    // Setup multi-tab sync and Axios response interceptor for 401/SESSION_REVOKED
    useEffect(() => {
        // 1. Cross-tab BroadcastChannel listener
        let bc;
        try {
            if (window.BroadcastChannel) {
                bc = new BroadcastChannel('testnexa_auth');
                bc.onmessage = (event) => {
                    if (event.data?.type === 'LOGOUT') {
                        clearLocalAuthState();
                        if (window.location.pathname.startsWith('/app')) {
                            window.location.href = '/login';
                        }
                    } else if (event.data?.type === 'LOGIN') {
                        setIsAuthenticated(true);
                        if (event.data?.user) {
                            setUser(event.data.user);
                        }
                        fetchCurrentWorkspace();
                    } else if (event.data?.type === 'WORKSPACE_UPDATED') {
                        if (event.data?.workspace) {
                            setCurrentWorkspace(event.data.workspace);
                            localStorage.setItem('testnexa_workspace', JSON.stringify(event.data.workspace));
                        } else {
                            fetchCurrentWorkspace();
                        }
                    }
                };
            }
        } catch (e) {
            // Ignore
        }

        // 2. Storage event listener (fallback for multi-tab logout and cross-tab login sync)
        const handleStorageChange = (e) => {
            if (e.key === 'testnexa_logout_event' || (e.key === 'testnexa_token' && !e.newValue)) {
                clearLocalAuthState();
                if (window.location.pathname.startsWith('/app')) {
                    window.location.href = '/login';
                }
            } else if (e.key === 'testnexa_token' && e.newValue) {
                setIsAuthenticated(true);
                const storedUser = localStorage.getItem('testnexa_user');
                if (storedUser) {
                    try {
                        setUser(JSON.parse(storedUser));
                    } catch (err) {}
                }
            }
        };
        window.addEventListener('storage', handleStorageChange);

        // 3. Axios response interceptor for automatic handling of revoked sessions
        const interceptorId = axios.interceptors.response.use(
            response => response,
            error => {
                if (error.response?.status === 401) {
                    const code = error.response.data?.code;
                    if (code === 'SESSION_REVOKED' || error.response.data?.message?.includes('revoked')) {
                        clearLocalAuthState();
                        if (window.location.pathname.startsWith('/app')) {
                            window.location.href = '/login';
                        }
                    }
                }
                return Promise.reject(error);
            }
        );

        return () => {
            if (bc) bc.close();
            window.removeEventListener('storage', handleStorageChange);
            axios.interceptors.response.eject(interceptorId);
        };
    }, [clearLocalAuthState]);

    // Check auth on mount / handle token in URL from OAuth
    useEffect(() => {
        const handleUrlToken = async () => {
            const params = new URLSearchParams(window.location.search);
            const token = params.get('token');

            if (token) {
                localStorage.setItem('testnexa_token', token);
                const url = new URL(window.location);
                url.searchParams.delete('token');
                window.history.replaceState({}, document.title, url.pathname);
                await checkAuth();
            } else {
                await checkAuth();
            }
        };

        handleUrlToken();
    }, [checkAuth]);

    // Execute pending action after successful login
    useEffect(() => {
        if (isAuthenticated && pendingAction) {
            const action = pendingAction;
            setPendingAction(null);
            if (typeof action === 'function') {
                action();
            }
        }
    }, [isAuthenticated, pendingAction]);

    const login = async (email, password, rememberMe = false) => {
        try {
            const response = await axios.post(`${API_URL}/auth/login`, { email, password, rememberMe });
            if (response.data.success) {
                const { user, token } = response.data;
                localStorage.setItem('testnexa_token', token);
                localStorage.setItem('testnexa_user', JSON.stringify(user));
                setUser(user);
                setIsAuthenticated(true);
                fetchCurrentWorkspace();

                // Broadcast login to other tabs (e.g., Tab A landing page)
                try {
                    if (window.BroadcastChannel) {
                        const bc = new BroadcastChannel('testnexa_auth');
                        bc.postMessage({ type: 'LOGIN', user });
                        bc.close();
                    }
                } catch (e) {}

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
                fetchCurrentWorkspace();

                // Broadcast login to other tabs
                try {
                    if (window.BroadcastChannel) {
                        const bc = new BroadcastChannel('testnexa_auth');
                        bc.postMessage({ type: 'LOGIN', user });
                        bc.close();
                    }
                } catch (e) {}

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

    // Active session management APIs
    const fetchSessions = useCallback(async () => {
        const token = localStorage.getItem('testnexa_token');
        if (!token) return [];
        try {
            const response = await axios.get(`${API_URL}/auth/sessions`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.success && response.data.sessions && response.data.sessions.length > 0) {
                setActiveSessions(response.data.sessions);
                return response.data.sessions;
            }
        } catch (error) {
            console.error('Failed to fetch active sessions:', error);
        }

        const fallback = [{
            id: 'sess_current_browser',
            device: 'Desktop Browser (Chrome / Windows)',
            browser: 'Chrome',
            os: 'Windows',
            ipAddress: '127.0.0.1',
            location: 'Current Session',
            lastActiveAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            isCurrent: true
        }];
        setActiveSessions(fallback);
        return fallback;
    }, []);

    const revokeSession = useCallback(async (sessionId) => {
        const token = localStorage.getItem('testnexa_token');
        if (!token) return { success: false, message: 'Not authenticated' };
        try {
            const response = await axios.post(`${API_URL}/auth/sessions/${sessionId}/revoke`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.success) {
                // If revoking current session, trigger logout
                const targetSession = activeSessions.find(s => s.id === sessionId);
                if (targetSession?.isCurrent) {
                    await logout();
                } else {
                    await fetchSessions();
                }
                return { success: true };
            }
            return { success: false, message: response.data.message || 'Failed to revoke session' };
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Failed to revoke session'
            };
        }
    }, [activeSessions, fetchSessions, logout]);

    const revokeOtherSessions = useCallback(async () => {
        const token = localStorage.getItem('testnexa_token');
        if (!token) return { success: false, message: 'Not authenticated' };
        try {
            const response = await axios.post(`${API_URL}/auth/sessions/revoke-others`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.success) {
                await fetchSessions();
                return { success: true };
            }
            return { success: false, message: response.data.message || 'Failed to revoke other sessions' };
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Failed to revoke other sessions'
            };
        }
    }, [fetchSessions]);

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

    const updateProfile = async (data) => {
        try {
            const token = localStorage.getItem('testnexa_token');
            const response = await axios.put(`${API_URL}/auth/update-profile`, data, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.success) {
                setUser(response.data.user);
                localStorage.setItem('testnexa_user', JSON.stringify(response.data.user));
                return { success: true, user: response.data.user };
            }
            return { success: false, message: response.data.message || 'Update failed' };
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Failed to update profile'
            };
        }
    };

    const changePassword = async (passwords) => {
        try {
            const token = localStorage.getItem('testnexa_token');
            const response = await axios.put(`${API_URL}/auth/change-password`, passwords, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return response.data;
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Failed to update password'
            };
        }
    };

    const deleteAccount = async ({ confirmationText, password, reason, feedback }) => {
        try {
            const token = localStorage.getItem('testnexa_token');
            const response = await axios.delete(`${API_URL}/auth/account`, {
                headers: { Authorization: `Bearer ${token}` },
                data: { confirmationText, password, reason, feedback }
            });

            if (response.data.success) {
                clearLocalAuthState();
                return { success: true };
            }
            return {
                success: false,
                message: response.data.message || 'Failed to delete account'
            };
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Failed to delete account. Please try again.'
            };
        }
    };

    return (
        <AuthContext.Provider value={{
            user,
            setUser,
            isAuthenticated,
            isLoading,
            isSigningOut,
            login,
            register,
            loginWithGoogle,
            loginWithGitHub,
            logout,
            activeSessions,
            fetchSessions,
            revokeSession,
            revokeOtherSessions,
            forgotPassword,
            resetPassword,
            updateProfile,
            changePassword,
            deleteAccount,
            checkAuth,
            currentWorkspace,
            setCurrentWorkspace,
            isLoadingWorkspace,
            refreshWorkspace: fetchCurrentWorkspace,
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
