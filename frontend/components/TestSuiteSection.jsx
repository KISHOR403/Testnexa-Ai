import React, { useState } from 'react';
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
    FileText
} from 'lucide-react';

const QA_TEST_CASES = [
    {
        id: 'TC-001',
        scenario: 'Valid password reset',
        title: 'Submit registered email address and verify recovery token dispatch',
        type: 'Functional',
        priority: 'High',
        status: 'Needs Review',
        stepsCount: 3,
        preconditions: 'User account exists with active email verification in production DB.',
        steps: [
            { action: 'Navigate to /forgot-password and input registered email "user@company.com".', expected: 'Form validates email string and enables submit action.' },
            { action: 'Submit form and monitor API network response.', expected: 'HTTP 200 returned with generic confirmation payload.' },
            { action: 'Inspect email dispatch queue for generated token.', expected: 'Single-use cryptographic URL delivered within 10 seconds.' }
        ],
        expectedResult: 'System issues single-use token valid for 15 minutes without disclosing user existence in database.'
    },
    {
        id: 'TC-002',
        scenario: 'Invalid email syntax',
        title: 'Submit malformed email address and assert client/server schema rejection',
        type: 'Negative',
        priority: 'High',
        status: 'Needs Review',
        stepsCount: 2,
        preconditions: 'Password recovery form loaded in browser.',
        steps: [
            { action: 'Input malformed email strings ("user@", "user@domain..com").', expected: 'Client-side RFC 5322 validation prevents submission.' },
            { action: 'Bypass client validation and post raw payload to /api/auth/forgot-password.', expected: 'HTTP 422 Unprocessable Entity returned with structured validation schema error.' }
        ],
        expectedResult: 'System rejects malformed email strings at both client UI and API gateway with clear error feedback.'
    },
    {
        id: 'TC-003',
        scenario: 'Expired reset link',
        title: 'Attempt password update using reset token exceeding 15-minute TTL',
        type: 'Edge Case',
        priority: 'Medium',
        status: 'Needs Review',
        stepsCount: 2,
        preconditions: 'Token was generated 16 minutes prior to redemption attempt.',
        steps: [
            { action: 'Open password reset link with expired token parameter in browser.', expected: 'App checks expiration timestamp on initial page load.' },
            { action: 'Input compliant new password and submit update request.', expected: 'HTTP 400 Bad Request returned with error code "TOKEN_EXPIRED".' }
        ],
        expectedResult: 'System rejects expired token, maintains original password hash, and provides CTA to request a fresh token.'
    },
    {
        id: 'TC-004',
        scenario: 'Multiple reset attempts',
        title: 'Exceed API rate limit threshold via rapid successive reset requests',
        type: 'Security',
        priority: 'High',
        status: 'Needs Review',
        stepsCount: 2,
        preconditions: 'API gateway rate limiter configured for 5 requests per IP per 60 seconds.',
        steps: [
            { action: 'Dispatch 6 consecutive reset requests within 20 seconds from single client IP.', expected: 'First 5 requests process normally; 6th request triggers rate limit barrier.' },
            { action: 'Inspect response headers on 6th request.', expected: 'HTTP 429 Too Many Requests returned with Retry-After: 60 header.' }
        ],
        expectedResult: 'API gateway throttles excessive reset requests and logs anomaly event to telemetry.'
    },
    {
        id: 'TC-005',
        scenario: 'Unregistered email',
        title: 'Submit unregistered email address and verify uniform timing response',
        type: 'Negative',
        priority: 'Medium',
        status: 'Needs Review',
        stepsCount: 2,
        preconditions: 'Target email "unregistered@domain.com" is absent from user database.',
        steps: [
            { action: 'Submit unregistered email address to forgot-password form.', expected: 'Generic confirmation shown: "If an account exists, instructions have been sent".' },
            { action: 'Measure API endpoint response latency delta against valid email dispatch.', expected: 'Response time delta is under 35ms, preventing timing enumeration.' }
        ],
        expectedResult: 'Application returns uniform message and constant-time latency to eliminate account enumeration attacks.'
    }
];

