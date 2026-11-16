import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    computeCanonicalSuiteMetrics,
    validateAndRepairTestCase,
    sanitizeCredentialPlaceholders,
    extractSuiteCases
} from '../../frontend/utils/testSuiteSelectors.js';

describe('Problem 2: Data Inconsistency & Canonical Counts Agreement', () => {
    it('canonical counts agree across header, stats strip, review progress and card (no +5 divergence)', () => {
        // A test suite with 19 direct test cases (12 functional, 4 negative, 3 edge)
        // plus legacy apiChecklist items that previously caused the +5 divergence
        const mockDirectCases = Array.from({ length: 19 }, (_, i) => ({
            id: `TC_FUNC_${String(i + 1).padStart(3, '0')}`,
            title: `Functional Scenario ${i + 1}`,
            type: i < 12 ? 'Functional' : i < 16 ? 'Negative' : 'Edge Case',
            priority: i % 3 === 0 ? 'High' : 'Medium',
            severity: 'Major',
            status: i < 7 ? 'Approved' : 'Needs Review',
            requirementId: `REQ_${(i % 4) + 1}`
        }));

        const mockSuiteData = {
            id: 'suite-user-auth',
            testSuiteName: 'User Authentication',
            description: 'Authentication test suite specification',
            testCases: mockDirectCases,
            // Legacy/duplicate categorized keys that previously caused 19 + 5 = 24 bug:
            functional: mockDirectCases.slice(0, 12),
            negative: mockDirectCases.slice(12, 16),
            edge: mockDirectCases.slice(16, 19),
            apiChecklist: [
                { id: 'CHK_1', title: 'API Check 1' },
                { id: 'CHK_2', title: 'API Check 2' },
                { id: 'CHK_3', title: 'API Check 3' },
                { id: 'CHK_4', title: 'API Check 4' },
                { id: 'CHK_5', title: 'API Check 5' }
            ]
        };

        const mockRuns = [
            {
                id: 'run-001',
                suiteId: 'suite-user-auth',
                status: 'completed',
                summary: { passed: 15, failed: 4 }
            }
        ];

        const metrics = computeCanonicalSuiteMetrics(mockSuiteData, mockRuns);

        // Header, Stats strip, Review progress, and Card must all see exactly 19 cases!
        assert.equal(metrics.totalCases, 19, 'Total test cases must be exactly 19 (no +5 apiChecklist gap)');
        assert.equal(metrics.tests.length, 19, 'Extracted tests array length must be 19');
        assert.equal(metrics.approvedCases, 7, 'Approved test cases must be 7');
        assert.equal(metrics.highPriorityCases, 7, 'High priority cases count must match');
        assert.equal(metrics.linkedRequirementsCount, 4, 'Linked requirements count must match');
        assert.equal(metrics.runsCount, 1, 'Runs count must be 1');
        assert.ok(metrics.coverage > 0, 'Coverage percentage must be calculated');

        // Review progress math check
        const progressPct = (metrics.approvedCases / metrics.totalCases) * 100;
        assert.equal(Math.round(progressPct), 37, 'Review progress should be 37%');
    });

    it('extractSuiteCases deduplicates referenced cases and categorized lists', () => {
        const data = {
            testCases: [
                { id: 'TC_001', title: 'Case 1' },
                { id: 'TC_002', title: 'Case 2' }
            ],
            functional: [
                { id: 'TC_001', title: 'Case 1' }
            ]
        };
        const cases = extractSuiteCases(data);
        assert.equal(cases.length, 2, 'Should not duplicate cases between testCases and functional');
    });
});

