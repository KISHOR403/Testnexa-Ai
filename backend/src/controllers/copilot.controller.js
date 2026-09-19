const copilotService = require('../services/copilot.service');
const supabaseService = require('../services/supabaseData.service');
const logger = require('../utils/logger');

/**
 * Helper to fetch authoritative session and verify user ownership
 */
const getAuthorizedSession = async (sessionId, userId) => {
    if (!sessionId) return null;

    if (supabaseService.isAvailable) {
        try {
            const session = await supabaseService.getSession(sessionId, userId);
            if (session) return session;
        } catch (err) {
            logger.warn('Supabase getSession failed in copilot controller:', err.message);
        }
    }

    return null;
};

/**
 * Helper to persist updated session data to DB
 */
const persistUpdatedSession = async (sessionId, userId, updates) => {
    if (supabaseService.isAvailable) {
        return await supabaseService.updateSession(sessionId, userId, updates);
    }
    return null;
};

/**
 * POST /api/v1/copilot/analyze
 * Context-aware QA copilot analysis
 */
const analyzeSuite = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        const {
            testSuiteId,
            testCaseId,
            contextScope = 'suite',
            action = 'review_coverage',
            query,
            localSuiteContext
        } = req.body;

        let suiteData = null;
        let requirement = '';

        // 1. If testSuiteId is provided, enforce authoritative DB lookup & authorization
        if (testSuiteId) {
            const session = await getAuthorizedSession(testSuiteId, userId);

            if (!session) {
                // If the user specified an ID that doesn't exist or belongs to another user
                return res.status(404).json({
                    success: false,
                    code: 'SUITE_NOT_FOUND_OR_DENIED',
                    message: 'Test suite not found or access denied.'
                });
            }

            suiteData = session.suiteData || session.suite_data || session;
            requirement = session.requirement || session.raw_requirement || '';
        } else if (localSuiteContext && typeof localSuiteContext === 'object') {
            // Unpersisted sandbox / demo run
            suiteData = localSuiteContext;
            requirement = localSuiteContext.requirement || localSuiteContext.feature || '';
        } else {
            return res.status(400).json({
                success: false,
                code: 'INVALID_REQUEST',
                message: 'A valid testSuiteId or test suite context is required.'
            });
        }

        // 2. Run analysis via Copilot Service
        const result = await copilotService.runCopilotAnalysis({
            suiteData,
            requirement,
            testCaseId,
            contextScope,
            action,
            query
        });

        res.json(result);
    } catch (error) {
        logger.error('Error in Copilot analyzeSuite:', error);
        res.status(500).json({
            success: false,
            code: 'COPILOT_ANALYSIS_FAILED',
            message: 'Unable to complete QA analysis. Please try again.'
        });
    }
};

/**
 * POST /api/v1/copilot/actions/add-test
 * Human-in-the-loop: Add Copilot-suggested test case to test suite
 */
