/**
 * TestNexa AI — Telemetry & Analytics Module
 * 
 * STATUS: ANALYTICS NOT CONFIGURED
 * No third-party tracking provider (e.g. Google Analytics, PostHog, Mixpanel)
 * is currently activated in this environment.
 * 
 * This module provides a clean, privacy-first interface ready for future integration.
 * All event collection strictly respects user cookie consent preferences and
 * strictly excludes sensitive inputs, passwords, authentication tokens, and user specifications.
 */

const CONSENT_STORAGE_KEY = 'testnexa_cookie_consent';

/**
 * Check if the user has explicitly consented to optional analytics cookies.
 */
export const hasAnalyticsConsent = () => {
    try {
        const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        return parsed && parsed.analytics === true;
    } catch (e) {
        return false;
    }
};

/**
 * Sanitize event properties to ensure no sensitive credentials or private text are logged.
 */
const sanitizeProperties = (props = {}) => {
    const sanitized = { ...props };
    const forbiddenKeys = [
        'password',
        'token',
        'jwt',
        'secret',
        'requirement',
        'raw_requirement',
        'auth',
        'creditCard',
        'email'
    ];

    for (const key of Object.keys(sanitized)) {
        if (forbiddenKeys.some(forbidden => key.toLowerCase().includes(forbidden))) {
            delete sanitized[key];
        }
    }

    return sanitized;
};

/**
 * Dispatch an analytics event if tracking is configured and user consented.
 * 
 * @param {string} eventName - Name of the event (e.g. 'get_started_clicked')
 * @param {Object} properties - Non-sensitive metadata
 */
export const trackEvent = (eventName, properties = {}) => {
    if (!hasAnalyticsConsent()) {
        // User opted out or has not granted analytics consent
        return;
    }

    const cleanProps = sanitizeProperties(properties);

    // If an external analytics provider is initialized (e.g. window.gtag or window.posthog), forward the event:
    if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', eventName, cleanProps);
    } else if (typeof window !== 'undefined' && window.posthog) {
        window.posthog.capture(eventName, cleanProps);
    } else {
        // Log in development only when debug is desired
        if (import.meta.env.DEV) {
            console.debug(`[Analytics (Consent Granted - Not Configured)]: ${eventName}`, cleanProps);
        }
    }
};

/**
 * Track a page view event.
 */
export const trackPageView = (path) => {
    trackEvent('page_view', { page_path: path });
};

/**
 * Standard public conversion events
 */
export const trackGetStarted = (source = 'navbar') => {
    trackEvent('get_started_clicked', { source });
};

export const trackGenerateTestSuite = (source = 'hero') => {
    trackEvent('generate_test_suite_clicked', { source });
};

export const trackDocsOpened = (docSection = 'general') => {
    trackEvent('docs_opened', { section: docSection });
};

export default {
    hasAnalyticsConsent,
    trackEvent,
    trackPageView,
    trackGetStarted,
    trackGenerateTestSuite,
    trackDocsOpened
};
