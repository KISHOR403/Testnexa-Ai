import React, { useState } from 'react';
import {
    CheckSquare,
    Check,
    Code,
    FileText,
    Copy,
    Download,
    Terminal,
    ArrowRight,
    AlertTriangle,
    Layers,
    ExternalLink
} from 'lucide-react';
import useWorkspaceEntry from '../hooks/useWorkspaceEntry';

const SUITE_TEST_CASES = [
    {
        id: 'TC-001',
        title: 'Submit registered email address & verify single-use token dispatch',
        scenario: 'Valid password recovery submission',
        type: 'Functional',
        typeClass: 'is-func',
        priority: 'P0',
        status: 'Pass',
        stepsCount: 3,
        preconditions: 'User account exists with verified email in database.',
        steps: [
            { step: 1, action: 'Navigate to /forgot-password and input "user@company.com".', expected: 'Form validates RFC 5322 email string & enables submission trigger.', data: 'email: user@company.com' },
            { step: 2, action: 'Submit form and monitor HTTP API network response.', expected: 'HTTP 200 returned with generic status; DB presence not disclosed.', data: 'POST /api/v1/auth/reset-request' },
            { step: 3, action: 'Inspect email dispatch queue for generated token.', expected: 'Single-use cryptographic URL delivered within 10 seconds; TTL 900s.', data: 'TTL: 900s, entropy: 256-bit' }
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
        id: 'TC-002',
        title: 'Malformed email syntax rejection at client UI and gateway',
        scenario: 'Malformed email validation',
        type: 'Negative',
        typeClass: 'is-neg',
        priority: 'P1',
        status: 'Pass',
        stepsCount: 2,
        preconditions: 'Password recovery form loaded in browser viewport.',
        steps: [
            { step: 1, action: 'Input malformed email strings ("user@", "user@domain..com").', expected: 'Client-side RFC 5322 validation prevents submission trigger.', data: 'Invalid email syntax strings' },
            { step: 2, action: 'Bypass client validation and post raw payload to /api/auth/reset.', expected: 'HTTP 422 Unprocessable Entity returned with structured error code.', data: 'HTTP status: 422 INVALID_EMAIL' }
        ],
        gherkin: `Feature: Email Syntax Validation
  @validation @negative @P1
  Scenario Outline: Malformed email syntax is blocked
    Given the password recovery form is displayed
    When the user inputs "<input_string>"
    Then the client disables the submit trigger
    And if bypassed, API returns HTTP 422 with field code "INVALID_EMAIL"

    Examples:
      | input_string     |
      | user@           |
      | user@domain..com |
      | @no-local.com    |`
    },
    {
        id: 'TC-003',
        title: 'Attempt password update using reset token exceeding 15-minute TTL',
        scenario: 'Expired token redemption assertion',
        type: 'Negative',
        typeClass: 'is-neg',
        priority: 'P0',
        status: 'Pass',
        stepsCount: 2,
        preconditions: 'Token was generated 16 minutes prior to redemption attempt (TTL 15m).',
        steps: [
            { step: 1, action: 'Open password reset link with expired token parameter.', expected: 'Backend checks expiration timestamp on initial request validation.', data: 'token: tn_tok_exp_8829' },
            { step: 2, action: 'Input compliant new password and submit update request.', expected: 'HTTP 401 Bad Request returned with error code "TOKEN_EXPIRED".', data: 'new_pwd: SecurePass#2026' }
        ],
        gherkin: `Feature: Token Expiration Lifecycle
  @security @token @P0
  Scenario: Redeeming an expired reset token fails
    Given a password reset token expired 60 seconds ago
    When the user opens the reset URL with the expired token
    And inputs a compliant new password
    Then the API returns HTTP 401 with errorCode "TOKEN_EXPIRED"
    And user password in database remains unchanged`
    },
    {
        id: 'TC-004',
        title: 'Enforce threshold of maximum 5 password reset requests per hour per IP',
        scenario: 'API rate limiting enforcement',
        type: 'Security',
        typeClass: 'is-sec',
        priority: 'P0',
        status: 'Review',
        stepsCount: 2,
        preconditions: 'API gateway rate limiter configured for authentication endpoints.',
        steps: [
            { step: 1, action: 'Dispatch 5 valid password reset requests within a 60-second window.', expected: 'First 5 requests return HTTP 200 with standard token payload.', data: 'Burst: 5 requests' },
            { step: 2, action: 'Dispatch 6th request from same client IP within the rate limit window.', expected: 'HTTP 429 Too Many Requests returned with "Retry-After" header.', data: 'HTTP status: 429 TOO_MANY_REQUESTS' }
        ],
        gherkin: `Feature: Authentication Gateway Rate Limiting
  @security @ratelimit @P0
  Scenario: Exceeding password reset quota triggers HTTP 429
    Given a client IP has submitted 5 reset requests in the past hour
    When the client submits a 6th reset request
    Then the gateway immediately rejects with HTTP 429
    And headers contain "Retry-After: 3600"`
    }
];

export const TestSuiteChapter = () => {
    const [selectedTestId, setSelectedTestId] = useState('TC-001');
    const [viewMode, setViewMode] = useState('steps'); // 'steps' | 'gherkin'
    const [copiedGherkin, setCopiedGherkin] = useState(false);
    const { handleWorkspaceEntry, getTargetUrl, isOpening } = useWorkspaceEntry();

    const activeTest = SUITE_TEST_CASES.find((t) => t.id === selectedTestId) || SUITE_TEST_CASES[0];

    const handleCopy = () => {
        navigator.clipboard.writeText(activeTest.gherkin);
        setCopiedGherkin(true);
        setTimeout(() => setCopiedGherkin(false), 2000);
    };

    return (
        <section
            id="test-suite"
            className="tn-section tn-suite-chapter-section"
            aria-labelledby="suite-chapter-heading"
        >
            <div className="tn-container">
                {/* ─── Editorial Header (No Box) ─── */}
                <div className="tn-suite-header-group">
                    <div className="tn-chapter-eyebrow">
                        <span className="tn-kicker-dot" />
                        <span>EXECUTABLE SPECIFICATIONS</span>
                    </div>

                    <h2 id="suite-chapter-heading" className="tn-suite-title">
                        Deterministic test cases with code-level precision.
                    </h2>

                    <p className="tn-suite-subtitle">
                        Generated test cases are not generic checklists. Every scenario includes atomic execution steps, explicit test data, and deterministic assertions formatted for modern automation.
                    </p>
                </div>

                {/* ─── Full-width Product Experience (Minimal Surrounding Chrome) ─── */}
                <div className="tn-suite-workbench">
                    {/* Top Case Selector Strip */}
                    <div className="tn-sw-selector-bar">
                        <div className="tn-sw-case-tabs" role="tablist">
                            {SUITE_TEST_CASES.map((tc) => {
                                const isSelected = tc.id === selectedTestId;
                                return (
                                    <button
                                        key={tc.id}
                                        type="button"
                                        role="tab"
                                        aria-selected={isSelected}
                                        className={`tn-sw-tab ${isSelected ? 'is-selected' : ''}`}
                                        onClick={() => setSelectedTestId(tc.id)}
                                    >
                                        <span className="tn-sw-tab-id">{tc.id}</span>
                                        <span className="tn-sw-tab-name">{tc.scenario}</span>
                                        <span className={`tn-sw-type-pill ${tc.typeClass}`}>{tc.type}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Format Switcher */}
                        <div className="tn-sw-format-toggle">
                            <button
                                type="button"
                                className={`tn-sw-toggle-btn ${viewMode === 'steps' ? 'is-active' : ''}`}
                                onClick={() => setViewMode('steps')}
                            >
                                <CheckSquare size={13} />
                                <span>Steps & Assertions</span>
                            </button>
                            <button
                                type="button"
                                className={`tn-sw-toggle-btn ${viewMode === 'gherkin' ? 'is-active' : ''}`}
                                onClick={() => setViewMode('gherkin')}
                            >
                                <Code size={13} />
                                <span>Cucumber BDD Spec</span>
                            </button>
                        </div>
                    </div>

                    {/* Active Case Workspace */}
                    <div className="tn-sw-case-body">
                        {/* Meta Sub-bar */}
                        <div className="tn-sw-meta-bar">
                            <div className="tn-sw-meta-left">
                                <span className="tn-sw-active-id">{activeTest.id}</span>
                                <h3 className="tn-sw-active-title">{activeTest.title}</h3>
                            </div>

                            <div className="tn-sw-meta-right">
                                <span className="tn-sw-priority-tag">{activeTest.priority} Priority</span>
                                <span className={`tn-sw-status-tag ${activeTest.status === 'Pass' ? 'is-pass' : 'is-review'}`}>
                                    {activeTest.status === 'Pass' ? <Check size={11} /> : <AlertTriangle size={11} />}
                                    <span>{activeTest.status}</span>
                                </span>
                            </div>
                        </div>

                        {/* Content Pane: Either Steps or Gherkin */}
                        {viewMode === 'steps' ? (
                            <div className="tn-sw-steps-view">
                                <div className="tn-sw-preconditions">
                                    <span className="tn-sw-pre-label">PRECONDITIONS:</span>
                                    <span className="tn-sw-pre-text">{activeTest.preconditions}</span>
                                </div>

                                <div className="tn-sw-steps-table-wrap">
                                    <table className="tn-sw-steps-table">
                                        <thead>
                                            <tr>
                                                <th className="th-step">STEP</th>
                                                <th className="th-action">ACTION / INPUT</th>
                                                <th className="th-expected">EXPECTED RESULT / ASSERTION</th>
                                                <th className="th-data">TEST DATA</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {activeTest.steps.map((s) => (
                                                <tr key={s.step}>
                                                    <td className="td-step"><code>{String(s.step).padStart(2, '0')}</code></td>
                                                    <td className="td-action">{s.action}</td>
                                                    <td className="td-expected">{s.expected}</td>
                                                    <td className="td-data"><code>{s.data}</code></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="tn-sw-gherkin-view">
                                <div className="tn-gherkin-top-bar">
                                    <span className="tn-gherkin-lang">gherkin &bull; {activeTest.id}.feature</span>
                                    <button
                                        type="button"
                                        className="tn-copy-gherkin-btn"
                                        onClick={handleCopy}
                                        title="Copy Gherkin Feature Spec"
                                    >
                                        {copiedGherkin ? <Check size={12} className="text-green" /> : <Copy size={12} />}
                                        <span>{copiedGherkin ? 'Copied to Clipboard' : 'Copy Feature File'}</span>
                                    </button>
                                </div>
                                <pre className="tn-gherkin-codeblock">
                                    <code>{activeTest.gherkin}</code>
                                </pre>
                            </div>
                        )}

                        {/* Runner Compatibility Footer */}
                        <div className="tn-sw-footer">
                            <div className="tn-sw-footer-left">
                                <span className="tn-sw-footer-label">NATIVE AUTOMATION TARGETS:</span>
                                <div className="tn-sw-runner-chips">
                                    <span className="tn-runner-chip">Playwright Test (.spec.ts)</span>
                                    <span className="tn-runner-chip">Cypress (.cy.js)</span>
                                    <span className="tn-runner-chip">Cucumber / Gherkin BDD</span>
                                    <span className="tn-runner-chip">Postman / REST</span>
                                </div>
                            </div>

                            <a
                                href={getTargetUrl('/app/workspace')}
                                className="tn-sw-open-cta"
                                onClick={(e) => {
                                    e.preventDefault();
                                    handleWorkspaceEntry('/app/workspace');
                                }}
                            >
                                <span>Export Full Test Suite</span>
                                <ArrowRight size={13} />
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default TestSuiteChapter;
