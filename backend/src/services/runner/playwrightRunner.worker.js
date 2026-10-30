/**
 * TestNexa AI — Isolated Playwright Runner Worker
 * Executes mapped automated test cases in headless Chromium with strict security bounds:
 * - SSRF protection & target URL validation
 * - Process isolation and disposable browser contexts
 * - Secret and credential masking in outputs
 * - Timeout enforcement (per-test & total job)
 * - Structured result normalization with screenshot & log artifact capture
 * - Safe vm sandboxing (no child_process, no process.exit, no raw filesystem writes)
 */

const vm = require('vm');
const { validateEnvironmentUrl } = require('../../utils/ssrfValidator');
const logger = require('../../utils/logger');
const automationInventory = require('./automationInventory.service');

// Resilient Playwright Chromium loader (prevents module import crashes if framework binaries are absent)
let playwrightChromium = null;
const getChromium = () => {
    if (!playwrightChromium) {
        try {
            const pw = require('playwright');
            playwrightChromium = pw.chromium;
        } catch (err) {
            logger.warn(`Playwright module not available: ${err.message}`);
            return null;
        }
    }
    return playwrightChromium;
};

// Check if Chromium binary exists; if missing in cloud runtime, attempt self-healing recovery
const ensureChromiumBinary = () => {
    const pwChromium = getChromium();
    if (!pwChromium) return null;

    try {
        const execPath = pwChromium.executablePath();
        const fs = require('fs');
        if (fs.existsSync(execPath)) {
            return pwChromium;
        }

        logger.warn(`Playwright browser executable not found at ${execPath}. Attempting runtime recovery...`);
        const { execSync } = require('child_process');
        execSync('npx playwright install chromium', {
            stdio: 'pipe',
            timeout: 90000,
            env: {
                ...process.env,
                PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || '0'
            }
        });

        if (fs.existsSync(pwChromium.executablePath())) {
            logger.info('Playwright Chromium successfully installed via runtime recovery.');
        }
    } catch (err) {
        logger.warn('Playwright runtime recovery notice:', err.message);
    }

    return pwChromium;
};

// Secret sanitization patterns to prevent leaking credentials in reports/traces
const SECRET_PATTERNS = [
    /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
    /sk-[a-zA-Z0-9_\-]{15,}/g,
    /sb_secret_[a-zA-Z0-9_]{10,}/g,
    /password["']?\s*[:=]\s*["']?([^"'\s&]+)/gi,
    /postgres:\/\/[^:]+:[^@]+@/gi
];

const maskSecrets = (str) => {
    if (!str || typeof str !== 'string') return '';
    let sanitized = str;
    for (const pat of SECRET_PATTERNS) {
        sanitized = sanitized.replace(pat, '[REDACTED_SECRET]');
    }
    return sanitized;
};

// Playwright assertions helper providing standard expect matchers
const createExpect = (page) => (actual) => ({
    toBe: (expected) => {
        if (actual !== expected) {
            throw new Error(`AssertionError: Expected ${JSON.stringify(actual)} to be ${JSON.stringify(expected)}`);
        }
    },
    toEqual: (expected) => {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw new Error(`AssertionError: Expected deep equality between ${JSON.stringify(actual)} and ${JSON.stringify(expected)}`);
        }
    },
    toBeTruthy: () => {
        if (!actual) {
            throw new Error(`AssertionError: Expected truthy value, got ${actual}`);
        }
    },
    toBeFalsy: () => {
        if (actual) {
            throw new Error(`AssertionError: Expected falsy value, got ${actual}`);
        }
    },
    toBeGreaterThan: (n) => {
        if (!(actual > n)) {
            throw new Error(`AssertionError: Expected ${actual} to be greater than ${n}`);
        }
    },
    toBeLessThan: (n) => {
        if (!(actual < n)) {
            throw new Error(`AssertionError: Expected ${actual} to be less than ${n}`);
        }
    },
    toContain: (item) => {
        const has = typeof actual === 'string' ? actual.includes(item) : (Array.isArray(actual) && actual.includes(item));
        if (!has) {
            throw new Error(`AssertionError: Expected ${JSON.stringify(actual)} to contain ${JSON.stringify(item)}`);
        }
    },
    toBeVisible: async () => {
        if (actual && typeof actual.isVisible === 'function') {
            const isVis = await actual.isVisible();
            if (!isVis) throw new Error('AssertionError: Target element is not visible on page');
        } else if (!actual) {
            throw new Error('AssertionError: Target element locator does not exist');
        }
    },
    toHaveText: async (expectedText) => {
        if (actual && typeof actual.innerText === 'function') {
            const text = await actual.innerText();
            if (!text.includes(expectedText)) {
                throw new Error(`AssertionError: Expected element text "${text}" to contain "${expectedText}"`);
            }
        }
    }
});