export const TestSuiteSection = () => {
    const [selectedTcId, setSelectedTcId] = useState('TC-001');
    const [selectedType, setSelectedType] = useState('All');
    const [showBdd, setShowBdd] = useState(false);

    const filteredCases = QA_TEST_CASES.filter(tc => selectedType === 'All' || tc.type === selectedType);
    const activeCase = QA_TEST_CASES.find(tc => tc.id === selectedTcId) || QA_TEST_CASES[0];

    return (
        <section className="tn-section tn-test-suite-section" aria-labelledby="suite-heading">
            <div className="tn-container">
                <div className="tn-section-header">
                    <span className="tn-kicker">Structured Output</span>
                    <h2 id="suite-heading" className="tn-section-title">
                        Generate structured test cases, not test case snippets.
                    </h2>
                    <p className="tn-section-subtitle">
                        Every test case includes complete preconditions, atomic execution steps, explicit expected results, test parameters, and BDD syntax.
                    </p>
                </div>

                {/* Filter and Category Pills */}
                <div className="tn-suite-filter-row">
                    <div className="tn-filter-pills-wrap">
                        {['All', 'Functional', 'Negative', 'Edge Case', 'Security'].map((type) => (
                            <button
                                key={type}
                                type="button"
                                className={`tn-suite-pill ${selectedType === type ? 'is-active' : ''}`}
                                onClick={() => setSelectedType(type)}
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                    <span className="tn-suite-count-label">
                        Showing {filteredCases.length} of {QA_TEST_CASES.length} scenarios
                    </span>
                </div>

                {/* Master-Detail Structured Container */}
                <div className="tn-suite-master-detail">
                    {/* Left: Table */}
                    <div className="tn-suite-table-pane">
                        <table className="tn-suite-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '82px' }}>ID</th>
                                    <th>Scenario & Description</th>
                                    <th style={{ width: '100px' }}>Type</th>
                                    <th style={{ width: '84px' }}>Priority</th>
                                    <th style={{ width: '105px' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCases.map((tc) => {
                                    const isSelected = activeCase.id === tc.id;
                                    return (
                                        <tr
                                            key={tc.id}
                                            className={`tn-suite-row ${isSelected ? 'is-selected' : ''}`}
                                            onClick={() => setSelectedTcId(tc.id)}
                                        >
                                            <td>
                                                <span className="tn-tc-id-pill">{tc.id}</span>
                                            </td>
                                            <td>
                                                <div className="tn-scenario-cell">
                                                    <strong>{tc.scenario}</strong>
                                                    <span>{tc.title}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`tn-type-chip tn-type-chip--${tc.type.toLowerCase().replace(/\s+/g, '')}`}>
                                                    {tc.type}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`tn-prio-chip tn-prio-chip--${tc.priority.toLowerCase()}`}>
                                                    {tc.priority}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="tn-status-pill-subtle">
                                                    <span className="tn-dot-status" />
                                                    {tc.status}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Right: Detail Card */}
                    <div className="tn-suite-detail-pane">
                        <div className="tn-detail-card-head">
                            <div>
                                <span className="tn-tc-id-pill">{activeCase.id}</span>
                                <h4>{activeCase.scenario}</h4>
                                <span className="tn-detail-subtitle">{activeCase.title}</span>
                            </div>
                            <button
                                type="button"
                                className="tn-bdd-toggle"
                                onClick={() => setShowBdd(!showBdd)}
                            >
                                <Code size={13} />
                                <span>{showBdd ? 'Steps' : 'Gherkin BDD'}</span>
                            </button>
                        </div>

                        {showBdd ? (
                            <div className="tn-bdd-spec-box">
                                <pre><code>{`@${activeCase.type.toLowerCase().replace(/\s+/g, '_')} @priority_${activeCase.priority.toLowerCase()}
Scenario: ${activeCase.scenario}
  Given ${activeCase.preconditions}
  When ${activeCase.steps[0]?.action}
  Then ${activeCase.steps[0]?.expected}
  ${activeCase.steps[1] ? `And ${activeCase.steps[1].action}\n  Then ${activeCase.steps[1].expected}` : ''}
  Then ${activeCase.expectedResult}`}</code></pre>
                            </div>
                        ) : (
                            <div className="tn-detail-card-body">
                                <div className="tn-detail-block">
                                    <label>PRECONDITIONS</label>
                                    <p>{activeCase.preconditions}</p>
                                </div>

                                <div className="tn-detail-block">
                                    <label>TEST STEPS ({activeCase.steps.length})</label>
                                    <div className="tn-detail-steps-list">
                                        {activeCase.steps.map((st, i) => (
                                            <div key={i} className="tn-detail-step-item">
                                                <span className="tn-step-bubble">{String(i + 1).padStart(2, '0')}</span>
                                                <div>
                                                    <p><strong>Action:</strong> {st.action}</p>
                                                    <p className="tn-exp-line"><strong>Expected:</strong> {st.expected}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="tn-detail-block">
                                    <label>EXPECTED RESULT</label>
                                    <div className="tn-expected-box-inline">
                                        <CheckSquare size={14} className="text-accent shrink-0" />
                                        <p>{activeCase.expectedResult}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default TestSuiteSection;
