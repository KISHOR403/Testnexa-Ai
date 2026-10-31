import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useLocation, NavLink, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldAlert, AlertCircle, RefreshCw, Layers, Lock, ShieldCheck, Share2, Plus, Play, Archive, Pencil, ExternalLink, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useHistory } from '../../hooks/useHistory';
import { sessionService, testSuiteService } from '../../services/sessionService';
import { DataLoadingState } from '../../components/loading';
import ResultsSection from '../../components/ResultsSection';
import NewTestRunModal from '../../components/execution/NewTestRunModal';
import { executionService } from '../../services/executionService';
import '../../styles/app/TestSuitesManagement.css';

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
const suiteCasesCount = (data) => {
    if (!data) return 0;
    const target = data.suiteData || data.suite_data || data.suite || data.data || data;
    const keys = ['testCases', 'tests', 'functional', 'negative', 'edge', 'security', 'nonFunctional', 'apiChecklist', 'api'];
    const seen = new Set();
    return keys.flatMap(key => Array.isArray(target[key]) ? target[key] : []).filter((item, index) => {
        if (!item || typeof item !== 'object') return false;
        const id = String(item.id || item.testCaseId || `${item.title || item.testScenario || 'case'}-${index}`);
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
    }).length;
};
const SUITE_CASE_KEYS = ['testCases', 'tests', 'functional', 'negative', 'edge', 'security', 'nonFunctional', 'apiChecklist', 'api'];
const getRecordSuiteData = (record) => {
    const value = record?.suiteData || record?.suite_data || record?.suite || record?.data || {};
    return value?.suiteData || value?.suite_data || value?.data || value;
};
const getSuiteCaseRecords = (data) => {
    if (Array.isArray(data?.testCases) && data.testCases.length) return data.testCases;
    if (Array.isArray(data?.tests) && data.tests.length) return data.tests;
    return SUITE_CASE_KEYS.slice(2).flatMap(key => Array.isArray(data?.[key]) ? data[key] : []);
};
const mappingKey = (ref) => `${ref.sourceSuiteId}:${ref.testCaseId}`;
const runResultSummary = (run) => {
    const summary = run.summary || {};
    const values = [
        ['Passed', summary.passed ?? summary.pass], ['Failed', summary.failed ?? summary.fail],
        ['Blocked', summary.blocked], ['Skipped', summary.skipped]
    ].filter(([, value]) => Number.isFinite(Number(value)) && value !== null && value !== undefined);
    return values.length ? values.map(([label, value]) => `${label} ${Number(value)}`).join(' · ') : 'Counts not recorded';
};
const formatRunDuration = (run) => {
    const duration = Number(run.durationMs ?? run.duration_ms ?? run.summary?.durationMs ?? run.summary?.duration_ms);
    if (!Number.isFinite(duration) || duration < 0) return 'Not recorded';
    if (duration < 1000) return `${duration} ms`;
    const seconds = Math.floor(duration / 1000);
    return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
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
    const [suiteRuns, setSuiteRuns] = useState([]);
    const [suiteRunsLoading, setSuiteRunsLoading] = useState(true);
    const [suiteRunsError, setSuiteRunsError] = useState('');
    const [runModalOpen, setRunModalOpen] = useState(false);
    const [suiteEditOpen, setSuiteEditOpen] = useState(false);
    const [suiteEditForm, setSuiteEditForm] = useState({ title: '', description: '', projectName: '' });
    const [suiteEditError, setSuiteEditError] = useState('');
    const [suiteEditSaving, setSuiteEditSaving] = useState(false);
    const [caseSourceSessions, setCaseSourceSessions] = useState([]);
    const [caseMappingOpen, setCaseMappingOpen] = useState(false);
    const [caseMappingSearch, setCaseMappingSearch] = useState('');
    const [caseMappingSelection, setCaseMappingSelection] = useState(new Set());
    const [caseMappingError, setCaseMappingError] = useState('');
    const [caseMappingSaving, setCaseMappingSaving] = useState(false);
    const [caseSourceLoading, setCaseSourceLoading] = useState(false);

    // Extract potential share token from query parameters (?token=... or ?share=...)
    const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const shareToken = searchParams.get('token') || searchParams.get('share');
    const requestedTestCaseId = searchParams.get('testCaseId');
    const requestedExecute = searchParams.get('execute') === '1';

    useEffect(() => {
        let current = true;
        const loadSuiteRuns = async () => {
            setSuiteRunsLoading(true);
            try {
                const first = await executionService.listRuns({ page: 1, limit: 100, sort: 'newest' });
                if (!first?.success) throw new Error(first?.message || 'Execution history could not be loaded.');
                const allRuns = [...(first.data || [])];
                for (let currentPage = 2; currentPage <= Number(first.pagination?.totalPages || 1); currentPage += 1) {
                    const response = await executionService.listRuns({ page: currentPage, limit: 100, sort: 'newest' });
                    if (!response?.success) throw new Error(response?.message || 'Additional execution history could not be loaded.');
                    allRuns.push(...(response.data || []));
                }
                if (!current) return;
                const matching = allRuns.filter(run => String(run.suiteId || run.suite_id || '') === String(id));
                setSuiteRuns(matching);
                setSuiteRunsError('');
            } catch (error) {
            if (current) { setSuiteRuns([]); setSuiteRunsError(error.message || 'Execution history could not be loaded.'); }
            } finally {
                if (current) setSuiteRunsLoading(false);
            }
        };
        loadSuiteRuns();
        return () => { current = false; };
    }, [id]);

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
    const rawSuiteData = useMemo(() => {
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
            if (hasTestCases(data) || data.managedSuite === true) {
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

    const suiteData = useMemo(() => {
        if (!rawSuiteData) return null;
        const sourceById = new Map(caseSourceSessions.map(session => [String(session.id || session._id || ''), session]));
        const directCases = getSuiteCaseRecords(rawSuiteData);
        const knownIds = new Set(directCases.map(testCase => String(testCase.id || testCase.testCaseId || '')).filter(Boolean));
        const referencedCases = (Array.isArray(rawSuiteData.testCaseRefs) ? rawSuiteData.testCaseRefs : []).flatMap(ref => {
            const source = sourceById.get(String(ref.sourceSuiteId || ''));
            if (!source) return [];
            const sourceCase = getSuiteCaseRecords(getRecordSuiteData(source)).find(testCase => String(testCase.id || testCase.testCaseId || '') === String(ref.testCaseId || ''));
            if (!sourceCase || knownIds.has(String(ref.testCaseId))) return [];
            knownIds.add(String(ref.testCaseId));
            return [{ ...sourceCase, _suiteCaseRef: true, _sourceSuiteId: String(ref.sourceSuiteId), _sourceSuiteName: source.title || source.feature || 'Test suite' }];
        });
        return referencedCases.length ? { ...rawSuiteData, testCases: [...directCases, ...referencedCases] } : rawSuiteData;
    }, [rawSuiteData, caseSourceSessions]);

    const caseCandidates = useMemo(() => {
        const directIds = new Set(getSuiteCaseRecords(rawSuiteData).map(testCase => String(testCase.id || testCase.testCaseId || '')).filter(Boolean));
        const seen = new Set(directIds);
        return caseSourceSessions.flatMap(source => {
            const sourceId = String(source.id || source._id || '');
            if (!sourceId || sourceId === String(id)) return [];
            const sourceData = getRecordSuiteData(source);
            const sourceName = source.title || source.feature || sourceData.testSuiteName || 'Test suite';
            return getSuiteCaseRecords(sourceData).flatMap(testCase => {
                const testCaseId = String(testCase.id || testCase.testCaseId || '');
                if (!testCaseId || seen.has(testCaseId)) return [];
                seen.add(testCaseId);
                return [{ key: `${sourceId}:${testCaseId}`, sourceSuiteId: sourceId, sourceSuiteName: sourceName, testCaseId, title: testCase.title || testCase.testScenario || testCase.scenario || 'Untitled test case', type: testCase.type || 'Functional', priority: testCase.priority || 'Medium', requirementId: testCase.requirementId || testCase.reqId || '' }];
            });
        });
    }, [caseSourceSessions, rawSuiteData, id]);
    const filteredCaseCandidates = useMemo(() => {
        const text = caseMappingSearch.trim().toLowerCase();
        return caseCandidates.filter(testCase => !text || `${testCase.testCaseId} ${testCase.title} ${testCase.sourceSuiteName} ${testCase.type}`.toLowerCase().includes(text));
    }, [caseCandidates, caseMappingSearch]);

    useEffect(() => {
        if (rawSuiteData?.testCaseRefs?.length && !caseSourceSessions.length) loadCaseSources();
    }, [rawSuiteData?.testCaseRefs?.length, caseSourceSessions.length, loadCaseSources]);

    const caseMappingDialog = caseMappingOpen && createPortal(<div className="sm-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !caseMappingSaving) setCaseMappingOpen(false); }}><section className="sm-modal sm-mapping-modal" role="dialog" aria-modal="true" aria-labelledby="sm-mapping-title">
        <header><div><div className="sm-eyebrow">Suite membership</div><h2 id="sm-mapping-title">Map existing test cases</h2></div><button type="button" aria-label="Close" onClick={() => setCaseMappingOpen(false)} disabled={caseMappingSaving}>×</button></header>
        <div className="sm-mapping-body"><p>Cases remain stored in their original suites. Select cases to link them here; removing a selection only removes this suite mapping.</p>
            <label className="sm-search"><Search size={15} /><input aria-label="Search available test cases" placeholder="Search by ID, title or source suite" value={caseMappingSearch} onChange={event => setCaseMappingSearch(event.target.value)} /></label>
            {caseMappingError && <p className="sm-form-error">{caseMappingError}</p>}
            {caseSourceLoading ? <p className="sm-detail-muted">Loading test cases…</p> : filteredCaseCandidates.length ? <div className="sm-mapping-list">{filteredCaseCandidates.map(testCase => <label className="sm-mapping-row" key={testCase.key}><input type="checkbox" checked={caseMappingSelection.has(testCase.key)} onChange={() => setCaseMappingSelection(current => { const next = new Set(current); if (next.has(testCase.key)) next.delete(testCase.key); else next.add(testCase.key); return next; })} /><span><code>{testCase.testCaseId}</code><strong>{testCase.title}</strong><small>{testCase.type} · {testCase.priority} · {testCase.sourceSuiteName}{testCase.requirementId ? ` · ${testCase.requirementId}` : ''}</small></span></label>)}</div> : <p className="sm-detail-muted">No other unmapped test cases are available. Create cases in Test Case Management first.</p>}
        </div><footer className="sm-mapping-footer"><span>{caseMappingSelection.size} linked</span><div><button type="button" className="sm-secondary" onClick={() => setCaseMappingOpen(false)} disabled={caseMappingSaving}>Cancel</button><button type="button" className="sm-primary" onClick={saveCaseMappings} disabled={caseMappingSaving}>{caseMappingSaving ? 'Saving…' : 'Save mappings'}</button></div></footer>
    </section></div>, document.body);

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

    const saveSuiteMetadata = async (event) => {
        event.preventDefault();
        if (!suiteEditForm.title.trim()) { setSuiteEditError('Suite name is required.'); return; }
        setSuiteEditSaving(true); setSuiteEditError('');
        try {
            const targetData = suiteData || {};
            const next = { ...targetData, managedSuite: true, testSuiteName: suiteEditForm.title.trim(), description: suiteEditForm.description.trim(), projectName: suiteEditForm.projectName.trim() };
            const response = await sessionService.update(id, { title: suiteEditForm.title.trim(), requirement: suiteEditForm.description.trim(), suiteData: next }, shareToken);
            setRemoteSession(response.data || { ...remoteSession, title: suiteEditForm.title.trim(), suiteData: next });
            setSuiteEditOpen(false);
        } catch (error) { setSuiteEditError(error.message || 'Suite details could not be saved.'); }
        finally { setSuiteEditSaving(false); }
    };

    const toggleSuiteArchive = async () => {
        const archived = String(remoteSession?.status || suiteData?.suiteStatus || '').toLowerCase() === 'archived';
        try {
            const response = await sessionService.update(id, {
                status: archived ? 'Generated' : 'Archived',
                suiteData: { ...(suiteData || {}), managedSuite: true, suiteStatus: archived ? 'Active' : 'Archived' }
            }, shareToken);
            setRemoteSession(response.data || remoteSession);
        } catch (error) { setSuiteEditError(error.message || 'Suite status could not be updated.'); }
    };

    const loadCaseSources = useCallback(async () => {
        setCaseSourceLoading(true);
        setCaseMappingError('');
        try {
            const first = await sessionService.list({ page: 1, limit: 50, sort: 'updatedAt' });
            if (!first?.success) throw new Error(first?.message || 'Available test cases could not be loaded.');
            const sources = [...(first.data || [])];
            for (let currentPage = 2; currentPage <= Number(first.pagination?.totalPages || 1); currentPage += 1) {
                const response = await sessionService.list({ page: currentPage, limit: 50, sort: 'updatedAt' });
                if (!response?.success) throw new Error(response?.message || 'Additional test cases could not be loaded.');
                sources.push(...(response.data || []));
            }
            setCaseSourceSessions(sources);
            return sources;
        } catch (error) {
            setCaseMappingError(error.message || 'Available test cases could not be loaded.');
            return null;
        } finally { setCaseSourceLoading(false); }
    }, []);

    const openCaseMappings = async () => {
        const sources = caseSourceSessions.length ? caseSourceSessions : await loadCaseSources();
        if (!sources) return;
        setCaseMappingSelection(new Set((rawSuiteData?.testCaseRefs || []).map(mappingKey)));
        setCaseMappingSearch('');
        setCaseMappingError('');
        setCaseMappingOpen(true);
    };

    const saveCaseMappings = async () => {
        const candidatesByKey = new Map(caseCandidates.map(candidate => [candidate.key, candidate]));
        const nextRefs = [...caseMappingSelection].flatMap(key => {
            const candidate = candidatesByKey.get(key);
            return candidate ? [{ sourceSuiteId: candidate.sourceSuiteId, testCaseId: candidate.testCaseId }] : [];
        });
        setCaseMappingSaving(true);
        setCaseMappingError('');
        try {
            const nextData = { ...(rawSuiteData || {}), managedSuite: true, testCaseRefs: nextRefs };
            const response = await sessionService.update(id, { suiteData: nextData }, shareToken);
            setRemoteSession(response.data || { ...remoteSession, suiteData: nextData });
            setCaseMappingOpen(false);
        } catch (error) { setCaseMappingError(error.message || 'Test case mappings could not be saved.'); }
        finally { setCaseMappingSaving(false); }
    };

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
    if (remoteSession && !hasTestCases(suiteData) && suiteData?.managedSuite === true && !loadError) {
        const canEditSuite = !['viewer', 'reviewer'].includes(remoteSession.accessRole || 'owner');
        const saveSuiteDetails = async (event) => {
            event.preventDefault();
            if (!suiteEditForm.title.trim()) { setSuiteEditError('Suite name is required.'); return; }
            setSuiteEditSaving(true); setSuiteEditError('');
            try {
                const next = { ...rawSuiteData, managedSuite: true, testSuiteName: suiteEditForm.title.trim(), description: suiteEditForm.description.trim(), projectName: suiteEditForm.projectName.trim() };
                const response = await sessionService.update(id, { title: suiteEditForm.title.trim(), requirement: suiteEditForm.description.trim(), suiteData: next }, shareToken);
                setRemoteSession(response.data || { ...remoteSession, title: suiteEditForm.title.trim(), suiteData: next });
                setSuiteEditOpen(false);
            } catch (error) { setSuiteEditError(error.message || 'Suite details could not be saved.'); }
            finally { setSuiteEditSaving(false); }
        };
        const archiveSuite = async () => {
            try {
                const response = await sessionService.update(id, { status: String(remoteSession.status).toLowerCase() === 'archived' ? 'Draft' : 'Archived', suiteData: { ...rawSuiteData, managedSuite: true, suiteStatus: String(remoteSession.status).toLowerCase() === 'archived' ? 'Active' : 'Archived' } }, shareToken);
                setRemoteSession(response.data || remoteSession);
            } catch (error) { setLoadError({ message: error.message || 'Suite status could not be updated.', status: error.status || 500 }); }
        };
        return <div className="sm-detail-page">
            <NavLink to="/app/test-suites" className="sm-back-link"><ArrowLeft size={14} /> Test Suites</NavLink>
            <header className="sm-detail-header"><div><div className="sm-eyebrow">Suite / {id}</div><h1>{remoteSession.title || suiteData.testSuiteName || 'Untitled suite'}</h1><p>{suiteData.description || remoteSession.requirement || 'No suite description.'}</p><div className="sm-detail-meta"><span>{remoteSession.status === 'Archived' ? 'Archived' : 'Active'}</span><span>·</span><span>{suiteData.projectName || 'Project not associated'}</span><span>·</span><span>0 test cases</span></div></div><div className="sm-detail-actions">
                {canEditSuite && <button type="button" className="sm-secondary" onClick={() => { setSuiteEditForm({ title: remoteSession.title || suiteData.testSuiteName || '', description: suiteData.description || remoteSession.requirement || '', projectName: suiteData.projectName || '' }); setSuiteEditError(''); setSuiteEditOpen(true); }}><Pencil size={14} /> Edit suite</button>}
                <button type="button" className="sm-primary" onClick={openCaseMappings}><Plus size={14} /> Add test cases</button>
                <button type="button" className="sm-secondary" onClick={() => navigate(`/app/test-cases?suiteId=${encodeURIComponent(id)}`)}><Pencil size={14} /> Create a case</button>
                <button type="button" className="sm-secondary" onClick={() => setRunModalOpen(true)} disabled={!suiteCasesCount(suiteData)} title={!suiteCasesCount(suiteData) ? 'Add test cases before starting a run' : ''}><Play size={14} /> Run suite</button>
                {canEditSuite && <button type="button" className="sm-secondary" onClick={archiveSuite}><Archive size={14} /> {remoteSession.status === 'Archived' ? 'Restore' : 'Archive'}</button>}
            </div></header>
            <section className="sm-detail-section"><h2>Suite overview</h2><div className="sm-overview sm-detail-overview"><div><strong>0</strong><span>Manual</span></div><div><strong>0</strong><span>Automated</span></div><div><strong>{suiteData.testCaseRefs?.length || 0}</strong><span>Linked test cases</span></div></div><p>Created: {remoteSession.createdAt ? new Date(remoteSession.createdAt).toLocaleString() : 'Not recorded'} <span>·</span> Last updated: {remoteSession.updatedAt ? new Date(remoteSession.updatedAt).toLocaleString() : 'Not recorded'}</p><Link to={`/app/coverage?suiteId=${encodeURIComponent(id)}`} className="sm-detail-link">Coverage Matrix <ExternalLink size={13} /></Link></section>
            <section className="sm-detail-section"><div className="sm-detail-section-head"><h2>Execution history</h2><Link to="/app/runs">Open Test Runs <ExternalLink size={13} /></Link></div>{suiteRunsLoading ? <p className="sm-detail-muted">Loading execution history…</p> : suiteRunsError ? <p className="sm-detail-muted">{suiteRunsError}</p> : suiteRuns.length ? <div className="sm-history-table"><div className="sm-history-row sm-history-head"><span>Run</span><span>Mode</span><span>Outcomes</span><span>Status</span><span>Duration</span><span>Date</span></div>{suiteRuns.map(run => <Link className="sm-history-row" key={run.id || run._id} to={`/app/runs/${run.id || run._id}`}><span>{run.name || `Run ${String(run.id || run._id).slice(0, 8)}`}<small>{run.id || run._id}</small></span><span>{run.executionType || run.execution_type || 'Not recorded'}</span><span>{runResultSummary(run)}</span><span>{run.status || 'Not recorded'}</span><span>{formatRunDuration(run)}</span><span>{run.completedAt || run.completed_at || run.createdAt || run.created_at ? new Date(run.completedAt || run.completed_at || run.createdAt || run.created_at).toLocaleString() : 'Not recorded'}</span></Link>)}</div> : <p className="sm-detail-muted">No execution history recorded for this suite.</p>}</section>
            <section className="sm-detail-section"><h2>Coverage Matrix</h2><p>Requirements remain linked through the test case mappings maintained in this suite.</p><Link to={`/app/coverage?suiteId=${encodeURIComponent(id)}`} className="sm-detail-link">View Coverage Matrix <ExternalLink size={13} /></Link></section>
            {suiteEditOpen && <div className="sm-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !suiteEditSaving) setSuiteEditOpen(false); }}><section className="sm-modal" role="dialog" aria-modal="true" aria-labelledby="sm-edit-title"><header><div><div className="sm-eyebrow">Suite details</div><h2 id="sm-edit-title">Edit Test Suite</h2></div><button type="button" onClick={() => setSuiteEditOpen(false)} aria-label="Close">×</button></header><form onSubmit={saveSuiteDetails}>{suiteEditError && <p className="sm-form-error">{suiteEditError}</p>}<label>Suite name<input required value={suiteEditForm.title} onChange={event => setSuiteEditForm({ ...suiteEditForm, title: event.target.value })} /></label><label>Description<textarea rows="3" value={suiteEditForm.description} onChange={event => setSuiteEditForm({ ...suiteEditForm, description: event.target.value })} /></label><label>Project association<input value={suiteEditForm.projectName} onChange={event => setSuiteEditForm({ ...suiteEditForm, projectName: event.target.value })} /></label><footer><button type="button" className="sm-secondary" onClick={() => setSuiteEditOpen(false)}>Cancel</button><button className="sm-primary" disabled={suiteEditSaving}>{suiteEditSaving ? 'Saving…' : 'Save changes'}</button></footer></form></section></div>}
            {caseMappingDialog}
            <NewTestRunModal isOpen={runModalOpen} onClose={() => setRunModalOpen(false)} initialSuite={{ ...remoteSession, id: id || remoteSession?.id, suiteData }} />
        </div>;
    }

    // --- Existing generated suite detail ---
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
    const canManageSuite = !['viewer', 'reviewer'].includes(assignedRole);
    const suiteCaseRecords = getSuiteCaseRecords(suiteData);
    const linkedRequirements = [...new Set(suiteCaseRecords.map(test => test.requirementId || test.reqId).filter(Boolean))];
    const automatedCaseCount = suiteCaseRecords.filter(test => test.automationMapping || test.playwrightBinding || test.isAutomated || ['automated', 'automation', 'playwright'].includes(String(test.executionType || test.executionMethod || test.method || '').toLowerCase())).length;
    const manualCaseCount = suiteCaseRecords.length - automatedCaseCount;
    return (
        <div className="test-suite-detail-page">
            <header className="sm-existing-suite-header">
                <div><div className="sm-eyebrow">Test Suites / {id}</div><h1>{remoteSession?.title || suiteData.testSuiteName || suiteData.feature || 'Test Suite'}</h1><p>{suiteData.description || promptText || 'No suite description recorded.'}</p><div className="sm-detail-meta"><span>{remoteSession?.status === 'Archived' ? 'Archived' : 'Active'}</span><span>·</span><span>{suiteCasesCount(suiteData)} test cases</span><span>·</span><span>{suiteRuns.length} recorded runs</span></div></div>
                <div className="sm-detail-actions">{canManageSuite && <button type="button" className="sm-secondary" onClick={() => { setSuiteEditForm({ title: remoteSession?.title || suiteData.testSuiteName || '', description: suiteData.description || promptText || '', projectName: suiteData.projectName || '' }); setSuiteEditError(''); setSuiteEditOpen(true); }}><Pencil size={14} /> Edit suite</button>}{canManageSuite && <button type="button" className="sm-primary" onClick={openCaseMappings}><Plus size={14} /> Add test cases</button>}{canManageSuite && <button type="button" className="sm-secondary" onClick={() => navigate(`/app/test-cases?suiteId=${encodeURIComponent(id)}`)}><Pencil size={14} /> Create a case</button>}{canManageSuite && <button type="button" className="sm-secondary" onClick={toggleSuiteArchive}><Archive size={14} /> {remoteSession?.status === 'Archived' ? 'Restore' : 'Archive'}</button>}<button type="button" className="sm-primary" onClick={() => setRunModalOpen(true)} disabled={!suiteCasesCount(suiteData)} title={!suiteCasesCount(suiteData) ? 'Add test cases before starting a run' : ''}><Play size={14} /> Run suite</button></div>
            </header>
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

            <section className="sm-suite-facts"><div><strong>{suiteCaseRecords.length}</strong><span>Test cases</span></div><div><strong>{manualCaseCount}</strong><span>Manual</span></div><div><strong>{automatedCaseCount}</strong><span>Automated</span></div><div><strong>{linkedRequirements.length}</strong><span>Linked requirements</span></div><div><strong>{suiteRuns.length}</strong><span>Recorded runs</span></div><div><strong>{suiteRuns[0]?.createdAt || suiteRuns[0]?.created_at ? new Date(suiteRuns[0].createdAt || suiteRuns[0].created_at).toLocaleDateString() : '—'}</strong><span>Latest run</span></div></section>

            <ResultsSection
                result={suiteData}
                suiteId={id || remoteSession?.id}
                initialTestCaseId={requestedTestCaseId}
                initialExecute={requestedExecute}
                accessRole={assignedRole}
                isShared={isSharedSuite}
                onSave={() => handleSave(suiteData)}
                isLatest={true}
            />
            <section className="sm-existing-history"><div className="sm-detail-section-head"><h2>Execution history</h2><Link to="/app/runs">Open Test Runs <ExternalLink size={13} /></Link></div>{suiteRunsLoading ? <p className="sm-detail-muted">Loading execution history…</p> : suiteRunsError ? <p className="sm-detail-muted">{suiteRunsError}</p> : suiteRuns.length ? <div className="sm-history-table"><div className="sm-history-row sm-history-head"><span>Run</span><span>Mode</span><span>Outcomes</span><span>Status</span><span>Duration</span><span>Opened</span></div>{suiteRuns.slice(0, 10).map(run => <Link className="sm-history-row" key={run.id || run._id} to={`/app/runs/${run.id || run._id}`}><span>{run.name || `Run ${String(run.id || run._id).slice(0, 8)}`}<small>{run.id || run._id}</small></span><span>{run.executionType || run.execution_type || 'Not recorded'}</span><span>{runResultSummary(run)}</span><span>{run.status || 'Not recorded'}</span><span>{formatRunDuration(run)}</span><span>{run.createdAt || run.created_at ? new Date(run.createdAt || run.created_at).toLocaleString() : 'Not recorded'}</span></Link>)}</div> : <p className="sm-detail-muted">No execution history recorded for this suite.</p>}
                <div className="sm-detail-foot-links"><Link to={`/app/coverage?suiteId=${encodeURIComponent(id)}`}>Coverage Matrix <ExternalLink size={13} /></Link>{linkedRequirements.map(requirementId => <Link key={requirementId} to={`/app/coverage?suiteId=${encodeURIComponent(id)}&requirementId=${encodeURIComponent(requirementId)}`}>{requirementId} <ExternalLink size={12} /></Link>)}</div>
            </section>
            {suiteEditOpen && <div className="sm-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !suiteEditSaving) setSuiteEditOpen(false); }}><section className="sm-modal" role="dialog" aria-modal="true" aria-labelledby="sm-edit-title"><header><div><div className="sm-eyebrow">Suite details</div><h2 id="sm-edit-title">Edit Test Suite</h2></div><button type="button" onClick={() => setSuiteEditOpen(false)} aria-label="Close">×</button></header><form onSubmit={saveSuiteMetadata}>{suiteEditError && <p className="sm-form-error">{suiteEditError}</p>}<label>Suite name<input required value={suiteEditForm.title} onChange={event => setSuiteEditForm({ ...suiteEditForm, title: event.target.value })} /></label><label>Description<textarea rows="3" value={suiteEditForm.description} onChange={event => setSuiteEditForm({ ...suiteEditForm, description: event.target.value })} /></label><label>Project association<input value={suiteEditForm.projectName} onChange={event => setSuiteEditForm({ ...suiteEditForm, projectName: event.target.value })} /></label><footer><button type="button" className="sm-secondary" onClick={() => setSuiteEditOpen(false)}>Cancel</button><button className="sm-primary" disabled={suiteEditSaving}>{suiteEditSaving ? 'Saving…' : 'Save changes'}</button></footer></form></section></div>}
            {caseMappingDialog}
            <NewTestRunModal isOpen={runModalOpen} onClose={() => setRunModalOpen(false)} initialSuite={{ ...remoteSession, id: id || remoteSession?.id, suiteData }} />
        </div>
    );
};

export default TestSuiteDetailPage;
