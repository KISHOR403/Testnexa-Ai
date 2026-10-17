/**
 * Confidence Scoring Service
 * Calculates honest, conservative confidence metrics for test coverage
 */

class ConfidenceScorer {
    /**
     * Calculate overall coverage confidence
     * @param {Object} testCases - Generated test cases
     * @param {Object} understanding - Requirement understanding
     * @param {number} ambiguityScore - Ambiguity score (0-1)
     * @returns {Object} Confidence analysis
     */
    calculateCoverageConfidence(testCases, understanding, ambiguityScore) {
        const factors = {
            requirement_clarity: this.scoreRequirementClarity(understanding, ambiguityScore),
            rule_coverage: this.scoreRuleCoverage(testCases, understanding),
            risk_coverage: this.scoreRiskCoverage(testCases, understanding),
            test_quality: this.scoreTestQuality(testCases),
            assumption_risk: this.scoreAssumptionRisk(testCases)
        };

        // Weighted average (conservative)
        const weights = {
            requirement_clarity: 0.30,
            rule_coverage: 0.25,
            risk_coverage: 0.20,
            test_quality: 0.15,
            assumption_risk: 0.10
        };

        let totalScore = 0;
        Object.keys(factors).forEach(key => {
            totalScore += factors[key] * weights[key];
        });

        // Convert to percentage
        const confidencePercentage = Math.round(totalScore * 100);

        return {
            overall_confidence: confidencePercentage,
            confidence_score: totalScore,
            breakdown: factors,
            confidence_level: this.getConfidenceLevel(totalScore),
            recommendations: this.getRecommendations(totalScore, factors),
            breakdown_by_type: this.calculateBreakdownByType(testCases, understanding)
        };
    }

    /**
     * Score requirement clarity
     * @param {Object} understanding - Understanding
     * @param {number} ambiguityScore - Ambiguity score
     * @returns {number} Clarity score (0-1)
     */
    scoreRequirementClarity(understanding, ambiguityScore) {
        // High ambiguity = low confidence
        const clarityScore = 1 - ambiguityScore;

        // Penalize missing information
        const missingInfo = understanding.missing_information || [];
        const missingPenalty = Math.min(0.3, missingInfo.length * 0.05);

        return Math.max(0, clarityScore - missingPenalty);
    }

    /**
     * Score business rule coverage
     * @param {Object} testCases - Test cases
     * @param {Object} understanding - Understanding
     * @returns {number} Coverage score (0-1)
     */
    scoreRuleCoverage(testCases, understanding) {
        const businessRules = understanding.business_rules || understanding.rules || [];
        if (businessRules.length === 0) return 0.5; // Neutral if no rules

        const allTests = this.getAllTestCases(testCases);
        const coveredRules = new Set();

        allTests.forEach(tc => {
            if (tc.covers_rule) {
                coveredRules.add(tc.covers_rule);
            }

            // Also check if test description mentions the rule
            const testText = JSON.stringify(tc).toLowerCase();
            businessRules.forEach(rule => {
                const ruleWords = rule.toLowerCase().split(/\s+/).filter(w => w.length > 4);
                const matchCount = ruleWords.filter(word => testText.includes(word)).length;
                if (matchCount >= ruleWords.length * 0.6) {
                    coveredRules.add(rule);
                }
            });
        });

        return coveredRules.size / businessRules.length;
    }

    /**
     * Score risk area coverage
     * @param {Object} testCases - Test cases
     * @param {Object} understanding - Understanding
     * @returns {number} Coverage score (0-1)
     */
    scoreRiskCoverage(testCases, understanding) {
        const riskAreas = understanding.risk_areas || [];
        if (riskAreas.length === 0) return 0.7; // Neutral-positive if no risks identified

        const allTests = this.getAllTestCases(testCases);
        const coveredRisks = new Set();

        allTests.forEach(tc => {
            const tags = tc.tags || [];
            const testText = JSON.stringify(tc).toLowerCase();

            riskAreas.forEach(risk => {
                if (tags.includes(risk) || testText.includes(risk.replace('_', ' '))) {
                    coveredRisks.add(risk);
                }
            });
        });

        return coveredRisks.size / riskAreas.length;
    }

    /**
     * Score test case quality
     * @param {Object} testCases - Test cases
     * @returns {number} Quality score (0-1)
     */
    scoreTestQuality(testCases) {
        const tests = this.getAllTestCases(testCases);
        if (tests.length === 0) return 0;

        let qualityScore = 0;

        // Check for well-defined steps
        const testsWithSteps = tests.filter(t =>
            (t.steps && t.steps.length > 0) || (t.checkpoints && t.checkpoints.length > 0)
        ).length;
        qualityScore += (testsWithSteps / tests.length) * 0.3;

        // Check for clear expected results
        const testsWithExpected = tests.filter(t =>
            (t.expectedResult && t.expectedResult.length > 10) ||
            (t.expectedOutcome && t.expectedOutcome.length > 10)
        ).length;
        qualityScore += (testsWithExpected / tests.length) * 0.3;

        // Check for priority assignment
        const testsWithPriority = tests.filter(t => t.priority).length;
        qualityScore += (testsWithPriority / tests.length) * 0.2;

        // Check for rationale/reason
        const testsWithReason = tests.filter(t => t.reason).length;
        qualityScore += (testsWithReason / tests.length) * 0.2;

        return qualityScore;
    }