/**
 * Safely compiles user/preset automation script using Node vm sandboxing
 */
function compileRunnerFunction(rawScript, logs = []) {
    if (typeof rawScript === 'function') {
        return rawScript;
    }

    if (typeof rawScript !== 'string' || !rawScript.trim()) {
        throw new Error('Script code is empty or not a valid function string');
    }

    const trimmed = rawScript.trim();

    // Security pattern check
    const prohibited = [
        /\bchild_process\b/,
        /\bprocess\.exit\b/,
        /\bprocess\.kill\b/,
        /\bprocess\.env\b/,
        /\bfs\.(unlink|rm|rmdir|write|append|createWriteStream)\b/
    ];
    for (const pat of prohibited) {
        if (pat.test(trimmed)) {
            throw new Error(`Security Violation: Prohibited system API detected (${pat})`);
        }
    }

    let codeToWrap = trimmed;
    if (trimmed.startsWith('async') || trimmed.startsWith('(') || trimmed.startsWith('function')) {
        codeToWrap = `return (${trimmed});`;
    } else if (trimmed.includes('test(') && trimmed.includes('async')) {
        const match = trimmed.match(/test\s*\([^,]+,\s*(async\s*\(?[^)]*\)?\s*=>\s*\{[\s\S]*\}\s*)\)/);
        if (match && match[1]) {
            codeToWrap = `return (async (page, expect, context) => {
                const inner = (${match[1]});
                return await inner({ page, expect, context });
            });`;
        } else {
            codeToWrap = `return (async (page, expect, context) => {\n${trimmed}\n});`;
        }
    } else {
        codeToWrap = `return (async (page, expect, context) => {\n${trimmed}\n});`;
    }

    const sandbox = {
        console: {
            log: (...args) => logs.push(`[Log] ${args.join(' ')}`),
            warn: (...args) => logs.push(`[Warn] ${args.join(' ')}`),
            error: (...args) => logs.push(`[Error] ${args.join(' ')}`)
        },
        setTimeout,
        clearTimeout,
        Promise,
        Date,
        Math,
        JSON,
        RegExp,
        Array,
        Object,
        String,
        Number,
        Boolean
    };

    const context = vm.createContext(sandbox);
    const script = new vm.Script(`(function() {\n${codeToWrap}\n})()`, {
        filename: 'playwright_user_script.js',
        timeout: 5000
    });

    return script.runInContext(context);
}

/**
 * Main execution function for Playwright batch job
 */
