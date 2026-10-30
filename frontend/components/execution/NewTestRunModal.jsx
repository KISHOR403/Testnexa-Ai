import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Play, X, Layers, CheckSquare, Square, Shield,
    Server, User, AlertCircle, FileText, Bot, Terminal
} from 'lucide-react';
import { executionService } from '../../services/executionService';
import { sessionService } from '../../services/sessionService';
import { workspaceService } from '../../services/workspaceService';
import Modal from '../ui/Modal';
import '../../styles/app/WorkspaceDesignSystem.css';

const NewTestRunModal = ({ isOpen, onClose, initialSuite = null }) => {
    const navigate = useNavigate();

    const [suites, setSuites] = useState([]);
    const [selectedSuiteId, setSelectedSuiteId] = useState(initialSuite?.id || '');
    const [selectedSuite, setSelectedSuite] = useState(initialSuite || null);
    const [availableCases, setAvailableCases] = useState([]);
    const [selectedCaseIds, setSelectedCaseIds] = useState(new Set());

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [executionType, setExecutionType] = useState('manual'); // 'manual' | 'automated' | 'mixed'
    const [environments, setEnvironments] = useState([]);
    const [selectedEnvId, setSelectedEnvId] = useState('');
    const [members, setMembers] = useState([]);
    const [selectedAssignee, setSelectedAssignee] = useState('');

    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    // Load available suites, environments, and members on modal open
    useEffect(() => {
        if (!isOpen) return;

        let isCurrent = true;
        const loadPrerequisites = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const [suiteRes, envRes, memberRes] = await Promise.allSettled([
                    sessionService.list({ limit: 50 }),
                    workspaceService.getEnvironments(),
                    executionService.listMembers()
                ]);

                if (!isCurrent) return;

                if (suiteRes.status === 'fulfilled' && suiteRes.value?.success) {
                    const list = suiteRes.value.data || [];
                    setSuites(list);
                    if (!selectedSuiteId && list.length > 0) {
                        setSelectedSuiteId(list[0].id || list[0]._id);
                    }
                }

                if (envRes.status === 'fulfilled' && envRes.value?.success) {
                    const envList = envRes.value.data || [];
                    setEnvironments(envList);
                    if (envList.length > 0) {
                        setSelectedEnvId(envList[0].id);
                    }
                }

                if (memberRes.status === 'fulfilled' && memberRes.value?.success) {
                    setMembers(memberRes.value.data || []);
                }
            } catch (err) {
                console.error('Failed to load run prerequisites:', err);
            } finally {
                if (isCurrent) setIsLoading(false);
            }
        };

        loadPrerequisites();
        return () => { isCurrent = false; };
    }, [isOpen]);

    // Extract test cases when suite selection changes
    useEffect(() => {
        if (!selectedSuiteId) return;

        let isCurrent = true;
        const fetchSuiteCases = async () => {
            try {
                // If initialSuite matches, use directly
                if (initialSuite && (initialSuite.id === selectedSuiteId || initialSuite._id === selectedSuiteId)) {
                    processSuiteCases(initialSuite);
                    return;
                }

                const res = await sessionService.get(selectedSuiteId);
                if (isCurrent && res?.success && res?.data) {
                    setSelectedSuite(res.data);
                    processSuiteCases(res.data);
                }
            } catch (err) {
                console.error('Failed to load suite cases:', err);
            }
        };

        fetchSuiteCases();
        return () => { isCurrent = false; };
    }, [selectedSuiteId, initialSuite]);

    const processSuiteCases = (suiteObj) => {
        const sData = suiteObj.suiteData || suiteObj.suite_data || suiteObj.data || suiteObj;
        let cases = [];
        if (Array.isArray(sData.testCases) && sData.testCases.length > 0) {
            cases = sData.testCases;
        } else {
            const categories = ['functional', 'negative', 'edge', 'security', 'apiChecklist', 'api', 'nonFunctional'];
            for (const cat of categories) {
                if (Array.isArray(sData[cat])) {
                    cases.push(...sData[cat]);
                }
            }
        }

        const normalized = cases.map((c, i) => ({
            id: String(c.id || `TC_${i + 1}`),
            title: c.title || 'Untitled Test Case',
            type: c.type || 'Functional',
            priority: c.priority || 'Medium',
            hasAutomation: Boolean(c.automationMapping || c.playwrightBinding)
        }));

        setAvailableCases(normalized);
        setSelectedCaseIds(new Set(normalized.map(c => c.id)));

        // Default run name
        const title = suiteObj.title || suiteObj.feature || 'Test Suite';
        setName(`${title} — Run #${Date.now().toString().slice(-4)}`);
    };

    const toggleCase = (id) => {
        setSelectedCaseIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (selectedCaseIds.size === availableCases.length) {
            setSelectedCaseIds(new Set());
        } else {
            setSelectedCaseIds(new Set(availableCases.map(c => c.id)));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) {
            setError('Please provide a name for this test run');
            return;
        }
        if (selectedCaseIds.size === 0) {
            setError('Please select at least one test case to execute');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const envObj = environments.find(e => e.id === selectedEnvId);
            const res = await executionService.createRun({
                suiteId: selectedSuiteId,
                name: name.trim(),
                description: description.trim(),
                executionType,
                environmentId: selectedEnvId || null,
                targetEnvironment: envObj ? { name: envObj.name, baseUrl: envObj.baseUrl } : {},
                assignedTo: selectedAssignee || null,
                selectedCaseIds: Array.from(selectedCaseIds)
            });

            if (res.success && res.data?.id) {
                onClose();
                navigate(`/app/runs/${res.data.id}`);
            } else {
                setError(res.message || 'Failed to create test run');
            }
        } catch (err) {
            setError(err.message || 'Error initiating test run');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const allSelected = availableCases.length > 0 && selectedCaseIds.size === availableCases.length;
    const automatedCount = availableCases.filter(c => selectedCaseIds.has(c.id) && c.hasAutomation).length;
    const manualCount = selectedCaseIds.size - automatedCount;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create Unified Test Run" size="lg">
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {error && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.75rem 1rem',
                        background: 'rgba(224, 108, 117, 0.12)',
                        border: '1px solid rgba(224, 108, 117, 0.3)',
                        borderRadius: '6px',
                        color: '#E06C75',
                        fontSize: '0.85rem'
                    }}>
                        <AlertCircle size={16} />
                        <span>{error}</span>
                    </div>
                )}

                {/* 1. Run Name & Description */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#A0A5A5', marginBottom: '0.4rem' }}>
                            Run Name *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Sprint 24 Regression Pass"
                            style={{
                                width: '100%',
                                padding: '0.65rem 0.85rem',
                                background: '#161819',
                                border: '1px solid #292D2D',
                                borderRadius: '6px',
                                color: '#F2F3F3',
                                fontSize: '0.9rem',
                                outline: 'none',
                                boxSizing: 'border-box'
                            }}
                            required
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#A0A5A5', marginBottom: '0.4rem' }}>
                            Description (Optional)
                        </label>
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="e.g., Pre-deployment sanity verification on staging environment"
                            style={{
                                width: '100%',
                                padding: '0.65rem 0.85rem',
                                background: '#161819',
                                border: '1px solid #292D2D',
                                borderRadius: '6px',
                                color: '#F2F3F3',
                                fontSize: '0.9rem',
                                outline: 'none',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>
                </div>

                {/* 2. Source Test Suite */}
                <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#A0A5A5', marginBottom: '0.4rem' }}>
                        Source Test Suite
                    </label>
                    <select
                        value={selectedSuiteId}
                        onChange={(e) => setSelectedSuiteId(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '0.65rem 0.85rem',
                            background: '#161819',
                            border: '1px solid #292D2D',
                            borderRadius: '6px',
                            color: '#F2F3F3',
                            fontSize: '0.9rem',
                            outline: 'none',
                            boxSizing: 'border-box'
                        }}
                    >
                        {suites.map(s => (
                            <option key={s.id || s._id} value={s.id || s._id}>
                                {s.title || s.feature || 'Untitled Suite'} ({s.status || 'Ready'})
                            </option>
                        ))}
                    </select>
                </div>

                {/* 3. Execution Type Selector */}
                <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#A0A5A5', marginBottom: '0.4rem' }}>
                        Execution Mode
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                        {[
                            { id: 'manual', label: 'Manual Only', desc: 'Interactive step verification by testers', icon: User },
                            { id: 'automated', label: 'Automated (Playwright)', desc: 'Headless browser execution via queue', icon: Bot },
                            { id: 'mixed', label: 'Mixed Mode', desc: 'Execute mapped tests; verify remainder manually', icon: Terminal }
                        ].map(mode => {
                            const isSelected = executionType === mode.id;
                            const IconComponent = mode.icon;
                            return (
                                <button
                                    key={mode.id}
                                    type="button"
                                    onClick={() => setExecutionType(mode.id)}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'flex-start',
                                        gap: '0.35rem',
                                        padding: '0.75rem',
                                        background: isSelected ? 'rgba(139, 175, 154, 0.12)' : '#161819',
                                        border: `1px solid ${isSelected ? '#8BAF9A' : '#292D2D'}`,
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: isSelected ? '#8BAF9A' : '#F2F3F3' }}>
                                        <IconComponent size={16} />
                                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{mode.label}</span>
                                    </div>
                                    <span style={{ fontSize: '0.72rem', color: '#A0A5A5', lineHeight: '1.3' }}>
                                        {mode.desc}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 4. Target Environment & Assignee Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#A0A5A5', marginBottom: '0.4rem' }}>
                            Target Environment
                        </label>
                        <select
                            value={selectedEnvId}
                            onChange={(e) => setSelectedEnvId(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.65rem 0.85rem',
                                background: '#161819',
                                border: '1px solid #292D2D',
                                borderRadius: '6px',
                                color: '#F2F3F3',
                                fontSize: '0.88rem',
                                outline: 'none',
                                boxSizing: 'border-box'
                            }}
                        >
                            <option value="">Default (Workspace Staging)</option>
                            {environments.map(env => (
                                <option key={env.id} value={env.id}>
                                    {env.name} ({env.baseUrl || env.slug})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#A0A5A5', marginBottom: '0.4rem' }}>
                            Assignee
                        </label>
                        <select
                            value={selectedAssignee}
                            onChange={(e) => setSelectedAssignee(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.65rem 0.85rem',
                                background: '#161819',
                                border: '1px solid #292D2D',
                                borderRadius: '6px',
                                color: '#F2F3F3',
                                fontSize: '0.88rem',
                                outline: 'none',
                                boxSizing: 'border-box'
                            }}
                        >
                            <option value="">Unassigned (Any workspace tester)</option>
                            {members.map(m => (
                                <option key={m.userId || m.id} value={m.userId || m.id}>
                                    {m.name} ({m.role})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* 5. Test Case Selection List */}
                <div>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '0.5rem'
                    }}>
                        <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#A0A5A5' }}>
                            Select Test Cases ({selectedCaseIds.size} of {availableCases.length} selected)
                        </label>
                        <button
                            type="button"
                            onClick={toggleAll}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#8BAF9A',
                                fontSize: '0.78rem',
                                cursor: 'pointer',
                                textDecoration: 'underline'
                            }}
                        >
                            {allSelected ? 'Deselect All' : 'Select All'}
                        </button>
                    </div>

                    <div style={{
                        maxHeight: '190px',
                        overflowY: 'auto',
                        background: '#101112',
                        border: '1px solid #292D2D',
                        borderRadius: '6px',
                        padding: '0.5rem'
                    }}>
                        {availableCases.length === 0 ? (
                            <div style={{ padding: '1rem', textAlign: 'center', color: '#777E7E', fontSize: '0.85rem' }}>
                                No test cases found in selected suite.
                            </div>
                        ) : (
                            availableCases.map(c => {
                                const isChecked = selectedCaseIds.has(c.id);
                                return (
                                    <div
                                        key={c.id}
                                        onClick={() => toggleCase(c.id)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '0.45rem 0.65rem',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            background: isChecked ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
                                            transition: 'background 0.1s ease'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                                            {isChecked ? (
                                                <CheckSquare size={16} style={{ color: '#8BAF9A', flexShrink: 0 }} />
                                            ) : (
                                                <Square size={16} style={{ color: '#777E7E', flexShrink: 0 }} />
                                            )}
                                            <span style={{
                                                fontSize: '0.84rem',
                                                color: '#F2F3F3',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis'
                                            }}>
                                                <strong style={{ color: '#A0A5A5', marginRight: '6px' }}>{c.id}</strong>
                                                {c.title}
                                            </span>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                                            {c.hasAutomation && (
                                                <span style={{
                                                    fontSize: '0.68rem',
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    background: 'rgba(56, 189, 248, 0.15)',
                                                    color: '#38BDF8',
                                                    fontWeight: 600
                                                }}>
                                                    Playwright
                                                </span>
                                            )}
                                            <span style={{
                                                fontSize: '0.7rem',
                                                color: '#A0A5A5',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.04em'
                                            }}>
                                                {c.priority}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {executionType === 'mixed' && (
                        <div style={{ marginTop: '0.4rem', fontSize: '0.74rem', color: '#A0A5A5' }}>
                            Mixed execution breakdown: <strong>{automatedCount} automated (Playwright)</strong>, <strong>{manualCount} manual</strong>.
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '0.75rem',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid #292D2D'
                }}>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="ws-btn-secondary"
                        style={{ height: '36px', padding: '0 1rem' }}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting || selectedCaseIds.size === 0}
                        className="ws-btn-primary"
                        style={{ height: '36px', padding: '0 1.25rem', gap: '6px' }}
                    >
                        <Play size={14} fill="#080909" />
                        <span>{isSubmitting ? 'Creating Run...' : 'Launch Test Run'}</span>
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default NewTestRunModal;

