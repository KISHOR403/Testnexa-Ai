export const generateMockSuite = (requirement, settings) => {
    const feature = requirement.toLowerCase().includes('login') ? 'Login' : 'Feature';

    return {
        feature,
        totalCases: 24,
        summary: {
            functional: 10,
            negative: 8,
            edge: 6
        },
        functional: [
            {
                id: 'TC_LOGIN_001',
                title: 'Login with valid credentials',
                priority: 'High',
                steps: ['Open login page', 'Enter valid email', 'Enter valid password', 'Click login'],
                expected: 'User should be redirected to dashboard'
            },
            {
                id: 'TC_LOGIN_002',
                title: 'Session persistence after login',
                priority: 'Medium',
                steps: ['Perform successful login', 'Refresh the page', 'Check if user is still logged in'],
                expected: 'User should remain logged in'
            }
        ],
        negative: [
            {
                id: 'TC_NEG_001',
                title: 'Login with invalid email',
                priority: 'High',
                steps: ['Open login page', 'Enter unregistered email', 'Enter any password', 'Click login'],
                expected: "Error message 'Invalid credentials' should appear"
            },
            {
                id: 'TC_NEG_002',
                title: 'Login with empty fields',
                priority: 'Medium',
                steps: ['Open login page', 'Leave email and password empty', 'Click login'],
                expected: 'Validation errors should be displayed'
            }
        ],
        edge: [
            {
                id: 'TC_EDGE_001',
                title: 'Account lock after 5 failed attempts',
                priority: 'High',
                steps: ['Enter wrong password 5 times', 'Try logging in a 6th time'],
                expected: 'Account should be locked for 30 minutes'
            }
        ],
        api: [
            {
                method: 'POST',
                endpoint: '/auth/login',
                checks: [
                    'Status code check (200/401)',
                    'Response body validation',
                    'Token should be returned',
                    'Error message for invalid credentials',
                    'Response time < 2 seconds'
                ]
            }
        ],
        questions: [
            'What is password minimum length?',
            'Should lock be per user or per IP?',
            'What message should show on lock?'
        ]
    };
};
