import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, isLoading } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                backgroundColor: '#0D0E12',
                color: '#9CA3AF',
                fontFamily: 'Inter, system-ui, sans-serif'
            }}>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '1rem'
                }}>
                    <div style={{
                        width: '36px',
                        height: '36px',
                        border: '3px solid rgba(79, 140, 255, 0.15)',
                        borderTop: '3px solid #4F8CFF',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite'
                    }} />
                    <span style={{ fontSize: '0.9rem', letterSpacing: '0.02em' }}>
                        Authenticating workspace…
                    </span>
                    <style>{`
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                    `}</style>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        const targetPath = location.pathname + location.search;
        return (
            <Navigate
                to={`/login?returnTo=${encodeURIComponent(targetPath)}`}
                state={{ from: location }}
                replace
            />
        );
    }

    return children;
};

export default ProtectedRoute;
