/**
 * Testnexa AI — CI/CD Integrations & GitHub Actions Pipeline Test Suite
 * Comprehensive verification of GitHub App integration, Webhooks HMAC,
 * Token Generation/Hashing/Rotation, Ingestion Idempotency & Mapping,
 * Workflow YAML Generation, and Verification Metric Synchronization.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const githubAppService = require('../src/services/integrations/githubApp.service');
const pipelineExportService = require('../src/services/integrations/pipelineExport.service');
const cicdService = require('../src/services/integrations/cicdIntegration.service');
const ciIngestionService = require('../src/services/integrations/ciIngestion.service');
const qualityMetricsService = require('../src/services/qualityMetrics.service');
const supabaseService = require('../src/services/supabaseData.service');
const { encryptSecret, decryptSecret, maskSecret } = require('../src/utils/encryption');

test('CI/CD Integrations & GitHub Actions Quality Gate Suite', async (t) => {
    // Disable remote Supabase for fast deterministic unit test isolation
    supabaseService.ciTablesAvailable = false;
    supabaseService.risksTableAvailable = false;
    supabaseService.workspacesTableAvailable = false;
    supabaseService.sessionsTableAvailable = false;
    supabaseService.executionTablesAvailable = false;

    // Reset CI maps for clean isolated test run
    supabaseService.inMemoryIntegrations.clear();
    supabaseService.inMemoryIntegrationRepos.clear();
    supabaseService.inMemoryPipelines.clear();
    supabaseService.inMemoryPipelineTokens.clear();
    supabaseService.inMemoryWebhookDeliveries.clear();
    supabaseService.inMemoryTestRuns.clear();
    supabaseService.inMemoryTestRunResults.clear();

    const testUser = { id: 'usr_ci_' + Date.now(), name: 'CI Engineer' };
    const workspace = await supabaseService.getUserPrimaryWorkspace(testUser.id, testUser.name);
    const testWorkspaceId = workspace.id;
    const testUserId = testUser.id;

    // Setup test suite in workspace with requirements and test cases
    const suite = await supabaseService.createSession({
        userId: testUserId,
        title: 'E2E Checkout & Cart Suite',
        status: 'Approved',
        suiteData: {
            testSuiteName: 'E2E Checkout & Cart Suite',
            requirements: [
                {
                    id: 'REQ_CHECKOUT_001',
                    title: 'Customer must be able to complete purchase with credit card',
                    priority: 'Critical',
                    category: 'Functional'
                },
                {
                    id: 'REQ_CHECKOUT_002',
                    title: 'System must reject invalid promotional discount coupons',
                    priority: 'High',
                    category: 'Functional'
                }
            ],
            functional: [
                {
                    id: 'TC_CHECKOUT_001',
                    key: 'TC_CHECKOUT_001',
                    title: 'Standard Checkout Flow',
                    priority: 'Critical',
                    type: 'Functional',
                    requirementId: 'REQ_CHECKOUT_001',
                    approval_status: 'approved',
                    steps: [
                        { action: 'Navigate to cart', expected: 'Cart is displayed' },
                        { action: 'Click checkout and enter payment', expected: 'Order confirmed' }
                    ]
                },
                {
                    id: 'TC_CHECKOUT_002',
                    key: 'TC_CHECKOUT_002',
                    title: 'Invalid Coupon Application',
                    priority: 'High',
                    type: 'Negative',
                    requirementId: 'REQ_CHECKOUT_002',
                    approval_status: 'approved',
                    steps: [
                        { action: 'Apply EXPIRED2020', expected: 'Error coupon expired displayed' }
                    ]
                }
            ]
        }
    });

    await t.test('1. Secret Encryption: AES-256-GCM encrypts, decrypts, and masks tokens', () => {
        const rawToken = 'tnx_ci_' + crypto.randomBytes(32).toString('hex');
        const encrypted = encryptSecret(rawToken);

        assert.notEqual(encrypted, rawToken);
        assert.ok(encrypted.includes(':'), 'Encrypted string must contain IV, authTag, and ciphertext');

        const decrypted = decryptSecret(encrypted);
        assert.equal(decrypted, rawToken);

        const masked = maskSecret(rawToken);
        assert.ok(masked.includes('••••'));
        assert.equal(masked.endsWith(rawToken.slice(-4)), true);
    });

    await t.test('2. GitHub App State: Signed CSRF state generation and tamper rejection', () => {
        const state = githubAppService.generateSignedState({
            userId: testUserId,
            workspaceId: testWorkspaceId,
            returnUrl: '/app/workspace'
        });

        assert.ok(typeof state === 'string' && state.length > 20);

        // Valid state verification
        const verified = githubAppService.verifySignedState(state);
        assert.equal(verified.valid, true);
        assert.equal(verified.payload.userId, testUserId);
        assert.equal(verified.payload.workspaceId, testWorkspaceId);

        // Tampered state verification
        const tampered = state.slice(0, -6) + 'abcdef';
        const tamperedVerified = githubAppService.verifySignedState(tampered);
        assert.equal(tamperedVerified.valid, false);

        // Empty state
        assert.equal(githubAppService.verifySignedState('').valid, false);
    });

    await t.test('3. Webhook Security: Valid HMAC accepted, invalid signature rejected, replay deduplicated', async () => {
        const secret = 'webhook_test_secret_xyz123';
        process.env.GITHUB_APP_WEBHOOK_SECRET = secret;

        const payload = { action: 'completed', check_run: { id: 101, status: 'completed' } };
        const rawBody = JSON.stringify(payload);
        const validSignature = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

        // Valid signature
        const isValid = githubAppService.verifyWebhookSignature(rawBody, validSignature, secret);
        assert.equal(isValid, true);

        // Invalid signature
        const isInvalid = githubAppService.verifyWebhookSignature(rawBody, 'sha256=badbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadb', secret);
        assert.equal(isInvalid, false);

        // Missing signature
        const isMissing = githubAppService.verifyWebhookSignature(rawBody, '', secret);
        assert.equal(isMissing, false);

        // Webhook handler processing & replay deduplication
        const deliveryId = 'deliv_' + Date.now();
        const res1 = await cicdService.handleWebhook({
            event: 'check_run',
            deliveryId,
            signature: validSignature,
            rawBody,
            payload
        });
        assert.equal(res1.acknowledged, true);
        assert.equal(res1.deliveryId, deliveryId);

        // Replay with exact same deliveryId must be ignored as duplicate
        const res2 = await cicdService.handleWebhook({
            event: 'check_run',
            deliveryId,
            signature: validSignature,
            rawBody,
            payload
        });
        assert.equal(res2.acknowledged, true);
        assert.equal(res2.duplicate, true);
    });

    await t.test('4. Pipeline Creation & Token Storage: Plaintext returned once, only SHA-256 hash stored', async () => {
        // Create an integration
        const integration = await supabaseService.saveIntegration({
            workspace_id: testWorkspaceId,
            provider: 'github',
            external_account: 'testorg',
            installation_id: 'inst_999888',
            status: 'active'
        });

        // Save a repository
        const [repo] = await supabaseService.saveIntegrationRepos(integration.id, [{
            repo_id: '998877',
            full_name: 'testorg/checkout-app',
            default_branch: 'main',
            private: false
        }]);

        // Create pipeline
        const created = await cicdService.createPipeline(testWorkspaceId, {
            integrationId: integration.id,
            repoId: repo.repo_id,
            suiteId: suite.id,
            name: 'Checkout Playwright CI',
            branchFilters: ['main', 'release/*'],
            triggers: { pull_request: true, push: true },
            reportCheck: true
        });

        assert.ok(created.pipeline.id, 'Pipeline ID must be present');
        assert.ok(created.token.startsWith('tnx_ci_'), 'Plaintext token must start with tnx_ci_');
        assert.equal(created.token.length, 71, 'Plaintext token must be 71 characters (tnx_ci_ + 64 hex chars)');

        // Verify database/memory stores ONLY token_hash and prefix, NEVER plaintext token
        const tokenRecord = await supabaseService.getPipelineTokenByHash(
            crypto.createHash('sha256').update(created.token).digest('hex')
        );
        assert.ok(tokenRecord, 'Token must be findable by hash');
        assert.equal(tokenRecord.token_hash, crypto.createHash('sha256').update(created.token).digest('hex'));
        assert.equal(tokenRecord.token, undefined, 'Plaintext token must never be stored in tokenRecord');

        // Uniqueness check: Cannot create duplicate pipeline for (repo_id, suite_id)
        await assert.rejects(
            async () => {
                await cicdService.createPipeline(testWorkspaceId, {
                    integrationId: integration.id,
                    repoId: repo.repo_id,
                    suiteId: suite.id
                });
            },
            { code: 'PIPELINE_EXISTS' }
        );
    });

    await t.test('5. Token Rotation: Revokes prior token immediately and yields new token', async () => {
        const pipelines = await supabaseService.listPipelines(testWorkspaceId);
        const pipeline = pipelines[0];

        // Rotate token
        const rotated = await cicdService.rotatePipelineToken(pipeline.id, testWorkspaceId);
        assert.ok(rotated.token.startsWith('tnx_ci_'));
        assert.notEqual(rotated.tokenPrefix, undefined);

        // Previous tokens must be marked revoked
        const allTokens = Array.from(supabaseService.inMemoryPipelineTokens.values())
            .filter(t => t.pipeline_id === pipeline.id);
        const revokedTokens = allTokens.filter(t => t.revoked_at !== null);
        assert.ok(revokedTokens.length >= 1, 'Previous token must be revoked');

        // Look up by active token hash succeeds
        const activeHash = crypto.createHash('sha256').update(rotated.token).digest('hex');
        const activeRecord = await supabaseService.getPipelineTokenByHash(activeHash);
        assert.equal(activeRecord.revoked_at, null);
    });

    await t.test('6. Playwright Spec & Workflow Generation: Prefixes [TC_KEY] and pins versions', async () => {
        const specCode = pipelineExportService.generatePlaywrightSuiteCode(suite);

        // Verify every test title starts with [TC_KEY]
        assert.ok(specCode.includes("test('[TC_CHECKOUT_001] Standard Checkout Flow'"));
        assert.ok(specCode.includes("test('[TC_CHECKOUT_002] Invalid Coupon Application'"));
        assert.ok(specCode.includes("@playwright/test"));

        const pipelines = await supabaseService.listPipelines(testWorkspaceId);
        const setup = await cicdService.getPipelineSetup(pipelines[0].id, testWorkspaceId);

        const yaml = setup.workflowYaml;
        // Verify GitHub Actions workflow structure
        assert.ok(yaml.includes('actions/checkout@v4'), 'Workflow must pin checkout action to @v4');
        assert.ok(yaml.includes('actions/setup-node@v4'), 'Workflow must pin setup-node action to @v4');
        assert.ok(yaml.includes('PLAYWRIGHT_JSON_OUTPUT_NAME=results.json'));
        assert.ok(yaml.includes('npx playwright test --reporter=json'));
        assert.ok(yaml.includes('if: always()'), 'Upload step must run if: always()');
        assert.ok(yaml.includes('Idempotency-Key: ${{ github.run_id }}-${{ github.run_attempt }}'));
        assert.ok(yaml.includes('secrets.TESTNEXA_TOKEN'));
        assert.ok(!yaml.includes('tnx_ci_'), 'Workflow template must never contain hardcoded plaintext tokens');
    });

    await t.test('7. Ingestion Feature Gating: Returns 501 FEATURE_DISABLED when FEATURE_TEST_RUNS !== true', async () => {
        process.env.FEATURE_TEST_RUNS = 'false';

        await assert.rejects(
            async () => {
                await ciIngestionService.ingestResults({
                    token: 'tnx_ci_dummy',
                    headers: { 'idempotency-key': 'key_1', 'x-commit-sha': '1111222233334444555566667777888899990000' },
                    payload: {}
                });
            },
            (err) => {
                assert.equal(err.code, 'FEATURE_DISABLED');
                assert.equal(err.statusCode, 501);
                return true;
            }
        );
    });

    await t.test('8. Ingestion Execution: Idempotency, Status Mapping, Unmapped Keys, and Verification Updates', async () => {
        // Enable test execution for Phase 2 ingestion tests
        process.env.FEATURE_TEST_RUNS = 'true';

        const pipelines = await supabaseService.listPipelines(testWorkspaceId);
        const pipeline = pipelines[0];

        // Generate fresh active token for pipeline
        const { token } = await cicdService.rotatePipelineToken(pipeline.id, testWorkspaceId);

        const samplePlaywrightReport = {
            suites: [
                {
                    title: 'checkout.spec.js',
                    specs: [
                        {
                            title: '[TC_CHECKOUT_001] Standard Checkout Flow',
                            tests: [
                                {
                                    status: 'expected',
                                    results: [{ status: 'passed', duration: 1250 }]
                                }
                            ]
                        },
                        {
                            title: '[TC_CHECKOUT_002] Invalid Coupon Application',
                            tests: [
                                {
                                    status: 'unexpected',
                                    results: [{ status: 'failed', duration: 850, error: { message: 'Coupon discount not applied' } }]
                                }
                            ]
                        },
                        {
                            title: '[TC_UNMAPPED_999] Ad-hoc unlinked test',
                            tests: [
                                {
                                    status: 'expected',
                                    results: [{ status: 'passed', duration: 400 }]
                                }
                            ]
                        }
                    ]
                }
            ]
        };

        const idempotencyKey = `gh_run_888_${Date.now()}`;
        const commitSha = 'a'.repeat(40);

        // First Ingestion
        const result1 = await ciIngestionService.ingestResults({
            token,
            headers: {
                'idempotency-key': idempotencyKey,
                'x-commit-sha': commitSha,
                'x-branch': 'main',
                'x-pr-number': '42',
                'x-actor': 'developer'
            },
            payload: samplePlaywrightReport
        });

        assert.ok(result1.runId.startsWith('run_ci_'));
        assert.equal(result1.status, 'failed'); // Since TC_CHECKOUT_002 had status: unexpected
        assert.equal(result1.totals.total, 3);
        assert.equal(result1.totals.passed, 2);
        assert.equal(result1.totals.failed, 1);
        assert.equal(result1.mapped, 2);
        assert.equal(result1.unmapped, 1);

        // Verify Idempotency: Second ingestion with identical key returns previous run
        const result2 = await ciIngestionService.ingestResults({
            token,
            headers: {
                'idempotency-key': idempotencyKey,
                'x-commit-sha': commitSha
            },
            payload: samplePlaywrightReport
        });

        assert.equal(result2.runId, result1.runId);
        assert.equal(result2.idempotencyReplay, true);

        // Verify Ingestion updated verification metrics in shared service
        const metrics = await qualityMetricsService.getQualityMetrics({
            suiteId: suite.id,
            userId: testUserId
        });

        assert.ok(metrics, 'Quality metrics must compute without errors');
        assert.equal(metrics.cases, 2);

        // Reset FEATURE_TEST_RUNS back to false as per default specification
        process.env.FEATURE_TEST_RUNS = 'false';
    });

    await t.test('9. Disconnect Integration: Pauses pipelines and revokes tokens', async () => {
        const integrations = await supabaseService.listIntegrations(testWorkspaceId);
        const integration = integrations[0];

        await cicdService.disconnectIntegration(integration.id, testWorkspaceId);

        // Integration is deleted
        const after = await supabaseService.getIntegrationById(integration.id, testWorkspaceId);
        assert.equal(after, null);

        // Associated pipelines must be paused
        const pipelines = await supabaseService.listPipelines(testWorkspaceId, { integrationId: integration.id });
        for (const p of pipelines) {
            assert.equal(p.status, 'paused');
            // Associated tokens must be revoked
            const tokens = Array.from(supabaseService.inMemoryPipelineTokens.values())
                .filter(tok => tok.pipeline_id === p.id);
            for (const tok of tokens) {
                assert.ok(tok.revoked_at !== null, 'Tokens must be revoked upon integration disconnect');
            }
        }
    });
});
