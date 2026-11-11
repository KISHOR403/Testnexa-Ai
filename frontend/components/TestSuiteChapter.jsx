import React, { useState } from 'react';
import { Check, AlertTriangle, ArrowRight } from 'lucide-react';
import useWorkspaceEntry from '../hooks/useWorkspaceEntry';

const GENERATED_TESTS = [
    {
        id: 'TC-FUNC-001',
        title: 'Submit registered email & verify single-use token dispatch',
        scenario: 'Valid password recovery flow',
        type: 'Functional',
        priority: 'P0',
        status: 'Approved',
        preconditions: 'User account exists with verified email in database; auth dispatch queue operational.',
        steps: [
            { step: 1, action: 'Navigate to /forgot-password and input registered email "user@company.com".', expected: 'Form validates RFC 5322 string and enables submission button.', data: 'email: user@company.com' },
            { step: 2, action: 'Submit form and monitor API network response.', expected: 'HTTP 200 returned with generic confirmation; DB existence unrevealed.', data: 'POST /api/v1/auth/reset-request' },
            { step: 3, action: 'Inspect email dispatch queue for token.', expected: 'Single-use cryptographic URL delivered within 10s; TTL exactly 900s.', data: 'TTL: 900s, entropy: 256-bit' }
        ],
        gherkin: `Feature: Password Reset Recovery
  @auth @smoke @P0
  Scenario: Valid registered user requests password recovery
    Given an active user with email "user@company.com" exists
    When the user navigates to "/forgot-password"
    And submits "user@company.com" into the email field
    Then the API returns HTTP 200 with generic confirmation
    And a single-use token valid for 15 minutes is dispatched via SMTP`
    },
    {
        id: 'TC-NEG-002',
        title: 'Malformed email syntax rejection at gateway',
        scenario: 'Malformed input validation',
        type: 'Negative',
        priority: 'P1',
        status: 'Approved',
        preconditions: 'Password recovery form loaded in browser viewport.',
        steps: [
            { step: 1, action: 'Input malformed email string ("user@missing-tld").', expected: 'Client-side validator marks field invalid; submit remains disabled.', data: 'email: user@missing-tld' },
            { step: 2, action: 'Bypass client and POST directly to /api/auth/reset.', expected: 'HTTP 422 Unprocessable Entity returned with code "INVALID_EMAIL".', data: 'HTTP 422 status' }
        ],
        gherkin: `Feature: Syntax Boundary Validation
  @negative @validation @P1
  Scenario: Gateway blocks malformed email payloads
    Given the password recovery endpoint is reachable
    When a request with malformed email payload is dispatched
    Then the API returns HTTP 422 with errorCode "INVALID_EMAIL"`
    },
    {
        id: 'TC-NEG-003',
        title: 'Attempt reset with expired token exceeding 15m TTL',
        scenario: 'Expired token replay assertion',
        type: 'Negative',
        priority: 'P0',
        status: 'Approved',
        preconditions: 'Token was generated 16 minutes prior to redemption attempt.',
        steps: [
            { step: 1, action: 'Open password reset link with expired token parameter.', expected: 'Gateway evaluates token timestamp against 15m maximum TTL window.', data: 'token: tn_tok_exp_8829' },
            { step: 2, action: 'Input compliant new password and submit update.', expected: 'HTTP 401 Unauthorized returned with code "TOKEN_EXPIRED".', data: 'HTTP 401 status' }
        ],
        gherkin: `Feature: Token Expiration Lifecycle
  @security @token @P0
  Scenario: Expired reset token cannot update credentials
    Given a reset token expired 60 seconds ago
    When the user attempts to redeem the token
    Then the API returns HTTP 401 with errorCode "TOKEN_EXPIRED"`
    },
    {
        id: 'TC-SEC-004',
        title: 'Rate limiting enforcement (> 5 requests per hour)',
        scenario: 'Anti-abuse throttle check',
        type: 'Security',
        priority: 'P0',
        status: 'Needs Review',
        preconditions: 'Target IP has dispatched 5 password reset requests within past 15 minutes.',
        steps: [
            { step: 1, action: 'Dispatch 6th password recovery request from identical IP.', expected: 'Rate limit middleware intercepts request before email dispatch.', data: 'Request #6 within 15m' },
            { step: 2, action: 'Inspect HTTP response headers and status code.', expected: 'HTTP 429 Too Many Requests returned with Retry-After header.', data: 'HTTP 429 • Retry-After: 3600' }
        ],
        gherkin: `Feature: Anti-Abuse Rate Limiting
  @security @throttle @P0
  Scenario: Exceeding request quota triggers HTTP 429
    Given a client IP has sent 5 reset requests in the current hour
    When a 6th reset request is submitted
    Then the gateway responds with HTTP 429 Too Many Requests
    And the response includes a "Retry-After" header`
    }
];

