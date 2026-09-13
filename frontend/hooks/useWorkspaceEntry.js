import { useState, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Validates and sanitizes a return URL to prevent Open Redirect vulnerabilities.
 * Only relative paths starting with a single '/' are permitted.
 * Protocol-relative ('//'), backslash ('/\\'), and external URL schemes are rejected.
 *
 * @param {string} url - Candidate return URL
 * @param {string} fallback - Safe fallback URL (defaults to '/app/workspace')
 * @returns {string} Safe relative URL
 */
export const getSafeReturnUrl = (url, fallback = '/app/workspace') => {
    if (!url || typeof url !== 'string') return fallback;
    const trimmed = url.trim();

    // Must start with exactly one '/' and not followed by another '/' or '\'
    if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
        return fallback;
    }

    // Disallow protocols anywhere in path (e.g., javascript:, data:, https:)
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
        return fallback;
    }

    try {
        const dummyBase = 'http://localhost';
        const parsed = new URL(trimmed, dummyBase);
        // Ensure the origin did not change
        if (parsed.origin !== dummyBase) return fallback;
        return parsed.pathname + parsed.search + parsed.hash;
    } catch {
        return fallback;
    }
};

/**
 * Custom hook providing a centralized entry point into the AI Workspace.
 *
 * Requirements satisfied:
 * 1. Synchronous new-tab opening in direct user click event (avoids popup blockers).
 * 2. Authenticated users navigate directly to /app/workspace.
 * 3. Unauthenticated users navigate to /login?returnTo=/app/workspace.
 * 4. Original landing page tab remains open and undisturbed.
 * 5. Rapid double-clicks are debounced to prevent duplicate tabs.
 */
export const useWorkspaceEntry = () => {
    const { isAuthenticated, isLoading } = useAuth();
    const [isOpening, setIsOpening] = useState(false);
    const isOpeningRef = useRef(false);

    /**
     * Checks whether the user is authenticated based on Context state or token presence.
     */
    const checkIsLoggedIn = useCallback(() => {
        if (isAuthenticated) return true;
        try {
            const token = localStorage.getItem('testnexa_token');
            return Boolean(token);
        } catch {
            return false;
        }
    }, [isAuthenticated]);

    /**
     * Computes the destination URL for a given target path.
     *
     * @param {string} destination - Target workspace path (defaults to '/app/workspace')
     * @returns {string} Calculated target URL
     */
    const getTargetUrl = useCallback((destination = '/app/workspace') => {
        const safeDestination = getSafeReturnUrl(destination, '/app/workspace');
        const loggedIn = checkIsLoggedIn();

        if (loggedIn) {
            return safeDestination;
        }
        return `/login?returnTo=${encodeURIComponent(safeDestination)}`;
    }, [checkIsLoggedIn]);

    /**
     * Centralized navigation handler for Get Started & Generate Test Suite CTAs.
     * Opens a new tab immediately while leaving the current tab intact.
     *
     * @param {string} destination - Intended destination path (default: '/app/workspace')
     */
    const handleWorkspaceEntry = useCallback((destination = '/app/workspace') => {
        if (isOpeningRef.current) return;
        isOpeningRef.current = true;
        setIsOpening(true);

        const targetUrl = getTargetUrl(destination);

        // Open in a new tab immediately to comply with browser popup blocker rules
        try {
            const newWindow = window.open(targetUrl, '_blank', 'noopener,noreferrer');
            if (newWindow) {
                newWindow.opener = null;
            }
        } catch (e) {
            // Fallback in case window.open fails (e.g. strict embedded webviews)
            window.location.href = targetUrl;
        }

        // Release debounce lock after 800ms
        setTimeout(() => {
            isOpeningRef.current = false;
            setIsOpening(false);
        }, 800);
    }, [getTargetUrl]);

    return {
        handleWorkspaceEntry,
        getTargetUrl,
        isOpening,
        isAuthenticated: checkIsLoggedIn(),
        isLoading
    };
};

export default useWorkspaceEntry;
