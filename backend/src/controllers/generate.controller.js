const { validateGenerateRequest } = require('../services/validation.service');
const orchestrator = require('../services/orchestrator.service');
const logger = require('../utils/logger');
const { formatErrorResponse } = require('../utils/errors');
const crypto = require('crypto');
const supabaseService = require('../services/supabaseData.service');
const ambiguityAnalyzer = require('../services/ambiguity.service');
const domainDetector = require('../services/domain.service');
const { callAI } = require('../services/ai.service');
const usageMeteringService = require('../services/usageMetering.service');

/**
 * Enhanced Test Case Generation Controller
 * Uses two-step orchestration for improved accuracy
 * Permanently persists generation history and workspace session to Supabase
 */
const generateTestCases = async (req, res) => {
    const startTime = Date.now();
    let quotaReservation = null;
    let targetOrgId = null;

    try {
        const aiConfig = require('../config/ai.config');

        logger.info('Received test generation request', {
            body: req.body,
            runtimeProvider: aiConfig.provider
        });

        // Step 1: Validate Request
        const validatedData = validateGenerateRequest(req.body);
        const { requirement, appType, detailLevel, testFocus } = validatedData;

        // Step 1.2: Enforce Backend Authentication & Workspace Access
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required. Please sign in to generate test suites.'
            });
        }

        const targetUserId = req.user._id || req.user.id;

        if (req.body.workspaceId) {
            const hasAccess = await supabaseService.verifyUserWorkspaceAccess(req.body.workspaceId, targetUserId);
            if (!hasAccess) {
                return res.status(403).json({
                    success: false,
                    message: 'Forbidden: You do not have permission to generate test suites in the specified workspace.'
                });
            }
        }

        // Step 1.5: Enforce Subscription Plan Generation Quota for Authenticated Users
        targetOrgId = await usageMeteringService.resolveOrgForRequest(req, targetUserId);
        if (targetOrgId) {
            try {
                quotaReservation = await usageMeteringService.reserveQuota({
                    orgId: targetOrgId,
                    workspaceId: req.body.workspaceId || null,
                    userId: targetUserId,
                    metric: 'ai.generations',
                    quantity: 1,
                    operationId: `gen_${Date.now()}`
                });
            } catch (qErr) {
                if (qErr.code === 'QUOTA_EXCEEDED') {
                    return res.status(403).json({
                        success: false,
                        code: 'QUOTA_EXCEEDED',
                        message: qErr.message,
                        data: qErr.data
                    });
                }
                throw qErr;
            }
        } else {
            try {
                const primaryWs = await supabaseService.getUserPrimaryWorkspace(targetUserId, req.user.name || '');
                if (primaryWs) {
                    const billing = await supabaseService.getWorkspaceBilling(primaryWs.id, targetUserId);
                    if (billing && billing.quota && billing.usedGenerations >= billing.quota) {
                        return res.status(429).json({
                            success: false,
                            code: 'GENERATION_QUOTA_EXCEEDED',
                            message: `Monthly generation quota reached (${billing.usedGenerations}/${billing.quota} suites on ${billing.plan.toUpperCase()} tier). Upgrade in Billing & Usage to unlock additional capacity.`,
                            data: {
                                plan: billing.plan,
                                quota: billing.quota,
                                used: billing.usedGenerations
                            }
                        });
                    }
                }
            } catch (quotaErr) {
                logger.warn('Quota verification check notice:', quotaErr.message);
            }
        }

        // Step 2: Use Two-Step Orchestration for Enhanced Accuracy
        logger.info('Starting two-step orchestration', {
            testFocus: testFocus || 'mixed',
            appType,
            detailLevel
        });

        const result = await orchestrator.generateTestCases(requirement, {
            appType,
            detailLevel,
            testFocus: testFocus || 'mixed'
        });

        const processingTime = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;

        logger.info('Generation completed successfully', {
            functionalCount: result.functional?.length || 0,
            negativeCount: result.negative?.length || 0,
            edgeCount: result.edge?.length || 0,
            apiCount: result.apiChecklist?.length || 0,
            processingTime
        });

        // Step 3: Build Final Response
        const response = {
            success: true,
            data: {
                feature: result.understanding.feature,

                // Test cases
                functional: result.functional,
                negative: result.negative,
                edge: result.edge,
                security: result.security || [],
                apiChecklist: result.apiChecklist,
                nonFunctional: result.nonFunctional,

                // Quality metrics
                quality: result.quality,

                // Assumptions and clarifications
                assumptions: result.assumptions,
                assumptionSummary: result.assumptionSummary,
                questions: result.questions,

                // Understanding and context
                understanding: result.understanding,
                domainContext: result.domainContext,

                // Coverage analysis
                coverageGaps: result.coverageGaps,
                warnings: result.warnings,
                recommendations: result.recommendations,

                // Summary
                summary: {
                    total: result.metadata.totalTestCases,
                    functional: result.functional.length,
                    negative: result.negative.length,
                    edge: result.edge.length,
                    security: result.security?.length || 0,
                    nonFunctional: result.nonFunctional.length,
                    apiChecklist: result.apiChecklist.length
                }
            },
            metadata: {
                generatedAt: result.metadata.generatedAt,
                model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
                processingTime,
                version: result.metadata.version,
                generationMethod: result.metadata.generationMethod
            }
        };

        // Step 4: Persist test generation history and workspace session in Supabase
        let savedSessionId = null;
        const generationId = 'gen_' + crypto.randomUUID().replace(/-/g, '');

        if (targetUserId && supabaseService.isAvailable) {
            try {
                const sessionId = req.body.sessionId;

                const functionalCases = result.functional || [];
                const negativeCases = result.negative || [];
                const edgeCases = result.edge || [];
                const nonFunctionalCases = result.nonFunctional || [];
                const apiChecklistCases = result.apiChecklist || [];

                const highPriorityCount = [
                    ...functionalCases,
                    ...negativeCases,
                    ...edgeCases,
                    ...nonFunctionalCases
                ].filter(c => c.priority === 'High' || c.severity === 'Critical' || c.type === 'Security').length;

                const summaryData = {
                    total: result.metadata.totalTestCases || (functionalCases.length + negativeCases.length + edgeCases.length + nonFunctionalCases.length),
                    functional: functionalCases.length,
                    negative: negativeCases.length,
                    edge: edgeCases.length,
                    nonFunctional: nonFunctionalCases.length,
                    apiChecklist: apiChecklistCases.length,
                    highPriority: highPriorityCount
                };

                const qualityData = {
                    confidenceLevel: result.quality.confidenceLevel || '',
                    ambiguityScore: result.quality.ambiguityScore || '',
                    coverageConfidence: result.quality.coverageConfidence || 85
                };

                // Update existing session if sessionId was provided
                if (sessionId) {
                    try {
                        const existing = await supabaseService.getSession(sessionId, targetUserId);
                        if (existing) {
                            const newVersion = (existing.currentVersion || 1) + 1;
                            const versions = [...(existing.versions || []), {
                                versionNumber: existing.currentVersion || 1,
                                suiteData: existing.suiteData,
                                summary: existing.summary,
                                createdAt: new Date().toISOString()
                            }];
                            const messages = [...(existing.messages || []), {
                                role: 'assistant',
                                content: `Generated ${summaryData.total} test cases for "${result.understanding.feature}".`,
                                timestamp: new Date().toISOString()
                            }];
                            const updated = await supabaseService.updateSession(sessionId, targetUserId, {
                                suiteData: response.data,
                                summary: summaryData,
                                quality: qualityData,
                                status: 'NeedsReview',
                                currentVersion: newVersion,
                                versions,
                                messages
                            });
                            savedSessionId = updated.id;
                        }
                    } catch (supErr) {
                        logger.warn('Supabase update existing session note:', supErr.message);
                    }
                }

                // Create new session if none existed or updated
                if (!savedSessionId) {
                    const title = result.understanding.feature || requirement.split(/[.!?\n]/)[0].trim().slice(0, 50) || 'Generated Suite';
                    const newSession = await supabaseService.createSession({
                        userId: targetUserId,
                        title,
                        status: 'NeedsReview',
                        requirement,
                        context: appType || 'web',
                        depth: detailLevel === 'basic' ? 'Essential' : detailLevel === 'detailed' ? 'Comprehensive' : 'Standard',
                        messages: [
                            { role: 'user', content: requirement, timestamp: new Date().toISOString() },
                            { role: 'assistant', content: `Generated ${summaryData.total} test cases for "${title}".`, timestamp: new Date().toISOString() }
                        ],
                        suiteData: response.data,
                        currentVersion: 1,
                        summary: summaryData,
                        quality: qualityData,
                        generationId
                    });
                    savedSessionId = newSession.id;
                }

                // Save test history record
                await supabaseService.saveTestHistory({
                    userId: targetUserId,
                    generationId,
                    sessionId: savedSessionId,
                    requirement,
                    appType,
                    detailLevel,
                    testFocus: testFocus || 'mixed',
                    feature: result.understanding.feature || '',
                    summary: summaryData,
                    quality: qualityData,
                    data: result,
                    processingTime,
                    model: process.env.GEMINI_MODEL || 'gemini-1.5-flash'
                }).catch(e => logger.warn('Supabase saveTestHistory error:', e.message));

                // Increment user total tests generated
                try {
                    const sbUser = await supabaseService.findUserById(targetUserId);
                    if (sbUser) {
                        await supabaseService.updateUser(targetUserId, {
                            total_tests_generated: (sbUser.total_tests_generated || 0) + summaryData.total
                        });
                    }
                } catch (uErr) {}

                // Record generation telemetry event for admin pipeline monitoring
                const adminService = require('../services/admin.service');
                adminService.recordGenerationEvent({
                    requestId: generationId,
                    userId: targetUserId,
                    workspaceId: req.body.workspaceId || null,
                    status: 'success',
                    durationMs: Date.now() - startTime,
                    appType,
                    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
                    testsGenerated: summaryData.total
                });

            } catch (err) {
                logger.error('Failed to save generation to Supabase:', err);
            }
        }

        // Commit usage allowance for successful generation
        if (quotaReservation) {
            await usageMeteringService.commitUsage({
                reservationId: quotaReservation.id,
                orgId: targetOrgId,
                workspaceId: req.body.workspaceId || null,
                userId: targetUserId,
                resourceType: 'suite',
                metric: 'ai.generations',
                quantity: 1,
                operationId: generationId,
                source: 'Web App',
                metadata: {
                    appType,
                    totalTests: result?.functional?.length || 0
                }
            }).catch(e => logger.warn('Failed to commit generation usage:', e.message));
            quotaReservation = null;
        }

        // Return generated data with saved sessionId and generationId
        return res.status(200).json({
            ...response,
            sessionId: savedSessionId,
            testSuiteId: savedSessionId,
            generationId,
            data: {
                ...response.data,
                sessionId: savedSessionId,
                generationId
            },
            meta: {
                ...response.metadata,
                testSuiteId: savedSessionId,
                generationId,
                status: 'completed'
            }
        });

    } catch (error) {
        if (quotaReservation) {
            usageMeteringService.releaseReservation(quotaReservation.id);
            quotaReservation = null;
        }

        logger.error('Error in enhanced test generation', error);

        // Record failed generation telemetry event
        try {
            const adminService = require('../services/admin.service');
            adminService.recordGenerationEvent({
                requestId: `gen_fail_${Date.now()}`,
                userId: req.user ? (req.user._id || req.user.id) : 'anonymous',
                workspaceId: req.body?.workspaceId || null,
                status: 'failed',
                durationMs: Date.now() - startTime,
                appType: req.body?.appType || 'web',
                model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
                errorCategory: error.code || error.name || 'AI_GENERATION_ERROR',
                errorMessage: error.message || 'Generation pipeline failed'
            });
        } catch (telemetryErr) {}

        const errorResponse = formatErrorResponse(error);
        const statusCode = error.statusCode || 500;
        res.status(statusCode).json(errorResponse);
    }
};

