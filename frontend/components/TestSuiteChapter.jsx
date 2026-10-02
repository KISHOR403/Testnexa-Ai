import React, { useState } from 'react';
import RevealSection from './RevealSection';
import {
    CheckSquare,
    Search,
    Filter,
    Check,
    Code,
    SlidersHorizontal,
    ChevronRight,
    Terminal,
    Download,
    FileText,
    Copy,
    Layers,
    Shield
} from 'lucide-react';

const CHAPTER2_TEST_CASES = [
    {
        id: 'TC-001',
        scenario: 'Valid password reset flow',
        title: 'Submit registered email address and verify recovery token dispatch',
        type: 'Functional',
        priority: 'High',
        status: 'Needs Review',
        stepsCount: 3,
        preconditions: 'User account exists with active email verification in production DB.',
        gherkin: `Feature: Password Reset Dispatch
  Scenario: Valid registered user requests password recovery
    Given an active user with email "user@company.com" exists
    When the user navigates to "/forgot-password"
    And submits "user@company.com" into the email field
    Then the API returns HTTP 200 with generic confirmation
    And a single-use token valid for 15 minutes is queued for dispatch`,
        steps: [
            { step: 1, action: 'Navigate to /forgot-password and input registered email "user@company.com".', expected: 'Form validates email string and enables submit action.', data: 'email: user@company.com' },
            { step: 2, action: 'Submit form and monitor API network response.', expected: 'HTTP 200 returned with generic confirmation payload without leaking DB existence.', data: 'POST /api/v1/auth/reset-request' },
            { step: 3, action: 'Inspect email dispatch queue for generated token.', expected: 'Single-use cryptographic URL delivered within 10 seconds.', data: 'TTL: 900s, entropy: 256-bit' }
        ],
        expectedResult: 'System issues single-use token valid for 15 minutes without disclosing user existence in database.'
    },
    {
        id: 'TC-002',
        scenario: 'Malformed email syntax rejection',
        title: 'Submit malformed email address and assert client/server schema rejection',
        type: 'Negative',
        priority: 'High',
        status: 'Needs Review',
        stepsCount: 2,
        preconditions: 'Password recovery form loaded in browser viewport.',
        gherkin: `Feature: Email Validation
  Scenario Outline: Malformed email syntax is blocked
    Given the password recovery form is displayed
    When the user inputs "<input_string>"
    Then the client disables the submit trigger
    And if bypassed, API returns HTTP 422 with field code "INVALID_EMAIL"

    Examples:
      | input_string     |
      | user@           |
      | user@domain..com |
      | @no-local.com    |`,
        steps: [
            { step: 1, action: 'Input malformed email strings ("user@", "user@domain..com").', expected: 'Client-side RFC 5322 validation prevents submission and flags input.', data: 'Invalid email strings' },
            { step: 2, action: 'Bypass client validation and post raw payload to /api/auth/forgot-password.', expected: 'HTTP 422 Unprocessable Entity returned with structured validation schema error.', data: 'HTTP status: 422' }
        ],
        expectedResult: 'System rejects malformed email strings at both client UI and API gateway with clear error feedback.'
    },
    {
        id: 'TC-003',
        scenario: 'Expired token redemption assertion',
        title: 'Attempt password update using reset token exceeding 15-minute TTL',
        type: 'Edge Case',
        priority: 'Medium',
        status: 'Needs Review',
        stepsCount: 2,
        preconditions: 'Token was generated 16 minutes prior to redemption attempt (TTL 15m).',
        gherkin: `Feature: Token Expiration
  Scenario: Redeeming an expired reset token fails
    Given a password reset token expired 60 seconds ago
    When the user opens the reset URL with the expired token
    And inputs a compliant new password
    Then the API returns HTTP 400 with errorCode "TOKEN_EXPIRED"
    And the user password in the database remains unchanged`,
        steps: [
            { step: 1, action: 'Open password reset link with expired token parameter in browser.', expected: 'App checks expiration timestamp on initial page load.', data: 'token: tn_tok_exp_8829' },
            { step: 2, action: 'Input compliant new password and submit update request.', expected: 'HTTP 400 Bad Request returned with error code "TOKEN_EXPIRED".', data: 'new_pwd: CompliantPass#2026' }
        ],
        expectedResult: 'Expired token is immediately rejected; session is cleared and user is instructed to request a fresh token.'
    },
    {
        id: 'TC-004',
        scenario: 'API rate limiting enforcement',
        title: 'Enforce threshold of maximum 5 password reset requests per minute per IP',
        type: 'Security',
        priority: 'High',
        status: 'Needs Review',
        stepsCount: 2,
        preconditions: 'API gateway rate limiter configured for auth endpoints.',
        gherkin: `Feature: Auth Rate Limiting
  Scenario: IP threshold prevents mail flooding
    Given a client IP address
    When the client submits 6 reset requests within 60 seconds
    Then the 6th request is rejected with HTTP 429 Too Many Requests
    And the Retry-After header indicates the cooldown seconds`,
        steps: [
            { step: 1, action: 'Send 5 consecutive reset requests from single IP within 30 seconds.', expected: 'All 5 requests process normally with HTTP 200.', data: 'Bursts 1 through 5' },
            { step: 2, action: 'Transmit 6th reset request within the same 60-second window.', expected: 'HTTP 429 Too Many Requests returned with "Retry-After: 60" header.', data: 'HTTP status: 429' }
        ],
        expectedResult: 'Gateway protects downstream mail provider by enforcing 5 req/min rate limit per client IP.'
    },
    {
        id: 'TC-005',
        scenario: 'Directory enumeration resistance',
        title: 'Assert uniform API response latency between existing and non-existing accounts',
        type: 'Negative',
        priority: 'High',
        status: 'Needs Review',
        stepsCount: 2,
        preconditions: 'Target user does not exist in production database.',
        gherkin: `Feature: Anti-Enumeration
  Scenario: Generic response prevents user discovery
    Given an unregistered email "nonexistent_dev@testnexa.ai"
    When submitted to the recovery endpoint
    Then the system returns identical confirmation message
    And the response latency delta is under 25ms compared to registered users`,
        steps: [
            { step: 1, action: 'Submit reset request for non-existent email address.', expected: 'System returns identical 200 message: "If this email is registered, a link has been sent."', data: 'email: nonexistent_user@testnexa.ai' },
            { step: 2, action: 'Measure API latency over 20 runs.', expected: 'Timing delta between registered and non-registered users is <25ms, preventing timing enumeration attacks.', data: 'Latency variance < 25ms' }
        ],
        expectedResult: 'External attackers cannot determine whether an email exists in the database based on message or response timing.'
    }
];

