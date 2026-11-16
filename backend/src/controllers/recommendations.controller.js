/**
 * TestNexa AI — Smart Test Recommendations Controller
 */

const crypto = require('crypto');
const smartRecommendationsService = require('../services/recommendations/smartRecommendations.service');
const supabaseService = require('../services/supabaseData.service');
const auditService = require('../services/auditService');
const logger = require('../utils/logger');

// In-memory caches for idempotency and undo tracking
const idempotencyStore = new Map();
const undoStore = new Map();

// Periodic prune
setInterval(() => {
    const now = Date.now();
    for (const [k, v] of idempotencyStore.entries()) {
        if (now > v.expiresAt) idempotencyStore.delete(k);
    }
    for (const [k, v] of undoStore.entries()) {
        if (now > v.expiresAt) undoStore.delete(k);
    }
}, 60000).unref();

/**
 * GET /api/v1/recommendations/context
 * Returns requirement context, linked test counts, and coverage gap hints for a suite
 */
const getRecommendationsContext = async (req, res, next) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        const suiteId = req.query.suite_id || req.query.suiteId;
        if (!suiteId) {
            return res.status(200).json({
                success: true,
                data: {
                    suiteId: null,
                    suiteTitle: null,
                    requirements: [],
                    gapShortcuts: []
                }
            });
        }

        const session = await supabaseService.getSession(suiteId, userId);
        if (!session) {
            return res.status(404).json({
                success: false,
                code: 'SUITE_NOT_FOUND',
                message: 'Test suite not found or access denied in your workspace.'
            });
        }

        const suiteData = session.suiteData || session.suite_data || session.data || {};
        const suiteTitle = session.title || suiteData.testSuiteName || suiteData.feature || 'Test Suite';

        const rawReqs = smartRecommendationsService.extractSuiteRequirements(session);
        const existingCases = smartRecommendationsService.extractSuiteTestCases(session);

        const requirements = rawReqs.map(r => {
            const linked = existingCases.filter(c =>
                String(c.requirementId || c.requirementRef || '').toLowerCase() === String(r.id).toLowerCase()
            );
            const categoriesCovered = new Set(linked.map(c => (c.category || c.type || '').toLowerCase()));
            const missingCategories = [];
            if (!categoriesCovered.has('negative') && !categoriesCovered.has('negative validation')) missingCategories.push('Negative');
            if (!categoriesCovered.has('edge') && !categoriesCovered.has('boundary')) missingCategories.push('Edge');
            if (!categoriesCovered.has('security')) missingCategories.push('Security');
            if (!categoriesCovered.has('api') && !categoriesCovered.has('apichecklist')) missingCategories.push('API');
            if (!categoriesCovered.has('non-functional') && !categoriesCovered.has('nonfunctional')) missingCategories.push('Non-functional');

            return {
                id: r.id,
                title: r.title,
                description: r.description || '',
                linkedTestsCount: linked.length,
                missingCategories
            };
        });

        // Compute gap shortcuts (up to 3)
        const gapShortcuts = [];
        const noNegative = requirements.filter(r => r.missingCategories.includes('Negative'));
        if (noNegative.length > 0) {
            gapShortcuts.push({
                id: 'gap_no_negative',
                label: `${noNegative.length} requirement${noNegative.length > 1 ? 's have' : ' has'} no negative test`,
                requirementId: noNegative.length === 1 ? noNegative[0].id : 'all',
                categories: ['Negative']
            });
        }

        const singleTest = requirements.filter(r => r.linkedTestsCount === 1);
        if (singleTest.length > 0) {
            gapShortcuts.push({
                id: 'gap_single_test',
                label: `${singleTest.length} requirement${singleTest.length > 1 ? 's have' : ' has'} a single test`,
                requirementId: singleTest[0].id,
                categories: ['Negative', 'Edge']
            });
        }

        const noSecurity = requirements.filter(r => r.missingCategories.includes('Security'));
        if (noSecurity.length > 0 && gapShortcuts.length < 3) {
            gapShortcuts.push({
                id: 'gap_no_security',
                label: `${noSecurity.length} requirement${noSecurity.length > 1 ? 's have' : ' has'} no security test`,
                requirementId: noSecurity.length === 1 ? noSecurity[0].id : 'all',
                categories: ['Security']
            });
        }

        const untested = requirements.filter(r => r.linkedTestsCount === 0);
        if (untested.length > 0 && gapShortcuts.length < 3) {
            gapShortcuts.push({
                id: 'gap_untested',
                label: `${untested.length} requirement${untested.length > 1 ? 's have' : ' has'} 0 tests`,
                requirementId: untested[0].id,
                categories: ['Functional', 'Negative']
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                suiteId,
                suiteTitle,
                requirements,
                gapShortcuts: gapShortcuts.slice(0, 3)
            }
        });
    } catch (error) {
        logger.error('Error fetching recommendations context:', error);
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to retrieve recommendations context'
        });
    }
};

