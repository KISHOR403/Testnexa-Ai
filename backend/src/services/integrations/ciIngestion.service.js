const crypto = require('crypto');
const supabaseService = require('../supabaseData.service');
const githubAppService = require('./githubApp.service');
const qualityMetricsService = require('../qualityMetrics.service');
const logger = require('../../utils/logger');

const CASE_KEY_REGEX = /^\[([A-Z]{2,5}(?:_[A-Z0-9]+)+)\]/;

class CiIngestionService {
    /**
     * Ingest Playwright JSON report from customer's GitHub Actions runner
     */
    async ingestResults({ token, headers, payload }) {
        // 1. Feature Flag Check: Test execution / ingestion is gated behind FEATURE_TEST_RUNS
        const isExecutionEnabled = process.env.FEATURE_TEST_RUNS === 'true';
        if (!isExecutionEnabled) {
            const err = new Error('FEATURE_DISABLED: Test run ingestion is not enabled on this environment.');
            err.statusCode = 501;
            err.code = 'FEATURE_DISABLED';
            throw err;
        }

        // 2. Bearer Token Verification
        if (!token) {
            const err = new Error('Missing pipeline authentication token');
            err.statusCode = 401;
            err.code = 'UNAUTHORIZED';
            throw err;
        }

        const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
        const tokenRecord = await supabaseService.getPipelineTokenByHash(tokenHash);

        if (!tokenRecord || tokenRecord.revoked_at) {
            const err = new Error('Invalid or revoked pipeline token');
            err.statusCode = 401;
            err.code = 'INVALID_TOKEN';
            throw err;
        }

        // Update token last_used_at timestamp
        await supabaseService.updatePipelineTokenUsage(tokenRecord.id);

        // 3. Load Pipeline & Validate Active Status
        const pipeline = await supabaseService.getPipelineById(tokenRecord.pipeline_id);
        if (!pipeline) {
            const err = new Error('Associated pipeline not found');
            err.statusCode = 404;
            err.code = 'PIPELINE_NOT_FOUND';
            throw err;
        }

        if (pipeline.status === 'paused') {
            const err = new Error('Pipeline is paused. Ingestion is suspended.');
            err.statusCode = 403;
            err.code = 'PIPELINE_PAUSED';
            throw err;
        }

        // 4. Validate Headers
        const idempotencyKey = headers['idempotency-key'] || headers['Idempotency-Key'];
        if (!idempotencyKey || typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
            const err = new Error('Header Idempotency-Key is required');
            err.statusCode = 400;
            err.code = 'MISSING_IDEMPOTENCY_KEY';
            throw err;
        }

        const commitSha = headers['x-commit-sha'] || headers['X-Commit-Sha'];
        if (!commitSha || !/^[0-9a-fA-F]{40}$/.test(commitSha.trim())) {
            const err = new Error('Header X-Commit-Sha is required and must be a 40-character commit SHA');
            err.statusCode = 400;
            err.code = 'INVALID_COMMIT_SHA';
            throw err;
        }

        const branch = headers['x-branch'] || headers['X-Branch'] || 'main';
        const rawPr = headers['x-pr-number'] || headers['X-PR-Number'];
        const prNumber = rawPr ? parseInt(rawPr, 10) : null;
        const actor = headers['x-actor'] || headers['X-Actor'] || null;
        const providerRunUrl = headers['x-run-url'] || headers['X-Run-Url'] || null;

        // 5. Idempotency Check: (pipeline_id, idempotency_key)
        const cleanIdempotencyKey = idempotencyKey.trim();
        const existingRun = await supabaseService.getTestRunByIdempotency(pipeline.id, cleanIdempotencyKey);
        if (existingRun) {
            logger.info(`Idempotent CI ingestion replay for run ${existingRun.id} (key: ${cleanIdempotencyKey})`);
            return {
                runId: existingRun.id,
                idempotencyReplay: true,
                status: existingRun.status,
                totals: existingRun.totals,
                url: `/app/runs/${existingRun.id}`
            };
        }

        // 6. Validate Playwright JSON Report
        if (!payload || typeof payload !== 'object') {
            const err = new Error('Invalid JSON report payload');
            err.statusCode = 400;
            err.code = 'INVALID_PAYLOAD';
            throw err;
        }

        // 7. Load Suite Test Cases for Mapping
        let suiteCases = [];
        try {
            const suite = await supabaseService.getSession(pipeline.suite_id);
            if (suite) {
                const sData = suite.suiteData || suite.suite_data || suite.data || suite;
                suiteCases = supabaseService._extractCasesFromSuiteData(sData);
            }
        } catch (e) {
            logger.warn(`Could not load suite cases for pipeline ${pipeline.id}:`, e.message);
        }

        const suiteCaseKeyMap = new Map();
        const suiteCaseIdMap = new Map();
        for (const sc of suiteCases) {
            const key = sc.key || sc.testCaseKey || sc.customId || sc.id;
            if (key) suiteCaseKeyMap.set(String(key).toUpperCase(), sc);
            if (sc.id) suiteCaseIdMap.set(String(sc.id), sc);
        }

        // 8. Extract Playwright Specs & Results
        const rawTests = this._extractPlaywrightTests(payload);

        const mappedResults = [];
        const unmappedCases = [];
        let totalCount = 0;
        let passedCount = 0;
        let failedCount = 0;
        let skippedCount = 0;
        let flakyCount = 0;
        let totalDurationMs = 0;

        for (const t of rawTests) {
            totalCount++;
            totalDurationMs += t.durationMs;

            const match = t.title.match(CASE_KEY_REGEX);
            const extractedKey = match ? match[1].toUpperCase() : null;

            let matchedCase = null;
            if (extractedKey && suiteCaseKeyMap.has(extractedKey)) {
                matchedCase = suiteCaseKeyMap.get(extractedKey);
            } else if (suiteCaseIdMap.has(t.title)) {
                matchedCase = suiteCaseIdMap.get(t.title);
            }

            // Map outcome status
            let outcome = 'passed';
            if (t.status === 'unexpected') {
                outcome = 'failed';
                failedCount++;
            } else if (t.status === 'flaky') {
                outcome = 'flaky';
                flakyCount++;
            } else if (t.status === 'skipped') {
                outcome = 'skipped';
                skippedCount++;
            } else {
                outcome = 'passed';
                passedCount++;
            }

            const caseId = matchedCase?.id || matchedCase?.key || extractedKey || t.title;

            if (matchedCase) {
                mappedResults.push({
                    case_id: String(caseId),
                    outcome,
                    duration_ms: t.durationMs,
                    error_summary: t.errorSummary ? t.errorSummary.slice(0, 1000) : null,
                    retry_count: t.retryCount,
                    raw_details: {
                        title: t.title,
                        key: extractedKey,
                        status: t.status
                    }
                });
            } else {
                unmappedCases.push({
                    title: t.title,
                    extractedKey,
                    outcome,
                    duration_ms: t.durationMs
                });
            }
        }

        const runStatus = failedCount > 0 ? 'failed' : 'passed';
        const totals = {
            total: totalCount,
            passed: passedCount,
            failed: failedCount,
            skipped: skippedCount,
            flaky: flakyCount,
            duration_ms: totalDurationMs
        };

        // 9. Atomic Test Run & Results Creation
        const runId = `run_ci_${crypto.randomBytes(8).toString('hex')}`;
        const runRecord = {
            id: runId,
            workspace_id: pipeline.workspace_id,
            suite_id: pipeline.suite_id,
            source: 'ci',
            pipeline_id: pipeline.id,
            commit_sha: commitSha.trim(),
            branch: branch.trim(),
            pr_number: prNumber,
            actor,
            provider_run_url: providerRunUrl,
            status: runStatus,
            started_at: new Date(Date.now() - totalDurationMs).toISOString(),
            finished_at: new Date().toISOString(),
            totals,
            idempotency_key: cleanIdempotencyKey
        };

        await supabaseService.createCiTestRun(runRecord, mappedResults);

        // 10. Update Suite Verification Status
        try {
            await qualityMetricsService.syncVerificationFromRuns(pipeline.suite_id);
        } catch (e) {
            logger.warn('Quality metrics verification update note:', e.message);
        }

        // 11. GitHub Check Run Integration (Resilient: failure does NOT fail ingestion)
        if (pipeline.report_check) {
            this._postGitHubCheckRunSafe({
                pipeline,
                commitSha: commitSha.trim(),
                runStatus,
                totals,
                mappedResults,
                unmappedCases
            }).catch(e => logger.warn('GitHub Check Run post error:', e.message));
        }

        return {
            runId,
            status: runStatus,
            totals,
            mapped: mappedResults.length,
            unmapped: unmappedCases.length,
            unmappedCases: unmappedCases.slice(0, 10),
            url: `/app/runs/${runId}`
        };
    }

