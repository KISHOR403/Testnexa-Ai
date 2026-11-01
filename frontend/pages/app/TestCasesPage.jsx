import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, NavLink } from 'react-router-dom';
import {
    ArrowLeft, Check, ChevronRight, ChevronDown, Copy, ExternalLink,
    FilePlus2, Pencil, Play, Plus, RefreshCw, Search, Trash2, X,
    Layers, Sparkles, Code, Terminal, Camera, Shield, CheckCircle2,
    XCircle, AlertTriangle, MinusCircle, Clock, Archive, RotateCcw,
    Folder, FolderOpen, Filter, PanelLeftClose, PanelLeftOpen,
    PanelRightClose, PanelRightOpen, Maximize2, Minimize2, Tag,
    SlidersHorizontal, Layers3
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
    ['all', 'All Active'], ['draft', 'Draft'], ['ready', 'Ready'], ['needs-review', 'Needs Review'],
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

    // Layout panels state
    const [isSuiteNavCollapsed, setIsSuiteNavCollapsed] = useState(false);
    const [isDetailPanelCollapsed, setIsDetailPanelCollapsed] = useState(false);
    const [groupBySuite, setGroupBySuite] = useState(true);
    const [expandedSuiteNavIds, setExpandedSuiteNavIds] = useState(new Set());
    const [collapsedGroupIds, setCollapsedGroupIds] = useState(new Set());

    // Context & selection
    const initialSuiteQuery = new URLSearchParams(location.search).get('suiteId') || '';
    const initialCaseQuery = new URLSearchParams(location.search).get('caseId') || '';
    const [suiteId, setSuiteId] = useState(initialSuiteQuery);
    const [selectedKey, setSelectedKey] = useState('');
    const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

    // Filters and toolbar
    const [suiteFilterText, setSuiteFilterText] = useState('');
    const [query, setQuery] = useState('');
    const [quickFilter, setQuickFilter] = useState('all');
    const [priorityFilter, setPriorityFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');
    const [requirementFilter, setRequirementFilter] = useState('all');
    const [executionStatusFilter, setExecutionStatusFilter] = useState('all');
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
    const [recentExecutionMap, setRecentExecutionMap] = useState({});

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

    // Distinct suite descriptors with actual counts & category breakdown
    const suites = useMemo(() => {
        return sessions.map(session => {
            const sData = getSuiteData(session) || {};
            const sid = String(session.id || session._id);

            // Compute category counts
            const categoryBreakdown = {};
            let directCount = 0;
            let archivedCount = 0;

            CATEGORY_KEYS.forEach(cat => {
                const items = Array.isArray(sData[cat]) ? sData[cat] : [];
                if (items.length > 0) {
                    const label = CATEGORY_LABELS[cat] || 'Functional';
                    categoryBreakdown[label] = (categoryBreakdown[label] || 0) + items.length;
                    directCount += items.length;
                    items.forEach(tc => {
                        if (tc?.archivedAt || tc?.status === 'archived' || tc?.status === 'Archived') {
                            archivedCount += 1;
                        }
                    });
                }
            });

            const refCount = Array.isArray(sData.testCaseRefs) ? sData.testCaseRefs.length : 0;
            const totalCount = directCount + refCount;
            const activeCount = Math.max(0, totalCount - archivedCount);
            const updatedAt = session.updatedAt || session.updated_at || session.createdAt;

            return {
                id: sid,
                name: session.title || session.feature || sData.testSuiteName || sData.feature || 'Untitled suite',
                project: session.projectName || sData.projectName || sData.project || 'Default Project',
                context: (session.context || sData.context || 'web').toLowerCase(),
                status: session.status || 'Ready',
                caseCount: totalCount,
                activeCount,
                archivedCount,
                categoryBreakdown: Object.entries(categoryBreakdown).map(([label, count]) => ({ label, count })),
                updatedAt,
                formattedDate: formatDate(updatedAt),
                session,
                sData
            };
        });
    }, [sessions]);

    // Flatten all test cases across all sessions
    const allCases = useMemo(() => flattenSessions(sessions), [sessions]);

    // Deduplicate unique test cases across all suites for "All Test Cases" view
    const uniqueCases = useMemo(() => {
        const seen = new Map();
        allCases.forEach(tc => {
            const idKey = tc.id ? String(tc.id) : tc.key;
            if (!seen.has(idKey)) {
                seen.set(idKey, {
                    ...tc,
                    associatedSuites: [{ id: tc.suiteId, name: tc.suiteName, isNative: !tc.isReference }]
                });
            } else {
                const existing = seen.get(idKey);
                if (!existing.associatedSuites.some(s => s.id === tc.suiteId)) {
                    existing.associatedSuites.push({ id: tc.suiteId, name: tc.suiteName, isNative: !tc.isReference });
                }
            }
        });
        return Array.from(seen.values());
    }, [allCases]);

    // Unique requirements extracted across available suites
    const availableRequirements = useMemo(() => {
        const reqMap = new Map();
        const targetCases = suiteId ? allCases.filter(c => c.suiteId === suiteId) : allCases;
        targetCases.forEach(c => {
            if (c.requirementId) {
                reqMap.set(c.requirementId, (reqMap.get(c.requirementId) || 0) + 1);
            }
        });
        return Array.from(reqMap.entries()).map(([id, count]) => ({ id, count }));
    }, [allCases, suiteId]);

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
        const baseSet = suiteId ? allCases.filter(tc => tc.suiteId === String(suiteId)) : allCases;

        const filtered = baseSet.filter(tc => {
            const matchesText = !text ||
                `${tc.id} ${tc.title} ${tc.description} ${tc.requirementId} ${tc.suiteName} ${tc.type}`.toLowerCase().includes(text);

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
            const matchesReq = requirementFilter === 'all' || tc.requirementId === requirementFilter;

            let matchesExecStatus = true;
            if (executionStatusFilter !== 'all') {
                const recordedStatus = (recentExecutionMap[tc.id]?.status || tc.status || '').toLowerCase();
                if (executionStatusFilter === 'not_run') {
                    matchesExecStatus = !recordedStatus || ['not_run', 'draft', 'ready'].includes(recordedStatus);
                } else {
                    matchesExecStatus = recordedStatus === executionStatusFilter;
                }
            }

            return matchesText && matchesQuick && matchesPriority && matchesType && matchesReq && matchesExecStatus;
        });

        filtered.sort((left, right) => {
            if (sort === 'title') return left.title.localeCompare(right.title);
            if (sort === 'priority') return PRIORITIES.indexOf(left.priority) - PRIORITIES.indexOf(right.priority);
            if (sort === 'id') return left.id.localeCompare(right.id);
            if (sort === 'created') {
                return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
            }
            return new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime();
        });

        return filtered;
    }, [allCases, suiteId, query, quickFilter, priorityFilter, typeFilter, requirementFilter, executionStatusFilter, sort, recentExecutionMap]);

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

    // Grouping for "All Test Cases" view
    const casesGroupedBySuite = useMemo(() => {
        if (suiteId || !groupBySuite) return [];
        const groups = [];
        const map = new Map();

        filteredCases.forEach(tc => {
            const sid = tc.suiteId;
            if (!map.has(sid)) {
                const sObj = suites.find(s => s.id === sid);
                const group = {
                    suiteId: sid,
                    suiteName: tc.suiteName,
                    context: sObj?.context || tc.context,
                    cases: []
                };
                map.set(sid, group);
                groups.push(group);
            }
            map.get(sid).cases.push(tc);
        });

        return groups;
    }, [filteredCases, suiteId, groupBySuite, suites]);

    // Pagination
    const pageCount = Math.max(1, Math.ceil(filteredCases.length / pageSize));
    const pageCases = useMemo(() => {
        return filteredCases.slice((page - 1) * pageSize, page * pageSize);
    }, [filteredCases, page, pageSize]);

    useEffect(() => { setPage(1); }, [query, suiteId, quickFilter, priorityFilter, typeFilter, requirementFilter, executionStatusFilter, sort]);

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
    const handleSuiteChange = (newSuiteId, categoryFilter = 'all') => {
        setSuiteId(newSuiteId);
        setSelectedKey('');
        setMobileDetailOpen(false);
        setTypeFilter(categoryFilter);
        const params = new URLSearchParams(location.search);
        if (newSuiteId) {
            params.set('suiteId', newSuiteId);
        } else {
            params.delete('suiteId');
        }
        params.delete('caseId');
        navigate({ pathname: '/app/test-cases', search: params.toString() }, { replace: true });
    };

    // Toggle navigation expansion for a suite
    const toggleSuiteNavExpansion = (e, sid) => {
        e.stopPropagation();
        setExpandedSuiteNavIds(prev => {
            const next = new Set(prev);
            if (next.has(sid)) next.delete(sid);
            else next.add(sid);
            return next;
        });
    };

    // Toggle accordion collapse for grouped list in All Cases
    const toggleGroupAccordion = (sid) => {
        setCollapsedGroupIds(prev => {
            const next = new Set(prev);
            if (next.has(sid)) next.delete(sid);
            else next.add(sid);
            return next;
        });
    };

    // Save test case mutations to backend
    const patchCase = async (targetSession, oldCase, nextCase) => {
        const rawSuite = getSuiteData(targetSession) || {};
        const isRef = oldCase?.isReference;

        if (isRef) {
            throw new Error(`Referenced test case belongs to suite "${oldCase.sourceSuiteName}". Edit it in its native suite.`);
        }

        const nextSuiteData = { ...rawSuite };
        let found = false;

        CATEGORY_KEYS.forEach(cat => {
            if (Array.isArray(nextSuiteData[cat])) {
                const idx = nextSuiteData[cat].findIndex(c => getCaseId(c) === oldCase.id);
                if (idx !== -1) {
                    found = true;
                    if (nextCase === null) {
                        nextSuiteData[cat] = nextSuiteData[cat].filter((_, i) => i !== idx);
                    } else {
                        nextSuiteData[cat] = [
                            ...nextSuiteData[cat].slice(0, idx),
                            nextCase,
                            ...nextSuiteData[cat].slice(idx + 1)
                        ];
                    }
                }
            }
        });

        if (!found && nextCase !== null) {
            const targetCat = nextCase.category || oldCase.category || 'functional';
            nextSuiteData[targetCat] = [...(nextSuiteData[targetCat] || []), nextCase];
        }

        const sid = String(targetSession.id || targetSession._id);
        const res = await sessionService.update(sid, { suiteData: nextSuiteData });
        if (!res.success) throw new Error(res.message || 'Failed to update test suite.');

        setSessions(prev => prev.map(s => String(s.id || s._id) === sid ? { ...s, suiteData: nextSuiteData } : s));
        return res;
    };

    // Handle Create & Edit save
    const handleSaveCaseModal = async (formData) => {
        setIsSaving(true);
        try {
            const targetSuiteId = formData.suiteId || suiteId || suites[0]?.id;
            const targetSession = sessions.find(s => String(s.id || s._id) === String(targetSuiteId));
            if (!targetSession) throw new Error('Target test suite was not found.');

            const sData = getSuiteData(targetSession) || {};
            const categoryKey = formData.category.toLowerCase().replace(/[^a-z0-9]/g, '');
            const safeCategory = CATEGORY_KEYS.includes(categoryKey) ? categoryKey : 'functional';

            const payloadCase = {
                id: formData.id || makeCaseId(sData, safeCategory),
                title: formData.title,
                testScenario: formData.title,
                scenario: formData.title,
                description: formData.description,
                testDescription: formData.description,
                type: formData.category,
                priority: formData.priority,
                executionMethod: formData.executionMethod,
                executionType: formData.executionMethod,
                status: formData.status,
                requirementId: formData.requirementId || '',
                preconditions: formData.preconditions ? formData.preconditions.split('\n').filter(Boolean) : [],
                steps: formData.steps || [],
                expectedResult: formData.expectedResult || '',
                automationMapping: formData.automationMapping || null,
                updatedAt: new Date().toISOString(),
                createdAt: editorMode === 'create' ? new Date().toISOString() : undefined
            };

            if (editorMode === 'create') {
                const nextSuiteData = { ...sData };
                nextSuiteData[safeCategory] = [...(nextSuiteData[safeCategory] || []), payloadCase];
                const res = await sessionService.update(targetSuiteId, { suiteData: nextSuiteData });
                if (!res.success) throw new Error(res.message || 'Failed to create test case.');

                setSessions(prev => prev.map(s => String(s.id || s._id) === targetSuiteId ? { ...s, suiteData: nextSuiteData } : s));
                triggerToast(`Created test case ${payloadCase.id}`);
                setEditorOpen(false);
                setSuiteId(targetSuiteId);
                setSelectedKey(`${targetSuiteId}:${safeCategory}:${payloadCase.id}`);
            } else {
                if (!selectedCase) throw new Error('No test case is currently selected for editing.');
                await patchCase(selectedCase.session, selectedCase, {
                    ...selectedCase.raw,
                    ...payloadCase
                });
                triggerToast(`Updated test case ${payloadCase.id}`);
                setEditorOpen(false);
            }
        } catch (err) {
            alert(`Save failed: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    // Duplicate test case
    const handleDuplicateCase = async () => {
        if (!selectedCase) return;
        setIsSaving(true);
        try {
            const targetSession = selectedCase.session;
            const sData = getSuiteData(targetSession) || {};
            const categoryKey = selectedCase.category || 'functional';
            const newId = makeCaseId(sData, categoryKey);

            const clone = {
                ...selectedCase.raw,
                id: newId,
                title: `${selectedCase.title} (Copy)`,
                status: 'Draft',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            const nextSuiteData = { ...sData };
            nextSuiteData[categoryKey] = [...(nextSuiteData[categoryKey] || []), clone];

            const sid = String(targetSession.id || targetSession._id);
            const res = await sessionService.update(sid, { suiteData: nextSuiteData });
            if (!res.success) throw new Error(res.message || 'Duplicate failed.');

            setSessions(prev => prev.map(s => String(s.id || s._id) === sid ? { ...s, suiteData: nextSuiteData } : s));
            triggerToast(`Cloned to ${newId}`);
            setSelectedKey(`${sid}:${categoryKey}:${newId}`);
        } catch (err) {
            alert(`Duplicate error: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    // Archive / Restore test case
    const handleToggleArchive = async () => {
        if (!selectedCase) return;
        setIsSaving(true);
        try {
            const isArchived = selectedCase.lifecycle === 'archived';
            const nextStatus = isArchived ? 'Ready' : 'Archived';
            const updated = {
                ...selectedCase.raw,
                status: nextStatus,
                archivedAt: isArchived ? null : new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            await patchCase(selectedCase.session, selectedCase, updated);
            triggerToast(isArchived ? `Restored ${selectedCase.id}` : `Archived ${selectedCase.id}`);
        } catch (err) {
            alert(`Archive error: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    // Delete test case
    const handleDeleteCase = async () => {
        if (!selectedCase) return;
        setIsSaving(true);
        try {
            await patchCase(selectedCase.session, selectedCase, null);
            setDeleteModalOpen(false);
            setSelectedKey('');
            setMobileDetailOpen(false);
            triggerToast(`Deleted ${selectedCase.id}`);
        } catch (err) {
            alert(`Delete error: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    // Save manual execution result
    const handleManualExecutionSave = async ({ outcome, actualResult, notes, durationMs, screenshotData, screenshotName }) => {
        if (!selectedCase) return;
        setIsSaving(true);
        try {
            let activeRun = runs.find(r => String(r.suiteId || r.suite_id || '') === selectedCase.suiteId && ['in_progress', 'pending'].includes(r.status));

            if (!activeRun) {
                const createRes = await executionService.createRun({
                    suiteId: selectedCase.suiteId,
                    name: `Manual Verification - ${selectedSuite?.name || 'Suite'}`,
                    executionType: 'manual',
                    selectedCaseIds: [selectedCase.id]
                });
                if (!createRes.success) throw new Error(createRes.message || 'Could not initiate test run.');
                activeRun = createRes.data;
                setRuns(prev => [activeRun, ...prev]);
            }

            const recordRes = await executionService.recordExecution(activeRun.id, {
                caseId: selectedCase.id,
                status: outcome,
                actualResult,
                notes,
                durationMs,
                screenshotData,
                screenshotName
            });

            if (!recordRes.success) throw new Error(recordRes.message || 'Could not save execution result.');

            setRecentExecutionMap(prev => ({
                ...prev,
                [selectedCase.id]: { status: outcome, timestamp: new Date().toISOString() }
            }));

            triggerToast(`Recorded manual execution: ${outcome.toUpperCase()}`);
            setManualExecOpen(false);
            setRetry(v => v + 1);
        } catch (err) {
            alert(`Execution recording failed: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    // Save automated execution result
    const handleAutoExecutionSave = async (autoResult) => {
        if (!selectedCase) return;
        try {
            const outcome = autoResult.status === 'passed' ? 'passed' : 'failed';
            setRecentExecutionMap(prev => ({
                ...prev,
                [selectedCase.id]: { status: outcome, timestamp: new Date().toISOString() }
            }));
            triggerToast(`Playwright execution completed: ${outcome.toUpperCase()}`);
            setRetry(v => v + 1);
        } catch (err) {
            console.error('Auto exec save error:', err);
        }
    };

    // Add test case reference to another suite
    const handleAddToSuite = async (targetSuiteId) => {
        if (!selectedCase) return;
        setIsSaving(true);
        try {
            const targetSession = sessions.find(s => String(s.id || s._id) === targetSuiteId);
            if (!targetSession) throw new Error('Target suite not found.');

            const sData = getSuiteData(targetSession) || {};
            const refs = Array.isArray(sData.testCaseRefs) ? sData.testCaseRefs : [];

            if (refs.some(r => String(r.sourceSuiteId) === selectedCase.suiteId && String(r.testCaseId) === selectedCase.id)) {
                throw new Error('This test case is already mapped into the target suite.');
            }

            const nextRefs = [...refs, { sourceSuiteId: selectedCase.suiteId, testCaseId: selectedCase.id }];
            const nextSuiteData = { ...sData, testCaseRefs: nextRefs };

            const res = await sessionService.update(targetSuiteId, { suiteData: nextSuiteData });
            if (!res.success) throw new Error(res.message || 'Could not add to suite.');

            setSessions(prev => prev.map(s => String(s.id || s._id) === targetSuiteId ? { ...s, suiteData: nextSuiteData } : s));
            triggerToast(`Linked ${selectedCase.id} into "${targetSession.title || 'target suite'}"`);
            setAddToSuiteOpen(false);
        } catch (err) {
            alert(`Mapping error: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    // Clear all filters
    const handleClearFilters = () => {
        setQuery('');
        setQuickFilter('all');
        setPriorityFilter('all');
        setTypeFilter('all');
        setRequirementFilter('all');
        setExecutionStatusFilter('all');
        setSort('updated');
    };

    const hasActiveFilters = query || quickFilter !== 'all' || priorityFilter !== 'all' || typeFilter !== 'all' || requirementFilter !== 'all' || executionStatusFilter !== 'all';

    // Suite labels & counts
    const suiteLabel = selectedSuite ? selectedSuite.name : 'All Test Cases';
    const activeSuitesCount = suites.filter(s => s.caseCount > 0).length;
    const totalUniqueCasesCount = uniqueCases.length;

    // Filter suites in navigation rail by user text
    const visibleSuitesInNav = useMemo(() => {
        if (!suiteFilterText.trim()) return suites;
        const sText = suiteFilterText.trim().toLowerCase();
        return suites.filter(s => s.name.toLowerCase().includes(sText) || s.context.includes(sText));
    }, [suites, suiteFilterText]);

    return (
        <div className={`tc-page ${mobileDetailOpen ? 'tc-mobile-detail-open' : ''}`}>
            {/* Top Workspace Header & Breadcrumbs */}
            <header className="tc-header">
                <div className="tc-breadcrumb">
                    <NavLink to="/app/workspace">Quality</NavLink>
                    <span>/</span>
                    <NavLink to="/app/test-suites">Test Suites</NavLink>
                    <span>/</span>
                    {selectedSuite ? (
                        <>
                            <button type="button" onClick={() => handleSuiteChange('')}>All Cases</button>
                            <span>/</span>
                            <span className="tc-breadcrumb-current">{selectedSuite.name}</span>
                        </>
                    ) : (
                        <span className="tc-breadcrumb-current">All Test Cases</span>
                    )}
                </div>

                <div className="tc-header-main">
                    <div>
                        <div className="tc-title-row">
                            <h1>{suiteLabel}</h1>
                            {selectedSuite && (
                                <span className={`tc-context-tag ${selectedSuite.context}`}>
                                    {selectedSuite.context.toUpperCase()}
                                </span>
                            )}
                        </div>
                        <p>
                            {selectedSuite ? (
                                <>
                                    {selectedSuite.caseCount} associated test {selectedSuite.caseCount === 1 ? 'case' : 'cases'}
                                    <span>·</span> {selectedSuite.activeCount} active
                                    {selectedSuite.archivedCount > 0 && ` (${selectedSuite.archivedCount} archived)`}
                                    <span>·</span> {selectedSuite.project}
                                </>
                            ) : (
                                <>
                                    {totalUniqueCasesCount} unique test cases across {activeSuitesCount} active {activeSuitesCount === 1 ? 'suite' : 'suites'}
                                </>
                            )}
                        </p>
                    </div>

                    <div className="tc-header-actions">
                        {/* Toggle Suite Nav */}
                        <button
                            type="button"
                            className="tc-icon-button"
                            title={isSuiteNavCollapsed ? "Expand suite navigator" : "Collapse suite navigator"}
                            onClick={() => setIsSuiteNavCollapsed(!isSuiteNavCollapsed)}
                        >
                            {isSuiteNavCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
                        </button>

                        {/* Toggle Detail Panel */}
                        <button
                            type="button"
                            className={`tc-icon-button ${isDetailPanelCollapsed ? 'active' : ''}`}
                            title={isDetailPanelCollapsed ? "Show details panel" : "Hide details panel"}
                            onClick={() => setIsDetailPanelCollapsed(!isDetailPanelCollapsed)}
                        >
                            {isDetailPanelCollapsed ? <PanelRightOpen size={15} /> : <PanelRightClose size={15} />}
                        </button>

                        {/* Create Case Button */}
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

                {/* Search & Multi-Filter Toolbar */}
                <div className="tc-toolbar">
                    <label className="tc-search">
                        <Search size={14} />
                        <input
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Search by ID, title, description, requirement, or suite..."
                            aria-label="Search test cases"
                        />
                    </label>

                    {/* Priority Filter */}
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

                    {/* Category Filter */}
                    <select
                        value={typeFilter}
                        onChange={e => setTypeFilter(e.target.value)}
                        aria-label="Filter by category"
                    >
                        <option value="all">All Categories</option>
                        <option value="Functional">Functional</option>
                        <option value="Negative">Negative</option>
                        <option value="Edge">Edge</option>
                        <option value="Security">Security</option>
                        <option value="API">API</option>
                        <option value="Non-functional">Non-functional</option>
                    </select>

                    {/* Requirement Filter */}
                    {availableRequirements.length > 0 && (
                        <select
                            value={requirementFilter}
                            onChange={e => setRequirementFilter(e.target.value)}
                            aria-label="Filter by requirement"
                        >
                            <option value="all">All Requirements</option>
                            {availableRequirements.map(req => (
                                <option key={req.id} value={req.id}>{req.id} ({req.count})</option>
                            ))}
                        </select>
                    )}

                    {/* Execution Outcome Filter */}
                    <select
                        value={executionStatusFilter}
                        onChange={e => setExecutionStatusFilter(e.target.value)}
                        aria-label="Filter by execution outcome"
                    >
                        <option value="all">All Outcomes</option>
                        <option value="passed">Passed</option>
                        <option value="failed">Failed</option>
                        <option value="blocked">Blocked</option>
                        <option value="skipped">Skipped</option>
                        <option value="not_run">Not Run / Untested</option>
                    </select>

                    {/* Sort Order */}
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

                    {/* Refresh */}
                    <button
                        type="button"
                        className="tc-icon-button"
                        title="Refresh test cases"
                        aria-label="Refresh test cases"
                        onClick={() => setRetry(v => v + 1)}
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>

                    {/* Clear Filters */}
                    {hasActiveFilters && (
                        <button
                            type="button"
                            className="tc-clear-filters"
                            onClick={handleClearFilters}
                            title="Reset all filters"
                        >
                            <X size={12} />
                            <span>Clear Filters</span>
                        </button>
                    )}
                </div>

                {/* Quick Lifecycle & Method Tabs */}
                <div className="tc-sub-toolbar">
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

                    {!suiteId && (
                        <div className="tc-view-toggle">
                            <button
                                type="button"
                                className={groupBySuite ? 'active' : ''}
                                onClick={() => setGroupBySuite(true)}
                                title="Group test cases by suite"
                            >
                                <Folder size={13} />
                                <span>Group by Suite</span>
                            </button>
                            <button
                                type="button"
                                className={!groupBySuite ? 'active' : ''}
                                onClick={() => setGroupBySuite(false)}
                                title="Flat list view"
                            >
                                <Layers3 size={13} />
                                <span>Flat List</span>
                            </button>
                        </div>
                    )}
                </div>
            </header>

            {/* Notification Toast */}
            {toastMessage && (
                <div className="tc-toast" role="status">
                    <CheckCircle2 size={16} color="var(--tc-jade)" />
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* Error Notification */}
            {error && (
                <div className="tc-error" role="alert">
                    <span>{error}</span>
                    <button type="button" onClick={() => setRetry(v => v + 1)}>Retry</button>
                </div>
            )}

            {/* ─── MAIN 3-PANEL INFORMATION ARCHITECTURE ─── */}
            {loading ? (
                <DataLoadingState message="Loading test suites and cases..." />
            ) : (
                <div className={`tc-workspace-shell ${isSuiteNavCollapsed ? 'nav-collapsed' : ''} ${isDetailPanelCollapsed ? 'detail-collapsed' : ''}`}>
                    {/* ─── 1. LEFT PANEL: SUITE NAVIGATION AREA ─── */}
                    <aside className="tc-suite-nav" aria-label="Test suite navigation">
                        <div className="tc-suite-nav-header">
                            <span className="tc-suite-nav-title">Suites ({suites.length})</span>
                            <button
                                type="button"
                                className="tc-suite-nav-collapse-btn"
                                onClick={() => setIsSuiteNavCollapsed(true)}
                                title="Collapse suite panel"
                            >
                                <PanelLeftClose size={13} />
                            </button>
                        </div>

                        {/* Search Suites Input */}
                        <div className="tc-suite-nav-search">
                            <Search size={13} />
                            <input
                                placeholder="Filter suites..."
                                value={suiteFilterText}
                                onChange={e => setSuiteFilterText(e.target.value)}
                                aria-label="Filter suites list"
                            />
                        </div>

                        <div className="tc-suite-nav-list">
                            {/* All Test Cases Option */}
                            <button
                                type="button"
                                className={`tc-suite-nav-item tc-suite-nav-all ${!suiteId ? 'active' : ''}`}
                                onClick={() => handleSuiteChange('')}
                            >
                                <div className="tc-suite-nav-item-main">
                                    <Layers3 size={15} className="tc-suite-icon" />
                                    <span className="tc-suite-name">All Test Cases</span>
                                </div>
                                <span className="tc-count-badge">{totalUniqueCasesCount}</span>
                            </button>

                            <div className="tc-suite-nav-divider">Test Suites</div>

                            {/* Suites List */}
                            {visibleSuitesInNav.length === 0 ? (
                                <div className="tc-suite-nav-empty">No suites found</div>
                            ) : (
                                visibleSuitesInNav.map(suite => {
                                    const isSelected = suiteId === suite.id;
                                    const isExpanded = expandedSuiteNavIds.has(suite.id);
                                    return (
                                        <div key={suite.id} className="tc-suite-nav-group">
                                            <div
                                                className={`tc-suite-nav-item ${isSelected ? 'active' : ''}`}
                                                onClick={() => handleSuiteChange(suite.id)}
                                            >
                                                <button
                                                    type="button"
                                                    className="tc-nav-expand-btn"
                                                    onClick={(e) => toggleSuiteNavExpansion(e, suite.id)}
                                                    title={isExpanded ? "Collapse categories" : "Expand categories"}
                                                >
                                                    {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                                </button>

                                                <div className="tc-suite-nav-item-main">
                                                    <span className="tc-suite-name" title={suite.name}>{suite.name}</span>
                                                    <span className={`tc-context-micro ${suite.context}`}>{suite.context.toUpperCase()}</span>
                                                </div>

                                                <span className="tc-count-badge" title={`${suite.caseCount} total test cases`}>
                                                    {suite.caseCount}
                                                </span>
                                            </div>

                                            {/* Expandable Suite Category Breakdown */}
                                            {isExpanded && (
                                                <div className="tc-suite-categories-list">
                                                    <button
                                                        type="button"
                                                        className={`tc-suite-cat-item ${isSelected && typeFilter === 'all' ? 'active' : ''}`}
                                                        onClick={() => handleSuiteChange(suite.id, 'all')}
                                                    >
                                                        <span>All in Suite</span>
                                                        <span className="tc-cat-count">{suite.caseCount}</span>
                                                    </button>
                                                    {suite.categoryBreakdown.map(cat => (
                                                        <button
                                                            type="button"
                                                            key={cat.label}
                                                            className={`tc-suite-cat-item ${isSelected && typeFilter === cat.label ? 'active' : ''}`}
                                                            onClick={() => handleSuiteChange(suite.id, cat.label)}
                                                        >
                                                            <span>{cat.label}</span>
                                                            <span className="tc-cat-count">{cat.count}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </aside>

                    {/* ─── 2. CENTER PANEL: MAIN TEST CASES LIST ─── */}
                    <main className="tc-list-panel" aria-label="Test case list">
                        {/* List Column Header */}
                        <div className="tc-list-head">
                            <span>Test Case ID & Title</span>
                            <span>Category · Priority · Method · Status</span>
                            <span>Updated</span>
                            <span />
                        </div>

                        {/* Empty States */}
                        {filteredCases.length === 0 ? (
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
                        ) : !suiteId && groupBySuite ? (
                            /* ─── Grouped by Suite View (for All Test Cases) ─── */
                            <div className="tc-grouped-list">
                                {casesGroupedBySuite.map(group => {
                                    const isCollapsed = collapsedGroupIds.has(group.suiteId);
                                    return (
                                        <div key={group.suiteId} className="tc-suite-group-section">
                                            {/* Suite Section Header */}
                                            <div
                                                className="tc-suite-group-header"
                                                onClick={() => toggleGroupAccordion(group.suiteId)}
                                            >
                                                <div className="tc-group-header-left">
                                                    <button type="button" className="tc-group-chevron">
                                                        {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                                                    </button>
                                                    <Folder size={15} className="tc-group-icon" />
                                                    <strong className="tc-group-title">{group.suiteName}</strong>
                                                    <span className={`tc-context-micro ${group.context}`}>
                                                        {group.context.toUpperCase()}
                                                    </span>
                                                    <span className="tc-group-count">
                                                        {group.cases.length} {group.cases.length === 1 ? 'case' : 'cases'}
                                                    </span>
                                                </div>

                                                <button
                                                    type="button"
                                                    className="tc-jump-suite-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleSuiteChange(group.suiteId);
                                                    }}
                                                    title={`Open suite ${group.suiteName}`}
                                                >
                                                    <span>View Suite</span>
                                                    <ArrowLeft size={12} style={{ transform: 'rotate(180deg)' }} />
                                                </button>
                                            </div>

                                            {/* Suite Rows */}
                                            {!isCollapsed && (
                                                <div className="tc-group-rows">
                                                    {group.cases.map(tc => {
                                                        const isSelected = selectedCase?.key === tc.key;
                                                        return (
                                                            <button
                                                                type="button"
                                                                key={tc.key}
                                                                className={`tc-row ${isSelected ? 'selected' : ''}`}
                                                                onClick={() => handleSelectCase(tc)}
                                                            >
                                                                <div className="tc-row-main">
                                                                    <div className="tc-row-title-line">
                                                                        <span className="tc-id">{tc.id || 'TC-NEW'}</span>
                                                                        <strong className="tc-title">{tc.title}</strong>
                                                                    </div>
                                                                </div>

                                                                <div className="tc-row-meta">
                                                                    <span className="tc-cat-badge">{tc.type}</span>
                                                                    <span className={`tc-priority-badge ${tc.priority.toLowerCase()}`}>
                                                                        {tc.priority}
                                                                    </span>
                                                                    <span className={`tc-method-pill ${tc.method}`}>
                                                                        {tc.method === 'automated' ? 'Playwright' : 'Manual'}
                                                                    </span>
                                                                    <span className={`tc-status tc-status-${tc.lifecycle}`}>
                                                                        {tc.lifecycle.replaceAll('-', ' ')}
                                                                    </span>
                                                                    {tc.isReference && (
                                                                        <span className="tc-ref-chip" title={`Mapped from ${tc.sourceSuiteName}`}>
                                                                            Ref: {tc.sourceSuiteName}
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                <span className="tc-row-date">{formatTimeAgo(tc.updatedAt)}</span>
                                                                <ChevronRight size={14} className="tc-chevron" />
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            /* ─── Flat Test Case Rows (By Suite or Flat List) ─── */
                            pageCases.map(tc => {
                                const isSelected = selectedCase?.key === tc.key;
                                return (
                                    <button
                                        type="button"
                                        key={tc.key}
                                        className={`tc-row ${isSelected ? 'selected' : ''}`}
                                        onClick={() => handleSelectCase(tc)}
                                    >
                                        <div className="tc-row-main">
                                            <div className="tc-row-title-line">
                                                <span className="tc-id">{tc.id || 'TC-NEW'}</span>
                                                <strong className="tc-title">{tc.title}</strong>
                                            </div>
                                        </div>

                                        <div className="tc-row-meta">
                                            <span className="tc-cat-badge">{tc.type}</span>
                                            <span className={`tc-priority-badge ${tc.priority.toLowerCase()}`}>
                                                {tc.priority}
                                            </span>
                                            <span className={`tc-method-pill ${tc.method}`}>
                                                {tc.method === 'automated' ? 'Playwright' : 'Manual'}
                                            </span>
                                            <span className={`tc-status tc-status-${tc.lifecycle}`}>
                                                {tc.lifecycle.replaceAll('-', ' ')}
                                            </span>
                                            {!suiteId && (
                                                <span className="tc-suite-tag" title={`Suite: ${tc.suiteName}`}>
                                                    {tc.suiteName}
                                                </span>
                                            )}
                                            {tc.isReference && (
                                                <span className="tc-ref-chip" title={`Mapped from ${tc.sourceSuiteName}`}>
                                                    Ref
                                                </span>
                                            )}
                                        </div>

                                        <span className="tc-row-date">{formatTimeAgo(tc.updatedAt)}</span>
                                        <ChevronRight size={14} className="tc-chevron" />
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
                    </main>

                    {/* ─── 3. RIGHT PANEL: COLLAPSIBLE TEST CASE DETAIL ─── */}
                    {!isDetailPanelCollapsed && selectedCase && (
                        <aside className="tc-detail-panel" aria-label="Test case details">
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
                                    <button
                                        type="button"
                                        aria-label="Close detail panel"
                                        title="Close detail panel"
                                        onClick={() => setIsDetailPanelCollapsed(true)}
                                    >
                                        <X size={14} />
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
                                <span>Suite: <strong style={{ color: 'var(--tc-jade)' }}>{selectedCase.suiteName}</strong></span>
                            </div>

                            {/* Direct Execution Buttons */}
                            <div className="tc-execution-bar">
                                <button
                                    type="button"
                                    className="tc-execute tc-manual-btn"
                                    onClick={() => setManualExecOpen(true)}
                                >
                                    <Clock size={14} />
                                    <span>Execute Manually</span>
                                </button>

                                <button
                                    type="button"
                                    className="tc-execute tc-auto-btn"
                                    onClick={() => setAutoExecOpen(true)}
                                >
                                    <Play size={14} />
                                    <span>Run Playwright</span>
                                </button>
                            </div>

                            {/* Description */}
                            {selectedCase.description && (
                                <div className="tc-block">
                                    <div className="tc-block-title">Description</div>
                                    <p className="tc-text-body">{selectedCase.description}</p>
                                </div>
                            )}

                            {/* Preconditions */}
                            <div className="tc-block">
                                <div className="tc-block-title">Preconditions</div>
                                {selectedCase.preconditions && selectedCase.preconditions.length > 0 ? (
                                    <ul className="tc-bullets">
                                        {(Array.isArray(selectedCase.preconditions) ? selectedCase.preconditions : [selectedCase.preconditions]).map((p, i) => (
                                            <li key={i}>{p}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="tc-muted-text">No preconditions specified for this test scenario.</p>
                                )}
                            </div>

                            {/* Test Steps Table */}
                            <div className="tc-block">
                                <div className="tc-block-title">
                                    <span>Structured Test Steps ({selectedCase.steps?.length || 0})</span>
                                </div>

                                {selectedCase.steps && selectedCase.steps.length > 0 ? (
                                    <div className="tc-steps-table">
                                        <div className="tc-steps-head">
                                            <span>#</span>
                                            <span>Action</span>
                                            <span>Expected Result</span>
                                            <span>Test Data</span>
                                        </div>
                                        {selectedCase.steps.map((st, i) => (
                                            <div className="tc-step-row" key={i}>
                                                <span className="tc-step-num">{st.step || i + 1}</span>
                                                <span className="tc-step-action">{st.action || '—'}</span>
                                                <span className="tc-step-expected">{st.expectedResult || st.expected || '—'}</span>
                                                <span className="tc-step-data">{st.testData || st.data || '—'}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="tc-muted-text">No structured test steps recorded.</p>
                                )}
                            </div>

                            {/* Expected Result */}
                            {selectedCase.expectedResult && (
                                <div className="tc-block">
                                    <div className="tc-block-title">Overall Expected Result / Acceptance Criteria</div>
                                    <div className="tc-expected-box">{selectedCase.expectedResult}</div>
                                </div>
                            )}

                            {/* Suite Associations */}
                            <div className="tc-block">
                                <div className="tc-block-title">
                                    <span>Suite Associations</span>
                                    <button
                                        type="button"
                                        className="tc-text-action"
                                        onClick={() => setAddToSuiteOpen(true)}
                                    >
                                        + Add to another suite
                                    </button>
                                </div>
                                <div className="tc-suite-ledger">
                                    <div className="tc-suite-ledger-row">
                                        <div>
                                            <strong>{selectedCase.suiteName}</strong>
                                            <span>Primary Native Suite</span>
                                        </div>
                                        <NavLink to={`/app/test-suites/${selectedCase.suiteId}`} className="tc-link">
                                            <span>View Suite</span>
                                            <ExternalLink size={12} />
                                        </NavLink>
                                    </div>

                                    {selectedCase.isReference && (
                                        <div className="tc-suite-ledger-row" style={{ borderTop: '1px solid var(--tc-line-subtle)' }}>
                                            <div>
                                                <strong>{selectedCase.sourceSuiteName}</strong>
                                                <span>Source Suite (Reference Mapping)</span>
                                            </div>
                                            <NavLink to={`/app/test-suites/${selectedCase.sourceSuiteId}`} className="tc-link">
                                                <span>View Source</span>
                                                <ExternalLink size={12} />
                                            </NavLink>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Requirement Traceability */}
                            <div className="tc-block">
                                <div className="tc-block-title">Requirement Traceability</div>
                                {selectedCase.requirementId ? (
                                    <div className="tc-req-card">
                                        <div>
                                            <div className="tc-req-badge">
                                                <Shield size={13} />
                                                <span>{selectedCase.requirementId}</span>
                                            </div>
                                            <p className="tc-req-desc">
                                                Mapped to coverage matrix and traceability verification ledger.
                                            </p>
                                        </div>
                                        <NavLink to={`/app/coverage?reqId=${encodeURIComponent(selectedCase.requirementId)}`} className="tc-link">
                                            <span>Matrix</span>
                                            <ExternalLink size={12} />
                                        </NavLink>
                                    </div>
                                ) : (
                                    <div className="tc-req-unmapped">
                                        <span>No requirement ID linked.</span>
                                        <button
                                            type="button"
                                            className="tc-text-action"
                                            onClick={() => {
                                                setEditorMode('edit');
                                                setEditorOpen(true);
                                            }}
                                        >
                                            Map Requirement
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Playwright Automation Binding */}
                            <div className="tc-block">
                                <div className="tc-block-title">Playwright Automation Ledger</div>
                                {selectedCase.automationMapping ? (
                                    <div className="tc-auto-card">
                                        <div className="tc-auto-row">
                                            <span>Mapping Status</span>
                                            <strong style={{ color: 'var(--tc-jade)' }}>
                                                {selectedCase.automationMapping.mappingStatus || 'Configured'}
                                            </strong>
                                        </div>
                                        <div className="tc-auto-row">
                                            <span>Spec Reference</span>
                                            <code>{selectedCase.automationMapping.spec || 'tests/smoke.spec.js'}</code>
                                        </div>
                                        <div className="tc-auto-row">
                                            <span>Framework</span>
                                            <span>Playwright (Chromium)</span>
                                        </div>

                                        {(selectedCase.automationMapping.scriptCode || selectedCase.automationMapping.code) && (
                                            <div className="tc-script-preview">
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
                                                        <code>{selectedCase.automationMapping.scriptCode || selectedCase.automationMapping.code}</code>
                                                    </pre>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="tc-auto-unmapped">
                                        <span>No automated script mapped.</span>
                                        <button
                                            type="button"
                                            className="tc-text-action"
                                            onClick={() => {
                                                setEditorMode('edit');
                                                setEditorOpen(true);
                                            }}
                                        >
                                            Configure Playwright
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Genuine Execution History */}
                            <div className="tc-block">
                                <div className="tc-block-title">
                                    <span>Execution History ({executionHistory.rows.length})</span>
                                </div>

                                {executionHistory.loading ? (
                                    <p className="tc-muted-text">Querying test run executions...</p>
                                ) : executionHistory.rows.length > 0 ? (
                                    <div className="tc-history-list">
                                        {executionHistory.rows.map((row, i) => {
                                            const status = (row.status || row.caseStatus || 'not_run').toLowerCase();
                                            return (
                                                <div key={i} className="tc-history-row">
                                                    <div className="tc-history-left">
                                                        <span className={`tc-status-dot ${status}`} />
                                                        <div>
                                                            <div className="tc-history-run-name">{row.runName}</div>
                                                            <div className="tc-history-time">
                                                                {formatDate(row.executedAt || row.createdAt)} · {row.durationMs || 0}ms
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="tc-history-right">
                                                        <span className={`tc-status tc-status-${status}`}>{status}</span>
                                                        <NavLink to={`/app/runs/${row.runId}?tab=report`} className="tc-link" title="Open execution report">
                                                            <ExternalLink size={12} />
                                                        </NavLink>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="tc-muted-text">No recorded executions in recent test runs.</p>
                                )}
                            </div>
                        </aside>
                    )}
                </div>
            )}

            {/* ─── MODALS ─── */}
            {editorOpen && (
                <TestCaseEditorModal
                    mode={editorMode}
                    testCase={editorMode === 'edit' ? selectedCase : null}
                    suites={suites}
                    activeSuiteId={suiteId || suites[0]?.id}
                    onSave={handleSaveCaseModal}
                    onClose={() => setEditorOpen(false)}
                    isSaving={isSaving}
                />
            )}

            {manualExecOpen && selectedCase && (
                <ManualExecutionModal
                    testCase={selectedCase}
                    onSave={handleManualExecutionSave}
                    onClose={() => setManualExecOpen(false)}
                    isSaving={isSaving}
                />
            )}

            {autoExecOpen && selectedCase && (
                <AutomatedExecutionModal
                    testCase={selectedCase}
                    onSave={handleAutoExecutionSave}
                    onClose={() => setAutoExecOpen(false)}
                />
            )}

            {addToSuiteOpen && selectedCase && (
                <AddToSuiteModal
                    testCase={selectedCase}
                    suites={suites}
                    onAdd={handleAddToSuite}
                    onClose={() => setAddToSuiteOpen(false)}
                    isSaving={isSaving}
                />
            )}

            {deleteModalOpen && selectedCase && (
                <DeleteConfirmModal
                    testCase={selectedCase}
                    onConfirm={handleDeleteCase}
                    onClose={() => setDeleteModalOpen(false)}
                    isDeleting={isSaving}
                />
            )}
        </div>
    );
};

export default TestCasesPage;
