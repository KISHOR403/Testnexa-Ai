import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useLocation, NavLink, Link, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, ShieldAlert, AlertCircle, RefreshCw, Layers, Lock, ShieldCheck,
    Share2, Plus, Play, Archive, Pencil, ExternalLink, Search, Sparkles,
    Download, MoreHorizontal, Copy, PlayCircle, FileText, Check
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useHistory } from '../../hooks/useHistory';
import { sessionService, testSuiteService } from '../../services/sessionService';
import { DataLoadingState } from '../../components/loading';
import ResultsSection from '../../components/ResultsSection';
import NewTestRunModal from '../../components/execution/NewTestRunModal';
import { executionService } from '../../services/executionService';
import { computeCanonicalSuiteMetrics } from '../../utils/testSuiteSelectors';
import RunButton from '../../components/common/RunButton';
import { useFeature } from '../../config/features';
import { useComingSoon } from '../../context/ComingSoonContext';
import { caseReviewService } from '../../services/caseReviewService';
import ApproveRemainingDialog from '../../components/testcases/ApproveRemainingDialog';
import LinkedRequirementsSection from '../../components/testcases/LinkedRequirementsSection';
import { ToastProvider, useToast } from '../../components/common/ToastLiveRegion';
import '../../styles/app/TestSuiteDetail.css';
import '../../styles/app/SuiteReviewActions.css';

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
    const { enabled: testRunsEnabled } = useFeature('testRuns');
    const { open: openComingSoon } = useComingSoon();

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
    const [moreMenuOpen, setMoreMenuOpen] = useState(false);
    const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
    const [descriptionExpanded, setDescriptionExpanded] = useState(false);
    const [idCopied, setIdCopied] = useState(false);
    const [approveRemainingModalOpen, setApproveRemainingModalOpen] = useState(false);
    const [exportModalOpen, setExportModalOpen] = useState(false);
    const [exportIncludePending, setExportIncludePending] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [suiteRequirements, setSuiteRequirements] = useState([]);
    const moreMenuRef = useRef(null);
    const { showToast } = useToast?.() || { showToast: null };

    // Load canonical suite requirements
    useEffect(() => {
        if (!id) return;
        let isCurrent = true;
        const fetchReqs = async () => {
            try {
                const res = await caseReviewService.getSuiteRequirements(id);
                if (isCurrent && res) {
                    setSuiteRequirements(Array.isArray(res.data) ? res.data : (res.requirements || []));
                }
            } catch (err) {
                // Ignore fallback to local
            }
        };
        fetchReqs();
        return () => { isCurrent = false; };
    }, [id, retryTrigger]);

    useEffect(() => {
        const handleOutsideClick = (e) => {
            if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
                setMoreMenuOpen(false);
            }
        };
        if (moreMenuOpen) {
            document.addEventListener('mousedown', handleOutsideClick);
        }
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [moreMenuOpen]);

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
        } finally {
            setCaseSourceLoading(false);
        }
    }, []);

    // Extract potential share token from query parameters (?token=... or ?share=...)
    const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const shareToken = searchParams.get('token') || searchParams.get('share');
    const requestedTestCaseId = searchParams.get('testCaseId');
    const requestedExecute = searchParams.get('execute') === '1';

    useEffect(() => {
        if (requestedExecute && !testRunsEnabled) {
            openComingSoon('testRuns');
        }
    }, [requestedExecute, testRunsEnabled, openComingSoon]);

    useEffect(() => {
        let current = true;
        const loadSuiteRuns = async () => {
            if (!testRunsEnabled) {
                setSuiteRuns([]);
                setSuiteRunsLoading(false);
                return;
            }
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
    }, [id, testRunsEnabled]);

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

    // Single source of truth metrics for all counts across the page
    const metrics = useMemo(() => {
        const sourceMap = new Map(caseSourceSessions.map(s => [String(s.id || s._id), s]));
        return computeCanonicalSuiteMetrics(suiteData || remoteSession, suiteRuns, sourceMap);
    }, [suiteData, remoteSession, suiteRuns, caseSourceSessions]);

    const pendingCases = useMemo(() => {
        return (metrics.tests || []).filter(tc => {
            const appr = String(tc.approval_status || tc.approvalStatus || tc.status || '').toLowerCase();
            return appr !== 'approved' && appr !== 'rejected';
        });
    }, [metrics.tests]);

    const formattedDate = useMemo(() => {
        const rawDate = remoteSession?.updatedAt || remoteSession?.updated_at || remoteSession?.createdAt || remoteSession?.created_at;
        if (!rawDate) return 'Sep 13, 2026';
        try {
            const d = new Date(rawDate);
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch {
            return 'Sep 13, 2026';
        }
    }, [remoteSession]);

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

    const openCaseMappings = async () => {
        const sources = caseSourceSessions.length ? caseSourceSessions : await loadCaseSources();
        if (!sources) return;
        setCaseMappingSelection(new Set((rawSuiteData?.testCaseRefs || []).map(mappingKey)));
        setCaseMappingSearch('');
        setCaseMappingError('');
        setCaseMappingOpen(true);
    };

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

    // ─── Session Exists but Suite Not Generated (Empty / Draft Fallback) ───
    if (remoteSession && !hasTestCases(suiteData) && !loadError) {
        return (
            <div className="test-suite-detail-page">
                <div className="tsd-history-empty" style={{ margin: '40px 0', padding: '48px 24px' }}>
                    <Layers size={32} className="tsd-empty-icon" />
                    <h2 className="tsd-empty-title">{remoteSession.title || 'Test Suite'}</h2>
                    <p className="tsd-empty-desc">
                        This suite contains no test cases. Suites can only be run once test cases have been synthesized or linked.
                    </p>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                        <NavLink to={`/app/workspace/${remoteSession.id || remoteSession._id || id}`} className="tsd-btn-primary">
                            Generate in AI Workspace &rarr;
                        </NavLink>
                        <NavLink to="/app/test-suites" className="tsd-btn-secondary">
                            Back to Test Suites
                        </NavLink>
                    </div>
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
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--tsd-text-1, #fff)',
                        marginBottom: '1rem'
                    }}>
                        <Lock size={26} />
                    </div>

                    <div className="ws-empty-text-wrap" style={{ maxWidth: '460px' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--tsd-text-1, #fff)', marginBottom: '0.5rem' }}>
                            Authentication Required
                        </h2>
                        <p style={{ color: 'var(--tsd-text-2, rgba(255,255,255,0.72))', fontSize: '0.9rem', lineHeight: '1.5' }}>
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
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--tsd-text-1, #fff)',
                        marginBottom: '1rem'
                    }}>
                        <ShieldAlert size={26} />
                    </div>

                    <div className="ws-empty-text-wrap" style={{ maxWidth: '460px' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--tsd-text-1, #fff)', marginBottom: '0.5rem' }}>
                            Share Link Revoked
                        </h2>
                        <p style={{ color: 'var(--tsd-text-2, rgba(255,255,255,0.72))', fontSize: '0.9rem', lineHeight: '1.5' }}>
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
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--tsd-text-1, #fff)',
                        marginBottom: '1rem'
                    }}>
                        <ShieldAlert size={26} />
                    </div>

                    <div className="ws-empty-text-wrap" style={{ maxWidth: '460px' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--tsd-text-1, #fff)', marginBottom: '0.5rem' }}>
                            Access Denied
                        </h2>
                        <p style={{ color: 'var(--tsd-text-2, rgba(255,255,255,0.72))', fontSize: '0.9rem', lineHeight: '1.5' }}>
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
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--tsd-text-1, #fff)',
                    marginBottom: '1rem'
                }}>
                    <AlertCircle size={26} />
                </div>

                <div className="ws-empty-text-wrap" style={{ maxWidth: '440px' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--tsd-text-1, #fff)', marginBottom: '0.5rem' }}>
                        Test Suite Not Found
                    </h2>
                    <p style={{ color: 'var(--tsd-text-2, rgba(255,255,255,0.72))', fontSize: '0.9rem', lineHeight: '1.5' }}>
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
    const canManageSuite = !['viewer', 'reviewer'].includes(assignedRole);
    const isArchived = String(remoteSession?.status || suiteData?.suiteStatus || '').toLowerCase() === 'archived';
    const suiteTitle = remoteSession?.title || suiteData?.testSuiteName || suiteData?.feature || 'Test Suite';
    const descriptionText = suiteData?.description || promptText || 'No suite description recorded.';

    const isApproveDisabled = !canManageSuite || metrics.approvedCases >= metrics.totalCases;
    const approveTooltip = !canManageSuite
        ? 'Reviewer permissions required to approve test cases'
        : metrics.approvedCases >= metrics.totalCases
        ? 'All test cases are already approved'
        : 'Approve all remaining unapproved test cases';

    const handleCopyId = async () => {
        if (id) {
            try {
                if (navigator?.clipboard?.writeText) {
                    await navigator.clipboard.writeText(id);
                }
                setIdCopied(true);
                setTimeout(() => setIdCopied(false), 2000);
            } catch (err) {
                console.warn('Failed to copy ID:', err);
            }
        }
        setMoreMenuOpen(false);
    };

    const handleExportSuite = () => {
        const exportData = {
            id,
            title: suiteTitle,
            description: descriptionText,
            metrics: {
                totalCases: metrics.totalCases,
                approvedCases: metrics.approvedCases,
                coverage: metrics.coverage
            },
            tests: metrics.tests
        };
        const jsonStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute('href', jsonStr);
        downloadAnchor.setAttribute('download', `${(suiteTitle || 'test-suite').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    };

    const handleConfirmApproveRemaining = async ({ caseIds, expectedCount }) => {
        if (!canManageSuite || !id) return;
        const res = await caseReviewService.approveRemaining(id, { caseIds, expectedCount });
        const batchId = res.batchId || res.data?.batchId;
        const approvedCount = res.approved?.length ?? expectedCount;

        // Optimistically update test cases
        if (remoteSession || suiteData) {
            const currentTests = getSuiteCaseRecords(suiteData || remoteSession?.suiteData || {});
            const updatedTests = currentTests.map(tc => {
                const tcId = tc.id || tc.testCaseId;
                if (caseIds.includes(tcId)) {
                    return {
                        ...tc,
                        approval_status: 'approved',
                        status: 'Approved',
                        isApproved: true,
                        approved_by: 'You',
                        approved_at: new Date().toISOString()
                    };
                }
                return tc;
            });
            const nextSuiteData = { ...(suiteData || {}), testCases: updatedTests, managedSuite: true };
            setRemoteSession(prev => ({ ...prev, suiteData: nextSuiteData }));
        }

        showToast?.(`${approvedCount} approved.`, {
            onUndo: async () => {
                if (batchId) {
                    await caseReviewService.undoApproval({ batchId });
                } else {
                    await caseReviewService.undoApproval({ caseIds });
                }
                setRetryTrigger(prev => prev + 1);
            },
            duration: 10000
        });
    };

    const handleExportPlaywright = async (filter = 'only') => {
        setIsExporting(true);
        try {
            const res = await caseReviewService.exportPlaywright(id, { approved: filter });
            const blob = new Blob([res.specCode || res.code || ''], { type: 'text/javascript' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${(suiteTitle || 'suite').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.spec.js`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            showToast?.(`Exported ${res.exportedCount} cases (${res.skippedCount} skipped).`);
            setExportModalOpen(false);
        } catch (err) {
            alert(err.message || 'Failed to export Playwright spec.');
        } finally {
            setIsExporting(false);
        }
    };

    const handleApproveRemaining = () => {
        if (!canManageSuite || !suiteData) return;
        setApproveRemainingModalOpen(true);
    };

    const handleArchiveConfirm = async () => {
        setArchiveConfirmOpen(false);
        await toggleSuiteArchive();
    };

    return (
        <div className="test-suite-detail-page">
            {/* Header: Title, clamped description with Show more, meta line, action buttons */}
            <header className="tsd-header">
                <div className="tsd-header-left">
                    <h1 className="tsd-title">{suiteTitle}</h1>
                    {descriptionText && (
                        <div className="tsd-description-wrap">
                            <p className={`tsd-description ${descriptionExpanded ? 'is-expanded' : 'is-clamped'}`}>
                                {descriptionText}
                            </p>
                            {descriptionText.length > 120 && (
                                <button
                                    type="button"
                                    className="tsd-toggle-description"
                                    onClick={() => setDescriptionExpanded(prev => !prev)}
                                >
                                    {descriptionExpanded ? 'Show less' : 'Show more'}
                                </button>
                            )}
                        </div>
                    )}
                    <div className="tsd-meta-line">
                        <span className="tsd-meta-status">{isArchived ? 'Archived' : 'Active'}</span>
                        <span className="tsd-meta-dot">·</span>
                        <span>{metrics.totalCases} cases</span>
                        <span className="tsd-meta-dot">·</span>
                        <span>{metrics.runsCount} runs</span>
                        <span className="tsd-meta-dot">·</span>
                        <span>Updated {formattedDate}</span>
                    </div>
                </div>

                {/* 2. Actions: primary "Run suite", secondary "Add test cases" & "Export", More menu */}
                <div className="tsd-header-actions">
                    <RunButton
                        label="Run suite"
                        className="tsd-btn-primary"
                        iconSize={14}
                        onClick={() => setRunModalOpen(true)}
                        disabled={!metrics.totalCases}
                        title={!metrics.totalCases ? 'Add test cases before starting a run' : 'Run this suite'}
                        feature="testRuns"
                    />
                    {canManageSuite && (
                        <button
                            type="button"
                            className="tsd-btn-secondary"
                            onClick={openCaseMappings}
                        >
                            <Plus size={14} />
                            <span>Add test cases</span>
                        </button>
                    )}
                    <button
                        type="button"
                        className="tsd-btn-secondary"
                        onClick={() => setExportModalOpen(true)}
                    >
                        <Download size={14} />
                        <span>Export</span>
                    </button>
                    <div className="tsd-more-menu-wrap" ref={moreMenuRef}>
                        <button
                            type="button"
                            className="tsd-btn-secondary tsd-btn-icon"
                            onClick={() => setMoreMenuOpen(prev => !prev)}
                            aria-expanded={moreMenuOpen}
                            aria-label="More actions"
                            title="More actions"
                        >
                            <MoreHorizontal size={16} />
                        </button>
                        {moreMenuOpen && (
                            <div className="tsd-more-dropdown" role="menu">
                                {canManageSuite && (
                                    <button
                                        type="button"
                                        className="tsd-more-item"
                                        role="menuitem"
                                        onClick={() => {
                                            setSuiteEditForm({
                                                title: suiteTitle,
                                                description: descriptionText,
                                                projectName: suiteData?.projectName || ''
                                            });
                                            setSuiteEditError('');
                                            setSuiteEditOpen(true);
                                            setMoreMenuOpen(false);
                                        }}
                                    >
                                        <Pencil size={14} />
                                        <span>Edit suite</span>
                                    </button>
                                )}
                                {canManageSuite && (
                                    <button
                                        type="button"
                                        className="tsd-more-item"
                                        role="menuitem"
                                        onClick={() => {
                                            navigate(`/app/test-cases?suiteId=${encodeURIComponent(id)}`);
                                            setMoreMenuOpen(false);
                                        }}
                                    >
                                        <FileText size={14} />
                                        <span>Create a case</span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className="tsd-more-item"
                                    role="menuitem"
                                    onClick={() => {
                                        if (navigator?.clipboard?.writeText) {
                                            navigator.clipboard.writeText(window.location.href);
                                        }
                                        alert('Share link copied to clipboard!');
                                        setMoreMenuOpen(false);
                                    }}
                                >
                                    <Share2 size={14} />
                                    <span>Share</span>
                                </button>
                                <button
                                    type="button"
                                    className="tsd-more-item"
                                    role="menuitem"
                                    onClick={() => {
                                        navigate(`/app/recommendations?suiteId=${encodeURIComponent(id)}`);
                                        setMoreMenuOpen(false);
                                    }}
                                >
                                    <Sparkles size={14} />
                                    <span>Recommendations</span>
                                </button>
                                <button
                                    type="button"
                                    className="tsd-more-item"
                                    role="menuitem"
                                    onClick={handleCopyId}
                                >
                                    <Copy size={14} />
                                    <span>{idCopied ? 'ID Copied!' : 'Copy ID'}</span>
                                </button>
                                {canManageSuite && (
                                    <button
                                        type="button"
                                        className="tsd-more-item tsd-more-item--danger"
                                        role="menuitem"
                                        onClick={() => {
                                            setArchiveConfirmOpen(true);
                                            setMoreMenuOpen(false);
                                        }}
                                    >
                                        <Archive size={14} />
                                        <span>{isArchived ? 'Restore suite' : 'Archive suite'}</span>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Review Progress Element ("0 of 19 approved" + thin white progress bar + "Approve remaining") */}
            <div className="tsd-review-progress-card">
                <div className="tsd-review-info">
                    <span className="tsd-review-count">
                        {metrics.approvedCases} of {metrics.totalCases} approved
                        {metrics.rejectedCases > 0 && (
                            <span className="tsd-review-rejected-tag"> · {metrics.rejectedCases} rejected</span>
                        )}
                    </span>
                    <div className="tsd-progress-track">
                        <div
                            className="tsd-progress-fill"
                            style={{ width: `${metrics.totalCases > 0 ? (metrics.approvedCases / metrics.totalCases) * 100 : 0}%` }}
                        />
                    </div>
                </div>
                {metrics.isAllApproved ? (
                    <div className="tsd-all-approved-banner">
                        <Check size={14} />
                        <span>All approved</span>
                        <button
                            type="button"
                            className="tn-app-btn tn-app-btn--sm tn-app-btn--primary"
                            onClick={() => handleExportPlaywright('only')}
                            style={{ marginLeft: 8 }}
                        >
                            <Download size={12} />
                            <span>Export approved</span>
                        </button>
                    </div>
                ) : (
                    <button
                        type="button"
                        className="tsd-btn-approve-remaining"
                        disabled={pendingCases.length === 0 || !canManageSuite}
                        title={pendingCases.length === 0 ? 'No pending test cases to approve' : approveTooltip}
                        onClick={handleApproveRemaining}
                    >
                        <Check size={13} />
                        <span>Approve remaining</span>
                    </button>
                )}
            </div>

            {/* 3. Stats strip: one horizontal strip, equal columns, from the single count function */}
            <section className="tsd-stats-strip" aria-label="Suite statistics">
                <div className="tsd-stat-col">
                    <span className="tsd-stat-val">{metrics.totalCases}</span>
                    <span className="tsd-stat-label">Cases</span>
                </div>
                <div className="tsd-stat-col">
                    <span className="tsd-stat-val">{metrics.approvedCases}</span>
                    <span className="tsd-stat-label">Approved</span>
                </div>
                <div className="tsd-stat-col">
                    <span className="tsd-stat-val">{metrics.coverage}%</span>
                    <span className="tsd-stat-label">linked</span>
                    <span className="tsd-stat-sub">0% verified (needs test execution, soon)</span>
                </div>
                <div className="tsd-stat-col">
                    <span className="tsd-stat-val">{metrics.highPriorityCases}</span>
                    <span className="tsd-stat-label">High priority</span>
                </div>
                <div className="tsd-stat-col">
                    <span className="tsd-stat-val">{metrics.linkedRequirementsCount}</span>
                    <span className="tsd-stat-label">Linked requirements</span>
                </div>
                <div className="tsd-stat-col">
                    <span className="tsd-stat-val">{metrics.runsCount}</span>
                    <span className="tsd-stat-label">Runs</span>
                </div>
            </section>

            {/* Middle Card: ResultsSection (tabs, table, detail panel) */}
            <ResultsSection
                result={suiteData}
                suiteId={id || remoteSession?.id}
                canonicalTests={metrics.tests}
                hideHeaderStats={true}
                initialTestCaseId={requestedTestCaseId}
                initialExecute={requestedExecute}
                accessRole={assignedRole}
                isShared={isSharedSuite}
                onSave={() => handleSave(suiteData)}
                isLatest={true}
            />

            {/* 6. Execution history & Linked requirements */}
            <section className="tsd-history-section">
                <div className="tsd-section-header">
                    <h2 className="tsd-section-title">Execution history</h2>
                    <Link to="/app/runs" className="tsd-link">
                        Open Test Runs
                    </Link>
                </div>

                {suiteRunsLoading ? (
                    <div className="tsd-history-empty">
                        <p className="tsd-muted-text">Loading execution history…</p>
                    </div>
                ) : suiteRunsError ? (
                    <div className="tsd-history-empty">
                        <p className="tsd-muted-text">{suiteRunsError}</p>
                    </div>
                ) : suiteRuns.length > 0 ? (
                    <div className="tsd-history-table">
                        <div className="tsd-history-thead">
                            <span>Run</span>
                            <span>Mode</span>
                            <span>Outcomes</span>
                            <span>Status</span>
                            <span>Duration</span>
                            <span>Date</span>
                        </div>
                        {suiteRuns.slice(0, 10).map(run => (
                            <Link
                                key={run.id || run._id}
                                to={`/app/runs/${run.id || run._id}`}
                                className="tsd-history-row"
                            >
                                <span className="tsd-history-cell-name">
                                    {run.name || `Run ${String(run.id || run._id).slice(0, 8)}`}
                                </span>
                                <span>{run.executionType || run.execution_type || 'Automated'}</span>
                                <span>{runResultSummary(run)}</span>
                                <span>{run.status || 'Completed'}</span>
                                <span>{formatRunDuration(run)}</span>
                                <span>{run.completedAt || run.createdAt ? new Date(run.completedAt || run.createdAt).toLocaleDateString() : '—'}</span>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="tsd-history-empty">
                        <PlayCircle size={28} className="tsd-empty-icon" />
                        <p className="tsd-empty-title">
                            {!testRunsEnabled ? 'Test execution is coming soon' : 'No runs yet'}
                        </p>
                        <p className="tsd-empty-desc">
                            {!testRunsEnabled
                                ? 'Manual and Playwright runs are currently in development. You can already create test suites, link requirements, and trace coverage.'
                                : 'Execute your test suite to capture live test outcomes, duration, and regression telemetry.'}
                        </p>
                        <RunButton
                            label="Run this suite"
                            className="tsd-btn-primary"
                            iconSize={14}
                            onClick={() => setRunModalOpen(true)}
                            disabled={!metrics.totalCases}
                            feature="testRuns"
                        />
                    </div>
                )}

                {/* Linked requirements block with canonical keys and rich drawer */}
                <LinkedRequirementsSection
                    suiteId={id || remoteSession?.id}
                    suiteCases={metrics.tests}
                    requirements={suiteRequirements}
                    onRequirementMutated={() => setRetryTrigger(prev => prev + 1)}
                    onSelectTestCase={(tcId) => {
                        navigate(`/app/test-suites/${id}?testCaseId=${encodeURIComponent(tcId)}`);
                    }}
                />
            </section>

            {/* Archive Confirmation Dialog */}
            {archiveConfirmOpen && (
                <div className="tsd-modal-backdrop" role="presentation" onClick={() => setArchiveConfirmOpen(false)}>
                    <div className="tsd-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
                        <div className="tsd-modal-header">
                            <h3>{isArchived ? 'Restore test suite?' : 'Archive test suite?'}</h3>
                            <button type="button" className="tsd-modal-close" onClick={() => setArchiveConfirmOpen(false)} aria-label="Close">×</button>
                        </div>
                        <div className="tsd-modal-body">
                            <p>
                                {isArchived
                                    ? 'Restoring this test suite will return it to active status across test runs and workspace filters.'
                                    : 'Archiving hides this suite from active views, but test cases and historical runs are safely preserved.'}
                            </p>
                        </div>
                        <div className="tsd-modal-footer">
                            <button type="button" className="tsd-btn-secondary" onClick={() => setArchiveConfirmOpen(false)}>Cancel</button>
                            <button type="button" className="tsd-btn-primary" onClick={handleArchiveConfirm}>
                                {isArchived ? 'Restore suite' : 'Confirm archive'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Suite Edit Modal */}
            {suiteEditOpen && (
                <div className="tsd-modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget && !suiteEditSaving) setSuiteEditOpen(false); }}>
                    <div className="tsd-modal" role="dialog" aria-modal="true">
                        <div className="tsd-modal-header">
                            <h3>Edit Test Suite</h3>
                            <button type="button" className="tsd-modal-close" onClick={() => setSuiteEditOpen(false)} aria-label="Close">×</button>
                        </div>
                        <form onSubmit={saveSuiteMetadata}>
                            <div className="tsd-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                {suiteEditError && <p style={{ color: '#fff', fontSize: '13px' }}>{suiteEditError}</p>}
                                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: 'var(--tsd-text-2)' }}>
                                    Suite name
                                    <input
                                        required
                                        style={{ background: 'var(--tsd-surface-2)', border: '1px solid var(--tsd-line-hi)', color: '#fff', padding: '8px 12px', borderRadius: '5px' }}
                                        value={suiteEditForm.title}
                                        onChange={e => setSuiteEditForm({ ...suiteEditForm, title: e.target.value })}
                                    />
                                </label>
                                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: 'var(--tsd-text-2)' }}>
                                    Description
                                    <textarea
                                        rows={3}
                                        style={{ background: 'var(--tsd-surface-2)', border: '1px solid var(--tsd-line-hi)', color: '#fff', padding: '8px 12px', borderRadius: '5px' }}
                                        value={suiteEditForm.description}
                                        onChange={e => setSuiteEditForm({ ...suiteEditForm, description: e.target.value })}
                                    />
                                </label>
                                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: 'var(--tsd-text-2)' }}>
                                    Project association
                                    <input
                                        style={{ background: 'var(--tsd-surface-2)', border: '1px solid var(--tsd-line-hi)', color: '#fff', padding: '8px 12px', borderRadius: '5px' }}
                                        value={suiteEditForm.projectName}
                                        onChange={e => setSuiteEditForm({ ...suiteEditForm, projectName: e.target.value })}
                                    />
                                </label>
                            </div>
                            <div className="tsd-modal-footer">
                                <button type="button" className="tsd-btn-secondary" onClick={() => setSuiteEditOpen(false)}>Cancel</button>
                                <button type="submit" className="tsd-btn-primary" disabled={suiteEditSaving}>{suiteEditSaving ? 'Saving…' : 'Save changes'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {caseMappingDialog}
            <NewTestRunModal
                isOpen={runModalOpen}
                onClose={() => setRunModalOpen(false)}
                initialSuite={{ ...remoteSession, id: id || remoteSession?.id, suiteData }}
            />

            {/* Approve Remaining Dialog */}
            <ApproveRemainingDialog
                isOpen={approveRemainingModalOpen}
                onClose={() => setApproveRemainingModalOpen(false)}
                onConfirm={handleConfirmApproveRemaining}
                pendingCases={pendingCases}
                rejectedCount={metrics.rejectedCases}
                totalCount={metrics.totalCases}
            />

            {/* Export Dialog with approved filter and skipped reporting */}
            {exportModalOpen && (
                <div className="tn-dialog-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget && !isExporting) setExportModalOpen(false); }}>
                    <div className="tn-dialog tn-dialog--sm" role="dialog" aria-modal="true" aria-labelledby="export-dialog-title">
                        <div className="tn-dialog__header">
                            <div>
                                <div className="tn-eyebrow">Export Pipeline</div>
                                <h3 id="export-dialog-title">Export Playwright Tests</h3>
                            </div>
                            <button type="button" className="tn-btn-icon" onClick={() => setExportModalOpen(false)} disabled={isExporting} aria-label="Close">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="tn-dialog__body">
                            <p className="tn-dialog-desc">
                                Export executable Playwright spec code for this test suite.
                            </p>

                            <div className="tn-form-group" style={{ padding: '8px 0' }}>
                                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                                    <span>Include pending cases ({pendingCases.length})</span>
                                    <input
                                        type="checkbox"
                                        checked={exportIncludePending}
                                        onChange={(e) => setExportIncludePending(e.target.checked)}
                                    />
                                </label>
                            </div>

                            <div className="tn-notice-callout">
                                <AlertCircle size={14} />
                                <span>
                                    {exportIncludePending
                                        ? `${metrics.rejectedCases} rejected cases will be skipped (rejected cases are never exported).`
                                        : `${pendingCases.length + metrics.rejectedCases} cases will be skipped (exporting approved only).`}
                                </span>
                            </div>
                        </div>
                        <div className="tn-dialog__footer">
                            <button type="button" className="tn-app-btn tn-app-btn--secondary" onClick={() => setExportModalOpen(false)} disabled={isExporting}>
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="tn-app-btn tn-app-btn--primary"
                                onClick={() => handleExportPlaywright(exportIncludePending ? 'include_pending' : 'only')}
                                disabled={isExporting || (!exportIncludePending && metrics.approvedCases === 0)}
                            >
                                <Download size={14} />
                                <span>{isExporting ? 'Exporting…' : 'Download Spec'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export const TestSuiteDetailPageWithToast = (props) => (
    <ToastProvider>
        <TestSuiteDetailPage {...props} />
    </ToastProvider>
);

export default TestSuiteDetailPageWithToast;
