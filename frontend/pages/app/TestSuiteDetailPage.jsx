import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useLocation, useNavigate, NavLink } from 'react-router-dom';
import { ArrowLeft, ShieldAlert, AlertCircle, RefreshCw, Layers, Lock, ShieldCheck, Share2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useHistory } from '../../hooks/useHistory';
import { sessionService, testSuiteService } from '../../services/sessionService';
import { DataLoadingState } from '../../components/loading';
import ResultsSection from '../../components/ResultsSection';

// Helper to determine if a suite object contains actual test cases
const hasTestCases = (data) => {
    if (!data || typeof data !== 'object') return false;
    const target = data.suiteData || data.suite_data || data.suite || data.data || data;
    return Boolean(
        (Array.isArray(target.testCases) && target.testCases.length > 0) ||
        (Array.isArray(target.tests) && target.tests.length > 0) ||
        (Array.isArray(target.functional) && target.functional.length > 0) ||
        (Array.isArray(target.negative) && target.negative.length > 0) ||
        (Array.isArray(target.edge) && target.edge.length > 0) ||
        (Array.isArray(target.security) && target.security.length > 0) ||
        (Array.isArray(target.nonFunctional) && target.nonFunctional.length > 0) ||
        (Array.isArray(target.apiChecklist) && target.apiChecklist.length > 0) ||
        (Array.isArray(target.api) && target.api.length > 0) ||
        (Array.isArray(data.testCases) && data.testCases.length > 0) ||
        (Array.isArray(data.tests) && data.tests.length > 0) ||
        (Array.isArray(data.functional) && data.functional.length > 0) ||
        (Array.isArray(data.negative) && data.negative.length > 0) ||
        (Array.isArray(data.edge) && data.edge.length > 0) ||
        (Array.isArray(data.security) && data.security.length > 0) ||
        (Array.isArray(data.nonFunctional) && data.nonFunctional.length > 0) ||
        (Array.isArray(data.apiChecklist) && data.apiChecklist.length > 0) ||
        (Array.isArray(data.api) && data.api.length > 0)
    );
};

