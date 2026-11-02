import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { NavLink } from 'react-router-dom';
import {
    History, X, GitCompare, ExternalLink, Clock, Play,
    CheckCircle2, XCircle, AlertTriangle, AlertCircle, RefreshCw
} from 'lucide-react';
import { executionService } from '../../services/executionService';
import '../../styles/app/RerunWorkspace.css';

const formatTimestamp = (iso) => {
    if (!iso) return '—';
    try {
        const d = new Date(iso);
        return d.toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return String(iso);
    }
};

const RerunHistoryDrawer = ({
    isOpen = true,
    onClose,
    runId,
    currentRun,
    onOpenComparison
}) => {
    const [history, setHistory] = useState([]);
    const [relationships, setRelationships] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen || !runId) return;

        let active = true;
        const fetchHistory = async () => {
            setLoading(true);
            setError('');
            try {
                const [histRes, relRes] = await Promise.all([
                    executionService.getRerunHistory(runId).catch(() => ({ success: false })),
                    executionService.getRerunRelationships(runId).catch(() => ({ success: false }))
                ]);

                if (!active) return;

                if (histRes?.success && Array.isArray(histRes.data)) {
                    setHistory(histRes.data);
                }
                if (relRes?.success && relRes.data) {
                    setRelationships(relRes.data);
                }
            } catch (err) {
                if (active) setError(err.message || 'Failed to load rerun lineage history.');
            } finally {
                if (active) setLoading(false);
            }
        };

        fetchHistory();
        return () => { active = false; };
    }, [isOpen, runId]);

    if (!isOpen) return null;

    return createPortal(
        <div
            className="rerun-backdrop"
            role="presentation"
            onMouseDown={e => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="rerun-modal"
                style={{ width: 'min(780px, 95vw)' }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="rerun-history-title"
            >
                <header className="rerun-header">
                    <div className="rerun-header-titles">
                        <span className="rerun-eyebrow">
                            <History size={13} />
                            Rerun Lineage & Traceability
                        </span>
                        <div className="rerun-title-row">
                            <h2 id="rerun-history-title">Rerun Execution History</h2>
                            <span className="rerun-run-pill">Run #{String(runId).slice(-8)}</span>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="rerun-close-btn"
                        onClick={onClose}
                        aria-label="Close rerun history drawer"
                    >
                        <X size={18} />
                    </button>
                </header>

                <div className="rerun-body" style={{ padding: '20px 22px' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: '#87928B' }}>
                            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px' }} />
                            <p style={{ fontSize: '0.8rem' }}>Querying execution lineage...</p>
                        </div>
                    ) : error ? (
                        <div className="rerun-notice error" role="alert">
                            <AlertTriangle size={15} />
                            <div>{error}</div>
                        </div>
                    ) : history.length <= 1 ? (
                        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#87928B' }}>
                            <History size={36} color="#777E7E" style={{ margin: '0 auto 12px' }} />
                            <h3 style={{ color: '#FFFFFF', margin: '0 0 6px', fontSize: '1rem' }}>No Associated Reruns</h3>
                            <p style={{ fontSize: '0.8rem', maxWidth: '420px', margin: '0 auto' }}>
                                This execution has no previous rerun attempts. When you initiate a rerun of failed or selected tests, it will be catalogued here.
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {history.map((runItem, idx) => {
                                const isCurrent = runItem.id === runId;
                                const isRoot = !runItem.originalRunId || runItem.originalRunId === runItem.id;
                                const isTerminal = ['completed', 'failed', 'partially_completed', 'cancelled'].includes(String(runItem.status).toLowerCase());

                                return (
                                    <div
                                        key={runItem.id}
                                        style={{
                                            background: isCurrent ? 'rgba(139, 175, 154, 0.05)' : '#080A09',
                                            border: `1px solid ${isCurrent ? '#8BAF9A' : '#1E2521'}`,
                                            borderRadius: '6px',
                                            padding: '14px 16px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '10px'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{
                                                    fontSize: '0.7rem',
                                                    fontWeight: 700,
                                                    color: isRoot ? '#8BAF9A' : '#38BDF8',
                                                    textTransform: 'uppercase'
                                                }}>
                                                    {isRoot ? 'Original Execution' : `Rerun (${runItem.rerunType || 'Failed'})`}
                                                </span>
                                                <span className="rerun-run-pill" style={{ fontSize: '0.68rem' }}>
                                                    {runItem.id}
                                                </span>
                                                {isCurrent && (
                                                    <span style={{ fontSize: '0.68rem', color: '#8BAF9A', fontWeight: 600 }}>
                                                        (Viewing Now)
                                                    </span>
                                                )}
                                            </div>

                                            <span className={`rerun-badge ${String(runItem.status).toLowerCase()}`}>
                                                {String(runItem.status).toUpperCase()}
                                            </span>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem', color: '#87928B' }}>
                                            <div style={{ display: 'flex', gap: '14px' }}>
                                                <span>Cases: <strong style={{ color: '#FFFFFF' }}>{runItem.summary?.total || 0}</strong></span>
                                                <span>Passed: <strong style={{ color: '#8BAF9A' }}>{runItem.summary?.passed || 0}</strong></span>
                                                <span>Failed: <strong style={{ color: '#E06C75' }}>{runItem.summary?.failed || 0}</strong></span>
                                                <span>Initiated: <strong style={{ color: '#C0CFC5' }}>{formatTimestamp(runItem.createdAt)}</strong></span>
                                            </div>

                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                {!isCurrent && (
                                                    <NavLink
                                                        to={`/app/runs/${runItem.id}`}
                                                        className="rerun-single-btn"
                                                        onClick={onClose}
                                                    >
                                                        <span>Open Workspace</span>
                                                        <ExternalLink size={11} />
                                                    </NavLink>
                                                )}

                                                {!isRoot && (
                                                    <NavLink
                                                        to={`/app/runs/${runItem.id}/compare`}
                                                        className="rerun-single-btn"
                                                        style={{ color: '#38BDF8', borderColor: 'rgba(56, 189, 248, 0.35)' }}
                                                        onClick={onClose}
                                                    >
                                                        <GitCompare size={11} />
                                                        <span>Compare</span>
                                                    </NavLink>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <footer className="rerun-footer">
                    <div className="rerun-footer-notice">
                        Showing execution ancestry and historical rerun attempts.
                    </div>
                    <button
                        type="button"
                        className="rerun-btn-secondary"
                        onClick={onClose}
                    >
                        Close
                    </button>
                </footer>
            </div>
        </div>,
        document.body
    );
};

export default RerunHistoryDrawer;

