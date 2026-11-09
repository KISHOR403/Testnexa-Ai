/**
 * TestNexa AI — Centralized Execution Status Engine Service
 *
 * Core Principle:
 * - A test case describes WHAT should be tested.
 * - An execution records WHAT ACTUALLY OCCURRED during verification.
 * - Never trust unvalidated overall statuses from client requests.
 *
 * Status Precedence Rules:
 * 1. FAILED: At least one required step is Failed.
 * 2. ERROR: An execution error, infrastructure exception, or crash occurred.
 * 3. BLOCKED: At least one required step is Blocked, and NO required step is Failed.
 * 4. SKIPPED: All applicable steps are explicitly and intentionally Skipped.
 * 5. PASSED: Every required step is completed and marked Passed. None Failed, Blocked, Skipped, or Error.
 * 6. IN_PROGRESS: Execution activity has started (some steps evaluated or draft saved), but required steps remain.
 * 7. NOT_EXECUTED: Zero steps have been evaluated.
 */

class ExecutionStatusEngineService {
    constructor() {
        this.VALID_STATUSES = [
            'not_run',
            'in_progress',
            'passed',
            'failed',
            'blocked',
            'skipped',
            'error',
            'timed_out',
            'infrastructure_error'
        ];
    }

    /**
     * Derives overall status deterministically from an array of step outcomes
     *
     * @param {Array|Object} steps - The test case definition steps
     * @param {Object} stepOutcomes - Map of { [stepIndex]: 'passed'|'failed'|'blocked'|'skipped'|'pending' }
     * @param {Object} options - { allowPartial: boolean, isDraft: boolean, hasSteps: boolean }
     * @returns {Object} { status: string, summary: Object, canCompleteAsPassed: boolean, violations: string[] }
     */
    evaluateExecutionStatus(stepsOrConfig = [], stepOutcomes = {}, options = {}) {
        let steps = stepsOrConfig;
        let outcomes = stepOutcomes;
        let opts = options;

        if (stepsOrConfig && typeof stepsOrConfig === 'object' && !Array.isArray(stepsOrConfig)) {
            steps = stepsOrConfig.steps || [];
            outcomes = stepsOrConfig.stepOutcomes || {};
            opts = stepsOrConfig.options || stepsOrConfig;
        }

        const totalSteps = Array.isArray(steps) ? steps.length : 0;
        outcomes = typeof outcomes === 'object' && outcomes !== null ? outcomes : {};

        let passedCount = 0;
        let failedCount = 0;
        let blockedCount = 0;
        let skippedCount = 0;
        let pendingCount = 0;
        let errorCount = 0;

        // Tally outcomes
        for (let i = 0; i < totalSteps; i++) {
            const rawVal = outcomes[i] || outcomes[String(i)] || (steps[i] && steps[i].status) || 'pending';
            const val = String(rawVal).toLowerCase().trim();

            if (val === 'passed') passedCount++;
            else if (val === 'failed') failedCount++;
            else if (val === 'blocked') blockedCount++;
            else if (val === 'skipped') skippedCount++;
            else if (val === 'error' || val === 'infrastructure_error') errorCount++;
            else pendingCount++;
        }

        const evaluatedCount = passedCount + failedCount + blockedCount + skippedCount + errorCount;
        const violations = [];
        const summary = {
            totalSteps,
            total: totalSteps,
            evaluatedCount,
            evaluated: evaluatedCount,
            passedCount,
            passed: passedCount,
            failedCount,
            failed: failedCount,
            blockedCount,
            blocked: blockedCount,
            skippedCount,
            skipped: skippedCount,
            pendingCount,
            incomplete: pendingCount,
            errorCount
        };

        // When test case has defined steps
        if (totalSteps > 0) {
            // Rule 1: FAILED if any step failed
            if (failedCount > 0) {
                return {
                    status: 'failed',
                    derivedStatus: 'failed',
                    canCompleteAsPassed: false,
                    isComplete: evaluatedCount === totalSteps,
                    summary,
                    metrics: summary,
                    violations: []
                };
            }

            // Rule 2: ERROR if any step encountered execution/runtime error
            if (errorCount > 0) {
                return {
                    status: 'error',
                    derivedStatus: 'error',
                    canCompleteAsPassed: false,
                    isComplete: evaluatedCount === totalSteps,
                    summary,
                    metrics: summary,
                    violations: ['Execution encountered an unhandled step error']
                };
            }

            // Rule 3: BLOCKED if any step is blocked (and none failed)
            if (blockedCount > 0) {
                return {
                    status: 'blocked',
                    derivedStatus: 'blocked',
                    canCompleteAsPassed: false,
                    isComplete: evaluatedCount === totalSteps,
                    summary,
                    metrics: summary,
                    violations: []
                };
            }

            // Rule 4: SKIPPED if all steps are intentionally skipped
            if (skippedCount === totalSteps) {
                return {
                    status: 'skipped',
                    derivedStatus: 'skipped',
                    canCompleteAsPassed: false,
                    isComplete: true,
                    summary,
                    metrics: summary,
                    violations: []
                };
            }

            // Rule 5: PASSED ONLY if every step is completed and passed (no failed, blocked, skipped, or pending)
            if (passedCount === totalSteps && evaluatedCount === totalSteps) {
                return {
                    status: 'passed',
                    derivedStatus: 'passed',
                    canCompleteAsPassed: true,
                    isComplete: true,
                    summary,
                    metrics: summary,
                    violations: []
                };
            }

            // Rule 6: IN_PROGRESS if some steps were evaluated but not all
            if (evaluatedCount > 0 && evaluatedCount < totalSteps) {
                violations.push(`${totalSteps - evaluatedCount} of ${totalSteps} step(s) remain unevaluated.`);
                return {
                    status: 'in_progress',
                    derivedStatus: 'in_progress',
                    canCompleteAsPassed: false,
                    isComplete: false,
                    summary,
                    metrics: summary,
                    violations
                };
            }

            // Rule 7: NOT_EXECUTED if 0 steps evaluated
            return {
                status: 'not_run',
                derivedStatus: 'not_run',
                canCompleteAsPassed: false,
                isComplete: false,
                summary,
                metrics: summary,
                violations: ['No steps have been evaluated.']
            };
        }

        // Test case without defined steps: Explicit verification policy
        const actualResult = (opts.actualResult || '').trim();
        const requestedStatus = (opts.requestedStatus || 'not_run').toLowerCase();

        if (requestedStatus === 'passed') {
            if (!actualResult || actualResult.length < 5) {
                violations.push('Test cases without discrete steps require written verification observation (minimum 5 characters) to complete as Passed.');
                return {
                    status: 'in_progress',
                    derivedStatus: 'in_progress',
                    canCompleteAsPassed: false,
                    isComplete: false,
                    summary,
                    metrics: summary,
                    violations
                };
            }
            return {
                status: 'passed',
                derivedStatus: 'passed',
                canCompleteAsPassed: true,
                isComplete: true,
                summary,
                metrics: summary,
                violations: []
            };
        }

        if (['failed', 'blocked', 'skipped'].includes(requestedStatus)) {
            return {
                status: requestedStatus,
                derivedStatus: requestedStatus,
                canCompleteAsPassed: false,
                isComplete: true,
                summary,
                metrics: summary,
                violations: []
            };
        }

        return {
            status: 'not_run',
            derivedStatus: 'not_run',
            canCompleteAsPassed: false,
            isComplete: false,
            summary,
            metrics: summary,
            violations: []
        };
    }

