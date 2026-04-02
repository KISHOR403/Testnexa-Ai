import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/apiService';

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

    // Load history from localStorage and sync with backend
    const loadHistory = useCallback(async () => {
        if (!isAuthenticated || !user) {
            setHistory([]);
            return;
        }

        // 1. Load from localStorage first for immediate UI response
        const storedHistory = localStorage.getItem(storageKey);
        let localData = [];
        if (storedHistory) {
            try {
                localData = JSON.parse(storedHistory);
                setHistory(localData);
            } catch (e) {
                console.error('Failed to parse history:', e);
            }
        }

        // 2. Fetch from backend to sync (if online and authenticated)
        try {
            const response = await apiService.getHistory(1, 50);
            if (response.success && Array.isArray(response.data)) {
                // Transform backend history to match frontend format if necessary
                const remoteData = response.data.map(item => ({
                    id: item._id,
                    feature: item.feature || 'Generated Suite',
                    requirement: item.requirement,
                    settings: {
                        type: item.appType,
                        level: item.detailLevel,
                        testFocus: item.testFocus
                    },
                    totalCases: item.summary?.total || 0,
                    date: item.createdAt,
                    data: item.data || null, 
                    isRemote: true
                }));

                // Merge: In a real app, we'd de-duplicate by ID or timestamp
                // For now, we prefer remote data but keep local data that hasn't been synced yet
                setHistory(prev => {
                    const merged = [...remoteData];
                    // Add local items that aren't in remote (very basic de-dupe)
                    localData.forEach(localItem => {
                        if (!merged.find(r => r.feature === localItem.feature && r.requirement === localItem.requirement)) {
                            merged.push(localItem);
                        }
                    });
                    return merged.sort((a, b) => new Date(b.date) - new Date(a.date));
                });
            }
        } catch (e) {
            console.error('Failed to sync history with backend:', e);
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
