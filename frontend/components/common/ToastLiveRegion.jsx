import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { X, RotateCcw } from 'lucide-react';

const ToastContext = createContext({
    showToast: () => {},
    dismissToast: () => {}
});

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const dismissToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const showToast = useCallback((message, { onUndo = null, duration = 10000, type = 'info' } = {}) => {
        const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const newToast = { id, message, onUndo, type, duration };

        setToasts(prev => [...prev, newToast]);

        if (duration > 0) {
            setTimeout(() => {
                dismissToast(id);
            }, duration);
        }

        return id;
    }, [dismissToast]);

    return (
        <ToastContext.Provider value={{ showToast, dismissToast }}>
            {children}
            {/* Live Region Toast Container */}
            <div
                className="tn-toast-container"
                role="status"
                aria-live="polite"
                aria-atomic="true"
            >
                {toasts.map(toast => (
                    <div key={toast.id} className="tn-toast-item">
                        <span className="tn-toast-message">{toast.message}</span>
                        {toast.onUndo && (
                            <button
                                type="button"
                                className="tn-toast-undo-btn"
                                onClick={async () => {
                                    try {
                                        await toast.onUndo();
                                    } catch (err) {
                                        console.error('Toast undo failed:', err);
                                    } finally {
                                        dismissToast(toast.id);
                                    }
                                }}
                            >
                                <RotateCcw size={12} />
                                <span>Undo</span>
                            </button>
                        )}
                        <button
                            type="button"
                            className="tn-toast-close-btn"
                            onClick={() => dismissToast(toast.id)}
                            aria-label="Dismiss toast"
                        >
                            <X size={13} />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

export default ToastProvider;
