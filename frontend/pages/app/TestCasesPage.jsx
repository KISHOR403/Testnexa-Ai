import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, ArrowUp, ArrowDown, Check, ChevronRight, Copy, ExternalLink,
    FilePlus2, Pencil, Play, Plus, RefreshCw, Search, Trash2, X
} from 'lucide-react';
import { sessionService } from '../../services/sessionService';
import { executionService } from '../../services/executionService';
import { DataLoadingState } from '../../components/loading';
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
const getCaseId = (testCase) => String(testCase?.id || testCase?.testCaseId || '');
const getCaseTitle = (testCase) => testCase?.title || testCase?.testScenario || testCase?.scenario || '';
const getRequirementId = (requirement) => requirement && typeof requirement === 'object'
    ? requirement.id || requirement.reqId || requirement.requirementId || ''
    : '';
const getRequirementTitle = (requirement) => typeof requirement === 'string'
    ? requirement
    : requirement?.description || requirement?.requirement || requirement?.text || requirement?.title || '';
const validAutomation = (testCase) => {
    const mapping = testCase?.automationMapping || testCase?.playwrightBinding || {};
    const configured = ['configured', 'enabled'].includes(String(mapping.mappingStatus || mapping.status || '').toLowerCase());
    return configured && String(mapping.validationStatus || '').toLowerCase() === 'valid'
        && Boolean(mapping.scriptCode || mapping.code || mapping.spec || mapping.script || mapping.scriptRef || mapping.testId || mapping.automationTestId);
};
const getMethod = (testCase) => {
    const method = String(testCase?.executionType || testCase?.executionMethod || testCase?.method || '').toLowerCase();
    if (method) return ['automated', 'automation', 'playwright'].includes(method) ? 'automated' : 'manual';
    return testCase?.isAutomated || validAutomation(testCase) ? 'automated' : 'manual';
};
const getLifecycle = (testCase) => {
    const status = String(testCase?.status || '').toLowerCase().replaceAll('_', ' ').trim();
    if (testCase?.archivedAt || status === 'archived') return 'archived';
    if (status === 'draft') return 'draft';
    if (['ready', 'approved'].includes(status)) return getMethod(testCase) === 'automated' && !validAutomation(testCase) ? 'needs-review' : 'ready';
    if (['needs review', 'review', 'generated', 'pending'].includes(status)) return 'needs-review';
    return status ? status.replaceAll(' ', '-') : 'needs-review';
};
const requirementsFromSuite = (suite) => {
    const source = [suite?.understanding?.functional_requirements, suite?.requirements, suite?.traceability?.matrix]
        .find(value => Array.isArray(value) ? value.length : value && typeof value === 'object' && Object.keys(value).length) || [];
    const entries = Array.isArray(source) ? source : Object.entries(source).map(([id, value]) =>
        typeof value === 'object' && value !== null ? { ...value, id: value.id || value.reqId || id } : { id, description: String(value || '') }
    );
    return entries.map(req => ({ id: String(getRequirementId(req) || ''), title: getRequirementTitle(req) })).filter(req => req.id);
};
const flattenSessions = (sessions) => sessions.flatMap(session => {
    const suite = getSuiteData(session);
    if (!suite || typeof suite !== 'object') return [];
    const seen = new Set();
    return CATEGORY_KEYS.flatMap(category => (Array.isArray(suite[category]) ? suite[category] : []).flatMap((testCase, index) => {
        if (!testCase || typeof testCase !== 'object') return [];
        const id = getCaseId(testCase);
        const key = `${session.id || session._id}:${category}:${id || index}`;
        if (seen.has(id) && id) return [];
        if (id) seen.add(id);
        const lifecycle = getLifecycle(testCase);
        return [{
            key,
            id,
            title: getCaseTitle(testCase),
            description: testCase.description || testCase.testDescription || '',
            preconditions: testCase.preconditions || [],
            steps: Array.isArray(testCase.steps) ? testCase.steps : [],
            expectedResult: testCase.expectedResult || testCase.expected || '',
            priority: testCase.priority || '',
            type: testCase.type || CATEGORY_LABELS[category] || 'Functional',
            method: getMethod(testCase),
            lifecycle,
            status: testCase.status || '',
            requirementId: String(testCase.requirementId || testCase.requirementRef || testCase.reqId || ''),
            automationMapping: testCase.automationMapping || testCase.playwrightBinding || null,
            updatedAt: testCase.updatedAt || testCase.updated_at || testCase.createdAt || testCase.created_at || null,
            category,
            sourceIndex: index,
            raw: testCase,
            suiteId: String(session.id || session._id || ''),
            suiteName: session.title || session.feature || suite.testSuiteName || suite.feature || 'Untitled suite',
            projectName: session.projectName || suite.projectName || suite.project || '',
            session,
            suite
        }];
    }));
});
const formatDate = (value) => value && !Number.isNaN(new Date(value).getTime())
    ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : 'Not recorded';
