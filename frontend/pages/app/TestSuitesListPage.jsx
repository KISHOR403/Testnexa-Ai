import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Archive, ArrowDownUp, ChevronLeft, ChevronRight, Layers, Plus, RefreshCw, Search, X } from 'lucide-react';
import { sessionService } from '../../services/sessionService';
import { executionService } from '../../services/executionService';
import { DataLoadingState } from '../../components/loading';
import '../../styles/app/TestSuitesManagement.css';

const unwrap = (record) => {
    const value = record?.suiteData || record?.suite_data || record?.suite || record?.data || {};
    return value?.suiteData || value?.suite_data || value?.data || value;
};
const CASE_KEYS = ['testCases', 'tests', 'functional', 'negative', 'edge', 'security', 'nonFunctional', 'apiChecklist', 'api'];
const suiteCases = (data, recordsById = new Map()) => {
    const source = CASE_KEYS.flatMap(key => Array.isArray(data?.[key]) ? data[key] : []);
    (Array.isArray(data?.testCaseRefs) ? data.testCaseRefs : []).forEach(ref => {
        const sourceRecord = recordsById.get(String(ref.sourceSuiteId || ''));
        const sourceData = unwrap(sourceRecord);
        const linked = CASE_KEYS.flatMap(key => Array.isArray(sourceData?.[key]) ? sourceData[key] : [])
            .find(testCase => String(testCase?.id || testCase?.testCaseId || '') === String(ref.testCaseId || ''));
        if (linked) source.push(linked);
    });
    const seen = new Set();
    return source.filter((item, index) => {
        if (!item || typeof item !== 'object') return false;
        const id = String(item.id || item.testCaseId || `${item.title || item.testScenario || 'case'}-${index}`);
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
    });
};
const recordId = (record) => String(record?.id || record?._id || record?.sessionId || '');
const recordTitle = (record, data) => record?.title || record?.feature || data?.testSuiteName || data?.feature || 'Untitled suite';
const dateValue = (value) => value && !Number.isNaN(new Date(value).getTime())
    ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : 'Not recorded';
const emptyForm = () => ({ name: '', description: '', project: '', tags: '' });

