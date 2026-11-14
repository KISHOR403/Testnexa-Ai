import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const SettingsModalContext = createContext(null);

export const useSettingsModal = () => {
    const context = useContext(SettingsModalContext);
    if (!context) {
        throw new Error('useSettingsModal must be used within a SettingsModalProvider');
    }
    return context;
};

const SECTION_MAP = {
    profile: 'account',
    security: 'account',
    account: 'account',
    preferences: 'preferences',
    workspace: 'workspace',
    members: 'members',
    data: 'data-privacy',
    privacy: 'data-privacy',
    'data-privacy': 'data-privacy',
    billing: 'billing',
    integrations: 'integrations'
};

export const SettingsModalProvider = ({ children }) => {
    const location = useLocation();
    const navigate = useNavigate();

    const [isOpen, setIsOpen] = useState(false);
    const [activeSection, setActiveSection] = useState('account');
    const triggerElementRef = useRef(null);
    const previousPathRef = useRef(null);

    // Deep link detection from route changes
    useEffect(() => {
        if (location.pathname.startsWith('/app/settings')) {
            const match = location.pathname.match(/^\/app\/settings\/?([^/?#]*)/);
            const tabParam = new URLSearchParams(location.search).get('tab');
            const raw = (match && match[1]) || tabParam || 'account';
            const mapped = SECTION_MAP[raw.toLowerCase()] || 'account';
            setActiveSection(mapped);
            setIsOpen(true);
        } else {
            // Track the previous route so closeSettings can return to it
            previousPathRef.current = location.pathname + location.search;
            setIsOpen(false);
        }
    }, [location.pathname, location.search]);

    // Handle browser back/forward buttons (popstate)
    useEffect(() => {
        const handlePopState = () => {
            if (!window.location.pathname.startsWith('/app/settings')) {
                setIsOpen(false);
                if (triggerElementRef.current && typeof triggerElementRef.current.focus === 'function') {
                    triggerElementRef.current.focus();
                }
            } else {
                const match = window.location.pathname.match(/^\/app\/settings\/?([^/?#]*)/);
                const raw = (match && match[1]) || 'account';
                setActiveSection(SECTION_MAP[raw.toLowerCase()] || 'account');
                setIsOpen(true);
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    const openSettings = useCallback((section = 'account', triggerEl = null) => {
        if (triggerEl) {
            triggerElementRef.current = triggerEl;
        }
        const mapped = SECTION_MAP[section.toLowerCase()] || section;
        setActiveSection(mapped);
        setIsOpen(true);

        const targetUrl = `/app/settings/${mapped}`;
        if (!location.pathname.startsWith('/app/settings')) {
            previousPathRef.current = location.pathname + location.search;
            navigate(targetUrl);
        } else {
            navigate(targetUrl, { replace: true });
        }
    }, [location.pathname, location.search, navigate]);

    const changeSection = useCallback((section) => {
        const mapped = SECTION_MAP[section.toLowerCase()] || section;
        setActiveSection(mapped);
        navigate(`/app/settings/${mapped}`, { replace: true });
    }, [navigate]);

    const closeSettings = useCallback(() => {
        setIsOpen(false);

        // Restore focus to opening element
        if (triggerElementRef.current && typeof triggerElementRef.current.focus === 'function') {
            setTimeout(() => {
                triggerElementRef.current?.focus();
            }, 50);
        }

        // Return to previous route if currently at /app/settings
        if (location.pathname.startsWith('/app/settings')) {
            if (previousPathRef.current && !previousPathRef.current.startsWith('/app/settings')) {
                navigate(previousPathRef.current);
            } else if (window.history.length > 2) {
                navigate(-1);
            } else {
                navigate('/app/workspace');
            }
        }
    }, [location.pathname, navigate]);

    return (
        <SettingsModalContext.Provider
            value={{
                isOpen,
                activeSection,
                openSettings,
                closeSettings,
                changeSection,
                triggerElementRef
            }}
        >
            {children}
        </SettingsModalContext.Provider>
    );
};

export default SettingsModalContext;