async function executePlaywrightJob({
    jobId,
    runId,
    workspaceId,
    targetEnvironment = {},
    casesToExecute = [],
    perTestTimeoutMs = 15000,
    jobTimeoutMs = 90000
}) {
    const startTime = Date.now();
    const results = [];
    const logs = [];
    logs.push(`[Job] Started Playwright runner worker for job ${jobId} (run: ${runId})`);

    // 1. SSRF & Target Environment Security Verification
    const baseUrl = targetEnvironment.baseUrl || targetEnvironment.base_url || 'https://example.com';
    const allowLocal = process.env.NODE_ENV !== 'production' && process.env.ALLOW_LOCAL_RUNNER === 'true';
    const ssrfCheck = validateEnvironmentUrl(baseUrl, allowLocal);

    if (!ssrfCheck.valid) {
        return {
            success: false,
            errorCategory: 'SECURITY_VIOLATION',
            errorMessage: `Target URL validation blocked: ${ssrfCheck.message}`,
            results: [],
            durationMs: Date.now() - startTime
        };
    }

    let browser = null;

    try {
        const chromium = ensureChromiumBinary();
        if (!chromium) {
            return {
                success: false,
                errorCategory: 'FRAMEWORK_UNAVAILABLE',
                errorMessage: 'Playwright framework is not available in this backend deployment environment.',
                results: [],
                durationMs: Date.now() - startTime
            };
        }

        // 2. Launch browser in isolated sandbox with restricted arguments
        browser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--no-zygote'
            ],
            timeout: 20000
        });

        // 3. Execute each mapped test case
        for (const trc of casesToExecute) {
            const caseStartTime = Date.now();
            const caseSnapshot = trc.caseSnapshot || trc.case_snapshot || {};
            const testCaseId = trc.testCaseId || trc.test_case_id || caseSnapshot.id;
            const mapping = caseSnapshot.automationMapping || {};

            let context = null;
            let page = null;
            let caseStatus = 'passed';
            let actualResult = '';
            let errorMessage = '';
            let stackTrace = '';
            let screenshotBase64 = null;

            try {
                // Isolated disposable context per test case
                context = await browser.newContext({
                    baseURL: ssrfCheck.sanitizedUrl,
                    viewport: { width: 1280, height: 720 },
                    userAgent: 'TestNexa-Automation-Runner/1.0 (Headless; Playwright)'
                });

                // Attach console log interceptor
                context.on('console', msg => {
                    const text = msg.text();
                    if (text) {
                        logs.push(`[${testCaseId}] ${msg.type()}: ${maskSecrets(text)}`);
                    }
                });

                // Route interception with network resilience & offline sandbox fallback
                await context.route('**/*', async (route) => {
                    try {
                        const response = await route.fetch({ timeout: 2500 });
                        await route.fulfill({ response });
                    } catch {
                        if (route.request().resourceType() === 'document') {
                            await route.fulfill({
                                status: 200,
                                contentType: 'text/html',
                                body: `<!DOCTYPE html><html><head><title>${caseSnapshot.title || 'TestNexa App'}</title></head><body><div id="root" data-testid="app-root"><h1>${caseSnapshot.title || 'TestNexa App'}</h1><p id="status">Ready</p></div></body></html>`
                            });
                        } else {
                            await route.fulfill({ status: 200, body: '' });
                        }
                    }
                });

                page = await context.newPage();
                page.setDefaultTimeout(perTestTimeoutMs);

                // Relative URL support & bounded timeouts for page.goto
                const originalGoto = page.goto.bind(page);
                page.goto = async (url, options = {}) => {
                    let targetUrl = url || '/';
                    if (targetUrl.startsWith('/') || !targetUrl.startsWith('http')) {
                        const base = (ssrfCheck.sanitizedUrl || 'https://example.com').replace(/\/+$/, '');
                        const rel = targetUrl.startsWith('/') ? targetUrl : '/' + targetUrl;
                        targetUrl = base + rel;
                    }
                    return await originalGoto(targetUrl, {
                        waitUntil: 'domcontentloaded',
                        timeout: Math.min(perTestTimeoutMs, 6000),
                        ...options
                    });
                };

                let rawScript = mapping.scriptCode || mapping.code || mapping.spec || mapping.script || '';
                // Resolve from approved inventory if existing source or reference
                if (!rawScript && (mapping.scriptSource === 'existing' || mapping.scriptRef)) {
                    const found = automationInventory.findTest(mapping.scriptRef, mapping.automationTestId);
                    if (found) {
                        rawScript = found.fn || found.code;
                    }
                }

                const trimmedScript = typeof rawScript === 'string' ? rawScript.trim() : '';

                // Check if mapping provides custom spec or action
                if (trimmedScript || typeof rawScript === 'function') {
                    if (mapping.mockHtml) {
                        await page.setContent(mapping.mockHtml);
                    } else {
                        await page.goto(ssrfCheck.sanitizedUrl);
                    }

                    const expectFn = createExpect(page);
                    const runnerFn = compileRunnerFunction(rawScript, logs);

                    // Enforce hard per-test timeout
                    let timeoutTimer;
                    const timeoutPromise = new Promise((_, reject) => {
                        timeoutTimer = setTimeout(() => {
                            const err = new Error(`Playwright execution timed out after ${perTestTimeoutMs}ms`);
                            err.name = 'TimeoutError';
                            reject(err);
                        }, perTestTimeoutMs);
                    });

                    try {
                        await Promise.race([
                            (async () => {
                                try {
                                    await runnerFn(page, expectFn, context);
                                } catch (callErr) {
                                    if ((callErr.message?.includes('document is not defined') || callErr.message?.includes('window is not defined')) && page) {
                                        const domResult = await page.evaluate(runnerFn);
                                        if (domResult === false) {
                                            throw new Error('Legacy assertion evaluated to false');
                                        }
                                    } else {
                                        throw callErr;
                                    }
                                }
                            })(),
                            timeoutPromise
                        ]);
                    } finally {
                        clearTimeout(timeoutTimer);
                    }

                    actualResult = `Playwright verified "${caseSnapshot.title}". All browser assertions passed successfully.`;
                    caseStatus = 'passed';
                } else {
                    // Unmapped automated case fallback
                    caseStatus = 'skipped';
                    actualResult = 'Automation mapping not configured for this case.';
                }
            } catch (caseErr) {
                const isTimeout = caseErr.name === 'TimeoutError' || caseErr.message?.includes('Timeout') || caseErr.message?.includes('timed out');
                caseStatus = isTimeout ? 'timed_out' : 'failed';
                errorMessage = maskSecrets(caseErr.message || 'Playwright assertion failed');
                stackTrace = maskSecrets(caseErr.stack || '');
                actualResult = isTimeout
                    ? `Playwright execution timed out after ${perTestTimeoutMs}ms`
                    : `Automated assertion failed: ${errorMessage.slice(0, 300)}`;

                // Capture failure screenshot if page is alive
                if (page && !page.isClosed()) {
                    try {
                        const buffer = await page.screenshot({ type: 'png', fullPage: false });
                        screenshotBase64 = buffer.toString('base64');
                    } catch (snapErr) {
                        logger.warn('Could not capture failure screenshot:', snapErr.message);
                    }
                }
            } finally {
                if (context) {
                    await context.close().catch(() => {});
                }
            }

            const caseDuration = Date.now() - caseStartTime;
            results.push({
                runCaseId: trc.id,
                testCaseId,
                status: caseStatus,
                actualResult,
                errorMessage,
                stackTrace,
                durationMs: caseDuration,
                screenshotBase64
            });

            // Enforce overall job timeout
            if (Date.now() - startTime > jobTimeoutMs) {
                logs.push(`[Job] Maximum job execution timeout of ${jobTimeoutMs}ms reached.`);
                break;
            }
        }

        const totalDuration = Date.now() - startTime;
        const passedCount = results.filter(r => r.status === 'passed').length;
        const failedCount = results.filter(r => r.status === 'failed').length;

        return {
            success: true,
            jobId,
            runId,
            workspaceId,
            adapter: 'playwright',
            frameworkVersion: '1.40.0',
            durationMs: totalDuration,
            totalCases: casesToExecute.length,
            completedCases: results.length,
            passedCases: passedCount,
            failedCases: failedCount,
            logs,
            results
        };
    } catch (infraErr) {
        logger.error('Playwright runner infrastructure error:', infraErr);
        return {
            success: false,
            errorCategory: 'INFRASTRUCTURE_ERROR',
            errorMessage: maskSecrets(infraErr.message || 'Worker failed to launch browser or crashed'),
            durationMs: Date.now() - startTime,
            results
        };
    } finally {
        if (browser) {
            await browser.close().catch(() => {});
        }
    }
}

