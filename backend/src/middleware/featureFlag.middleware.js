/**
 * Feature flag middleware and helper functions.
 * Manages runtime and environment-based feature availability.
 */

const FEATURE_CONFIG = {
    testRuns: {
        envVar: 'FEATURE_TEST_RUNS',
        default: false,
        title: 'Test execution',
        description: 'Manual and Playwright runs are currently in development. You can already create test suites, link requirements, and trace coverage.',
        disabledMessage: 'Test execution is coming soon.'
    }
};

const isFeatureEnabled = (featureName) => {
    const feature = FEATURE_CONFIG[featureName];
    if (!feature) return true; // Unregistered features remain unaffected

    const envVal = process.env[feature.envVar];
    if (envVal !== undefined && envVal !== null) {
        return envVal === 'true' || envVal === '1';
    }

    return feature.default;
};

const getFeatureInfo = (featureName) => {
    const feature = FEATURE_CONFIG[featureName];
    if (!feature) {
        return { enabled: true, title: featureName, description: '' };
    }
    return {
        enabled: isFeatureEnabled(featureName),
        title: feature.title,
        description: feature.description
    };
};

const getAllFeatures = () => {
    const result = {};
    for (const [key, config] of Object.entries(FEATURE_CONFIG)) {
        result[key] = {
            enabled: isFeatureEnabled(key),
            title: config.title,
            description: config.description
        };
    }
    return result;
};

const requireFeature = (featureName) => {
    return (req, res, next) => {
        if (!isFeatureEnabled(featureName)) {
            const config = FEATURE_CONFIG[featureName];
            return res.status(501).json({
                code: 'FEATURE_DISABLED',
                feature: featureName,
                message: config?.disabledMessage || `${featureName} is coming soon.`
            });
        }
        next();
    };
};

module.exports = {
    isFeatureEnabled,
    getFeatureInfo,
    getAllFeatures,
    requireFeature,
    FEATURE_CONFIG
};