    /**
     * Recursively extract tests from Playwright JSON report structure
     */
    _extractPlaywrightTests(payload) {
        const tests = [];

        const walkSuite = (suite) => {
            if (!suite) return;

            if (Array.isArray(suite.specs)) {
                for (const spec of suite.specs) {
                    const title = spec.title || '';
                    if (Array.isArray(spec.tests)) {
                        for (const t of spec.tests) {
                            const status = t.status || (t.expectedStatus === 'passed' ? 'expected' : 'unexpected');
                            const results = Array.isArray(t.results) ? t.results : [];
                            const lastResult = results[results.length - 1] || {};
                            const durationMs = results.reduce((acc, r) => acc + (parseInt(r.duration, 10) || 0), 0);
                            const retryCount = Math.max(0, results.length - 1);

                            let errorSummary = null;
                            if (lastResult.error) {
                                errorSummary = lastResult.error.message || lastResult.error.snippet || JSON.stringify(lastResult.error);
                            } else if (lastResult.errors && lastResult.errors.length > 0) {
                                errorSummary = lastResult.errors.map(e => e.message || e).join('\n');
                            }

                            tests.push({
                                title,
                                status,
                                durationMs,
                                retryCount,
                                errorSummary
                            });
                        }
                    }
                }
            }

            if (Array.isArray(suite.suites)) {
                for (const sub of suite.suites) {
                    walkSuite(sub);
                }
            }
        };

        if (Array.isArray(payload.suites)) {
            for (const s of payload.suites) {
                walkSuite(s);
            }
        } else if (payload.suites && typeof payload.suites === 'object') {
            walkSuite(payload.suites);
        }

        return tests;
    }

