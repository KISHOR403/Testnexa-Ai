const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
    calculateRiskScore,
    isEligibleRiskCase,
    deriveRiskCategory,
    deriveLikelihoodAndImpact,
    deriveThreatStatement,
    computeRiskMitigation,
    normalizeCanonicalTestType,
    CANONICAL_TEST_TYPES,
    RISK_CATEGORIES,
    RISK_STATUSES,
    RISK_SOURCES
} = require('../src/services/riskScoring');

describe('Risk Scoring & Threat Derivation Engine', () => {

    describe('1. Risk Score and Severity Thresholds (5x5 Matrix)', () => {
        it('calculates Critical severity for scores >= 20', () => {
            assert.deepEqual(calculateRiskScore(5, 5), { likelihood: 5, impact: 5, score: 25, severity: 'critical' });
            assert.deepEqual(calculateRiskScore(4, 5), { likelihood: 4, impact: 5, score: 20, severity: 'critical' });
            assert.deepEqual(calculateRiskScore(5, 4), { likelihood: 5, impact: 4, score: 20, severity: 'critical' });
        });

        it('calculates High severity for scores between 12 and 19', () => {
            assert.deepEqual(calculateRiskScore(3, 5), { likelihood: 3, impact: 5, score: 15, severity: 'high' });
            assert.deepEqual(calculateRiskScore(4, 4), { likelihood: 4, impact: 4, score: 16, severity: 'high' });
            assert.deepEqual(calculateRiskScore(3, 4), { likelihood: 3, impact: 4, score: 12, severity: 'high' });
            assert.deepEqual(calculateRiskScore(4, 3), { likelihood: 4, impact: 3, score: 12, severity: 'high' });
        });

        it('calculates Medium severity for scores between 6 and 11', () => {
            assert.deepEqual(calculateRiskScore(3, 3), { likelihood: 3, impact: 3, score: 9, severity: 'medium' });
            assert.deepEqual(calculateRiskScore(2, 5), { likelihood: 2, impact: 5, score: 10, severity: 'medium' });
            assert.deepEqual(calculateRiskScore(2, 3), { likelihood: 2, impact: 3, score: 6, severity: 'medium' });
            assert.deepEqual(calculateRiskScore(3, 2), { likelihood: 3, impact: 2, score: 6, severity: 'medium' });
        });

        it('calculates Low severity for scores < 6', () => {
            assert.deepEqual(calculateRiskScore(1, 5), { likelihood: 1, impact: 5, score: 5, severity: 'low' });
            assert.deepEqual(calculateRiskScore(2, 2), { likelihood: 2, impact: 2, score: 4, severity: 'low' });
            assert.deepEqual(calculateRiskScore(1, 1), { likelihood: 1, impact: 1, score: 1, severity: 'low' });
        });

        it('clamps out-of-range likelihood and impact values to 1..5', () => {
            assert.deepEqual(calculateRiskScore(0, 10), { likelihood: 1, impact: 5, score: 5, severity: 'low' });
            assert.deepEqual(calculateRiskScore(-5, 99), { likelihood: 1, impact: 5, score: 5, severity: 'low' });
            assert.deepEqual(calculateRiskScore(9, 9), { likelihood: 5, impact: 5, score: 25, severity: 'critical' });
        });
    });

    describe('2. Test Case Eligibility for Risk Derivation', () => {
        it('rejects functional happy-path test cases unconditionally', () => {
            const happyPath = {
                id: 'TC_FUNC_LOGIN_001',
                title: 'Successful Login with Valid Credentials',
                type: 'Functional',
                priority: 'High',
                severity: 'Critical'
            };
            assert.equal(isEligibleRiskCase(happyPath), false, 'Happy paths must NEVER create risk vectors');

            const normalFlow = {
                id: 'TC_FUNC_002',
                title: 'User completes standard checkout',
                type: 'Functional',
                priority: 'High'
            };
            assert.equal(isEligibleRiskCase(normalFlow), false);
        });

        it('accepts negative, security, edge, and non-functional cases', () => {
            const neg = {
                id: 'TC_NEG_001',
                title: 'Invalid Password Attempt with Rate Limit Trigger',
                type: 'Negative',
                priority: 'High'
            };
            assert.equal(isEligibleRiskCase(neg), true);

            const sec = {
                id: 'TC_SEC_001',
                title: 'SQL Injection in Username Field',
                type: 'Security',
                priority: 'High'
            };
            assert.equal(isEligibleRiskCase(sec), true);

            const edge = {
                id: 'TC_EDGE_001',
                title: 'Concurrent session invalidation on password change',
                type: 'Edge Case',
                priority: 'Medium'
            };
            assert.equal(isEligibleRiskCase(edge), true);

            const nonFunc = {
                id: 'TC_NF_001',
                title: 'Authentication Response Latency Under Load',
                type: 'Non-Functional',
                priority: 'High'
            };
            assert.equal(isEligibleRiskCase(nonFunc), true);
        });
    });

    describe('3. Risk Category Extraction from Keywords', () => {
        it('classifies rate limiting abuse correctly', () => {
            const tc = { title: 'Brute-force attack triggers 429 Too Many Requests rate limit' };
            assert.equal(deriveRiskCategory(tc), 'rate_limiting');
        });

        it('classifies session management gaps correctly', () => {
            const tc = { title: 'Expired JWT token reuse rejected immediately' };
            assert.equal(deriveRiskCategory(tc), 'session');
        });

        it('classifies authorization & IDOR correctly', () => {
            const tc = { title: 'Unauthorized user attempts to access tenant resources via IDOR' };
            assert.equal(deriveRiskCategory(tc), 'authorization');
        });

        it('classifies input validation & injection correctly', () => {
            const tc = { title: 'Payload with SQL injection and special character boundary' };
            assert.equal(deriveRiskCategory(tc), 'input_validation');
        });

        it('classifies data exposure & masking correctly', () => {
            const tc = { title: 'Password characters masked to prevent shoulder surfing' };
            assert.equal(deriveRiskCategory(tc), 'data_exposure');
        });
    });

    describe('4. Mitigation Status Computation', () => {
        it('returns unmitigated when no test cases are linked', () => {
            assert.equal(computeRiskMitigation([]), 'unmitigated');
            assert.equal(computeRiskMitigation(null), 'unmitigated');
        });

        it('returns tests_planned when tests exist but none are approved', () => {
            const cases = [
                { id: 'TC_01', approval_status: 'pending' },
                { id: 'TC_02', approval_status: 'rejected' }
            ];
            assert.equal(computeRiskMitigation(cases, false), 'tests_planned');
        });

        it('returns tests_approved when at least one test is approved', () => {
            const cases = [
                { id: 'TC_01', approval_status: 'pending' },
                { id: 'TC_02', approval_status: 'approved' }
            ];
            assert.equal(computeRiskMitigation(cases, false), 'tests_approved');
        });

        it('guarantees verified is false when execution flag is off', () => {
            const cases = [
                { id: 'TC_01', approval_status: 'approved', lastExecutionStatus: 'passed' }
            ];
            assert.equal(computeRiskMitigation(cases, false), 'tests_approved');
        });
    });

    describe('5. Test Type Normalization Consistency', () => {
        it('enforces ID prefix-to-canonical type mapping strictly', () => {
            assert.equal(normalizeCanonicalTestType({ id: 'TC_FUNC_LOGIN_001', type: 'Security' }), 'functional');
            assert.equal(normalizeCanonicalTestType({ id: 'TC_NEG_001', type: 'Functional' }), 'negative');
            assert.equal(normalizeCanonicalTestType({ id: 'TC_SEC_001', type: 'Functional' }), 'security');
            assert.equal(normalizeCanonicalTestType({ id: 'TC_EDGE_001', type: 'Security' }), 'edge');
            assert.equal(normalizeCanonicalTestType({ id: 'TC_NF_001', type: 'Functional' }), 'non_functional');
            assert.equal(normalizeCanonicalTestType({ id: 'TC_API_001', type: 'Functional' }), 'api');
        });
    });
});
