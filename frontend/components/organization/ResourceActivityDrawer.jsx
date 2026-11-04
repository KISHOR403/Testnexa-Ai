import React, { useState, useEffect } from 'react';
import { Clock, X, AlertCircle, RefreshCw, CheckCircle2, XCircle, AlertTriangle, User } from 'lucide-react';
import { organizationService } from '../../services/organizationService';

export const ResourceActivityDrawer = ({
    isOpen,
    onClose,
    resourceType,
    resourceId,
    resourceTitle,
    orgId
}) => {
    const [history, setHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        if (isOpen && resourceType && resourceId) {
            fetchActivity();
        }
    }, [isOpen, resourceType, resourceId, orgId]);

    const fetchActivity = async () => {
        setIsLoading(true);
        setErrorMessage('');
        try {
            const res = await organizationService.getResourceActivity(resourceType, resourceId, {
                limit: 30,
                orgId
            });
            setHistory(res.data || []);
        } catch (err) {
            setErrorMessage(err.message || 'Failed to load activity history');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="audit-drawer-backdrop" onClick={onClose}>
            <div className="audit-drawer" onClick={(e) => e.stopPropagation()}>
                <div className="audit-drawer__header">
                    <div>
                        <span className="audit-drawer__pre" style={{ textTransform: 'capitalize' }}>
                            {resourceType} Activity History
                        </span>
                        <h3 className="audit-drawer__title">
                            {resourceTitle || resourceId}
                        </h3>
                    </div>
                    <button className="audit-drawer__close" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                <div className="audit-drawer__body">
                    {errorMessage && (
                        <div className="org-banner org-banner--error" style={{ marginBottom: '1rem' }}>
                            <AlertCircle size={14} /> {errorMessage}
                        </div>
                    )}

                    {isLoading ? (
                        <div className="audit-loading">
                            <RefreshCw size={20} className="audit-spin" />
                            <span>Loading activity history...</span>
                        </div>
                    ) : history.length === 0 ? (
                        <div className="cicd-empty" style={{ padding: '3rem 1rem' }}>
                            <Clock size={36} className="cicd-empty__icon" style={{ opacity: 0.6 }} />
                            <h4 className="cicd-empty__title">No activity recorded for this {resourceType}</h4>
                            <p className="cicd-empty__desc">Actions performed on this resource will appear here.</p>
                        </div>
                    ) : (
                        <div className="audit-timeline">
                            {history.map((item, idx) => (
                                <div key={item.id || idx} className="audit-timeline__item">
                                    <div className="audit-timeline__dot" />
                                    <div className="audit-timeline__content">
                                        <div className="audit-timeline__header">
                                            <span className="audit-action-code">{item.action}</span>
                                            <span className="audit-timeline__time">
                                                {new Date(item.timestamp).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="audit-timeline__actor">
                                            <User size={12} /> {item.actorDisplayName || 'System'}
                                            {item.actorEmail && <span style={{ opacity: 0.7 }}> ({item.actorEmail})</span>}
                                        </div>
                                        {item.changes && Object.keys(item.changes).length > 0 && (
                                            <div className="audit-timeline__changes">
                                                {Object.entries(item.changes).map(([k, diff]) => (
                                                    <div key={k} className="audit-timeline__change-line">
                                                        <code>{k}</code>: <span className="diff-old">{String(diff?.before)}</span> → <span className="diff-new">{String(diff?.after)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="audit-drawer__footer">
                    <button className="org-btn org-btn--secondary" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ResourceActivityDrawer;