/**
 * Get test generation history for the authenticated user
 */
const getTestHistory = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        const userId = req.user._id || req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);

        const result = await supabaseService.getTestHistory(userId, { page, limit });
        return res.json({
            success: true,
            data: result.history,
            pagination: {
                page: result.page,
                limit: result.limit,
                total: result.total,
                totalPages: result.totalPages
            }
        });
    } catch (error) {
        logger.error('Error fetching test history', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get generation status by generation ID
 * GET /api/v1/generations/:id
 */
const getGenerationStatus = async (req, res) => {
    try {
        const generationId = req.params.id;
        const userId = req.user ? (req.user._id || req.user.id) : null;

        if (!generationId) {
            return res.status(400).json({ success: false, message: 'Generation ID is required' });
        }

        // 1. Check test_history in Supabase
        const history = await supabaseService.findHistoryByGenerationId(generationId, userId);
        if (history) {
            return res.json({
                success: true,
                generationId,
                status: 'completed',
                testSuiteId: history.sessionId ? history.sessionId.toString() : null,
                feature: history.feature,
                title: history.feature,
                totalTests: history.summary?.total || 0,
                data: {
                    title: history.feature,
                    feature: history.feature,
                    totalTests: history.summary?.total || 0
                },
                createdAt: history.createdAt
            });
        }

        // 2. Check workspace_sessions in Supabase by generation_id
        const sessionByGen = await supabaseService.findSessionByGenerationId(generationId, userId);
        if (sessionByGen) {
            return res.json({
                success: true,
                generationId,
                status: sessionByGen.suiteData ? 'completed' : 'processing',
                testSuiteId: sessionByGen.id || sessionByGen._id,
                title: sessionByGen.title,
                totalTests: sessionByGen.summary?.total || 0,
                data: {
                    title: sessionByGen.title,
                    totalTests: sessionByGen.summary?.total || 0
                },
                createdAt: sessionByGen.createdAt
            });
        }

        // 3. Check workspace_sessions in Supabase directly by session id
        const directSession = await supabaseService.getSession(generationId, userId);
        if (directSession) {
            return res.json({
                success: true,
                generationId,
                status: directSession.suiteData ? 'completed' : 'processing',
                testSuiteId: directSession.id || directSession._id,
                title: directSession.title,
                totalTests: directSession.summary?.total || 0,
                data: {
                    title: directSession.title,
                    totalTests: directSession.summary?.total || 0
                },
                createdAt: directSession.createdAt
            });
        }

        return res.status(404).json({ success: false, message: 'Generation not found' });
    } catch (error) {
        logger.error('Error fetching generation status', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Analyze a software requirement: extract behavior, rules, ambiguities, and coverage scope
 * POST /api/v1/generate/analyze
 */
const analyzeRequirement = async (req, res) => {
    try {
        const { requirement, appType = 'web', detailLevel = 'medium', acceptanceCriteria = '', additionalContext = '' } = req.body;

        if (!requirement || requirement.trim().length < 15) {
            return res.status(400).json({
                success: false,
                message: 'Requirement description must be at least 15 characters long.'
            });
        }

        // Full merged text for deep grounded inspection
        let fullText = requirement.trim();
        if (acceptanceCriteria && acceptanceCriteria.trim()) {
            fullText += `\n\nAcceptance Criteria:\n${acceptanceCriteria.trim()}`;
        }
        if (additionalContext && additionalContext.trim()) {
            fullText += `\n\nAdditional Context:\n${additionalContext.trim()}`;
        }

        let understanding;
        try {
            understanding = await orchestrator.understandRequirement(fullText, { appType, detailLevel });
        } catch (e) {
            logger.warn('AI understandRequirement notice:', e.message);
            understanding = {
                feature: requirement.split(/[.!?\n]/)[0].trim().slice(0, 50) || 'Analyzed Feature',
                business_rules: [
                    'System must validate user inputs against expected schema, formatting, and bounds',
                    'System must transition to verified success state upon valid submission',
                    'System must safely reject unauthorized, empty, or malicious payloads with clear feedback'
                ],
                inputs: [],
                outputs: [],
                risk_areas: ['input_validation', 'error_handling', 'security_boundaries'],
                non_functional_signals: {
                    security_sensitive: /auth|password|token|pay|credit|secret/i.test(fullText),
                    performance_critical: /fast|latency|realtime|high volume|load/i.test(fullText),
                    user_facing: true
                },
                ambiguities: [
                    'Error messaging codes and exact HTTP status return values are not explicitly defined in the requirement',
                    'Timeout, rate limiting thresholds, and concurrent session limits are unspecified'
                ],
                missing_information: [
                    'Field-level character limits and character set restrictions',
                    'Failure recovery, rollback, and retry rules on downstream network drops'
                ]
            };
        }

        const ambiguityScore = ambiguityAnalyzer.calculateAmbiguityScore(understanding);
        const detectedDomains = domainDetector.detect(understanding);

        res.json({
            success: true,
            data: {
                feature: understanding.feature || 'Feature Analysis',
                businessRules: understanding.business_rules || understanding.rules || [],
                inputs: understanding.inputs || [],
                outputs: understanding.outputs || [],
                riskAreas: understanding.risk_areas || [],
                nonFunctionalSignals: understanding.non_functional_signals || {},
                ambiguities: understanding.ambiguities || [],
                missingInformation: understanding.missing_information || [],
                ambiguityAnalysis: ambiguityScore,
                domains: detectedDomains,
                scopeSummary: {
                    hasPositive: true,
                    hasNegative: true,
                    hasEdge: true,
                    hasSecurity: Boolean(understanding.non_functional_signals?.security_sensitive || /auth|token|pay|perm/i.test(fullText)),
                    estimatedCases: detailLevel === 'detailed' ? 16 : detailLevel === 'basic' ? 6 : 10
                }
            }
        });
    } catch (err) {
        logger.error('Error in analyzeRequirement:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * Regenerate an individual test case with AI while preserving the rest of the suite
 * POST /api/v1/generate/regenerate-case
 */
const regenerateSingleTestCase = async (req, res) => {
    try {
        const { requirement, testCase, category = 'functional', feedback = '', appType = 'web' } = req.body;
        if (!testCase) {
            return res.status(400).json({ success: false, message: 'Existing testCase object is required' });
        }

        const prompt = `You are a Senior QA Automation Architect. Regenerate this single test case to improve its thoroughness and precision.
Requirement: ${requirement || 'N/A'}
Current Test Case:
${JSON.stringify(testCase, null, 2)}
Specific User Feedback: ${feedback || 'Improve edge cases and step specificity.'}

Return ONLY valid JSON matching this exact structure:
{
  "id": "${testCase.id || 'TC_GEN_001'}",
  "title": "Clear, imperative test title",
  "type": "${testCase.type || 'Functional'}",
  "priority": "${testCase.priority || 'High'}",
  "severity": "${testCase.severity || 'Major'}",
  "preconditions": ["Precondition 1", "Precondition 2"],
  "steps": [
    {"action": "Specific action with test data", "expected": "Specific assertion or verified outcome"}
  ],
  "expectedResult": "Overall expected acceptance outcome",
  "requirementId": "${testCase.requirementId || 'REQ-001'}",
  "testData": "Valid test values or payloads"
}`;

        let regeneratedCase;
        try {
            const aiRes = await callAI(prompt, { temperature: 0.2, maxTokens: 2048 });
            regeneratedCase = orchestrator.parseAIResponse(aiRes);
        } catch (e) {
            logger.warn('AI single test case regeneration notice:', e.message);
            regeneratedCase = {
                ...testCase,
                title: `${testCase.title} (Refined)`,
                steps: Array.isArray(testCase.steps) && testCase.steps.length > 0
                    ? testCase.steps.map(s => typeof s === 'object' ? { ...s, expected: s.expected || 'Verified successfully' } : { action: String(s), expected: 'Verified successfully' })
                    : [{ action: 'Perform verified user action', expected: 'System responds with expected behavior' }]
            };
        }

        res.json({
            success: true,
            data: regeneratedCase
        });
    } catch (err) {
        logger.error('Error in regenerateSingleTestCase:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};

module.exports = {
    generateTestCases,
    getTestHistory,
    getGenerationStatus,
    analyzeRequirement,
    regenerateSingleTestCase,
};