export const TestSuiteChapter = () => {
    const [selectedTestId, setSelectedTestId] = useState('TC-FUNC-001');
    const [viewMode, setViewMode] = useState('steps'); // 'steps' | 'gherkin'
    const [caseStatuses, setCaseStatuses] = useState({});
    const { handleWorkspaceEntry, getTargetUrl } = useWorkspaceEntry();

    const activeTest = GENERATED_TESTS.find((t) => t.id === selectedTestId) || GENERATED_TESTS[0];
    const currentStatus = caseStatuses[activeTest.id] || activeTest.status;

    const toggleStatus = (id) => {
        setCaseStatuses((prev) => ({
            ...prev,
            [id]: prev[id] === 'Approved' ? 'Needs Review' : 'Approved'
        }));
    };

    return (
        <section
            id="review-risk"
            className="de-section"
            aria-labelledby="test-gen-heading"
        >
            <div className="de-container">
                {/* ─── Header ─── */}
                <div style={{ maxWidth: 760 }}>
                    <div className="de-eyebrow">
                        <span className="de-eyebrow-dot" />
                        <span>03 / INTELLIGENT TEST GENERATION</span>
                    </div>

                    <h2 id="test-gen-heading" className="de-editorial-title">
                        Precision in every test.
                    </h2>

                    <p className="de-lead">
                        Every generated test is structured, prioritized, and complete with atomic execution steps, exact preconditions, and deterministic assertions.
                    </p>
                </div>

                {/* ─── Asymmetric Layout: Directory on Left, Workbench on Right ─── */}
                <div className="de-gen-layout">
                    {/* Left: Test Cases Directory */}
                    <div className="de-gen-directory" role="tablist" aria-label="Generated Test Directory">
                        {GENERATED_TESTS.map((tc) => {
                            const isSelected = tc.id === selectedTestId;
                            const st = caseStatuses[tc.id] || tc.status;
                            return (
                                <button
                                    key={tc.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={isSelected}
                                    className={`de-gen-card-item ${isSelected ? 'is-selected' : ''}`}
                                    onClick={() => setSelectedTestId(tc.id)}
                                >
                                    <div>
                                        <span className="de-gen-item-id">{tc.id} &bull; {tc.priority}</span>
                                        <span className="de-gen-item-title">{tc.scenario}</span>
                                        <div className="de-gen-item-tags">
                                            <span>{tc.type}</span>
                                            <span>&bull;</span>
                                            <span style={{ color: st === 'Approved' ? '#8BAF9A' : '#E5C07B' }}>{st}</span>
                                        </div>
                                    </div>
                                    <ArrowRight
                                        size={14}
                                        style={{
                                            opacity: isSelected ? 1 : 0.3,
                                            color: isSelected ? '#8BAF9A' : 'inherit',
                                            flexShrink: 0,
                                            marginLeft: 12
                                        }}
                                    />
                                </button>
                            );
                        })}

                        <div style={{ marginTop: '2rem' }}>
                            <a
                                href={getTargetUrl('/app/workspace')}
                                className="de-inline-link"
                                onClick={(e) => {
                                    e.preventDefault();
                                    handleWorkspaceEntry('/app/workspace');
                                }}
                            >
                                <span>Open full test suite in workspace</span>
                                <ArrowRight size={13} />
                            </a>
                        </div>
                    </div>

                    {/* Right: Authentic Test Specification Workbench */}
                    <div className="de-gen-workbench-view">
                        <div className="de-gen-view-header">
                            <div>
                                <span className="de-gen-item-id">{activeTest.id} &bull; {activeTest.priority} PRIORITY &bull; {activeTest.type.toUpperCase()}</span>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 500, color: '#F2F2F0', margin: '4px 0 0' }}>
                                    {activeTest.title}
                                </h3>
                            </div>

                            <button
                                type="button"
                                className={`de-status-pill ${currentStatus === 'Approved' ? 'is-approved' : 'is-review'}`}
                                onClick={() => toggleStatus(activeTest.id)}
                                title="Click to toggle approval state"
                            >
                                {currentStatus === 'Approved' ? <Check size={12} /> : <AlertTriangle size={12} />}
                                <span>{currentStatus}</span>
                            </button>
                        </div>

                        {/* Preconditions */}
                        <div className="de-precondition-bar">
                            <strong style={{ color: '#F2F2F0', marginRight: 6 }}>PRECONDITIONS:</strong>
                            <span>{activeTest.preconditions}</span>
                        </div>

                        {/* View Switcher Tabs */}
                        <div className="de-mode-tabs">
                            <button
                                type="button"
                                className={`de-mode-tab ${viewMode === 'steps' ? 'is-active' : ''}`}
                                onClick={() => setViewMode('steps')}
                            >
                                [01] Step-by-Step Assertions ({activeTest.steps.length} Steps)
                            </button>
                            <button
                                type="button"
                                className={`de-mode-tab ${viewMode === 'gherkin' ? 'is-active' : ''}`}
                                onClick={() => setViewMode('gherkin')}
                            >
                                [02] Cucumber BDD (.feature)
                            </button>
                        </div>

                        {/* Steps Table or Gherkin Stream */}
                        {viewMode === 'steps' ? (
                            <table className="de-steps-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '48px' }}>STEP</th>
                                        <th>ACTION / INPUT</th>
                                        <th>EXPECTED RESULT / ASSERTION</th>
                                        <th style={{ width: '160px' }}>TEST DATA</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeTest.steps.map((s) => (
                                        <tr key={s.step}>
                                            <td style={{ fontFamily: 'monospace', color: 'var(--de-accent)' }}>
                                                0{s.step}
                                            </td>
                                            <td>{s.action}</td>
                                            <td style={{ color: '#C5CDC7' }}>{s.expected}</td>
                                            <td style={{ fontFamily: 'monospace', fontSize: '0.74rem', color: 'var(--de-text-muted)' }}>
                                                {s.data}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <pre className="de-code-stream-view">{activeTest.gherkin}</pre>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default TestSuiteChapter;
