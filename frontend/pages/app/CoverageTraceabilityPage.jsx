import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Check, ChevronRight, Download, Search, ShieldCheck, X } from 'lucide-react';
import { useHistory } from '../../hooks/useHistory';
import { executionService } from '../../services/executionService';
import { sessionService } from '../../services/sessionService';
import { DataLoadingState } from '../../components/loading';
import '../../styles/app/CoverageTraceability.css';

const CATEGORY_KEYS = ['functional', 'negative', 'edge', 'security', 'nonFunctional', 'apiChecklist', 'api', 'testCases', 'tests'];
const EXECUTED = new Set(['passed', 'failed', 'blocked', 'skipped', 'timed_out', 'infrastructure_error']);

const getSuiteData = (item) => item?.suiteData || item?.suite_data || item?.data || item?.suite || null;
const getCaseRequirementRef = (testCase) => testCase?.requirementId || testCase?.requirementRef || testCase?.reqId || null;
const readRequirementText = (requirement) => typeof requirement === 'string'
    ? requirement
    : requirement?.description || requirement?.requirement || requirement?.text || requirement?.title || '';
const readRequirementId = (requirement) => typeof requirement === 'object'
    ? requirement.id || requirement.reqId || requirement.requirementId || null
    : null;
const runSuiteId = (run) => run?.suiteId || run?.suite_id || null;
const runTime = (run) => run?.createdAt || run?.created_at || run?.updatedAt || run?.updated_at || null;

const updateRequirementMappings = (suite, requirement, testCaseIds) => {
    const next = structuredClone(suite);
    const sources = [
        ['understanding', 'functional_requirements'],
        ['requirements'],
        ['traceability', 'matrix']
    ];
    const getAt = (root, path) => path.reduce((value, key) => value?.[key], root);
    const sourcePath = sources.find(path => {
        const value = getAt(next, path);
        return Array.isArray(value) ? value.length > 0 : value && typeof value === 'object' && Object.keys(value).length > 0;
    });
    if (!sourcePath) throw new Error('This suite has no saved requirement records to map.');
    const raw = getAt(next, sourcePath);
    const addIds = new Set(testCaseIds.map(String));
    const removeIds = new Set(requirement.explicitCaseRefs.map(String));
    CATEGORY_KEYS.flatMap(category => Array.isArray(next[category]) ? next[category] : [])
        .filter(test => String(getCaseRequirementRef(test) || '') === String(requirement.id || ''))
        .map(test => String(test.testCaseId || test.id || '')).filter(Boolean).forEach(id => removeIds.add(id));
    if (requirement.id) {
        CATEGORY_KEYS.forEach(category => {
            if (!Array.isArray(next[category])) return;
            next[category] = next[category].map(test => {
                const id = String(test?.testCaseId || test?.id || '');
                if (String(getCaseRequirementRef(test) || '') !== String(requirement.id) || addIds.has(id)) return test;
                const updated = { ...test };
                ['requirementId', 'requirementRef', 'reqId'].forEach(field => delete updated[field]);
                return updated;
            });
        });
    }
    const updateRecord = record => {
        const current = record?.testCaseIds || record?.linkedCases || record?.testCases || [];
        const ids = current.map(ref => typeof ref === 'object' ? (ref.testCaseId || ref.id) : ref).filter(Boolean).map(String);
        const mapped = [...new Set([...ids.filter(id => !removeIds.has(id)), ...addIds])];
        const rest = { ...record };
        delete rest.linkedCases;
        delete rest.testCases;
        return { ...rest, testCaseIds: mapped };
    };
    if (Array.isArray(raw)) {
        const index = raw.findIndex((item, itemIndex) => {
            const id = readRequirementId(item);
            return requirement.id ? String(id) === String(requirement.id) : requirement.key === `source:${itemIndex}:${readRequirementText(item)}`;
        });
        if (index < 0) throw new Error('The selected requirement is no longer in this suite. Refresh and try again.');
        if (typeof raw[index] !== 'object' || raw[index] === null) raw[index] = { description: String(raw[index] || '') };
        raw[index] = updateRecord(raw[index]);
    } else {
        const key = requirement.id && raw[requirement.id] !== undefined ? requirement.id : Object.keys(raw).find(id => {
            const value = raw[id];
            return requirement.id ? String(readRequirementId(value) || id) === String(requirement.id) : readRequirementText(value) === requirement.title;
        });
        if (!key) throw new Error('The selected requirement is no longer in this suite. Refresh and try again.');
        const value = raw[key];
        raw[key] = updateRecord(typeof value === 'object' && value !== null ? value : { description: String(value || '') });
    }
    return next;
};