const addSuggestedtestCase = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        const { testSuiteId, testCase, localSuiteContext } = req.body;

        if (!testCase || !testCase.title) {
            return res.status(400).json({
                success: false,
                code: 'INVALID_TEST_CASE',
                message: 'Test case data with a title is required.'
            });
        }

        // 1. If persistent suite ID is provided, verify ownership & update DB
        if (testSuiteId) {
            const session = await getAuthorizedSession(testSuiteId, userId);
            if (!session) {
                return res.status(404).json({
                    success: false,
                    code: 'SUITE_NOT_FOUND_OR_DENIED',
                    message: 'Test suite not found or access denied.'
                });
            }

            const currentSuiteData = session.suiteData || session.suite_data || {};
            const allExisting = copilotService.extractAllTestCases(currentSuiteData);

            // Generate clean sequential ID
            const newId = testCase.id && !allExisting.some(t => t.id === testCase.id)
                ? testCase.id
                : `TC-${String(allExisting.length + 1).padStart(3, '0')}`;

            const newTestCase = {
                id: newId,
                title: testCase.title,
                scenario: testCase.scenario || testCase.title,
                type: testCase.type || 'Functional',
                priority: testCase.priority || 'High',
                severity: testCase.severity || 'Major',
                status: 'Needs Review',
                reqId: testCase.reqId || testCase.requirementId || 'REQ-001',
                preconditions: Array.isArray(testCase.preconditions) ? testCase.preconditions : [],
                steps: Array.isArray(testCase.steps) ? testCase.steps : [],
                expectedResult: testCase.expectedResult || '',
                testData: testCase.testData || '',
                source: 'copilot',
                generatedBy: 'copilot',
                createdAt: new Date().toISOString()
            };

            // Categorize into appropriate array in suiteData
            const categoryMap = {
                'functional': 'functional',
                'negative': 'negative',
                'edge': 'edge',
                'edge case': 'edge',
                'security': 'negative',
                'api': 'apiChecklist',
                'apichecklist': 'apiChecklist'
            };
            const targetCategory = categoryMap[(newTestCase.type || '').toLowerCase()] || 'functional';

            const updatedSuiteData = { ...currentSuiteData };
            if (!Array.isArray(updatedSuiteData[targetCategory])) {
                updatedSuiteData[targetCategory] = [];
            }
            updatedSuiteData[targetCategory].push(newTestCase);

            // Recalculate summary metrics
            const updatedAll = copilotService.extractAllTestCases(updatedSuiteData);
            const updatedSummary = {
                total: updatedAll.length,
                functional: updatedAll.filter(t => (t.type || '').toLowerCase().includes('func')).length,
                negative: updatedAll.filter(t => (t.type || '').toLowerCase().includes('neg') || (t.type || '').toLowerCase().includes('sec')).length,
                edge: updatedAll.filter(t => (t.type || '').toLowerCase().includes('edge')).length,
                nonFunctional: updatedAll.filter(t => (t.type || '').toLowerCase().includes('non')).length,
                apiChecklist: updatedAll.filter(t => (t.type || '').toLowerCase().includes('api')).length
            };

            await persistUpdatedSession(testSuiteId, userId, {
                suiteData: updatedSuiteData,
                summary: updatedSummary
            });

            return res.status(201).json({
                success: true,
                message: 'Test case added to suite successfully.',
                data: {
                    testCase: newTestCase,
                    summary: updatedSummary
                }
            });
        }

        // 2. Sandbox / local mode fallback (when suite is not yet saved to DB)
        const newTestCase = {
            id: testCase.id || `TC-${Date.now().toString().slice(-3)}`,
            title: testCase.title,
            scenario: testCase.scenario || testCase.title,
            type: testCase.type || 'Functional',
            priority: testCase.priority || 'High',
            severity: testCase.severity || 'Major',
            status: 'Needs Review',
            reqId: testCase.reqId || 'REQ-001',
            preconditions: Array.isArray(testCase.preconditions) ? testCase.preconditions : [],
            steps: Array.isArray(testCase.steps) ? testCase.steps : [],
            expectedResult: testCase.expectedResult || '',
            testData: testCase.testData || '',
            source: 'copilot',
            generatedBy: 'copilot',
            createdAt: new Date().toISOString()
        };

        res.status(201).json({
            success: true,
            message: 'Test case generated successfully.',
            data: {
                testCase: newTestCase
            }
        });
    } catch (error) {
        logger.error('Error in Copilot addSuggestedtestCase:', error);
        res.status(500).json({
            success: false,
            code: 'ADD_TEST_FAILED',
            message: 'Failed to add test case to suite.'
        });
    }
};

/**
 * POST /api/v1/copilot/actions/improve-test
 * Human-in-the-loop: Apply approved improvements to an existing test case
 */
