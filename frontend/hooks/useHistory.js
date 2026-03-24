import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const BASE_STORAGE_KEY = 'autotestnexa_history';
const HISTORY_UPDATE_EVENT = 'historyUpdated';

// Build a per-user storage key so each account has its own history
const getStorageKey = (user) => {
    if (user?._id) return `${BASE_STORAGE_KEY}_${user._id}`;
    if (user?.id) return `${BASE_STORAGE_KEY}_${user.id}`;
    if (user?.email) return `${BASE_STORAGE_KEY}_${user.email}`;
    return BASE_STORAGE_KEY;
};

export const useHistory = () => {
    const { user, isAuthenticated } = useAuth();
    const [history, setHistory] = useState([]);

    const storageKey = getStorageKey(user);

    // Load history from localStorage
    const loadHistory = useCallback(() => {
        if (!isAuthenticated || !user) {
            setHistory([]);
            return;
        }
        const storedHistory = localStorage.getItem(storageKey);
        if (storedHistory) {
            try {
                setHistory(JSON.parse(storedHistory));
            } catch (e) {
                console.error('Failed to parse history:', e);
                setHistory([]);
            }
        } else {
            setHistory([]);
        }
    }, [storageKey, isAuthenticated, user]);

    // Load on mount + listen for updates from other hook instances
    useEffect(() => {
        loadHistory();

        const handleUpdate = () => loadHistory();
        window.addEventListener(HISTORY_UPDATE_EVENT, handleUpdate);
        window.addEventListener('storage', handleUpdate);

        return () => {
            window.removeEventListener(HISTORY_UPDATE_EVENT, handleUpdate);
            window.removeEventListener('storage', handleUpdate);
        };
    }, [loadHistory]);

    const saveToHistory = (result, requirement, settings) => {
        if (!isAuthenticated || !user) return;

        const totalCases = result.totalCases ||
            (result.summary
                ? (result.summary.functional || 0) +
                (result.summary.negative || 0) +
                (result.summary.edge || 0) +
                (result.summary.apiChecklist || 0) +
                (result.summary.nonFunctional || 0)
                : 0);

        const newItem = {
            id: Date.now(),
            feature: result.feature || 'Generated Suite',
            requirement: requirement,
            settings: settings,
            totalCases: totalCases,
            date: new Date().toISOString(),
            data: result
        };

        // Read latest from localStorage to avoid stale state
        const current = JSON.parse(localStorage.getItem(storageKey) || '[]');
        const updatedHistory = [newItem, ...current];
        localStorage.setItem(storageKey, JSON.stringify(updatedHistory));
        setHistory(updatedHistory);

        // Notify other hook instances on the same page
        window.dispatchEvent(new Event(HISTORY_UPDATE_EVENT));
    };

    const deleteFromHistory = (id) => {
        const current = JSON.parse(localStorage.getItem(storageKey) || '[]');
        const updatedHistory = current.filter(item => item.id !== id);
        localStorage.setItem(storageKey, JSON.stringify(updatedHistory));
        setHistory(updatedHistory);

        // Notify other hook instances
        window.dispatchEvent(new Event(HISTORY_UPDATE_EVENT));
    };

    return { history, saveToHistory, deleteFromHistory };
};
