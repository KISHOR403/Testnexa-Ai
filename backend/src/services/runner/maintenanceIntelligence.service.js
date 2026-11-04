/**
 * TestNexa AI — Test Maintenance Intelligence Service
 *
 * Evidence-based automation health detection:
 * 1. Broken locator detection (Playwright locator timeouts, strict mode violations, visibility/actionability issues)
 * 2. Repeated automation failure classification (Automation vs Application Defect vs Environment)
 * 3. Outdated automation mappings (Missing references, invalid files, unverified spec bindings)
 * 4. Execution performance degradation (Historical duration baseline comparison)
 * 5. Requirement and script mismatch identification
 *
 * Human-in-the-loop: Findings are actionable diagnostics; never automatically mutates source code.
 */

const crypto = require('crypto');
const supabaseService = require('../supabaseData.service');
const automationInventory = require('./automationInventory.service');
const aiService = require('../ai.service');
const logger = require('../../utils/logger');

// Regex patterns to detect broken locators in Playwright error messages & stack traces
const LOCATOR_PATTERNS = [
    /Timeout \d+ms exceeded waiting for locator\(['"]([^'"]+)['"]\)/i,
    /waiting for locator\(['"]([^'"]+)['"]\)/i,
    /strict mode violation:\s*locator\(['"]([^'"]+)['"]\)/i,
    /waiting for selector ["']([^'"]+)["']/i,
    /element matching selector ["']([^'"]+)["'] not found/i,
    /page\.waitForSelector\(['"]([^'"]+)['"]\)/i,
    /locator\(['"]([^'"]+)['"]\)\.(?:click|fill|check|selectOption|type|press)/i,
    /locator\(['"]([^'"]+)['"]\)/i
];

const ENVIRONMENT_ERROR_PATTERNS = [
    /econnrefused/i,
    /enotfound/i,
    /net::err/i,
    /status 502/i,
    /status 503/i,
    /status 504/i,
    /gateway timeout/i,
    /network timeout/i,
    /dns lookup failed/i,
    /connection reset/i
];

const ASSERTION_ERROR_PATTERNS = [
    /expect\(received\)/i,
    /assertionerror/i,
    /expected.*to be/i,
    /expected.*received/i,
    /status 4\d\d/i,
    /status 500/i,
    /business logic/i
];

class MaintenanceIntelligenceService {
    constructor() {
        this.cache = new Map();
        this.cacheTTL = 3 * 60 * 1000; // 3 min cache
    }

