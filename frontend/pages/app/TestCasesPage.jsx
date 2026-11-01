import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, NavLink } from 'react-router-dom';
import {
    ArrowLeft, Check, ChevronRight, Copy, ExternalLink,
    FilePlus2, Pencil, Play, Plus, RefreshCw, Search, Trash2, X,
    Layers, Sparkles, Code, Terminal, Camera, Shield, CheckCircle2,
    XCircle, AlertTriangle, MinusCircle, Clock, Archive, RotateCcw
} from 'lucide-react';
import { sessionService } from '../../services/sessionService';
import { executionService } from '../../services/executionService';
import { DataLoadingState } from '../../components/loading';
import TestCaseEditorModal from '../../components/testcases/TestCaseEditorModal';
import ManualExecutionModal from '../../components/testcases/ManualExecutionModal';
import AutomatedExecutionModal from '../../components/testcases/AutomatedExecutionModal';
import AddToSuiteModal from '../../components/testcases/AddToSuiteModal';
import DeleteConfirmModal from '../../components/testcases/DeleteConfirmModal';
import '../../styles/app/TestCases.css';

const CATEGORY_KEYS = ['testCases', 'tests', 'functional', 'negative', 'edge', 'security', 'nonFunctional', 'apiChecklist', 'api'];
const CATEGORY_LABELS = {
    testCases: 'Functional', tests: 'Functional', functional: 'Functional', negative: 'Negative', edge: 'Edge',
    security: 'Security', nonFunctional: 'Non-functional', apiChecklist: 'API', api: 'API'
};
const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];
const QUICK_FILTERS = [
    ['all', 'All'], ['draft', 'Draft'], ['ready', 'Ready'], ['needs-review', 'Needs Review'],
    ['manual', 'Manual'], ['automated', 'Automated'], ['archived', 'Archived']
];

const getSuiteData = (session) => {
    const suite = session?.suiteData || session?.suite_data || session?.data || session?.suite || null;
    return suite?.suiteData || suite?.suite_data || suite?.data || suite;
};

const getCaseId = (tc) => String(tc?.id || tc?.testCaseId || '');
const getCaseTitle = (tc) => tc?.title || tc?.testScenario || tc?.scenario || '';
const getRequirementId = (req) => req && typeof req === 'object'
    ? req.id || req.reqId || req.requirementId || ''
    : '';

const getRequirementTitle = (req) => typeof req === 'string'
    ? req
    : req?.description || req?.requirement || req?.text || req?.title || '';

const validAutomation = (tc) => {
    const mapping = tc?.automationMapping || tc?.playwrightBinding || {};
    const configured = ['configured', 'enabled', 'ready'].includes(String(mapping.mappingStatus || mapping.status || '').toLowerCase());
    return (configured || Boolean(mapping.scriptCode || mapping.code)) && String(mapping.validationStatus || '').toLowerCase() !== 'invalid'
        && Boolean(mapping.scriptCode || mapping.code || mapping.spec || mapping.script || mapping.scriptRef || mapping.testId || mapping.automationTestId);
};

const getMethod = (tc) => {
    const method = String(tc?.executionType || tc?.executionMethod || tc?.method || '').toLowerCase();
    if (method) return ['automated', 'automation', 'playwright'].includes(method) ? 'automated' : 'manual';
    return tc?.isAutomated || validAutomation(tc) ? 'automated' : 'manual';
};

const getLifecycle = (tc) => {
    const status = String(tc?.status || '').toLowerCase().replaceAll('_', ' ').trim();
    if (tc?.archivedAt || status === 'archived') return 'archived';
    if (status === 'draft') return 'draft';
    if (['ready', 'approved'].includes(status)) return getMethod(tc) === 'automated' && !validAutomation(tc) ? 'needs-review' : 'ready';
    if (['needs review', 'review', 'generated', 'pending'].includes(status)) return 'needs-review';
    return status ? status.replaceAll(' ', '-') : 'ready';
};

const requirementsFromSuite = (suite) => {
    const source = [suite?.understanding?.functional_requirements, suite?.requirements, suite?.traceability?.matrix]
        .find(val => Array.isArray(val) ? val.length : val && typeof val === 'object' && Object.keys(val).length) || [];
    const entries = Array.isArray(source) ? source : Object.entries(source).map(([id, val]) =>
        typeof val === 'object' && val !== null ? { ...val, id: val.id || val.reqId || id } : { id, description: String(val || '') }
    );
    return entries.map(req => ({ id: String(getRequirementId(req) || ''), title: getRequirementTitle(req) })).filter(req => req.id);
};