const applyTestImprovement = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        const { testSuiteId, testCaseId, proposed } = req.body;

        if (!testCaseId || !proposed) {
            return res.status(400).json({
                success: false,
                code: 'INVALID_IMPROVEMENT_REQUEST',
                message: 'testCaseId and proposed improvements are required.'
            });
        }

        // 1. If persistent suite ID is provided, verify ownership & mutate DB
        if (testSuiteId) {
            const session = await getAuthorizedSession(testSuiteId, userId);
            if (!session) {
                return res.status(404).json({
                    success: false,
                    code: 'SUITE_NOT_FOUND_OR_DENIED',
                    message: 'Test suite not found or access denied.'
                });
            }

            const currentSuiteData = session.suiteData || session.suite_data || {};
            let found = false;
            let updatedCase = null;

            // Search and update across categories
            const categories = ['functional', 'negative', 'edge', 'nonFunctional', 'apiChecklist', 'api', 'testCases'];
            for (const cat of categories) {
                if (Array.isArray(currentSuiteData[cat])) {
                    const idx = currentSuiteData[cat].findIndex(t => t.id === testCaseId);
                    if (idx !== -1) {
                        const existing = currentSuiteData[cat][idx];
                        updatedCase = {
                            ...existing,
                            title: proposed.title || existing.title,
                            steps: proposed.steps || existing.steps,
                            expectedResult: proposed.expectedResult || existing.expectedResult,
                            preconditions: proposed.preconditions || existing.preconditions,
                            testData: proposed.testData || existing.testData,
                            lastModifiedBy: 'copilot',
                            modifiedAt: new Date().toISOString()
                        };
                        currentSuiteData[cat][idx] = updatedCase;
                        found = true;
                        break;
                    }
                }
            }

            if (!found) {
                return res.status(404).json({
                    success: false,
                    code: 'TEST_CASE_NOT_FOUND',
                    message: `Test case ${testCaseId} was not found in this test suite.`
                });
            }

            await persistUpdatedSession(testSuiteId, userId, {
                suiteData: currentSuiteData
            });

            return res.json({
                success: true,
                message: 'Test case improved and saved successfully.',
                data: {
                    testCase: updatedCase
                }
            });
        }

        // Sandbox / local mode fallback
        res.json({
            success: true,
            message: 'Test case improved successfully.',
            data: {
                testCase: {
                    id: testCaseId,
                    ...proposed,
                    lastModifiedBy: 'copilot',
                    modifiedAt: new Date().toISOString()
                }
            }
        });
    } catch (error) {
        logger.error('Error in Copilot applyTestImprovement:', error);
        res.status(500).json({
            success: false,
            code: 'IMPROVE_TEST_FAILED',
            message: 'Failed to apply test case improvements.'
        });
    }
};

/**
 * GET /api/v1/copilot/context/:testSuiteId
 * Fast contextual metadata for Copilot without loading entire suite
 */
const getSuiteContext = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        const sessionId = req.params.testSuiteId;

        const session = await getAuthorizedSession(sessionId, userId);
        if (!session) {
            return res.status(404).json({
                success: false,
                code: 'SUITE_NOT_FOUND_OR_DENIED',
                message: 'Test suite not found or access denied.'
            });
        }

        const suiteData = session.suiteData || session.suite_data || {};
        const allTests = copilotService.extractAllTestCases(suiteData);

        res.json({
            success: true,
            data: {
                id: session.id || session._id,
                title: session.title || suiteData.feature || 'Untitled Suite',
                requirement: session.requirement || session.raw_requirement || '',
                totalTests: allTests.length,
                status: session.status || 'Needs Review',
                summary: session.summary || {},
                quality: session.quality || suiteData.quality || {},
                testCaseIds: allTests.map(t => ({ id: t.id, title: t.title, type: t.type }))
            }
        });
    } catch (error) {
        logger.error('Error in Copilot getSuiteContext:', error);
        res.status(500).json({
            success: false,
            code: 'GET_CONTEXT_FAILED',
            message: 'Unable to retrieve test suite context.'
        });
    }
};

module.exports = {
    analyzeSuite,
    addSuggestedtestCase,
    applyTestImprovement,
    getSuiteContext
};