/**
 * POST /api/v1/recommendations/generate
 * Analyzes requirements and existing test cases, then generates smart recommendations
 */
const generateRecommendations = async (req, res, next) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        const {
            suiteId,
            requirementId,
            requestedCategories,
            focusArea,
            limit
        } = req.body || {};

        if (!suiteId) {
            return res.status(400).json({
                success: false,
                code: 'MISSING_PARAM',
                message: 'suiteId is required'
            });
        }

        const result = await smartRecommendationsService.generateRecommendations({
            suiteId,
            userId,
            requirementId: requirementId || null,
            requestedCategories: Array.isArray(requestedCategories) ? requestedCategories : null,
            focusArea: focusArea || null,
            limit: limit ? parseInt(limit, 10) : 6
        });

        auditService.logFromRequest(req, {
            action: 'ai.recommendations_generated',
            resourceType: 'ai',
            resourceId: suiteId,
            resourceDisplayName: `Suite ${suiteId} Recommendations`,
            metadata: { count: result.recommendations?.length || 0, focusArea }
        }).catch(() => {});

        return res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        logger.error('Error generating recommendations:', error);
        return res.status(error.statusCode || 500).json({
            success: false,
            code: error.code || 'RECOMMENDATION_ERROR',
            message: error.message || 'Failed to generate recommendations'
        });
    }
};

/**
 * GET /api/v1/recommendations/suites/:suiteId
 * Retrieves the latest recommendations for a test suite
 */
const getSuiteRecommendations = async (req, res, next) => {
    try {
        const userId = req.user?._id || req.user?.id;
        const { suiteId } = req.params;

        if (!suiteId) {
            return res.status(400).json({ success: false, message: 'suiteId is required' });
        }

        const session = await supabaseService.getRecommendationSessionBySuite(suiteId, userId);

        return res.status(200).json({
            success: true,
            data: session || null
        });
    } catch (error) {
        logger.error('Error retrieving suite recommendations:', error);
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to retrieve recommendations'
        });
    }
};

/**
 * GET /api/v1/recommendations/:id
 * Retrieves a single recommendation by ID
 */
const getRecommendationById = async (req, res, next) => {
    try {
        const userId = req.user?._id || req.user?.id;
        const { id } = req.params;

        const rec = await supabaseService.getRecommendation(id, userId);
        if (!rec) {
            return res.status(404).json({ success: false, message: 'Recommendation not found' });
        }

        return res.status(200).json({
            success: true,
            data: rec
        });
    } catch (error) {
        logger.error('Error retrieving recommendation:', error);
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to retrieve recommendation'
        });
    }
};

/**
 * PATCH /api/v1/recommendations/:id
 * Updates recommendation status (accepted, rejected, pending) or edits content
 */
const updateRecommendation = async (req, res, next) => {
    try {
        const userId = req.user?._id || req.user?.id;
        const { id } = req.params;
        const { status, editedFields } = req.body || {};

        if (status && !['pending', 'accepted', 'rejected'].includes(status)) {
            return res.status(400).json({
                success: false,
                code: 'INVALID_STATUS',
                message: 'Status must be one of: pending, accepted, rejected'
            });
        }

        const updated = await smartRecommendationsService.updateRecommendationStatus(id, userId, {
            status,
            editedFields
        });

        if (!updated) {
            return res.status(404).json({ success: false, message: 'Recommendation not found' });
        }

        return res.status(200).json({
            success: true,
            data: updated
        });
    } catch (error) {
        logger.error('Error updating recommendation:', error);
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to update recommendation'
        });
    }
};

const SUITE_CASE_CATEGORIES = [
    'testCases', 'tests', 'functional', 'negative', 'edge',
    'security', 'nonFunctional', 'apiChecklist', 'api'
];

