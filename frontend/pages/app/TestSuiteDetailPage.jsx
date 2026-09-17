import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useLocation, useNavigate, NavLink } from 'react-router-dom';
import { Loader2, ArrowLeft, ShieldAlert, AlertCircle, RefreshCw, Layers } from 'lucide-react';
import { useHistory } from '../../hooks/useHistory';
import { sessionService, testSuiteService } from '../../services/sessionService';
import ResultsSection from '../../components/ResultsSection';

// Helper to determine if a suite object contains actual test cases
const hasTestCases = (data) => {
    if (!data || typeof data !== 'object') return false;
    return Boolean(
        (Array.isArray(data.functional) && data.functional.length > 0) ||
        (Array.isArray(data.negative) && data.negative.length > 0) ||
        (Array.isArray(data.edge) && data.edge.length > 0) ||
        (Array.isArray(data.nonFunctional) && data.nonFunctional.length > 0) ||
        (Array.isArray(data.apiChecklist) && data.apiChecklist.length > 0) ||
        (Array.isArray(data.api) && data.api.length > 0) ||
        (Array.isArray(data.testCases) && data.testCases.length > 0)
    );
};

const TestSuiteDetailPage = () => {
    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { history, saveToHistory } = useHistory();

    const [remoteSession, setRemoteSession] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [retryTrigger, setRetryTrigger] = useState(0);

    // 1. Check if valid test cases passed via navigation state or found in scoped history
    const localSuite = useMemo(() => {
        if (location.state?.suite && hasTestCases(location.state.suite)) {
            return location.state.suite;
        }

        const foundInHistory = history.find(item =>
            item.id === id ||
            item.sessionId === id
        );
        if (foundInHistory?.suite && hasTestCases(foundInHistory.suite)) {
            return foundInHistory.suite;
        }

        return null;
    }, [id, location.state, history]);

    // 2. Fetch session / suite details from backend
    useEffect(() => {
        if (localSuite) {
            setIsLoading(false);
            setLoadError(null);
            return;
        }

        if (!id) {
            setIsLoading(false);
            setLoadError('No test suite identifier provided');
            return;
        }

        let isCurrent = true;

        const fetchDetails = async () => {
            setIsLoading(true);
            setLoadError(null);

            try {
                // Try sessionService first (primary WorkspaceSession store)
                let res = await sessionService.get(id).catch(err => {
                    console.warn('sessionService.get error:', err.message);
                    return null;
                });

                // Fallback to testSuiteService if sessionService didn't succeed
                if (!res?.success || !res?.data) {
                    const fallbackRes = await testSuiteService.get(id).catch(err => {
                        console.warn('testSuiteService.get fallback error:', err.message);
                        return null;
                    });
                    if (fallbackRes?.success && fallbackRes?.data) {
                        res = fallbackRes;
                    }
                }

                if (!isCurrent) return;

                if (res?.success && res?.data) {
                    setRemoteSession(res.data);
                    setLoadError(null);
                } else {
                    setLoadError(res?.message || 'Test suite not found or access denied');
                }
            } catch (err) {
                console.error('Failed to load test suite details:', err);
                if (isCurrent) {
                    setLoadError(err.message || 'Unable to load test suite details');
                }
            } finally {
                if (isCurrent) {
                    setIsLoading(false);
                }
            }
        };

        fetchDetails();

        return () => {
            isCurrent = false;
        };
    }, [id, localSuite, retryTrigger]);

    // 3. Resolve the full suite data structure
    const suiteData = useMemo(() => {
        if (localSuite && hasTestCases(localSuite)) {
            return localSuite;
        }

        const candidate = remoteSession?.suiteData ||
            remoteSession?.suite_data ||
            remoteSession?.suite;

        if (candidate && typeof candidate === 'object') {
            const data = { ...candidate };
            if (!data.testSuiteName && remoteSession.title) {
                data.testSuiteName = remoteSession.title;
            }
            if (!data.feature && remoteSession.title) {
                data.feature = remoteSession.title;
            }
            return data;
        }

        if (hasTestCases(remoteSession)) {
            return remoteSession;
        }

        return null;
    }, [localSuite, remoteSession]);

    const promptText = location.state?.prompt ||
        remoteSession?.requirement ||
        remoteSession?.rawRequirement ||
        history.find(item => item.id === id)?.requirement ||
        '';

    const handleSave = (suite) => {
        if (!suite) return;
        saveToHistory(suite, promptText, {
            type: remoteSession?.context || 'web',
            level: remoteSession?.depth || 'Standard'
        });
        alert('Test suite saved to history!');
    };

    const handleRetry = useCallback(() => {
        setRetryTrigger(prev => prev + 1);
    }, []);

    // ─── Loading State ───
    if (isLoading) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '60vh',
                gap: '1.25rem',
                color: '#A3A3A3',
                textAlign: 'center',
                padding: '2rem'
            }}>
                <Loader2 size={36} className="animate-spin" style={{ color: '#00D9C0' }} />
                <div>
                    <div style={{ fontSize: '1rem', fontWeight: '600', color: '#F5F5F5', marginBottom: '0.35rem' }}>
                        Loading Test Suite
                    </div>
                    <span style={{ fontSize: '0.85rem', color: '#737373' }}>
                        Fetching test cases, coverage specifications, and verification rules...
                    </span>
                </div>
            </div>
        );
    }

    // ─── Session Exists but Suite Not Generated (Draft State) ───
    if (remoteSession && !hasTestCases(suiteData)) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                minHeight: '55vh',
                padding: '3.5rem 1.5rem',
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
                    background: 'rgba(0, 217, 192, 0.08)',
                    border: '1px solid rgba(0, 217, 192, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#00D9C0'
                }}>
                    <Layers size={28} />
                </div>

                <div style={{ maxWidth: '460px' }}>
                    <h2 style={{ fontSize: '1.3rem', fontWeight: '600', color: '#F5F5F5', margin: '0 0 0.5rem' }}>
                        {remoteSession.title || 'Requirement Specification'}
                    </h2>
                    <p style={{ fontSize: '0.9rem', color: '#A3A3A3', lineHeight: '1.5', margin: 0 }}>
                        This requirement has been saved to your workspace, but test cases have not been generated yet.
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <NavLink
                        to={`/app/workspace/${remoteSession.id || remoteSession._id || id}`}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.7rem 1.35rem',
                            borderRadius: '8px',
                            background: '#00D9C0',
                            color: '#0A0A0A',
                            fontSize: '0.88rem',
                            textDecoration: 'none',
                            fontWeight: '600'
                        }}
                    >
                        <span>Generate in AI Workspace &rarr;</span>
                    </NavLink>

                    <NavLink
                        to="/app/test-suites"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.45rem',
                            padding: '0.7rem 1.25rem',
                            borderRadius: '8px',
                            border: '1px solid #262626',
                            background: '#121212',
                            color: '#F5F5F5',
                            fontSize: '0.88rem',
                            textDecoration: 'none',
                            fontWeight: '500'
                        }}
                    >
                        <ArrowLeft size={16} />
                        <span>All Test Suites</span>
                    </NavLink>
                </div>
            </div>
        );
    }

    // ─── Suite Not Found / Error State ───
    if (!suiteData || !hasTestCases(suiteData)) {
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
                    <h2 style={{ fontSize: '1.3rem', fontWeight: '600', color: '#F5F5F5', margin: '0 0 0.5rem' }}>
                        Test Suite Not Found
                    </h2>
                    <p style={{ fontSize: '0.9rem', color: '#737373', lineHeight: '1.5', margin: 0 }}>
                        {loadError || "This test suite does not exist in your workspace or you do not have permission to view it."}
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button
                        type="button"
                        onClick={handleRetry}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.45rem',
                            padding: '0.65rem 1.25rem',
                            borderRadius: '8px',
                            background: '#00D9C0',
                            color: '#0A0A0A',
                            fontSize: '0.88rem',
                            fontWeight: '600',
                            border: 'none',
                            cursor: 'pointer'
                        }}
                    >
                        <RefreshCw size={15} />
                        <span>Try Again</span>
                    </button>

                    <NavLink
                        to="/app/test-suites"
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
                        <span>AI Workspace</span>
                    </NavLink>
                </div>
            </div>
        );
    }

    // ─── Loaded Test Suite View ───
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
