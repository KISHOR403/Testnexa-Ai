import React, { useState, useMemo } from 'react';
import { Check, Circle, Plus, Layers, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import RequirementDrawer from './RequirementDrawer';
import { caseReviewService } from '../../services/caseReviewService';

// Custom state icon
const ReqStateIcon = ({ state }) => {
    if (state === 'covered') {
        return <Check size={11} strokeWidth={2.5} className="tn-req-state-icon tn-req-state-icon--covered" />;
    }
    if (state === 'single_test') {
        return (
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" className="tn-req-state-icon tn-req-state-icon--single">
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="M8 1 A7 7 0 0 1 8 15 Z" fill="currentColor" />
            </svg>
        );
    }
    return <Circle size={10} strokeWidth={1.75} strokeDasharray="2 2" className="tn-req-state-icon tn-req-state-icon--uncovered" />;
};

export const LinkedRequirementsSection = ({
    suiteId,
    suiteCases = [],
    requirements = [],
    onRequirementMutated,
    onSelectTestCase
}) => {
    const [activeReqKey, setActiveReqKey] = useState(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [newReqForm, setNewReqForm] = useState({ title: '', description: '', priority: 'Medium' });
    const [isCreating, setIsCreating] = useState(false);
    const [createError, setCreateError] = useState('');

    // Compute requirements list with counts, sorted by key ascending
    const computedRequirements = useMemo(() => {
        // Collect all distinct requirement keys
        const reqMap = new Map();

        // 1. Seed from requirements prop if provided
        requirements.forEach(r => {
            const key = String(r.key || r.id || '').trim();
            if (key) {
                reqMap.set(key, {
                    key,
                    title: r.title || `Requirement ${key}`,
                    testsCount: Number(r.linkedTests ?? r.testsCount ?? 0),
                    approvedCount: Number(r.approvedTests ?? 0),
                    state: r.state || (r.linkedTests > 1 ? 'covered' : r.linkedTests === 1 ? 'single_test' : 'uncovered')
                });
            }
        });

        // 2. Count matches in suiteCases
        const caseCountsByKey = new Map();
        const approvedCountsByKey = new Map();

        suiteCases.forEach(tc => {
            const reqIds = Array.isArray(tc.requirement_ids) && tc.requirement_ids.length > 0
                ? tc.requirement_ids
                : (tc.requirementId ? [tc.requirementId] : (tc.reqId ? [tc.reqId] : []));

            const isAppr = String(tc.approval_status || tc.status || '').toLowerCase() === 'approved';

            reqIds.forEach(rawKey => {
                const cleanKey = String(rawKey || '').trim();
                if (!cleanKey) return;
                caseCountsByKey.set(cleanKey, (caseCountsByKey.get(cleanKey) || 0) + 1);
                if (isAppr) {
                    approvedCountsByKey.set(cleanKey, (approvedCountsByKey.get(cleanKey) || 0) + 1);
                }
                if (!reqMap.has(cleanKey)) {
                    reqMap.set(cleanKey, {
                        key: cleanKey,
                        title: `Requirement ${cleanKey}`,
                        testsCount: 0,
                        approvedCount: 0,
                        state: 'uncovered'
                    });
                }
            });
        });

        // Update counts
        reqMap.forEach((val, key) => {
            const count = caseCountsByKey.get(key) ?? val.testsCount;
            const appr = approvedCountsByKey.get(key) ?? val.approvedCount;
            val.testsCount = count;
            val.approvedCount = appr;
            val.state = count >= 2 ? 'covered' : count === 1 ? 'single_test' : 'uncovered';
        });

        // Sort by key ascending
        return Array.from(reqMap.values()).sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
    }, [requirements, suiteCases]);

    const handleOpenDrawer = (key) => {
        setActiveReqKey(key);
        setDrawerOpen(true);
    };

    const handleCreateRequirement = async (e) => {
        e?.preventDefault();
        if (newReqForm.title.trim().length < 5) {
            setCreateError('Title must be at least 5 characters.');
            return;
        }
        setIsCreating(true);
        setCreateError('');
        try {
            const res = await caseReviewService.createRequirement({
                suite_id: suiteId,
                title: newReqForm.title.trim(),
                description: newReqForm.description.trim(),
                priority: newReqForm.priority
            });
            setAddModalOpen(false);
            setNewReqForm({ title: '', description: '', priority: 'Medium' });
            if (onRequirementMutated) onRequirementMutated();
            const createdKey = res.data?.key || res.key;
            if (createdKey) {
                setActiveReqKey(createdKey);
                setDrawerOpen(true);
            }
        } catch (err) {
            setCreateError(err.message || 'Failed to create requirement.');
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="tn-linked-requirements-section">
            <div className="tn-linked-requirements-header">
                <div className="tn-linked-requirements-title-wrap">
                    <span className="tn-subheading">
                        Linked requirements ({computedRequirements.length})
                    </span>
                    <span className="tn-meta-muted">
                        Specification traceability & verification mapping
                    </span>
                </div>
                <div className="tn-linked-requirements-actions">
                    <button
                        type="button"
                        className="tn-app-btn tn-app-btn--secondary tn-app-btn--sm"
                        onClick={() => setAddModalOpen(true)}
                    >
                        <Plus size={12} />
                        <span>Add requirement</span>
                    </button>
                    <Link
                        to={`/app/coverage?suiteId=${encodeURIComponent(suiteId)}`}
                        className="tn-app-btn tn-app-btn--secondary tn-app-btn--sm"
                    >
                        <span>Coverage matrix</span>
                        <ArrowUpRight size={12} />
                    </Link>
                </div>
            </div>

            {/* Chips List */}
            <div className="tn-req-chips-container" role="group" aria-label="Linked requirements">
                {computedRequirements.length > 0 ? (
                    computedRequirements.map(req => (
                        <button
                            key={req.key}
                            type="button"
                            className={`tn-req-chip-btn tn-req-chip-btn--${req.state}`}
                            onClick={() => handleOpenDrawer(req.key)}
                            title={`${req.key}: ${req.title} (${req.testsCount} tests, ${req.state})`}
                        >
                            <ReqStateIcon state={req.state} />
                            <code>{req.key}</code>
                            <span className="tn-req-chip-dot">·</span>
                            <span className="tn-req-chip-count">{req.testsCount} {req.testsCount === 1 ? 'test' : 'tests'}</span>
                        </button>
                    ))
                ) : (
                    <div className="tn-empty-reqs-banner">
                        <p>No requirements linked to this test suite yet.</p>
                        <button
                            type="button"
                            className="tn-link-btn"
                            onClick={() => setAddModalOpen(true)}
                        >
                            + Create a requirement
                        </button>
                    </div>
                )}
            </div>

            {/* Requirement Details Drawer */}
            {drawerOpen && activeReqKey && (
                <RequirementDrawer
                    isOpen={drawerOpen}
                    onClose={() => setDrawerOpen(false)}
                    requirementKey={activeReqKey}
                    suiteId={suiteId}
                    suiteCases={suiteCases}
                    onRequirementUpdated={onRequirementMutated}
                    onRequirementDeleted={onRequirementMutated}
                    onSelectTestCase={onSelectTestCase}
                />
            )}

            {/* Add Requirement Modal */}
            {addModalOpen && (
                <div className="tn-dialog-backdrop" role="presentation">
                    <div className="tn-dialog" role="dialog" aria-modal="true" aria-labelledby="add-req-title">
                        <div className="tn-dialog__header">
                            <div>
                                <div className="tn-eyebrow">Suite Traceability</div>
                                <h3 id="add-req-title">Add Specification Requirement</h3>
                            </div>
                            <button
                                type="button"
                                className="tn-btn-icon"
                                onClick={() => setAddModalOpen(false)}
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateRequirement}>
                            <div className="tn-dialog__body">
                                <p className="tn-dialog-desc">
                                    Create a manual requirement for this suite. A canonical immutable key
                                    in format <code>REQ_&lt;SUITE&gt;_&lt;NNN&gt;</code> will be generated automatically.
                                </p>

                                <div className="tn-form-group">
                                    <label htmlFor="new-req-title">
                                        Title <span className="tn-required">*</span>
                                    </label>
                                    <input
                                        id="new-req-title"
                                        type="text"
                                        required
                                        value={newReqForm.title}
                                        onChange={(e) => setNewReqForm(prev => ({ ...prev, title: e.target.value }))}
                                        placeholder="e.g. User Session Token Invalidation on Logout"
                                        maxLength={200}
                                    />
                                </div>

                                <div className="tn-form-group">
                                    <label htmlFor="new-req-desc">Description</label>
                                    <textarea
                                        id="new-req-desc"
                                        rows={3}
                                        value={newReqForm.description}
                                        onChange={(e) => setNewReqForm(prev => ({ ...prev, description: e.target.value }))}
                                        placeholder="Detail the acceptance rules and boundary verification criteria..."
                                        maxLength={2000}
                                    />
                                </div>

                                <div className="tn-form-group">
                                    <label htmlFor="new-req-priority">Priority</label>
                                    <select
                                        id="new-req-priority"
                                        value={newReqForm.priority}
                                        onChange={(e) => setNewReqForm(prev => ({ ...prev, priority: e.target.value }))}
                                    >
                                        <option value="High">High</option>
                                        <option value="Medium">Medium</option>
                                        <option value="Low">Low</option>
                                    </select>
                                </div>

                                {createError && (
                                    <div className="tn-form-alert" role="alert">
                                        <span>{createError}</span>
                                    </div>
                                )}
                            </div>
                            <div className="tn-dialog__footer">
                                <button
                                    type="button"
                                    className="tn-app-btn tn-app-btn--secondary"
                                    onClick={() => setAddModalOpen(false)}
                                    disabled={isCreating}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="tn-app-btn tn-app-btn--primary"
                                    disabled={isCreating || newReqForm.title.trim().length < 5}
                                >
                                    {isCreating ? 'Creating…' : 'Create Requirement'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LinkedRequirementsSection;
