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
        (Array.isArray(data.security) && data.security.length > 0) ||
        (Array.isArray(data.nonFunctional) && data.nonFunctional.length > 0) ||
        (Array.isArray(data.apiChecklist) && data.apiChecklist.length > 0) ||
        (Array.isArray(data.api) && data.api.length > 0) ||
        (Array.isArray(data.tests) && data.tests.length > 0) ||
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
            item.sessionId === id ||
            item._id === id
        );
        const historySuite = foundInHistory?.suite || foundInHistory?.data || foundInHistory?.suiteData;
        if (historySuite && hasTestCases(historySuite)) {
            return historySuite;
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
            remoteSession?.suite ||
            remoteSession?.data;

        if (candidate && typeof candidate === 'object') {
            const data = { ...candidate };
            if (!data.testSuiteName && remoteSession.title) {
                data.testSuiteName = remoteSession.title;
            }
            if (!data.feature && remoteSession.title) {
                data.feature = remoteSession.title;
            }
            if (hasTestCases(data)) {
                return data;
            }
        }

        if (hasTestCases(remoteSession)) {
            return remoteSession;
        }

        // Fallback: check history directly
        const histItem = history.find(item => item.id === id || item.sessionId === id || item._id === id);
        const histSuite = histItem?.suite || histItem?.data || histItem?.suiteData;
        if (histSuite && hasTestCases(histSuite)) {
            return histSuite;
        }

        return null;
    }, [localSuite, remoteSession, id, history]);

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
                color: '#A0A5A5',
                textAlign: 'center',
                padding: '2rem'
            }}>
                <Loader2 size={36} className="animate-spin" style={{ color: '#8BAF9A' }} />
                <div>
                    <div style={{ fontSize: '1rem', fontWeight: '600', color: '#F2F3F3', marginBottom: '0.35rem' }}>
                        Loading Test Suite
                    </div>
                    <span style={{ fontSize: '0.85rem', color: '#777E7E' }}>
                        Fetching test cases, coverage specifications, and verification rules...
                    </span>
                </div>
            </div>
        );
    }

    // ─── Session Exists but Suite Not Generated (Draft State) ───
    if (remoteSession && !hasTestCases(suiteData)) {
        return (
            <div className="ws-empty-state" style={{ margin: '1rem 0' }}>
                <div className="ws-empty-icon-wrap">
                    <Layers size={28} />
                </div>

                <div className="ws-empty-text-wrap" style={{ maxWidth: '460px' }}>
                    <h2>
                        {remoteSession.title || 'Requirement Specification'}
                    </h2>
                    <p>
                        This requirement has been saved to your workspace, but test cases have not been generated yet.
                    </p>
                </div>

                <div className="ws-empty-actions">
                    <NavLink
                        to={`/app/workspace/${remoteSession.id || remoteSession._id || id}`}
                        className="ws-btn-primary"
                    >
                        <span>Generate in AI Workspace &rarr;</span>
                    </NavLink>

                    <NavLink
                        to="/app/test-suites"
                        className="ws-btn-secondary"
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
            <div className="ws-empty-state" style={{ margin: '1rem 0' }}>
                <div style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '10px',
                    background: 'rgba(224, 108, 117, 0.1)',
                    border: '1px solid rgba(224, 108, 117, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#E06C75'
                }}>
                    <ShieldAlert size={28} />
                </div>

                <div className="ws-empty-text-wrap" style={{ maxWidth: '440px' }}>
                    <h2>Test Suite Not Found</h2>
                    <p>
                        {loadError || "This test suite does not exist in your workspace or you do not have permission to view it."}
                    </p>
                </div>

                <div className="ws-empty-actions">
                    <button
                        type="button"
                        onClick={handleRetry}
                        className="ws-btn-primary"
                    >
                        <RefreshCw size={15} />
                        <span>Try Again</span>
                    </button>

                    <NavLink
                        to="/app/test-suites"
                        className="ws-btn-secondary"
                    >
                        <ArrowLeft size={16} />
                        <span>All Test Suites</span>
                    </NavLink>

                    <NavLink
                        to="/app/workspace"
                        className="ws-btn-secondary"
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
