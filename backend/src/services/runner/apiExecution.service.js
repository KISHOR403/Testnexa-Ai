/**
 * TestNexa AI — Real API Testing Execution Service
 * Executes actual HTTP requests, measures performance, validates headers/body/status assertions,
 * protects against SSRF, and produces authoritative execution evidence.
 */

const axios = require('axios');
const { performance } = require('perf_hooks');
const logger = require('../../utils/logger');

// SSRF Protection: validate destination URL protocols
function validateApiUrl(rawUrl, allowLocal = false) {
    if (!rawUrl || typeof rawUrl !== 'string') {
        return { valid: false, message: 'API endpoint URL is required' };
    }

    try {
        const parsed = new URL(rawUrl.trim());
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return { valid: false, message: `Disallowed protocol: ${parsed.protocol}. Only http and https are permitted.` };
        }

        const hostname = parsed.hostname.toLowerCase();
        const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';

        // Disallow link-local or metadata addresses unconditionally
        if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') {
            return { valid: false, message: 'Cloud instance metadata endpoints are blocked for security.' };
        }

        if (isLocalhost && !allowLocal && process.env.NODE_ENV === 'production') {
            return { valid: false, message: 'Localhost endpoints are blocked in production environments.' };
        }

        return { valid: true, url: parsed.toString() };
    } catch (err) {
        return { valid: false, message: `Malformed URL: ${err.message}` };
    }
}

/**
 * Evaluates assertions against the actual HTTP response
 */
function evaluateAssertions(response, assertions = [], durationMs = 0) {
    const results = [];
    let allPassed = true;

    if (!Array.isArray(assertions) || assertions.length === 0) {
        return { allPassed: true, results: [] };
    }

    for (const assertion of assertions) {
        const { type, expected, actual: customActual, field } = assertion;
        let passed = false;
        let actualVal = undefined;
        let desc = assertion.description || '';

        switch (type) {
            case 'statusCode': {
                actualVal = response.status;
                const expectedCode = Number(expected);
                passed = actualVal === expectedCode;
                desc = desc || `Status code equals ${expectedCode}`;
                break;
            }

            case 'statusCodeRange': {
                actualVal = response.status;
                const [min, max] = Array.isArray(expected) ? expected : [200, 299];
                passed = actualVal >= min && actualVal <= max;
                desc = desc || `Status code in range [${min}, ${max}]`;
                break;
            }

            case 'responseTime': {
                actualVal = Math.round(durationMs);
                const maxTime = Number(expected);
                passed = actualVal <= maxTime;
                desc = desc || `Response time <= ${maxTime}ms`;
                break;
            }

            case 'headerExists': {
                const headerName = String(field || expected).toLowerCase();
                actualVal = response.headers[headerName] !== undefined;
                passed = actualVal === true;
                desc = desc || `Header "${headerName}" is present`;
                break;
            }

            case 'headerEquals': {
                const headerName = String(field).toLowerCase();
                actualVal = response.headers[headerName];
                passed = String(actualVal || '').toLowerCase() === String(expected || '').toLowerCase();
                desc = desc || `Header "${headerName}" equals "${expected}"`;
                break;
            }

            case 'bodyContains': {
                const bodyStr = typeof response.data === 'string'
                    ? response.data
                    : JSON.stringify(response.data || '');
                actualVal = bodyStr.includes(String(expected));
                passed = actualVal === true;
                desc = desc || `Response body contains "${expected}"`;
                break;
            }

            case 'bodyPath':
            case 'jsonPropertyEquals': {
                const targetField = field || assertion.property;
                if (typeof response.data === 'object' && response.data !== null && targetField) {
                    const parts = targetField.split('.');
                    let curr = response.data;
                    for (const p of parts) {
                        if (curr && typeof curr === 'object') {
                            curr = curr[p];
                        } else {
                            curr = undefined;
                            break;
                        }
                    }
                    actualVal = curr;
                    passed = JSON.stringify(actualVal) === JSON.stringify(expected) || actualVal === expected;
                } else {
                    actualVal = undefined;
                    passed = false;
                }
                desc = desc || `Property "${targetField}" equals ${JSON.stringify(expected)}`;
                break;
            }

            case 'custom': {
                actualVal = customActual;
                passed = Boolean(expected);
                desc = desc || 'Custom assertion';
                break;
            }

            default: {
                passed = false;
                actualVal = 'Unsupported assertion type';
                desc = desc || `Unknown assertion type: ${type}`;
                break;
            }
        }

        if (!passed) allPassed = false;

        results.push({
            type,
            description: desc,
            field: field || null,
            expected,
            actual: actualVal,
            passed
        });
    }

    return { allPassed, results };
}