    /**
     * Invalidate cached findings for a workspace
     */
    invalidateCache(workspaceId) {
        if (!workspaceId) {
            this.cache.clear();
            return;
        }
        for (const key of this.cache.keys()) {
            if (key.startsWith(`${workspaceId}:`)) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Extract locator selector from error text
     */
    _extractLocator(errorText) {
        if (!errorText || typeof errorText !== 'string') return null;
        for (const pattern of LOCATOR_PATTERNS) {
            const match = errorText.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }
        return null;
    }

    /**
     * Check if error indicates an environment issue
     */
    _isEnvironmentError(errorText) {
        if (!errorText || typeof errorText !== 'string') return false;
        return ENVIRONMENT_ERROR_PATTERNS.some(p => p.test(errorText));
    }

    /**
     * Check if error indicates an application defect
     */
    _isAssertionError(errorText) {
        if (!errorText || typeof errorText !== 'string') return false;
        return ASSERTION_ERROR_PATTERNS.some(p => p.test(errorText));
    }

    /**
     * Check if error is a broken locator or visibility timeout
     */
    _isBrokenLocatorError(errorText) {
        if (!errorText || typeof errorText !== 'string') return false;
        return (
            /waiting for locator/i.test(errorText) ||
            /strict mode violation/i.test(errorText) ||
            /element is not visible/i.test(errorText) ||
            /element is detached/i.test(errorText) ||
            /element is not actionable/i.test(errorText) ||
            /waiting for selector/i.test(errorText)
        );
    }

    /**
     * Generate deterministic finding ID for deduplication
     */
    _generateFindingId(workspaceId, suiteId, testCaseId, issueType) {
        const raw = `${workspaceId}:${suiteId || 'none'}:${testCaseId || 'none'}:${issueType}`;
        const hash = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
        return `maint_${hash}`;
    }

    /**
     * Calculate median duration
     */
    _calculateMedian(numbers) {
        if (!numbers || numbers.length === 0) return 0;
        const sorted = [...numbers].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    }

    /**
     * Main scan method: analyzes execution history, test suites, and mappings
     */
    async scanWorkspaceMaintenance(workspaceId, options = {}) {
        if (!workspaceId) throw new Error('workspaceId is required');
        const {
            suiteId = null,
            startDate = null,
            endDate = null,
            browser = null,
            environment = null
        } = options;

        const cacheKey = `${workspaceId}:${suiteId || 'all'}:${browser || 'all'}:${environment || 'all'}`;
        const cached = this.cache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < this.cacheTTL)) {
            return cached.data;
        }

        // 1. Fetch completed test runs with their cases
        const completedRuns = await supabaseService.getWorkspaceRunsWithCases(workspaceId, {
            suiteId,
            limit: 250
        });

        // 2. Fetch existing maintenance findings from persistence layer
        const existingFindings = await supabaseService.getMaintenanceFindings(workspaceId);
        const existingMap = new Map();
        existingFindings.forEach(f => existingMap.set(f.id, f));

        // 3. Group executions and test case outcomes
        const caseExecutionHistory = new Map(); // testCaseId -> array of executions
        const caseSuiteMap = new Map(); // testCaseId -> { suiteId, suiteTitle, testCaseTitle, caseSnapshot }

        for (const run of completedRuns) {
            // Apply environment and browser filters if requested
            const targetEnv = run.targetEnvironment || {};
            const runBrowser = (targetEnv.browser || 'Chromium').toString().toLowerCase();
            const runEnv = (targetEnv.environment || targetEnv.name || 'Default').toString().toLowerCase();

            if (browser && !runBrowser.includes(browser.toLowerCase())) continue;
            if (environment && !runEnv.includes(environment.toLowerCase())) continue;

            const runDate = new Date(run.completedAt || run.completed_at || run.createdAt || run.created_at);
            if (startDate && runDate < new Date(startDate)) continue;
            if (endDate && runDate > new Date(endDate)) continue;

            const cases = run.cases || [];
            for (const c of cases) {
                const tcId = c.testCaseId || c.test_case_id;
                if (!tcId) continue;

                if (!caseSuiteMap.has(tcId)) {
                    caseSuiteMap.set(tcId, {
                        suiteId: run.suiteId || run.suite_id,
                        suiteTitle: run.suiteName || run.name || 'Test Suite',
                        testCaseTitle: c.caseSnapshot?.title || c.title || tcId,
                        caseSnapshot: c.caseSnapshot || {}
                    });
                }

                if (!caseExecutionHistory.has(tcId)) {
                    caseExecutionHistory.set(tcId, []);
                }

                caseExecutionHistory.get(tcId).push({
                    runId: run.id,
                    runName: run.name,
                    runDate: runDate.toISOString(),
                    status: (c.status || '').toLowerCase(),
                    durationMs: c.durationMs || c.duration_ms || 0,
                    executionType: c.executionType || c.execution_type || 'manual',
                    actualResult: c.actualResult || c.actual_result || '',
                    errorMessage: c.caseSnapshot?.errorMessage || c.notes || '',
                    stackTrace: c.caseSnapshot?.stackTrace || '',
                    mapping: c.caseSnapshot?.automationMapping || c.caseSnapshot?.playwrightBinding || null
                });
            }
        }

        const findings = [];
        const now = new Date().toISOString();

        // 4. Run Detection Analyzers per Test Case
        for (const [tcId, history] of caseExecutionHistory.entries()) {
            const meta = caseSuiteMap.get(tcId);
            const suiteId = meta.suiteId;
            const suiteTitle = meta.suiteTitle;
            const testCaseTitle = meta.testCaseTitle;
            const snapshot = meta.caseSnapshot;

            // Sort history ascending by date
            const sortedHistory = [...history].sort((a, b) => new Date(a.runDate) - new Date(b.runDate));
            const totalRuns = sortedHistory.length;
            const failedRuns = sortedHistory.filter(h => ['failed', 'blocked', 'timed_out', 'infrastructure_error'].includes(h.status));
            const failureCount = failedRuns.length;
            const failureRate = totalRuns > 0 ? Math.round((failureCount / totalRuns) * 100) : 0;

            const latestExecution = sortedHistory[sortedHistory.length - 1];
            const latestErrorText = `${latestExecution?.errorMessage || ''} ${latestExecution?.actualResult || ''} ${latestExecution?.stackTrace || ''}`;

            // ----------------------------------------------------
            // A. Broken Locator Detection
            // ----------------------------------------------------
            if (this._isBrokenLocatorError(latestErrorText)) {
                const locator = this._extractLocator(latestErrorText) || 'locator(unresolved)';
                const findingId = this._generateFindingId(workspaceId, suiteId, tcId, 'BROKEN_LOCATOR');
                const prev = existingMap.get(findingId);

                findings.push({
                    id: findingId,
                    workspaceId,
                    suiteId,
                    suiteTitle,
                    testCaseId: tcId,
                    testCaseTitle,
                    issueType: 'BROKEN_LOCATOR',
                    classification: 'Needs Maintenance',
                    severity: snapshot.priority === 'Critical' ? 'Critical' : 'High',
                    locator,
                    errorMessage: latestExecution.errorMessage || latestExecution.actualResult || 'Playwright element locator timeout',
                    stackTraceSnippet: latestExecution.stackTrace ? latestExecution.stackTrace.slice(0, 300) : null,
                    mapping: snapshot.automationMapping || snapshot.playwrightBinding || null,
                    metrics: {
                        occurrenceCount: failureCount,
                        totalRuns,
                        failureRate,
                        avgDurationMs: Math.round(sortedHistory.reduce((acc, h) => acc + h.durationMs, 0) / totalRuns)
                    },
                    supportingEvidence: [
                        `Locator '${locator}' failed to resolve or time out in Playwright worker.`,
                        `Failed in ${failureCount} of ${totalRuns} recorded execution run(s).`,
                        `Latest execution (${new Date(latestExecution.runDate).toLocaleDateString()}) threw: "${(latestExecution.errorMessage || latestExecution.actualResult || '').slice(0, 100)}"`
                    ],
                    firstDetectedAt: prev?.firstDetectedAt || sortedHistory[0].runDate,
                    lastDetectedAt: latestExecution.runDate,
                    recommendedAction: `Inspect target DOM element for selector '${locator}'. Update script to use accessible Playwright role or data-testid locator.`,
                    detectionExplanation: `Playwright worker was unable to locate or interact with element '${locator}'. This occurs when application UI elements undergo refactoring without script synchronization.`,
                    status: prev?.status === 'resolved' && latestExecution.status === 'failed' ? 'open' : (prev?.status || 'open'),
                    resolutionNotes: prev?.resolutionNotes || null,
                    resolvedAt: prev?.resolvedAt || null,
                    aiAnalysis: prev?.aiAnalysis || null,
                    createdAt: prev?.createdAt || now,
                    updatedAt: now
                });
            }

            // ----------------------------------------------------
            // B. Repeated Automation Failures
            // ----------------------------------------------------
            if (failureCount >= 2 && !this._isBrokenLocatorError(latestErrorText)) {
                let issueType = 'REPEATED_AUTOMATION_FAILURE';
                let classification = 'Needs Maintenance';
                let severity = 'High';
                let recommendedAction = 'Investigate Playwright execution logs and update script.';

                if (this._isEnvironmentError(latestErrorText)) {
                    issueType = 'ENVIRONMENT_FAILURE';
                    classification = 'Environment Issue';
                    severity = 'Medium';
                    recommendedAction = 'Verify connectivity, network DNS, and target test environment health.';
                } else if (this._isAssertionError(latestErrorText)) {
                    issueType = 'APPLICATION_DEFECT';
                    classification = 'Application Defect Suspected';
                    severity = snapshot.priority === 'Critical' ? 'Critical' : 'Major';
                    recommendedAction = 'File application bug ticket; assertion mismatch indicates functional regression.';
                } else if (totalRuns < 2) {
                    classification = 'Insufficient Evidence';
                }

                const findingId = this._generateFindingId(workspaceId, suiteId, tcId, issueType);
                const prev = existingMap.get(findingId);

                findings.push({
                    id: findingId,
                    workspaceId,
                    suiteId,
                    suiteTitle,
                    testCaseId: tcId,
                    testCaseTitle,
                    issueType,
                    classification,
                    severity,
                    locator: null,
                    errorMessage: latestExecution.errorMessage || latestExecution.actualResult || 'Repeated failure across test executions',
                    stackTraceSnippet: latestExecution.stackTrace ? latestExecution.stackTrace.slice(0, 300) : null,
                    mapping: snapshot.automationMapping || snapshot.playwrightBinding || null,
                    metrics: {
                        occurrenceCount: failureCount,
                        totalRuns,
                        failureRate,
                        avgDurationMs: Math.round(sortedHistory.reduce((acc, h) => acc + h.durationMs, 0) / totalRuns)
                    },
                    supportingEvidence: [
                        `Test case failed in ${failureCount} of ${totalRuns} executions (${failureRate}% failure rate).`,
                        `Latest failure occurred on ${new Date(latestExecution.runDate).toLocaleString()}.`,
                        `Error signature: "${(latestExecution.errorMessage || latestExecution.actualResult || '').slice(0, 120)}"`
                    ],
                    firstDetectedAt: prev?.firstDetectedAt || sortedHistory[0].runDate,
                    lastDetectedAt: latestExecution.runDate,
                    recommendedAction,
                    detectionExplanation: `Consistent failure across ${failureCount} runs indicates ${classification === 'Application Defect Suspected' ? 'a recurring application defect' : classification === 'Environment Issue' ? 'intermittent test environment unavailability' : 'an automation script maintenance issue'}.`,
                    status: prev?.status === 'resolved' && latestExecution.status === 'failed' ? 'open' : (prev?.status || 'open'),
                    resolutionNotes: prev?.resolutionNotes || null,
                    resolvedAt: prev?.resolvedAt || null,
                    aiAnalysis: prev?.aiAnalysis || null,
                    createdAt: prev?.createdAt || now,
                    updatedAt: now
                });
            }

            // ----------------------------------------------------
            // C. Outdated Automation Mappings
            // ----------------------------------------------------
            const isAutomated = snapshot.executionType === 'automated' ||
                                snapshot.isAutomated ||
                                Boolean(snapshot.automationMapping || snapshot.playwrightBinding);

            if (isAutomated) {
                const mapping = snapshot.automationMapping || snapshot.playwrightBinding || {};
                const scriptRef = mapping.scriptRef || mapping.scriptPath || mapping.file;

                if (!scriptRef) {
                    const findingId = this._generateFindingId(workspaceId, suiteId, tcId, 'OUTDATED_MAPPING');
                    const prev = existingMap.get(findingId);

                    findings.push({
                        id: findingId,
                        workspaceId,
                        suiteId,
                        suiteTitle,
                        testCaseId: tcId,
                        testCaseTitle,
                        issueType: 'OUTDATED_MAPPING',
                        classification: 'Needs Maintenance',
                        severity: 'High',
                        locator: null,
                        errorMessage: 'Missing Playwright script reference in automation mapping',
                        stackTraceSnippet: null,
                        mapping: null,
                        metrics: { occurrenceCount: 1, totalRuns, failureRate, avgDurationMs: 0 },
                        supportingEvidence: [
                            'Test case is tagged for automated Playwright execution, but has no valid scriptRef bound.'
                        ],
                        firstDetectedAt: prev?.firstDetectedAt || now,
                        lastDetectedAt: now,
                        recommendedAction: 'Bind a verified Playwright test from the project automation inventory.',
                        detectionExplanation: 'Automated runner cannot dispatch this test case without a registered script reference.',
                        status: prev?.status || 'open',
                        resolutionNotes: prev?.resolutionNotes || null,
                        resolvedAt: prev?.resolvedAt || null,
                        aiAnalysis: null,
                        createdAt: prev?.createdAt || now,
                        updatedAt: now
                    });
                } else {
                    // Check against actual inventory
                    const verify = automationInventory.verifyScriptReference(scriptRef, mapping.testId);
                    if (!verify.exists) {
                        const findingId = this._generateFindingId(workspaceId, suiteId, tcId, 'OUTDATED_MAPPING');
                        const prev = existingMap.get(findingId);

                        findings.push({
                            id: findingId,
                            workspaceId,
                            suiteId,
                            suiteTitle,
                            testCaseId: tcId,
                            testCaseTitle,
                            issueType: 'OUTDATED_MAPPING',
                            classification: 'Needs Maintenance',
                            severity: 'Critical',
                            locator: null,
                            errorMessage: `Script reference "${scriptRef}" not found in project inventory`,
                            stackTraceSnippet: null,
                            mapping,
                            metrics: { occurrenceCount: 1, totalRuns, failureRate, avgDurationMs: 0 },
                            supportingEvidence: [
                                `Mapped script reference '${scriptRef}' does not exist on disk or has been deleted.`,
                                `Automation inventory verified: 0 matching spec files found.`
                            ],
                            firstDetectedAt: prev?.firstDetectedAt || now,
                            lastDetectedAt: now,
                            recommendedAction: 'Re-bind to an active Playwright spec file or regenerate the automation script.',
                            detectionExplanation: 'The underlying test specification file or test identifier was moved, renamed, or deleted in the repository.',
                            status: prev?.status || 'open',
                            resolutionNotes: prev?.resolutionNotes || null,
                            resolvedAt: prev?.resolvedAt || null,
                            aiAnalysis: null,
                            createdAt: prev?.createdAt || now,
                            updatedAt: now
                        });
                    }
                }
            }

            // ----------------------------------------------------
            // D. Execution Performance Changes
            // ----------------------------------------------------
            const automatedRuns = sortedHistory.filter(h => h.executionType === 'automated' && h.durationMs > 0);
            if (automatedRuns.length >= 3) {
                const earlierDurations = automatedRuns.slice(0, -1).map(h => h.durationMs);
                const baselineMedian = this._calculateMedian(earlierDurations);
                const latestDuration = automatedRuns[automatedRuns.length - 1].durationMs;

                // Meaningful increase: >= 2.0x baseline AND delta >= 4000ms
                if (baselineMedian > 0 && latestDuration >= (baselineMedian * 2.0) && (latestDuration - baselineMedian) >= 4000) {
                    const findingId = this._generateFindingId(workspaceId, suiteId, tcId, 'PERFORMANCE_REGRESSION');
                    const prev = existingMap.get(findingId);

                    findings.push({
                        id: findingId,
                        workspaceId,
                        suiteId,
                        suiteTitle,
                        testCaseId: tcId,
                        testCaseTitle,
                        issueType: 'PERFORMANCE_REGRESSION',
                        classification: 'Potential Maintenance Risk',
                        severity: 'Medium',
                        locator: null,
                        errorMessage: `Execution time increased by +${Math.round(((latestDuration - baselineMedian) / baselineMedian) * 100)}% (${latestDuration}ms vs baseline ${baselineMedian}ms)`,
                        stackTraceSnippet: null,
                        mapping: snapshot.automationMapping || snapshot.playwrightBinding || null,
                        metrics: {
                            occurrenceCount: 1,
                            totalRuns,
                            failureRate,
                            avgDurationMs: Math.round(automatedRuns.reduce((a, b) => a + b.durationMs, 0) / automatedRuns.length),
                            baselineDurationMs: baselineMedian
                        },
                        supportingEvidence: [
                            `Baseline execution duration (median of ${earlierDurations.length} runs): ${baselineMedian}ms.`,
                            `Latest run duration: ${latestDuration}ms (+${latestDuration - baselineMedian}ms increase).`,
                            `Significant delta suggests DOM selector timeout retries, unoptimized page polling, or slow backend API endpoints.`
                        ],
                        firstDetectedAt: prev?.firstDetectedAt || now,
                        lastDetectedAt: automatedRuns[automatedRuns.length - 1].runDate,
                        recommendedAction: 'Profile test execution timeline for locator timeout waits or unoptimized waitForTimeout calls.',
                        detectionExplanation: 'Noticeable execution performance decline indicates potential selector latency, heavy polling, or application degradation.',
                        status: prev?.status || 'open',
                        resolutionNotes: prev?.resolutionNotes || null,
                        resolvedAt: prev?.resolvedAt || null,
                        aiAnalysis: null,
                        createdAt: prev?.createdAt || now,
                        updatedAt: now
                    });
                }
            }
        }

        // 5. Persist and calculate summary
        await supabaseService.saveMaintenanceFindings(workspaceId, findings);

        const summary = {
            totalFindings: findings.length,
            brokenLocatorsCount: findings.filter(f => f.issueType === 'BROKEN_LOCATOR').length,
            repeatedFailuresCount: findings.filter(f => f.issueType === 'REPEATED_AUTOMATION_FAILURE' || f.issueType === 'APPLICATION_DEFECT').length,
            outdatedMappingsCount: findings.filter(f => f.issueType === 'OUTDATED_MAPPING').length,
            performanceWarningsCount: findings.filter(f => f.issueType === 'PERFORMANCE_REGRESSION').length,
            needsMaintenanceCount: findings.filter(f => f.classification === 'Needs Maintenance').length,
            potentialRiskCount: findings.filter(f => f.classification === 'Potential Maintenance Risk').length,
            environmentIssuesCount: findings.filter(f => f.classification === 'Environment Issue').length,
            applicationDefectsCount: findings.filter(f => f.classification === 'Application Defect Suspected').length,
            resolvedCount: findings.filter(f => f.status === 'resolved').length
        };

        const result = { summary, findings };
        this.cache.set(cacheKey, { data: result, timestamp: Date.now() });

        return result;
    }

