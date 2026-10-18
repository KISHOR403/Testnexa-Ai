import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import TestSignalIndicator from './loading/TestSignalIndicator';

const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, isLoading } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return (
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '100vh',
                    backgroundColor: '#080909',
                    color: '#A0A5A5',
                    fontFamily: 'Inter, system-ui, sans-serif'
                }}
                role="status"
                aria-live="polite"
            >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
                    <TestSignalIndicator size="md" ariaLabel="Authenticating workspace" />
                    <span style={{ fontSize: '0.875rem', letterSpacing: '0.04em', color: '#A0A5A5', fontFamily: 'var(--ts-mono, monospace)' }}>
                        Authenticating workspace…
                    </span>
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