const requirementsFromSuite = (item) => {
    const suite = getSuiteData(item);
    if (!suite || typeof suite !== 'object') return { requirements: [], testCases: [] };
    const rawSources = [suite.understanding?.functional_requirements, suite.requirements, suite.traceability?.matrix];
    const rawRequirements = rawSources.find(source => Array.isArray(source) ? source.length > 0 : source && typeof source === 'object' && Object.keys(source).length > 0) || [];
    const requirementList = Array.isArray(rawRequirements) ? rawRequirements : Object.entries(rawRequirements).map(([id, value]) =>
        typeof value === 'object' && value !== null ? { ...value, id: value.id || value.reqId || id } : { id, description: String(value || '') }
    );
    const testCases = CATEGORY_KEYS.flatMap(key => Array.isArray(suite[key]) ? suite[key] : []);
    const requirements = requirementList.map((requirement, index) => ({
        key: readRequirementId(requirement) ? `id:${readRequirementId(requirement)}` : `source:${index}:${readRequirementText(requirement)}`,
        id: readRequirementId(requirement),
        description: readRequirementText(requirement),
        category: requirement?.category || '',
        priority: requirement?.priority || requirement?.importance || '',
        explicitCaseRefs: (requirement?.testCaseIds || requirement?.linkedCases || requirement?.testCases || [])
            .map(ref => typeof ref === 'object' ? (ref.testCaseId || ref.id) : ref).filter(Boolean).map(String)
    }));

    if (requirements.length === 0 && item?.requirement?.trim()) {
        requirements.push({ key: `source:${item.id || item.sessionId}:original`, id: null, description: item.requirement.trim(), category: '', priority: '', explicitCaseRefs: [] });
    }
    return { requirements, testCases };
};

const mapExecutionStatus = (id, coverageRequirement) => {
    const failedIds = new Set((coverageRequirement?.failedCases || []).map(String));
    const passedIds = new Set((coverageRequirement?.passedCases || []).map(String));
    if (failedIds.has(String(id))) return 'failed';
    if (passedIds.has(String(id))) return 'passed';
    const linked = (coverageRequirement?.linkedTests || []).find(test => String(test.testCaseId || test.runCaseId) === String(id));
    return (linked?.status || 'not_run').toLowerCase();
};