const flattenSessions = (sessions) => {
    const sessionMap = new Map(sessions.map(s => [String(s.id || s._id), s]));

    return sessions.flatMap(session => {
        const suite = getSuiteData(session);
        if (!suite || typeof suite !== 'object') return [];
        const seen = new Set();
        const sid = String(session.id || session._id || '');

        // 1. Direct suite test cases
        const directCases = CATEGORY_KEYS.flatMap(category => (Array.isArray(suite[category]) ? suite[category] : []).flatMap((tc, idx) => {
            if (!tc || typeof tc !== 'object') return [];
            const id = getCaseId(tc);
            const key = `${sid}:${category}:${id || idx}`;
            if (seen.has(id) && id) return [];
            if (id) seen.add(id);
            const lifecycle = getLifecycle(tc);
            return [{
                key,
                id,
                title: getCaseTitle(tc),
                description: tc.description || tc.testDescription || '',
                preconditions: tc.preconditions || [],
                steps: Array.isArray(tc.steps) ? tc.steps : [],
                expectedResult: tc.expectedResult || tc.expected || '',
                priority: tc.priority || 'Medium',
                type: tc.type || CATEGORY_LABELS[category] || 'Functional',
                method: getMethod(tc),
                lifecycle,
                status: tc.status || '',
                requirementId: String(tc.requirementId || tc.requirementRef || tc.reqId || ''),
                automationMapping: tc.automationMapping || tc.playwrightBinding || null,
                updatedAt: tc.updatedAt || tc.updated_at || tc.createdAt || tc.created_at || session.updatedAt || session.updated_at || null,
                createdAt: tc.createdAt || tc.created_at || session.createdAt || session.created_at || null,
                category,
                sourceIndex: idx,
                raw: tc,
                suiteId: sid,
                suiteName: session.title || session.feature || suite.testSuiteName || suite.feature || 'Untitled suite',
                projectName: session.projectName || suite.projectName || suite.project || '',
                context: session.context || 'web',
                session,
                suite
            }];
        }));

        // 2. Mapped test case references (testCaseRefs)
        const refCases = (Array.isArray(suite.testCaseRefs) ? suite.testCaseRefs : []).flatMap(ref => {
            const srcSession = sessionMap.get(String(ref.sourceSuiteId));
            if (!srcSession) return [];
            const srcSuite = getSuiteData(srcSession);
            if (!srcSuite) return [];
            const targetCase = CATEGORY_KEYS.flatMap(cat => Array.isArray(srcSuite[cat]) ? srcSuite[cat] : [])
                .find(c => getCaseId(c) === String(ref.testCaseId));
            if (!targetCase || seen.has(getCaseId(targetCase))) return [];
            const cid = getCaseId(targetCase);
            seen.add(cid);
            const lifecycle = getLifecycle(targetCase);
            return [{
                key: `${sid}:ref:${cid}`,
                id: cid,
                title: getCaseTitle(targetCase),
                description: targetCase.description || '',
                preconditions: targetCase.preconditions || [],
                steps: Array.isArray(targetCase.steps) ? targetCase.steps : [],
                expectedResult: targetCase.expectedResult || targetCase.expected || '',
                priority: targetCase.priority || 'Medium',
                type: targetCase.type || 'Functional',
                method: getMethod(targetCase),
                lifecycle,
                status: targetCase.status || '',
                requirementId: String(targetCase.requirementId || ''),
                automationMapping: targetCase.automationMapping || null,
                updatedAt: targetCase.updatedAt || session.updatedAt || null,
                createdAt: targetCase.createdAt || session.createdAt || null,
                category: 'referenced',
                sourceIndex: -1,
                raw: targetCase,
                suiteId: sid,
                suiteName: session.title || 'Untitled suite',
                projectName: session.projectName || '',
                context: session.context || 'web',
                isReference: true,
                sourceSuiteId: String(ref.sourceSuiteId),
                sourceSuiteName: srcSession.title || 'Source suite',
                session,
                suite
            }];
        });

        return [...directCases, ...refCases];
    });
};