describe('Problem 3: Wrong Test Types & Schema Validation', () => {
    it('TC_FUNC_LOGIN_001 "Successful Login with Valid Credentials" is Functional and Major (never Security/Critical)', () => {
        const rawCase = {
            id: 'TC_FUNC_LOGIN_001',
            title: 'Successful Login with Valid Credentials',
            type: 'Security', // Model mistakenly returned Security
            severity: 'Critical', // Model mistakenly returned Critical
            priority: 'High',
            steps: [
                { action: 'Navigate to login and submit valid credentials', expected: 'Dashboard loaded' }
            ]
        };

        const repaired = validateAndRepairTestCase(rawCase);

        assert.equal(repaired.type, 'Functional', 'ID prefix TC_FUNC_* must normalize type to Functional');
        assert.equal(repaired.severity, 'Major', 'Standard happy-path login scenario must NOT have Critical severity');
    });

    it('enforces ID prefix-to-type agreement across test categories', () => {
        const testScenarios = [
            { id: 'TC_FUNC_002', rawType: 'Edge Case', expectedType: 'Functional' },
            { id: 'TC_NEG_001', rawType: 'Functional', expectedType: 'Negative' },
            { id: 'TC_EDGE_003', rawType: 'Security', expectedType: 'Edge Case' },
            { id: 'TC_SEC_001', rawType: 'Functional', expectedType: 'Security' },
            { id: 'TC_API_005', rawType: 'Functional', expectedType: 'API' }
        ];

        for (const item of testScenarios) {
            const repaired = validateAndRepairTestCase({
                id: item.id,
                title: 'Scenario verification',
                type: item.rawType,
                severity: 'Minor'
            });
            assert.equal(repaired.type, item.expectedType, `Prefix ${item.id} must map to ${item.expectedType}`);
        }
    });

    it('enforces severity allow-list: Critical, Major, Minor, Trivial', () => {
        const invalidSeverityCase = {
            id: 'TC_FUNC_999',
            title: 'Profile Update',
            type: 'Functional',
            severity: 'URGENT_BLOCKER_LEVEL_5' // Invalid severity
        };

        const repaired = validateAndRepairTestCase(invalidSeverityCase);
        assert.ok(['Critical', 'Major', 'Minor', 'Trivial'].includes(repaired.severity));
    });
});

describe('Problem 4: Sensitive-Looking Test Data Sanitization', () => {
    it('sanitizes realistic credentials in preconditions, steps and expected results to placeholders', () => {
        const inputCase = {
            id: 'TC_FUNC_005',
            title: 'Authentication verification',
            type: 'Functional',
            preconditions: [
                "User exists with password 'SecurePass123!' and email 'admin@example.com'"
            ],
            testData: {
                password: 'Password999!',
                token: 'Bearer eyJhbGciOiJIUzI1NiIsIn...'
            },
            steps: [
                {
                    action: "Enter email test.user@gmail.com and password ValidPass123!",
                    expected: "Login succeeds for test.user@gmail.com"
                },
                {
                    action: "Try invalid password 'WrongPass999' with card 4111222233334444",
                    expected: "Card rejected"
                }
            ]
        };

        const sanitized = validateAndRepairTestCase(inputCase);

        // Preconditions check
        assert.ok(!JSON.stringify(sanitized.preconditions).includes('SecurePass123!'), 'Preconditions must not contain SecurePass123!');
        assert.ok(JSON.stringify(sanitized.preconditions).includes('<valid_password>'), 'Preconditions should use <valid_password>');

        // Steps check
        assert.ok(!JSON.stringify(sanitized.steps).includes('ValidPass123!'), 'Steps must not contain ValidPass123!');
        assert.ok(!JSON.stringify(sanitized.steps).includes('WrongPass999'), 'Steps must not contain WrongPass999');
        assert.ok(JSON.stringify(sanitized.steps).includes('<valid_password>') || JSON.stringify(sanitized.steps).includes('<invalid_password>'), 'Steps should use password placeholders');
        assert.ok(!JSON.stringify(sanitized.steps).includes('4111222233334444'), 'Steps must not contain real credit card numbers');
        assert.ok(JSON.stringify(sanitized.steps).includes('<mock_credit_card>'), 'Steps should use <mock_credit_card>');
    });

    it('sanitizeCredentialPlaceholders string replacer operates accurately', () => {
        const text = "password: 'Secret123!' with email user@corp.io and test card 4242424242424242";
        const result = sanitizeCredentialPlaceholders(text);
        assert.ok(!result.includes('Secret123!'));
        assert.ok(!result.includes('4242424242424242'));
        assert.ok(result.includes('<valid_password>') || result.includes('<password>'));
    });
});
