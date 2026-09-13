import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useLocation, useNavigate, NavLink } from 'react-router-dom';
import { Loader2, ArrowLeft, ShieldAlert, AlertCircle } from 'lucide-react';
import { useHistory } from '../../hooks/useHistory';
import { sessionService } from '../../services/sessionService';
import ResultsSection from '../../components/ResultsSection';

const TestSuiteDetailPage = () => {
    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { history, saveToHistory } = useHistory();

    const [remoteSession, setRemoteSession] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState(null);

    // 1. Check if passed via navigation state or found in user's scoped history
    const localSuite = useMemo(() => {
        if (location.state?.suite) {
            return location.state.suite;
        }

        const foundInHistory = history.find(item =>
            item.id === id ||
            item.sessionId === id
        );
        if (foundInHistory?.suite) {
            return foundInHistory.suite;
        }

        return null;
    }, [id, location.state, history]);

    // 2. If not found locally and valid id, fetch session from backend sessionService
    useEffect(() => {
        if (localSuite) return;
        if (!id) return;

        let isMounted = true;
        const fetchRemoteSession = async () => {
            setIsLoading(true);
            setLoadError(null);
            try {
                const res = await sessionService.get(id);
                if (isMounted && res.success && res.data) {
                    setRemoteSession(res.data);
                } else if (isMounted) {
                    setLoadError('Test suite not found or access denied');
                }
            } catch (err) {
                console.warn('Could not load remote session for suite detail:', err);
                if (isMounted) setLoadError(err.message || 'Failed to load test suite');
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchRemoteSession();
        return () => { isMounted = false; };
    }, [id, localSuite]);

    const suiteData = useMemo(() => {
        if (localSuite) {
            return localSuite;
        }

        if (remoteSession?.suiteData) {
            const data = { ...remoteSession.suiteData };
            if (!data.testSuiteName && remoteSession.title) {
                data.testSuiteName = remoteSession.title;
            }
            if (!data.feature && remoteSession.title) {
                data.feature = remoteSession.title;
            }
            return data;
        }

        return null;
    }, [localSuite, remoteSession]);

    const promptText = location.state?.prompt ||
        remoteSession?.requirement ||
        history.find(item => item.id === id)?.requirement ||
        '';

    const handleSave = (suite) => {
        if (!suite) return;
        saveToHistory(suite, promptText, { type: remoteSession?.context || 'web', level: remoteSession?.depth || 'Standard' });
        alert('Test suite saved to history!');
    };

    if (isLoading) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '60vh',
                gap: '1rem',
                color: '#A3A3A3'
            }}>
                <Loader2 size={32} className="animate-spin" style={{ color: '#00D9C0' }} />
                <span style={{ fontSize: '0.92rem', fontWeight: '500' }}>Loading test suite...</span>
            </div>
        );
    }

    // Suite Not Found or Access Denied state (No demo data fallback!)
    if (!suiteData) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                minHeight: '55vh',
                padding: '3rem 1.5rem',
                background: '#0A0A0A',
                borderRadius: '14px',
                border: '1px solid #1C1C1C',
                gap: '1.25rem',
                margin: '1rem 0'
            }}>
                <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '14px',
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#EF4444'
                }}>
                    <ShieldAlert size={28} />
                </div>

                <div style={{ maxWidth: '440px' }}>
                    <h2 style={{ fontSize: '1.3rem', fontWeight: '700', color: '#F5F5F5', margin: '0 0 0.5rem' }}>
                        Test Suite Not Found
                    </h2>
                    <p style={{ fontSize: '0.9rem', color: '#737373', lineHeight: '1.5', margin: 0 }}>
                        {loadError || "This test suite does not exist in your workspace or you do not have permission to view it."}
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <NavLink
                        to="/app/test-suites"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.45rem',
                            padding: '0.65rem 1.25rem',
                            borderRadius: '8px',
                            background: '#00D9C0',
                            color: '#0A0A0A',
                            fontSize: '0.88rem',
                            textDecoration: 'none',
                            fontWeight: '600'
                        }}
                    >
                        <ArrowLeft size={16} />
                        <span>All Test Suites</span>
                    </NavLink>

                    <NavLink
                        to="/app/workspace"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.45rem',
                            padding: '0.65rem 1.25rem',
                            borderRadius: '8px',
                            border: '1px solid #262626',
                            background: '#121212',
                            color: '#F5F5F5',
                            fontSize: '0.88rem',
                            textDecoration: 'none',
                            fontWeight: '500'
                        }}
                    >
                        <span>Open AI Workspace</span>
                    </NavLink>
                </div>
            </div>
        );
    }

    return (
        <div className="test-suite-detail-page">
            <ResultsSection
                result={suiteData}
                onSave={() => handleSave(suiteData)}
                isLatest={true}
            />
        </div>
    );
};

export default TestSuiteDetailPage;
