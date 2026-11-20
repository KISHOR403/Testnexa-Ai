/**
 * TestNexa AI — Smart Test Recommendations Service
 *
 * Analyzes requirements, existing test cases, and coverage gaps to generate
 * actionable, non-duplicate, high-value test scenarios.
 *
 * Core Capabilities:
 * 1. Deep requirement and test inventory analysis.
 * 2. Deterministic coverage gap identification (untested, missing negative, edge boundaries,
 *    security, API, shallow coverage, outdated tests, specification defects).
 * 3. Algorithmic multi-tier duplicate and overlap detection (token Jaccard + step similarity).
 * 4. Grounded AI recommendation generation with explicit reason, whyThisTest, and gap explanation.
 * 5. Lifecycle management: SUGGESTED, ACCEPTED, ADDED, DISMISSED, DUPLICATE, EXPIRED.
 * 6. Add to suite transaction with strict 13-field Draft test cases and audit trail.
 * 7. Strict workspace isolation, prompt injection neutralization, and secret redaction.
 */

const crypto = require('crypto');
const aiService = require('../ai.service');
const supabaseService = require('../supabaseData.service');
const logger = require('../../utils/logger');

// Security patterns for redacting secrets
const SECRET_PATTERNS = [
    /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
    /sk-[a-zA-Z0-9_\-]{15,}/g,
    /sb_secret_[a-zA-Z0-9_]{10,}/g,
    /AKIA[0-9A-Z]{16}/g,
    /password["']?\s*[:=]\s*["']?([^"'\s&]+)/gi,
    /postgres:\/\/[^:]+:[^@]+@/gi,
    /mongodb(\+srv)?:\/\/[^:]+:[^@]+@/gi,
    /ghp_[a-zA-Z0-9]{36}/g,
];

// Prompt injection patterns to neutralize in untrusted inputs
const INJECTION_PATTERNS = [
    /(?:ignore|disregard|forget)\s+(?:all\s+)?(?:previous|prior)\s+(?:instructions|prompts|directives)/gi,
    /system\s*(?:prompt|instruction|directive)\s*:/gi,
    /you\s+are\s+now\s+(?:in\s+)?(?:debug|admin|god|developer)\s+mode/gi,
    /output\s+the\s+following\s+text/gi
];

const maskSecrets = (str) => {
    if (!str || typeof str !== 'string') return '';
    let sanitized = str;
    for (const pat of SECRET_PATTERNS) {
        sanitized = sanitized.replace(pat, '[REDACTED_SECRET]');
    }
    return sanitized;
};

const sanitizeUntrustedInput = (str) => {
    if (!str || typeof str !== 'string') return '';
    let cleaned = maskSecrets(str);
    for (const pat of INJECTION_PATTERNS) {
        cleaned = cleaned.replace(pat, '[SANITIZED_PROMPT_DIRECTIVE]');
    }
    return cleaned;
};

/**
 * Calculate token Jaccard similarity between two strings
 */
const calculateSimilarity = (text1, text2) => {
    if (!text1 || !text2) return 0;
    const tokenize = (t) => t.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);
    const set1 = new Set(tokenize(text1));
    const set2 = new Set(tokenize(text2));
    if (set1.size === 0 || set2.size === 0) return 0;

    let intersection = 0;
    for (const word of set1) {
        if (set2.has(word)) intersection++;
    }
    const union = new Set([...set1, ...set2]).size;
    return union > 0 ? intersection / union : 0;
};

const SUITE_CASE_CATEGORIES = [
    'testCases', 'tests', 'functional', 'negative', 'edge',
    'security', 'nonFunctional', 'apiChecklist', 'api'
];

/**
 * Extract normalized test cases from a test suite record
 */