const formatDate = (val) => {
    if (!val) return 'Not recorded';
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return 'Not recorded';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const formatTimeAgo = (val) => {
    if (!val) return 'Recently';
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return 'Recently';
    const diff = Date.now() - d.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const makeCaseId = (suite, category) => {
    const ids = new Set(CATEGORY_KEYS.flatMap(key => Array.isArray(suite?.[key]) ? suite[key].map(getCaseId) : []));
    const prefix = `TC_${category.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_`;
    const used = [...ids].map(id => Number(id.match(new RegExp(`^${prefix}(\\d+)$`, 'i'))?.[1] || 0));
    let next = Math.max(0, ...used) + 1;
    let id = `${prefix}${String(next).padStart(3, '0')}`;
    while (ids.has(id)) id = `${prefix}${String(++next).padStart(3, '0')}`;
    return id;
};

const TestCasesPage = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // Data state
    const [sessions, setSessions] = useState([]);
    const [runs, setRuns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [retry, setRetry] = useState(0);

    // Context & selection
    const initialSuiteQuery = new URLSearchParams(location.search).get('suiteId') || '';
    const initialCaseQuery = new URLSearchParams(location.search).get('caseId') || '';
    const [suiteId, setSuiteId] = useState(initialSuiteQuery);
    const [selectedKey, setSelectedKey] = useState('');
    const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

    // Filters and toolbar
    const [query, setQuery] = useState('');
    const [quickFilter, setQuickFilter] = useState('all');
    const [priorityFilter, setPriorityFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');
    const [sort, setSort] = useState('updated');
    const [page, setPage] = useState(1);
    const pageSize = 25;

    // Modals
    const [editorOpen, setEditorOpen] = useState(false);
    const [editorMode, setEditorMode] = useState('create');
    const [manualExecOpen, setManualExecOpen] = useState(false);
    const [autoExecOpen, setAutoExecOpen] = useState(false);
    const [addToSuiteOpen, setAddToSuiteOpen] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showScriptPreview, setShowScriptPreview] = useState(false);
    const [toastMessage, setToastMessage] = useState('');

    // Execution history tracking
    const [executionHistory, setExecutionHistory] = useState({ key: '', rows: [], loading: false, error: '' });

    // Show temporary toast notification
    const triggerToast = (msg) => {
        setToastMessage(msg);
        window.setTimeout(() => setToastMessage(''), 3500);
    };

    // Load suites and execution runs from backend
    const loadData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const first = await sessionService.list({ page: 1, limit: 50, sort: 'updatedAt' });
            if (!first?.success) throw new Error(first?.message || 'Test suites could not be loaded.');
            const allSessions = [...(first.data || [])];
            const totalPages = Number(first.pagination?.totalPages || 1);
            for (let currentPage = 2; currentPage <= totalPages; currentPage += 1) {
                const response = await sessionService.list({ page: currentPage, limit: 50, sort: 'updatedAt' });
                if (response?.success && Array.isArray(response.data)) {
                    allSessions.push(...response.data);
                }
            }

            const [runResult] = await Promise.allSettled([
                executionService.listRuns({ page: 1, limit: 100, sort: 'newest' })
            ]);

            setSessions(allSessions);
            if (runResult.status === 'fulfilled' && runResult.value?.success) {
                setRuns(runResult.value.data || []);
            } else {
                setRuns([]);
            }
        } catch (err) {
            setError(err.message || 'Failed to load test cases workspace.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData, retry]);

    // Distinct suite descriptors with computed actual test counts
    const suites = useMemo(() => {
        return sessions.map(session => {
            const sData = getSuiteData(session) || {};
            const directCount = CATEGORY_KEYS.reduce((acc, cat) => acc + (Array.isArray(sData[cat]) ? sData[cat].length : 0), 0);
            const refCount = Array.isArray(sData.testCaseRefs) ? sData.testCaseRefs.length : 0;
            const caseCount = directCount + refCount;
            const updatedAt = session.updatedAt || session.updated_at || session.createdAt;
            return {
                id: String(session.id || session._id),
                name: session.title || session.feature || sData.testSuiteName || sData.feature || 'Untitled suite',
                project: session.projectName || sData.projectName || sData.project || '',
                context: session.context || sData.context || 'web',
                caseCount,
                updatedAt,
                formattedDate: formatDate(updatedAt),
                session
            };
        });
    }, [sessions]);

    // Flatten all test cases across all sessions
    const allCases = useMemo(() => flattenSessions(sessions), [sessions]);

    // Total test cases across all suites
    const totalCasesCount = allCases.length;

    // Sync URL queries
    useEffect(() => {
        const qSuite = new URLSearchParams(location.search).get('suiteId') || '';
        const qCase = new URLSearchParams(location.search).get('caseId') || '';
        if (qSuite !== suiteId) setSuiteId(qSuite);
        if (qCase) {
            const match = allCases.find(c => (!qSuite || c.suiteId === qSuite) && c.id === qCase);
            if (match) {
                setSelectedKey(match.key);
                setMobileDetailOpen(true);
            }
        }
    }, [location.search, allCases]);

    // Filter and sort test cases
    const filteredCases = useMemo(() => {
        const text = query.trim().toLowerCase();
        const filtered = allCases.filter(tc => {
            const matchesSuite = !suiteId || tc.suiteId === String(suiteId);
            const matchesText = !text ||
                `${tc.id} ${tc.title} ${tc.description} ${tc.requirementId} ${tc.suiteName}`.toLowerCase().includes(text);

            let matchesQuick = true;
            if (quickFilter === 'draft') matchesQuick = tc.lifecycle === 'draft';
            else if (quickFilter === 'ready') matchesQuick = tc.lifecycle === 'ready';
            else if (quickFilter === 'needs-review') matchesQuick = tc.lifecycle === 'needs-review';
            else if (quickFilter === 'manual') matchesQuick = tc.method === 'manual';
            else if (quickFilter === 'automated') matchesQuick = tc.method === 'automated';
            else if (quickFilter === 'archived') matchesQuick = tc.lifecycle === 'archived';
            else matchesQuick = tc.lifecycle !== 'archived'; // 'all' excludes archived cases

            const matchesPriority = priorityFilter === 'all' || tc.priority.toLowerCase() === priorityFilter.toLowerCase();
            const matchesType = typeFilter === 'all' || tc.type.toLowerCase() === typeFilter.toLowerCase();

            return matchesSuite && matchesText && matchesQuick && matchesPriority && matchesType;
        });

        filtered.sort((left, right) => {
            if (sort === 'title') return left.title.localeCompare(right.title);
            if (sort === 'priority') return PRIORITIES.indexOf(left.priority) - PRIORITIES.indexOf(right.priority);
            if (sort === 'id') return left.id.localeCompare(right.id);
            if (sort === 'created') {
                return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
            }
            // default: updated
            return new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime();
        });

        return filtered;
    }, [allCases, query, suiteId, quickFilter, priorityFilter, typeFilter, sort]);

    // Active selected test case
    const selectedCase = useMemo(() => {
        return filteredCases.find(tc => tc.key === selectedKey) || null;
    }, [filteredCases, selectedKey]);

    // Auto-select first test case if selection is empty and cases exist
    useEffect(() => {
        if (!selectedKey && filteredCases.length > 0 && !mobileDetailOpen) {
            setSelectedKey(filteredCases[0].key);
        }
    }, [filteredCases, selectedKey, mobileDetailOpen]);

    // Selected suite descriptor
    const selectedSuite = useMemo(() => {
        if (!suiteId) return null;
        return suites.find(s => s.id === String(suiteId)) || null;
    }, [suites, suiteId]);

    // Pagination
    const pageCount = Math.max(1, Math.ceil(filteredCases.length / pageSize));
    const pageCases = useMemo(() => {
        return filteredCases.slice((page - 1) * pageSize, page * pageSize);
    }, [filteredCases, page, pageSize]);

    useEffect(() => { setPage(1); }, [query, suiteId, quickFilter, priorityFilter, typeFilter, sort]);

    // Fetch genuine execution history for selected test case
    useEffect(() => {
        if (!selectedCase) {
            setExecutionHistory({ key: '', rows: [], loading: false, error: '' });
            return;
        }

        let isCurrent = true;
        setExecutionHistory({ key: selectedCase.key, rows: [], loading: true, error: '' });

        const loadCaseExecutions = async () => {
            try {
                const rows = [];
                const matchingRuns = runs.filter(run => String(run.suiteId || run.suite_id || '') === selectedCase.suiteId)
                    .sort((a, b) => new Date(b.startedAt || b.createdAt || b.created_at || 0) - new Date(a.startedAt || a.createdAt || a.created_at || 0));

                for (const run of matchingRuns.slice(0, 15)) {
                    const runRes = await executionService.getRun(run.id).catch(() => null);
                    if (!runRes?.success || !runRes.data) continue;

                    const runCases = runRes.data.cases || [];
                    const caseRecord = runCases.find(c => {
                        const snap = c.caseSnapshot || {};
                        return [snap.id, snap.testCaseId, c.testCaseId].filter(Boolean).map(String).includes(selectedCase.id);
                    });

                    if (!caseRecord) continue;

                    const attempts = Array.isArray(caseRecord.executions) ? caseRecord.executions : [];
                    if (attempts.length > 0) {
                        attempts.forEach(attempt => {
                            rows.push({
                                ...attempt,
                                runId: run.id,
                                runName: run.name || `Run #${run.id.slice(-6)}`,
                                caseStatus: caseRecord.status,
                                artifactCount: Array.isArray(caseRecord.artifacts) ? caseRecord.artifacts.length : 0,
                                durationMs: attempt.durationMs || caseRecord.durationMs || 0
                            });
                        });
                    } else {
                        rows.push({
                            ...caseRecord,
                            runId: run.id,
                            runName: run.name || `Run #${run.id.slice(-6)}`,
                            caseStatus: caseRecord.status,
                            artifactCount: Array.isArray(caseRecord.artifacts) ? caseRecord.artifacts.length : 0,
                            durationMs: caseRecord.durationMs || 0
                        });
                    }
                }

                rows.sort((a, b) => new Date(b.executedAt || b.createdAt || 0) - new Date(a.executedAt || a.createdAt || 0));

                if (isCurrent) {
                    setExecutionHistory({ key: selectedCase.key, rows, loading: false, error: '' });
                }
            } catch (err) {
                if (isCurrent) {
                    setExecutionHistory({ key: selectedCase.key, rows: [], loading: false, error: err.message || 'Execution history unavailable' });
                }
            }
        };

        loadCaseExecutions();
        return () => { isCurrent = false; };
    }, [selectedCase, runs]);

    // Handle user selecting a test case row
    const handleSelectCase = (tc) => {
        setSelectedKey(tc.key);
        setMobileDetailOpen(true);
        const params = new URLSearchParams(location.search);
        if (suiteId) params.set('suiteId', tc.suiteId);
        params.set('caseId', tc.id);
        navigate({ pathname: '/app/test-cases', search: params.toString() }, { replace: true });
    };

    // Suite change handler
    const handleSuiteChange = (newSuiteId) => {
        setSuiteId(newSuiteId);
        setSelectedKey('');
        setMobileDetailOpen(false);
        const params = new URLSearchParams(location.search);
        if (newSuiteId) {
            params.set('suiteId', newSuiteId);
        } else {
            params.delete('suiteId');
        }
        params.delete('caseId');
        navigate({ pathname: '/app/test-cases', search: params.toString() }, { replace: true });
    };

    // Save test case mutations to backend
    const patchCase = async (targetSession, oldCase, nextCase) => {
        const suiteData = structuredClone(getSuiteData(targetSession) || {});
        const sourceKeys = CATEGORY_KEYS.filter(key => Array.isArray(suiteData[key]));
        let targetKey = oldCase?.category || '';

        if (!targetKey) {
            if (suiteData.testCases?.length) targetKey = 'testCases';
            else if (suiteData.tests?.length) targetKey = 'tests';
            else {
                const category = String(nextCase.type || 'Functional').toLowerCase();
                targetKey = category === 'negative' ? 'negative'
                    : category === 'edge' ? 'edge'
                        : category === 'security' ? 'security'
                            : category === 'api' ? 'apiChecklist'
                                : category === 'non-functional' ? 'nonFunctional' : 'functional';
            }
        }

        if (!Array.isArray(suiteData[targetKey])) suiteData[targetKey] = [];

        if (oldCase) {
            let found = false;
            for (const key of sourceKeys) {
                const index = oldCase.id
                    ? suiteData[key].findIndex(item => getCaseId(item) === oldCase.id)
                    : (key === oldCase.category ? oldCase.sourceIndex : -1);
                if (index >= 0) {
                    suiteData[key][index] = nextCase;
                    found = true;
                    break;
                }
            }
            if (!found) throw new Error('This test case no longer exists in the suite. Refresh and try again.');
        } else {
            suiteData[targetKey].push(nextCase);
        }

        const sid = targetSession.id || targetSession._id;
        const response = await sessionService.update(sid, {
            suiteData,
            testCaseMutation: {
                action: oldCase ? 'update' : 'create',
                previousTestCaseId: oldCase?.id || '',
                testCaseId: nextCase.id
            }
        });

        if (!response?.success) {
            throw new Error(response?.message || 'Test case changes could not be saved.');
        }

        window.dispatchEvent(new Event('historyUpdated'));
        await loadData();
        setSelectedKey(`${sid}:${targetKey}:${nextCase.id}`);
        setMobileDetailOpen(true);
        triggerToast(`Test case ${nextCase.id} saved successfully.`);
    };

    // Duplicate test case handler
    const handleDuplicateCase = async () => {
        if (!selectedCase) return;
        const targetSession = selectedCase.session;
        const suiteData = getSuiteData(targetSession);
        const newId = makeCaseId(suiteData, String(selectedCase.type).toLowerCase().replace(/[^a-z0-9]+/g, '_'));
        const clone = {
            ...structuredClone(selectedCase.raw),
            id: newId,
            title: `${selectedCase.title} (copy)`,
            status: 'Draft',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        setIsSaving(true);
        try {
            await patchCase(targetSession, null, clone);
            triggerToast(`Duplicated as ${newId} (Draft).`);
        } catch (err) {
            alert(`Duplicate error: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    // Delete test case handler
    const handleDeleteCase = async () => {
        if (!selectedCase) return;
        setIsSaving(true);
        try {
            const suiteData = structuredClone(getSuiteData(selectedCase.session) || {});
            if (selectedCase.id) {
                for (const cat of CATEGORY_KEYS) {
                    if (Array.isArray(suiteData[cat])) {
                        suiteData[cat] = suiteData[cat].filter(item => getCaseId(item) !== selectedCase.id);
                    }
                }
            } else if (Array.isArray(suiteData[selectedCase.category])) {
                suiteData[selectedCase.category] = suiteData[selectedCase.category].filter((_, idx) => idx !== selectedCase.sourceIndex);
            }

            const sid = selectedCase.suiteId;
            const res = await sessionService.update(sid, {
                suiteData,
                testCaseMutation: {
                    action: 'delete',
                    testCaseId: selectedCase.id
                }
            });

            if (!res?.success) throw new Error(res?.message || 'Failed to delete test case.');
            window.dispatchEvent(new Event('historyUpdated'));
            setDeleteModalOpen(false);
            setSelectedKey('');
            setMobileDetailOpen(false);
            await loadData();
            triggerToast(`Test case ${selectedCase.id} deleted.`);
        } catch (err) {
            alert(`Delete error: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    // Archive / Restore test case handler
    const handleToggleArchive = async () => {
        if (!selectedCase) return;
        const isArchived = selectedCase.lifecycle === 'archived';
        const nextCase = {
            ...selectedCase.raw,
            status: isArchived ? 'Ready' : 'Archived',
            archivedAt: isArchived ? null : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        setIsSaving(true);
        try {
            await patchCase(selectedCase.session, selectedCase, nextCase);
            triggerToast(isArchived ? `Restored ${selectedCase.id} to active suite.` : `Archived ${selectedCase.id}.`);
        } catch (err) {
            alert(`Archive error: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    // Add copy of case to another suite
    const handleAddToSuite = async (targetId) => {
        const targetSuite = suites.find(s => s.id === targetId);
        if (!selectedCase || !targetSuite) return;
        const targetData = getSuiteData(targetSuite.session) || {};
        const newId = makeCaseId(targetData, String(selectedCase.type).toLowerCase().replace(/[^a-z0-9]+/g, '_'));
        const copy = {
            ...structuredClone(selectedCase.raw),
            id: newId,
            status: 'Draft',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        setIsSaving(true);
        try {
            await patchCase(targetSuite.session, null, copy);
            setSuiteId(targetId);
            setAddToSuiteOpen(false);
            triggerToast(`Added ${newId} to ${targetSuite.name}.`);
        } catch (err) {
            alert(`Add to suite error: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    // Manual execution record handler
    const handleRecordManualExecution = async ({ status: outcomeStatus, actualResult, notes, durationMs, artifact }) => {
        if (!selectedCase) return;
        setIsSaving(true);
        try {
            // Find existing run or create single-case ad-hoc run
            let runId;
            let runCaseId;
            const existingRun = runs.find(r => String(r.suiteId || r.suite_id) === selectedCase.suiteId && r.status !== 'completed');

            if (existingRun) {
                runId = existingRun.id;
                const runRes = await executionService.getRun(runId);
                const runCases = runRes?.data?.cases || [];
                const found = runCases.find(c => {
                    const snap = c.caseSnapshot || {};
                    return [snap.id, snap.testCaseId, c.testCaseId].filter(Boolean).map(String).includes(selectedCase.id);
                });
                runCaseId = found?.id;
            }

            if (!runId || !runCaseId) {
                const newRunRes = await executionService.createRun({
                    name: `Manual Verification · ${selectedCase.id}`,
                    suiteId: selectedCase.suiteId,
                    executionType: 'manual',
                    caseIds: [selectedCase.id]
                });
                if (!newRunRes?.success || !newRunRes.data) throw new Error('Failed to initialize execution run.');
                runId = newRunRes.data.id;
                runCaseId = newRunRes.data.cases?.[0]?.id;
            }

            // Record execution attempt
            await executionService.recordExecution(runId, runCaseId, {
                status: outcomeStatus,
                actualResult,
                notes,
                durationMs,
                executorType: 'manual',
                artifact
            });

            triggerToast(`Recorded manual outcome: ${outcomeStatus.toUpperCase()} (${(durationMs / 1000).toFixed(1)}s)`);
            await loadData();
        } catch (err) {
            throw new Error(`Execution record failed: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    // Open execution modal based on method
    const handleOpenExecution = () => {
        if (!selectedCase) return;
        if (selectedCase.method === 'automated') {
            setAutoExecOpen(true);
        } else {
            setManualExecOpen(true);
        }
    };

    // Check if any filter is active
    const hasActiveFilters = Boolean(
        query.trim() ||
        quickFilter !== 'all' ||
        priorityFilter !== 'all' ||
        typeFilter !== 'all' ||
        sort !== 'updated'
    );

    const handleClearFilters = () => {
        setQuery('');
        setQuickFilter('all');
        setPriorityFilter('all');
        setTypeFilter('all');
        setSort('updated');
    };

    const suiteLabel = selectedSuite
        ? `${selectedSuite.project ? selectedSuite.project + ' / ' : ''}${selectedSuite.name}`
        : 'All Test Suites';

    return (
        <div className={`tc-page ${mobileDetailOpen ? 'tc-mobile-detail-open' : ''}`}>
            {/* ─── HEADER & BREADCRUMB ─── */}
            <header className="tc-header">
                <div className="tc-breadcrumb">
                    <NavLink to="/app/workspace">Quality</NavLink>
                    <span>/</span>
                    <button type="button" onClick={() => handleSuiteChange('')}>Test Cases</button>
                    {selectedSuite && (
                        <>
                            <span>/</span>
                            <span>{selectedSuite.name}</span>
                        </>
                    )}
                </div>

                <div className="tc-header-main">
                    <div>
                        <h1>Test Cases</h1>
                        <p>
                            {suiteLabel} <span>·</span> {filteredCases.length} {filteredCases.length === 1 ? 'case' : 'cases'}
                            {suiteId && selectedSuite && ` (${selectedSuite.context.toUpperCase()})`}
                        </p>
                    </div>

                    <div className="tc-header-actions">
                        {/* Dynamic Suite Selector */}
                        <select
                            className="tc-suite-selector"
                            aria-label="Filter by test suite"
                            value={suiteId}
                            onChange={e => handleSuiteChange(e.target.value)}
                        >
                            <option value="">All Test Cases ({totalCasesCount})</option>
                            {suites.map(s => (
                                <option key={s.id} value={s.id}>
                                    {s.name} ({s.context.toUpperCase()} · {s.caseCount} {s.caseCount === 1 ? 'case' : 'cases'} · {s.formattedDate})
                                </option>
                            ))}
                        </select>

                        <button
                            type="button"
                            className="tc-primary"
                            onClick={() => {
                                setEditorMode('create');
                                setEditorOpen(true);
                            }}
                        >
                            <Plus size={15} />
                            <span>Create Test Case</span>
                        </button>
                    </div>
                </div>

                {/* Search & Secondary Filter Toolbar */}
                <div className="tc-toolbar">
                    <label className="tc-search">
                        <Search size={14} />
                        <input
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Search by ID, title, description, or requirement..."
                            aria-label="Search test cases"
                        />
                    </label>

                    <select
                        value={priorityFilter}
                        onChange={e => setPriorityFilter(e.target.value)}
                        aria-label="Filter by priority"
                    >
                        <option value="all">All Priorities</option>
                        {PRIORITIES.map(p => (
                            <option key={p} value={p.toLowerCase()}>{p} Priority</option>
                        ))}
                    </select>

                    <select
                        value={typeFilter}
                        onChange={e => setTypeFilter(e.target.value)}
                        aria-label="Filter by type"
                    >
                        <option value="all">All Categories</option>
                        <option value="Functional">Functional</option>
                        <option value="Negative">Negative</option>
                        <option value="Edge">Edge</option>
                        <option value="Security">Security</option>
                        <option value="API">API</option>
                        <option value="Non-functional">Non-functional</option>
                    </select>

                    <select
                        value={sort}
                        onChange={e => setSort(e.target.value)}
                        aria-label="Sort test cases"
                    >
                        <option value="updated">Recently Updated</option>
                        <option value="created">Created Date</option>
                        <option value="title">Title (A to Z)</option>
                        <option value="priority">Priority (High to Low)</option>
                        <option value="id">Test ID (A to Z)</option>
                    </select>

                    <button
                        type="button"
                        className="tc-icon-button"
                        title="Refresh test cases"
                        aria-label="Refresh test cases"
                        onClick={() => setRetry(v => v + 1)}
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>

                    {hasActiveFilters && (
                        <button
                            type="button"
                            className="tc-clear-filters"
                            onClick={handleClearFilters}
                            title="Reset search and filters"
                        >
                            Clear Filters
                        </button>
                    )}
                </div>

                {/* Quick Lifecycle & Method Filters */}
                <nav className="tc-filters" aria-label="Quick test case filters">
                    {QUICK_FILTERS.map(([key, label]) => (
                        <button
                            type="button"
                            key={key}
                            className={quickFilter === key ? 'active' : ''}
                            onClick={() => setQuickFilter(key)}
                        >
                            {label}
                        </button>
                    ))}
                </nav>
            </header>

            {toastMessage && (
                <div style={{
                    position: 'fixed',
                    bottom: '24px',
                    right: '24px',
                    zIndex: 2000,
                    background: '#151D18',
                    border: '1px solid var(--tc-jade)',
                    borderRadius: '5px',
                    padding: '10px 16px',
                    color: '#FFFFFF',
                    fontSize: '0.78rem',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <CheckCircle2 size={16} color="var(--tc-jade)" />
                    <span>{toastMessage}</span>
                </div>
            )}

            {error && (
                <div className="tc-error" role="alert">
                    <span>{error}</span>
                    <button type="button" onClick={() => setRetry(v => v + 1)}>Retry</button>
                </div>
            )}

            {/* ─── MAIN WORKSPACE TWO-PANEL LAYOUT ─── */}
            {loading ? (
                <DataLoadingState message="Loading test cases repository..." />
            ) : (
                <div className="tc-workspace">
                    {/* ─── LEFT PANEL: TEST CASE LIST (~35% width) ─── */}
                    <section className="tc-list" aria-label="Test case list">
                        <div className="tc-list-head">
                            <span>Test Case</span>
                            <span>Type · Priority · Status</span>
                            <span>Updated</span>
                            <span />
                        </div>

                        {/* Empty States */}
                        {pageCases.length === 0 ? (
                            selectedSuite && selectedSuite.caseCount === 0 ? (
                                <div className="tc-empty-suite-state">
                                    <div className="tc-empty-icon">
                                        <Layers size={28} />
                                    </div>
                                    <h3>No test cases in "{selectedSuite.name}"</h3>
                                    <p>
                                        This {selectedSuite.context.toUpperCase()} test suite is currently empty.
                                        Create manual or automated test cases to begin test execution, or generate a full test suite with AI.
                                    </p>
                                    <div className="tc-empty-actions">
                                        <button
                                            type="button"
                                            className="tc-primary"
                                            onClick={() => {
                                                setEditorMode('create');
                                                setEditorOpen(true);
                                            }}
                                        >
                                            <Plus size={14} /> Create Test Case
                                        </button>
                                        <button
                                            type="button"
                                            className="tc-secondary"
                                            onClick={() => navigate(`/app/workspace/${selectedSuite.id}`)}
                                        >
                                            <Sparkles size={14} /> Open in AI Workspace
                                        </button>
                                        <button
                                            type="button"
                                            className="tc-text-btn"
                                            onClick={() => handleSuiteChange('')}
                                        >
                                            View All Test Cases
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="tc-empty">
                                    <FilePlus2 size={24} color="var(--tc-jade)" />
                                    <strong style={{ fontSize: '0.85rem' }}>
                                        {allCases.length ? 'No test cases match these filters.' : 'No saved test cases found.'}
                                    </strong>
                                    <span>
                                        {allCases.length ? 'Adjust or clear your search terms and category filters.' : 'Create a suite in the AI Workspace to begin.'}
                                    </span>
                                    {hasActiveFilters && (
                                        <button type="button" className="tc-secondary" onClick={handleClearFilters} style={{ marginTop: '8px' }}>
                                            Clear all filters
                                        </button>
                                    )}
                                </div>
                            )
                        ) : (
                            pageCases.map(tc => {
                                const isSelected = selectedCase?.key === tc.key;
                                return (
                                    <button
                                        type="button"
                                        key={tc.key}
                                        className={`tc-row ${isSelected ? 'selected' : ''}`}
                                        onClick={() => handleSelectCase(tc)}
                                    >
                                        <span className="tc-row-main">
                                            <span className="tc-id">{tc.id || 'TC-NEW'}</span>
                                            <strong>{tc.title}</strong>
                                            {!suiteId && <span className="tc-suite-tag">{tc.suiteName}</span>}
                                        </span>

                                        <span className="tc-row-meta">
                                            <span className="tc-cat-badge">{tc.type}</span>
                                            <span className={`tc-priority-badge ${tc.priority.toLowerCase()}`}>
                                                {tc.priority}
                                            </span>
                                            <span className={`tc-status tc-status-${tc.lifecycle}`}>
                                                {tc.lifecycle.replaceAll('-', ' ')}
                                            </span>
                                            <span className={`tc-method ${tc.method}`}>
                                                {tc.method === 'automated' ? 'Playwright' : 'Manual'}
                                            </span>
                                        </span>

                                        <span className="tc-row-date">{formatTimeAgo(tc.updatedAt)}</span>
                                        <ChevronRight size={14} />
                                    </button>
                                );
                            })
                        )}

                        {/* Pagination Bar */}
                        {pageCount > 1 && (
                            <div className="tc-pagination">
                                <span>
                                    {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredCases.length)} of {filteredCases.length}
                                </span>
                                <button type="button" disabled={page <= 1} onClick={() => setPage(v => v - 1)}>
                                    Previous
                                </button>
                                <button type="button" disabled={page >= pageCount} onClick={() => setPage(v => v + 1)}>
                                    Next
                                </button>
                            </div>
                        )}
                    </section>

                    {/* ─── RIGHT PANEL: SELECTED TEST CASE DETAIL (~65% width) ─── */}
                    {selectedCase ? (
                        <aside className="tc-detail" aria-label="Test case details">
                            <button
                                type="button"
                                className="tc-mobile-back"
                                onClick={() => setMobileDetailOpen(false)}
                            >
                                <ArrowLeft size={14} /> Back to test case list
                            </button>

                            {/* Top Bar: Identity & Actions */}
                            <div className="tc-detail-top">
                                <div>
                                    <span className="tc-id" style={{ fontSize: '0.8rem' }}>{selectedCase.id}</span>
                                    <span className={`tc-status tc-status-${selectedCase.lifecycle}`}>
                                        {selectedCase.lifecycle.replaceAll('-', ' ')}
                                    </span>
                                    <span className={`tc-priority-badge ${selectedCase.priority.toLowerCase()}`}>
                                        {selectedCase.priority} Priority
                                    </span>
                                </div>

                                <div className="tc-actions">
                                    <button
                                        type="button"
                                        aria-label="Edit test case"
                                        title="Edit test case"
                                        onClick={() => {
                                            setEditorMode('edit');
                                            setEditorOpen(true);
                                        }}
                                    >
                                        <Pencil size={14} />
                                    </button>
                                    <button
                                        type="button"
                                        aria-label="Duplicate test case"
                                        title="Duplicate test case"
                                        onClick={handleDuplicateCase}
                                        disabled={isSaving}
                                    >
                                        <Copy size={14} />
                                    </button>
                                    <button
                                        type="button"
                                        aria-label={selectedCase.lifecycle === 'archived' ? 'Restore test case' : 'Archive test case'}
                                        title={selectedCase.lifecycle === 'archived' ? 'Restore test case' : 'Archive test case'}
                                        onClick={handleToggleArchive}
                                        disabled={isSaving}
                                    >
                                        {selectedCase.lifecycle === 'archived' ? <RotateCcw size={14} /> : <Archive size={14} />}
                                    </button>
                                    <button
                                        type="button"
                                        aria-label="Delete test case"
                                        title="Delete test case"
                                        onClick={() => setDeleteModalOpen(true)}
                                        disabled={isSaving}
                                    >
                                        <Trash2 size={14} color="var(--tc-fail)" />
                                    </button>
                                </div>
                            </div>

                            <h2>{selectedCase.title}</h2>

                            {/* Metadata Facts Strip */}
                            <div className="tc-facts">
                                <span>Category: <strong style={{ color: '#FFFFFF' }}>{selectedCase.type}</strong></span>
                                <span>•</span>
                                <span>Method: <strong style={{ color: selectedCase.method === 'automated' ? 'var(--tc-blue)' : '#FFFFFF' }}>
                                    {selectedCase.method === 'automated' ? 'Playwright Automated' : 'Manual Verification'}
                                </strong></span>
                                <span>•</span>
                                <span>Updated: <strong style={{ color: '#FFFFFF' }}>{formatDate(selectedCase.updatedAt)}</strong></span>
                                {selectedCase.suiteName && (
                                    <>
                                        <span>•</span>
                                        <span>Suite: <strong style={{ color: '#FFFFFF' }}>{selectedCase.suiteName}</strong></span>
                                    </>
                                )}
                            </div>

                            {/* Prominent Execution Action Bar */}
                            <div className="tc-execute-bar">
                                <button
                                    type="button"
                                    className="tc-execute"
                                    onClick={handleOpenExecution}
                                    disabled={!selectedCase.id}
                                    title="Record or run execution"
                                >
                                    <Play size={14} />
                                    <span>{selectedCase.method === 'automated' ? 'Run Playwright Automation' : 'Execute Test Scenario'}</span>
                                </button>
                                <button
                                    type="button"
                                    className="tc-secondary"
                                    onClick={() => navigate(`/app/test-suites/${selectedCase.suiteId}?testCaseId=${encodeURIComponent(selectedCase.id)}&execute=1`)}
                                    title="Open full suite in Run Execution Workspace"
                                >
                                    <ExternalLink size={13} />
                                    <span>Open in Run Workspace</span>
                                </button>
                            </div>

                            {/* Section 1: Overview & Description */}
                            {selectedCase.description && (
                                <section className="tc-detail-section">
                                    <h3>Scenario Description</h3>
                                    <p>{selectedCase.description}</p>
                                </section>
                            )}

                            {/* Section 2: Preconditions */}
                            <section className="tc-detail-section">
                                <h3>Preconditions</h3>
                                <p>
                                    {Array.isArray(selectedCase.preconditions) && selectedCase.preconditions.length > 0
                                        ? selectedCase.preconditions.join('\n')
                                        : 'None specified.'}
                                </p>
                            </section>

                            {/* Section 3: Structured Test Steps */}
                            <section className="tc-detail-section">
                                <h3>Test Execution Procedure ({selectedCase.steps.length} steps)</h3>
                                {selectedCase.steps.length > 0 ? (
                                    <div className="tc-detail-steps">
                                        {selectedCase.steps.map((step, idx) => (
                                            <div className="tc-detail-step-card" key={idx}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <span className="tc-detail-step-num">Step {idx + 1}</span>
                                                    {step.testData && (
                                                        <span className="tc-detail-step-data">
                                                            Data: {step.testData}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="tc-detail-step-action">
                                                    {typeof step === 'object' ? (step.action || step.description || '') : String(step)}
                                                </div>
                                                {step.expected && (
                                                    <div className="tc-detail-step-expected">
                                                        ↳ Expected: {typeof step === 'object' ? (step.expected || step.expectedResult || '') : ''}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p>No individual execution steps recorded.</p>
                                )}
                            </section>

                            {/* Section 4: Target Expected Result */}
                            <section className="tc-detail-section">
                                <h3>Acceptance Criteria / Overall Expected Result</h3>
                                <p style={{ color: 'var(--tc-jade)' }}>
                                    {selectedCase.expectedResult || 'System should complete flow without errors or assertion differences.'}
                                </p>
                            </section>

                            {/* Section 5: Requirement Traceability Mapping */}
                            <section className="tc-detail-section">
                                <h3>Requirement Traceability</h3>
                                {selectedCase.requirementId ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <button
                                            type="button"
                                            className="tc-text-link"
                                            onClick={() => navigate(`/app/coverage?suiteId=${encodeURIComponent(selectedCase.suiteId)}&requirementId=${encodeURIComponent(selectedCase.requirementId)}`)}
                                            title="View requirement in Coverage Matrix"
                                        >
                                            <Shield size={13} color="var(--tc-jade)" />
                                            <strong>{selectedCase.requirementId}</strong>
                                            <ExternalLink size={12} />
                                        </button>
                                    </div>
                                ) : (
                                    <p style={{ color: 'var(--tc-text-dim)' }}>
                                        No specification requirement currently linked. Click Edit to associate this test case with a functional requirement.
                                    </p>
                                )}
                            </section>

                            {/* Section 6: Suite Associations */}
                            <section className="tc-detail-section">
                                <h3>Suite Associations</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <button
                                            type="button"
                                            className="tc-text-link"
                                            onClick={() => navigate(`/app/test-suites/${selectedCase.suiteId}?testCaseId=${encodeURIComponent(selectedCase.id)}`)}
                                            title="Open test suite specification"
                                        >
                                            <Layers size={13} color="var(--tc-jade)" />
                                            <span>{selectedCase.suiteName}</span>
                                            <ExternalLink size={12} />
                                        </button>
                                        <span style={{ fontSize: '0.65rem', color: 'var(--tc-text-dim)' }}>Parent Suite</span>
                                    </div>

                                    {suites.length > 1 && (
                                        <button
                                            type="button"
                                            className="tc-text-link"
                                            onClick={() => setAddToSuiteOpen(true)}
                                            style={{ marginTop: '4px' }}
                                        >
                                            <FilePlus2 size={13} />
                                            <span>Add a copy to another test suite</span>
                                        </button>
                                    )}
                                </div>
                            </section>

                            {/* Section 7: Automation Information */}
                            <section className="tc-detail-section">
                                <h3>Playwright Automation Ledger</h3>
                                {selectedCase.method === 'automated' ? (
                                    <div className="tc-automation">
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <span className={validAutomation(selectedCase.raw) ? 'mapped' : 'unmapped'}>
                                                {validAutomation(selectedCase.raw) ? '✓ Configured & Validated' : '⚠ Unvalidated / Needs Mapping'}
                                            </span>
                                            <span style={{ fontSize: '0.68rem', color: 'var(--tc-text-dim)' }}>
                                                {selectedCase.automationMapping?.framework || 'Playwright (Chromium)'}
                                            </span>
                                        </div>

                                        <div style={{ fontSize: '0.7rem' }}>
                                            Script Target: <code>{selectedCase.automationMapping?.scriptRef || selectedCase.automationMapping?.automationTestId || 'Custom embedded script'}</code>
                                        </div>

                                        {selectedCase.automationMapping?.scriptCode && (
                                            <div>
                                                <button
                                                    type="button"
                                                    className="tc-code-toggle"
                                                    onClick={() => setShowScriptPreview(!showScriptPreview)}
                                                >
                                                    <Code size={13} />
                                                    <span>{showScriptPreview ? 'Hide Script Code' : 'View Script Code'}</span>
                                                </button>
                                                {showScriptPreview && (
                                                    <pre className="tc-code-block">
                                                        {selectedCase.automationMapping.scriptCode}
                                                    </pre>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <p>Manual test case — Verified through step-by-step human execution. Can be automated with Playwright.</p>
                                )}
                            </section>

                            {/* Section 8: Execution History */}
                            <section className="tc-detail-section">
                                <h3>Execution History</h3>
                                {executionHistory.loading ? (
                                    <span className="tc-muted">Querying execution records…</span>
                                ) : executionHistory.error ? (
                                    <span className="tc-error-text">{executionHistory.error}</span>
                                ) : executionHistory.rows.length > 0 ? (
                                    <div className="tc-executions">
                                        {executionHistory.rows.map((row, idx) => {
                                            const st = String(row.status || row.caseStatus || 'not_run').toLowerCase();
                                            return (
                                                <div className="tc-execution-item" key={idx}>
                                                    <div className="tc-execution-left">
                                                        <span className={`tc-status tc-status-${st}`}>
                                                            {st.replace('_', ' ')}
                                                        </span>
                                                        <span style={{ color: '#FFFFFF', fontWeight: 500 }}>
                                                            {row.runName || `Run #${String(row.runId).slice(-6)}`}
                                                        </span>
                                                    </div>

                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <span className="tc-execution-dur">
                                                            {row.durationMs ? `${(row.durationMs / 1000).toFixed(1)}s` : '—'}
                                                        </span>
                                                        <span style={{ color: 'var(--tc-text-dim)', fontSize: '0.66rem' }}>
                                                            {row.executedAt || row.createdAt ? formatDate(row.executedAt || row.createdAt) : ''}
                                                        </span>
                                                        <NavLink
                                                            to={`/app/runs/${row.runId}?tab=report&caseId=${encodeURIComponent(selectedCase.id)}`}
                                                            className="tc-text-link"
                                                            title="Inspect Execution Report"
                                                        >
                                                            <span>Report</span>
                                                            <ExternalLink size={11} />
                                                        </NavLink>
                                                        {row.artifactCount > 0 && (
                                                            <NavLink
                                                                to={`/app/runs/${row.runId}?tab=artifacts&caseId=${encodeURIComponent(selectedCase.id)}`}
                                                                className="tc-text-link"
                                                                title="View Evidence Artifacts"
                                                            >
                                                                <Camera size={11} />
                                                                <span>Evidence</span>
                                                            </NavLink>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p>No historical execution records found. Click "Execute" to run this test case.</p>
                                )}
                            </section>
                        </aside>
                    ) : (
                        <aside className="tc-detail tc-detail-empty">
                            <span>Select a test case from the list to inspect its specification, mapping, and execution records.</span>
                        </aside>
                    )}
                </div>
            )}

            {/* ─── MODALS ─── */}
            <TestCaseEditorModal
                isOpen={editorOpen}
                onClose={() => setEditorOpen(false)}
                mode={editorMode}
                initialCase={editorMode === 'edit' ? selectedCase : null}
                suites={suites}
                selectedSuiteId={suiteId || suites[0]?.id || ''}
                onSave={async (targetSuiteId, oldCase, nextCase, desiredStatus) => {
                    const targetSession = suites.find(s => s.id === targetSuiteId)?.session;
                    if (!targetSession) throw new Error('Target suite was not found.');
                    const caseWithId = {
                        ...nextCase,
                        id: nextCase.id || makeCaseId(getSuiteData(targetSession), String(nextCase.type).toLowerCase().replace(/[^a-z0-9]+/g, '_'))
                    };
                    await patchCase(targetSession, oldCase, caseWithId);
                }}
                isSaving={isSaving}
            />

            <ManualExecutionModal
                isOpen={manualExecOpen}
                onClose={() => setManualExecOpen(false)}
                testCase={selectedCase}
                onRecord={handleRecordManualExecution}
                isRecording={isSaving}
            />

            <AutomatedExecutionModal
                isOpen={autoExecOpen}
                onClose={() => setAutoExecOpen(false)}
                testCase={selectedCase}
                onExecutionComplete={async () => {
                    await loadData();
                    triggerToast(`Automated execution completed for ${selectedCase.id}.`);
                }}
            />

            <AddToSuiteModal
                isOpen={addToSuiteOpen}
                onClose={() => setAddToSuiteOpen(false)}
                testCase={selectedCase}
                suites={suites}
                onAdd={handleAddToSuite}
                isSaving={isSaving}
            />

            <DeleteConfirmModal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                testCase={selectedCase}
                onConfirm={handleDeleteCase}
                isDeleting={isSaving}
            />
        </div>
    );
};

export default TestCasesPage;
