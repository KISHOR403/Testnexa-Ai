const { validateGenerateRequest } = require('../services/validation.service');
const orchestrator = require('../services/orchestrator.service');
const logger = require('../utils/logger');
const { formatErrorResponse } = require('../utils/errors');
const crypto = require('crypto');
const supabaseService = require('../services/supabaseData.service');

/**
 * Enhanced Test Case Generation Controller
 * Uses two-step orchestration for improved accuracy
 * Permanently persists generation history and workspace session to Supabase
 */
const generateTestCases = async (req, res) => {
    const startTime = Date.now();

    try {
        const aiConfig = require('../config/ai.config');

        logger.info('Received test generation request', {
            body: req.body,
            runtimeProvider: aiConfig.provider
        });

        // Step 1: Validate Request
        const validatedData = validateGenerateRequest(req.body);
        const { requirement, appType, detailLevel, testFocus } = validatedData;

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
        const targetUserId = req.user ? (req.user._id || req.user.id) : null;

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

            } catch (err) {
                logger.error('Failed to save generation to Supabase:', err);
            }
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
        logger.error('Error in enhanced test generation', error);
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

module.exports = {
    generateTestCases,
    getTestHistory,
    getGenerationStatus,
};