    /**
     * Validates whether a manual execution completion request is permissible
     * Prevents false passes, partial executions reported as Passed, or duplicate submissions
     */
    validateCompletionRequest(config = {}) {
        let steps = config.steps || [];
        let stepOutcomes = config.stepOutcomes || {};
        let requestedStatus = (config.requestedStatus || 'passed').toLowerCase();
        let actualResult = config.actualResult || '';

        const evaluation = this.evaluateExecutionStatus(steps, stepOutcomes, { requestedStatus, actualResult });

        // If client requested Passed but steps derived Failed, Blocked, or In Progress:
        if (requestedStatus === 'passed') {
            if (!evaluation.canCompleteAsPassed) {
                const code = (!steps || steps.length === 0) && (!actualResult || actualResult.trim().length < 5)
                    ? 'MISSING_ACTUAL_RESULT'
                    : evaluation.summary.failedCount > 0
                    ? 'INVALID_STATUS_OVERRIDE'
                    : evaluation.status === 'in_progress'
                    ? 'INCOMPLETE_STEPS'
                    : 'STATUS_PRECEDENCE_VIOLATION';
                const message = code === 'INCOMPLETE_STEPS'
                    ? `Test case cannot be completed as "passed" while ${evaluation.summary.pendingCount || 1} required step(s) remain incomplete.`
                    : code === 'MISSING_ACTUAL_RESULT'
                    ? 'Test cases without steps require written verification observations to pass.'
                    : evaluation.violations[0] || `Cannot complete execution as Passed: step outcomes evaluate to ${evaluation.status.toUpperCase()}.`;
                return {
                    isValid: false,
                    valid: false,
                    code,
                    message,
                    error: message,
                    evaluation
                };
            }
        }

        // If steps contain a failure, overall status CANNOT be anything other than failed
        if (evaluation.summary.failedCount > 0 && requestedStatus !== 'failed') {
            const message = 'A test case with failed steps must be recorded with status "failed".';
            return {
                isValid: false,
                valid: false,
                code: 'INVALID_STATUS_OVERRIDE',
                message,
                error: message,
                evaluation
            };
        }

        // If steps contain a blocker and no failures, overall status cannot be passed
        if (evaluation.summary.blockedCount > 0 && evaluation.summary.failedCount === 0 && requestedStatus === 'passed') {
            const message = 'A test case with blocked steps cannot be completed as "passed".';
            return {
                isValid: false,
                valid: false,
                code: 'BLOCKED_PRECEDENCE_VIOLATION',
                message,
                error: message,
                evaluation
            };
        }

        return {
            isValid: true,
            valid: true,
            effectiveStatus: evaluation.status,
            finalStatus: evaluation.status,
            evaluation
        };
    }
}

module.exports = new ExecutionStatusEngineService();
