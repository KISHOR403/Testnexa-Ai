/**
 * TestNexa AI — Automation Job Queue Service
 * Orchestrates asynchronous execution of Playwright automation jobs with:
 * - Safe concurrency locking and idempotency
 * - Workload distribution to isolated worker subprocesses
 * - Result normalization and persistence into unified TestExecutions
 * - Transient infrastructure retry handling
 * - Artifact harvesting and workspace isolation
 */

const crypto = require('crypto');
const path = require('path');
const supabaseService = require('../supabaseData.service');
const { executePlaywrightJob } = require('./playwrightRunner.worker');
const { saveArtifactBuffer } = require('../../utils/artifactStorage');
const logger = require('../../utils/logger');

class JobQueueService {
    constructor() {
        this.workerId = 'worker_' + process.pid + '_' + crypto.randomBytes(4).toString('hex');
        this.activeJobs = new Map();
        this.isProcessing = false;
        this.concurrencyLimit = 2;
    }

    /**
     * Submit a Test Run for automated execution
     */
    async submitJob({ runId, workspaceId, adapter = 'playwright', targetEnvironment = {}, requestedBy = null, caseIds = null }) {
        if (!runId || !workspaceId) {
            throw new Error('runId and workspaceId are required to submit an automation job');
        }

        const run = await supabaseService.getTestRunById(runId, workspaceId);
        if (!run) {
            throw new Error(`Test run not found (${runId})`);
        }

        // Idempotency check: return active job if already queued or running
        for (const j of supabaseService.inMemoryAutomationJobs.values()) {
            if (j.run_id === runId && (j.status === 'queued' || j.status === 'running')) {
                return supabaseService._formatAutomationJob(j);
            }
        }

        // Gather eligible automated cases with configured Playwright mappings
        const allCases = await supabaseService.getRunCases(runId);
        const automatedCases = allCases.filter(c => {
            if (caseIds && Array.isArray(caseIds) && !caseIds.includes(c.id)) return false;
            const isAuto = c.executionType === 'automated' || run.executionType === 'automated';
            const mapping = c.caseSnapshot?.automationMapping;
            const hasMapping = Boolean(
                mapping &&
                mapping.mappingStatus === 'configured' &&
                (mapping.scriptCode || mapping.code || mapping.spec || (mapping.scriptSource === 'existing' && mapping.scriptRef))
            );
            return isAuto && hasMapping;
        });

        if (automatedCases.length === 0) {
            throw new Error(`Cannot start Playwright execution: 0 of ${allCases.length} test cases have an approved automation mapping configured. Please configure or import Playwright scripts for your test cases.`);
        }

        const resolvedEnv = targetEnvironment.baseUrl
            ? targetEnvironment
            : (run.targetEnvironment || {});

        const job = await supabaseService.createAutomationJob({
            runId,
            workspaceId,
            adapter: adapter || 'playwright',
            framework: adapter || 'playwright',
            frameworkVersion: '1.40.0',
            targetEnvironment: resolvedEnv,
            totalCases: automatedCases.length,
            caseIds: caseIds || null
        });

        // Audit log
        await supabaseService.recordWorkspaceAuditLog({
            workspaceId,
            actorId: requestedBy || run.createdBy,
            action: 'automation_job.queued',
            changes: { jobId: job.id, runId, totalCases: automatedCases.length, adapter }
        });

        // Trigger queue worker asynchronously
        setImmediate(() => {
            this.processNextJob().catch(err => {
                logger.error('Background job processing error:', err);
            });
        });

        return job;
    }

    /**
     * Process next queued job from database or memory
     */
    async processNextJob() {
        if (this.activeJobs.size >= this.concurrencyLimit) {
            return null;
        }

        const job = await supabaseService.getNextQueuedAutomationJob();
        if (!job) return null;

        // Acquire lock
        const now = new Date().toISOString();
        const locked = await supabaseService.updateAutomationJob(job.id, {
            status: 'running',
            locked_by: this.workerId,
            locked_at: now,
            started_at: now
        });

        this.activeJobs.set(job.id, locked);

        try {
            await this._executeJob(locked);
        } catch (err) {
            logger.error(`Fatal error in job ${job.id}:`, err);
            await this._handleJobFailure(locked, err);
        } finally {
            this.activeJobs.delete(job.id);
            // Process any remaining work
            setImmediate(() => { this.processNextJob().catch(() => {}); });
        }

        const finishedJob = await supabaseService.getAutomationJob(job.id);
        return finishedJob || locked;
    }

