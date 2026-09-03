import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { sessionService } from '../services/sessionService';

const BASE_STORAGE_KEY = 'autotestnexa_history';
const HISTORY_UPDATE_EVENT = 'historyUpdated';

// Build a per-user storage key so each account has its own local cache
const getStorageKey = (user) => {
    if (user?._id) return `${BASE_STORAGE_KEY}_${user._id}`;
    if (user?.id) return `${BASE_STORAGE_KEY}_${user.id}`;
    if (user?.email) return `${BASE_STORAGE_KEY}_${user.email}`;
    return BASE_STORAGE_KEY;
};

export const useHistory = () => {
    const { user, isAuthenticated } = useAuth();
    const [history, setHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const storageKey = getStorageKey(user);

    // Load history from sessionService (source of truth) with localStorage as cache
    const loadHistory = useCallback(async () => {
        if (!isAuthenticated || !user) {
            setHistory([]);
            return;
        }

        // 1. Instant display from local cache
        const storedHistory = localStorage.getItem(storageKey);
        if (storedHistory) {
            try {
                const parsed = JSON.parse(storedHistory);
                if (Array.isArray(parsed)) {
                    setHistory(parsed);
                }
            } catch (e) {
                console.error('Failed to parse cached history:', e);
            }
        }

        // 2. Fetch fresh sessions from backend
        try {
            setIsLoading(true);
            const response = await sessionService.list({ limit: 50 });
            if (response.success && Array.isArray(response.data)) {
                const remoteData = response.data.map(item => ({
                    id: item._id,
                    sessionId: item._id,
                    title: item.title || item.feature || 'Generated Suite',
                    feature: item.title || item.feature || 'Generated Suite',
                    requirement: item.requirement || '',
                    status: item.status || 'Generated',
                    context: item.context || 'web',
                    depth: item.depth || 'Standard',
                    settings: {
                        type: item.context || 'web',
                        level: item.depth || 'Standard',
                        testFocus: 'mixed'
                    },
                    totalCases: item.summary?.total || 0,
                    summary: item.summary || {},
                    quality: item.quality || {},
                    currentVersion: item.currentVersion || 1,
                    date: item.updatedAt || item.createdAt,
                    createdAt: item.createdAt,
                    updatedAt: item.updatedAt,
                    data: item.suiteData || null,
                    suite: item.suiteData || null,
                    isRemote: true
                }));

                setHistory(remoteData);
                localStorage.setItem(storageKey, JSON.stringify(remoteData));
            }
        } catch (e) {
            console.warn('Backend session fetch failed, utilizing cached history:', e);
        } finally {
            setIsLoading(false);
        }
    }, [storageKey, isAuthenticated, user]);

    // Load on mount + listen for updates across windows/components
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

    const notifyUpdate = () => {
        window.dispatchEvent(new Event(HISTORY_UPDATE_EVENT));
    };

    // Save or update session
    const saveToHistory = async (result, requirement, settings, existingSessionId = null) => {
        if (!isAuthenticated || !user) return;

        const totalCases = result?.totalCases ||
            (result?.summary
                ? (result.summary.functional || 0) +
                (result.summary.negative || 0) +
                (result.summary.edge || 0) +
                (result.summary.apiChecklist || 0) +
                (result.summary.nonFunctional || 0)
                : 0);

        const summaryData = result?.summary || {
            total: totalCases,
            functional: result?.functional?.length || 0,
            negative: result?.negative?.length || 0,
            edge: result?.edge?.length || 0,
            nonFunctional: result?.nonFunctional?.length || 0,
            apiChecklist: result?.apiChecklist?.length || 0
        };

        try {
            if (existingSessionId) {
                await sessionService.update(existingSessionId, {
                    requirement,
                    context: settings?.type || 'web',
                    depth: settings?.level || 'Standard',
                    suiteData: result,
                    summary: summaryData,
                    status: 'Generated'
                });
            } else {
                await sessionService.create({
                    requirement,
                    context: settings?.type || 'web',
                    depth: settings?.level || 'Standard',
                    title: result?.feature || requirement?.slice(0, 45) || 'Generated Suite'
                });
            }
        } catch (err) {
            console.error('Failed to persist session to backend:', err);
        }

        // Always update local cache & notify
        await loadHistory();
        notifyUpdate();
    };

    // Delete session
    const deleteFromHistory = async (id) => {
        try {
            if (id && typeof id === 'string' && id.length === 24) {
                await sessionService.delete(id);
            }
        } catch (err) {
            console.error('Failed to delete session on backend:', err);
        }

        const current = JSON.parse(localStorage.getItem(storageKey) || '[]');
        const updatedHistory = current.filter(item => item.id !== id && item.sessionId !== id);
        localStorage.setItem(storageKey, JSON.stringify(updatedHistory));
        setHistory(updatedHistory);
        notifyUpdate();
    };

    // Archive session
    const archiveSession = async (id) => {
        try {
            await sessionService.update(id, { status: 'Archived' });
            await loadHistory();
            notifyUpdate();
        } catch (err) {
            console.error('Failed to archive session:', err);
        }
    };

    // Rename session
    const renameSession = async (id, newTitle) => {
        if (!newTitle || !newTitle.trim()) return;
        try {
            await sessionService.update(id, { title: newTitle.trim() });
            await loadHistory();
            notifyUpdate();
        } catch (err) {
            console.error('Failed to rename session:', err);
        }
    };

    // Filter recent active sessions for sidebar display
    const recentSessions = history
        .filter(item => item.status !== 'Archived')
        .slice(0, 4);

    return {
        history,
        recentSessions,
        isLoading,
        loadHistory,
        saveToHistory,
        deleteFromHistory,
        archiveSession,
        renameSession
    };
};
