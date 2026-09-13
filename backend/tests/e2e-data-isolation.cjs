const { chromium } = require('playwright');
const assert = require('assert');

(async () => {
    console.log('🚀 Starting E2E Multi-User Data Isolation Verification...\n');
    const browser = await chromium.launch({ headless: true });
    const contextB = await browser.newContext();

    try {
        const timestamp = Date.now();
        const userAEmail = `user_a_${timestamp}@example.com`;
        const userBEmail = `user_b_${timestamp}@example.com`;
        const password = 'Password123!';

        // 1. Create User A and User B
        console.log('[Setup] Registering User A and User B via API...');
        const regARes = await fetch('http://localhost:5000/api/v1/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'User A', email: userAEmail, password })
        });
        const regAData = await regARes.json();
        assert.strictEqual(regAData.success, true);
        const tokenA = regAData.token;

        const regBRes = await fetch('http://localhost:5000/api/v1/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'User B', email: userBEmail, password })
        });
        const regBData = await regBRes.json();
        assert.strictEqual(regBData.success, true);
        const tokenB = regBData.token;
        console.log('✔ User A and User B registered.\n');

        // 2. User A creates a real test suite in their workspace
        console.log('[Setup] Creating a private Test Suite in User A workspace...');
        const createSuiteRes = await fetch('http://localhost:5000/api/v1/test-suites', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tokenA}`
            },
            body: JSON.stringify({
                title: 'User A Private Enterprise Suite',
                requirement: 'Proprietary banking transaction reconciliation pipeline.',
                context: 'web',
                depth: 'Standard'
            })
        });
        const createSuiteData = await createSuiteRes.json();
        assert.strictEqual(createSuiteData.success, true);
        const suiteAId = createSuiteData.data._id;

        // Add suiteData to User A's suite
        await fetch(`http://localhost:5000/api/v1/test-suites/${suiteAId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tokenA}`
            },
            body: JSON.stringify({
                status: 'Generated',
                suiteData: {
                    testSuiteName: 'User A Private Enterprise Suite',
                    feature: 'Banking Reconciliation',
                    functional: [
                        { id: 'TC-001', title: 'Verify account ledger balance matches ledger entry', priority: 'High', severity: 'Critical' }
                    ],
                    negative: [],
                    edge: [],
                    nonFunctional: []
                },
                summary: { total: 1, functional: 1, negative: 0, edge: 0, nonFunctional: 0, highPriority: 1 },
                quality: { coverageConfidence: 98 }
            })
        });
        console.log(`✔ Suite A created with ID: ${suiteAId}\n`);

        // 3. Log in as brand-new User B in Browser
        console.log('[Test 1] Brand new User B navigates to All Test Suites (/app/test-suites)...');
        const pageB = await contextB.newPage();
        await pageB.goto('http://localhost:5173/login');
        await pageB.waitForLoadState('networkidle');

        // Fill login form
        await pageB.fill('input[type="email"]', userBEmail);
        await pageB.fill('input[type="password"]', password);
        await pageB.click('button[type="submit"]');

        // Wait for workspace or app layout
        await pageB.waitForURL(/.*\/app\/workspace.*/, { timeout: 10000 });
        console.log('  -> User B logged in successfully.');

        // Navigate to All Test Suites
        await pageB.goto('http://localhost:5173/app/test-suites');
        await pageB.waitForLoadState('networkidle');
        await pageB.waitForTimeout(1000); // Wait for history hooks

        const bodyText = await pageB.textContent('body');

        // Verify Empty State is rendered
        assert.ok(bodyText.includes('No test suites yet'), 'Page must display "No test suites yet" empty state');
        assert.ok(bodyText.includes('+ New Test Suite'), 'Empty state must have "+ New Test Suite" CTA');

        // Verify Demo Suites are NOT in DOM
        assert.strictEqual(bodyText.includes('REQ-001'), false, 'REQ-001 must NOT appear for new user');
        assert.strictEqual(bodyText.includes('REQ-002'), false, 'REQ-002 must NOT appear for new user');
        assert.strictEqual(bodyText.includes('REQ-003'), false, 'REQ-003 must NOT appear for new user');
        assert.strictEqual(bodyText.includes('Password Reset Suite'), false, 'Password Reset Suite must NOT appear');
        assert.strictEqual(bodyText.includes('Stripe 3D Secure Checkout'), false, 'Stripe Checkout must NOT appear');
        assert.strictEqual(bodyText.includes('User A Private Enterprise Suite'), false, 'User A suite must NOT leak to User B');
        console.log('✔ Test 1 passed: New User B sees sleek empty state with 0 suites and zero demo data.\n');

        // 4. Test Coverage page empty state
        console.log('[Test 2] User B navigates to Requirement Coverage (/app/coverage)...');
        await pageB.goto('http://localhost:5173/app/coverage');
        await pageB.waitForLoadState('networkidle');
        const covText = await pageB.textContent('body');

        assert.ok(covText.includes('0%') || covText.includes('0.0%'), 'Coverage must show 0% for user with no suites');
        assert.ok(covText.includes('No requirement coverage data yet'), 'Coverage must display empty state');
        assert.strictEqual(covText.includes('REQ-001'), false, 'REQ-001 must NOT appear in Coverage');
        assert.strictEqual(covText.includes('REQ-005'), false, 'REQ-005 must NOT appear in Coverage');
        console.log('✔ Test 2 passed: Coverage page properly displays 0% and empty state.\n');

        // 5. Test Risks page empty state
        console.log('[Test 3] User B navigates to Risk Vectors (/app/risks)...');
        await pageB.goto('http://localhost:5173/app/risks');
        await pageB.waitForLoadState('networkidle');
        const riskText = await pageB.textContent('body');

        assert.ok(riskText.includes('No risk vectors detected yet'), 'Risks page must display empty state');
        assert.strictEqual(riskText.includes('Expired Token Invalidation Gap'), false, 'Hardcoded demo risks must not appear');
        console.log('✔ Test 3 passed: Risks page properly displays empty state.\n');

        // 6. Test Traceability page empty state
        console.log('[Test 4] User B navigates to Traceability Graph (/app/traceability)...');
        await pageB.goto('http://localhost:5173/app/traceability');
        await pageB.waitForLoadState('networkidle');
        const traceText = await pageB.textContent('body');

        assert.ok(traceText.includes('No traceability graph available yet'), 'Traceability page must display empty state');
        assert.strictEqual(traceText.includes('User Password Recovery Specification'), false, 'Hardcoded demo trace must not appear');
        console.log('✔ Test 4 passed: Traceability page properly displays empty state.\n');

        // 7. Cross-User Suite Access Denied by URL
        console.log('[Test 5] User B attempts to access User A suite directly by URL (/app/test-suites/:suiteAId)...');
        await pageB.goto(`http://localhost:5173/app/test-suites/${suiteAId}`);
        await pageB.waitForLoadState('networkidle');
        await pageB.waitForTimeout(1000);
        const detailText = await pageB.textContent('body');

        assert.ok(
            detailText.includes('Test Suite Not Found') || detailText.includes('access denied'),
            'Must display Test Suite Not Found / access denied screen'
        );
        assert.strictEqual(detailText.includes('Banking Reconciliation'), false, 'User A content must NOT be exposed');
        assert.strictEqual(detailText.includes('8 Functional'), false, 'Must not fall back to demo password reset suite');
        console.log('✔ Test 5 passed: Direct URL access to another user suite is securely blocked with "Test Suite Not Found".\n');

        console.log('🎉 ALL PLAYWRIGHT E2E DATA ISOLATION TESTS PASSED PERFECTLY!\n');
    } finally {
        await browser.close();
    }
})();
