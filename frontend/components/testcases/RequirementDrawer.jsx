import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    X, Check, Circle, ExternalLink, Plus, Trash2, Edit3, MoreHorizontal,
    AlertCircle, AlertTriangle, ArrowRight, Layers
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { caseReviewService } from '../../services/caseReviewService';
import ApprovalPill from './ApprovalPill';

export const RequirementDrawer = ({
    isOpen,
    onClose,
    requirementKey,
    suiteId,
    suiteCases = [],
    onRequirementUpdated,
    onRequirementDeleted,
    onSelectTestCase
}) => {
    const navigate = useNavigate();
    const [reqDetails, setReqDetails] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ title: '', description: '', priority: 'Medium' });
    const [editSaving, setEditSaving] = useState(false);
    const [linkModalOpen, setLinkModalOpen] = useState(false);
    const [selectedCaseToLink, setSelectedCaseToLink] = useState('');
    const [linkRationale, setLinkRationale] = useState('');
    const [linkSaving, setLinkSaving] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [forceDelete, setForceDelete] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const triggerRef = useRef(null);

    // Fetch full requirement details
    useEffect(() => {
        if (!isOpen || !requirementKey) return;
        let isCurrent = true;

        const loadRequirement = async () => {
            setIsLoading(true);
            setError('');
            try {
                const res = await caseReviewService.getRequirement(requirementKey);
                if (!isCurrent) return;
                const data = res.data || res;
                setReqDetails(data);
                setEditForm({
                    title: data.title || '',
                    description: data.description || '',
                    priority: data.priority || 'Medium'
                });
            } catch (err) {
                // If backend 404s, synthesize fallback view from suiteCases
                if (!isCurrent) return;
                const matchingCases = suiteCases.filter(c => {
                    const reqIds = c.requirement_ids || [c.requirementId, c.reqId];
                    return reqIds.includes(requirementKey);
                });
                setReqDetails({
                    id: requirementKey,
                    key: requirementKey,
                    title: `Requirement ${requirementKey}`,
                    description: 'Specification requirement extracted from test suite context.',
                    source: 'derived',
                    priority: 'Medium',
                    tests: matchingCases.map(tc => ({
                        id: tc.id,
                        title: tc.title,
                        type: tc.type,
                        approval_status: tc.approval_status || tc.status,
                        rationale: 'Direct scenario coverage.'
                    }))
                });
            } finally {
                if (isCurrent) setIsLoading(false);
            }
        };

        loadRequirement();
        return () => { isCurrent = false; };
    }, [isOpen, requirementKey, suiteCases]);

    // Keyboard Esc handling
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isOpen) return;
            if (e.key === 'Escape') {
                if (isEditing) {
                    setIsEditing(false);
                } else if (linkModalOpen) {
                    setLinkModalOpen(false);
                } else if (deleteModalOpen) {
                    setDeleteModalOpen(false);
                } else {
                    onClose();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, isEditing, linkModalOpen, deleteModalOpen, onClose]);

    if (!isOpen) return null;

    // Save requirement edits (flags linked tests as stale)
    const handleSaveEdit = async (e) => {
        e?.preventDefault();
        setEditSaving(true);
        setError('');
        try {
            const res = await caseReviewService.updateRequirement(requirementKey, editForm);
            setReqDetails(prev => ({ ...prev, ...editForm }));
            setIsEditing(false);
            if (onRequirementUpdated) {
                onRequirementUpdated(res.data || res);
            }
        } catch (err) {
            setError(err.message || 'Failed to update requirement.');
        } finally {
            setEditSaving(false);
        }
    };

    // Unlink test case
    const handleUnlinkTest = async (caseId) => {
        if (!window.confirm(`Unlink test case ${caseId} from requirement ${requirementKey}?`)) return;
        try {
            await caseReviewService.unlinkTest(requirementKey, caseId, { confirmUnlinked: true });
            setReqDetails(prev => ({
                ...prev,
                tests: (prev.tests || []).filter(t => t.id !== caseId)
            }));
            if (onRequirementUpdated) onRequirementUpdated();
        } catch (err) {
            alert(err.message || 'Failed to unlink test case.');
        }
    };

    // Link existing test case
    const handleConfirmLink = async () => {
        if (!selectedCaseToLink) return;
        setLinkSaving(true);
        try {
            await caseReviewService.linkTest(requirementKey, selectedCaseToLink, linkRationale);
            const addedCase = suiteCases.find(c => c.id === selectedCaseToLink);
            setReqDetails(prev => ({
                ...prev,
                tests: [
                    ...(prev.tests || []),
                    {
                        id: selectedCaseToLink,
                        title: addedCase?.title || selectedCaseToLink,
                        type: addedCase?.type || 'Functional',
                        approval_status: addedCase?.approval_status || addedCase?.status || 'pending',
                        rationale: linkRationale || 'Manual user link.'
                    }
                ]
            }));
            setLinkModalOpen(false);
            setSelectedCaseToLink('');
            setLinkRationale('');
            if (onRequirementUpdated) onRequirementUpdated();
        } catch (err) {
            alert(err.message || 'Failed to link test case.');
        } finally {
            setLinkSaving(false);
        }
    };

    // Delete requirement
    const handleDeleteRequirement = async () => {
        setIsDeleting(true);
        try {
            await caseReviewService.deleteRequirement(requirementKey, { force: forceDelete });
            setDeleteModalOpen(false);
            if (onRequirementDeleted) onRequirementDeleted(requirementKey);
            onClose();
        } catch (err) {
            alert(err.message || 'Failed to delete requirement.');
        } finally {
            setIsDeleting(false);
        }
    };

    const linkedTests = reqDetails?.tests || [];
    const sourceLabel = (reqDetails?.source || 'extracted').toUpperCase();

    return createPortal(
        <div className="tn-drawer-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <aside
                className="tn-drawer tn-req-drawer"
                role="dialog"
                aria-modal="true"
                aria-labelledby="req-drawer-title"
            >
                {/* Header */}
                <header className="tn-drawer__header">
                    <div className="tn-drawer__title-block">
                        <div className="tn-eyebrow">Requirement Specification</div>
                        <h3 id="req-drawer-title">{requirementKey}</h3>
                    </div>
                    <div className="tn-drawer__header-actions">
                        <div className="tn-more-menu-wrap">
                            <button
                                type="button"
                                className="tn-btn-icon"
                                onClick={() => setShowMoreMenu(prev => !prev)}
                                aria-label="More options"
                            >
                                <MoreHorizontal size={15} />
                            </button>
                            {showMoreMenu && (
                                <div className="tn-more-dropdown">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsEditing(true);
                                            setShowMoreMenu(false);
                                        }}
                                    >
                                        <Edit3 size={13} />
                                        <span>Edit requirement</span>
                                    </button>
                                    <button
                                        type="button"
                                        className="tn-more-item--danger"
                                        onClick={() => {
                                            setDeleteModalOpen(true);
                                            setShowMoreMenu(false);
                                        }}
                                    >
                                        <Trash2 size={13} />
                                        <span>Delete requirement</span>
                                    </button>
                                </div>
                            )}
                        </div>
                        <button
                            type="button"
                            className="tn-btn-icon"
                            onClick={onClose}
                            aria-label="Close drawer"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </header>

                <div className="tn-drawer__body">
                    {isLoading ? (
                        <div className="tn-drawer-loading">
                            <p className="tn-detail-muted">Loading requirement traceability…</p>
                        </div>
                    ) : isEditing ? (
                        /* Edit Form */
                        <form onSubmit={handleSaveEdit} className="tn-req-edit-form">
                            <div className="tn-notice-callout">
                                <AlertTriangle size={14} />
                                <span>Editing title or description will automatically flag all linked cases as <strong>Requirement changed, review</strong>.</span>
                            </div>

                            <div className="tn-form-group">
                                <label htmlFor="req-edit-title">Requirement Title</label>
                                <input
                                    id="req-edit-title"
                                    type="text"
                                    required
                                    value={editForm.title}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                                />
                            </div>

                            <div className="tn-form-group">
                                <label htmlFor="req-edit-desc">Description</label>
                                <textarea
                                    id="req-edit-desc"
                                    rows={4}
                                    value={editForm.description}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                                />
                            </div>

                            <div className="tn-form-group">
                                <label htmlFor="req-edit-priority">Priority</label>
                                <select
                                    id="req-edit-priority"
                                    value={editForm.priority}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, priority: e.target.value }))}
                                >
                                    <option value="High">High</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Low">Low</option>
                                </select>
                            </div>

                            {error && (
                                <div className="tn-form-alert" role="alert">
                                    <AlertCircle size={14} />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div className="tn-req-edit-actions">
                                <button
                                    type="button"
                                    className="tn-app-btn tn-app-btn--secondary"
                                    onClick={() => setIsEditing(false)}
                                    disabled={editSaving}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="tn-app-btn tn-app-btn--primary"
                                    disabled={editSaving}
                                >
                                    <Check size={14} />
                                    <span>{editSaving ? 'Saving…' : 'Save & Mark Tests for Review'}</span>
                                </button>
                            </div>
                        </form>
                    ) : (
                        /* Read-only View */
                        <div className="tn-req-details-content">
                            {/* Meta Badges */}
                            <div className="tn-req-badges-row">
                                <span className={`tn-req-source-tag tn-req-source-tag--${reqDetails.source || 'extracted'}`}>
                                    {sourceLabel}
                                </span>
                                <span className="tn-prio-tag tn-prio-tag--medium">
                                    {reqDetails.priority || 'Medium'}
                                </span>
                                <span className="tn-req-tests-count">
                                    {linkedTests.length} linked {linkedTests.length === 1 ? 'test' : 'tests'}
                                </span>
                            </div>

                            {/* Title & Description */}
                            <div className="tn-req-title-section">
                                <h4>{reqDetails.title}</h4>
                                <p className="tn-req-description">{reqDetails.description || 'No detailed description.'}</p>
                            </div>

                            {/* Source Quote (if extracted) */}
                            {reqDetails.source_quote && (
                                <div className="tn-req-quote-card">
                                    <span className="tn-sublabel">Source Specification Quote</span>
                                    <blockquote>"{reqDetails.source_quote}"</blockquote>
                                </div>
                            )}

                            {/* Linked Tests Header & Actions */}
                            <div className="tn-req-linked-head">
                                <span className="tn-sublabel">Linked Test Scenarios ({linkedTests.length})</span>
                                <div className="tn-req-actions-bar">
                                    <button
                                        type="button"
                                        className="tn-link-btn"
                                        onClick={() => setLinkModalOpen(true)}
                                    >
                                        <Plus size={12} /> Link Existing Test
                                    </button>
                                    <button
                                        type="button"
                                        className="tn-link-btn"
                                        onClick={() => {
                                            navigate(`/app/recommendations?suiteId=${encodeURIComponent(suiteId)}&requirementId=${encodeURIComponent(requirementKey)}`);
                                        }}
                                    >
                                        <ExternalLink size={12} /> Add Tests via Recommendations
                                    </button>
                                </div>
                            </div>

                            {/* Linked Tests List */}
                            {linkedTests.length > 0 ? (
                                <div className="tn-req-tests-list">
                                    {linkedTests.map(tc => (
                                        <div key={tc.id} className="tn-req-test-card">
                                            <div className="tn-req-test-card__top">
                                                <button
                                                    type="button"
                                                    className="tn-req-test-id-btn"
                                                    onClick={() => {
                                                        if (onSelectTestCase) onSelectTestCase(tc.id);
                                                        onClose();
                                                    }}
                                                >
                                                    <code>{tc.id}</code>
                                                    <strong>{tc.title}</strong>
                                                </button>
                                                <ApprovalPill status={tc.approval_status} size="sm" />
                                            </div>
                                            {tc.rationale && (
                                                <p className="tn-req-test-rationale">
                                                    <strong>Rationale:</strong> {tc.rationale}
                                                </p>
                                            )}
                                            <div className="tn-req-test-card__bottom">
                                                <span className="tn-meta-muted">{tc.type || 'Functional'}</span>
                                                <button
                                                    type="button"
                                                    className="tn-unlink-btn"
                                                    onClick={() => handleUnlinkTest(tc.id)}
                                                    title={`Unlink test ${tc.id}`}
                                                >
                                                    Unlink
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="tn-empty-linked-tests">
                                    <p className="tn-detail-muted">No test cases are currently linked to this requirement.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </aside>

            {/* Link Existing Test Modal */}
            {linkModalOpen && (
                <div className="tn-dialog-backdrop" role="presentation">
                    <div className="tn-dialog tn-dialog--sm" role="dialog" aria-modal="true">
                        <div className="tn-dialog__header">
                            <div>
                                <div className="tn-eyebrow">Coverage Mapping</div>
                                <h3>Link Test to {requirementKey}</h3>
                            </div>
                            <button
                                type="button"
                                className="tn-btn-icon"
                                onClick={() => setLinkModalOpen(false)}
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className="tn-dialog__body">
                            <div className="tn-form-group">
                                <label htmlFor="select-case-to-link">Select Test Case in Suite</label>
                                <select
                                    id="select-case-to-link"
                                    value={selectedCaseToLink}
                                    onChange={(e) => setSelectedCaseToLink(e.target.value)}
                                >
                                    <option value="">-- Choose a test case --</option>
                                    {suiteCases
                                        .filter(c => !(linkedTests || []).some(lt => lt.id === c.id))
                                        .map(c => (
                                            <option key={c.id} value={c.id}>
                                                {c.id}: {c.title}
                                            </option>
                                        ))}
                                </select>
                            </div>

                            <div className="tn-form-group">
                                <label htmlFor="link-rationale-input">Coverage Rationale (Optional)</label>
                                <input
                                    id="link-rationale-input"
                                    type="text"
                                    value={linkRationale}
                                    placeholder="e.g. Verifies boundary password hashing criteria"
                                    maxLength={250}
                                    onChange={(e) => setLinkRationale(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="tn-dialog__footer">
                            <button
                                type="button"
                                className="tn-app-btn tn-app-btn--secondary"
                                onClick={() => setLinkModalOpen(false)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="tn-app-btn tn-app-btn--primary"
                                onClick={handleConfirmLink}
                                disabled={!selectedCaseToLink || linkSaving}
                            >
                                <Check size={14} />
                                <span>{linkSaving ? 'Linking…' : 'Link Test'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Requirement Confirmation Modal */}
            {deleteModalOpen && (
                <div className="tn-dialog-backdrop" role="presentation">
                    <div className="tn-dialog tn-dialog--sm" role="dialog" aria-modal="true">
                        <div className="tn-dialog__header">
                            <div>
                                <div className="tn-eyebrow">Destructive Action</div>
                                <h3>Delete Requirement {requirementKey}?</h3>
                            </div>
                            <button
                                type="button"
                                className="tn-btn-icon"
                                onClick={() => setDeleteModalOpen(false)}
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className="tn-dialog__body">
                            {linkedTests.length > 0 ? (
                                <div>
                                    <div className="tn-notice-callout tn-notice-callout--danger">
                                        <AlertTriangle size={15} />
                                        <span>
                                            This requirement is currently linked to <strong>{linkedTests.length} active test {linkedTests.length === 1 ? 'case' : 'cases'}</strong>.
                                        </span>
                                    </div>
                                    <p style={{ marginTop: 12 }}>
                                        Deleting it will unlink these test cases and remove traceability links.
                                    </p>
                                    <label className="tn-checkbox-row" style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <input
                                            type="checkbox"
                                            checked={forceDelete}
                                            onChange={(e) => setForceDelete(e.target.checked)}
                                        />
                                        <span>Force delete and unlink all {linkedTests.length} test cases</span>
                                    </label>
                                </div>
                            ) : (
                                <p>Are you sure you want to permanently delete this requirement? This action cannot be undone.</p>
                            )}
                        </div>
                        <div className="tn-dialog__footer">
                            <button
                                type="button"
                                className="tn-app-btn tn-app-btn--secondary"
                                onClick={() => setDeleteModalOpen(false)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="tn-app-btn tn-app-btn--primary"
                                onClick={handleDeleteRequirement}
                                disabled={linkedTests.length > 0 && !forceDelete || isDeleting}
                            >
                                {isDeleting ? 'Deleting…' : 'Confirm Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>,
        document.body
    );
};

export default RequirementDrawer;
