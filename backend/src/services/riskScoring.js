/**
 * Canonical Risk Scoring, Threat Derivation & Test Type Normalization Service
 * Single source of truth for:
 * - 5x5 Likelihood x Impact scoring and severity threshold calculations
 * - Test case eligibility for risk derivation (strictly negative, security, edge, non_functional)
 * - Deterministic threat synthesis from scenario text
 * - Category classification from security/QA keywords
 * - Shared canonical test types across suite detail, test cases, intelligence, and risks
 */

// Shared canonical test type enum
const CANONICAL_TEST_TYPES = Object.freeze([
    'functional',
    'negative',
    'edge',
    'non_functional',
    'security',
    'api'
]);

// Allowed risk categories
const RISK_CATEGORIES = Object.freeze([
    'authentication',
    'authorization',
    'session',
    'input_validation',
    'data_exposure',
    'rate_limiting',
    'availability',
    'performance',
    'other'
]);

// Allowed risk statuses
const RISK_STATUSES = Object.freeze([
    'open',
    'mitigating',
    'accepted',
    'closed'
]);

// Allowed risk sources
const RISK_SOURCES = Object.freeze([
    'derived',
    'generated',
    'manual'
]);

// Mitigation states
const MITIGATION_STATES = Object.freeze([
    'unmitigated',
    'tests_planned',
    'tests_approved',
    'verified'
]);

/**
 * Normalizes test type across all endpoints to one shared enum.
 * Guarantees TC_FUNC_* is functional, TC_SEC_* is security, etc.
 */
function normalizeCanonicalTestType(tc) {
    if (!tc) return 'functional';
    const raw = tc.raw || tc;
    const id = String(tc.id || tc.testCaseId || raw.id || raw.testCaseId || '').trim();
    const title = String(tc.title || tc.testScenario || tc.scenario || raw.title || raw.scenario || '').trim();
    const rawType = String(tc.type || raw.type || tc.category || raw.category || '').toLowerCase().trim();

    // 1. Strict ID Prefix rules have highest precedence
    if (/^TC[_-]?FUNC/i.test(id) || /(?:^|_)func(?:_|$)/i.test(id)) {
        return 'functional';
    }
    if (/^TC[_-]?NEG/i.test(id) || /(?:^|_)neg(?:_|$)/i.test(id)) {
        return 'negative';
    }
    if (/^TC[_-]?EDGE/i.test(id) || /(?:^|_)edge(?:_|$)/i.test(id)) {
        return 'edge';
    }
    if (/^TC[_-]?SEC/i.test(id) || /(?:^|_)sec(?:_|$)/i.test(id)) {
        return 'security';
    }
    if (/^TC[_-]?API/i.test(id) || /(?:^|_)api(?:_|$)/i.test(id)) {
        return 'api';
    }
    if (/^TC[_-]?NF/i.test(id) || /(?:^|_)nf(?:_|$)/i.test(id) || /^TC[_-]?PERF/i.test(id)) {
        return 'non_functional';
    }

    // 2. Happy-path functional titles must NEVER be classified as security
    if (/login|auth|sign\s*in/i.test(title) && /success|valid|happy\s*path/i.test(title)) {
        return 'functional';
    }

    // 3. Match from string content
    if (rawType.includes('api')) return 'api';
    if (rawType.includes('sec') || (rawType.includes('auth') && (rawType.includes('vuln') || rawType.includes('inject') || rawType.includes('csrf')))) return 'security';
    if (rawType.includes('neg')) return 'negative';
    if (rawType.includes('edge')) return 'edge';
    if (rawType.includes('non') || rawType.includes('perf') || rawType.includes('load') || rawType.includes('stress') || rawType.includes('accessib')) return 'non_functional';

    return 'functional';
}

/**
 * Calculates risk score and severity from likelihood (1-5) and impact (1-5).
 * Severity thresholds:
 * - Critical: >= 20
 * - High: 12 - 19
 * - Medium: 6 - 11
 * - Low: < 6
 */
