import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Play, RefreshCw, CheckCircle2, XCircle, Terminal, Code, AlertTriangle, ExternalLink, Globe } from 'lucide-react';
import { executionService } from '../../services/executionService';
import { Link } from 'react-router-dom';

const AutomatedExecutionModal = ({
    isOpen = true,
    onClose,
    testCase,
    onExecutionComplete,
    onSave
}) => {
    const completeHandler = onExecutionComplete || onSave;
    const [isRunning, setIsRunning] = useState(false);
    const [result, setResult] = useState(null);
    const [logs, setLogs] = useState([]);
    const [error, setError] = useState('');

    const mapping = testCase?.automationMapping || {};

    useEffect(() => {
        if (!isOpen) {
            setResult(null);
            setLogs([]);
            setError('');
            setIsRunning(false);
        }
    }, [isOpen]);

    if (!isOpen || !testCase) return null;

    const handleRun = async () => {
        setIsRunning(true);
        setError('');
        setResult(null);
        setLogs([
            `[Init] Initializing Playwright execution runner...`,
            `[Target] Suite: ${testCase.suiteName || 'Test Suite'}`,
            `[Test] Case ID: ${testCase.id} — "${testCase.title}"`,
            `[Mapping] Reference: ${mapping.scriptRef || mapping.automationTestId || 'Custom script'}`
        ]);

        try {
            // 1. Create ad-hoc automated test run to establish immutable execution record
            const runRes = await executionService.createRun({
                name: `Automated Run · ${testCase.id}`,
                suiteId: testCase.suiteId,
                executionType: 'automated',
                selectedCaseIds: [testCase.id]
            });

            if (!runRes?.success || !runRes.data) {
                throw new Error(runRes?.message || 'Failed to initialize automated test run.');
            }

            const run = runRes.data;
            const runCases = run.cases || [];
            const targetRunCase = runCases.find(c => {
                const snap = c.caseSnapshot || {};
                return String(snap.id || snap.testCaseId || c.testCaseId) === String(testCase.id);
            }) || runCases[0];

            const targetCaseIdParam = targetRunCase?.id || testCase.id;

            setLogs(prev => [
                ...prev,
                `[Run] Created execution run #${run.id} (${run.name})`,
                `[Worker] Launching headless browser execution...`
            ]);

            // 2. Execute via worker in headless Chromium
            const payload = {
                scriptSource: mapping.scriptSource || (mapping.scriptRef ? 'existing' : 'custom'),
                scriptRef: mapping.scriptRef || '',
                automationTestId: mapping.automationTestId || testCase.id,
                scriptCode: mapping.scriptCode || '',
                framework: mapping.framework || 'playwright',
                executionTimeout: mapping.timeoutMs || 30000,
                browserName: mapping.browser || 'chromium',
                headless: mapping.headless !== undefined ? mapping.headless : true
            };

            const execRes = await executionService.testCaseScript(run.id, targetCaseIdParam, payload);

            if (!execRes?.success || !execRes.data) {
                throw new Error(execRes?.message || 'Automation execution failed to return results.');
            }

            const data = execRes.data;
            const isPassed = data.status === 'passed' || data.success === true;
            const duration = data.durationMs || 1200;
            const consoleLogs = Array.isArray(data.logs) ? data.logs : (Array.isArray(data.consoleLogs) ? data.consoleLogs : []);

            setLogs(prev => [
                ...prev,
                ...consoleLogs.map(l => typeof l === 'string' ? l : JSON.stringify(l)),
                `[Worker] Completed in ${duration}ms`,
                isPassed ? `[Result] Status: PASSED` : `[Result] Status: FAILED`
            ]);

            // 3. Record attempt immutably in test run
            await executionService.recordExecution(run.id, targetCaseIdParam, {
                status: isPassed ? 'passed' : 'failed',
                actualResult: isPassed
                    ? 'All Playwright assertions verified successfully in headless Chromium.'
                    : (data.errorMessage || data.error || 'Playwright assertion or runtime error occurred.'),
                durationMs: duration,
                errorMessage: isPassed ? null : (data.errorMessage || data.error),
                stackTrace: isPassed ? null : (data.stackTrace || null),
                executorType: 'automated'
            }).catch(() => {});

            const executionOutcome = {
                status: isPassed ? 'passed' : 'failed',
                durationMs: duration,
                error: isPassed ? null : (data.errorMessage || data.error),
                runId: run.id
            };

            setResult(executionOutcome);

            if (completeHandler) {
                completeHandler(executionOutcome);
            }
        } catch (err) {
            setError(err.message || 'Execution error occurred.');
            setLogs(prev => [...prev, `[Error] ${err.message}`]);
            setResult({ status: 'failed', error: err.message });
        } finally {
            setIsRunning(false);
        }
    };

    return createPortal(
        <div className="tc-modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget && !isRunning) onClose(); }}>
            <section className="tc-form-dialog" role="dialog" aria-modal="true" aria-labelledby="tc-auto-title" style={{ maxWidth: '680px' }}>
                <header>
                    <div>
                        <span style={{ color: 'var(--tc-jade)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Playwright Execution Worker
                        </span>
                        <h2 id="tc-auto-title" style={{ margin: '4px 0 0 0', fontSize: '1.2rem', color: '#FFFFFF' }}>
                            Run Scenario: {testCase.id}
                        </h2>
                    </div>
                    <button type="button" aria-label="Close" onClick={onClose} disabled={isRunning}>
                        <X size={18} />
                    </button>
                </header>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px 20px' }}>
                    {/* Test Info Ribbon */}
                    <div style={{ background: '#101512', padding: '10px 14px', borderRadius: '5px', border: '1px solid #1B231E', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <strong style={{ color: '#FFFFFF', fontSize: '0.86rem', display: 'block' }}>{testCase.title}</strong>
                            <small style={{ color: '#7A8580', fontSize: '0.72rem' }}>
                                Mapped to: <code style={{ color: '#8BAF9A' }}>{mapping.scriptRef || mapping.automationTestId || 'tests/e2e'}</code>
                            </small>
                        </div>
                        <span style={{ background: 'rgba(139, 175, 154, 0.15)', color: '#8BAF9A', border: '1px solid rgba(139, 175, 154, 0.3)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                            Playwright ({mapping.browser || 'Chromium'})
                        </span>
                    </div>

                    {/* Execution Output Console */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem', color: '#A0A5A5' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <Terminal size={13} color="#8BAF9A" />
                                <strong>Execution Telemetry & Console Stream</strong>
                            </span>
                            {isRunning && (
                                <span style={{ color: '#8BAF9A', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <RefreshCw size={11} className="spin" /> Running in headless browser…
                                </span>
                            )}
                        </div>

                        <div style={{
                            background: '#070908',
                            border: '1px solid #1A211D',
                            borderRadius: '4px',
                            padding: '12px',
                            minHeight: '160px',
                            maxHeight: '220px',
                            overflowY: 'auto',
                            fontFamily: 'ui-monospace, monospace',
                            fontSize: '0.74rem',
                            color: '#A0A5A5',
                            lineHeight: 1.6
                        }}>
                            {logs.length === 0 ? (
                                <p style={{ margin: 0, color: '#556059' }}>
                                    Ready to launch headless Playwright worker. Click "Run Playwright Scenario" below.
                                </p>
                            ) : (
                                logs.map((line, i) => (
                                    <div key={i} style={{ color: line.includes('[Error]') || line.includes('FAILED') ? '#E06C75' : line.includes('PASSED') ? '#8BAF9A' : line.includes('[Browser]') ? '#CBD5E1' : '#8C9490' }}>
                                        {line}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Result Banner */}
                    {result && (
                        <div style={{
                            padding: '10px 14px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: result.status === 'passed' ? 'rgba(139, 175, 154, 0.15)' : 'rgba(224, 108, 117, 0.15)',
                            border: `1px solid ${result.status === 'passed' ? 'rgba(139, 175, 154, 0.35)' : 'rgba(224, 108, 117, 0.35)'}`,
                            color: result.status === 'passed' ? '#8BAF9A' : '#E06C75',
                            fontSize: '0.78rem'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {result.status === 'passed' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                                <strong>Execution Outcome: {result.status.toUpperCase()} ({result.durationMs}ms)</strong>
                            </div>
                            {result.runId && (
                                <Link
                                    to={`/app/runs/${result.runId}`}
                                    style={{ color: 'inherit', textDecoration: 'underline', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem' }}
                                >
                                    <span>View Test Run</span>
                                    <ExternalLink size={12} />
                                </Link>
                            )}
                        </div>
                    )}

                    {error && (
                        <div style={{ background: 'rgba(224, 108, 117, 0.12)', border: '1px solid rgba(224, 108, 117, 0.35)', color: '#E06C75', padding: '8px 12px', borderRadius: '4px', fontSize: '0.76rem' }} role="alert">
                            {error}
                        </div>
                    )}
                </div>

                <footer style={{ padding: '12px 20px', borderTop: '1px solid #1A211D', display: 'flex', justifyContent: 'flex-end', gap: '8px', background: '#0E1210' }}>
                    <button type="button" className="tc-secondary" onClick={onClose} disabled={isRunning}>
                        {result ? 'Done' : 'Cancel'}
                    </button>
                    <button
                        type="button"
                        className="tc-primary"
                        onClick={handleRun}
                        disabled={isRunning}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                        <Play size={13} />
                        <span>{isRunning ? 'Executing…' : (result ? 'Rerun Scenario' : 'Run Playwright Scenario')}</span>
                    </button>
                </footer>
            </section>
        </div>,
        document.body
    );
};

export default AutomatedExecutionModal;
