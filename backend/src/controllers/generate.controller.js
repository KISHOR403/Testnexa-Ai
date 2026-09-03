const { validateGenerateRequest } = require('../services/validation.service');
const orchestrator = require('../services/orchestrator.service');
const logger = require('../utils/logger');
const { formatErrorResponse } = require('../utils/errors');
const mongoose = require('mongoose');
const TestHistory = require('../models/testHistory.model');
const User = require('../models/user.model');

/**
 * Enhanced Test Case Generation Controller
 * Uses two-step orchestration for improved accuracy
 * Now saves generation history to MongoDB
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

        // Log the internal result for debugging
        logger.info('Generation completed successfully', {
            functionalCount: result.functional?.length || 0,
            negativeCount: result.negative?.length || 0,
            edgeCount: result.edge?.length || 0,
            apiCount: result.apiChecklist?.length || 0,
            processingTime
        });

        // Debug: Save the result to a file so we can inspect it
        try {
            const fs = require('fs');
            const path = require('path');
            const debugFile = path.join(__dirname, '../../debug_last_result.json');
            fs.writeFileSync(debugFile, JSON.stringify(result, null, 2));
        } catch (e) {
            logger.error('Failed to save debug result', e);
        }

        // Step 3: Build Final Response
        const response = {
            success: true,
            data: {
                feature: result.understanding.feature,

                // Test cases
                functional: result.functional,
                negative: result.negative,
                edge: result.edge,
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

        // Step 4: Save test generation history to MongoDB (non-blocking)
        if (req.user && req.user._id && mongoose.connection.readyState === 1) {
            // Save in background — don't slow down the response
            const saveHistory = async () => {
                try {
                    // Legacy TestHistory save (backward compatibility)
                    await TestHistory.create({
                        userId: req.user._id,
                        requirement,
                        appType,
                        detailLevel,
                        testFocus: testFocus || 'mixed',
                        feature: result.understanding.feature || '',
                        summary: {
                            total: result.metadata.totalTestCases,
                            functional: result.functional.length,
                            negative: result.negative.length,
                            edge: result.edge.length,
                            nonFunctional: result.nonFunctional.length,
                            apiChecklist: result.apiChecklist.length
                        },
                        quality: {
                            confidenceLevel: result.quality.confidenceLevel || '',
                            ambiguityScore: result.quality.ambiguityScore || ''
                        },
                        data: result,
                        processingTime,
                        model: process.env.GEMINI_MODEL || 'gemini-1.5-flash'
                    });

                    // WorkspaceSession: create or update
                    const WorkspaceSession = require('../models/workspaceSession.model');
                    const sessionId = req.body.sessionId;
                    const summaryData = {
                        total: result.metadata.totalTestCases,
                        functional: result.functional.length,
                        negative: result.negative.length,
                        edge: result.edge.length,
                        nonFunctional: result.nonFunctional.length,
                        apiChecklist: result.apiChecklist.length
                    };
                    const qualityData = {
                        confidenceLevel: result.quality.confidenceLevel || '',
                        ambiguityScore: result.quality.ambiguityScore || '',
                        coverageConfidence: result.quality.coverageConfidence || 0
                    };

                    if (sessionId && mongoose.Types.ObjectId.isValid(sessionId)) {
                        // Update existing session
                        const session = await WorkspaceSession.findOne({ _id: sessionId, userId: req.user._id });
                        if (session) {
                            // Snapshot previous version if suite already exists
                            if (session.suiteData) {
                                const newVersion = (session.currentVersion || 0) + 1;
                                session.versions.push({
                                    versionNumber: session.currentVersion || 1,
                                    suiteData: session.suiteData,
                                    summary: session.summary,
                                    createdAt: new Date()
                                });
                                session.currentVersion = newVersion;
                            } else {
                                session.currentVersion = 1;
                            }
                            session.suiteData = response.data;
                            session.summary = summaryData;
                            session.quality = qualityData;
                            session.status = 'Generated';
                            session.messages.push({
                                role: 'assistant',
                                content: `Generated ${result.metadata.totalTestCases} test cases for "${result.understanding.feature}".`,
                                timestamp: new Date()
                            });
                            await session.save();
                        }
                    } else {
                        // Create new session
                        const title = result.understanding.feature || requirement.split(/[.!?\n]/)[0].trim().slice(0, 50) || 'Generated Suite';
                        await WorkspaceSession.create({
                            userId: req.user._id,
                            title,
                            status: 'Generated',
                            requirement,
                            context: appType || 'web',
                            depth: detailLevel === 'basic' ? 'Essential' : detailLevel === 'detailed' ? 'Comprehensive' : 'Standard',
                            messages: [
                                { role: 'user', content: requirement, timestamp: new Date() },
                                { role: 'assistant', content: `Generated ${result.metadata.totalTestCases} test cases for "${title}".`, timestamp: new Date() }
                            ],
                            suiteData: response.data,
                            currentVersion: 1,
                            summary: summaryData,
                            quality: qualityData
                        });
                    }

                    // Increment user's total test count
                    await User.findByIdAndUpdate(req.user._id, {
                        $inc: { totalTestsGenerated: result.metadata.totalTestCases }
                    });

                    logger.info('Test history + session saved for user', { userId: req.user._id });
                } catch (historyErr) {
                    logger.error('Failed to save test history/session', historyErr);
                }
            };

            saveHistory(); // Fire-and-forget
        }

        logger.info('Enhanced test cases generated successfully', {
            feature: result.understanding.feature,
            totalTests: result.metadata.totalTestCases,
            confidenceLevel: result.quality.confidenceLevel,
            ambiguityLevel: result.quality.ambiguityScore,
            primaryDomain: result.domainContext.primaryDomain,
            processingTime: response.metadata.processingTime
        });

        res.json(response);

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

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const [history, total] = await Promise.all([
            TestHistory.find({ userId: req.user._id })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            TestHistory.countDocuments({ userId: req.user._id })
        ]);

        res.json({
            success: true,
            data: history,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        logger.error('Error fetching test history', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    generateTestCases,
    getTestHistory,
};
