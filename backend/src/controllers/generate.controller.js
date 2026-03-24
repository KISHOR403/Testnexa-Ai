const { validateGenerateRequest } = require('../services/validation.service');
const orchestrator = require('../services/orchestrator.service');
const logger = require('../utils/logger');
const { formatErrorResponse } = require('../utils/errors');

/**
 * Enhanced Test Case Generation Controller
 * Uses two-step orchestration for improved accuracy
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
                processingTime: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
                version: result.metadata.version,
                generationMethod: result.metadata.generationMethod
            }
        };

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

module.exports = {
    generateTestCases,
};
