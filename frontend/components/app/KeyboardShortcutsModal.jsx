import React, { useEffect, useRef } from 'react';
import { X, Command } from 'lucide-react';

const SHORTCUT_GROUPS = [
    {
        title: 'General',
        shortcuts: [
            { keys: ['Ctrl / ⌘', 'K'], label: 'Focus quick search or requirement input' },
            { keys: ['Esc'], label: 'Close open modal, sheet, or menu' },
            { keys: ['Ctrl / ⌘', '/'], label: 'Open this keyboard shortcuts reference' },
        ]
    },
    {
        title: 'AI Workspace & Suite Creation',
        shortcuts: [
            { keys: ['Ctrl / ⌘', 'Enter'], label: 'Analyze requirement / generate test cases' },
            { keys: ['Ctrl / ⌘', 'S'], label: 'Save current draft suite' },
            { keys: ['Tab'], label: 'Navigate to next interactive element' },
            { keys: ['Shift', 'Tab'], label: 'Navigate to previous interactive element' }
        ]
    },
    {
        title: 'Review & Management',
        shortcuts: [
            { keys: ['Ctrl / ⌘', 'E'], label: 'Open export modal for active suite' },
            { keys: ['Space'], label: 'Toggle selected checkbox / chip in focus' },
            { keys: ['Enter'], label: 'Confirm action or open selected item' }
        ]
    }
];

export const KeyboardShortcutsModal = ({ isOpen, onClose, triggerRef }) => {
    const modalRef = useRef(null);
    const closeBtnRef = useRef(null);

    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                handleClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        setTimeout(() => closeBtnRef.current?.focus(), 50);

        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    const handleClose = () => {
        onClose?.();
        setTimeout(() => {
            if (triggerRef?.current) {
                triggerRef.current.focus();
            }
        }, 50);
    };

    if (!isOpen) return null;

    return (
        <div
            className="settings-modal__backdrop"
            onClick={handleClose}
            role="presentation"
        >
            <div
                className="settings-modal__panel"
                style={{ maxWidth: '640px', height: 'auto', maxHeight: '80vh' }}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="shortcuts-modal-title"
                ref={modalRef}
            >
                {/* Header */}
                <div className="settings-modal__header">
                    <div className="settings-modal__header-left">
                        <div className="settings-modal__title-icon-wrap" style={{ background: 'rgba(255, 255, 255, 0.06)' }}>
                            <Command size={18} color="#FFFFFF" />
                        </div>
                        <h2 id="shortcuts-modal-title" className="settings-modal__title">Keyboard Shortcuts</h2>
                    </div>
                    <button
                        type="button"
                        className="settings-modal__close-btn"
                        onClick={handleClose}
                        ref={closeBtnRef}
                        aria-label="Close shortcuts modal"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {SHORTCUT_GROUPS.map((group) => (
                        <div key={group.title}>
                            <h3 style={{
                                fontSize: '11px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.08em',
                                color: 'rgba(255, 255, 255, 0.52)',
                                marginBottom: '12px',
                                fontWeight: 600
                            }}>
                                {group.title}
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {group.shortcuts.map((sc) => (
                                    <div
                                        key={sc.label}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '8px 12px',
                                            borderRadius: '6px',
                                            background: '#0A0A0A',
                                            border: '1px solid rgba(255, 255, 255, 0.08)'
                                        }}
                                    >
                                        <span style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.85)' }}>
                                            {sc.label}
                                        </span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            {sc.keys.map((k) => (
                                                <kbd
                                                    key={k}
                                                    style={{
                                                        padding: '3px 8px',
                                                        fontSize: '11px',
                                                        fontFamily: 'JetBrains Mono, monospace',
                                                        background: '#111111',
                                                        border: '1px solid rgba(255, 255, 255, 0.22)',
                                                        borderRadius: '4px',
                                                        color: '#FFFFFF',
                                                        fontWeight: 500
                                                    }}
                                                >
                                                    {k}
                                                </kbd>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default KeyboardShortcutsModal;
