import React, { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext();

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};

export const SettingsProvider = ({ children }) => {
    const [settings, setSettings] = useState(() => {
        try {
            const saved = localStorage.getItem('testnexa_settings');
            const parsed = saved ? JSON.parse(saved) : null;
            if (parsed && typeof parsed === 'object') {
                return {
                    aiGlow: parsed.aiGlow ?? true,
                    highContrast: parsed.highContrast ?? false,
                    notifications: parsed.notifications ?? true,
                    compactMode: parsed.compactMode ?? false,
                    emailAlerts: parsed.emailAlerts ?? true,
                    weeklyDigest: parsed.weeklyDigest ?? false,
                    defaultPlatform: parsed.defaultPlatform ?? 'Web',
                    defaultCoverageDepth: parsed.defaultCoverageDepth ?? 'Standard',
                    defaultTestTypes: parsed.defaultTestTypes ?? {
                        functional: true,
                        negative: true,
                        edge: true,
                        security: false,
                        regression: true,
                        performance: false
                    },
                    defaultExportFormat: parsed.defaultExportFormat ?? 'Playwright',
                    language: parsed.language ?? 'en-US',
                    minTestCaseCount: parsed.minTestCaseCount ?? 15,
                    defaultAutomationFramework: parsed.defaultAutomationFramework ?? 'Playwright'
                };
            }
        } catch (e) {
            console.error('Settings parse failed:', e);
        }
        return {
            aiGlow: true,
            highContrast: false,
            notifications: true,
            compactMode: false,
            emailAlerts: true,
            weeklyDigest: false,
            defaultPlatform: 'Web',
            defaultCoverageDepth: 'Standard',
            defaultTestTypes: {
                functional: true,
                negative: true,
                edge: true,
                security: false,
                regression: true,
                performance: false
            },
            defaultExportFormat: 'Playwright',
            language: 'en-US',
            minTestCaseCount: 15,
            defaultAutomationFramework: 'Playwright'
        };
    });

    // Apply settings to document body/root
    useEffect(() => {
        const root = document.documentElement;
        if (!root) return;

        // AI Glow
        if (settings.aiGlow) {
            root.classList.add('ai-glow-enabled');
            root.classList.remove('ai-glow-disabled');
        } else {
            root.classList.add('ai-glow-disabled');
            root.classList.remove('ai-glow-enabled');
        }

        // High Contrast
        if (settings.highContrast) {
            root.classList.add('high-contrast');
        } else {
            root.classList.remove('high-contrast');
        }

        // Compact Mode
        if (settings.compactMode) {
            root.classList.add('compact-mode');
        } else {
            root.classList.remove('compact-mode');
        }

        // Persist local copy
        localStorage.setItem('testnexa_settings', JSON.stringify(settings));
    }, [settings]);

    const updateSetting = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const toggleSetting = (key) => {
        const newValue = !settings[key];

        // Handle browser permission for notifications
        if (key === 'notifications' && newValue && typeof window !== 'undefined' && 'Notification' in window) {
            if (Notification.permission !== 'granted') {
                Notification.requestPermission().then(permission => {
                    if (permission !== 'granted') {
                        return;
                    }
                    setSettings(prev => ({ ...prev, [key]: newValue }));
                });
            } else {
                setSettings(prev => ({ ...prev, [key]: newValue }));
            }
        } else {
            setSettings(prev => ({ ...prev, [key]: newValue }));
        }
    };

    // Simulate saving preferences to the backend
    const saveSettingsToServer = async (newSettings) => {
        return new Promise((resolve) => {
            setTimeout(() => {
                setSettings(newSettings);
                localStorage.setItem('testnexa_settings', JSON.stringify(newSettings));
                resolve({ success: true });
            }, 600);
        });
    };

    return (
        <SettingsContext.Provider value={{ settings, updateSetting, toggleSetting, saveSettingsToServer }}>
            {children}
        </SettingsContext.Provider>
    );
};
