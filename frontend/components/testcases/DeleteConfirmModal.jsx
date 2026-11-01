import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, X } from 'lucide-react';

const DeleteConfirmModal = ({
    isOpen,
    onClose,
    testCase,
    onConfirm,
    isDeleting = false
}) => {
    if (!isOpen || !testCase) return null;

    return createPortal(
        <div className="tc-modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget && !isDeleting) onClose(); }}>
            <section className="tc-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="tc-del-title">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <h2 id="tc-del-title" style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0, color: 'var(--tc-fail)' }}>
                        <Trash2 size={16} />
                        <span>Delete Test Case: {testCase.id}</span>
                    </h2>
                    <button type="button" onClick={onClose} disabled={isDeleting} style={{ background: 'transparent', border: 0, color: 'var(--tc-muted)', cursor: 'pointer' }}>
                        <X size={15} />
                    </button>
                </div>

                <p style={{ margin: '0 0 10px', fontSize: '0.74rem', color: 'var(--tc-muted)', lineHeight: '1.5' }}>
                    Are you sure you want to delete <strong>"{testCase.title}"</strong> from <strong>{testCase.suiteName}</strong>?
                </p>

                <div style={{ padding: '8px 10px', background: 'rgba(229, 192, 123, 0.08)', border: '1px solid rgba(229, 192, 123, 0.25)', borderRadius: '4px', fontSize: '0.69rem', color: 'var(--tc-warn)', marginBottom: '14px' }}>
                    <strong>Data Integrity Notice:</strong> This test case will be removed from the active suite specification. Historical test execution records, run reports, and evidence snapshots will remain permanently preserved.
                </div>

                <footer>
                    <button type="button" onClick={onClose} disabled={isDeleting}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="tc-delete-confirm"
                        disabled={isDeleting}
                        onClick={onConfirm}
                    >
                        {isDeleting ? 'Deleting…' : 'Delete Test Case'}
                    </button>
                </footer>
            </section>
        </div>,
        document.body
    );
};

export default DeleteConfirmModal;

