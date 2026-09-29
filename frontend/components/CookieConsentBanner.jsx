import React, { useState, useEffect } from 'react';
import { ShieldCheck, X, Check, Cookie } from 'lucide-react';

const CONSENT_STORAGE_KEY = 'testnexa_cookie_consent';

export const CookieConsentBanner = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [analyticsConsent, setAnalyticsConsent] = useState(false);

    useEffect(() => {
        // Check if user has already recorded a choice
        try {
            const saved = localStorage.getItem(CONSENT_STORAGE_KEY);
            if (!saved) {
                // Delay banner slightly for smooth appearance
                const timer = setTimeout(() => setIsVisible(true), 800);
                return () => clearTimeout(timer);
            } else {
                const parsed = JSON.parse(saved);
                setAnalyticsConsent(!!parsed.analytics);
            }
        } catch (e) {
            setIsVisible(true);
        }
    }, []);

    // Listen for custom event from Footer or Settings to re-open preferences
    useEffect(() => {
        const handleOpenPreferences = () => {
            try {
                const saved = localStorage.getItem(CONSENT_STORAGE_KEY);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    setAnalyticsConsent(!!parsed.analytics);
                }
            } catch (e) {}
            setIsModalOpen(true);
        };

        window.addEventListener('testnexa:open-cookie-preferences', handleOpenPreferences);
        return () => window.removeEventListener('testnexa:open-cookie-preferences', handleOpenPreferences);
    }, []);

    const saveConsent = (allowAnalytics) => {
        const consentData = {
            necessary: true,
            analytics: allowAnalytics,
            timestamp: new Date().toISOString()
        };
        try {
            localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consentData));
            // Dispatch event for any analytics listeners
            window.dispatchEvent(new CustomEvent('testnexa:cookie-consent-updated', { detail: consentData }));
        } catch (e) {}

        setAnalyticsConsent(allowAnalytics);
        setIsVisible(false);
        setIsModalOpen(false);
    };

    const handleAcceptAll = () => saveConsent(true);
    const handleRejectOptional = () => saveConsent(false);
    const handleSavePreferences = () => saveConsent(analyticsConsent);

    return (
        <>
            {/* ─── Bottom Floating Cookie Consent Banner ─── */}
            {isVisible && !isModalOpen && (
                <div
                    className="tn-cookie-banner"
                    role="region"
                    aria-label="Cookie consent banner"
                    style={{
                        position: 'fixed',
                        bottom: '24px',
                        left: '24px',
                        right: '24px',
                        maxWidth: '560px',
                        zIndex: 9999,
                        background: '#0A0A0A',
                        border: '1px solid #1C1C1C',
                        borderRadius: '12px',
                        padding: '20px 24px',
                        boxShadow: '0 20px 48px rgba(0, 0, 0, 0.8)',
                        animation: 'tnCookieFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '14px' }}>
                        <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '8px',
                            background: 'rgba(0, 217, 192, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#00D9C0',
                            flexShrink: 0
                        }}>
                            <Cookie size={20} aria-hidden="true" />
                        </div>
                        <div>
                            <h3 style={{
                                fontSize: '1rem',
                                fontWeight: 600,
                                color: '#F5F5F5',
                                margin: '0 0 6px 0'
                            }}>
                                We use cookies
                            </h3>
                            <p style={{
                                fontSize: '0.86rem',
                                color: '#A3A3A3',
                                lineHeight: '1.55',
                                margin: 0
                            }}>
                                TestNexa uses necessary cookies to keep the service secure and functional.
                                With your permission, we may also use analytics cookies to understand how the website is used.
                            </p>
                        </div>
                    </div>

                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: '8px',
                        marginTop: '16px'
                    }}>
                        <button
                            type="button"
                            onClick={handleAcceptAll}
                            style={{
                                background: '#F5F5F5',
                                color: '#050505',
                                border: 'none',
                                height: '36px',
                                padding: '0 16px',
                                borderRadius: '6px',
                                fontSize: '0.84rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'background-color 0.15s ease'
                            }}
                        >
                            Accept All
                        </button>

                        <button
                            type="button"
                            onClick={handleRejectOptional}
                            style={{
                                background: 'transparent',
                                color: '#F5F5F5',
                                border: '1px solid #2A2A2A',
                                height: '36px',
                                padding: '0 14px',
                                borderRadius: '6px',
                                fontSize: '0.84rem',
                                fontWeight: 500,
                                cursor: 'pointer'
                            }}
                        >
                            Reject Optional
                        </button>

                        <button
                            type="button"
                            onClick={() => setIsModalOpen(true)}
                            style={{
                                background: 'transparent',
                                color: '#A3A3A3',
                                border: 'none',
                                height: '36px',
                                padding: '0 10px',
                                borderRadius: '6px',
                                fontSize: '0.82rem',
                                textDecoration: 'underline',
                                cursor: 'pointer'
                            }}
                        >
                            Manage Preferences
                        </button>
                    </div>
                </div>
            )}

            {/* ─── Preferences Modal ─── */}
            {isModalOpen && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 10000,
                        background: 'rgba(0, 0, 0, 0.75)',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '20px'
                    }}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="cookie-preferences-title"
                >
                    <div
                        style={{
                            background: '#0A0A0A',
                            border: '1px solid #1C1C1C',
                            borderRadius: '12px',
                            maxWidth: '520px',
                            width: '100%',
                            padding: '28px',
                            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.85)'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 id="cookie-preferences-title" style={{ fontSize: '1.2rem', fontWeight: 600, color: '#F5F5F5', margin: 0 }}>
                                Cookie Preferences
                            </h2>
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                aria-label="Close cookie preferences modal"
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#737373',
                                    cursor: 'pointer',
                                    padding: '4px'
                                }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <p style={{ fontSize: '0.88rem', color: '#A3A3A3', lineHeight: '1.6', marginBottom: '24px' }}>
                            Customise your cookie choices. Necessary cookies remain active to support core authentication,
                            session continuity, and security verification.
                        </p>

                        {/* Category 1: Strictly Necessary */}
                        <div style={{
                            padding: '16px',
                            background: '#111111',
                            border: '1px solid #1C1C1C',
                            borderRadius: '8px',
                            marginBottom: '14px'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <span style={{ fontWeight: 600, color: '#F5F5F5', fontSize: '0.92rem' }}>
                                    Strictly Necessary Cookies
                                </span>
                                <span style={{
                                    fontSize: '0.74rem',
                                    fontWeight: 600,
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    background: 'rgba(0, 217, 192, 0.1)',
                                    color: '#00D9C0'
                                }}>
                                    Always Active
                                </span>
                            </div>
                            <p style={{ fontSize: '0.82rem', color: '#737373', margin: 0, lineHeight: '1.5' }}>
                                Essential for user authentication, CSRF validation, workspace isolation, and maintaining active login state.
                                These cannot be disabled.
                            </p>
                        </div>

                        {/* Category 2: Analytics & Performance */}
                        <div style={{
                            padding: '16px',
                            background: '#111111',
                            border: '1px solid #1C1C1C',
                            borderRadius: '8px',
                            marginBottom: '24px'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <label htmlFor="toggle-analytics-cookies" style={{ fontWeight: 600, color: '#F5F5F5', fontSize: '0.92rem', cursor: 'pointer' }}>
                                    Analytics &amp; Usage Cookies
                                </label>
                                <input
                                    type="checkbox"
                                    id="toggle-analytics-cookies"
                                    checked={analyticsConsent}
                                    onChange={(e) => setAnalyticsConsent(e.target.checked)}
                                    style={{
                                        width: '18px',
                                        height: '18px',
                                        accentColor: '#00D9C0',
                                        cursor: 'pointer'
                                    }}
                                />
                            </div>
                            <p style={{ fontSize: '0.82rem', color: '#737373', margin: 0, lineHeight: '1.5' }}>
                                Helps us gauge aggregate traffic metrics and feature usage patterns to improve TestNexa.
                                No private requirements or credentials are tracked.
                            </p>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button
                                type="button"
                                onClick={handleRejectOptional}
                                style={{
                                    background: 'transparent',
                                    color: '#F5F5F5',
                                    border: '1px solid #2A2A2A',
                                    height: '38px',
                                    padding: '0 16px',
                                    borderRadius: '6px',
                                    fontSize: '0.86rem',
                                    cursor: 'pointer'
                                }}
                            >
                                Reject Optional
                            </button>

                            <button
                                type="button"
                                onClick={handleSavePreferences}
                                style={{
                                    background: '#F5F5F5',
                                    color: '#050505',
                                    border: 'none',
                                    height: '38px',
                                    padding: '0 18px',
                                    borderRadius: '6px',
                                    fontSize: '0.86rem',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Save Preferences
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default CookieConsentBanner;