export const TestSuiteChapter = () => {
    const [selectedId, setSelectedId] = useState('TC-001');
    const [filterType, setFilterType] = useState('All');
    const [viewMode, setViewMode] = useState('steps'); // 'steps' | 'gherkin'
    const [copiedGherkin, setCopiedGherkin] = useState(false);

    const activeCase = CHAPTER2_TEST_CASES.find((tc) => tc.id === selectedId) || CHAPTER2_TEST_CASES[0];

    const filteredCases = filterType === 'All'
        ? CHAPTER2_TEST_CASES
        : CHAPTER2_TEST_CASES.filter((tc) => tc.type.toLowerCase().includes(filterType.toLowerCase()));

    const handleCopyGherkin = () => {
        navigator.clipboard.writeText(activeCase.gherkin);
        setCopiedGherkin(true);
        setTimeout(() => setCopiedGherkin(false), 2000);
    };

    return (
        <section id="test-suite" className="tn-section tn-testsuite-chapter" aria-labelledby="chapter2-heading">
            <div className="tn-container">
                {/* ─── Chapter Header ─── */}
                <RevealSection className="tn-section-header">
                    <div className="tn-story-chapter-eyebrow">
                        <span className="tn-chapter-pill">CHAPTER 02</span>
                        <span className="tn-chapter-sub">Executable Test Suites</span>
                    </div>
                    <h2 id="chapter2-heading" className="tn-section-title">
                        From scenarios to executable tests.
                    </h2>
                    <p className="tn-section-subtitle">
                        Inspect preconditions, atomic actions, expected results, and BDD Gherkin specifications ready for your test runners.
                    </p>
                </RevealSection>

                {/* ─── Master-Detail Integrated Test Suite Workspace ─── */}
                <div className="tn-suite-workspace" data-parallax-offset="15">
                    
                    {/* Top Workspace Toolbar */}
                    <div className="tn-suite-toolbar">
                        <div className="tn-suite-filter-group">
                            <span className="tn-toolbar-label">Category:</span>
                            {['All', 'Functional', 'Negative', 'Edge Case', 'Security'].map((cat) => (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => setFilterType(cat)}
                                    className={`tn-filter-btn ${filterType === cat ? 'is-active' : ''}`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>

                        <div className="tn-suite-viewmode-group">
                            <button
                                type="button"
                                onClick={() => setViewMode('steps')}
                                className={`tn-viewmode-btn ${viewMode === 'steps' ? 'is-active' : ''}`}
                            >
                                <CheckSquare size={13} />
                                <span>Steps View</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('gherkin')}
                                className={`tn-viewmode-btn ${viewMode === 'gherkin' ? 'is-active' : ''}`}
                            >
                                <Code size={13} />
                                <span>BDD Gherkin</span>
                            </button>
                        </div>
                    </div>

                    {/* Master-Detail Layout */}
                    <div className="tn-suite-master-detail">
                        
                        {/* Master: Test Case Selector List */}
                        <div className="tn-suite-master-col" role="tablist" aria-label="Generated Test Cases">
                            {filteredCases.map((tc) => {
                                const isSelected = tc.id === activeCase.id;
                                return (
                                    <button
                                        key={tc.id}
                                        type="button"
                                        role="tab"
                                        aria-selected={isSelected}
                                        onClick={() => setSelectedId(tc.id)}
                                        className={`tn-suite-item-btn ${isSelected ? 'is-selected' : ''}`}
                                    >
                                        <div className="tn-suite-item-top">
                                            <span className="tn-suite-item-id">{tc.id}</span>
                                            <span className={`tn-badge ${tc.priority === 'High' ? 'tn-badge--amber' : 'tn-badge--neutral'}`}>
                                                {tc.priority}
                                            </span>
                                            <span className="tn-suite-item-type">{tc.type}</span>
                                        </div>
                                        <div className="tn-suite-item-title">{tc.title}</div>
                                        <div className="tn-suite-item-foot">
                                            <span>{tc.stepsCount} steps</span>
                                            <ChevronRight size={14} className="tn-item-chevron" />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Detail: Active Test Case Inspector */}
                        <div className="tn-suite-detail-col">
                            <div className="tn-detail-header">
                                <div>
                                    <div className="tn-detail-meta-tags">
                                        <span className="tn-detail-id">{activeCase.id}</span>
                                        <span className="tn-detail-type-badge">{activeCase.type}</span>
                                        <span className="tn-detail-priority-badge">{activeCase.priority} Priority</span>
                                        <span className="tn-detail-status-badge">Needs Review</span>
                                    </div>
                                    <h3 className="tn-detail-title">{activeCase.title}</h3>
                                </div>

                                {viewMode === 'gherkin' && (
                                    <button
                                        type="button"
                                        onClick={handleCopyGherkin}
                                        className="tn-btn-secondary tn-btn-sm"
                                    >
                                        {copiedGherkin ? <Check size={13} className="text-green" /> : <Copy size={13} />}
                                        <span>{copiedGherkin ? 'Copied' : 'Copy Feature'}</span>
                                    </button>
                                )}
                            </div>

                            {/* Preconditions */}
                            <div className="tn-detail-preconditions">
                                <span className="tn-precond-label">PRECONDITIONS</span>
                                <p>{activeCase.preconditions}</p>
                            </div>

                            {/* View Switch: Steps vs Gherkin */}
                            {viewMode === 'steps' ? (
                                <div className="tn-detail-steps-section">
                                    <h4 className="tn-steps-heading">EXECUTION STEPS & EXPECTED OUTCOMES</h4>
                                    <div className="tn-steps-table-wrap">
                                        <table className="tn-steps-table">
                                            <thead>
                                                <tr>
                                                    <th style={{ width: '45px' }}>#</th>
                                                    <th style={{ width: '48%' }}>Action & Input</th>
                                                    <th>Expected Assertion</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {activeCase.steps.map((s) => (
                                                    <tr key={s.step}>
                                                        <td className="tn-step-num-cell">{s.step}</td>
                                                        <td>
                                                            <div className="tn-step-action">{s.action}</div>
                                                            {s.data && (
                                                                <code className="tn-step-data-tag">{s.data}</code>
                                                            )}
                                                        </td>
                                                        <td className="tn-step-expected">
                                                            <Check size={12} className="text-green tn-step-check" />
                                                            <span>{s.expected}</span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="tn-detail-expected-result">
                                        <strong>Expected Suite Result:</strong>
                                        <p>{activeCase.expectedResult}</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="tn-detail-gherkin-section">
                                    <div className="tn-gherkin-bar">
                                        <span className="tn-gherkin-tag">Cucumber / Behave Compatible</span>
                                        <span className="tn-gherkin-spec">BDD Feature Specification</span>
                                    </div>
                                    <pre className="tn-gherkin-codeblock">
                                        <code>{activeCase.gherkin}</code>
                                    </pre>
                                </div>
                            )}

                        </div>

                    </div>

                    {/* Integrated Supporting Metrics Bar (Clean, no card spam) */}
                    <div className="tn-suite-metrics-strip">
                        <div className="tn-metric-stat">
                            <span className="tn-stat-num">18</span>
                            <span className="tn-stat-lbl">Generated Test Cases</span>
                        </div>
                        <div className="tn-metric-stat">
                            <span className="tn-stat-num">40%</span>
                            <span className="tn-stat-lbl">Negative & Boundary Ratio</span>
                        </div>
                        <div className="tn-metric-stat">
                            <span className="tn-stat-num">100%</span>
                            <span className="tn-stat-lbl">Cucumber BDD Export</span>
                        </div>
                        <div className="tn-metric-stat">
                            <span className="tn-stat-num">0 ms</span>
                            <span className="tn-stat-lbl">Database Polling Lag</span>
                        </div>
                    </div>

                </div>

            </div>
        </section>
    );
};

export default TestSuiteChapter;