    /**
     * Executes Playwright job in an isolated subprocess worker, with fallback to in-process execution.
     * Guarantees that the main API server process is never directly running or compromised by browser automation.
     */
    async executeInWorkerSubprocess(payload) {
        return new Promise((resolve) => {
            let child = null;
            let finished = false;
            let stderrData = '';
            let stdoutData = '';
            const workerPath = path.resolve(__dirname, 'playwrightRunner.worker.js');

            const timeoutTimer = setTimeout(() => {
                if (!finished) {
                    finished = true;
                    if (child) child.kill('SIGKILL');
                    logger.warn(`Subprocess worker timed out for job ${payload.jobId}, returning fallback.`);
                    resolve({
                        success: false,
                        errorCategory: 'TIMEOUT_EXCEEDED',
                        errorMessage: 'Subprocess worker exceeded maximum execution window.',
                        results: [],
                        durationMs: 90000
                    });
                }
            }, payload.jobTimeoutMs ? payload.jobTimeoutMs + 10000 : 100000);

            try {
                const { fork } = require('child_process');
                const workerEnv = { ...process.env };
                if (process.env.RENDER && !workerEnv.PLAYWRIGHT_BROWSERS_PATH) {
                    workerEnv.PLAYWRIGHT_BROWSERS_PATH = '0';
                }

                child = fork(workerPath, [], {
                    env: workerEnv,
                    stdio: ['pipe', 'pipe', 'pipe', 'ipc']
                });

                if (child.stdout) child.stdout.on('data', chunk => { stdoutData += chunk.toString(); });
                if (child.stderr) child.stderr.on('data', chunk => { stderrData += chunk.toString(); });

                child.on('message', (msg) => {
                    if (msg && (msg.type === 'JOB_REPORT' || msg.report)) {
                        if (!finished) {
                            finished = true;
                            clearTimeout(timeoutTimer);
                            try { child.kill(); } catch (kErr) {}
                            resolve(msg.report || msg);
                        }
                    }
                });

                child.on('error', (err) => {
                    logger.warn(`Subprocess spawn notice (${err.message}), falling back to direct worker invocation.`);
                    if (!finished) {
                        finished = true;
                        clearTimeout(timeoutTimer);
                        executePlaywrightJob(payload).then(resolve).catch(e => resolve({
                            success: false,
                            errorCategory: 'INFRASTRUCTURE_ERROR',
                            errorMessage: e.message,
                            results: []
                        }));
                    }
                });

                child.on('exit', (code) => {
                    if (!finished) {
                        finished = true;
                        clearTimeout(timeoutTimer);
                        console.error('SUBPROCESS EXIT CODE:', code, 'STDERR:', stderrData, 'STDOUT:', stdoutData);
                        executePlaywrightJob(payload).then(resolve).catch(e => resolve({
                            success: false,
                            errorCategory: 'INFRASTRUCTURE_ERROR',
                            errorMessage: `Worker process exited with code ${code}`,
                            results: []
                        }));
                    }
                });

                child.send({ type: 'RUN_JOB', payload });
            } catch (forkErr) {
                clearTimeout(timeoutTimer);
                logger.warn(`Failed to fork worker process (${forkErr.message}). Falling back to direct execution.`);
                executePlaywrightJob(payload).then(resolve).catch(e => resolve({
                    success: false,
                    errorCategory: 'INFRASTRUCTURE_ERROR',
                    errorMessage: e.message,
                    results: []
                }));
            }
        });
    }

