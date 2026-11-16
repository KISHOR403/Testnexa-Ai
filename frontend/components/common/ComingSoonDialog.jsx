import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Play, ArrowUpRight } from 'lucide-react';
import { useComingSoon } from '../../context/ComingSoonContext';
import '../../styles/app/ComingSoonDialog.css';

const ComingSoonDialog = () => {
    const { isOpen, close } = useComingSoon();
    const modalRef = useRef(null);
    const primaryBtnRef = useRef(null);
    const [touchStartY, setTouchStartY] = useState(null);

    // Body scroll locking and focus trap
    useEffect(() => {
        if (!isOpen) return;

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        // Focus primary button when dialog opens
        const focusTimer = setTimeout(() => {
            primaryBtnRef.current?.focus();
        }, 30);

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                close();
                return;
            }

            if (e.key === 'Tab' && modalRef.current) {
                const focusable = modalRef.current.querySelectorAll(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                if (!focusable.length) return;

                const first = focusable[0];
                const last = focusable[focusable.length - 1];

                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            clearTimeout(focusTimer);
            document.body.style.overflow = originalOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, close]);

    if (!isOpen || typeof document === 'undefined') return null;

    // Mobile pull/swipe down to dismiss handlers
    const handleTouchStart = (e) => {
        if (e.touches && e.touches[0]) {
            setTouchStartY(e.touches[0].clientY);
        }
    };

    const handleTouchEnd = (e) => {
        if (touchStartY !== null && e.changedTouches && e.changedTouches[0]) {
            const deltaY = e.changedTouches[0].clientY - touchStartY;
            if (deltaY > 60) {
                close();
            }
            setTouchStartY(null);
        }
    };

    return createPortal(
        <div
            className="cs-dialog-backdrop"
            onClick={(e) => {
                if (e.target === e.currentTarget) close();
            }}
            data-testid="coming-soon-backdrop"
        >
            <div
                className="sr-only"
                aria-live="polite"
            >
                Test execution is coming soon dialog opened
            </div>

            <div
                ref={modalRef}
                className="cs-dialog-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="cs-dialog-title"
                aria-describedby="cs-dialog-desc"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                data-testid="coming-soon-dialog"
            >
                {/* Pull handle visible on mobile bottom sheet */}
                <div className="cs-sheet-handle" aria-hidden="true" />

                <div className="cs-dialog-header">
                    <div className="cs-dialog-header-left">
                        <div className="cs-dialog-icon-pill" aria-hidden="true">
                            <Play size={13} />
                        </div>
                        <h2 id="cs-dialog-title" className="cs-dialog-title">
                            Test execution is coming soon
                        </h2>
                    </div>

                    <button
                        type="button"
                        className="cs-dialog-close-btn"
                        onClick={close}
                        aria-label="Close dialog"
                        data-testid="coming-soon-close"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="cs-dialog-body">
                    <p id="cs-dialog-desc" className="cs-dialog-desc">
                        Manual and Playwright runs are currently in development. You can already create test suites, link requirements, and trace coverage.
                    </p>

                    <div>
                        <div className="cs-dialog-section-label">What's planned</div>
                        <ul className="cs-dialog-list">
                            <li className="cs-dialog-list-item">
                                <span className="cs-dialog-bullet-icon" aria-hidden="true" />
                                <span>Manual step-by-step test execution</span>
                            </li>
                            <li className="cs-dialog-list-item">
                                <span className="cs-dialog-bullet-icon" aria-hidden="true" />
                                <span>Automated runs with Playwright</span>
                            </li>
                            <li className="cs-dialog-list-item">
                                <span className="cs-dialog-bullet-icon" aria-hidden="true" />
                                <span>Live run progress and detailed reports</span>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="cs-dialog-footer">
                    <a
                        href="/docs/TEST_EXECUTION.md"
                        target="_blank"
                        rel="noreferrer"
                        className="cs-dialog-doc-link"
                    >
                        <span>View documentation</span>
                        <ArrowUpRight size={13} aria-hidden="true" />
                    </a>

                    <button
                        ref={primaryBtnRef}
                        type="button"
                        className="cs-dialog-primary-btn"
                        onClick={close}
                        data-testid="coming-soon-confirm"
                    >
                        Got it
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ComingSoonDialog;