/**
 * POST /api/v1/recommendations/accept (and /convert-to-drafts)
 * Converts accepted recommendations into draft test cases in the test suite
 * Supports Idempotency-Key header and 10-minute undo window
 */
const acceptRecommendations = async (req, res, next) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        // 1. Check Idempotency-Key
        const idempotencyKey = req.headers?.['idempotency-key'];
        if (idempotencyKey && idempotencyStore.has(idempotencyKey)) {
            const cached = idempotencyStore.get(idempotencyKey);
            if (Date.now() <= cached.expiresAt) {
                return res.status(200).json(cached.response);
            }
        }

        const { suiteId, recommendationIds, recommendations } = req.body || {};

        const hasRecIds = Array.isArray(recommendationIds) && recommendationIds.length > 0;
        const hasRecObjs = Array.isArray(recommendations) && recommendations.length > 0;

        if (!suiteId || (!hasRecIds && !hasRecObjs)) {
            return res.status(400).json({
                success: false,
                code: 'INVALID_REQUEST',
                message: 'suiteId and at least one recommendationId or recommendation object are required'
            });
        }

        // If recommendationIds provided without objects, use smartRecommendationsService
        if (Array.isArray(recommendationIds) && recommendationIds.length > 0 && (!recommendations || recommendations.length === 0)) {
            const result = await smartRecommendationsService.convertRecommendationsToDraftCases({
                suiteId,
                userId,
                recommendationIds
            });

            const undoToken = `undo_${crypto.randomUUID()}`;
            const undoExpiresAt = Date.now() + 10 * 60 * 1000;
            const addedCaseIds = (result.draftCases || []).map(c => c.id);

            undoStore.set(undoToken, {
                suiteId,
                userId,
                testCaseIds: addedCaseIds,
                createdAt: Date.now(),
                expiresAt: undoExpiresAt
            });

            const responsePayload = {
                success: true,
                data: {
                    ...result,
                    undoToken,
                    undoExpiresAt
                }
            };

            if (idempotencyKey) {
                idempotencyStore.set(idempotencyKey, {
                    response: responsePayload,
                    expiresAt: Date.now() + 10 * 60 * 1000
                });
            }

            return res.status(200).json(responsePayload);
        }

        // If recommendations array of objects is provided
        const recList = Array.isArray(recommendations) ? recommendations : [];
        if (recList.length === 0 && (!recommendationIds || recommendationIds.length === 0)) {
            return res.status(400).json({
                success: false,
                code: 'INVALID_REQUEST',
                message: 'At least one recommendation must be provided to add to suite'
            });
        }

        const session = await supabaseService.getSession(suiteId, userId);
        if (!session) {
            return res.status(404).json({
                success: false,
                code: 'SUITE_NOT_FOUND',
                message: 'Test suite not found or access denied in your workspace.'
            });
        }

        const suiteData = structuredClone(session.suiteData || session.suite_data || session.data || {});
        if (!suiteData.testCases) suiteData.testCases = [];

        // Collect existing titles and IDs to check duplicates
        const existingIds = new Set();
        const existingTitles = new Set();

        SUITE_CASE_CATEGORIES.forEach(cat => {
            if (Array.isArray(suiteData[cat])) {
                suiteData[cat].forEach(c => {
                    if (c && c.id) existingIds.add(String(c.id));
                    const t = (c.title || c.testScenario || '').trim().toLowerCase();
                    if (t) existingTitles.add(t);
                });
            }
        });

        const categoryPrefixMap = {
            'positive': 'TC_FUNC',
            'functional': 'TC_FUNC',
            'negative': 'TC_NEG',
            'boundary value': 'TC_EDGE',
            'boundary': 'TC_EDGE',
            'edge case': 'TC_EDGE',
            'edge': 'TC_EDGE',
            'validation': 'TC_VAL',
            'error handling': 'TC_ERR',
            'security': 'TC_SEC',
            'regression': 'TC_REG',
            'accessibility': 'TC_A11Y',
            'non-functional': 'TC_NF',
            'api': 'TC_API'
        };

        const typeLabelMap = {
            'positive': 'Functional',
            'functional': 'Functional',
            'negative': 'Negative',
            'boundary value': 'Edge Case',
            'boundary': 'Edge Case',
            'edge case': 'Edge Case',
            'edge': 'Edge Case',
            'validation': 'Functional',
            'error handling': 'Negative',
            'security': 'Security',
            'regression': 'Functional',
            'accessibility': 'Non-Functional',
            'non-functional': 'Non-Functional',
            'api': 'API'
        };

        const addedCases = [];
        const skipped = [];

        for (const rec of recList) {
            const rawTitle = (rec.title || '').trim();
            if (!rawTitle) continue;

            // Check if title is duplicate of existing test case
            if (existingTitles.has(rawTitle.toLowerCase())) {
                skipped.push({
                    id: rec.id,
                    title: rawTitle,
                    reason: 'Duplicate of existing test case in this suite'
                });
                continue;
            }

            const normalizedCat = (rec.category || 'functional').toLowerCase();
            const prefix = categoryPrefixMap[normalizedCat] || 'TC_REC';
            let seq = 1;
            let testCaseId = `${prefix}_${String(seq).padStart(3, '0')}`;
            while (existingIds.has(testCaseId)) {
                seq++;
                testCaseId = `${prefix}_${String(seq).padStart(3, '0')}`;
            }
            existingIds.add(testCaseId);
            existingTitles.add(rawTitle.toLowerCase());

            const newCase = {
                id: testCaseId,
                testScenario: rawTitle,
                module: rec.relatedRequirementTitle || suiteData.testSuiteName || 'Smart Recommendations',
                title: rawTitle,
                type: typeLabelMap[normalizedCat] || 'Functional',
                priority: rec.priority || 'Medium',
                severity: rec.priority === 'Critical' ? 'Critical' : rec.priority === 'High' ? 'Major' : 'Minor',
                preconditions: rec.preconditions || 'N/A',
                testData: rec.testData || 'N/A',
                steps: Array.isArray(rec.steps) ? rec.steps : [String(rec.steps || 'Execute steps')],
                expectedResult: rec.expectedResult || 'Expected system outcome',
                actualResult: 'Not yet executed',
                status: 'Draft', // Human approval required
                requirementId: rec.relatedRequirementId || 'REQ_001',
                _source: 'smart_recommendation',
                _recommendationId: rec.id,
                _createdFromRecommendationAt: new Date().toISOString()
            };

            let destinationCategory = 'functional';
            if (normalizedCat.includes('neg') || normalizedCat.includes('error')) destinationCategory = 'negative';
            else if (normalizedCat.includes('edge') || normalizedCat.includes('boundary')) destinationCategory = 'edge';
            else if (normalizedCat.includes('sec')) destinationCategory = 'security';
            else if (normalizedCat.includes('access') || normalizedCat.includes('non-func')) destinationCategory = 'nonFunctional';
            else if (normalizedCat.includes('api')) destinationCategory = 'apiChecklist';

            if (Array.isArray(suiteData[destinationCategory])) {
                suiteData[destinationCategory].push(newCase);
            } else {
                suiteData.testCases.push(newCase);
            }

            addedCases.push(newCase);
        }

        if (addedCases.length > 0) {
            const summary = session.summary || {};
            let total = 0;
            SUITE_CASE_CATEGORIES.forEach(arr => {
                const len = Array.isArray(suiteData[arr]) ? suiteData[arr].length : 0;
                summary[arr] = len;
                total += len;
            });
            summary.total = total;

            await supabaseService.updateSession(suiteId, userId, {
                suiteData,
                summary
            });
        }

        const undoToken = `undo_${crypto.randomUUID()}`;
        const undoExpiresAt = Date.now() + 10 * 60 * 1000;
        const addedIds = addedCases.map(c => c.id);

        undoStore.set(undoToken, {
            suiteId,
            userId,
            testCaseIds: addedIds,
            createdAt: Date.now(),
            expiresAt: undoExpiresAt
        });

        auditService.logFromRequest(req, {
            action: 'ai.recommendations_accepted',
            resourceType: 'ai',
            resourceId: suiteId,
            resourceDisplayName: `Suite ${suiteId} Draft Cases Added`,
            metadata: { convertedCount: addedCases.length, skippedCount: skipped.length }
        }).catch(() => {});

        const responsePayload = {
            success: true,
            data: {
                suiteId,
                convertedCount: addedCases.length,
                skippedCount: skipped.length,
                skipped,
                addedCases,
                undoToken,
                undoExpiresAt
            }
        };

        if (idempotencyKey) {
            idempotencyStore.set(idempotencyKey, {
                response: responsePayload,
                expiresAt: Date.now() + 10 * 60 * 1000
            });
        }

        return res.status(200).json(responsePayload);
    } catch (error) {
        logger.error('Error accepting recommendations:', error);
        return res.status(error.statusCode || 500).json({
            success: false,
            code: error.code || 'ACCEPT_ERROR',
            message: error.message || 'Failed to accept recommendations'
        });
    }
};

