import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Accessible, portal-rendered Modal dialog component.
 * Ensures modals never disrupt document flow, supports Escape key,
 * backdrop clicks, body scroll locking, and accessible dialog semantics.
 */
const Modal = ({
    isOpen,
    onClose,
    title,
    icon: Icon,
    children,
    footer,
    size = 'md', // 'sm' | 'md' | 'lg'
    id = 'tn-modal-dialog',
    ariaLabel
}) => {
    const modalRef = useRef(null);

    // Escape key listener & Body scroll locking
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

        // Auto-focus the dialog or first focusable element for accessibility
        const focusable = modalRef.current?.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable && focusable.length > 0) {
            // Focus either first interactive element or the close button
            focusable[0].focus();
        }

        return () => {
            document.body.style.overflow = originalOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose?.();
        }
    };

    const sizeClass = size === 'sm' ? 'tn-modal-box--sm' : size === 'lg' ? 'tn-modal-box--lg' : 'tn-modal-box--md';

    const modalContent = (
        <div
            className="tn-modal-overlay animate-fade-in"
            onClick={handleBackdropClick}
            data-testid="modal-overlay"
        >
            <div
                ref={modalRef}
                className={`tn-modal-box ${sizeClass} animate-scale-in`}
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? `${id}-title` : undefined}
                aria-label={!title ? ariaLabel : undefined}
                data-testid="modal-box"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="tn-modal-header">
                    <div className="tn-modal-header__title-group">
                        {Icon && <span className="tn-modal-header__icon">{Icon}</span>}
                        {title && (
                            <h3 id={`${id}-title`} className="tn-modal-title">
                                {title}
                            </h3>
                        )}
                    </div>
                    <button
                        type="button"
                        className="tn-modal-close-btn"
                        onClick={onClose}
                        aria-label="Close dialog"
                        title="Close (Esc)"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body with internal scrolling */}
                <div className="tn-modal-body">
                    {children}
                </div>

                {/* Optional Footer */}
                {footer && (
                    <div className="tn-modal-footer">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );

    // Render directly at body root via React Portal
    return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
};

export default Modal;