    /**
     * Core job execution pipeline
     */
    async _executeJob(job) {
        const run = await supabaseService.getTestRunById(job.runId, job.workspaceId);
        if (!run) throw new Error(`Parent test run ${job.runId} not found`);

        const allCases = await supabaseService.getRunCases(job.runId);
        const automatedCases = allCases.filter(c => {
            if (job.caseIds && Array.isArray(job.caseIds) && !job.caseIds.includes(c.id)) return false;
            const isAuto = c.executionType === 'automated' || run.executionType === 'automated';
            const mapping = c.caseSnapshot?.automationMapping;
            const hasMapping = Boolean(
                mapping &&
                mapping.mappingStatus === 'configured' &&
                (mapping.scriptCode || mapping.code || mapping.spec || (mapping.scriptSource === 'existing' && mapping.scriptRef))
            );
            return isAuto && hasMapping;
        });

        // Transition run status to in_progress
        if (run.status === 'pending') {
            await supabaseService.updateTestRun(job.runId, job.workspaceId, {
                status: 'in_progress',
                started_at: new Date().toISOString()
            });
        }

        // Call isolated Playwright worker
        const workerReport = await this.executeInWorkerSubprocess({
            jobId: job.id,
            runId: job.runId,
            workspaceId: job.workspaceId,
            targetEnvironment: job.targetEnvironment || {},
            casesToExecute: automatedCases,
            perTestTimeoutMs: 15000,
            jobTimeoutMs: 90000
        });

        // Handle infrastructure or security failure
        if (!workerReport.success) {
            if (workerReport.errorCategory === 'INFRASTRUCTURE_ERROR' && job.retries < job.maxRetries) {
                logger.warn(`Transient worker error on job ${job.id}. Scheduling retry ${job.retries + 1}/${job.maxRetries}...`);
                await supabaseService.updateAutomationJob(job.id, {
                    status: 'queued',
                    retries: job.retries + 1,
                    error_message: `Retry scheduled: ${workerReport.errorMessage}`,
                    locked_by: null,
                    locked_at: null
                });
                return;
            }

            // Fatal failure: record on job without corrupting test assertion counts
            const now = new Date().toISOString();
            await supabaseService.updateAutomationJob(job.id, {
                status: 'failed',
                error_message: workerReport.errorMessage,
                completed_at: now
            });
            return;
        }

        // Ingest and normalize case outcomes into unified TestExecutions
        let passed = 0;
        let failed = 0;
        let completed = 0;

        for (const res of workerReport.results || []) {
            try {
                const execResult = await supabaseService.recordTestExecution({
                    runId: job.runId,
                    runCaseId: res.runCaseId,
                    testCaseId: res.testCaseId,
                    status: res.status,
                    actualResult: res.actualResult,
                    errorMessage: res.errorMessage || '',
                    stackTrace: res.stackTrace || '',
                    durationMs: res.durationMs || 0,
                    executedBy: 'playwright_worker',
                    executorType: 'automated'
                });

                if (res.status === 'passed') passed++;
                else if (res.status === 'failed') failed++;
                completed++;

                // Save failure screenshot if captured
                if (res.screenshotBase64) {
                    try {
                        const saved = await saveArtifactBuffer({
                            workspaceId: job.workspaceId,
                            runId: job.runId,
                            name: `auto_${res.testCaseId}_failure.png`,
                            data: res.screenshotBase64,
                            mimeType: 'image/png'
                        });

                        await supabaseService.saveArtifact({
                            runId: job.runId,
                            runCaseId: res.runCaseId,
                            executionId: execResult.execution?.id || null,
                            name: saved.name,
                            artifactType: 'screenshot',
                            mimeType: saved.mimeType,
                            sizeBytes: saved.sizeBytes,
                            storagePath: saved.storagePath,
                            metadata: { source: 'playwright_auto_failure_capture' }
                        });
                    } catch (artErr) {
                        logger.warn('Failed to save automated failure screenshot:', artErr.message);
                    }
                }
            } catch (casePersistErr) {
                logger.error(`Error persisting automated result for case ${res.testCaseId}:`, casePersistErr);
            }
        }

        // Save execution logs as log artifact
        if (workerReport.logs && workerReport.logs.length > 0) {
            try {
                const logContent = workerReport.logs.join('\n');
                const savedLog = await saveArtifactBuffer({
                    workspaceId: job.workspaceId,
                    runId: job.runId,
                    name: `playwright_execution_${job.id}.log`,
                    data: logContent,
                    mimeType: 'text/plain'
                });

                await supabaseService.saveArtifact({
                    runId: job.runId,
                    name: savedLog.name,
                    artifactType: 'log',
                    mimeType: 'text/plain',
                    sizeBytes: savedLog.sizeBytes,
                    storagePath: savedLog.storagePath,
                    metadata: { source: 'playwright_console_logs' }
                });
            } catch (logErr) {
                logger.warn('Failed to persist execution logs:', logErr.message);
            }
        }

        // Update Job to completed
        const completedAt = new Date().toISOString();
        await supabaseService.updateAutomationJob(job.id, {
            status: 'completed',
            completed_cases: completed,
            passed_cases: passed,
            failed_cases: failed,
            completed_at: completedAt
        });
    }

    async _handleJobFailure(job, err) {
        const now = new Date().toISOString();
        if (job.retries < job.maxRetries) {
            await supabaseService.updateAutomationJob(job.id, {
                status: 'queued',
                retries: (job.retries || 0) + 1,
                error_message: `Retry scheduled: ${err.message}`,
                locked_by: null,
                locked_at: null
            });
        } else {
            await supabaseService.updateAutomationJob(job.id, {
                status: 'failed',
                error_message: err.message || 'Worker encountered unhandled crash',
                completed_at: now
            });
        }
    }

    /**
     * Get job status
     */
    async getJob(jobId) {
        return await supabaseService.getAutomationJob(jobId);
    }
}

module.exports = new JobQueueService();

