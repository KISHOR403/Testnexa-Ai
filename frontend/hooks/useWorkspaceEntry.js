import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Validates and sanitizes a return URL to prevent Open Redirect vulnerabilities.
 * Only relative paths starting with a single '/' are permitted.
 * Protocol-relative ('//'), backslash ('/\\'), and external URL schemes are rejected.
 * Also normalizes convenience alias routes to canonical application routes.
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

        let pathname = parsed.pathname;

        // Route normalization for common convenience aliases
        if (
            pathname === '/workspace' ||
            pathname === '/workspace/new-test-suite' ||
            pathname === '/app/workspace/new-test-suite' ||
            pathname === '/generator' ||
            pathname === '/new-test-suite'
        ) {
            pathname = '/app/workspace';
        } else if (pathname === '/suites') {
            pathname = '/app/test-suites';
        } else if (pathname.startsWith('/suites/')) {
            pathname = pathname.replace('/suites/', '/app/test-suites/');
        } else if (pathname === '/billing') {
            pathname = '/app/settings';
            if (!parsed.search.includes('tab=')) {
                parsed.search = parsed.search ? `${parsed.search}&tab=billing` : '?tab=billing';
            }
        }

        return pathname + parsed.search + parsed.hash;
    } catch {
        return fallback;
    }
};

/**
 * Custom hook providing a centralized entry point into the AI Workspace / Test Suite generator.
 *
 * Requirements satisfied:
 * 1. Authenticated users navigate directly to the intended destination (default: /app/workspace).
 * 2. Unauthenticated visitors navigate seamlessly to /login?next=... preserving destination and parameters.
 * 3. Supports in-page SPA navigation while safely supporting explicit new-tab requests.
 * 4. Rapid clicks are debounced.
 */
export const useWorkspaceEntry = () => {
    const { isAuthenticated, isLoading } = useAuth();
    const navigate = useNavigate();
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
        return `/login?next=${encodeURIComponent(safeDestination)}`;
    }, [checkIsLoggedIn]);

    /**
     * Centralized navigation handler for Get Started & Generate Test Suite CTAs.
     * Navigates in the current tab by default for standard SPA behavior, or opens a new tab if requested.
     *
     * @param {string} destination - Intended destination path (default: '/app/workspace')
     * @param {Object} options - Navigation options (e.g. { newTab: true })
     */
    const handleWorkspaceEntry = useCallback((destination = '/app/workspace', options = {}) => {
        if (isOpeningRef.current) return;
        isOpeningRef.current = true;
        setIsOpening(true);

        const targetUrl = getTargetUrl(destination);

        if (options.newTab) {
            try {
                const newWindow = window.open(targetUrl, '_blank', 'noopener,noreferrer');
                if (newWindow) {
                    newWindow.opener = null;
                }
            } catch (e) {
                navigate(targetUrl);
            }
        } else {
            navigate(targetUrl);
        }

        // Release debounce lock after 500ms
        setTimeout(() => {
            isOpeningRef.current = false;
            setIsOpening(false);
        }, 500);
    }, [getTargetUrl, navigate]);

    return {
        handleWorkspaceEntry,
        getTargetUrl,
        isOpening,
        isAuthenticated: checkIsLoggedIn(),
        isLoading
    };
};

export default useWorkspaceEntry;
