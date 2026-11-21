import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, History, RotateCcw, ChevronDown, ChevronRight, Check, AlertCircle } from 'lucide-react';
import { caseReviewService } from '../../services/caseReviewService';

export const CaseHistoryDrawer = ({
    isOpen,
    onClose,
    testCase,
    onRestoreSuccess
}) => {
    const [versions, setVersions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedVersion, setSelectedVersion] = useState(null);
    const [isRestoring, setIsRestoring] = useState(false);
    const [expandedDiffs, setExpandedDiffs] = useState({});

    useEffect(() => {
        if (!isOpen || !testCase?.id) return;
        let isCurrent = true;

        const fetchVersions = async () => {
            setIsLoading(true);
            setError('');
            try {
                const res = await caseReviewService.getCaseVersions(testCase.id);
                if (!isCurrent) return;
                const list = Array.isArray(res.data) ? res.data : (res.versions || []);
                setVersions(list);
                if (list.length > 0) {
                    setSelectedVersion(list[0]);
                }
            } catch (err) {
                if (isCurrent) setError(err.message || 'Failed to load version history.');
            } finally {
                if (isCurrent) setIsLoading(false);
            }
        };

        fetchVersions();
        return () => { isCurrent = false; };
    }, [isOpen, testCase?.id]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isOpen) return;
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen || !testCase) return null;

    const handleRestore = async (verNum) => {
        if (!window.confirm(`Restore version ${verNum}? This will create a new version ${Number(testCase.version || 1) + 1} with pending review status.`)) {
            return;
        }

        setIsRestoring(true);
        setError('');
        try {
            const res = await caseReviewService.restoreVersion(testCase.id, verNum);
            if (onRestoreSuccess) {
                onRestoreSuccess(res.data || res);
            }
            onClose();
        } catch (err) {
            setError(err.message || 'Failed to restore version snapshot.');
            setIsRestoring(false);
        }
    };

    const toggleDiffExpand = (field) => {
        setExpandedDiffs(prev => ({ ...prev, [field]: !prev[field] }));
    };

    // Compute diff between current testCase and selectedVersion snapshot
    const diffItems = selectedVersion ? [
        {
            field: 'Title',
            current: testCase.title,
            snapshot: selectedVersion.snapshot?.title
        },
        {
            field: 'Type',
            current: testCase.type,
            snapshot: selectedVersion.snapshot?.type
        },
        {
            field: 'Priority',
            current: testCase.priority,
            snapshot: selectedVersion.snapshot?.priority
        },
        {
            field: 'Severity',
            current: testCase.severity,
            snapshot: selectedVersion.snapshot?.severity
        },
        {
            field: 'Expected Result',
            current: testCase.expectedResult,
            snapshot: selectedVersion.snapshot?.expected
        },
        {
            field: 'Steps Count',
            current: `${Array.isArray(testCase.steps) ? testCase.steps.length : 0} steps`,
            snapshot: `${Array.isArray(selectedVersion.snapshot?.steps) ? selectedVersion.snapshot.steps.length : 0} steps`
        }
    ].filter(item => String(item.current || '') !== String(item.snapshot || '')) : [];

    return createPortal(
        <div className="tn-drawer-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <aside
                className="tn-drawer tn-history-drawer"
                role="dialog"
                aria-modal="true"
                aria-labelledby="history-drawer-title"
            >
                <header className="tn-drawer__header">
                    <div className="tn-drawer__title-block">
                        <div className="tn-eyebrow">Audit Trail & Versions</div>
                        <h3 id="history-drawer-title">Version History — {testCase.id}</h3>
                    </div>
                    <button
                        type="button"
                        className="tn-btn-icon"
                        onClick={onClose}
                        aria-label="Close drawer"
                    >
                        <X size={16} />
                    </button>
                </header>

                <div className="tn-drawer__body">
                    {isLoading ? (
                        <div className="tn-drawer-loading">
                            <p className="tn-detail-muted">Retrieving immutable version snapshots…</p>
                        </div>
                    ) : error ? (
                        <div className="tn-form-alert" role="alert">
                            <AlertCircle size={15} />
                            <span>{error}</span>
                        </div>
                    ) : versions.length === 0 ? (
                        <div className="tn-empty-history">
                            <History size={28} />
                            <h4>No previous versions recorded</h4>
                            <p>This case is currently at version 1 (initial generation baseline).</p>
                        </div>
                    ) : (
                        <div className="tn-history-content-layout">
                            {/* Version Selector Column */}
                            <div className="tn-history-versions-list">
                                <span className="tn-sublabel">Snapshots</span>
                                {versions.map((ver) => {
                                    const isSelected = selectedVersion?.version === ver.version;
                                    const dateStr = ver.created_at ? new Date(ver.created_at).toLocaleString() : 'Initial';
                                    return (
                                        <button
                                            key={ver.version}
                                            type="button"
                                            className={`tn-version-item ${isSelected ? 'is-selected' : ''}`}
                                            onClick={() => setSelectedVersion(ver)}
                                        >
                                            <div className="tn-version-item__top">
                                                <strong>Version {ver.version}</strong>
                                                <span className="tn-change-type-pill">{ver.change_type || 'edited'}</span>
                                            </div>
                                            <div className="tn-version-item__bottom">
                                                <span>{ver.created_by ? `by ${ver.created_by}` : 'system'}</span>
                                                <span>{dateStr}</span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Diff Inspector Column */}
                            {selectedVersion && (
                                <div className="tn-history-diff-view">
                                    <div className="tn-diff-header">
                                        <div>
                                            <h4>Version {selectedVersion.version} Snapshot</h4>
                                            <p className="tn-diff-meta-line">
                                                Captured {new Date(selectedVersion.created_at).toLocaleString()}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            className="tn-app-btn tn-app-btn--primary tn-app-btn--sm"
                                            onClick={() => handleRestore(selectedVersion.version)}
                                            disabled={isRestoring || selectedVersion.version === testCase.version}
                                            title={selectedVersion.version === testCase.version ? 'Currently at this version' : 'Restore this snapshot as latest'}
                                        >
                                            <RotateCcw size={13} />
                                            <span>{isRestoring ? 'Restoring…' : 'Restore this version'}</span>
                                        </button>
                                    </div>

                                    <div className="tn-diff-section">
                                        <span className="tn-sublabel">Field Comparison Against Current (v{testCase.version})</span>
                                        {diffItems.length === 0 ? (
                                            <p className="tn-detail-muted" style={{ padding: '8px 0' }}>
                                                No textual differences found between this snapshot and the active case content.
                                            </p>
                                        ) : (
                                            <div className="tn-field-diffs-list">
                                                {diffItems.map(item => (
                                                    <div key={item.field} className="tn-field-diff-card">
                                                        <div className="tn-field-diff-card__head">
                                                            <strong>{item.field}</strong>
                                                        </div>
                                                        <div className="tn-field-diff-card__grid">
                                                            <div className="tn-diff-box tn-diff-box--snapshot">
                                                                <span className="tn-diff-tag">[Version {selectedVersion.version}]</span>
                                                                <p>{item.snapshot || '<empty>'}</p>
                                                            </div>
                                                            <div className="tn-diff-box tn-diff-box--current">
                                                                <span className="tn-diff-tag">[Current v{testCase.version}]</span>
                                                                <p>{item.current || '<empty>'}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </aside>
        </div>,
        document.body
    );
};

export default CaseHistoryDrawer;