    /**
     * Non-fatal Check Run posting
     */
    async _postGitHubCheckRunSafe({ pipeline, commitSha, runStatus, totals, mappedResults, unmappedCases }) {
        try {
            const integration = await supabaseService.getIntegrationById(pipeline.integration_id);
            if (!integration || !integration.installation_id) return;

            const repo = await supabaseService.getIntegrationRepoById(pipeline.repo_id, pipeline.integration_id);
            if (!repo || !repo.full_name) return;

            const [owner, repoName] = repo.full_name.split('/');
            if (!owner || !repoName) return;

            const conclusion = runStatus === 'passed' ? 'success' : 'failure';
            const title = `Testnexa CI: ${totals.passed}/${totals.total} Passed`;
            const summary = `**Suite:** ${pipeline.name}\n- **Total:** ${totals.total}\n- **Passed:** ${totals.passed}\n- **Failed:** ${totals.failed}\n- **Skipped:** ${totals.skipped}\n- **Flaky:** ${totals.flaky}\n- **Duration:** ${(totals.duration_ms / 1000).toFixed(2)}s\n- **Mapped Cases:** ${mappedResults.length}\n- **Unmapped Tests:** ${unmappedCases.length}`;

            await githubAppService.createOrUpdateCheckRun({
                installationId: integration.installation_id,
                owner,
                repo: repoName,
                name: 'Testnexa Playwright Verification',
                headSha: commitSha,
                status: 'completed',
                conclusion,
                output: {
                    title,
                    summary
                }
            });
        } catch (err) {
            logger.warn('Failed to update GitHub Check Run:', err.message);
        }
    }
}

module.exports = new CiIngestionService();