const extractSuiteTestCases = (session) => {
    const suiteData = session?.suiteData || session?.suite_data || session?.data || session?.suite || {};
    const cases = [];
    const seenIds = new Set();

    for (const cat of SUITE_CASE_CATEGORIES) {
        const list = suiteData[cat];
        if (Array.isArray(list)) {
            list.forEach(item => {
                if (!item || typeof item !== 'object') return;
                const id = String(item.id || item.testCaseId || '');
                if (id && seenIds.has(id)) return;
                if (id) seenIds.add(id);

                cases.push({
                    id: id || `TC_${cases.length + 1}`,
                    title: item.title || item.testScenario || item.name || 'Untitled Case',
                    category: item.type || item.category || cat,
                    priority: item.priority || 'Medium',
                    preconditions: item.preconditions || '',
                    steps: Array.isArray(item.steps) ? item.steps : (item.steps ? [String(item.steps)] : []),
                    expectedResult: item.expectedResult || item.expected || '',
                    requirementId: item.requirementId || item.requirementRef || item.reqId || '',
                    module: item.module || item.testScenario || 'General',
                    status: item.status || 'Draft',
                    isDeprecated: Boolean(item.isDeprecated || item.deprecated)
                });
            });
        }
    }

    return cases;
};

/**
 * Extract requirements from a test suite record
 */
const extractSuiteRequirements = (session) => {
    const suiteData = session?.suiteData || session?.suite_data || session?.data || session?.suite || {};
    const reqs = [];
    const seenIds = new Set();

    // 1. Check structured requirements paths
    const candidatePaths = [
        suiteData?.understanding?.functional_requirements,
        suiteData?.requirements,
        suiteData?.traceability?.matrix,
        suiteData?.functionalRequirements
    ];

    for (const path of candidatePaths) {
        if (Array.isArray(path) && path.length > 0) {
            path.forEach((r, idx) => {
                if (!r) return;
                const id = String(r.id || r.reqId || r.requirementId || `REQ_${idx + 1}`);
                if (seenIds.has(id)) return;
                seenIds.add(id);

                reqs.push({
                    id,
                    title: r.title || r.name || r.summary || `Requirement ${id}`,
                    description: r.description || r.requirement || (typeof r === 'string' ? r : ''),
                    category: r.category || r.type || 'Functional'
                });
            });
            break; // Use the first available array
        }
    }

    // 2. If no structured array found, extract from session requirement text
    if (reqs.length === 0) {
        const rawText = session?.requirement || session?.rawRequirement || suiteData?.feature || '';
        if (rawText && rawText.trim()) {
            const lines = rawText.split(/\n+/).map(l => l.trim()).filter(l => l.length > 15);
            if (lines.length > 1) {
                lines.forEach((line, idx) => {
                    reqs.push({
                        id: `REQ_${String(idx + 1).padStart(3, '0')}`,
                        title: line.length > 60 ? line.slice(0, 57) + '...' : line,
                        description: line,
                        category: 'Functional'
                    });
                });
            } else {
                reqs.push({
                    id: 'REQ_001',
                    title: session?.title || 'Core Requirement Specification',
                    description: rawText.trim(),
                    category: 'Functional'
                });
            }
        }
    }

    return reqs;
};

/**
 * Deterministic coverage analysis engine.
 * Detects:
 * - Requirements with zero linked test cases.
 * - Missing negative scenarios.
 * - Missing edge and boundary scenarios.
 * - Missing security scenarios when relevant (auth, payment, token, secret, permissions).
 * - Missing API scenarios when relevant (endpoints, REST, payload, HTTP status).
 * - Requirements with incomplete scenario coverage (single test).
 * - Requirements whose linked test cases are outdated.
 * - Requirement conflicts or insufficient specification.
 */