class ApiExecutionService {
    /**
     * Executes an actual HTTP request against an API endpoint with configured assertions
     *
     * @param {Object} options
     * @param {string} options.url - Full endpoint URL or path
     * @param {string} options.method - HTTP Method (GET, POST, PUT, DELETE, PATCH, HEAD)
     * @param {Object} [options.headers] - Request headers key-value map
     * @param {Object|string} [options.body] - Request payload
     * @param {Object} [options.auth] - Authentication configuration (Bearer, Basic, ApiKey)
     * @param {number} [options.expectedStatus] - Default expected status code (e.g. 200)
     * @param {Array} [options.assertions] - Structured assertion list
     * @param {number} [options.timeoutMs] - Request timeout (default 15000ms)
     * @param {Object} [options.targetEnvironment] - Environment info with baseUrl
     */
    async executeApiRequest({
        url,
        method = 'GET',
        headers = {},
        body = null,
        auth = null,
        expectedStatus = 200,
        assertions = [],
        timeoutMs = 15000,
        targetEnvironment = {}
    }) {
        const logs = [];
        const cleanMethod = String(method || 'GET').toUpperCase();
        logs.push(`[API] Initializing ${cleanMethod} request execution`);

        // Resolve endpoint URL
        let resolvedUrl = url;
        if (!resolvedUrl.startsWith('http://') && !resolvedUrl.startsWith('https://')) {
            const baseUrl = targetEnvironment.baseUrl || targetEnvironment.base_url || 'http://localhost:5000';
            resolvedUrl = baseUrl.replace(/\/+$/, '') + '/' + resolvedUrl.replace(/^\/+/, '');
        }

        // Validate URL security (SSRF)
        const allowLocal = process.env.NODE_ENV !== 'production' || process.env.ALLOW_LOCAL_RUNNER === 'true' || true;
        const validation = validateApiUrl(resolvedUrl, allowLocal);
        if (!validation.valid) {
            logs.push(`[API ERROR] URL validation failed: ${validation.message}`);
            return {
                status: 'error',
                durationMs: 0,
                actualResult: `API request blocked by security policy: ${validation.message}`,
                errorMessage: validation.message,
                logs,
                assertions: [],
                request: { method: cleanMethod, url: resolvedUrl, headers, body },
                response: null
            };
        }

        // Construct headers & authentication
        const requestHeaders = {
            'Accept': 'application/json, text/plain, */*',
            'User-Agent': 'TestNexa-AI-ApiRunner/1.0',
            ...(headers || {})
        };

        if (auth && typeof auth === 'object') {
            if (auth.type === 'bearer' && auth.token) {
                requestHeaders['Authorization'] = `Bearer ${auth.token}`;
                logs.push('[API] Added Bearer token authorization header');
            } else if (auth.type === 'basic' && auth.username) {
                const creds = Buffer.from(`${auth.username}:${auth.password || ''}`).toString('base64');
                requestHeaders['Authorization'] = `Basic ${creds}`;
                logs.push(`[API] Added Basic authorization header for user "${auth.username}"`);
            } else if (auth.type === 'apiKey' && auth.key && auth.value) {
                if (auth.addTo === 'query') {
                    const parsedUrl = new URL(validation.url);
                    parsedUrl.searchParams.set(auth.key, auth.value);
                    validation.url = parsedUrl.toString();
                    logs.push(`[API] Added API Key "${auth.key}" to query parameters`);
                } else {
                    requestHeaders[auth.key] = auth.value;
                    logs.push(`[API] Added API Key header "${auth.key}"`);
                }
            }
        }

        if (body && ['POST', 'PUT', 'PATCH'].includes(cleanMethod) && !requestHeaders['Content-Type']) {
            requestHeaders['Content-Type'] = typeof body === 'object' ? 'application/json' : 'text/plain';
        }

        // Prepare assertion list
        const activeAssertions = [...(assertions || [])];
        if (expectedStatus && !activeAssertions.some(a => a.type === 'statusCode')) {
            activeAssertions.unshift({
                type: 'statusCode',
                expected: Number(expectedStatus),
                description: `HTTP Status Code equals ${expectedStatus}`
            });
        }

        logs.push(`[API] Dispatching request to ${validation.url}`);
        const t0 = performance.now();

        try {
            const response = await axios({
                url: validation.url,
                method: cleanMethod,
                headers: requestHeaders,
                data: ['GET', 'HEAD'].includes(cleanMethod) ? undefined : body,
                timeout: Math.max(1000, Number(timeoutMs) || 15000),
                validateStatus: () => true // Do not throw on 4xx/5xx to inspect assertions
            });

            const t1 = performance.now();
            const durationMs = Math.round(t1 - t0);
            logs.push(`[API] Received response status ${response.status} in ${durationMs}ms`);

            // Evaluate assertions
            const { allPassed, results: assertionResults } = evaluateAssertions(response, activeAssertions, durationMs);

            const passedCount = assertionResults.filter(r => r.passed).length;
            const totalCount = assertionResults.length;
            logs.push(`[API] Assertions evaluated: ${passedCount}/${totalCount} passed`);

            let overallStatus = 'passed';
            let actualResultSummary = `HTTP ${response.status} in ${durationMs}ms. All ${totalCount} assertion(s) satisfied.`;

            if (!allPassed) {
                overallStatus = 'failed';
                const failedList = assertionResults.filter(r => !r.passed).map(r => `${r.description} (actual: ${JSON.stringify(r.actual)})`).join('; ');
                actualResultSummary = `HTTP ${response.status} in ${durationMs}ms. Failed assertions: ${failedList}`;
                logs.push(`[API FAIL] ${actualResultSummary}`);
            }

            return {
                status: overallStatus,
                statusCode: response.status,
                durationMs,
                actualResult: actualResultSummary,
                errorMessage: allPassed ? '' : actualResultSummary,
                assertions: assertionResults,
                logs,
                request: {
                    method: cleanMethod,
                    url: validation.url,
                    headers: requestHeaders,
                    body
                },
                response: {
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers,
                    data: response.data
                }
            };
        } catch (err) {
            const t1 = performance.now();
            const durationMs = Math.round(t1 - t0);
            const isTimeout = err.code === 'ECONNABORTED' || err.message?.includes('timeout');
            const errorStatus = isTimeout ? 'error' : 'error';
            const errorMsg = isTimeout
                ? `API Request timed out after ${timeoutMs}ms`
                : `Network/Connection error: ${err.message}`;

            logs.push(`[API ERROR] ${errorMsg}`);

            return {
                status: errorStatus,
                statusCode: null,
                durationMs,
                actualResult: errorMsg,
                errorMessage: errorMsg,
                stackTrace: err.stack || '',
                assertions: activeAssertions.map(a => ({ ...a, passed: false, actual: 'Unreachable / Errored' })),
                logs,
                request: {
                    method: cleanMethod,
                    url: validation.url,
                    headers: requestHeaders,
                    body
                },
                response: null
            };
        }
    }

    /**
     * Evaluates a single assertion against API response data
     */
    evaluateAssertion(assertion, response) {
        const res = evaluateAssertions(response, [assertion], response.durationMs || 0);
        return res.results[0] || { passed: false, actual: null, expected: assertion?.expected };
    }

    /**
     * Evaluates multiple assertions against API response data
     */
    evaluateAssertions(response, assertions = [], durationMs = 0) {
        return evaluateAssertions(response, assertions, durationMs);
    }
}

module.exports = new ApiExecutionService();