const readText = (value) => Array.isArray(value) ? value.map(item => typeof item === 'object' ? item.text || item.description || item.value || '' : String(item)).filter(Boolean).join('\n') : String(value || '');
const makeCaseId = (suite, category) => {
    const ids = new Set(CATEGORY_KEYS.flatMap(key => Array.isArray(suite?.[key]) ? suite[key].map(getCaseId) : []));
    const prefix = `TC_${category.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_`;
    const used = [...ids].map(id => Number(id.match(new RegExp(`^${prefix}(\\d+)$`, 'i'))?.[1] || 0));
    let next = Math.max(0, ...used) + 1;
    let id = `${prefix}${String(next).padStart(3, '0')}`;
    while (ids.has(id)) id = `${prefix}${String(++next).padStart(3, '0')}`;
    return id;
};

const emptyForm = () => ({
    id: '', title: '', description: '', preconditions: '', steps: [{ action: '', expected: '' }],
    expectedResult: '', priority: 'Medium', type: 'Functional', method: 'manual', status: 'Draft',
    requirementId: '', framework: 'playwright', scriptRef: '', scriptCode: ''
});

const TestCasesPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [sessions, setSessions] = useState([]);
    const [runs, setRuns] = useState([]);
    const [runLoadError, setRunLoadError] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [retry, setRetry] = useState(0);
    const [suiteId, setSuiteId] = useState(new URLSearchParams(location.search).get('suiteId') || '');
    const [selectedKey, setSelectedKey] = useState('');
    const [query, setQuery] = useState('');
    const [quickFilter, setQuickFilter] = useState('all');
    const [priority, setPriority] = useState('all');
    const [sort, setSort] = useState('updated');
    const [page, setPage] = useState(1);
    const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
    const [formOpen, setFormOpen] = useState(false);
    const [editingCase, setEditingCase] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [formError, setFormError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [addToSuiteOpen, setAddToSuiteOpen] = useState(false);
    const [targetSuiteId, setTargetSuiteId] = useState('');
    const [executionHistory, setExecutionHistory] = useState({ key: '', rows: [], loading: false, error: '' });
    const pageSize = 30;

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
                if (!response?.success) throw new Error(response?.message || 'Additional test suites could not be loaded.');
                allSessions.push(...(response.data || []));
            }
            const [runResult] = await Promise.allSettled([executionService.listRuns({ page: 1, limit: 100, sort: 'newest' })]);
            setSessions(allSessions);
            if (runResult.status === 'fulfilled' && runResult.value?.success) {
                setRuns(runResult.value.data || []);
                setRunLoadError('');
            } else {
                setRuns([]);
                setRunLoadError(runResult.status === 'rejected' ? runResult.reason?.message || 'Execution history could not be loaded.' : runResult.value?.message || 'Execution history could not be loaded.');
            }
            setSuiteId(current => current || String(allSessions[0]?.id || allSessions[0]?._id || ''));
        } catch (loadError) {
            setError(loadError.message || 'Test cases could not be loaded.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData, retry]);

    const suites = useMemo(() => sessions.map(session => ({
        id: String(session.id || session._id),
        name: session.title || session.feature || getSuiteData(session)?.testSuiteName || 'Untitled suite',
        project: session.projectName || getSuiteData(session)?.projectName || getSuiteData(session)?.project || '',
        session
    })), [sessions]);
    const cases = useMemo(() => flattenSessions(sessions), [sessions]);

    useEffect(() => {
        const requestedSuite = new URLSearchParams(location.search).get('suiteId');
        const requestedCase = new URLSearchParams(location.search).get('caseId');
        if (requestedSuite && requestedSuite !== suiteId) setSuiteId(requestedSuite);
        if (requestedCase) {
            const match = cases.find(item => item.suiteId === requestedSuite && item.id === requestedCase);
            if (match) { setSelectedKey(match.key); setMobileDetailOpen(true); }
        }
    }, [location.search, cases, suiteId]);

    const filteredCases = useMemo(() => {
        const text = query.trim().toLowerCase();
        const filtered = cases.filter(testCase => {
            const matchesSuite = !suiteId || testCase.suiteId === String(suiteId);
            const matchesText = !text || `${testCase.id} ${testCase.title} ${testCase.description} ${testCase.requirementId}`.toLowerCase().includes(text);
            const matchesQuick = quickFilter === 'all' || testCase.lifecycle === quickFilter || testCase.method === quickFilter;
            const matchesPriority = priority === 'all' || testCase.priority.toLowerCase() === priority;
            return matchesSuite && matchesText && matchesQuick && matchesPriority;
        });
        filtered.sort((left, right) => {
            if (sort === 'title') return left.title.localeCompare(right.title);
            if (sort === 'priority') return PRIORITIES.indexOf(left.priority) - PRIORITIES.indexOf(right.priority);
            const leftDate = new Date(left.updatedAt || 0).getTime();
            const rightDate = new Date(right.updatedAt || 0).getTime();
            return rightDate - leftDate;
        });
        return filtered;
    }, [cases, query, suiteId, quickFilter, priority, sort]);
    const selectedCase = filteredCases.find(testCase => testCase.key === selectedKey) || null;
    const selectedSuite = suites.find(suite => suite.id === (selectedCase?.suiteId || suiteId)) || null;
    const selectedRequirements = requirementsFromSuite(selectedCase?.suite || getSuiteData(selectedSuite?.session));
    const pageCount = Math.max(1, Math.ceil(filteredCases.length / pageSize));
    const pageCases = filteredCases.slice((page - 1) * pageSize, page * pageSize);

    useEffect(() => { setPage(1); }, [query, suiteId, quickFilter, priority, sort]);
    useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

    useEffect(() => {
        if (!selectedCase) { setExecutionHistory({ key: '', rows: [], loading: false, error: '' }); return; }
        let current = true;
        setExecutionHistory({ key: selectedCase.key, rows: [], loading: true, error: '' });
        const loadExecutions = async () => {
            try {
                const rows = [];
                const matchingRuns = runs.filter(run => String(run.suiteId || run.suite_id || '') === selectedCase.suiteId)
                    .sort((a, b) => new Date(b.startedAt || b.createdAt || b.created_at || 0) - new Date(a.startedAt || a.createdAt || a.created_at || 0));
                for (const run of matchingRuns.slice(0, 12)) {
                    const runResult = await executionService.getRun(run.id);
                    if (!runResult?.success) continue;
                    const runCases = runResult.data?.cases || [];
                    const caseRecord = runCases.find(item => {
                        const snapshot = item.caseSnapshot || {};
                        return [snapshot.id, snapshot.testCaseId, item.testCaseId].filter(Boolean).map(String).includes(selectedCase.id);
                    });
                    if (!caseRecord) continue;
                    const details = await executionService.getRunCase(run.id, caseRecord.id).catch(() => null);
                    const detailedCase = details?.success ? details.data : caseRecord;
                    const attempts = Array.isArray(detailedCase.executions) ? detailedCase.executions : [];
                    if (attempts.length) {
                        attempts.forEach(attempt => rows.push({ ...attempt, runId: run.id, runName: run.name || run.title || '', caseStatus: detailedCase.status, artifactCount: detailedCase.artifacts?.length || 0 }));
                    } else {
                        rows.push({ ...detailedCase, runId: run.id, runName: run.name || run.title || '', artifactCount: detailedCase.artifacts?.length || 0 });
                    }
                }
                rows.sort((left, right) => new Date(right.executedAt || right.createdAt || right.updatedAt || 0) - new Date(left.executedAt || left.createdAt || left.updatedAt || 0));
                if (current) setExecutionHistory({ key: selectedCase.key, rows, loading: false, error: '' });
            } catch (historyError) {
                if (current) setExecutionHistory({ key: selectedCase.key, rows: [], loading: false, error: historyError.message || 'Execution history could not be loaded.' });
            }
        };
        loadExecutions();
        return () => { current = false; };
    }, [selectedCase, runs]);

    const selectCase = (testCase) => {
        setSelectedKey(testCase.key);
        setMobileDetailOpen(true);
        const params = new URLSearchParams(location.search);
        params.set('suiteId', testCase.suiteId);
        params.set('caseId', testCase.id);
        navigate({ pathname: '/app/test-cases', search: params.toString() }, { replace: true });
    };

    const openCreate = () => {
        if (!selectedSuite) { setFormError('Select a saved suite before creating a test case.'); return; }
        setEditingCase(null);
        setForm(emptyForm());
        setFormError('');
        setFormOpen(true);
    };
    const openEdit = () => {
        if (!selectedCase) return;
        const mapping = selectedCase.automationMapping || {};
        setEditingCase(selectedCase);
        setForm({
            ...emptyForm(), id: selectedCase.id, title: selectedCase.title, description: selectedCase.description,
            preconditions: readText(selectedCase.preconditions), steps: selectedCase.steps.length ? selectedCase.steps.map(step => ({
                action: typeof step === 'object' ? step.action || step.description || '' : String(step),
                expected: typeof step === 'object' ? step.expected || step.expectedResult || '' : ''
            })) : [{ action: '', expected: '' }], expectedResult: selectedCase.expectedResult,
            priority: selectedCase.priority || 'Medium', type: selectedCase.type, method: selectedCase.method,
            status: selectedCase.lifecycle === 'ready' ? 'Ready' : selectedCase.lifecycle === 'draft' ? 'Draft' : 'Needs Review',
            requirementId: selectedCase.requirementId, framework: mapping.framework || 'playwright',
            scriptRef: mapping.scriptRef || '', scriptCode: mapping.scriptCode || mapping.code || ''
        });
        setFormError('');
        setFormOpen(true);
    };

    const patchCase = async (record, oldCase, nextCase) => {
        const suiteData = structuredClone(getSuiteData(record.session) || {});
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
        const sessionId = record.id || record._id;
        const response = await sessionService.update(sessionId, {
            suiteData,
            testCaseMutation: {
                action: oldCase ? 'update' : 'create',
                previousTestCaseId: oldCase?.id || '',
                testCaseId: nextCase.id
            }
        });
        if (!response?.success) throw new Error(response?.message || 'Test case changes could not be saved.');
        window.dispatchEvent(new Event('historyUpdated'));
        await loadData();
        setSelectedKey(`${sessionId}:${targetKey}:${nextCase.id}`);
        setFormOpen(false);
        setEditingCase(null);
        setMobileDetailOpen(true);
    };

    const saveForm = async (event, desiredStatus = form.status) => {
        event?.preventDefault();
        if (!selectedSuite?.session) { setFormError('The selected suite is unavailable. Choose a saved suite and retry.'); return; }
        const title = form.title.trim();
        if (!title) { setFormError('Enter a test case title.'); return; }
        const steps = form.steps.map(step => ({ action: step.action.trim(), expected: step.expected.trim() })).filter(step => step.action || step.expected);
        if (desiredStatus === 'Ready' && (steps.length === 0 || steps.some(step => !step.action || !step.expected))) {
            setFormError('Add an action and expected result for every step before marking this test Ready.'); return;
        }
        const isAutomated = form.method === 'automated';
        const existingMapping = editingCase?.automationMapping || {};
        const mappingChanged = form.scriptCode !== (existingMapping.scriptCode || existingMapping.code || '')
            || form.scriptRef.trim() !== (existingMapping.scriptRef || '');
        const mappingIsValid = isAutomated && !mappingChanged && validAutomation(editingCase?.raw);
        if (desiredStatus === 'Ready' && isAutomated && !mappingIsValid) {
            setFormError('An automated test needs a script reference or script content before it can be marked Ready.'); return;
        }
        const suiteData = getSuiteData(selectedSuite.session) || {};
        const id = editingCase?.id || makeCaseId(suiteData, form.type.toLowerCase().replace(/[^a-z0-9]+/g, '_'));
        const duplicate = cases.some(item => item.suiteId === selectedSuite.id && item.id === id && item.key !== editingCase?.key);
        if (duplicate) { setFormError(`Test case ID ${id} already exists in this suite.`); return; }
        const automationMapping = isAutomated ? {
            ...existingMapping,
            framework: form.framework || 'playwright',
            scriptRef: form.scriptRef.trim(),
            scriptCode: form.scriptCode,
            mappingStatus: mappingChanged ? 'not_configured' : existingMapping.mappingStatus || 'not_configured',
            validationStatus: mappingChanged ? 'unvalidated' : existingMapping.validationStatus || 'unvalidated',
            ...(mappingChanged ? { validatedAt: null } : {}),
            updatedAt: new Date().toISOString()
        } : (editingCase?.raw?.automationMapping || null);
        const nextCase = {
            ...(editingCase?.raw || {}),
            id,
            title,
            description: form.description.trim(),
            preconditions: form.preconditions.split('\n').map(line => line.trim()).filter(Boolean),
            steps,
            expectedResult: form.expectedResult.trim(),
            priority: form.priority,
            type: form.type,
            executionType: form.method,
            status: desiredStatus === 'Ready' && isAutomated && !mappingIsValid ? 'Needs Review' : desiredStatus,
            requirementId: form.requirementId || '',
            automationMapping,
            updatedAt: new Date().toISOString(),
            ...(editingCase ? {} : { createdAt: new Date().toISOString() })
        };
        setIsSaving(true);
        setFormError('');
        try { await patchCase(selectedSuite.session, editingCase, nextCase); }
        catch (saveError) { setFormError(saveError.message || 'Test case could not be saved.'); }
        finally { setIsSaving(false); }
    };

    const duplicateCase = async () => {
        if (!selectedCase || !selectedSuite) return;
        const suiteData = getSuiteData(selectedSuite.session);
        const clone = { ...structuredClone(selectedCase.raw), id: makeCaseId(suiteData, String(selectedCase.type).toLowerCase().replace(/[^a-z0-9]+/g, '_')), title: `${selectedCase.title} (copy)`, status: 'Draft', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        setIsSaving(true);
        setError('');
        try { await patchCase(selectedSuite.session, null, clone); }
        catch (saveError) { setError(saveError.message || 'Test case could not be duplicated.'); }
        finally { setIsSaving(false); }
    };

    const deleteCase = async () => {
        if (!deleteTarget) return;
        setIsSaving(true);
        setError('');
        try {
            const suiteData = structuredClone(getSuiteData(deleteTarget.session) || {});
            if (deleteTarget.id) {
                for (const category of CATEGORY_KEYS) {
                    if (Array.isArray(suiteData[category])) suiteData[category] = suiteData[category].filter(item => getCaseId(item) !== deleteTarget.id);
                }
            } else if (Array.isArray(suiteData[deleteTarget.category])) {
                suiteData[deleteTarget.category] = suiteData[deleteTarget.category].filter((_, index) => index !== deleteTarget.sourceIndex);
            }
            const response = await sessionService.update(deleteTarget.suiteId, {
                suiteData,
                ...(deleteTarget.id ? { testCaseMutation: { action: 'delete', testCaseId: deleteTarget.id } } : {})
            });
            if (!response?.success) throw new Error(response?.message || 'Test case could not be deleted.');
            window.dispatchEvent(new Event('historyUpdated'));
            setDeleteTarget(null);
            setSelectedKey('');
            setMobileDetailOpen(false);
            await loadData();
        } catch (deleteError) { setError(deleteError.message || 'Test case could not be deleted.'); }
        finally { setIsSaving(false); }
    };

    const archiveCase = async () => {
        if (!selectedCase || !selectedSuite) return;
        const nextCase = { ...selectedCase.raw, status: 'Archived', archivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        setIsSaving(true);
        try { await patchCase(selectedSuite.session, selectedCase, nextCase); }
        catch (archiveError) { setError(archiveError.message || 'Test case could not be archived.'); }
        finally { setIsSaving(false); }
    };

    const addCaseToSelectedSuite = async () => {
        const targetSuite = suites.find(suite => suite.id === targetSuiteId);
        if (!selectedCase || !targetSuite || targetSuite.id === selectedCase.suiteId) return;
        const targetData = getSuiteData(targetSuite.session) || {};
        const targetRequirementExists = requirementsFromSuite(targetData).some(requirement => requirement.id === selectedCase.requirementId);
        const copy = {
            ...structuredClone(selectedCase.raw),
            id: makeCaseId(targetData, String(selectedCase.type).toLowerCase().replace(/[^a-z0-9]+/g, '_')),
            ...(targetRequirementExists ? {} : { requirementId: '' }),
            status: 'Draft',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        setIsSaving(true);
        setError('');
        try {
            await patchCase(targetSuite.session, null, copy);
            setSuiteId(targetSuite.id);
            setAddToSuiteOpen(false);
        } catch (addError) { setError(addError.message || 'Test case could not be added to the selected suite.'); }
        finally { setIsSaving(false); }
    };

    const openExecution = () => {
        if (!selectedCase) return;
        navigate(`/app/test-suites/${selectedCase.suiteId}?testCaseId=${encodeURIComponent(selectedCase.id)}&execute=1`);
    };

    const suiteLabel = selectedSuite?.project ? `${selectedSuite.project} / ${selectedSuite.name}` : selectedSuite?.name || 'All test suites';
    const showingHistory = executionHistory.key === selectedCase?.key ? executionHistory : { rows: [], loading: Boolean(selectedCase), error: '' };

    return (
        <div className={`tc-page ${mobileDetailOpen ? 'tc-mobile-detail-open' : ''}`}>
            <header className="tc-header">
                <div className="tc-breadcrumb"><span>Quality</span><span>/</span><span>Test Cases</span></div>
                <div className="tc-header-main">
                    <div><h1>Test Cases</h1><p>{suiteLabel} <span>·</span> {filteredCases.length} cases</p></div>
                    <div className="tc-header-actions">
                        <select aria-label="Filter by test suite" value={suiteId} onChange={event => { setSuiteId(event.target.value); setSelectedKey(''); setMobileDetailOpen(false); }}>
                            <option value="">All suites</option>{suites.map(suite => <option key={suite.id} value={suite.id}>{suite.name}</option>)}
                        </select>
                        <button type="button" className="tc-primary" onClick={openCreate} disabled={!selectedSuite}><Plus size={15} />Create Test Case</button>
                    </div>
                </div>
                <div className="tc-toolbar">
                    <label className="tc-search"><Search size={15} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by ID, title, or requirement" aria-label="Search test cases" /></label>
                    <select value={priority} onChange={event => setPriority(event.target.value)} aria-label="Filter by priority"><option value="all">All priorities</option>{PRIORITIES.map(item => <option key={item} value={item.toLowerCase()}>{item} priority</option>)}</select>
                    <select value={sort} onChange={event => setSort(event.target.value)} aria-label="Sort test cases"><option value="updated">Recently updated</option><option value="title">Title A to Z</option><option value="priority">Priority</option></select>
                    <button type="button" className="tc-icon-button" title="Refresh test cases" aria-label="Refresh test cases" onClick={() => setRetry(value => value + 1)}><RefreshCw size={15} /></button>
                </div>
                <nav className="tc-filters" aria-label="Test case filters">
                    {QUICK_FILTERS.map(([key, label]) => <button type="button" key={key} className={quickFilter === key ? 'active' : ''} onClick={() => setQuickFilter(key)}>{label}</button>)}
                </nav>
            </header>

            {error && <div className="tc-error" role="alert">{error}<button type="button" onClick={() => setRetry(value => value + 1)}>Retry</button></div>}
            {loading ? <DataLoadingState message="Loading saved test cases…" /> : (
                <div className="tc-workspace">
                    <section className="tc-list" aria-label="Test case list">
                        <div className="tc-list-head"><span>Test case</span><span>Type · Priority · Status</span><span>Updated</span></div>
                        {pageCases.length === 0 ? <div className="tc-empty"><FilePlus2 size={18} /><strong>{cases.length ? 'No test cases match these filters.' : suites.length ? 'No saved test cases yet.' : 'No saved test suites found.'}</strong><span>{cases.length ? 'Adjust your search or filters.' : suites.length ? 'Select a suite and create a test case to get started.' : 'Create a suite before managing its test cases.'}</span>{cases.length > 0 && <button type="button" onClick={() => { setQuery(''); setQuickFilter('all'); setPriority('all'); }}>Clear filters</button>}{suites.length === 0 && <button type="button" onClick={() => navigate('/app/workspace')}>Open AI Workspace</button>}</div> : pageCases.map(testCase => <button type="button" key={testCase.key} className={`tc-row ${selectedCase?.key === testCase.key ? 'selected' : ''}`} onClick={() => selectCase(testCase)}>
                            <span className="tc-row-main"><span className="tc-id">{testCase.id || 'ID not recorded'}</span><strong>{testCase.title || 'Title not recorded'}</strong><small>{testCase.suiteName}</small></span>
                            <span className="tc-row-meta"><span>{testCase.type}</span><span>{testCase.priority || 'Priority not set'}</span><span className={`tc-status tc-status-${testCase.lifecycle}`}>{testCase.lifecycle.replaceAll('-', ' ')}</span><span className="tc-method">{testCase.method}</span></span>
                            <span className="tc-row-date">{formatDate(testCase.updatedAt)}</span><ChevronRight size={15} />
                        </button>)}
                        {pageCount > 1 && <div className="tc-pagination"><span>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredCases.length)} of {filteredCases.length}</span><button type="button" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous</button><button type="button" disabled={page >= pageCount} onClick={() => setPage(value => value + 1)}>Next</button></div>}
                    </section>

                    {selectedCase && <aside className="tc-detail" aria-label="Test case details">
                        <button type="button" className="tc-mobile-back" onClick={() => setMobileDetailOpen(false)}><ArrowLeft size={14} />All test cases</button>
                        <div className="tc-detail-top"><div><span className="tc-id">{selectedCase.id || 'ID not recorded'}</span><span className={`tc-status tc-status-${selectedCase.lifecycle}`}>{selectedCase.lifecycle.replaceAll('-', ' ')}</span></div><div className="tc-actions"><button type="button" aria-label="Edit test case" title="Edit" onClick={openEdit}><Pencil size={14} /></button><button type="button" aria-label="Duplicate test case" title="Duplicate" onClick={duplicateCase} disabled={isSaving}><Copy size={14} /></button><button type="button" aria-label="Delete test case" title="Delete" onClick={() => setDeleteTarget(selectedCase)}><Trash2 size={14} /></button></div></div>
                        <h2>{selectedCase.title || 'Title not recorded'}</h2>
                        <div className="tc-facts"><span>{selectedCase.type}</span><span>{selectedCase.method}</span><span>{selectedCase.priority || 'Priority not set'}</span><span>Updated {formatDate(selectedCase.updatedAt)}</span></div>
        <button type="button" className="tc-execute" onClick={openExecution} disabled={!selectedCase.id} title={!selectedCase.id ? 'Assign a test case ID before execution.' : ''}><Play size={14} />Execute in Test Run Workspace</button>
                        {suites.length > 1 && <button type="button" className="tc-text-link" onClick={() => { setTargetSuiteId(suites.find(suite => suite.id !== selectedCase.suiteId)?.id || ''); setAddToSuiteOpen(true); }}><FilePlus2 size={13} />Add a copy to another suite</button>}
                        {selectedCase.description && <section className="tc-detail-section"><h3>Description</h3><p>{selectedCase.description}</p></section>}
                        <section className="tc-detail-section"><h3>Preconditions</h3><p>{readText(selectedCase.preconditions) || 'No preconditions recorded.'}</p></section>
                        <section className="tc-detail-section"><h3>Test steps</h3>{selectedCase.steps.length ? <ol>{selectedCase.steps.map((step, index) => <li key={`${selectedCase.key}-step-${index}`}><strong>{typeof step === 'object' ? step.action || step.description || 'Step description not recorded' : String(step)}</strong><span>Expected: {typeof step === 'object' ? step.expected || step.expectedResult || 'Not recorded' : 'Not recorded'}</span></li>)}</ol> : <p>No steps recorded.</p>}</section>
                        <section className="tc-detail-section"><h3>Expected result</h3><p>{selectedCase.expectedResult || 'No overall expected result recorded.'}</p></section>
                        <section className="tc-detail-section"><h3>Requirement</h3>{selectedCase.requirementId ? <button type="button" className="tc-text-link" onClick={() => navigate(`/app/coverage?suiteId=${encodeURIComponent(selectedCase.suiteId)}&requirementId=${encodeURIComponent(selectedCase.requirementId)}`)}>{selectedCase.requirementId}<ExternalLink size={12} /></button> : <p>No requirement linked.</p>}</section>
                        <section className="tc-detail-section"><h3>Test suite</h3><button type="button" className="tc-text-link" onClick={() => navigate(`/app/test-suites/${selectedCase.suiteId}?testCaseId=${encodeURIComponent(selectedCase.id)}`)}>{selectedCase.suiteName}<ExternalLink size={12} /></button></section>
                        <section className="tc-detail-section"><h3>Automation mapping</h3>{selectedCase.method === 'automated' ? <div className="tc-automation"><span className={validAutomation(selectedCase.raw) ? 'mapped' : 'unmapped'}>{validAutomation(selectedCase.raw) ? 'Configured and validated' : 'Not configured or validated'}</span><span>{selectedCase.automationMapping?.framework || 'Framework not recorded'}</span><span>{selectedCase.automationMapping?.scriptRef || selectedCase.automationMapping?.automationTestId || 'Script reference not recorded'}</span>{showingHistory.rows[0] && <span>Last execution: {showingHistory.rows[0].status || showingHistory.rows[0].caseStatus || 'Status not recorded'}</span>}</div> : <p>Manual test case</p>}</section>
                        <section className="tc-detail-section"><h3>Execution history</h3>{showingHistory.loading ? <span className="tc-muted">Loading execution records…</span> : showingHistory.error || runLoadError ? <span className="tc-error-text">{showingHistory.error || runLoadError}</span> : showingHistory.rows.length ? <div className="tc-executions">{showingHistory.rows.map((execution, index) => <div key={`${execution.runId}-${execution.id || index}`}><span className={`tc-status tc-status-${String(execution.status || execution.caseStatus || 'not_run').toLowerCase().replaceAll('_', '-')}`}>{execution.status || execution.caseStatus || 'Status not recorded'}</span><span>{execution.executedAt || execution.createdAt ? formatDate(execution.executedAt || execution.createdAt) : 'Date not recorded'}</span><button type="button" className="tc-text-link" onClick={() => navigate(`/app/runs/${execution.runId}?tab=report`)}>{execution.runName || `Run ${execution.runId.slice(0, 8)}`}<ExternalLink size={12} /></button>{execution.artifactCount > 0 && <button type="button" className="tc-text-link" onClick={() => navigate(`/app/runs/${execution.runId}?tab=artifacts`)}>Artifacts &amp; Evidence ({execution.artifactCount})<ExternalLink size={12} /></button>}</div>)}</div> : <p>No execution records found.</p>}</section>
                        {selectedCase.lifecycle === 'archived' ? null : <div className="tc-detail-footer"><button type="button" className="tc-archive" onClick={archiveCase}>Archive test case</button></div>}
                    </aside>}
                    {!selectedCase && cases.length > 0 && <aside className="tc-detail tc-detail-empty"><span>Select a test case to inspect its details.</span></aside>}
                </div>
            )}

            {formOpen && createPortal(<div className="tc-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setFormOpen(false); }}>
                <section className="tc-form-dialog" role="dialog" aria-modal="true" aria-labelledby="tc-form-title">
                    <header><div><span>{selectedSuite?.name || 'Test suite'}</span><h2 id="tc-form-title">{editingCase ? 'Edit test case' : 'Create test case'}</h2></div><button type="button" aria-label="Close form" onClick={() => setFormOpen(false)}><X size={16} /></button></header>
                    <form onSubmit={event => saveForm(event, form.status)}>
                        <div className="tc-form-grid">
                            <label className="wide">Title *<input value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} maxLength={200} required /></label>
                            <label>Description<textarea value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} rows={3} /></label>
                            <label>Preconditions<textarea value={form.preconditions} onChange={event => setForm({ ...form, preconditions: event.target.value })} rows={3} placeholder="One precondition per line" /></label>
                            <label>Suite association<select value={selectedSuite?.id || ''} onChange={event => { setSuiteId(event.target.value); setSelectedKey(''); setForm(current => ({ ...current, requirementId: '' })); }} disabled={Boolean(editingCase)}>{suites.map(suite => <option key={suite.id} value={suite.id}>{suite.name}</option>)}</select>{editingCase && <small>Use “Add a copy to another suite” to create a related case in another suite.</small>}</label>
                            <label>Test category<select value={form.type} onChange={event => setForm({ ...form, type: event.target.value })}>{['Functional', 'Negative', 'Edge', 'Security', 'API', 'Non-functional'].map(type => <option key={type}>{type}</option>)}</select></label>
                            <label>Execution method<select value={form.method} onChange={event => setForm({ ...form, method: event.target.value })}><option value="manual">Manual</option><option value="automated">Automated</option></select></label>
                            <label>Priority<select value={form.priority} onChange={event => setForm({ ...form, priority: event.target.value })}>{PRIORITIES.map(value => <option key={value}>{value}</option>)}</select></label>
                            <label>Status<select value={form.status} onChange={event => setForm({ ...form, status: event.target.value })}><option>Draft</option><option>Needs Review</option><option>Ready</option></select></label>
                            <label>Requirement<select value={form.requirementId} onChange={event => setForm({ ...form, requirementId: event.target.value })}><option value="">No requirement linked</option>{selectedRequirements.map(requirement => <option key={requirement.id} value={requirement.id}>{requirement.id} — {requirement.title}</option>)}</select></label>
                            <label className="wide">Overall expected result<textarea value={form.expectedResult} onChange={event => setForm({ ...form, expectedResult: event.target.value })} rows={2} /></label>
                        </div>
                        <div className="tc-steps-editor"><div><h3>Steps</h3><button type="button" className="tc-text-link" onClick={() => setForm({ ...form, steps: [...form.steps, { action: '', expected: '' }] })}><Plus size={13} />Add step</button></div>
                            {form.steps.map((step, index) => <div className="tc-step-editor" key={`edit-step-${index}`}><span className="tc-step-number">{index + 1}</span><label>Action<textarea value={step.action} onChange={event => setForm({ ...form, steps: form.steps.map((item, position) => position === index ? { ...item, action: event.target.value } : item) })} rows={2} /></label><label>Expected result<textarea value={step.expected} onChange={event => setForm({ ...form, steps: form.steps.map((item, position) => position === index ? { ...item, expected: event.target.value } : item) })} rows={2} /></label><div className="tc-step-actions"><button type="button" aria-label={`Move step ${index + 1} up`} disabled={index === 0} onClick={() => setForm({ ...form, steps: form.steps.map((item, position, list) => position === index ? list[index - 1] : position === index - 1 ? list[index] : item) })}><ArrowUp size={13} /></button><button type="button" aria-label={`Move step ${index + 1} down`} disabled={index === form.steps.length - 1} onClick={() => setForm({ ...form, steps: form.steps.map((item, position, list) => position === index ? list[index + 1] : position === index + 1 ? list[index] : item) })}><ArrowDown size={13} /></button><button type="button" aria-label={`Remove step ${index + 1}`} onClick={() => setForm({ ...form, steps: form.steps.filter((_, position) => position !== index) })}><X size={13} /></button></div></div>)}
                        </div>
                        {form.method === 'automated' && <div className="tc-form-grid"><label>Framework<input value={form.framework} onChange={event => setForm({ ...form, framework: event.target.value })} /></label><label>Script reference<input value={form.scriptRef} onChange={event => setForm({ ...form, scriptRef: event.target.value })} placeholder="tests/e2e/login.spec.js" /></label><label className="wide">Playwright script<textarea value={form.scriptCode} onChange={event => setForm({ ...form, scriptCode: event.target.value })} rows={5} /></label><div className="tc-mapping-help wide">A script reference or script body is saved as a draft mapping. The case can be marked Ready only after its existing Playwright mapping has a valid status.</div></div>}
                        {formError && <div className="tc-form-error" role="alert">{formError}</div>}
                        <footer><button type="button" onClick={() => setFormOpen(false)}>Cancel</button><button type="button" disabled={isSaving} onClick={event => saveForm(event, 'Draft')}>{isSaving ? 'Saving…' : 'Save as Draft'}</button><button type="submit" className="tc-primary" disabled={isSaving}><Check size={14} />{isSaving ? 'Saving…' : 'Save test case'}</button><button type="button" className="tc-ready" disabled={isSaving} onClick={event => saveForm(event, 'Ready')}>Mark Ready</button></footer>
                    </form>
                </section>
            </div>, document.body)}

            {addToSuiteOpen && selectedCase && createPortal(<div className="tc-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setAddToSuiteOpen(false); }}><section className="tc-confirm-dialog tc-suite-copy-dialog" role="dialog" aria-modal="true" aria-labelledby="tc-copy-title"><h2 id="tc-copy-title">Add a copy to another suite</h2><p>The original stays in {selectedCase.suiteName}. The new case is saved as a draft.</p><label>Target suite<select value={targetSuiteId} onChange={event => setTargetSuiteId(event.target.value)}><option value="">Select a suite</option>{suites.filter(suite => suite.id !== selectedCase.suiteId).map(suite => <option key={suite.id} value={suite.id}>{suite.project ? `${suite.project} / ` : ''}{suite.name}</option>)}</select></label>{error && <div className="tc-form-error">{error}</div>}<footer><button type="button" onClick={() => setAddToSuiteOpen(false)}>Cancel</button><button type="button" className="tc-primary" disabled={!targetSuiteId || isSaving} onClick={addCaseToSelectedSuite}>{isSaving ? 'Saving…' : 'Add to suite'}</button></footer></section></div>, document.body)}

            {deleteTarget && createPortal(<div className="tc-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setDeleteTarget(null); }}><section className="tc-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="tc-delete-title"><h2 id="tc-delete-title">Delete {deleteTarget.id}?</h2><p>This removes the case from its suite. Existing execution records and run snapshots are preserved.</p>{error && <div className="tc-form-error">{error}</div>}<footer><button type="button" onClick={() => setDeleteTarget(null)}>Cancel</button><button type="button" className="tc-delete-confirm" disabled={isSaving} onClick={deleteCase}>{isSaving ? 'Deleting…' : 'Delete test case'}</button></footer></section></div>, document.body)}
        </div>
    );
};

export default TestCasesPage;