function calculateRiskScore(likelihood, impact) {
    const l = Math.max(1, Math.min(5, parseInt(likelihood, 10) || 1));
    const i = Math.max(1, Math.min(5, parseInt(impact, 10) || 1));
    const score = l * i;

    let severity = 'low';
    if (score >= 20) {
        severity = 'critical';
    } else if (score >= 12) {
        severity = 'high';
    } else if (score >= 6) {
        severity = 'medium';
    } else {
        severity = 'low';
    }

    return { likelihood: l, impact: i, score, severity };
}

/**
 * Validates if a test case is eligible to produce a derived risk vector.
 * STRICT RULE: Only negative, security, edge, or non_functional cases.
 * Functional happy paths are NEVER eligible.
 */
function isEligibleRiskCase(tc) {
    if (!tc || typeof tc !== 'object') return false;
    const type = normalizeCanonicalTestType(tc);

    // Exclude functional happy paths and API checklist cases
    if (type === 'functional' || type === 'api') {
        return false;
    }

    // Must have a meaningful title/scenario
    const title = String(tc.title || tc.scenario || tc.testScenario || '').trim();
    if (!title || title.length < 5) {
        return false;
    }

    // Reject obvious happy-path wording
    if (/successful|valid credentials|happy path|normal flow/i.test(title)) {
        return false;
    }

    return ['negative', 'security', 'edge', 'non_functional'].includes(type);
}

/**
 * Deterministically categorizes a risk from test case keywords.
 */
function deriveRiskCategory(tc) {
    const text = [
        tc.title || '',
        tc.scenario || '',
        tc.testScenario || '',
        tc.description || '',
        tc.expectedResult || '',
        Array.isArray(tc.steps) ? tc.steps.map(s => typeof s === 'string' ? s : `${s.action || ''} ${s.expected || ''}`).join(' ') : ''
    ].join(' ').toLowerCase();

    // 1. Rate Limiting & Abuse
    if (/rate\s*limit|throttle|brute\s*force|429|too\s*many\s*requests|flood|burst|enumeration/i.test(text)) {
        return 'rate_limiting';
    }

    // 2. Session Management
    if (/session|token\s*reuse|token\s*expiry|expired\s*token|hijack|fixat|jwt\s*expir|logout|concurrent\s*session/i.test(text)) {
        return 'session';
    }

    // 3. Authorization & Access Control
    if (/privilege|idor|permission|unauthorized|forbidden|403|access\s*control|tamper|bypass\s*auth/i.test(text)) {
        return 'authorization';
    }

    // 4. Input Validation & Injection
    if (/injection|sql|xss|sanitize|script|malformed|payload|overflow|special\s*char|null\s*byte|format\s*string/i.test(text)) {
        return 'input_validation';
    }

    // 5. Data Exposure & Privacy
    if (/leak|mask|plain\s*text|shoulder\s*surf|sensitive|exposure|pii|credentials\s*in\s*url|timing\s*attack/i.test(text)) {
        return 'data_exposure';
    }

    // 6. Authentication
    if (/auth|password|credential|login|mfa|2fa|reset\s*link|single-use\s*token/i.test(text)) {
        return 'authentication';
    }

    // 7. Performance & Latency
    if (/latency|timeout|p99|response\s*time|throughput|slow|bottleneck/i.test(text)) {
        return 'performance';
    }

    // 8. Availability & DoS
    if (/dos|denial\s*of\s*service|crash|deadlock|hang|unresponsive/i.test(text)) {
        return 'availability';
    }

    return 'other';
}

/**
 * Maps test case priority and severity to Likelihood (1-5) and Impact (1-5).
 */
