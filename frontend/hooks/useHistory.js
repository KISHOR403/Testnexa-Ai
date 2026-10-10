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
            const guestHistory = localStorage.getItem(BASE_STORAGE_KEY);
            if (guestHistory) {
                try {
                    const parsed = JSON.parse(guestHistory);
                    if (Array.isArray(parsed)) {
                        setHistory(parsed);
                        return;
                    }
                } catch (e) {}
            }
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
                const remoteData = response.data.map(item => {
                    const totalCases = item.summary?.total ?? (
                        (item.summary?.functional || 0) +
                        (item.summary?.negative || 0) +
                        (item.summary?.edge || 0) +
                        (item.summary?.nonFunctional || 0) +
                        (item.summary?.apiChecklist || 0) +
                        (item.summary?.api || 0)
                    );
                    const sData = item.suiteData || item.data || item.suite;
                    const hasValidCases = sData && typeof sData === 'object' && Object.keys(sData).length > 0 && (
                        (Array.isArray(sData.functional) && sData.functional.length > 0) ||
                        (Array.isArray(sData.negative) && sData.negative.length > 0) ||
                        (Array.isArray(sData.edge) && sData.edge.length > 0) ||
                        (Array.isArray(sData.nonFunctional) && sData.nonFunctional.length > 0) ||
                        (Array.isArray(sData.apiChecklist) && sData.apiChecklist.length > 0) ||
                        (Array.isArray(sData.api) && sData.api.length > 0) ||
                        (Array.isArray(sData.testCases) && sData.testCases.length > 0)
                    );
                    return {
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
                        totalCases,
                        summary: item.summary || {},
                        quality: item.quality || {},
                        currentVersion: item.currentVersion || 1,
                        date: item.updatedAt || item.createdAt,
                        createdAt: item.createdAt,
                        updatedAt: item.updatedAt,
                        data: hasValidCases ? sData : (item.data || item.suite || null),
                        suite: hasValidCases ? sData : (item.suite || item.data || null),
                        suiteData: hasValidCases ? sData : (item.data || item.suite || null),
                        isRemote: true
                    };
                });

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
    const saveToHistory = async (result, requirement, settings, existingSessionId = null, title = null) => {
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

        const resolvedTitle = title || result?.testSuiteName || result?.feature || requirement?.slice(0, 45) || 'Generated Suite';

        if (!isAuthenticated || !user) {
            const guestHistory = JSON.parse(localStorage.getItem(BASE_STORAGE_KEY) || '[]');
            const newGuestEntry = {
                id: 'guest_' + Date.now(),
                sessionId: 'guest_' + Date.now(),
                title: resolvedTitle,
                feature: resolvedTitle,
                requirement: requirement || '',
                status: 'Generated',
                context: settings?.type || 'web',
                depth: settings?.level || 'Standard',
                settings: {
                    type: settings?.type || 'web',
                    level: settings?.level || 'Standard',
                    testFocus: settings?.testFocus || 'mixed'
                },
                totalCases,
                summary: summaryData,
                quality: result?.quality || {},
                currentVersion: 1,
                date: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                data: result,
                suite: result,
                suiteData: result,
                isRemote: false
            };
            const updated = [newGuestEntry, ...guestHistory.slice(0, 19)];
            localStorage.setItem(BASE_STORAGE_KEY, JSON.stringify(updated));
            setHistory(updated);
            notifyUpdate();
            return;
        }

        try {
            if (existingSessionId && existingSessionId !== 'null' && existingSessionId !== 'undefined') {
                await sessionService.update(existingSessionId, {
                    requirement,
                    title: resolvedTitle,
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
                    title: resolvedTitle,
                    suiteData: result,
                    summary: summaryData,
                    status: 'Generated'
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
            if (id && typeof id === 'string') {
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
