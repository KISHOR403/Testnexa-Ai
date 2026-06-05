/**
 * Coverage Analytics Engine
 * Computes real, measurable coverage metrics from generated test case data.
 * Every number shown to the user is derived from actual test data — no cosmetic fallbacks.
 */

/**
 * Gather all test cases from the result object into a flat array.
 * @param {Object} result - The normalized test suite result
 * @returns {Array} All test case objects with their source category attached
 */
export function getAllTestCases(result) {
    if (!result) return [];
    const categories = [
        { key: 'functional', label: 'Functional' },
        { key: 'negative', label: 'Negative' },
        { key: 'edge', label: 'Edge' },
        { key: 'apiChecklist', label: 'API' },
        { key: 'api', label: 'API' },
        { key: 'nonFunctional', label: 'Non-Functional' },
    ];

    const seen = new Set();
    const all = [];

    for (const cat of categories) {
        const arr = result[cat.key];
        if (!Array.isArray(arr)) continue;
        for (const tc of arr) {
            if (!tc || seen.has(tc.id)) continue;
            seen.add(tc.id);
            all.push({ ...tc, _category: cat.label });
        }
    }
    return all;
}

/**
 * Compute requirement traceability — what % of test cases are linked to a requirement ID.
 * A "real" REQ ID means it's not just a placeholder like "REQ_001" auto-generated from index.
 */
export function computeRequirementTraceability(result) {
    const all = getAllTestCases(result);
    if (all.length === 0) return { traced: 0, total: 0, percentage: 0, untracedIds: [] };

    const traced = all.filter(tc => {
        const rid = (tc.requirementId || '').trim();
        // Count as traced if it has a non-empty requirement ID
        return rid.length > 0 && rid !== 'N/A' && rid !== 'None';
    });

    const untraced = all.filter(tc => {
        const rid = (tc.requirementId || '').trim();
        return !rid || rid === 'N/A' || rid === 'None';
    });

    return {
        traced: traced.length,
        total: all.length,
        percentage: Math.round((traced.length / all.length) * 100),
        untracedIds: untraced.map(tc => tc.id),
        uniqueRequirements: [...new Set(traced.map(tc => tc.requirementId))],
    };
}

/**
 * Compute test case distribution per module.
 * Groups all test cases by their `module` field and counts by type.
 */
export function computeModuleDistribution(result) {
    const all = getAllTestCases(result);
    if (all.length === 0) return [];

    const moduleMap = {};

    for (const tc of all) {
        const mod = tc.module || 'Uncategorized';
        if (!moduleMap[mod]) {
            moduleMap[mod] = {
                module: mod,
                total: 0,
                functional: 0,
                negative: 0,
                edge: 0,
                api: 0,
                nonFunctional: 0,
                highPriority: 0,
                mediumPriority: 0,
                lowPriority: 0,
            };
        }
        moduleMap[mod].total++;

        // Count by category
        const cat = (tc._category || tc.type || 'Functional').toLowerCase();
        if (cat.includes('functional') && !cat.includes('non')) moduleMap[mod].functional++;
        else if (cat.includes('negative')) moduleMap[mod].negative++;
        else if (cat.includes('edge')) moduleMap[mod].edge++;
        else if (cat.includes('api')) moduleMap[mod].api++;
        else if (cat.includes('non')) moduleMap[mod].nonFunctional++;

        // Count by priority
        const pri = (tc.priority || 'Medium').toLowerCase();
        if (pri === 'high') moduleMap[mod].highPriority++;
        else if (pri === 'medium') moduleMap[mod].mediumPriority++;
        else moduleMap[mod].lowPriority++;
    }

    return Object.values(moduleMap).sort((a, b) => b.total - a.total);
}

/**
 * Compute functional vs regression test ratio.
 * Functional = positive path tests. Regression = negative + edge case tests.
 */
