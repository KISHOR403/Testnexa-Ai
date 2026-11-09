import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bot, Server, Check, Bell, BellRing, X, Clock, PlaySquare } from 'lucide-react';
import { getExecutionMethod } from '../../config/executionFeatures';
import '../../styles/app/ComingSoonModal.css';

/**
 * Render the proper feature icon based on feature identifier or name
 */
const getMethodIcon = (id) => {
    switch (id) {
        case 'playwright':
        case 'automated':
            return <Bot size={22} />;
        case 'api':
            return <Server size={22} />;
        default:
            return <PlaySquare size={22} />;
    }
};

/**
 * TestNexa AI — Coming Soon Modal
 *
 * Professional, calm dialog displaying upcoming automation capabilities
 * without deceptive working states or fake progress metrics.
 */
export const ComingSoonModal = ({
    isOpen,
    onClose,
    method: directMethod,
    methodId = 'playwright'
}) => {
    const resolvedMethod = directMethod || getExecutionMethod(methodId);
    const modalConfig = resolvedMethod?.modal || {};

    const storageKey = `testnexa_notify_${resolvedMethod?.id || methodId}`;
    const [isNotified, setIsNotified] = useState(() => {
        try {
            return localStorage.getItem(storageKey) === 'true';
        } catch {
            return false;
        }
    });

    // Close on Escape key & lock background scroll
    useEffect(() => {
        if (!isOpen) return;

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onClose?.();
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = originalOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    if (!isOpen || !resolvedMethod) return null;

    const handleToggleNotify = () => {
        const nextState = !isNotified;
        setIsNotified(nextState);
        try {
            localStorage.setItem(storageKey, String(nextState));
        } catch {}
    };

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose?.();
        }
    };

    const title = modalConfig.title || `${resolvedMethod.displayName} is Coming Soon`;
    const description = modalConfig.description || resolvedMethod.description;
    const capabilities = modalConfig.capabilities || [];
    const primaryAction = modalConfig.primaryAction || 'Got it';

    return createPortal(
        <div
            className="tn-coming-soon-backdrop"
            onClick={handleBackdropClick}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tn-cs-modal-title"
        >
            <div className="tn-coming-soon-card">
                {/* Header with icon, status badge, and close button */}
                <div className="tn-cs-header">
                    <div className="tn-cs-icon-wrap">
                        {getMethodIcon(resolvedMethod.id)}
                    </div>
                    <div className="tn-cs-badge-row">
                        <span className="tn-cs-status-badge">
                            <Clock size={12} />
                            Coming Soon
                        </span>
                        <button
                            type="button"
                            className="tn-cs-close-btn"
                            onClick={onClose}
                            aria-label="Close dialog"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Title & Description */}
                <h2 id="tn-cs-modal-title" className="tn-cs-title">
                    {title}
                </h2>
                <p className="tn-cs-desc">
                    {description}
                </p>

                {/* Upcoming Capabilities List */}
                {capabilities.length > 0 && (
                    <div className="tn-cs-capabilities-box">
                        <div className="tn-cs-capabilities-heading">
                            Upcoming Capabilities
                        </div>
                        <ul className="tn-cs-capability-list">
                            {capabilities.map((item, idx) => (
                                <li key={idx} className="tn-cs-capability-item">
                                    <Check size={15} className="tn-cs-capability-icon" />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Notification Signup Action */}
                <div className="tn-cs-notify-box">
                    <span className="tn-cs-notify-text">
                        {isNotified
                            ? "You'll receive an in-app notice when this feature is ready."
                            : "Want early access when automation is ready to run?"}
                    </span>
                    <button
                        type="button"
                        className={`tn-cs-notify-btn ${isNotified ? 'active' : ''}`}
                        onClick={handleToggleNotify}
                    >
                        {isNotified ? (
                            <>
                                <BellRing size={14} />
                                Notified
                            </>
                        ) : (
                            <>
                                <Bell size={14} />
                                Notify me when available
                            </>
                        )}
                    </button>
                </div>

                {/* Footer with primary dismiss action */}
                <div className="tn-cs-footer">
                    <button
                        type="button"
                        className="tn-cs-got-it-btn"
                        onClick={onClose}
                    >
                        {primaryAction}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ComingSoonModal;
