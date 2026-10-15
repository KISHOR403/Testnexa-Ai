import React from 'react';
import { AlertTriangle, RefreshCw, Home, ArrowLeft } from 'lucide-react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('TestNexa UI ErrorBoundary caught error:', error, errorInfo);
    }

    handleReload = () => {
        window.location.reload();
    };

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    minHeight: '60vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2.5rem 1.5rem',
                    textAlign: 'center',
                    background: '#080909',
                    color: '#F2F3F3'
                }}>
                    <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '12px',
                        background: 'rgba(224, 108, 117, 0.12)',
                        border: '1px solid rgba(224, 108, 117, 0.28)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#E06C75',
                        marginBottom: '1.25rem'
                    }}>
                        <AlertTriangle size={28} />
                    </div>

                    <h2 style={{
                        fontSize: '1.25rem',
                        fontWeight: '600',
                        color: '#F2F3F3',
                        margin: '0 0 0.5rem 0'
                    }}>
                        Something went wrong displaying this view
                    </h2>

                    <p style={{
                        fontSize: '0.85rem',
                        color: '#A0A5A5',
                        maxWidth: '480px',
                        lineHeight: 1.5,
                        margin: '0 0 1.5rem 0'
                    }}>
                        {this.state.error?.message || 'An unexpected rendering error occurred. The application state has been preserved.'}
                    </p>

                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                        <button
                            type="button"
                            onClick={this.handleReload}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '0.65rem 1.15rem',
                                borderRadius: '6px',
                                background: '#8BAF9A',
                                color: '#080909',
                                border: '1px solid #8BAF9A',
                                fontWeight: '600',
                                fontSize: '0.82rem',
                                cursor: 'pointer'
                            }}
                        >
                            <RefreshCw size={14} />
                            <span>Reload Page</span>
                        </button>

                        <a
                            href="/app/workspace"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '0.65rem 1.15rem',
                                borderRadius: '6px',
                                background: '#161819',
                                color: '#F2F3F3',
                                border: '1px solid #292D2D',
                                fontWeight: '500',
                                fontSize: '0.82rem',
                                textDecoration: 'none'
                            }}
                        >
                            <Home size={14} />
                            <span>AI Workspace</span>
                        </a>

                        <a
                            href="/app/test-suites"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '0.65rem 1.15rem',
                                borderRadius: '6px',
                                background: '#161819',
                                color: '#F2F3F3',
                                border: '1px solid #292D2D',
                                fontWeight: '500',
                                fontSize: '0.82rem',
                                textDecoration: 'none'
                            }}
                        >
                            <ArrowLeft size={14} />
                            <span>All Suites</span>
                        </a>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