/**
 * POST /api/v1/recommendations/undo
 * Undoes recently added test cases within 10 minutes
 */
const undoRecommendations = async (req, res, next) => {
    try {
        const userId = req.user?._id || req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        const { suiteId, undoToken, testCaseIds } = req.body || {};
        if (!suiteId || (!undoToken && (!testCaseIds || testCaseIds.length === 0))) {
            return res.status(400).json({
                success: false,
                code: 'INVALID_REQUEST',
                message: 'suiteId and undoToken (or testCaseIds) are required'
            });
        }

        let targetIds = Array.isArray(testCaseIds) ? testCaseIds : [];

        if (undoToken) {
            const undoRecord = undoStore.get(undoToken);
            if (!undoRecord) {
                return res.status(400).json({
                    success: false,
                    code: 'UNDO_INVALID',
                    message: 'Undo token is invalid or has already been used.'
                });
            }

            if (Date.now() > undoRecord.expiresAt) {
                undoStore.delete(undoToken);
                return res.status(400).json({
                    success: false,
                    code: 'UNDO_EXPIRED',
                    message: 'Undo window has expired (10 minutes limit).'
                });
            }

            if (undoRecord.suiteId !== suiteId || undoRecord.userId !== userId) {
                return res.status(403).json({
                    success: false,
                    code: 'FORBIDDEN',
                    message: 'Cannot undo actions across different suites or workspaces.'
                });
            }

            if (targetIds.length === 0) {
                targetIds = undoRecord.testCaseIds;
            }
            undoStore.delete(undoToken);
        }

        const targetIdSet = new Set(targetIds.map(String));
        const session = await supabaseService.getSession(suiteId, userId);
        if (!session) {
            return res.status(404).json({
                success: false,
                code: 'SUITE_NOT_FOUND',
                message: 'Test suite not found or access denied in your workspace.'
            });
        }

        const suiteData = structuredClone(session.suiteData || session.suite_data || session.data || {});
        let removedCount = 0;
        const removedIds = [];

        SUITE_CASE_CATEGORIES.forEach(cat => {
            if (Array.isArray(suiteData[cat])) {
                const initialLen = suiteData[cat].length;
                suiteData[cat] = suiteData[cat].filter(c => {
                    if (c && targetIdSet.has(String(c.id))) {
                        removedIds.push(c.id);
                        return false;
                    }
                    return true;
                });
                removedCount += (initialLen - suiteData[cat].length);
            }
        });

        // Recompute suite summary counts
        const summary = session.summary || {};
        let total = 0;
        SUITE_CASE_CATEGORIES.forEach(arr => {
            const len = Array.isArray(suiteData[arr]) ? suiteData[arr].length : 0;
            summary[arr] = len;
            total += len;
        });
        summary.total = total;

        await supabaseService.updateSession(suiteId, userId, {
            suiteData,
            summary
        });

        auditService.logFromRequest(req, {
            action: 'ai.recommendations_undone',
            resourceType: 'ai',
            resourceId: suiteId,
            resourceDisplayName: `Suite ${suiteId} Draft Cases Undone`,
            metadata: { removedCount, removedIds }
        }).catch(() => {});

        logger.info(`Undid addition of ${removedCount} test cases for suite ${suiteId}`);

        return res.status(200).json({
            success: true,
            message: `Successfully removed ${removedCount} test cases`,
            data: {
                removedCount,
                removedIds
            }
        });
    } catch (error) {
        logger.error('Error undoing recommendations:', error);
        return res.status(error.statusCode || 500).json({
            success: false,
            code: error.code || 'UNDO_ERROR',
            message: error.message || 'Failed to undo recommendations'
        });
    }
};

module.exports = {
    getRecommendationsContext,
    generateRecommendations,
    getSuiteRecommendations,
    getRecommendationById,
    updateRecommendation,
    convertToDrafts: acceptRecommendations,
    acceptRecommendations,
    undoRecommendations
};


