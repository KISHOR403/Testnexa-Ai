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
    Shield,
    ShieldAlert,
    ExternalLink,
    Filter
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
        status: 'Approved',
        riskVector: 'Credential Lifecycle & SMTP Delivery',
        missingScenarioMitigated: 'Validates that unverified emails cannot receive reset links',
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
        status: 'Approved',
        riskVector: 'Malformed Input & Boundary Rejection',
        missingScenarioMitigated: 'Prevents backend parsing exceptions and server 500 errors',
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
        status: 'Approved',
        riskVector: 'Token Lifecycle & Hijack Window',
        missingScenarioMitigated: 'Omitted in raw requirement; synthesizes critical boundary check',
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
        status: 'Needs Review',
        riskVector: 'Auth Gateway Flooding & Account Enumeration',
        missingScenarioMitigated: 'Protects notification infrastructure from spam flooding',
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
    const [caseStatuses, setCaseStatuses] = useState({
        'TC-001': 'Approved',
        'TC-002': 'Approved',
        'TC-003': 'Approved',
        'TC-004': 'Needs Review'
    });
    const { handleWorkspaceEntry, getTargetUrl } = useWorkspaceEntry();

    const activeTest = SUITE_TEST_CASES.find((t) => t.id === selectedTestId) || SUITE_TEST_CASES[0];
    const currentStatus = caseStatuses[activeTest.id] || activeTest.status;

    const handleCopy = () => {
        navigator.clipboard.writeText(activeTest.gherkin);
        setCopiedGherkin(true);
        setTimeout(() => setCopiedGherkin(false), 2000);
    };

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
            aria-labelledby="suite-chapter-heading"
        >
            <div className="de-container">
                {/* ─── Editorial Header ─── */}
                <div style={{ maxWidth: 720 }}>
                    <div className="de-eyebrow">
                        <span className="de-eyebrow-dot" />
                        <span>03 / TEST GENERATION</span>
                    </div>

                    <h2 id="suite-chapter-heading" className="de-editorial-title">
                        Precision in every test.
                    </h2>

                    <p className="de-lead">
                        Atomic execution steps, deterministic preconditions, test data, and expected assertions. Reviewable in human-readable steps or exported directly as executable Playwright TypeScript.
                    </p>
                </div>

                {/* ─── Immersive Asymmetric Showcase ─── */}
                <div className="de-gen-split">
                    {/* Left: Test Cases Directory */}
                    <div className="de-gen-index-list" role="tablist" aria-label="Generated Test Directory">
                        {SUITE_TEST_CASES.map((tc) => {
                            const isSelected = tc.id === selectedTestId;
                            const st = caseStatuses[tc.id] || tc.status;
                            return (
                                <button
                                    key={tc.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={isSelected}
                                    className={`de-gen-index-item ${isSelected ? 'is-selected' : ''}`}
                                    onClick={() => setSelectedTestId(tc.id)}
                                >
                                    <div className="de-gen-item-left">
                                        <span className="de-gen-item-id">{tc.id} &bull; {tc.priority}</span>
                                        <span className="de-gen-item-title">{tc.scenario}</span>
                                        <div className="de-gen-item-meta">
                                            <span>{tc.type}</span>
                                            <span>&bull;</span>
                                            <span style={{ color: st === 'Approved' ? '#8BAF9A' : '#C8993C' }}>{st}</span>
                                        </div>
                                    </div>
                                    <ArrowRight size={14} style={{ opacity: isSelected ? 1 : 0.25, color: isSelected ? '#8BAF9A' : 'inherit', flexShrink: 0, marginTop: 4 }} />
                                </button>
                            );
                        })}

                        <div style={{ marginTop: '2rem' }}>
                            <a
                                href={getTargetUrl('/app/workspace')}
                                className="tn-inline-link"
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

                    {/* Right: Immersive Product Preview */}
                    <div className="de-gen-main-view">
                        <div className="de-gen-view-head">
                            <div>
                                <span style={{ fontFamily: 'monospace', fontSize: '0.74rem', color: '#8BAF9A', fontWeight: 600 }}>{activeTest.id} &bull; {activeTest.priority} PRIORITY</span>
                                <h3 style={{ fontSize: '1.15rem', fontWeight: 500, color: '#F2F2F0', margin: '4px 0 0' }}>{activeTest.title}</h3>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <button
                                    type="button"
                                    className={`de-gen-status-toggle ${currentStatus === 'Approved' ? 'is-approved' : 'is-review'}`}
                                    onClick={() => toggleStatus(activeTest.id)}
                                    title="Click to toggle approval state"
                                >
                                    {currentStatus === 'Approved' ? <Check size={12} /> : <AlertTriangle size={12} />}
                                    <span>{currentStatus}</span>
                                </button>
                            </div>
                        </div>

                        {/* Preconditions */}
                        <div style={{ padding: '0.75rem 1rem', background: 'rgba(0, 0, 0, 0.3)', borderLeft: '2px solid rgba(255,255,255,0.1)', marginBottom: '1.5rem', fontFamily: 'monospace', fontSize: '0.78rem', color: '#969B98' }}>
                            <strong style={{ color: '#F2F2F0', textTransform: 'uppercase', marginRight: 6 }}>Preconditions:</strong>
                            {activeTest.preconditions}
                        </div>

                        {/* View Switcher Bar */}
                        <div style={{ display: 'flex', gap: 16, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
                            <button
                                type="button"
                                onClick={() => setViewMode('steps')}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    fontFamily: 'monospace',
                                    fontSize: '0.76rem',
                                    fontWeight: viewMode === 'steps' ? 600 : 400,
                                    color: viewMode === 'steps' ? '#8BAF9A' : '#68706B',
                                    cursor: 'pointer',
                                    padding: 0
                                }}
                            >
                                [01] Step-by-Step Assertions
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('gherkin')}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    fontFamily: 'monospace',
                                    fontSize: '0.76rem',
                                    fontWeight: viewMode === 'gherkin' ? 600 : 400,
                                    color: viewMode === 'gherkin' ? '#8BAF9A' : '#68706B',
                                    cursor: 'pointer',
                                    padding: 0
                                }}
                            >
                                [02] Cucumber BDD (.feature)
                            </button>
                        </div>

                        {/* Steps or Code */}
                        {viewMode === 'steps' ? (
                            <div style={{ overflowX: 'auto' }}>
                                <table className="de-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: 60 }}>STEP</th>
                                            <th>ACTION / INPUT</th>
                                            <th>EXPECTED RESULT / ASSERTION</th>
                                            <th>TEST DATA</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {activeTest.steps.map((s) => (
                                            <tr key={s.step}>
                                                <td className="de-mono-cell">0{s.step}</td>
                                                <td>{s.action}</td>
                                                <td style={{ color: '#F2F2F0' }}>{s.expected}</td>
                                                <td className="de-mono-cell">{s.data}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                    <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#68706B' }}>{activeTest.id}.feature</span>
                                    <button
                                        type="button"
                                        onClick={handleCopy}
                                        style={{ background: 'transparent', border: 'none', color: '#8BAF9A', fontFamily: 'monospace', fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                                    >
                                        {copiedGherkin ? <Check size={11} /> : <Copy size={11} />}
                                        <span>{copiedGherkin ? 'Copied' : 'Copy'}</span>
                                    </button>
                                </div>
                                <pre style={{ margin: 0, padding: '1rem', background: '#050606', border: '1px solid rgba(255,255,255,0.06)', fontFamily: 'monospace', fontSize: '0.78rem', color: '#BAC5BE', lineHeight: 1.65, overflowX: 'auto' }}>
                                    <code>{activeTest.gherkin}</code>
                                </pre>
                            </div>
                        )}

                        {/* Runner Ecosystem Strip */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap', gap: 12 }}>
                            <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#969B98' }}>
                                Native Runner Export: <strong style={{ color: '#F2F2F0' }}>Playwright &bull; Cypress &bull; Cucumber &bull; JUnit XML</strong>
                            </span>
                            <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#8BAF9A' }}>
                                Risk Vector Mitigated: {activeTest.riskVector}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default TestSuiteChapter;