const buildRequirementRows = (source, coverage) => {
    const coverageRows = coverage?.requirements || [];
    const executionByCaseId = new Map(coverageRows.flatMap(row => row.linkedTests || []).map(test => [String(test.testCaseId || test.runCaseId), test]));
    const coverageById = new Map(coverageRows.filter(row => row.id).map(row => [String(row.id), row]));
    const sourceById = new Map(source.requirements.filter(row => row.id).map(row => [String(row.id), row]));
    const keyForCoverage = (row, index) => row.id
        ? `id:${row.id}`
        : row.key || source.requirements.find(item => item.description && item.description === row.description)?.key || `coverage:${index}:${row.description || ''}`;
    const coverageEntries = coverageRows.map((row, index) => [keyForCoverage(row, index), row]);
    const keys = new Set([...source.requirements.map(row => row.key), ...coverageEntries.map(([key]) => key)]);

    return [...keys].map(key => {
        const requirementId = key.startsWith('id:') ? key.slice(3) : null;
        const base = requirementId ? sourceById.get(requirementId) : source.requirements.find(row => row.key === key);
        const api = requirementId ? coverageById.get(requirementId) : coverageEntries.find(([coverageKey]) => coverageKey === key)?.[1];
        const explicitRefs = new Set([...(base?.explicitCaseRefs || []), ...(!base ? (api?.linkedCases || []).map(String) : [])]);
        const currentSuiteLinks = new Set(source.testCases.filter(test => {
            const refs = [test.id, test.testCaseId].filter(Boolean).map(String);
            return (requirementId && String(getCaseRequirementRef(test) || '') === String(requirementId)) || refs.some(id => explicitRefs.has(id));
        }).flatMap(test => [test.id, test.testCaseId].filter(Boolean).map(String)));
        const linkedTests = (api?.linkedTests || []).filter(test => !base || currentSuiteLinks.has(String(test.testCaseId || ''))).map(test => ({
            id: test.runCaseId || test.testCaseId,
            testCaseId: test.testCaseId || test.runCaseId,
            title: test.title || '',
            category: test.category || '',
            priority: test.priority || '',
            executionType: test.executionType || '',
            status: (test.status || 'not_run').toLowerCase(),
            durationMs: Number(test.durationMs || 0),
            executedAt: test.executedAt || null,
            actualResult: test.actualResult || ''
        }));

        source.testCases.forEach(test => {
            const testIds = [test.id, test.testCaseId].filter(Boolean).map(String);
            const explicitRequirement = getCaseRequirementRef(test);
            const isExplicitlyLinked = (requirementId && String(explicitRequirement) === requirementId) || testIds.some(id => explicitRefs.has(id));
            if (!isExplicitlyLinked) return;
            const testId = test.testCaseId || test.id;
            if (linkedTests.some(linked => String(linked.testCaseId) === String(testId))) return;
            const execution = executionByCaseId.get(String(testId));
            const status = (execution?.status || mapExecutionStatus(testId, api, test)).toLowerCase();
            linkedTests.push({
                id: execution?.runCaseId || test.id || testId,
                testCaseId: testId,
                title: execution?.title || test.title || test.scenario || '',
                category: test.type || '',
                priority: test.priority || '',
                executionType: execution?.executionType || test.executionType || '',
                status,
                durationMs: Number(execution?.durationMs || test.durationMs || 0),
                executedAt: execution?.executedAt || test.executedAt || null,
                actualResult: execution?.actualResult || test.actualResult || ''
            });
        });

        const uniqueTests = [...new Map(linkedTests.map(test => [String(test.testCaseId), test])).values()];
        const executedCount = uniqueTests.filter(test => EXECUTED.has(test.status)).length;
        const passedCount = uniqueTests.filter(test => test.status === 'passed').length;
        const failedCount = uniqueTests.filter(test => test.status === 'failed').length;
        const hasFailure = uniqueTests.some(test => ['failed', 'blocked', 'timed_out', 'infrastructure_error'].includes(test.status));
        let status = 'uncovered';
        if (uniqueTests.length > 0) {
            if (hasFailure) status = 'failing';
            else if (passedCount === uniqueTests.length) status = 'verified';
            else if (executedCount === 0) status = 'unverified';
            else status = 'partial';
        }

        return {
            key,
            id: base?.id || api?.id || null,
            title: base?.description || api?.description || '',
            category: base?.category || api?.category || '',
            priority: base?.priority || api?.priority || '',
            explicitCaseRefs: [...explicitRefs],
            linkedTests: uniqueTests,
            linkedCount: uniqueTests.length,
            executedCount,
            passedCount,
            failedCount,
            status
        };
    }).filter(row => row.title || row.id || row.linkedCount > 0);
};

const formatUpdated = (value) => value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Not recorded';