const analyzeCoverageGaps = (requirements, existingCases) => {
    const gaps = [];
    const reqCoverageMap = new Map();
    const validReqIds = new Set(requirements.map(r => String(r.id).toLowerCase()));

    requirements.forEach(req => {
        reqCoverageMap.set(req.id, {
            requirement: req,
            cases: [],
            categories: new Set()
        });
    });

    // Outdated tests check: cases linked to non-existent requirement IDs
    const outdatedCases = [];
    existingCases.forEach(tc => {
        const reqId = tc.requirementId ? String(tc.requirementId).toLowerCase() : '';
        if (reqId && !validReqIds.has(reqId)) {
            outdatedCases.push(tc);
        } else if (tc.isDeprecated) {
            outdatedCases.push(tc);
        }

        // Map test case to requirement if exists
        for (const [rid, entry] of reqCoverageMap.entries()) {
            if (String(rid).toLowerCase() === reqId) {
                entry.cases.push(tc);
                entry.categories.add((tc.category || '').toLowerCase());
            }
        }
    });

    if (outdatedCases.length > 0) {
        gaps.push({
            requirementId: 'GLOBAL',
            requirementTitle: 'Suite Test Inventory',
            severity: 'Medium',
            type: 'OUTDATED_TESTS',
            summary: `${outdatedCases.length} test case(s) link to removed or deprecated requirement references.`,
            suggestedCategories: ['Regression', 'Maintenance'],
            affectedTestCaseIds: outdatedCases.map(c => c.id)
        });
    }

    // Inspect each requirement
    reqCoverageMap.forEach(({ requirement, cases, categories }) => {
        const caseCount = cases.length;
        const textToAnalyze = `${requirement.title} ${requirement.description}`.toLowerCase();

        // 1. Specification defect detection (vague or under-specified requirement)
        if (!requirement.description || requirement.description.trim().length < 15 || /tbd|to be determined|etc\.?|as per discussion/i.test(requirement.description)) {
            gaps.push({
                requirementId: requirement.id,
                requirementTitle: requirement.title,
                severity: 'Low',
                type: 'SPECIFICATION_DEFECT',
                summary: `Requirement ${requirement.id} description is brief or contains ambiguous terms that may lead to untestable scenarios.`,
                suggestedCategories: ['Functional', 'Validation']
            });
        }

        // 2. Untested requirement (0 tests)
        if (caseCount === 0) {
            gaps.push({
                requirementId: requirement.id,
                requirementTitle: requirement.title,
                severity: 'High',
                type: 'UNTESTED_REQUIREMENT',
                summary: `Requirement ${requirement.id} has no linked test coverage in this suite.`,
                suggestedCategories: ['Positive', 'Negative', 'Boundary Value', 'Edge Case']
            });
            return;
        }

        // 3. Category gap detection
        const missing = [];

        // Negative scenarios
        if (!categories.has('negative') && !categories.has('negative validation') && !categories.has('error handling')) {
            missing.push('Negative testing');
            gaps.push({
                requirementId: requirement.id,
                requirementTitle: requirement.title,
                severity: 'High',
                type: 'MISSING_NEGATIVE',
                summary: `Requirement ${requirement.id} lacks negative validation and error handling scenarios.`,
                suggestedCategories: ['Negative', 'Error Handling']
            });
        }

        // Edge and boundary scenarios
        if (!categories.has('edge') && !categories.has('boundary') && !categories.has('boundary value') && !categories.has('edge case')) {
            missing.push('Boundary value / Edge cases');
            gaps.push({
                requirementId: requirement.id,
                requirementTitle: requirement.title,
                severity: 'Medium',
                type: 'MISSING_EDGE',
                summary: `Requirement ${requirement.id} lacks boundary and edge case validation.`,
                suggestedCategories: ['Boundary Value', 'Edge Case']
            });
        }

        // Security scenarios when relevant
        const isSecurityRelevant = /auth|login|password|token|jwt|session|permission|role|credit|card|payment|admin|credential|secret|encryption|pii|privacy/i.test(textToAnalyze);
        if (isSecurityRelevant && !categories.has('security')) {
            missing.push('Security testing');
            gaps.push({
                requirementId: requirement.id,
                requirementTitle: requirement.title,
                severity: 'Critical',
                type: 'MISSING_SECURITY',
                summary: `Requirement ${requirement.id} involves sensitive credentials, access control, or payments but lacks security tests.`,
                suggestedCategories: ['Security']
            });
        }

        // API scenarios when relevant
        const isApiRelevant = /api|endpoint|http|rest|graphql|webhook|json|payload|status code|headers|status 200|status 400|status 500/i.test(textToAnalyze);
        if (isApiRelevant && !categories.has('api') && !categories.has('apichecklist')) {
            missing.push('API contract testing');
            gaps.push({
                requirementId: requirement.id,
                requirementTitle: requirement.title,
                severity: 'Medium',
                type: 'MISSING_API',
                summary: `Requirement ${requirement.id} specifies API or endpoint interfaces but lacks API integration coverage.`,
                suggestedCategories: ['API']
            });
        }

        // Shallow coverage (single test)
        if (caseCount === 1) {
            gaps.push({
                requirementId: requirement.id,
                requirementTitle: requirement.title,
                severity: 'Medium',
                type: 'SHALLOW_COVERAGE',
                summary: `Requirement ${requirement.id} only has a single happy-path test case.`,
                suggestedCategories: ['Negative', 'Edge Case', 'Security']
            });
        }
    });

    const untestedCount = gaps.filter(g => g.type === 'UNTESTED_REQUIREMENT').length;
    const shallowCount = gaps.filter(g => g.type === 'SHALLOW_COVERAGE').length;

    return {
        totalRequirements: requirements.length,
        coveredRequirements: requirements.length - untestedCount,
        untestedRequirements: untestedCount,
        shallowCoverageCount: shallowCount,
        gaps
    };
};