export function computeTypeRatios(result) {
    const all = getAllTestCases(result);
    if (all.length === 0) {
        return { functional: 0, regression: 0, api: 0, nonFunctional: 0, total: 0, ratioLabel: 'N/A' };
    }

    let functional = 0, regression = 0, api = 0, nonFunctional = 0;

    for (const tc of all) {
        const cat = (tc._category || tc.type || 'Functional').toLowerCase();
        if (cat.includes('functional') && !cat.includes('non')) functional++;
        else if (cat.includes('negative') || cat.includes('edge')) regression++;
        else if (cat.includes('api')) api++;
        else if (cat.includes('non')) nonFunctional++;
    }

    const ratio = regression > 0 ? (functional / regression).toFixed(1) : '∞';

    return {
        functional,
        regression,
        api,
        nonFunctional,
        total: all.length,
        ratioLabel: `${ratio}:1`,
        segments: [
            { label: 'Functional', value: functional, color: '#00d4c1' },
            { label: 'Regression', value: regression, color: '#f59e0b' },
            { label: 'API', value: api, color: '#60a5fa' },
            { label: 'Non-Functional', value: nonFunctional, color: '#a78bfa' },
        ].filter(s => s.value > 0),
    };
}

/**
 * Compute risk coverage heatmap data.
 * Matrix: rows = modules, columns = priority levels.
 * Each cell = number of test cases covering that module at that priority.
 */
export function computeRiskHeatmap(result) {
    const modules = computeModuleDistribution(result);
    if (modules.length === 0) return { modules: [], maxCount: 0 };

    let maxCount = 0;
    const heatmapModules = modules.map(mod => {
        const cells = {
            high: mod.highPriority,
            medium: mod.mediumPriority,
            low: mod.lowPriority,
        };
        maxCount = Math.max(maxCount, cells.high, cells.medium, cells.low);

        // Compute risk level for this module
        let riskLevel = 'covered';
        if (mod.highPriority === 0 && mod.total > 0) riskLevel = 'at-risk';
        if (mod.total <= 1) riskLevel = 'under-tested';
        if (mod.highPriority > 0 && mod.negative === 0 && mod.edge === 0) riskLevel = 'partial';

        return {
            module: mod.module,
            ...cells,
            total: mod.total,
            riskLevel,
        };
    });

    return { modules: heatmapModules, maxCount };
}

/**
 * Compute an overall health score from real factors.
 * Unlike the cosmetic "85%", this is tied to measurable inputs.
 */
export function computeOverallHealth(result) {
    const traceability = computeRequirementTraceability(result);
    const modules = computeModuleDistribution(result);
    const typeRatios = computeTypeRatios(result);

    const factors = [];

    // Factor 1: Requirement traceability (weight: 25%)
    factors.push({
        name: 'Requirement Traceability',
        score: traceability.percentage,
        weight: 0.25,
        detail: `${traceability.traced}/${traceability.total} test cases linked to requirements`,
    });

    // Factor 2: Type diversity — do we have coverage across all types? (weight: 25%)
    const typesPresent = [
        typeRatios.functional > 0,
        typeRatios.regression > 0,
        typeRatios.api > 0,
        typeRatios.nonFunctional > 0,
    ].filter(Boolean).length;
    const diversityScore = Math.round((typesPresent / 4) * 100);
    factors.push({
        name: 'Test Type Diversity',
        score: diversityScore,
        weight: 0.25,
        detail: `${typesPresent}/4 test categories represented`,
    });

    // Factor 3: Priority balance — are we testing high-risk areas? (weight: 25%)
    const all = getAllTestCases(result);
    const highCount = all.filter(tc => (tc.priority || '').toLowerCase() === 'high').length;
    const priorityScore = all.length > 0 ? Math.min(100, Math.round((highCount / all.length) * 100 * 2.5)) : 0;
    factors.push({
        name: 'Risk Prioritization',
        score: priorityScore,
        weight: 0.25,
        detail: `${highCount} high-priority tests out of ${all.length} total`,
    });

    // Factor 4: Module coverage depth — avg tests per module (weight: 25%)
    const avgPerModule = modules.length > 0 ? all.length / modules.length : 0;
    const depthScore = Math.min(100, Math.round(avgPerModule * 20)); // 5 tests/module = 100%
    factors.push({
        name: 'Module Coverage Depth',
        score: depthScore,
        weight: 0.25,
        detail: `${avgPerModule.toFixed(1)} tests per module (${modules.length} modules)`,
    });

    // Weighted total
    const totalScore = Math.round(
        factors.reduce((sum, f) => sum + f.score * f.weight, 0)
    );

    return {
        score: totalScore,
        level: totalScore >= 80 ? 'Strong' : totalScore >= 60 ? 'Moderate' : totalScore >= 40 ? 'Weak' : 'Critical',
        factors,
    };
}