    /**
     * Score assumption risk
     * @param {Object} testCases - Test cases
     * @returns {number} Risk score (0-1, higher is better)
     */
    scoreAssumptionRisk(testCases) {
        const assumptions = testCases.assumptions || [];
        if (assumptions.length === 0) return 1.0; // Perfect if no assumptions

        // More assumptions = lower confidence
        const assumptionPenalty = Math.min(0.5, assumptions.length * 0.05);

        // High-risk assumptions penalize more
        const highRiskCount = assumptions.filter(a =>
            (typeof a === 'object' && a.confidence === 'high') ||
            (typeof a === 'string' && this.isHighRiskAssumption(a))
        ).length;
        const highRiskPenalty = highRiskCount * 0.03;

        return Math.max(0.3, 1.0 - assumptionPenalty - highRiskPenalty);
    }

    isHighRiskAssumption(assumption) {
        const highRiskKeywords = ['security', 'payment', 'financial', 'compliance'];
        const assumptionLower = assumption.toLowerCase();
        return highRiskKeywords.some(kw => assumptionLower.includes(kw));
    }

    /**
     * Get confidence level label
     * @param {number} score - Confidence score (0-1)
     * @returns {string} Level label
     */
    getConfidenceLevel(score) {
        if (score >= 0.8) return 'High';
        if (score >= 0.6) return 'Medium';
        if (score >= 0.4) return 'Low';
        return 'Very Low';
    }

    /**
     * Get recommendations based on confidence factors
     * @param {number} score - Overall score
     * @param {Object} factors - Individual factors
     * @returns {Array} Recommendations
     */
    getRecommendations(score, factors) {
        const recommendations = [];

        if (factors.requirement_clarity < 0.6) {
            recommendations.push('Clarify requirements to improve test accuracy');
        }

        if (factors.rule_coverage < 0.7) {
            recommendations.push('Some business rules may not be fully covered');
        }

        if (factors.risk_coverage < 0.7) {
            recommendations.push('Consider adding tests for identified risk areas');
        }

        if (factors.test_quality < 0.6) {
            recommendations.push('Test cases could benefit from more detailed steps and expected results');
        }

        if (factors.assumption_risk < 0.7) {
            recommendations.push('Multiple assumptions made - consider clarifying requirements');
        }

        if (recommendations.length === 0) {
            recommendations.push('Test suite has good coverage and quality');
        }

        return recommendations;
    }

    /**
     * Calculate confidence breakdown by test type
     * @param {Object} testCases - Test cases
     * @param {Object} understanding - Understanding
     * @returns {Object} Breakdown
     */
    calculateBreakdownByType(testCases, understanding) {
        const breakdown = {
            functional: { count: 0, confidence: 0 },
            negative: { count: 0, confidence: 0 },
            edge: { count: 0, confidence: 0 },
            non_functional: { count: 0, confidence: 0 },
            api: { count: 0, confidence: 0 }
        };

        // Count tests by category
        if (testCases.functional) breakdown.functional.count = testCases.functional.length;
        if (testCases.negative) breakdown.negative.count = testCases.negative.length;
        if (testCases.edge) breakdown.edge.count = testCases.edge.length;
        if (testCases.nonFunctional) breakdown.non_functional.count = testCases.nonFunctional.length;
        if (testCases.apiChecklist) breakdown.api.count = testCases.apiChecklist.length;

        // Calculate confidence per type based on quality
        Object.keys(breakdown).forEach(type => {
            const categoryTests = testCases[type === 'non_functional' ? 'nonFunctional' : type === 'api' ? 'apiChecklist' : type];
            if (categoryTests && categoryTests.length > 0) {
                breakdown[type].confidence = Math.round(
                    this.scoreTestQuality({ [type]: categoryTests }) * 100
                );
            }
        });

        return breakdown;
    }

    /**
     * Get all test cases from response
     * @param {Object} testCases - Test cases object
     * @returns {Array} All test cases
     */
    getAllTestCases(testCases) {
        const all = [];
        ['functional', 'negative', 'edge', 'security', 'nonFunctional', 'apiChecklist'].forEach(category => {
            if (testCases[category] && Array.isArray(testCases[category])) {
                all.push(...testCases[category]);
            }
        });
        return all;
    }

    /**
     * Adjust confidence based on ambiguity
     * @param {Object} testCases - Test cases
     * @param {number} ambiguityScore - Ambiguity score (0-1)
     * @returns {Object} Adjusted test cases
     */
    adjustConfidenceByAmbiguity(testCases, ambiguityScore) {
        const baseConfidence = testCases.confidence_score || 0.8;

        // High ambiguity reduces confidence
        const adjustedConfidence = baseConfidence * (1 - (ambiguityScore * 0.5));

        // Adjust individual test priorities if ambiguity is high
        const categories = ['functional', 'negative', 'edge', 'security', 'nonFunctional', 'apiChecklist'];

        categories.forEach(category => {
            if (testCases[category] && Array.isArray(testCases[category])) {
                testCases[category] = testCases[category].map(tc => {
                    let priority = tc.priority;

                    // Downgrade priority if ambiguity is high and test is not critical
                    if (ambiguityScore > 0.6 && priority === 'High' && !tc.is_security_critical) {
                        priority = 'Medium';
                        tc.priority_note = 'Downgraded due to requirement ambiguity';
                    }

                    return {
                        ...tc,
                        priority,
                        confidence: Math.round(adjustedConfidence * 100),
                        requires_clarification: ambiguityScore > 0.7
                    };
                });
            }
        });

        return {
            ...testCases,
            confidence_score: adjustedConfidence,
            ambiguity_score: ambiguityScore,
            recommendation: ambiguityScore > 0.7
                ? 'High ambiguity detected. Consider clarifying requirements before proceeding.'
                : 'Requirement clarity is acceptable.'
        };
    }
}

module.exports = new ConfidenceScorer();