/**
 * Generate Smart Test Recommendations
 */
const generateRecommendations = async ({
    suiteId,
    userId,
    workspaceId = null,
    projectId = null,
    requirementId = null,
    requestedCategories = null,
    focusArea = null,
    limit = 6
}) => {
    if (!suiteId) throw new Error('suiteId is required');
    if (!userId) throw new Error('userId is required');

    // 1. Retrieve test suite session
    const session = await supabaseService.getSession(suiteId, userId);
    if (!session) {
        const error = new Error('Test suite not found or access denied in your workspace.');
        error.statusCode = 404;
        throw error;
    }

    const suiteData = session.suiteData || session.suite_data || session.data || {};
    const suiteTitle = session.title || suiteData.testSuiteName || suiteData.feature || 'Test Suite';
    const suiteVersion = session.suiteVersion || session.suite_version || 1;

    // 2. Extract requirements and existing test cases
    let allRequirements = extractSuiteRequirements(session);
    const existingCases = extractSuiteTestCases(session);

    let targetRequirements = allRequirements;
    if (requirementId && requirementId !== 'all') {
        const matched = allRequirements.filter(r => r.id === requirementId);
        if (matched.length > 0) {
            targetRequirements = matched;
        }
    }

    if (targetRequirements.length === 0) {
        targetRequirements = [{
            id: 'REQ_CORE',
            title: suiteTitle,
            description: session.requirement || 'Standard functional requirements for this test suite.',
            category: 'Functional'
        }];
    }

    // 3. Compute current coverage gaps
    const gapAnalysis = analyzeCoverageGaps(targetRequirements, existingCases);

    // Save coverage analysis record
    const analysisId = `cov_an_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`;
    await supabaseService.saveCoverageAnalysis({
        id: analysisId,
        workspaceId,
        suiteId,
        suiteVersion,
        totalRequirements: gapAnalysis.totalRequirements,
        untestedRequirements: gapAnalysis.untestedRequirements,
        shallowCoverageCount: gapAnalysis.shallowCoverageCount,
        gaps: gapAnalysis.gaps,
        summary: {
            coveredRequirements: gapAnalysis.coveredRequirements,
            totalGapsCount: gapAnalysis.gaps.length
        },
        userId
    });

    // 4. Retrieve existing recommendations history to avoid duplicate re-generation
    const existingRecs = await supabaseService.getRecommendationsBySuite(suiteId, userId);
    const existingAddedRecTitles = new Set(
        existingRecs.filter(r => r.status === 'ADDED' || r.status === 'converted')
            .map(r => (r.title || '').trim().toLowerCase())
    );

    // 5. Prepare sanitized context for AI prompt
    const reqPromptList = targetRequirements.slice(0, 8).map(r =>
        `[${r.id}] ${sanitizeUntrustedInput(r.title)}: ${sanitizeUntrustedInput(r.description)}`
    ).join('\n');

    const existingCasesPrompt = existingCases.slice(0, 25).map(c =>
        `- ${c.id}: "${sanitizeUntrustedInput(c.title)}" [Type: ${c.category}, Priority: ${c.priority}, Req: ${c.requirementId}]`
    ).join('\n');

    const categoriesConstraint = Array.isArray(requestedCategories) && requestedCategories.length > 0
        ? `Focus primarily on these categories: ${requestedCategories.join(', ')}.`
        : 'Select diverse categories from: Positive, Negative, Boundary Value, Validation, Edge Case, Error Handling, Security, Regression, Accessibility, API.';

    const focusConstraint = focusArea
        ? `Special focus area requested by QA Engineer: "${sanitizeUntrustedInput(focusArea)}".`
        : '';

    const systemPrompt = `You are a Senior Principal QA Architect, SDET, and Quality Intelligence specialist.
Your mission is to perform rigorous gap analysis and generate smart, non-redundant, high-value test scenario recommendations.

STRICT PRINCIPLES:
1. Ground every recommendation firmly in the stated requirements. Do NOT invent arbitrary application features.
2. Every recommendation MUST reference a valid requirement ID from the provided <REQUIREMENTS> block.
3. Compare against EXISTING TEST CASES. Never propose a scenario that is already covered or near-identical to an existing test.
4. Clearly explain the defect risk or vulnerability that each recommended scenario catches.
5. Provide actionable step-by-step instructions with clear preconditions and unambiguous expected results.
6. Never invent source references; reference only legitimate requirements from the provided list.
7. Output MUST BE STRICT VALID JSON ONLY. No markdown conversational chatter.

JSON SCHEMA:
{
  "analysisSummary": {
    "requirementsAnalyzed": number,
    "existingTestCasesReviewed": number,
    "potentialCoverageGapsIdentified": number,
    "keyObservations": "concise explanation of QA risks observed in the current test inventory"
  },
  "recommendations": [
    {
      "title": "Clear and concise scenario title",
      "description": "Short summary of the test scenario",
      "category": "Positive" | "Negative" | "Boundary Value" | "Validation" | "Edge Case" | "Error Handling" | "Security" | "Regression" | "Accessibility" | "API",
      "priority": "Critical" | "High" | "Medium" | "Low",
      "requirementId": "REQ_001",
      "reason": "Why this specific test is needed and what potential failure or regression it prevents",
      "whyThisTest": "Explicit explanation of why this scenario matters and the defect risk it catches",
      "preconditions": "Clear preconditions required before executing this test",
      "steps": ["Step 1...", "Step 2...", "Step 3..."],
      "expectedResult": "Unambiguous pass/fail verification criteria",
      "sourceReferences": ["REQ_001"],
      "testData": "Realistic concrete test data values needed",
      "assumptions": "Any necessary contextual assumption or 'None'"
    }
  ]
}`;

    const prompt = `Analyze the requirements and existing test cases below to identify missing coverage gaps and recommend up to ${Math.min(limit, 8)} high-value test scenarios.

<REQUIREMENTS>
${reqPromptList}
</REQUIREMENTS>

<EXISTING_TEST_CASES (Reviewed: ${existingCases.length} tests)>
${existingCasesPrompt || 'None. This suite has no existing test cases yet.'}
</EXISTING_TEST_CASES>

<COVERAGE_GAPS_IDENTIFIED>
Untested requirements: ${gapAnalysis.untestedRequirements}
Shallow coverage requirements: ${gapAnalysis.shallowCoverageCount}
Specific gaps:
${gapAnalysis.gaps.slice(0, 6).map(g => `- [${g.requirementId}] ${g.type}: ${g.summary}`).join('\n') || 'None explicitly flagged.'}
</COVERAGE_GAPS_IDENTIFIED>

<GUIDANCE>
${categoriesConstraint}
${focusConstraint}
Generate between 3 and ${Math.min(limit, 8)} distinct, high-impact test recommendations.
</GUIDANCE>`;

    logger.info(`Generating smart test recommendations for suite ${suiteId} (requirements: ${targetRequirements.length}, existing tests: ${existingCases.length})`);

    // 6. Call AI Service
    let rawResponse;
    try {
        rawResponse = await aiService.callAI(prompt, {
            systemPrompt,
            temperature: 0.2,
            maxTokens: 4096,
            responseMimeType: 'application/json'
        });
    } catch (aiErr) {
        logger.error('Smart Recommendations AI call failed', { error: aiErr.message });
        const error = new Error(`AI recommendation engine failed: ${aiErr.message}`);
        error.statusCode = aiErr.statusCode || 502;
        throw error;
    }

    // 7. Parse and validate JSON
    let parsed;
    try {
        let cleanJson = (rawResponse || '').trim();
        if (cleanJson.startsWith('```json')) cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/```$/, '').trim();
        else if (cleanJson.startsWith('```')) cleanJson = cleanJson.replace(/^```\s*/, '').replace(/```$/, '').trim();
        parsed = JSON.parse(cleanJson);
    } catch (parseErr) {
        logger.warn('Failed to parse AI recommendations JSON, attempting heuristic extraction', { raw: rawResponse?.slice(0, 300) });
        const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                parsed = JSON.parse(jsonMatch[0]);
            } catch (inner) {
                const err = new Error('AI returned an invalid JSON response format for recommendations.');
                err.statusCode = 502;
                throw err;
            }
        } else {
            const err = new Error('AI returned an empty or unparseable response.');
            err.statusCode = 502;
            throw err;
        }
    }

    const rawRecommendations = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];
    const validTargetReqIds = new Set(targetRequirements.map(r => String(r.id).toLowerCase()));
    const now = new Date().toISOString();
    const sessionId = `recsess_${crypto.randomUUID()}`;
    const enrichedRecommendations = [];

    // 8. Duplicate Detection & Quality Validation
    rawRecommendations.forEach((rec) => {
        if (!rec.title || !rec.title.trim()) return;
        const cleanTitle = rec.title.trim();

        // Validate requirement reference
        let linkedReqId = rec.requirementId || rec.relatedRequirementId || targetRequirements[0]?.id || 'REQ_001';
        if (!validTargetReqIds.has(String(linkedReqId).toLowerCase())) {
            linkedReqId = targetRequirements[0]?.id || 'REQ_001';
        }
        const reqObj = targetRequirements.find(r => String(r.id).toLowerCase() === String(linkedReqId).toLowerCase()) || targetRequirements[0];

        // Multi-tier similarity check against existing test cases
        let highestSimilarity = 0;
        let mostSimilarCase = null;
        let overlapExplanation = null;

        for (const existing of existingCases) {
            const titleSim = calculateSimilarity(cleanTitle, existing.title);
            const stepSim = rec.steps && existing.steps
                ? calculateSimilarity(rec.steps.join(' '), existing.steps.join(' '))
                : 0;
            const combined = Math.max(titleSim, stepSim);
            if (combined > highestSimilarity) {
                highestSimilarity = combined;
                mostSimilarCase = existing;
            }
        }

        // Also check against already added recommendations
        if (existingAddedRecTitles.has(cleanTitle.toLowerCase())) {
            highestSimilarity = Math.max(highestSimilarity, 0.95);
        }

        // Multi-tier classification:
        // - exact duplicate: similarity >= 0.85
        // - similar scenario: 0.45 <= similarity < 0.85
        // - distinct scenario: similarity < 0.45
        let similarityStatus = 'distinct';
        let status = 'SUGGESTED';
        let isDuplicate = false;
        let coverageStatus = 'New Scenario Coverage';

        if (highestSimilarity >= 0.85) {
            similarityStatus = 'duplicate';
            status = 'DUPLICATE';
            isDuplicate = true;
            coverageStatus = 'Potential Duplicate';
            overlapExplanation = mostSimilarCase
                ? `Scenario matches existing test case ${mostSimilarCase.id} ("${mostSimilarCase.title}") with high overlap (${Math.round(highestSimilarity * 100)}%).`
                : 'Scenario closely duplicates a previously suggested recommendation.';
        } else if (highestSimilarity >= 0.45) {
            similarityStatus = 'similar';
            status = 'SUGGESTED';
            isDuplicate = false;
            coverageStatus = 'Strengthens Coverage';
            overlapExplanation = mostSimilarCase
                ? `Shares actions with test case ${mostSimilarCase.id} ("${mostSimilarCase.title}") but covers alternate conditions (${Math.round(highestSimilarity * 100)}% similarity).`
                : 'Similar to existing test case logic but exercises distinct parameters.';
        } else {
            similarityStatus = 'distinct';
            status = 'SUGGESTED';
            isDuplicate = false;
            coverageStatus = 'Closes Uncovered Gap';
            overlapExplanation = 'Distinct scenario closing an unaddressed coverage gap.';
        }

        const recId = `rec_${crypto.randomUUID()}`;
        const sourceRefs = Array.isArray(rec.sourceReferences) && rec.sourceReferences.length > 0
            ? rec.sourceReferences
            : [linkedReqId];

        const recObj = {
            id: recId,
            workspaceId: workspaceId || session.workspaceId || null,
            projectId: projectId || session.projectId || null,
            suiteId,
            analysisId,
            requirementId: linkedReqId,
            title: cleanTitle,
            description: rec.description || rec.coverageGapAddressed || `Recommended test scenario for requirement ${linkedReqId}`,
            category: rec.category || 'Functional',
            priority: ['Critical', 'High', 'Medium', 'Low'].includes(rec.priority) ? rec.priority : 'Medium',
            reason: rec.reason || rec.recommendationReason || 'Extends test coverage to verify critical system behavior.',
            whyThisTest: rec.whyThisTest || rec.coverageGapAddressed || 'Addresses potential failure scenarios not currently guarded.',
            preconditions: rec.preconditions || 'System is configured and target user account is active.',
            steps: Array.isArray(rec.steps) ? rec.steps : [String(rec.steps || 'Execute scenario')],
            expectedResult: rec.expectedResult || 'System behaves as expected with correct verification criteria.',
            sourceReferences: sourceRefs,
            similarTestCaseIds: mostSimilarCase ? [mostSimilarCase.id] : [],
            similarityStatus,
            status,
            createdBy: userId,
            updatedBy: userId,
            userId,
            resultingTestCaseId: null,
            suiteVersion,
            createdAt: now,
            updatedAt: now,

            // Legacy backward-compatibility properties
            sessionId,
            relatedRequirementId: linkedReqId,
            relatedRequirementTitle: reqObj ? reqObj.title : suiteTitle,
            recommendationReason: rec.reason || rec.recommendationReason || 'Extends test coverage.',
            coverageGapAddressed: rec.whyThisTest || rec.coverageGapAddressed || 'Addresses missing test coverage.',
            testData: rec.testData || 'Standard test dataset',
            assumptions: rec.assumptions && rec.assumptions !== 'None' ? rec.assumptions : null,
            similarityScore: Math.round(highestSimilarity * 100),
            mostSimilarCaseId: mostSimilarCase ? mostSimilarCase.id : null,
            overlapExplanation,
            isDuplicate,
            coverageStatus,
            convertedTestCaseId: null
        };

        enrichedRecommendations.push(recObj);
    });

    const analysisSummary = {
        requirementsAnalyzed: targetRequirements.length,
        existingTestCasesReviewed: existingCases.length,
        potentialCoverageGapsIdentified: gapAnalysis.gaps.length,
        recommendationsGenerated: enrichedRecommendations.length,
        untestedRequirementsCount: gapAnalysis.untestedRequirements,
        shallowCoverageCount: gapAnalysis.shallowCoverageCount,
        keyObservations: parsed.analysisSummary?.keyObservations ||
            `Reviewed ${existingCases.length} existing test cases across ${targetRequirements.length} requirements. Identified ${gapAnalysis.gaps.length} coverage gaps.`
    };

    const recommendationSession = {
        id: sessionId,
        suiteId,
        userId,
        suiteTitle,
        requirementId: requirementId || 'all',
        analysisSummary,
        recommendations: enrichedRecommendations,
        createdAt: now,
        updatedAt: now
    };

    // 9. Persist recommendations and session
    await supabaseService.saveRecommendationSession(recommendationSession);
    await supabaseService.saveRecommendations(enrichedRecommendations);

    return {
        session: recommendationSession,
        summary: analysisSummary,
        recommendations: enrichedRecommendations
    };
};