export default function TestSuitesListPage() {
    const [records, setRecords] = useState([]);
    const [runs, setRuns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [historyError, setHistoryError] = useState('');
    const [reload, setReload] = useState(0);
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [sort, setSort] = useState('updated');
    const [page, setPage] = useState(1);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [bulkSaving, setBulkSaving] = useState(false);
    const [modal, setModal] = useState('');
    const [selected, setSelected] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');
    const perPage = 20;

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const first = await sessionService.list({ page: 1, limit: 50, sort: 'updatedAt' });
            if (!first?.success) throw new Error(first?.message || 'Test suites could not be loaded.');
            const all = [...(first.data || [])];
            for (let current = 2; current <= Number(first.pagination?.totalPages || 1); current += 1) {
                const response = await sessionService.list({ page: current, limit: 50, sort: 'updatedAt' });
                if (!response?.success) throw new Error(response?.message || 'Additional test suites could not be loaded.');
                all.push(...(response.data || []));
            }
            setRecords(all.filter(record => {
                const data = unwrap(record);
                return Boolean(data && (data.managedSuite === true || suiteCases(data).length || record.status === 'Archived'));
            }));
            try {
                const firstRuns = await executionService.listRuns({ page: 1, limit: 100, sort: 'newest' });
                if (!firstRuns?.success) throw new Error(firstRuns?.message || 'Execution history could not be loaded.');
                const allRuns = [...(firstRuns.data || [])];
                for (let current = 2; current <= Number(firstRuns.pagination?.totalPages || 1); current += 1) {
                    const response = await executionService.listRuns({ page: current, limit: 100, sort: 'newest' });
                    if (!response?.success) throw new Error(response?.message || 'Additional execution history could not be loaded.');
                    allRuns.push(...(response.data || []));
                }
                setRuns(allRuns);
                setHistoryError('');
            } catch (runError) {
                setRuns([]);
                setHistoryError(runError.message || 'Execution history could not be loaded.');
            }
        } catch (loadError) {
            setError(loadError.message || 'Test suites could not be loaded.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load, reload]);

    const suites = useMemo(() => {
        const recordsById = new Map(records.map(record => [recordId(record), record]));
        return records.map(record => {
        const data = unwrap(record);
        const tests = suiteCases(data, recordsById);
        const suiteId = recordId(record);
        const suiteRuns = runs.filter(run => String(run.suiteId || run.suite_id || '') === suiteId);
        const archived = String(record.status || data.suiteStatus || '').toLowerCase() === 'archived';
        const lastRun = suiteRuns.map(run => run.completedAt || run.completed_at || run.startedAt || run.started_at || run.createdAt || run.created_at).filter(Boolean).sort((a, b) => new Date(b) - new Date(a))[0];
        return {
            id: suiteId,
            name: recordTitle(record, data),
            description: data.description || record.requirement || record.rawRequirement || '',
            project: data.projectName || data.project || '',
            tags: Array.isArray(data.tags) ? data.tags : [],
            data,
            record,
            tests,
            manual: tests.filter(test => !test.automationMapping && !test.playwrightBinding && !test.isAutomated && !['automated', 'automation', 'playwright'].includes(String(test.executionType || test.executionMethod || test.method || '').toLowerCase())).length,
            automated: tests.filter(test => test.automationMapping || test.playwrightBinding || test.isAutomated || ['automated', 'automation', 'playwright'].includes(String(test.executionType || test.executionMethod || test.method || '').toLowerCase())).length,
            runs: suiteRuns,
            lastRun,
            archived,
            updatedAt: record.updatedAt || record.updated_at || record.createdAt || record.created_at || null,
            status: archived ? 'Archived' : record.status || 'Active'
        };
        });
    }, [records, runs]);

    const counts = useMemo(() => ({
        all: suites.length,
        active: suites.filter(suite => !suite.archived).length,
        cases: suites.reduce((sum, suite) => sum + suite.tests.length, 0),
        history: suites.filter(suite => suite.runs.length).length
    }), [suites]);
    const filtered = useMemo(() => {
        const text = query.trim().toLowerCase();
        const filteredRows = suites.filter(suite => {
            const matchesText = !text || `${suite.name} ${suite.id} ${suite.description} ${suite.project} ${suite.tags.join(' ')}`.toLowerCase().includes(text);
            const matchesStatus = statusFilter === 'all'
                || (statusFilter === 'active' && !suite.archived)
                || (statusFilter === 'archived' && suite.archived)
                || (statusFilter === 'withCases' && suite.tests.length > 0)
                || (statusFilter === 'withHistory' && suite.runs.length > 0);
            return matchesText && matchesStatus;
        });
        return filteredRows.sort((a, b) => sort === 'name'
            ? a.name.localeCompare(b.name)
            : new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    }, [suites, query, statusFilter, sort]);
    const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
    const rows = filtered.slice((page - 1) * perPage, page * perPage);
    useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

    const openCreate = () => {
        setSelected(null); setForm(emptyForm()); setFormError(''); setModal('create');
    };
    const openEdit = (suite) => {
        setSelected(suite);
        setForm({ name: suite.name, description: suite.description, project: suite.project, tags: suite.tags.join(', ') });
        setFormError(''); setModal('edit');
    };
    const saveSuite = async (event) => {
        event.preventDefault();
        if (!form.name.trim()) { setFormError('Suite name is required.'); return; }
        setSaving(true); setFormError('');
        try {
            const tags = form.tags.split(',').map(tag => tag.trim()).filter(Boolean);
            if (modal === 'create') {
                const suiteData = { managedSuite: true, managedSuiteVersion: 1, testSuiteName: form.name.trim(), description: form.description.trim(), projectName: form.project.trim(), tags, suiteStatus: 'Active', testCases: [] };
                const response = await sessionService.create({ title: form.name.trim(), requirement: form.description.trim(), context: 'web', depth: 'Standard', status: 'Draft', suiteData, summary: { total: 0 } });
                if (!response?.success) throw new Error(response?.message || 'Suite could not be created.');
            } else {
                const nextData = { ...selected.data, managedSuite: true, testSuiteName: form.name.trim(), description: form.description.trim(), projectName: form.project.trim(), tags };
                const response = await sessionService.update(selected.id, { title: form.name.trim(), requirement: form.description.trim(), suiteData: nextData });
                if (!response?.success) throw new Error(response?.message || 'Suite could not be updated.');
            }
            setModal(''); await load();
        } catch (saveError) {
            setFormError(saveError.message || 'The suite could not be saved.');
        } finally { setSaving(false); }
    };
    const toggleArchive = async (suite) => {
        const nextStatus = suite.archived ? 'Generated' : 'Archived';
        try {
            const response = await sessionService.update(suite.id, { status: nextStatus, suiteData: { ...suite.data, managedSuite: true, suiteStatus: suite.archived ? 'Active' : 'Archived' } });
            if (!response?.success) throw new Error(response?.message || 'Suite status could not be updated.');
            await load();
        } catch (actionError) { setError(actionError.message || 'Suite status could not be updated.'); }
    };
    const toggleSelected = (suiteId) => setSelectedIds(previous => {
        const next = new Set(previous);
        if (next.has(suiteId)) next.delete(suiteId); else next.add(suiteId);
        return next;
    });
    const togglePageSelection = () => setSelectedIds(previous => {
        const next = new Set(previous);
        const allPageSelected = rows.length > 0 && rows.every(suite => next.has(suite.id));
        rows.forEach(suite => allPageSelected ? next.delete(suite.id) : next.add(suite.id));
        return next;
    });
    const updateSelectedSuites = async () => {
        const targets = suites.filter(suite => selectedIds.has(suite.id));
        if (!targets.length) return;
        setBulkSaving(true);
        try {
            const outcomes = await Promise.allSettled(targets.map(suite => sessionService.update(suite.id, {
                status: suite.archived ? 'Generated' : 'Archived',
                suiteData: { ...suite.data, managedSuite: true, suiteStatus: suite.archived ? 'Active' : 'Archived' }
            })));
            const rejected = outcomes.find(outcome => outcome.status === 'rejected' || !outcome.value?.success);
            if (rejected) throw new Error(rejected.reason?.message || rejected.value?.message || 'Some suites could not be updated.');
            setSelectedIds(new Set());
            await load();
        } catch (actionError) { setError(actionError.message || 'Selected suites could not be updated.'); }
        finally { setBulkSaving(false); }
    };

    return <main className="sm-page">
        <header className="sm-header">
            <div><div className="sm-eyebrow">Quality / Workspace</div><h1>Test Suites</h1><p>Organize test collections and inspect their execution history.</p></div>
            <button className="sm-primary" type="button" onClick={openCreate}><Plus size={16} /> Create Test Suite</button>
        </header>
        <section className="sm-overview" aria-label="Suite overview">
            <button type="button" className={statusFilter === 'all' ? 'selected' : ''} onClick={() => { setStatusFilter('all'); setPage(1); }}><strong>{counts.all}</strong><span>Total suites</span></button>
            <button type="button" className={statusFilter === 'active' ? 'selected' : ''} onClick={() => { setStatusFilter('active'); setPage(1); }}><strong>{counts.active}</strong><span>Active suites</span></button>
            <button type="button" className={statusFilter === 'withCases' ? 'selected' : ''} onClick={() => { setStatusFilter('withCases'); setPage(1); }}><strong>{counts.cases}</strong><span>Test cases</span></button>
            <button type="button" className={statusFilter === 'withHistory' ? 'selected' : ''} onClick={() => { setStatusFilter('withHistory'); setPage(1); }}><strong>{counts.history}</strong><span>With execution history</span></button>
        </section>
        <div className="sm-toolbar">
            <label className="sm-search"><Search size={16} /><input aria-label="Search suites" placeholder="Search suites, IDs, project or tags" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} /></label>
            <div className="sm-controls">
                <select aria-label="Filter suites" value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setPage(1); }}><option value="all">All suites</option><option value="active">Active</option><option value="archived">Archived</option><option value="withCases">With test cases</option><option value="withHistory">With execution history</option></select>
                <button type="button" className="sm-secondary" onClick={() => setSort(value => value === 'updated' ? 'name' : 'updated')}><ArrowDownUp size={14} /> {sort === 'updated' ? 'Recently updated' : 'Name'}</button>
                {selectedIds.size > 0 && <button type="button" className="sm-secondary" disabled={bulkSaving} onClick={updateSelectedSuites}><Archive size={14} /> {bulkSaving ? 'Updating…' : `Archive / restore (${selectedIds.size})`}</button>}
            </div>
        </div>
        {error && <div className="sm-error"><span>{error}</span><button type="button" onClick={() => setReload(value => value + 1)}><RefreshCw size={14} /> Retry</button></div>}
        {historyError && <p className="sm-muted">Execution history unavailable: {historyError}</p>}
        {loading ? <DataLoadingState message="Loading saved test suites…" telemetryTag="TEST SUITES" skeletonType="table" count={5} /> : rows.length ? <>
            <div className="sm-table-wrap"><table className="sm-table"><thead><tr><th><input type="checkbox" aria-label="Select suites on this page" checked={rows.length > 0 && rows.every(suite => selectedIds.has(suite.id))} onChange={togglePageSelection} /></th><th>Suite</th><th>Cases</th><th>Execution mix</th><th>Last execution</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{rows.map(suite => <tr key={suite.id}>
                <td><input type="checkbox" aria-label={`Select ${suite.name}`} checked={selectedIds.has(suite.id)} onChange={() => toggleSelected(suite.id)} /></td><td><div className="sm-suite-cell"><Link to={`/app/test-suites/${encodeURIComponent(suite.id)}`} className="sm-suite-name">{suite.name}</Link><code>{suite.id}</code>{suite.description && <p>{suite.description}</p>}{suite.project && <small>Project label: {suite.project}</small>}</div></td>
                <td>{suite.tests.length}</td><td><span>{suite.manual} manual</span><span className="sm-separator">·</span><span>{suite.automated} automated</span></td><td>{suite.lastRun ? dateValue(suite.lastRun) : 'No runs yet'}</td>
                <td><span className={`sm-status ${suite.archived ? 'archived' : 'active'}`}>{suite.archived ? 'Archived' : 'Active'}</span></td>
                <td><div className="sm-row-actions"><Link to={`/app/test-suites/${encodeURIComponent(suite.id)}`}>Open</Link><button type="button" onClick={() => openEdit(suite)}>Edit</button><button type="button" onClick={() => toggleArchive(suite)} title={suite.archived ? 'Restore suite' : 'Archive suite'}><Archive size={14} />{suite.archived ? 'Restore' : 'Archive'}</button></div></td>
            </tr>)}</tbody></table></div>
            <div className="sm-pagination"><span>{filtered.length} suite{filtered.length === 1 ? '' : 's'} · Page {page} of {totalPages}</span><div><button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(value => value - 1)}><ChevronLeft size={16} /></button><button type="button" aria-label="Next page" disabled={page >= totalPages} onClick={() => setPage(value => value + 1)}><ChevronRight size={16} /></button></div></div>
        </> : <div className="sm-empty"><Layers size={20} /><h2>{query || statusFilter !== 'all' ? 'No suites match these filters' : 'No test suites yet'}</h2><p>{query || statusFilter !== 'all' ? 'Change the search or status filter to see other saved suites.' : 'Create a suite to organize test cases and track its runs.'}</p>{!query && statusFilter === 'all' && <button className="sm-primary" type="button" onClick={openCreate}><Plus size={15} /> Create Test Suite</button>}</div>}

        {modal && createPortal(<div className="sm-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) setModal(''); }}><section className="sm-modal" role="dialog" aria-modal="true" aria-labelledby="sm-modal-title"><header><div><div className="sm-eyebrow">Suite details</div><h2 id="sm-modal-title">{modal === 'create' ? 'Create Test Suite' : 'Edit Test Suite'}</h2></div><button type="button" aria-label="Close" onClick={() => setModal('')} disabled={saving}><X size={18} /></button></header><form onSubmit={saveSuite}>
            {formError && <div className="sm-form-error">{formError}</div>}
            <label>Suite name <input autoFocus maxLength={140} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} required /></label>
            <label>Description <textarea rows={3} maxLength={2000} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></label>
            <label>Project association <input maxLength={120} value={form.project} onChange={event => setForm({ ...form, project: event.target.value })} placeholder="Optional" /></label>
            <label>Tags <input maxLength={300} value={form.tags} onChange={event => setForm({ ...form, tags: event.target.value })} placeholder="Comma-separated, optional" /></label>
            <footer><button type="button" className="sm-secondary" disabled={saving} onClick={() => setModal('')}>Cancel</button><button className="sm-primary" disabled={saving}>{saving ? 'Saving…' : modal === 'create' ? 'Create suite' : 'Save changes'}</button></footer>
        </form></section></div>, document.body)}
    </main>;
}
