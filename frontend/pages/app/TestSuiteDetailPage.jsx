import React, { useMemo } from 'react';
import { useParams, useLocation, NavLink, useNavigate } from 'react-router-dom';
import { Sparkles, Plus, Layers, ArrowLeft, Clock } from 'lucide-react';
import { useHistory } from '../../hooks/useHistory';
import ResultsSection from '../../components/ResultsSection';

// Demo fallback tests if directly visited without prior generation
const FALLBACK_DEMO_SUITE = {
    testSuiteName: 'Password Reset Suite',
    functional: [
        {
            id: 'TC-001',
            title: 'Reset password with valid registered email',
            scenario: 'Verify standard password recovery email dispatch',
            type: 'Functional',
            priority: 'High',
            severity: 'Critical',
            status: 'Needs Review',
            reqId: 'REQ-001',
            preconditions: ['User account exists with verified active email address.'],
            steps: [
                { action: 'Navigate to /forgot-password and input registered email address.', expected: 'Input accepted; Send button enabled.' },
                { action: 'Click "Send Reset Instructions".', expected: 'HTTP 200 returned; generic success feedback shown; reset token generated.' },
                { action: 'Inspect email queue for generated one-time link.', expected: 'Email received within 10s containing secure token link.' }
            ],
            expectedResult: 'System issues single-use reset link and displays standard confirmation without disclosing user existence.',
            testData: 'email: "alex.qa@company.internal"'
        },
        {
            id: 'TC-002',
            title: 'Reset password with invalid email format',
            scenario: 'Validate client & server RFC 5322 compliance',
            type: 'Negative',
            priority: 'High',
            severity: 'Major',
            status: 'Needs Review',
            reqId: 'REQ-001',
            preconditions: ['Password recovery form is open in browser.'],
            steps: [
                { action: 'Input malformed email strings: "user@", "user@.com".', expected: 'Inline client validation blocks submission.' },
                { action: 'Dispatch POST with invalid email payload.', expected: 'HTTP 422 Unprocessable Entity returned.' }
            ],
            expectedResult: 'System rejects malformed email strings at both client UI and API gateway.',
            testData: 'payload: { email: "malformed@invalid..com" }'
        }
    ],
    negative: [
        {
            id: 'TC-003',
            title: 'Submit empty or whitespace email payload',
            scenario: 'Ensure required field constraints are strictly enforced',
            type: 'Negative',
            priority: 'Medium',
            severity: 'Minor',
            status: 'Needs Review',
            reqId: 'REQ-001',
            preconditions: ['User on forgot-password page.'],
            steps: [
                { action: 'Leave email input empty and click Submit.', expected: 'Submission blocked with "Email is required".' }
            ],
            expectedResult: 'Form enforces non-empty trimmed email constraint.'
        }
    ],
    edge: [
        {
            id: 'TC-004',
            title: 'Use expired reset link beyond TTL',
            scenario: 'Verify token expiration window strictly blocks credential update',
            type: 'Edge Case',
            priority: 'High',
            severity: 'Critical',
            status: 'Needs Review',
            reqId: 'REQ-001',
            preconditions: ['Reset token exists and exceeded 15-minute TTL window.'],
            steps: [
                { action: 'Open password reset URL with expired token.', expected: 'Token validation fails on load.' },
                { action: 'Submit new compliant password in input fields.', expected: 'HTTP 400 Bad Request returned with "TOKEN_EXPIRED".' }
            ],
            expectedResult: 'System gracefully rejects expired token and leaves original credentials intact.'
        }
    ],
    nonFunctional: [],
    summary: {
        total: 18,
        requirementCoverage: '94%',
        highPriority: 6,
        edge: 4,
        functional: 8,
        negative: 5
    }
};

const TestSuiteDetailPage = () => {
    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { history, saveToHistory } = useHistory();

    // 1. Check if passed via navigation state
    // 2. Check in history items
    // 3. Fallback to demo suite
    const suiteData = useMemo(() => {
        if (location.state?.suite) {
            return location.state.suite;
        }

        const foundInHistory = history.find(item => item.id === id || item.feature?.toLowerCase().includes(id?.replace(/-/g, ' ')));
        if (foundInHistory?.suite) {
            return foundInHistory.suite;
        }

        return FALLBACK_DEMO_SUITE;
    }, [id, location.state, history]);

    const promptText = location.state?.prompt ||
        history.find(item => item.id === id)?.requirement ||
        'Users can reset their password using their registered email address.';

    const suiteTitle = suiteData?.testSuiteName || suiteData?.title ||
        (id ? id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Password Reset Suite');

    const totalTests = suiteData?.summary?.total || 18;
    const coverage = suiteData?.summary?.requirementCoverage || '94%';
    const highPriority = suiteData?.summary?.highPriority || 6;
    const edgeCount = suiteData?.summary?.edge?.length || suiteData?.summary?.edge || 4;

    const handleSave = (suite) => {
        saveToHistory(suite, promptText, { type: 'web', level: 'Standard' });
        alert('Test suite saved to history!');
    };

    return (
        <div className="test-suite-detail-page" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Suite Header Summary Banner */}
            <div className="tn-suite-summary-banner">
                <div className="tn-suite-summary-banner__left">
                    <span className="tn-suite-tag">
                        <Sparkles size={13} />
                        TEST SUITE WORKBENCH
                    </span>
                    <h1 className="tn-suite-title">{suiteTitle}</h1>
                </div>

                <div className="tn-suite-summary-stats">
                    <div className="tn-suite-stat-pill">
                        <strong>{totalTests}</strong>
                        <span>TEST CASES</span>
                    </div>
                    <div className="tn-suite-stat-pill">
                        <strong style={{ color: '#00f2de' }}>{coverage}</strong>
                        <span>REQ COVERAGE</span>
                    </div>
                    <div className="tn-suite-stat-pill">
                        <strong style={{ color: '#f59e0b' }}>{highPriority}</strong>
                        <span>HIGH PRIORITY</span>
                    </div>
                    <div className="tn-suite-stat-pill">
                        <strong style={{ color: '#a78bfa' }}>{edgeCount}</strong>
                        <span>EDGE CASES</span>
                    </div>
                </div>

                <div className="tn-suite-summary-actions">
                    <NavLink to="/app/workspace" className="tn-btn-new-suite">
                        <Plus size={15} />
                        <span>New Suite</span>
                    </NavLink>
                </div>
            </div>

            {/* Reused Existing Full Interactive ResultsSection */}
            <ResultsSection
                result={suiteData}
                onSave={() => handleSave(suiteData)}
                isLatest={true}
            />
        </div>
    );
};

export default TestSuiteDetailPage;