/**
 * Update recommendation status or edited fields
 */
const updateRecommendationStatus = async (recommendationId, userId, { status, editedFields } = {}) => {
    if (!recommendationId) throw new Error('recommendationId is required');
    if (!userId) throw new Error('userId is required');

    const updated = await supabaseService.updateRecommendation(recommendationId, userId, {
        status,
        editedFields
    });

    if (updated && status) {
        await supabaseService.recordRecommendationAction(recommendationId, status.toLowerCase(), userId, {
            previousStatus: updated.status,
            newStatus: status
        });
    }

    return updated;
};

/**
 * Convert accepted recommendations into DRAFT test cases in the test suite
 * Strict safety: AI recommendations are ALWAYS saved as 'Draft' status for QA review.
 */
const convertRecommendationsToDraftCases = async ({ suiteId, userId, recommendationIds }) => {
    if (!suiteId) throw new Error('suiteId is required');
    if (!userId) throw new Error('userId is required');
    if (!Array.isArray(recommendationIds) || recommendationIds.length === 0) {
        throw new Error('At least one recommendation ID must be provided for conversion.');
    }

    // 1. Retrieve session/suite
    const session = await supabaseService.getSession(suiteId, userId);
    if (!session) {
        const error = new Error('Test suite not found or access denied in your workspace.');
        error.statusCode = 404;
        throw error;
    }

    // Role check: viewers cannot add test cases
    const accessRole = session.accessRole || 'owner';
    if (accessRole === 'viewer') {
        const error = new Error('Viewer role does not have permission to add test cases to this suite.');
        error.statusCode = 403;
        throw error;
    }

    const suiteData = structuredClone(session.suiteData || session.suite_data || session.data || {});
    if (!suiteData.testCases) suiteData.testCases = [];

    // Collect all existing IDs and titles to prevent any collisions or duplicates
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
        'api': 'API'
    };

    const convertedTestCases = [];
    const conversionResults = [];

    for (const recId of recommendationIds) {
        const rec = await supabaseService.getRecommendation(recId, userId);
        if (!rec) {
            conversionResults.push({ id: recId, success: false, reason: 'Recommendation not found' });
            continue;
        }

        // Idempotency check: if already converted/added
        if ((rec.status === 'ADDED' || rec.status === 'converted') && (rec.resultingTestCaseId || rec.convertedTestCaseId)) {
            const existingCaseId = rec.resultingTestCaseId || rec.convertedTestCaseId;
            conversionResults.push({
                id: recId,
                success: false,
                reason: `Already converted to test case ${existingCaseId}`
            });
            continue;
        }

        const rawTitle = (rec.title || '').trim();
        if (existingTitles.has(rawTitle.toLowerCase())) {
            conversionResults.push({
                id: recId,
                success: false,
                reason: 'Duplicate of existing test case in this suite'
            });
            continue;
        }

        // Generate unique test case ID
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

        // Strict 13-field standard schema
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
            status: 'Draft', // NEVER automatically approved or passed! QA review required.
            requirementId: rec.requirementId || rec.relatedRequirementId || 'REQ_001',
            _source: 'smart_recommendation',
            _recommendationId: rec.id,
            _createdFromRecommendationAt: new Date().toISOString()
        };

        // Determine destination array in suiteData
        let destinationCategory = 'functional';
        if (normalizedCat.includes('neg') || normalizedCat.includes('error')) destinationCategory = 'negative';
        else if (normalizedCat.includes('edge') || normalizedCat.includes('boundary')) destinationCategory = 'edge';
        else if (normalizedCat.includes('sec')) destinationCategory = 'security';
        else if (normalizedCat.includes('access')) destinationCategory = 'nonFunctional';
        else if (normalizedCat.includes('api')) destinationCategory = 'apiChecklist';

        if (Array.isArray(suiteData[destinationCategory])) {
            suiteData[destinationCategory].push(newCase);
        } else {
            suiteData.testCases.push(newCase);
        }

        convertedTestCases.push(newCase);

        // Update recommendation status to ADDED
        await supabaseService.updateRecommendation(rec.id, userId, {
            status: 'ADDED',
            resultingTestCaseId: testCaseId,
            convertedTestCaseId: testCaseId
        });

        // Record action in audit trail
        await supabaseService.recordRecommendationAction(rec.id, 'added', userId, {
            suiteId,
            testCaseId,
            title: newCase.title
        });

        conversionResults.push({
            id: rec.id,
            success: true,
            testCaseId,
            title: newCase.title
        });
    }

    if (convertedTestCases.length > 0) {
        // Recompute suite summary counts
        const summary = session.summary || {};
        let total = 0;
        SUITE_CASE_CATEGORIES.forEach(arr => {
            const len = Array.isArray(suiteData[arr]) ? suiteData[arr].length : 0;
            summary[arr] = len;
            total += len;
        });
        summary.total = total;

        // Persist updated suite in database
        await supabaseService.updateSession(suiteId, userId, {
            suiteData,
            summary
        });
    }

    logger.info(`Converted ${convertedTestCases.length} recommendations to draft test cases for suite ${suiteId}`);

    return {
        suiteId,
        convertedCount: convertedTestCases.length,
        results: conversionResults,
        draftCases: convertedTestCases
    };
};

module.exports = {
    generateRecommendations,
    updateRecommendationStatus,
    convertRecommendationsToDraftCases,
    calculateSimilarity,
    analyzeCoverageGaps,
    extractSuiteRequirements,
    extractSuiteTestCases
};
