import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, LayoutDashboard, Compass } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import useWorkspaceEntry from '../hooks/useWorkspaceEntry';

const NotFoundPage = () => {
    const { isAuthenticated } = useAuth();
    const { handleWorkspaceEntry, getTargetUrl } = useWorkspaceEntry();

    return (
        <main
            className="tn-404-page"
            style={{
                minHeight: '80vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '120px 24px 80px 24px',
                background: '#050505',
                color: '#F5F5F5'
            }}
        >
            <div
                style={{
                    maxWidth: '540px',
                    width: '100%',
                    textAlign: 'center',
                    background: '#0A0A0A',
                    border: '1px solid #1C1C1C',
                    borderRadius: '16px',
                    padding: '48px 32px',
                    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)'
                }}
            >
                {/* 404 Badge */}
                <div
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 14px',
                        borderRadius: '20px',
                        background: 'rgba(0, 217, 192, 0.08)',
                        border: '1px solid rgba(0, 217, 192, 0.25)',
                        color: '#00D9C0',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        letterSpacing: '0.5px',
                        marginBottom: '20px'
                    }}
                >
                    <Compass size={16} aria-hidden="true" />
                    <span>ERROR 404</span>
                </div>

                <h1
                    style={{
                        fontSize: '2rem',
                        fontWeight: 700,
                        color: '#F5F5F5',
                        margin: '0 0 12px 0',
                        letterSpacing: '-0.5px'
                    }}
                >
                    This page doesn&apos;t exist.
                </h1>

                <p
                    style={{
                        fontSize: '0.96rem',
                        color: '#A3A3A3',
                        lineHeight: '1.6',
                        margin: '0 0 32px 0'
                    }}
                >
                    The page you&apos;re looking for may have been moved, removed, or the link may be outdated.
                </p>

                {/* CTAs */}
                <div
                    style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        justifyContent: 'center',
                        gap: '12px'
                    }}
                >
                    <Link
                        to="/"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: '#F5F5F5',
                            color: '#050505',
                            height: '44px',
                            padding: '0 20px',
                            borderRadius: '6px',
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            textDecoration: 'none',
                            transition: 'background-color 0.15s ease'
                        }}
                    >
                        <ArrowLeft size={16} />
                        <span>Back to TestNexa</span>
                    </Link>

                    {isAuthenticated && (
                        <a
                            href={getTargetUrl('/app/workspace')}
                            onClick={(e) => {
                                e.preventDefault();
                                handleWorkspaceEntry('/app/workspace');
                            }}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: 'transparent',
                                color: '#F5F5F5',
                                border: '1px solid #2A2A2A',
                                height: '44px',
                                padding: '0 20px',
                                borderRadius: '6px',
                                fontSize: '0.9rem',
                                fontWeight: 500,
                                textDecoration: 'none'
                            }}
                        >
                            <LayoutDashboard size={16} />
                            <span>Go to Workspace</span>
                        </a>
                    )}
                </div>
            </div>
        </main>
    );
};

export default NotFoundPage;
