import React, { useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useHistory } from '../../hooks/useHistory';
import ResultsSection from '../../components/ResultsSection';

// ─── Full 18-test-case fallback dataset ───
// 8 Functional, 5 Negative, 4 Edge Case, 1 Security
const FALLBACK_DEMO_SUITE = {
    testSuiteName: 'Password Reset Suite',
    feature: 'Password Reset',
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
            title: 'Render password reset form correctly',
            scenario: 'Verify reset form UI structure and accessibility attributes',
            type: 'Functional',
            priority: 'Medium',
            severity: 'Major',
            status: 'Needs Review',
            reqId: 'REQ-001',
            preconditions: ['Application is deployed and /forgot-password route is accessible.'],
            steps: [
                { action: 'Navigate to /forgot-password.', expected: 'Page renders with email input field, submit button, and "Back to Login" link.' },
                { action: 'Inspect DOM for aria-label and form autocomplete attributes.', expected: 'Email input has autocomplete="email" and aria-label="Email address".' }
            ],
            expectedResult: 'Password reset form renders with proper semantic HTML and accessibility attributes.',
            testData: 'route: "/forgot-password"'
        },
        {
            id: 'TC-003',
            title: 'Submit new password via valid reset link',
            scenario: 'Complete the full password reset flow end-to-end',
            type: 'Functional',
            priority: 'High',
            severity: 'Critical',
            status: 'Needs Review',
            reqId: 'REQ-001',
            preconditions: ['Valid reset token exists and has not expired (within 15-minute TTL).'],
            steps: [
                { action: 'Open reset URL with valid token parameter.', expected: 'New password form renders with two password fields.' },
                { action: 'Enter compliant password in both fields and submit.', expected: 'HTTP 200; password updated confirmation shown.' },
                { action: 'Attempt login with the new password.', expected: 'Login succeeds with updated credentials.' }
            ],
            expectedResult: 'Password is updated in the system; old password no longer works; user can login with new credentials.',
            testData: 'newPassword: "Str0ng!P@ss2024", token: "valid-reset-token-abc123"'
        },
        {
            id: 'TC-004',
            title: 'Invalidate all active sessions on password change',
            scenario: 'Verify session termination across devices after password reset',
            type: 'Functional',
            priority: 'High',
            severity: 'Critical',
            status: 'Needs Review',
            reqId: 'REQ-001',
            preconditions: ['User has active sessions on 2+ devices.', 'Valid reset token exists.'],
            steps: [
                { action: 'Complete password reset flow on Device A.', expected: 'Password updated successfully.' },
                { action: 'Check session status on Device B.', expected: 'Session is invalidated; user is redirected to login page.' }
            ],
            expectedResult: 'All pre-existing sessions are terminated upon successful password change.',
            testData: 'devices: ["desktop-chrome", "mobile-safari"]'
        },
        {
            id: 'TC-005',
            title: 'Display generic confirmation for unregistered email',
            scenario: 'Prevent user enumeration via reset endpoint response',
            type: 'Functional',
            priority: 'High',
            severity: 'Critical',
            status: 'Needs Review',
            reqId: 'REQ-001',
            preconditions: ['No account exists for the provided email address.'],
            steps: [
                { action: 'Submit reset request with unregistered email.', expected: 'HTTP 200 returned with identical generic success message.' },
                { action: 'Compare response body with registered email response.', expected: 'Response body and HTTP status are identical.' }
            ],
            expectedResult: 'System returns identical response for registered and unregistered emails to prevent enumeration.',
            testData: 'email: "ghost@nonexistent-domain.test"'
        },
        {
            id: 'TC-006',
            title: 'Verify reset token is single-use',
            scenario: 'Confirm consumed token cannot be reused for a second password change',
            type: 'Functional',
            priority: 'High',
            severity: 'Critical',
            status: 'Needs Review',
            reqId: 'REQ-001',
            preconditions: ['Password reset was completed successfully using a token.'],
            steps: [
                { action: 'Attempt to reuse the same token URL to set another password.', expected: 'HTTP 400 returned with TOKEN_CONSUMED or TOKEN_INVALID error.' },
                { action: 'Verify database shows token status as "consumed".', expected: 'Token record has consumed_at timestamp set.' }
            ],
            expectedResult: 'Consumed token is permanently invalidated and cannot be replayed.',
            testData: 'token: "already-consumed-token-xyz"'
        },
        {
            id: 'TC-007',
            title: 'Enforce password complexity policy on new password',
            scenario: 'Validate new password meets minimum security requirements',
            type: 'Functional',
            priority: 'Medium',
            severity: 'Major',
            status: 'Needs Review',
            reqId: 'REQ-001',
            preconditions: ['User is on the set-new-password form via valid reset link.'],
            steps: [
                { action: 'Enter password "abc" (too short, no uppercase/numbers/symbols).', expected: 'Inline validation displays complexity requirements not met.' },
                { action: 'Enter password "Str0ng!P@ss" (meets all criteria).', expected: 'Validation passes; submit button enabled.' }
            ],
            expectedResult: 'Password policy is enforced at both client and server levels with clear user feedback.',
            testData: 'policy: { minLength: 8, requireUppercase: true, requireNumber: true, requireSymbol: true }'
        },
        {
            id: 'TC-008',
            title: 'Reset link email contains correct branding and instructions',
            scenario: 'Verify email content, sender identity, and link structure',
            type: 'Functional',
            priority: 'Medium',
            severity: 'Minor',
            status: 'Needs Review',
            reqId: 'REQ-001',
            preconditions: ['Reset email has been dispatched to a valid user.'],
            steps: [
                { action: 'Inspect email headers for sender domain and DKIM/SPF.', expected: 'Sender domain matches application domain; DKIM passes.' },
                { action: 'Verify email body contains reset link with HTTPS and token parameter.', expected: 'Link uses HTTPS; token is URL-safe base64 encoded.' },
                { action: 'Verify email includes expiration warning.', expected: 'Email states "This link expires in 15 minutes".' }
            ],
            expectedResult: 'Reset email follows brand guidelines, uses secure link format, and communicates expiration clearly.',
            testData: 'emailDomain: "noreply@company.com"'
        }
    ],
    negative: [
        {
            id: 'TC-009',
            title: 'Reset password with invalid email format',
            scenario: 'Validate client and server RFC 5322 compliance',
            type: 'Negative',
            priority: 'High',
            severity: 'Major',
            status: 'Needs Review',
            reqId: 'REQ-001',
            preconditions: ['Password recovery form is open in browser.'],
            steps: [
                { action: 'Input malformed email strings: "user@", "user@.com", "@domain".', expected: 'Inline client validation blocks submission.' },
                { action: 'Bypass client validation and POST malformed email to API.', expected: 'HTTP 422 Unprocessable Entity returned.' }
            ],
            expectedResult: 'System rejects malformed email strings at both client UI and API gateway.',
            testData: 'payload: { email: "malformed@invalid..com" }'
        },
        {
            id: 'TC-010',
            title: 'Submit empty or whitespace-only email payload',
            scenario: 'Ensure required field constraints are strictly enforced',
            type: 'Negative',
            priority: 'Medium',
            severity: 'Minor',
            status: 'Needs Review',
            reqId: 'REQ-001',
            preconditions: ['User is on /forgot-password page.'],
            steps: [
                { action: 'Leave email input empty and click Submit.', expected: 'Submission blocked with "Email is required" message.' },
                { action: 'Enter whitespace-only string "   " and click Submit.', expected: 'Submission blocked after trimming; same error message shown.' }
            ],
            expectedResult: 'Form enforces non-empty trimmed email constraint at both client and server.',
            testData: 'payload: { email: "   " }'
        },
        {
            id: 'TC-011',
            title: 'Reject weak replacement password below policy threshold',
            scenario: 'Verify server-side password complexity enforcement on reset',
            type: 'Negative',
            priority: 'Medium',
            severity: 'Major',
            status: 'Needs Review',
            reqId: 'REQ-001',
            preconditions: ['User has valid reset token and is on set-new-password form.'],
            steps: [
                { action: 'Enter password "123" in new password field.', expected: 'Client validation shows password requirements not met.' },
                { action: 'Bypass client and POST weak password to API.', expected: 'HTTP 422 returned with PASSWORD_POLICY_VIOLATION error code.' }
            ],
            expectedResult: 'System rejects passwords that do not meet complexity requirements at server level.',
            testData: 'payload: { password: "123", token: "valid-token" }'
        },
        {
            id: 'TC-012',
            title: 'Reject mismatched confirm password field',
            scenario: 'Verify password confirmation matching validation',
            type: 'Negative',
            priority: 'Medium',
            severity: 'Minor',
            status: 'Needs Review',
            reqId: 'REQ-001',
            preconditions: ['User is on set-new-password form via valid reset link.'],
            steps: [
                { action: 'Enter "SecurePass1!" in password field and "DifferentPass2!" in confirm field.', expected: 'Client-side validation displays "Passwords do not match".' },
                { action: 'Attempt form submission.', expected: 'Submission blocked until passwords match.' }
            ],
            expectedResult: 'System prevents password reset when confirmation field does not match.',
            testData: 'payload: { password: "SecurePass1!", confirm: "DifferentPass2!" }'
        },
        {
            id: 'TC-013',
            title: 'Reject reset request with tampered or invalid token',
            scenario: 'Verify tampered token is detected and rejected',
            type: 'Negative',
            priority: 'High',
            severity: 'Critical',
            status: 'Needs Review',
            reqId: 'REQ-001',
            preconditions: ['Attacker has a modified or fabricated token string.'],
            steps: [
                { action: 'Submit password reset with a randomly generated fake token.', expected: 'HTTP 400 returned with TOKEN_INVALID error.' },
                { action: 'Submit with a partially modified valid token (1 character changed).', expected: 'HTTP 400 returned; cryptographic signature validation fails.' }
            ],
            expectedResult: 'System detects token tampering and rejects the request without leaking token structure details.',
            testData: 'token: "tampered-abc123-modified"'
        }
    ],
    edge: [
        {
            id: 'TC-014',
            title: 'Use expired reset link beyond 15-minute TTL',
            scenario: 'Verify token expiration window strictly blocks credential update',
            type: 'Edge Case',
            priority: 'High',
            severity: 'Critical',
            status: 'Needs Review',
            reqId: 'REQ-001',
            preconditions: ['Reset token exists and exceeded 15-minute TTL window.'],
            steps: [
                { action: 'Open password reset URL with expired token.', expected: 'Token validation fails on page load.' },
                { action: 'Submit new compliant password in input fields.', expected: 'HTTP 400 Bad Request returned with "TOKEN_EXPIRED" code.' }
            ],
            expectedResult: 'System gracefully rejects expired token and displays "Link expired — request a new one" message.',
            testData: 'token: "expired-15min-token", ttl: "15m"'
        },
        {
            id: 'TC-015',
            title: 'Handle network disconnect during reset submission',
            scenario: 'Verify graceful failure when connection drops mid-submission',
            type: 'Edge Case',
            priority: 'Medium',
            severity: 'Major',
            status: 'Needs Review',
            reqId: 'REQ-001',
            preconditions: ['User is on set-new-password form.', 'Network will be disrupted during submission.'],
            steps: [
                { action: 'Fill password fields and simulate network disconnect before clicking Submit.', expected: 'Submit attempt fails with network error.' },
                { action: 'Reconnect network and retry submission with same token.', expected: 'If token not yet consumed, reset succeeds; otherwise user is prompted to request new link.' }
            ],
            expectedResult: 'System handles intermittent connectivity gracefully without corrupting account state.',
            testData: 'networkCondition: "offline-during-submit"'
        },
        {
            id: 'TC-016',
            title: 'Concurrent reset requests for the same account',
            scenario: 'Verify only most recent token is valid when multiple are requested',
            type: 'Edge Case',
            priority: 'High',
            severity: 'Critical',
            status: 'Needs Review',
            reqId: 'REQ-001',
            preconditions: ['User triggers reset request twice within 30 seconds.'],
            steps: [
                { action: 'Send first reset request; note Token A.', expected: 'Token A generated and emailed.' },
                { action: 'Send second reset request within 30s; note Token B.', expected: 'Token B generated; Token A should be invalidated.' },
                { action: 'Attempt password reset with Token A.', expected: 'HTTP 400 returned — token invalidated by newer request.' },
                { action: 'Attempt password reset with Token B.', expected: 'Reset succeeds with Token B.' }
            ],
            expectedResult: 'Only the most recently generated token is valid; previous tokens are invalidated.',
            testData: 'tokenA: "first-token", tokenB: "second-token"'
        },
        {
            id: 'TC-017',
            title: 'SQL injection and XSS payload in email field',
            scenario: 'Verify input sanitization against injection attacks in reset form',
            type: 'Edge Case',
            priority: 'High',
            severity: 'Critical',
            status: 'Needs Review',
            reqId: 'REQ-001',
            preconditions: ['Password recovery form is accessible.'],
            steps: [
                { action: 'Enter SQL injection payload: "\' OR 1=1 --" in email field.', expected: 'Input rejected with validation error; no database query execution.' },
                { action: 'Enter XSS payload: "<script>alert(1)</script>@test.com".', expected: 'Input sanitized; no script execution in response.' }
            ],
            expectedResult: 'System sanitizes all user input and parameterizes database queries; no injection is possible.',
            testData: 'payload: { email: "\\\' OR 1=1 --" }'
        }
    ],
    nonFunctional: [
        {
            id: 'TC-018',
            title: 'Enforce rate limiting on repeated reset dispatches',
            scenario: 'Block brute-force mail server flooding via 5+ requests in 60s',
            type: 'Security',
            priority: 'High',
            severity: 'Critical',
            status: 'Needs Review',
            reqId: 'REQ-001',
            preconditions: ['User or automated client on /forgot-password endpoint.'],
            steps: [
                { action: 'Submit 5 consecutive password reset requests within 30 seconds.', expected: 'First 3 requests process normally; 4th and 5th return HTTP 429 Too Many Requests.' },
                { action: 'Inspect Retry-After header in 429 response.', expected: 'Header contains "Retry-After: 60" cooldown window.' },
                { action: 'Wait 60 seconds and retry.', expected: 'Request processes normally after cooldown.' }
            ],
            expectedResult: 'API gateway throttles excessive reset requests and logs anomaly event.',
            testData: 'rateLimit: "3 req/min", clientIP: "198.51.100.42"'
        }
    ],
    summary: {
        total: 18,
        requirementCoverage: '94%',
        highPriority: 6,
        edge: 4,
        functional: 8,
        negative: 5
    },
    quality: {
        coverageConfidence: 94
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

    const handleSave = (suite) => {
        saveToHistory(suite, promptText, { type: 'web', level: 'Standard' });
        alert('Test suite saved to history!');
    };

    return (
        <div className="test-suite-detail-page">
            <ResultsSection
                result={suiteData}
                onSave={() => handleSave(suiteData)}
                isLatest={true}
            />
        </div>
    );
};

export default TestSuiteDetailPage;