    /**
     * Get single finding by ID
     */
    async getFindingById(workspaceId, findingId) {
        return await supabaseService.getMaintenanceFindingById(workspaceId, findingId);
    }

    /**
     * Update finding status (e.g. mark as investigating, resolved, open)
     */
    async updateFindingStatus(workspaceId, findingId, { status, resolutionNotes, userId }) {
        if (!findingId) throw new Error('findingId is required');
        const now = new Date().toISOString();
        const patch = {
            status,
            resolutionNotes: resolutionNotes || null,
            updatedAt: now,
            updated_at: now
        };
        if (status === 'resolved') {
            patch.resolvedAt = now;
            patch.resolvedBy = userId;
        }

        this.invalidateCache(workspaceId);
        return await supabaseService.updateMaintenanceFinding(workspaceId, findingId, patch);
    }

    /**
     * AI Selector & Maintenance Analysis (On-Demand AI)
     */
    async analyzeFindingWithAI(workspaceId, findingId, userId) {
        const finding = await this.getFindingById(workspaceId, findingId);
        if (!finding) {
            const err = new Error('Finding not found in workspace');
            err.statusCode = 404;
            throw err;
        }

        const prompt = `You are a Senior Playwright Automation Architect.
Analyze this automated test maintenance finding and provide safe, actionable recommendations.

<TEST_CASE>
ID: ${finding.testCaseId}
Title: ${finding.testCaseTitle}
Suite: ${finding.suiteTitle}
Issue Type: ${finding.issueType}
Classification: ${finding.classification}
</TEST_CASE>

<ERROR_EVIDENCE>
Locator: ${finding.locator || 'None'}
Error Message: ${finding.errorMessage || 'N/A'}
Stack Trace: ${finding.stackTraceSnippet || 'N/A'}
</ERROR_EVIDENCE>

RULES:
1. Explain specifically why this locator or mapping failed in Playwright.
2. If locator failed, provide 2-3 modern, resilient Playwright locator recommendations (prefer getByRole, getByTestId, getByLabel).
3. Provide step-by-step investigation instructions for the QA engineer.
4. DO NOT claim that you have changed code or verified the fix.
5. Output valid JSON only.

JSON SCHEMA:
{
  "explanation": "concise explanation of why this failure occurred",
  "suggestedSelectors": [
    "page.getByRole('button', { name: '...' })",
    "page.getByTestId('...')"
  ],
  "recommendedFix": "step by step advice on how to refactor the test without breaking existing behavior"
}`;

        try {
            const raw = await aiService.callAI(prompt, {
                systemPrompt: 'You are an SDET and Playwright expert diagnosing test maintenance issues. Output valid JSON only.',
                temperature: 0.1,
                responseMimeType: 'application/json'
            });

            let parsed;
            try {
                let clean = (raw || '').trim();
                if (clean.startsWith('```json')) clean = clean.replace(/^```json\s*/, '').replace(/```$/, '').trim();
                else if (clean.startsWith('```')) clean = clean.replace(/^```\s*/, '').replace(/```$/, '').trim();
                parsed = JSON.parse(clean);
            } catch (pErr) {
                parsed = {
                    explanation: 'Locator or execution timed out in Playwright worker.',
                    suggestedSelectors: ['page.getByRole(...)', 'page.getByTestId(...)'],
                    recommendedFix: 'Inspect the live DOM state and update locator.'
                };
            }

            const aiAnalysis = {
                explanation: parsed.explanation || 'Analyzed failure in Playwright worker.',
                suggestedSelectors: Array.isArray(parsed.suggestedSelectors) ? parsed.suggestedSelectors : [],
                recommendedFix: parsed.recommendedFix || 'Refactor selector to resilient locator.',
                analyzedAt: new Date().toISOString()
            };

            const updated = await supabaseService.updateMaintenanceFinding(workspaceId, findingId, {
                aiAnalysis
            });

            this.invalidateCache(workspaceId);
            return updated;
        } catch (aiErr) {
            logger.error('Failed to run AI maintenance analysis:', aiErr);
            throw aiErr;
        }
    }
}

module.exports = new MaintenanceIntelligenceService();

