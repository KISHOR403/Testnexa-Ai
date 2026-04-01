/**
 * Service to handle test generation requests.
 * Connects to the TestNexa AI backend API.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

export const apiService = {
    generateTestSuite: async (requirement, settings) => {
        try {
            // Map frontend detail levels to backend expected values
            const detailLevelMap = {
                'essential': 'basic',
                'standard': 'medium',
                'comprehensive': 'detailed'
            };

            const mappedDetailLevel = detailLevelMap[settings.level.toLowerCase()] || 'medium';

            const response = await fetch(`${API_BASE_URL}/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include', // Include cookies for authentication
                body: JSON.stringify({
                    requirement: requirement,
                    appType: settings.type.toLowerCase(),
                    detailLevel: mappedDetailLevel,
                    testFocus: settings.testFocus || 'mixed', // NEW: Test type focus
                    language: settings.language || 'en-US',
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();

                // Special handling for 422 Input Quality Error
                if (response.status === 422) {
                    throw new Error(errorData.error || "We couldn't understand your input. Please describe a software feature clearly, e.g. 'User login with email and password validation'.");
                }

                // Special handling for 429 Rate Limit / Resource Exhausted
                if (response.status === 429) {
                    const message = errorData.error || "";
                    const retryMatch = message.match(/retry in ([\d.]+s)/i);
                    const retryTime = retryMatch ? retryMatch[1] : "60 seconds";
                    throw new Error(`QUOTA_LIMIT: Gemini is currently busy. Please wait for ${retryTime} before trying again.`);
                }

                // Special handling for 400 Validation Errors
                if (response.status === 400) {
                    throw new Error(errorData.error || 'Please check your input. Make sure your requirement is at least 20 characters long.');
                }

                throw new Error(errorData.error || 'Failed to generate test cases. Please try again.');
            }

            const result = await response.json();
            console.table({
                status: response.status,
                hasData: !!result.data,
                testsCount: result.data?.summary?.total || 0
            });

            // Transform backend response to match frontend expectations with defensive defaults
            const normalize = (cases = [], type = 'FUNC') => {
                return (Array.isArray(cases) ? cases : []).map((tc, i) => {
                    if (!tc || typeof tc !== 'object') return null;
                    return {
                        ...tc,
                        id: String(tc.id || `TC_${type}_${i + 1}`),
                        title: String(tc.title || 'Untitled Test Case'),
                        steps: Array.isArray(tc.steps) ? tc.steps.map(String) : [],
                        expected: String(tc.expected || tc.expectedResult || 'No expected result provided'),
                        priority: String(tc.priority || 'Medium'),
                        intentGroup: String(tc.intentGroup || 'General Coverage'),
                        reason: String(tc.reason || '')
                    };
                }).filter(Boolean);
            };

            const data = result.data || {};
            const normalized = {
                feature: String(data.feature || 'Generated Suite'),
                summary: {
                    functional: Number(data.summary?.functional || 0),
                    negative: Number(data.summary?.negative || 0),
                    edge: Number(data.summary?.edge || 0),
                    apiChecklist: Number(data.summary?.apiChecklist || 0),
                    nonFunctional: Number(data.summary?.nonFunctional || 0),
                },
                functional: normalize(data.functional, 'FUNC'),
                negative: normalize(data.negative, 'NEG'),
                edge: normalize(data.edge, 'EDGE'),
                api: normalize(data.apiChecklist || data.api, 'API'),
                nonFunctional: normalize(data.nonFunctional, 'NONFUNC'),
                assumptions: Array.isArray(data.assumptions) ? data.assumptions.map(a =>
                    (a && typeof a === 'object') ? (a.text || a.message || a.assumption || JSON.stringify(a)) : String(a || '')
                ) : [],
                quality: {
                    coverageConfidence: Number(data.quality?.coverageConfidence || 85),
                    ambiguityScore: String(data.quality?.ambiguityScore || 'Low'),
                    confidenceWarnings: Array.isArray(data.quality?.confidenceWarnings) ? data.quality.confidenceWarnings.map(String) : []
                },
                questions: Array.isArray(data.questions) ? data.questions.map(String) : [],
                metadata: result.metadata || {},
            };

            window.DEBUG_LAST_RESULT = normalized;
            return normalized;
        } catch (error) {
            console.error('CRITICAL API ERROR:', error);
            // alert('BROWSER ERROR: ' + error.message); // REMOVED intrusive alert
            throw new Error(`Test generation failed: ${error.message}`);
        }
    }
};
