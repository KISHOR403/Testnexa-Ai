// Post-Processing Service for Test Cases

// Generate unique test case IDs
const generateTestCaseId = (category, index) => {
    const prefixes = {
        functional: 'TC_FUNC',
        negative: 'TC_NEG',
        edge: 'TC_EDGE',
        security: 'TC_SEC',
        api: 'TC_API',
        nonFunctional: 'TC_NF',
    };

    const prefix = prefixes[category] || 'TC';
    const paddedIndex = String(index + 1).padStart(3, '0');

    return `${prefix}_${paddedIndex}`;
};

// Assign priority based on risk
const assignPriority = (testCase, feature) => {
    if (testCase.priority) {
        return testCase.priority; // Keep AI-assigned priority
    }

    // Risk-based priority logic
    const highPriorityKeywords = [
        'login', 'auth', 'password', 'payment', 'security',
        'transaction', 'checkout', 'signup', 'register',
    ];

    const featureLower = feature.toLowerCase();
    const titleLower = testCase.title.toLowerCase();

    const isHighPriority = highPriorityKeywords.some(keyword =>
        featureLower.includes(keyword) || titleLower.includes(keyword)
    );

    return isHighPriority ? 'High' : 'Medium';
};

// Calculate text similarity (simple keyword overlap)
const calculateSimilarity = (text1, text2) => {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);

    const set1 = new Set(words1);
    const set2 = new Set(words2);

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
};

// Remove duplicate test cases
const removeDuplicates = (testCases) => {
    const SIMILARITY_THRESHOLD = 0.8;
    const uniqueTests = [];

    for (const testCase of testCases) {
        const isDuplicate = uniqueTests.some(existing => {
            const titleSimilarity = calculateSimilarity(existing.title, testCase.title);
            const stepsSimilarity = existing.steps && testCase.steps
                ? calculateSimilarity(existing.steps.join(' '), testCase.steps.join(' '))
                : 0;

            return titleSimilarity > SIMILARITY_THRESHOLD || stepsSimilarity > SIMILARITY_THRESHOLD;
        });

        if (!isDuplicate) {
            uniqueTests.push(testCase);
        }
    }

    return uniqueTests;
};

// Derive severity from priority when AI doesn't provide it
const deriveSeverity = (testCase) => {
    if (testCase.severity) return testCase.severity;
    const priority = (testCase.priority || 'Medium').toLowerCase();
    const severityMap = {
        high: 'Critical',
        medium: 'Major',
        low: 'Minor',
    };
    return severityMap[priority] || 'Major';
};

// Derive testScenario from module + type when AI doesn't provide it
const deriveTestScenario = (testCase, category, feature) => {
    if (testCase.testScenario) return testCase.testScenario;
    const module = testCase.module || feature || 'General';
    const typeMap = {
        functional: 'Functionality',
        negative: 'Negative Validation',
        edge: 'Boundary Testing',
        security: 'Security & Access Control',
        api: 'API Integration',
        apiChecklist: 'API Integration',
        nonFunctional: 'Non-Functional Quality',
    };
    return `${module} ${typeMap[category] || 'Testing'}`;
};

// Normalize test case structure to strict schema (13-field industry standard)
const normalizeTestCase = (testCase, category, index, feature) => {
    // Map category to type label
    const typeMap = {
        functional: 'Functional',
        negative: 'Negative',
        edge: 'Edge Case',
        security: 'Security',
        api: 'API',
        apiChecklist: 'API',
        nonFunctional: 'Non-Functional',
    };

    return {
        id: generateTestCaseId(category, index),
        testScenario: deriveTestScenario(testCase, category, feature),
        module: testCase.module || feature || 'General',
        title: testCase.title || 'Untitled Test Case',
        type: testCase.type || typeMap[category] || 'Functional',
        priority: assignPriority(testCase, feature),
        severity: deriveSeverity(testCase),
        preconditions: testCase.preconditions || '',
        testData: testCase.testData || 'N/A',
        steps: testCase.steps || [],
        expectedResult: testCase.expectedResult || testCase.expected || '',
        actualResult: 'Not yet executed',
        status: 'Not Executed',
        requirementId: testCase.requirementId || `REQ_${String(index + 1).padStart(3, '0')}`,
    };
};

// Process all test cases
const processTestCases = (rawTestCases, feature) => {
    const categories = ['functional', 'negative', 'edge', 'security', 'apiChecklist', 'nonFunctional'];
    const processed = {};

    for (const category of categories) {
        if (!rawTestCases[category] || !Array.isArray(rawTestCases[category])) {
            processed[category] = [];
            continue;
        }

        // Remove duplicates
        const unique = removeDuplicates(rawTestCases[category]);

        // Normalize structure
        processed[category] = unique.map((testCase, index) =>
            normalizeTestCase(testCase, category, index, feature)
        );
    }

    return processed;
};

// Generate summary
const generateSummary = (processedTestCases) => {
    return {
        functional: processedTestCases.functional.length,
        negative: processedTestCases.negative.length,
        edge: processedTestCases.edge.length,
        security: processedTestCases.security?.length || 0,
        api: processedTestCases.apiChecklist.length,
        nonFunctional: processedTestCases.nonFunctional.length,
        total:
            processedTestCases.functional.length +
            processedTestCases.negative.length +
            processedTestCases.edge.length +
            (processedTestCases.security?.length || 0) +
            processedTestCases.apiChecklist.length +
            processedTestCases.nonFunctional.length,
    };
};

module.exports = {
    processTestCases,
    generateSummary,
    removeDuplicates,
    normalizeTestCase,
};
