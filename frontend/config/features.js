import { useState, useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

// Initial fallback values derived from Vite build-time environment variables
const envTestRuns = import.meta.env.VITE_FEATURE_TEST_RUNS;
const initialTestRunsEnabled = envTestRuns === 'true' || envTestRuns === '1';

export const features = {
    testRuns: {
        enabled: initialTestRunsEnabled,
        title: 'Test execution',
        description: 'Manual and Playwright runs are currently in development. You can already create test suites, link requirements, and trace coverage.'
    }
};

const listeners = new Set();

const notifyListeners = () => {
    listeners.forEach((listener) => {
        try {
            listener();
        } catch (err) {
            console.error('Error notifying feature flag listener:', err);
        }
    });
};

/**
 * Fetch runtime feature flags from backend (source of truth) with fallback to build-time env vars.
 */
export const fetchRuntimeFeatures = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/features`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) return features;

        const payload = await response.json();
        const incoming = payload.features || payload.data || payload;

        if (incoming && typeof incoming === 'object') {
            if (incoming.testRuns !== undefined) {
                const incomingVal = incoming.testRuns;
                features.testRuns = {
                    ...features.testRuns,
                    ...(typeof incomingVal === 'object' ? incomingVal : { enabled: Boolean(incomingVal) })
                };
            }
            notifyListeners();
        }
    } catch (err) {
        // Safe silent fallback to default build-time features
    }
    return features;
};

// Initiate non-blocking background fetch on startup
if (typeof window !== 'undefined') {
    fetchRuntimeFeatures();
}

/**
 * React hook to consume a feature flag.
 * @param {'testRuns'|string} featureName
 * @returns {{ enabled: boolean, info: { enabled: boolean, title: string, description: string } }}
 */
export const useFeature = (featureName) => {
    const [, setTick] = useState(0);

    useEffect(() => {
        const listener = () => setTick(t => t + 1);
        listeners.add(listener);
        return () => listeners.delete(listener);
    }, []);

    const target = features[featureName] || {
        enabled: true,
        title: featureName,
        description: ''
    };

    return {
        enabled: Boolean(target.enabled),
        info: target
    };
};

export default features;
