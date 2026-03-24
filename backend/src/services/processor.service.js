// Post-Processing Service for Test Cases

// Generate unique test case IDs
const generateTestCaseId = (category, index) => {
    const prefixes = {
        functional: 'TC_FUNC',
        negative: 'TC_NEG',
        edge: 'TC_EDGE',
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

// Normalize test case structure
const normalizeTestCase = (testCase, category, index, feature) => {
    return {
        id: generateTestCaseId(category, index),
        title: testCase.title || 'Untitled Test Case',
        priority: assignPriority(testCase, feature),
        steps: testCase.steps || [],
        expected: testCase.expected || '',
        testData: testCase.testData || {},
        reason: testCase.reason || 'Generated based on inferred rule from requirement.',
        riskType: testCase.riskType || (category === 'negative' ? 'Security' : 'UX'),
        priorityExplanation: testCase.priorityExplanation || (testCase.priority === 'High' ? 'Critical business path validation.' : null),
        intentGroup: testCase.intentGroup || 'General Coverage',
        category: testCase.category || category,
    };
};

// Process all test cases
const processTestCases = (rawTestCases, feature) => {
    const categories = ['functional', 'negative', 'edge', 'apiChecklist', 'nonFunctional'];
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
        api: processedTestCases.apiChecklist.length,
        nonFunctional: processedTestCases.nonFunctional.length,
        total:
            processedTestCases.functional.length +
            processedTestCases.negative.length +
            processedTestCases.edge.length +
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