function deriveLikelihoodAndImpact(tc) {
    const priority = String(tc.priority || '').toLowerCase().trim();
    const severity = String(tc.severity || '').toLowerCase().trim();
    const type = normalizeCanonicalTestType(tc);

    let likelihood = 3;
    let impact = 3;

    // Security vulnerabilities carry high impact by default
    if (type === 'security') {
        impact = 4;
        likelihood = (priority === 'high' || priority === 'critical') ? 4 : 3;
        if (severity === 'critical') {
            impact = 5;
            likelihood = 4; // 4 * 5 = 20 -> Critical
        }
    } else if (type === 'negative') {
        if (priority === 'high' || priority === 'critical') {
            likelihood = 4;
            impact = (severity === 'critical') ? 4 : 3; // 4 * 3 = 12 -> High
        } else if (priority === 'medium') {
            likelihood = 3;
            impact = 3; // 3 * 3 = 9 -> Medium
        } else {
            likelihood = 2;
            impact = 2; // 2 * 2 = 4 -> Low
        }
    } else if (type === 'edge') {
        if (priority === 'high' || priority === 'critical') {
            likelihood = 3;
            impact = 4; // 3 * 4 = 12 -> High
        } else if (priority === 'medium') {
            likelihood = 2;
            impact = 3; // 2 * 3 = 6 -> Medium
        } else {
            likelihood = 2;
            impact = 2; // 2 * 2 = 4 -> Low
        }
    } else if (type === 'non_functional') {
        if (priority === 'high' || priority === 'critical') {
            likelihood = 3;
            impact = 4; // 3 * 4 = 12 -> High
        } else {
            likelihood = 2;
            impact = 3; // 2 * 3 = 6 -> Medium
        }
    }

    return calculateRiskScore(likelihood, impact);
}

/**
 * Transforms test case scenario / title into an honest, professional threat description.
 * Formulates "what could go wrong if unmitigated" instead of restating the test step.
 */
function deriveThreatStatement(tc) {
    const title = String(tc.title || tc.testScenario || tc.scenario || '').trim();
    const expected = String(tc.expectedResult || tc.expected || '').trim();
    const category = deriveRiskCategory(tc);

    // Threat templates based on risk category
    switch (category) {
        case 'rate_limiting':
            return `Unbounded automated requests could allow brute-force credential stuffing or denial of service against sensitive endpoints (${title}).`;
        case 'session':
            return `Session tokens that fail to invalidate upon expiry or reuse allow persistent unauthorized account takeover (${title}).`;
        case 'authorization':
            return `Improper authorization controls could allow unauthorized users to access, modify, or tamper with protected tenant data (${title}).`;
        case 'input_validation':
            return `Malformed or malicious input payloads bypass client validation, exposing internal services to injection attacks or unexpected crashes (${title}).`;
        case 'data_exposure':
            return `Sensitive authentication secrets or user directory information could be leaked to unauthorized parties or eavesdroppers (${title}).`;
        case 'authentication':
            return `Flaws in the authentication handshake allow unauthorized individuals to bypass credential verification (${title}).`;
        case 'availability':
            return `System resources could become exhausted under edge conditions, causing service disruption for active users (${title}).`;
        case 'performance':
            return `Excessive processing overhead under non-functional stress degrades API responsiveness below acceptable operational thresholds (${title}).`;
        default:
            return expected
                ? `Failure to enforce boundary checks allows abnormal execution state: ${expected}`
                : `Unhandled boundary condition in feature workflow: ${title}`;
    }
}

/**
 * Computes mitigation status for a risk:
 * - unmitigated: 0 linked test cases
 * - tests_planned: linked test cases exist, but none approved
 * - tests_approved: at least one linked test case is approved
 * - verified: all linked test cases passed in latest run (always false while FEATURE_TEST_RUNS=false)
 */
function computeRiskMitigation(linkedCases = [], isExecutionEnabled = false) {
    if (!Array.isArray(linkedCases) || linkedCases.length === 0) {
        return 'unmitigated';
    }

    const hasApproved = linkedCases.some(tc => {
        const app = String(tc.approval_status || tc.approvalStatus || (tc.is_approved ? 'approved' : '')).toLowerCase();
        return app === 'approved';
    });

    if (isExecutionEnabled) {
        const allPassed = linkedCases.every(tc => tc.lastExecutionStatus === 'passed');
        if (allPassed) return 'verified';
    }

    return hasApproved ? 'tests_approved' : 'tests_planned';
}

module.exports = {
    CANONICAL_TEST_TYPES,
    RISK_CATEGORIES,
    RISK_STATUSES,
    RISK_SOURCES,
    MITIGATION_STATES,
    normalizeCanonicalTestType,
    calculateRiskScore,
    isEligibleRiskCase,
    deriveRiskCategory,
    deriveLikelihoodAndImpact,
    deriveThreatStatement,
    computeRiskMitigation
};
