import React from 'react';
import { Check, X, Circle, AlertCircle } from 'lucide-react';

/**
 * ApprovalPill: Dedicated test case approval state indicator.
 * Strict B&W Design System:
 * - Pending: dashed outline with circle icon
 * - Approved: solid white outline with check icon
 * - Rejected: solid white fill with black text and an x icon
 * - Stale flag: small 'Requirement changed' indicator
 */
export const ApprovalPill = ({ status, staleReason = null, size = 'md', className = '' }) => {
    const raw = String(status || 'pending').toLowerCase().trim();
    const isApproved = raw === 'approved';
    const isRejected = raw === 'rejected';
    const isPending = !isApproved && !isRejected;

    const iconSize = size === 'sm' ? 10 : 12;

    return (
        <div className={`tn-approval-pill-wrap ${className}`}>
            {isApproved && (
                <span
                    className={`tn-approval-pill tn-approval-pill--approved tn-approval-pill--${size}`}
                    title="Approved by reviewer"
                >
                    <Check size={iconSize} strokeWidth={2.5} />
                    <span>Approved</span>
                </span>
            )}
            {isRejected && (
                <span
                    className={`tn-approval-pill tn-approval-pill--rejected tn-approval-pill--${size}`}
                    title="Rejected by reviewer"
                >
                    <X size={iconSize} strokeWidth={2.5} />
                    <span>Rejected</span>
                </span>
            )}
            {isPending && (
                <span
                    className={`tn-approval-pill tn-approval-pill--pending tn-approval-pill--${size}`}
                    title="Pending human review"
                >
                    <Circle size={iconSize} strokeWidth={1.75} strokeDasharray="2 2" />
                    <span>Pending</span>
                </span>
            )}
            {staleReason && (
                <span
                    className="tn-stale-tag"
                    title={`Flagged for review: ${staleReason.replace(/_/g, ' ')}`}
                >
                    <AlertCircle size={10} />
                    <span>Requirement changed, review</span>
                </span>
            )}
        </div>
    );
};

export default ApprovalPill;