const CoverageTraceabilityPage = ({ view = 'coverage' }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { history, isLoading: isLoadingHistory } = useHistory();
    const [runs, setRuns] = useState([]);
    const [isLoadingRuns, setIsLoadingRuns] = useState(true);
    const [runsError, setRunsError] = useState('');
    const [selectedSuiteId, setSelectedSuiteId] = useState('');
    const [selectedRunId, setSelectedRunId] = useState('');
    const [coverageResult, setCoverageResult] = useState({ runId: '', data: null, error: '' });
    const [coverageRetry, setCoverageRetry] = useState(0);
    const [search, setSearch] = useState('');
    const [requirementPage, setRequirementPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState('all');
    const [priorityFilter, setPriorityFilter] = useState('all');
    const [selectedRequirementKey, setSelectedRequirementKey] = useState('');
    const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [exportError, setExportError] = useState('');
    const [mappingOpen, setMappingOpen] = useState(false);
    const [mappingQuery, setMappingQuery] = useState('');
    const [mappingSelection, setMappingSelection] = useState([]);
    const [isSavingMapping, setIsSavingMapping] = useState(false);
    const [mappingMessage, setMappingMessage] = useState('');
    const [mappingFeedback, setMappingFeedback] = useState('');

    useEffect(() => {
        let current = true;
        executionService.listRuns({ limit: 100, sort: 'newest' }).then(result => {
            if (current && result?.success) setRuns(result.data || []);
            else if (current) setRunsError(result?.message || 'Execution runs could not be loaded.');
        }).catch(error => { if (current) setRunsError(error.message || 'Execution runs could not be loaded.'); })
            .finally(() => { if (current) setIsLoadingRuns(false); });
        return () => { current = false; };
    }, []);

    const suites = useMemo(() => {
        const source = history.filter(item => {
            const suite = getSuiteData(item);
            return Boolean(suite && typeof suite === 'object' && (
                CATEGORY_KEYS.some(key => Array.isArray(suite[key]) && suite[key].length > 0) ||
                (Array.isArray(suite.requirements) ? suite.requirements.length > 0 : suite.requirements && Object.keys(suite.requirements).length > 0) ||
                (Array.isArray(suite.understanding?.functional_requirements) ? suite.understanding.functional_requirements.length > 0 : suite.understanding?.functional_requirements && Object.keys(suite.understanding.functional_requirements).length > 0) || item.requirement
            ));
        });
        const unique = new Map(source.map(item => [String(item.id || item.sessionId), item]));
        runs.forEach(run => {
            const id = runSuiteId(run);
            if (id && !unique.has(String(id))) unique.set(String(id), { id, sessionId: id, title: run.suiteName || run.name || 'Test suite', suite: null });
        });
        return [...unique.values()];
    }, [history, runs]);

    const defaultSuiteId = useMemo(() => {
        const firstRunSuite = runs.map(runSuiteId).find(Boolean);
        return String(firstRunSuite || suites[0]?.id || suites[0]?.sessionId || '');
    }, [runs, suites]);
    const effectiveSuiteId = selectedSuiteId || defaultSuiteId;
    const selectedSuite = suites.find(item => String(item.id || item.sessionId) === String(effectiveSuiteId)) || null;
    const availableRuns = useMemo(() => runs.filter(run => String(runSuiteId(run) || '') === String(effectiveSuiteId)), [runs, effectiveSuiteId]);
    const effectiveRunId = availableRuns.some(run => String(run.id) === String(selectedRunId))
        ? selectedRunId
        : String(availableRuns[0]?.id || '');

    useEffect(() => {
        if (!effectiveRunId) return undefined;
        let current = true;
        executionService.getRunCoverage(effectiveRunId).then(result => {
            if (current && result?.success) setCoverageResult({ runId: effectiveRunId, data: result.data || null, error: '' });
            else if (current) setCoverageResult({ runId: effectiveRunId, data: null, error: result?.message || 'Requirement coverage could not be loaded.' });
        }).catch(error => { if (current) setCoverageResult({ runId: effectiveRunId, data: null, error: error.message || 'Requirement coverage could not be loaded.' }); });
        return () => { current = false; };
    }, [effectiveRunId, coverageRetry]);

    const suiteSource = useMemo(() => requirementsFromSuite(selectedSuite), [selectedSuite]);
    const coverage = coverageResult.runId === effectiveRunId ? coverageResult.data : null;
    const coverageError = coverageResult.runId === effectiveRunId ? coverageResult.error : '';
    const isLoadingCoverage = Boolean(effectiveRunId && coverageResult.runId !== effectiveRunId);
    const requirements = useMemo(() => buildRequirementRows(suiteSource, coverage), [suiteSource, coverage]);
    const counts = useMemo(() => ({
        total: requirements.length,
        covered: requirements.filter(row => row.linkedCount > 0).length,
        uncovered: requirements.filter(row => row.status === 'uncovered').length,
        partial: requirements.filter(row => row.status === 'partial').length,
        failing: requirements.filter(row => row.status === 'failing').length,
        unverified: requirements.filter(row => row.status === 'unverified').length,
        verified: requirements.filter(row => row.status === 'verified').length
    }), [requirements]);
    const coveragePercent = counts.total ? Math.round((counts.covered / counts.total) * 100) : null;
    const latestUpdated = runTime(availableRuns.find(run => String(run.id) === String(effectiveRunId))) || selectedSuite?.updatedAt || selectedSuite?.date || selectedSuite?.createdAt;
    const isLoading = isLoadingHistory || isLoadingRuns;

    const filteredRequirements = useMemo(() => requirements.filter(row => {
        const query = search.trim().toLowerCase();
        const matchesSearch = !query || `${row.id || ''} ${row.title} ${row.category}`.toLowerCase().includes(query);
        const matchesStatus = statusFilter === 'all' ||
            (statusFilter === 'covered' ? row.linkedCount > 0 : row.status === statusFilter);
        const matchesPriority = priorityFilter === 'all' || (row.priority || '').toLowerCase() === priorityFilter;
        return matchesSearch && matchesStatus && matchesPriority;
    }), [requirements, search, statusFilter, priorityFilter]);
    const requirementPageSize = 25;
    const requirementPageCount = Math.max(1, Math.ceil(filteredRequirements.length / requirementPageSize));
    const pageRequirements = filteredRequirements.slice((requirementPage - 1) * requirementPageSize, requirementPage * requirementPageSize);

    useEffect(() => { setRequirementPage(1); }, [search, statusFilter, priorityFilter, effectiveSuiteId]);

    const selectedRequirement = filteredRequirements.find(row => row.key === selectedRequirementKey) || filteredRequirements[0] || null;
    const mappingDescription = selectedRequirement?.title || selectedSuite?.requirement || selectedSuite?.rawRequirement || selectedSuite?.description || '';
    const mappingDescriptionLabel = selectedRequirement?.title ? 'Requirement description' : mappingDescription ? 'Source specification' : 'Requirement description';

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('suiteId') && params.get('suiteId') !== selectedSuiteId) setSelectedSuiteId(params.get('suiteId'));
    }, [location.search, selectedSuiteId]);

    useEffect(() => {
        const requirementId = new URLSearchParams(location.search).get('requirementId');
        if (!requirementId) return;
        const match = requirements.find(row => String(row.id || row.key) === requirementId);
        if (match) setSelectedRequirementKey(match.key);
    }, [location.search, requirements]);

    const selectRequirement = (row) => {
        setSelectedRequirementKey(row.key);
        setMobileDetailOpen(true);
        const params = new URLSearchParams(location.search);
        params.set('suiteId', effectiveSuiteId);
        params.set('requirementId', String(row.id || row.key));
        navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
    };

    const openMapping = () => {
        setMappingSelection(selectedRequirement?.linkedTests.map(test => String(test.testCaseId)) || []);
        setMappingQuery('');
        setMappingMessage('');
        setMappingOpen(true);
    };

    const saveRequirementMapping = async () => {
        const suiteData = getSuiteData(selectedSuite);
        const sessionId = selectedSuite?.sessionId || selectedSuite?.id;
        if (!suiteData || !sessionId || selectedSuite?.isRemote === false) {
            setMappingMessage('This suite is not a saved workspace suite. Sign in and open a persisted suite to change mappings.');
            return;
        }
        setIsSavingMapping(true);
        setMappingMessage('');
        try {
            const updatedSuiteData = updateRequirementMappings(suiteData, selectedRequirement, mappingSelection);
            const result = await sessionService.update(sessionId, { suiteData: updatedSuiteData });
            if (!result?.success) throw new Error(result?.message || 'Mapping changes could not be saved.');
            window.dispatchEvent(new Event('historyUpdated'));
            setSelectedSuiteId(String(sessionId));
            setCoverageRetry(value => value + 1);
            setMappingFeedback('Requirement mappings saved.');
            setMappingMessage('');
            setMappingOpen(false);
        } catch (error) {
            setMappingMessage(error.message || 'Mapping changes could not be saved.');
        } finally {
            setIsSavingMapping(false);
        }
    };

    const selectableCases = useMemo(() => {
        const cases = suiteSource.testCases.map(test => ({
            id: String(test.testCaseId || test.id || ''),
            title: test.title || test.scenario || test.testScenario || '',
            category: test.type || '',
            priority: test.priority || ''
        })).filter(test => test.id);
        const query = mappingQuery.trim().toLowerCase();
        return [...new Map(cases.map(test => [test.id, test])).values()].filter(test => !query || `${test.id} ${test.title} ${test.category}`.toLowerCase().includes(query));
    }, [suiteSource.testCases, mappingQuery]);

    const exportCoverage = async () => {
        if (!effectiveRunId) return;
        setIsExporting(true);
        setExportError('');
        try {
            await executionService.exportReport(effectiveRunId, 'csv');
        } catch (error) {
            setExportError(error.message || 'Coverage report export failed.');
        } finally {
            setIsExporting(false);
        }
    };

    if (isLoading && suites.length === 0 && runs.length === 0) return <DataLoadingState message="Loading requirement coverage…" />;

    return (
        <div className={`ws-page-container coverage-trace-page ${effectiveRunId && (isLoadingCoverage || coverageError) ? 'ct-data-unavailable' : ''}`}>
            <header className="ct-page-header">
                <div className="ct-breadcrumb"><NavLink to="/app/workspace">Quality</NavLink><span>/</span><span>Coverage &amp; Traceability</span></div>
                <div className="ct-header-main">
                    <div className="ct-header-title">
                        <h1>{selectedSuite?.title || selectedSuite?.feature || selectedSuite?.name || (effectiveRunId ? 'Test suite' : 'Coverage & Traceability')}</h1>
                        <p>{selectedSuite?.requirement || 'Requirement links and execution verification for the selected suite.'}</p>
                    </div>
                    <div className="ct-header-actions">
                        <select aria-label="Select test suite" value={effectiveSuiteId} onChange={event => {
                            const nextId = event.target.value;
                            setSelectedSuiteId(nextId);
                            const nextRun = runs.find(run => String(runSuiteId(run) || '') === nextId);
                            setSelectedRunId(nextRun ? String(nextRun.id) : '');
                            setSelectedRequirementKey('');
                        }}>
                            {suites.length === 0 ? <option value="">No suites available</option> : suites.map(item => <option key={item.id || item.sessionId} value={item.id || item.sessionId}>{item.title || item.feature || item.name || 'Test suite'}</option>)}
                        </select>
                        {availableRuns.length > 0 && <select aria-label="Select execution run" value={effectiveRunId} onChange={event => setSelectedRunId(event.target.value)}>{availableRuns.map(run => <option key={run.id} value={run.id}>{run.name || String(run.id).slice(0, 8)} · {run.status || 'unknown'}</option>)}</select>}
                        <button type="button" onClick={exportCoverage} disabled={!effectiveRunId || isExporting} className="ct-export"><Download size={14} />{isExporting ? 'Exporting…' : 'Export report'}</button>
                    </div>
                </div>
                <div className="ct-context-line"><span>{counts.total} requirements</span><span>Updated {formatUpdated(latestUpdated)}</span>{effectiveRunId && <span>Run {String(effectiveRunId).slice(0, 8)}</span>}</div>
                <nav className="ct-view-tabs" aria-label="Coverage views">
                    <NavLink to="/app/coverage" className={view === 'coverage' ? 'active' : ''}>Coverage</NavLink>
                    <NavLink to="/app/traceability" className={view === 'traceability' ? 'active' : ''}>Traceability</NavLink>
                </nav>
            </header>

            {runsError && <div className="ct-error" role="alert">{runsError}</div>}
            {coverageError && <div className="ct-error" role="alert">{coverageError}<button type="button" onClick={() => setCoverageRetry(value => value + 1)}>Retry</button></div>}
            {exportError && <div className="ct-error" role="alert">{exportError}</div>}
            {mappingFeedback && <div className="ct-mapping-feedback" role="status">{mappingFeedback}<button type="button" onClick={() => setMappingFeedback('')}>Dismiss</button></div>}
            {effectiveRunId && isLoadingCoverage && <DataLoadingState message="Loading persisted requirement outcomes…" />}

            <section className="ct-overview" aria-label="Requirement coverage overview">
                <div className="ct-summary-values">
                    <button type="button" onClick={() => setStatusFilter('all')}>Total <strong>{counts.total}</strong></button>
                    <button type="button" onClick={() => setStatusFilter('covered')}>Covered (linked) <strong>{counts.covered}</strong></button>
                    <button type="button" onClick={() => setStatusFilter('uncovered')}>Uncovered <strong>{counts.uncovered}</strong></button>
                    <button type="button" onClick={() => setStatusFilter('partial')}>Partial <strong>{counts.partial}</strong></button>
                    <button type="button" onClick={() => setStatusFilter('failing')}>Failing <strong>{counts.failing}</strong></button>
                    <button type="button" onClick={() => setStatusFilter('unverified')}>Unverified <strong>{counts.unverified}</strong></button>
                    <span className="ct-overall">{coveragePercent === null ? '—' : `${coveragePercent}% linked`}</span>
                </div>
                <div className="ct-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={coveragePercent ?? 0} aria-valuetext={coveragePercent === null ? 'No requirements recorded' : `${coveragePercent}% of requirements linked`} aria-label="Requirements linked to at least one test case">
                    <span style={{ width: `${coveragePercent ?? 0}%` }} />
                </div>
                <div className="ct-progress-caption"><span>Requirement linkage coverage</span><span>{counts.total ? `${counts.covered} of ${counts.total} have linked tests · ${counts.verified} fully verified` : 'No requirement records available'}</span></div>
            </section>

            <section className="ct-gaps" aria-label="Coverage gaps">
                <span className="ct-section-kicker">Coverage gaps</span>
                <button type="button" onClick={() => setStatusFilter('uncovered')}>No linked tests <strong>{counts.uncovered}</strong></button>
                <button type="button" onClick={() => setStatusFilter('partial')}>Incomplete execution <strong>{counts.partial}</strong></button>
                <button type="button" onClick={() => setStatusFilter('failing')}>Failing tests <strong>{counts.failing}</strong></button>
                <button type="button" onClick={() => setStatusFilter('unverified')}>Not executed <strong>{counts.unverified}</strong></button>
            </section>

            <section className="ct-explorer">
                <div className="ct-explorer-toolbar">
                    <div><h2>Requirements</h2><span>{filteredRequirements.length} of {requirements.length}</span></div>
                    <div className="ct-filters">
                        <label className="ct-search"><Search size={14} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search requirements" aria-label="Search requirements" /></label>
                        <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} aria-label="Filter by coverage status">
                            <option value="all">All requirements</option><option value="covered">Covered</option><option value="uncovered">Uncovered</option><option value="partial">Partially covered</option><option value="failing">Failing</option><option value="unverified">Unverified</option>
                        </select>
                        <select value={priorityFilter} onChange={event => setPriorityFilter(event.target.value)} aria-label="Filter by priority">
                            <option value="all">All priorities</option>{['critical', 'high', 'medium', 'low'].map(priority => <option key={priority} value={priority}>{priority[0].toUpperCase() + priority.slice(1)}</option>)}
                        </select>
                    </div>
                </div>
                {(statusFilter !== 'all' || priorityFilter !== 'all' || search.trim()) && <div className="ct-active-filters"><span>Filtered by {statusFilter !== 'all' ? statusFilter : ''}{priorityFilter !== 'all' ? `${statusFilter !== 'all' ? ' · ' : ''}${priorityFilter} priority` : ''}{search.trim() ? `${statusFilter !== 'all' || priorityFilter !== 'all' ? ' · ' : ''}“${search.trim()}”` : ''}</span><button type="button" onClick={() => { setSearch(''); setStatusFilter('all'); setPriorityFilter('all'); }}>Clear filters</button></div>}

                {isLoadingHistory || isLoadingRuns ? <DataLoadingState message="Loading requirements and suites…" /> : requirements.length === 0 ? (
                    <div className="ct-empty"><ShieldCheck size={17} /><span>No requirement records are available for this suite.</span><small>Requirements must be present in the saved specification or explicitly linked from a test case.</small></div>
                ) : filteredRequirements.length === 0 ? (
                    <div className="ct-empty"><span>No requirements match these filters.</span><button type="button" onClick={() => { setSearch(''); setStatusFilter('all'); setPriorityFilter('all'); }}>Clear filters</button></div>
                ) : (
                    <div className={`ct-explorer-grid ${mobileDetailOpen ? 'mobile-detail-open' : ''}`}>
                        <div className="ct-requirement-list" role="list" aria-label="Requirements">
                            {pageRequirements.map(row => <button type="button" role="listitem" key={row.key} className={`ct-requirement-row ${selectedRequirement?.key === row.key ? 'active' : ''}`} onClick={() => selectRequirement(row)}>
                                <span className="ct-row-title"><span className="ct-req-id">{row.id || 'ID not recorded'}</span><strong>{row.title || 'Requirement text not recorded'}</strong><small>{row.category || 'Category not recorded'}{row.priority ? ` · ${row.priority} priority` : ''}</small></span>
                                <span className="ct-row-counts"><span>{row.linkedCount} linked</span><span>{row.executedCount} executed</span><span>{row.passedCount} passed</span><span>{row.failedCount} failed</span></span>
                                <span className={`ct-status status-${row.status}`}>{row.status === 'verified' ? 'Verified' : row.status === 'failing' ? 'Failing' : row.status === 'partial' ? 'Partial' : row.status === 'unverified' ? 'Unverified' : 'Uncovered'}</span>
                                <ChevronRight className="ct-row-chevron" size={15} />
                            </button>)}
                            {requirementPageCount > 1 && <div className="ct-pagination"><button type="button" disabled={requirementPage === 1} onClick={() => setRequirementPage(page => Math.max(1, page - 1))}>Previous</button><span>Page {requirementPage} of {requirementPageCount}</span><button type="button" disabled={requirementPage === requirementPageCount} onClick={() => setRequirementPage(page => Math.min(requirementPageCount, page + 1))}>Next</button></div>}
                        </div>

                        {selectedRequirement && <aside className="ct-detail-panel" aria-label="Selected requirement details">
                            <button type="button" className="ct-mobile-back" onClick={() => setMobileDetailOpen(false)}>‹ All requirements</button>
                            <div className="ct-detail-heading"><span className="ct-req-id">{selectedRequirement.id || 'ID not recorded'}</span><span className={`ct-status status-${selectedRequirement.status}`}>{selectedRequirement.status === 'verified' ? 'Verified' : selectedRequirement.status === 'failing' ? 'Failing' : selectedRequirement.status === 'partial' ? 'Partially covered' : selectedRequirement.status === 'unverified' ? 'Unverified' : 'Uncovered'}</span></div>
                            <h3>{selectedRequirement.title || 'Requirement text not recorded'}</h3>
                            <div className="ct-detail-meta"><span>Priority <strong>{selectedRequirement.priority || 'Not recorded'}</strong></span><span>Category <strong>{selectedRequirement.category || 'Not recorded'}</strong></span></div>
                            <div className="ct-linkage-heading"><h4>Requirement → Test cases → Results</h4><span>{selectedRequirement.linkedCount} linked</span></div>
                            {selectedRequirement.linkedTests.length === 0 ? <div className="ct-no-tests">No test cases are explicitly linked to this requirement.</div> : <div className="ct-test-links">
                                {selectedRequirement.linkedTests.map(test => <div className="ct-test-link" key={`${selectedRequirement.key}-${test.testCaseId}`}>
                                    <div className="ct-test-link-heading"><span className="ct-test-id">{test.testCaseId}</span><span className={`ct-test-status status-${test.status}`}>{test.status.replaceAll('_', ' ')}</span></div>
                                    <strong>{test.title || 'Test title not recorded'}</strong>
                                    <small>{test.priority || 'Priority not recorded'}{test.category ? ` · ${test.category}` : ''}{test.executionType ? ` · ${test.executionType}` : ''}</small>
                                    {(test.executedAt || effectiveRunId) && <small>{test.executedAt ? `Executed ${formatUpdated(test.executedAt)}` : 'Execution time not recorded'}{effectiveRunId ? ` · Run ${String(effectiveRunId).slice(0, 8)}` : ''}</small>}
                                    {test.actualResult && <p>{test.actualResult}</p>}
                                    <div className="ct-test-actions">
                                        {effectiveRunId && test.id && <button type="button" className="ct-open-run" onClick={() => navigate(`/app/runs/${effectiveRunId}?tab=cases&caseId=${encodeURIComponent(test.id)}`)}>Open test case <ArrowUpRight size={13} /></button>}
                                        {!effectiveRunId && effectiveSuiteId && <button type="button" className="ct-open-run" onClick={() => navigate(`/app/test-suites/${effectiveSuiteId}?testCaseId=${encodeURIComponent(test.testCaseId)}`)}>Open test case <ArrowUpRight size={13} /></button>}
                                        {effectiveRunId && <button type="button" className="ct-open-run" onClick={() => navigate(`/app/runs/${effectiveRunId}?tab=report`)}>Execution report <ArrowUpRight size={13} /></button>}
                                    </div>
                                </div>)}
                            </div>}
                            {effectiveSuiteId && <button type="button" className="ct-suite-link" onClick={openMapping}>Open suite mapping <ArrowUpRight size={13} /></button>}
                        </aside>}
                    </div>
                )}
            </section>
            {mappingOpen && selectedRequirement && createPortal(<div className="ct-mapping-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setMappingOpen(false); }}>
                <section className="ct-mapping-dialog" role="dialog" aria-modal="true" aria-labelledby="ct-mapping-title">
                    <header><div><span className="ct-section-kicker">{selectedSuite?.title || 'Test suite'}</span><h2 id="ct-mapping-title">Map tests to {selectedRequirement.id || 'requirement'}</h2></div><button type="button" aria-label="Close mapping" onClick={() => setMappingOpen(false)}><X size={17} /></button></header>
                    <div className="ct-mapping-description"><span>{mappingDescriptionLabel}</span><p>{mappingDescription || 'Requirement description not recorded.'}</p></div>
                    {!getSuiteData(selectedSuite) && <div className="ct-mapping-notice">This requirement has no saved suite association. Select a persisted suite in the page header to manage mappings.</div>}
                    <label className="ct-search"><Search size={14} /><input value={mappingQuery} onChange={event => setMappingQuery(event.target.value)} placeholder="Search test cases" aria-label="Search test cases to map" /></label>
                    <div className="ct-mapping-list">{selectableCases.length ? selectableCases.map(test => <label key={test.id} className="ct-mapping-row"><input type="checkbox" checked={mappingSelection.includes(test.id)} onChange={event => setMappingSelection(current => event.target.checked ? [...new Set([...current, test.id])] : current.filter(id => id !== test.id))} /><span><strong>{test.id}</strong><span>{test.title || 'Title not recorded'}</span><small>{test.category}{test.priority ? ` · ${test.priority}` : ''}</small></span></label>) : <div className="ct-empty">No test cases match this search.</div>}</div>
                    {mappingMessage && <div className="ct-mapping-feedback" role="status">{mappingMessage}</div>}
                    <footer><span>{mappingSelection.length} linked</span><div className="ct-mapping-footer-actions"><button type="button" onClick={() => setMappingOpen(false)}>Cancel</button><button type="button" className="ct-mapping-save" onClick={saveRequirementMapping} disabled={isSavingMapping || selectableCases.length === 0}><Check size={14} />{isSavingMapping ? 'Saving…' : 'Save mappings'}</button></div></footer>
                </section>
            </div>, document.body)}
        </div>
    );
};

export default CoverageTraceabilityPage;