const TestSuiteDetailPage = () => {
    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const { history, saveToHistory } = useHistory();

    const [remoteSession, setRemoteSession] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [retryTrigger, setRetryTrigger] = useState(0);

    // Extract potential share token from query parameters (?token=... or ?share=...)
    const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const shareToken = searchParams.get('token') || searchParams.get('share');

    // 1. Check if valid test cases passed via navigation state or found in scoped history
    // If a share token is provided, bypass local history to ensure server authorization check
    const localSuite = useMemo(() => {
        if (shareToken) {
            return null;
        }

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
            const data = historySuite.suiteData || historySuite.suite || historySuite.data || historySuite;
            return {
                ...data,
                id: id || data.id,
                testSuiteName: data.testSuiteName || data.feature || foundInHistory.title || foundInHistory.feature || 'Test Suite',
                feature: data.feature || data.testSuiteName || foundInHistory.title || foundInHistory.feature || 'Test Suite'
            };
        }

        if (foundInHistory && hasTestCases(foundInHistory)) {
            return {
                ...foundInHistory,
                id: id || foundInHistory.id
            };
        }

        return null;
    }, [id, location.state, history, shareToken]);

    // 2. Fetch session / suite details from backend
    useEffect(() => {
        if (localSuite) {
            setIsLoading(false);
            setLoadError(null);
            return;
        }

        if (!id) {
            setIsLoading(false);
            setLoadError({
                message: 'No test suite identifier provided',
                code: 'INVALID_ID',
                status: 400
            });
            return;
        }

        let isCurrent = true;

        const fetchDetails = async () => {
            setIsLoading(true);
            setLoadError(null);

            try {
                // Try sessionService first (primary WorkspaceSession store), passing shareToken
                let res = await sessionService.get(id, shareToken).catch(err => {
                    return {
                        success: false,
                        message: err.message,
                        code: err.code,
                        status: err.status
                    };
                });

                // Fallback to testSuiteService if sessionService didn't succeed
                if (!res?.success || !res?.data) {
                    const fallbackRes = await testSuiteService.get(id, shareToken).catch(err => {
                        return {
                            success: false,
                            message: err.message,
                            code: err.code,
                            status: err.status
                        };
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
                    setLoadError({
                        message: res?.message || 'Test suite not found or access denied',
                        code: res?.code || (res?.status === 401 ? 'AUTHENTICATION_REQUIRED' : res?.status === 403 ? 'ACCESS_DENIED' : 'SUITE_NOT_FOUND'),
                        status: res?.status || 404
                    });
                }
            } catch (err) {
                console.error('Failed to load test suite details:', err);
                if (isCurrent) {
                    setLoadError({
                        message: err.message || 'Unable to load test suite details',
                        code: err.code || (err.status === 401 ? 'AUTHENTICATION_REQUIRED' : err.status === 403 ? 'ACCESS_DENIED' : 'UNKNOWN_ERROR'),
                        status: err.status || 500
                    });
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
    }, [id, localSuite, retryTrigger, shareToken]);

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
            data.id = data.id || id || remoteSession.id || remoteSession._id;
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
            return {
                ...remoteSession,
                id: remoteSession.id || remoteSession._id || id
            };
        }

        // Fallback: check history directly
        const histItem = history.find(item => item.id === id || item.sessionId === id || item._id === id);
        const histSuite = histItem?.suite || histItem?.data || histItem?.suiteData;
        if (histSuite && hasTestCases(histSuite)) {
            return {
                ...histSuite,
                id: id || histItem.id
            };
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

    // ─── Loading State (Layout Preserving) ───
    if (isLoading) {
        return (
            <div style={{ padding: '1rem 0' }}>
                <DataLoadingState
                    message="Retrieving test suite specifications..."
                    telemetryTag="SUITE VERIFY"
                    skeletonType="metrics-detail"
                />
            </div>
        );
    }

    // ─── Session Exists but Suite Not Generated (Draft State) ───
    if (remoteSession && !hasTestCases(suiteData) && !loadError) {
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

    // ─── Error States (Distinguished by root cause) ───
    if (loadError || !suiteData || !hasTestCases(suiteData)) {
        const errorCode = loadError?.code || 'SUITE_NOT_FOUND';
        const errorMessage = loadError?.message || "This test suite does not exist in your workspace or you do not have permission to view it.";

        // A. Missing Authentication for private shared link
        if (errorCode === 'AUTHENTICATION_REQUIRED' || loadError?.status === 401) {
            const redirectUrl = `/login?next=${encodeURIComponent(location.pathname + location.search)}`;
            return (
                <div className="ws-empty-state" style={{ margin: '2rem auto', maxWidth: '520px' }}>
                    <div style={{
                        width: '54px',
                        height: '54px',
                        borderRadius: '12px',
                        background: 'rgba(56, 189, 248, 0.12)',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#38BDF8',
                        marginBottom: '1rem'
                    }}>
                        <Lock size={26} />
                    </div>

                    <div className="ws-empty-text-wrap" style={{ maxWidth: '460px' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#F1F5F9', marginBottom: '0.5rem' }}>
                            Authentication Required
                        </h2>
                        <p style={{ color: '#94A3B8', fontSize: '0.9rem', lineHeight: '1.5' }}>
                            This shared test suite is restricted to workspace members. Please sign in to verify your identity and view the suite.
                        </p>
                    </div>

                    <div className="ws-empty-actions" style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem' }}>
                        <NavLink to={redirectUrl} className="ws-btn-primary">
                            <span>Sign In to Access Suite &rarr;</span>
                        </NavLink>
                        <NavLink to="/app/test-suites" className="ws-btn-secondary">
                            <ArrowLeft size={16} />
                            <span>Browse Workspace</span>
                        </NavLink>
                    </div>
                </div>
            );
        }

        // B. Revoked or Expired Share Link
        if (errorCode === 'SHARE_REVOKED') {
            return (
                <div className="ws-empty-state" style={{ margin: '2rem auto', maxWidth: '520px' }}>
                    <div style={{
                        width: '54px',
                        height: '54px',
                        borderRadius: '12px',
                        background: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#EF4444',
                        marginBottom: '1rem'
                    }}>
                        <ShieldAlert size={26} />
                    </div>

                    <div className="ws-empty-text-wrap" style={{ maxWidth: '460px' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#F1F5F9', marginBottom: '0.5rem' }}>
                            Share Link Revoked
                        </h2>
                        <p style={{ color: '#94A3B8', fontSize: '0.9rem', lineHeight: '1.5' }}>
                            The link to this test suite has been revoked or expired by its owner. Please request a new share link from the suite owner.
                        </p>
                    </div>

                    <div className="ws-empty-actions" style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem' }}>
                        <NavLink to="/app/test-suites" className="ws-btn-secondary">
                            <ArrowLeft size={16} />
                            <span>Return to Test Suites</span>
                        </NavLink>
                        <NavLink to="/app/workspace" className="ws-btn-secondary">
                            <span>AI Workspace</span>
                        </NavLink>
                    </div>
                </div>
            );
        }

        // C. Access Denied (Private suite without token or missing membership)
        if (errorCode === 'ACCESS_DENIED' || loadError?.status === 403) {
            return (
                <div className="ws-empty-state" style={{ margin: '2rem auto', maxWidth: '520px' }}>
                    <div style={{
                        width: '54px',
                        height: '54px',
                        borderRadius: '12px',
                        background: 'rgba(234, 179, 8, 0.12)',
                        border: '1px solid rgba(234, 179, 8, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#EAB308',
                        marginBottom: '1rem'
                    }}>
                        <ShieldAlert size={26} />
                    </div>

                    <div className="ws-empty-text-wrap" style={{ maxWidth: '460px' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#F1F5F9', marginBottom: '0.5rem' }}>
                            Access Denied
                        </h2>
                        <p style={{ color: '#94A3B8', fontSize: '0.9rem', lineHeight: '1.5' }}>
                            {errorMessage}
                        </p>
                    </div>

                    <div className="ws-empty-actions" style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem' }}>
                        <button type="button" onClick={handleRetry} className="ws-btn-primary">
                            <RefreshCw size={15} />
                            <span>Try Again</span>
                        </button>
                        <NavLink to="/app/test-suites" className="ws-btn-secondary">
                            <ArrowLeft size={16} />
                            <span>All Test Suites</span>
                        </NavLink>
                    </div>
                </div>
            );
        }

        // D. Default 404 Suite Not Found
        return (
            <div className="ws-empty-state" style={{ margin: '2rem auto', maxWidth: '520px' }}>
                <div style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '12px',
                    background: 'rgba(224, 108, 117, 0.12)',
                    border: '1px solid rgba(224, 108, 117, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#E06C75',
                    marginBottom: '1rem'
                }}>
                    <AlertCircle size={26} />
                </div>

                <div className="ws-empty-text-wrap" style={{ maxWidth: '440px' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#F1F5F9', marginBottom: '0.5rem' }}>
                        Test Suite Not Found
                    </h2>
                    <p style={{ color: '#94A3B8', fontSize: '0.9rem', lineHeight: '1.5' }}>
                        {errorMessage}
                    </p>
                </div>

                <div className="ws-empty-actions" style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem' }}>
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

    const assignedRole = remoteSession?.accessRole || (remoteSession?.isShared ? 'viewer' : 'owner');
    const isSharedSuite = Boolean(remoteSession?.isShared);

    // ─── Loaded Test Suite View ───
    return (
        <div className="test-suite-detail-page">
            {/* Shared Access Banner */}
            {isSharedSuite && (
                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    padding: '0.75rem 1.25rem',
                    marginBottom: '1.25rem',
                    borderRadius: '8px',
                    background: 'rgba(56, 189, 248, 0.08)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    color: '#E0E7FF',
                    fontSize: '0.85rem'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: 'rgba(56, 189, 248, 0.2)',
                            color: '#38BDF8',
                            fontWeight: 600,
                            fontSize: '0.75rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                        }}>
                            <Share2 size={12} />
                            Shared: {assignedRole}
                        </span>
                        <span style={{ color: '#CBD5E1' }}>
                            {assignedRole === 'viewer' && 'You are viewing this test suite with read-only permissions.'}
                            {assignedRole === 'reviewer' && 'You have permission to review, comment, and approve test cases.'}
                            {assignedRole === 'editor' && 'You have editor access to update this test suite.'}
                        </span>
                    </div>

                    {!isAuthenticated && (
                        <NavLink
                            to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
                            style={{
                                color: '#38BDF8',
                                textDecoration: 'underline',
                                fontSize: '0.82rem',
                                fontWeight: 500
                            }}
                        >
                            Sign in to save to your personal workspace &rarr;
                        </NavLink>
                    )}
                </div>
            )}

            <ResultsSection
                result={suiteData}
                suiteId={id || remoteSession?.id}
                accessRole={assignedRole}
                isShared={isSharedSuite}
                onSave={() => handleSave(suiteData)}
                isLatest={true}
            />
        </div>
    );
};

export default TestSuiteDetailPage;