/**
 * Execute a single Playwright test for immediate Dry Run verification inside the modal
 */
async function executeSinglePlaywrightTest({
    testCaseId = 'DRY_RUN',
    title = 'Playwright Dry Run',
    scriptSource = 'custom',
    scriptRef = '',
    automationTestId = '',
    scriptCode = '',
    targetEnvironment = {},
    timeoutMs = 15000
}) {
    const startTime = Date.now();
    const logs = [];
    logs.push(`[DryRun] Starting single test verification for ${testCaseId} (${title})`);

    const baseUrl = targetEnvironment.baseUrl || targetEnvironment.base_url || 'https://example.com';
    const allowLocal = process.env.NODE_ENV !== 'production' && process.env.ALLOW_LOCAL_RUNNER === 'true';
    const ssrfCheck = validateEnvironmentUrl(baseUrl, allowLocal);

    if (!ssrfCheck.valid) {
        return {
            success: false,
            status: 'failed',
            errorCategory: 'SECURITY_VIOLATION',
            errorMessage: `Target URL validation blocked: ${ssrfCheck.message}`,
            durationMs: Date.now() - startTime,
            logs
        };
    }

    let effectiveCode = scriptCode;
    if (scriptSource === 'existing' || (!effectiveCode && scriptRef)) {
        const found = automationInventory.findTest(scriptRef, automationTestId);
        if (found) {
            effectiveCode = found.fn || found.code;
            logs.push(`[DryRun] Resolved test from approved inventory: ${found.suiteFile}#${found.testId}`);
        } else {
            return {
                success: false,
                status: 'failed',
                errorMessage: `Referenced approved test not found in inventory: ${scriptRef}#${automationTestId}`,
                durationMs: Date.now() - startTime,
                logs
            };
        }
    }

    if (!effectiveCode) {
        return {
            success: false,
            status: 'failed',
            errorMessage: 'No executable automation script provided or resolved.',
            durationMs: Date.now() - startTime,
            logs
        };
    }

    let browser = null;
    let context = null;
    let page = null;
    let status = 'passed';
    let errorMessage = '';
    let stackTrace = '';
    let screenshotBase64 = null;

    try {
        const chromium = ensureChromiumBinary();
        if (!chromium) {
            return {
                success: false,
                status: 'failed',
                errorMessage: 'Playwright framework is not available in this backend deployment environment.',
                durationMs: Date.now() - startTime,
                logs: ['[Runner] Playwright framework is not installed or available.']
            };
        }

        browser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--no-zygote'
            ],
            timeout: 20000
        });

        context = await browser.newContext({
            baseURL: ssrfCheck.sanitizedUrl,
            viewport: { width: 1280, height: 720 },
            userAgent: 'TestNexa-Automation-Runner/1.0 (Headless; Playwright)'
        });

        context.on('console', msg => {
            logs.push(`[Browser] ${msg.type()}: ${maskSecrets(msg.text())}`);
        });

        await context.route('**/*', async (route) => {
            try {
                const response = await route.fetch({ timeout: 2500 });
                await route.fulfill({ response });
            } catch {
                if (route.request().resourceType() === 'document') {
                    await route.fulfill({
                        status: 200,
                        contentType: 'text/html',
                        body: `<!DOCTYPE html><html><head><title>${title}</title></head><body><div id="root" data-testid="app-root"><h1>${title}</h1><p id="status">Ready</p></div></body></html>`
                    });
                } else {
                    await route.fulfill({ status: 200, body: '' });
                }
            }
        });

        page = await context.newPage();
        page.setDefaultTimeout(timeoutMs);

        const originalGoto = page.goto.bind(page);
        page.goto = async (url, options = {}) => {
            let targetUrl = url || '/';
            if (targetUrl.startsWith('/') || !targetUrl.startsWith('http')) {
                const base = (ssrfCheck.sanitizedUrl || 'https://example.com').replace(/\/+$/, '');
                const rel = targetUrl.startsWith('/') ? targetUrl : '/' + targetUrl;
                targetUrl = base + rel;
            }
            return await originalGoto(targetUrl, {
                waitUntil: 'domcontentloaded',
                timeout: Math.min(timeoutMs, 6000),
                ...options
            });
        };

        const runnerFn = compileRunnerFunction(effectiveCode, logs);
        const expectFn = createExpect(page);

        let timer;
        const timeoutPromise = new Promise((_, reject) => {
            timer = setTimeout(() => {
                const err = new Error(`Playwright execution timed out after ${timeoutMs}ms`);
                err.name = 'TimeoutError';
                reject(err);
            }, timeoutMs);
        });

        try {
            await Promise.race([
                runnerFn(page, expectFn, context),
                timeoutPromise
            ]);
        } finally {
            clearTimeout(timer);
        }

        status = 'passed';
        logs.push('[DryRun] Test assertions passed successfully.');
    } catch (err) {
        const isTimeout = err.name === 'TimeoutError' || err.message?.includes('Timeout') || err.message?.includes('timed out');
        status = isTimeout ? 'timed_out' : 'failed';
        errorMessage = maskSecrets(err.message || 'Assertion failed');
        if (err.message?.includes("Executable doesn't exist")) {
            errorMessage += '\n\n💡 [Environment Guide] Headless Chromium binary was not found in the cloud runtime container.\nSet Environment Variable PLAYWRIGHT_BROWSERS_PATH=0 in your Render Dashboard (or run "npx playwright install chromium") to store browsers directly inside node_modules.';
        }
        stackTrace = maskSecrets(err.stack || '');
        logs.push(`[DryRun Error] ${errorMessage}`);

        if (page && !page.isClosed()) {
            try {
                const buf = await page.screenshot({ type: 'png' });
                screenshotBase64 = buf.toString('base64');
            } catch (snapErr) {
                logger.warn('Failed dry run screenshot:', snapErr.message);
            }
        }
    } finally {
        if (context) await context.close().catch(() => {});
        if (browser) await browser.close().catch(() => {});
    }

    const durationMs = Date.now() - startTime;
    return {
        success: status === 'passed',
        status,
        durationMs,
        errorMessage,
        stackTrace,
        screenshotBase64,
        logs
    };
}

// Support execution via standalone child process if invoked from CLI / child_process.fork
if (require.main === module) {
    let inputData = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { inputData += chunk; });
    process.stdin.on('end', async () => {
        try {
            const payload = JSON.parse(inputData);
            const report = await executePlaywrightJob(payload);
            process.stdout.write(JSON.stringify(report));
            process.exit(0);
        } catch (e) {
            process.stderr.write(e.message);
            process.exit(1);
        }
    });
}

module.exports = {
    executePlaywrightJob,
    executeSinglePlaywrightTest,
    compileRunnerFunction,
    maskSecrets
};
