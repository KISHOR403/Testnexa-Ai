/**
 * TestNexa AI — Execution Method Feature Availability Configuration
 *
 * Central authoritative configuration governing which test execution engines
 * are currently available in production vs. in development / coming soon.
 */

const EXECUTION_METHODS = {
    manual: {
        id: 'manual',
        aliasIds: ['manual_execution'],
        displayName: 'Manual Execution',
        status: 'available', // 'available' | 'coming_soon'
        enabled: true,
        shortDesc: 'Interactive step verification by testers',
        description: 'Interactive step-by-step verification, observations, evidence, and defect logging by QA testers.',
        badgeLabel: 'Available',
        icon: 'UserCheck',
        capabilities: [
            'Interactive per-step verification (Pass, Fail, Block, Skip)',
            'Human tester observation recording with autosave',
            'Inline defect logging and evidence attachment',
            'Cross-session draft persistence and recovery'
        ]
    },
    playwright: {
        id: 'playwright',
        aliasIds: ['automated', 'playwright_browser', 'playwright_automation'],
        displayName: 'Playwright Automation',
        status: 'coming_soon',
        enabled: false,
        shortDesc: 'Automatically execute browser tests using Playwright',
        description: 'Automated browser testing with Playwright is being developed for TestNexa AI.',
        badgeLabel: 'Coming Soon',
        icon: 'Bot',
        modal: {
            title: 'Playwright Automation is Coming Soon',
            badge: 'COMING SOON',
            description: 'Automated browser testing with Playwright is being developed for TestNexa AI. Soon, you will be able to connect your application, configure automation scripts, execute tests, and review results directly from your workspace.',
            capabilities: [
                'Playwright automation',
                'Browser-based test execution',
                'Automated pass/fail results',
                'Screenshots and execution traces'
            ],
            primaryAction: 'Got it',
            secondaryAction: 'Notify me when available'
        }
    },
    api: {
        id: 'api',
        aliasIds: ['api_automation', 'http_api'],
        displayName: 'API Automation',
        status: 'coming_soon',
        enabled: false,
        shortDesc: 'Execute API test cases, validate responses, and inspect request and response results',
        description: 'Execute API test cases, validate responses, and inspect request and response results.',
        badgeLabel: 'Coming Soon',
        icon: 'Server',
        modal: {
            title: 'API Automation is Coming Soon',
            badge: 'COMING SOON',
            description: 'Execute API test cases, validate responses, and inspect request and response results.',
            capabilities: [
                'Direct HTTP & REST endpoint execution',
                'Automated status code and schema validation',
                'Request body & header assertion engine',
                'Real-time latency and payload inspection'
            ],
            primaryAction: 'Got it',
            secondaryAction: 'Notify me when available'
        }
    }
};

/**
 * Resolve an execution method by primary id or alias
 */
function getExecutionMethod(id) {
    if (!id) return EXECUTION_METHODS.manual;
    const clean = String(id).toLowerCase().trim();

    if (EXECUTION_METHODS[clean]) {
        return EXECUTION_METHODS[clean];
    }

    for (const key of Object.keys(EXECUTION_METHODS)) {
        const method = EXECUTION_METHODS[key];
        if (method.aliasIds && method.aliasIds.includes(clean)) {
            return method;
        }
    }

    return null;
}

/**
 * Check whether an execution method is currently enabled
 */
function isExecutionMethodEnabled(id) {
    const method = getExecutionMethod(id);
    return Boolean(method && method.enabled === true);
}

/**
 * Validate an execution method request for creation / trigger
 */
function validateExecutionMethod(id) {
    const method = getExecutionMethod(id);
    if (!method) {
        return {
            valid: false,
            code: 'INVALID_EXECUTION_METHOD',
            message: `Unsupported execution method "${id}". Supported methods: manual, playwright, api.`
        };
    }

    if (!method.enabled) {
        return {
            valid: false,
            code: 'FEATURE_UNAVAILABLE',
            message: `${method.displayName} is currently in development (Coming Soon) and cannot be executed. Only Manual Execution is supported in this release.`,
            method: {
                id: method.id,
                displayName: method.displayName,
                status: method.status
            }
        };
    }

    return { valid: true, method };
}

/**
 * Return array of all configured execution methods
 */
function getAllExecutionMethods() {
    return Object.values(EXECUTION_METHODS);
}

module.exports = {
    EXECUTION_METHODS,
    getExecutionMethod,
    isExecutionMethodEnabled,
    validateExecutionMethod,
    getAllExecutionMethods
};
