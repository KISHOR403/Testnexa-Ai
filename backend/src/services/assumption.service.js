/**
 * Assumption Validation Service
 * Enforces explicit assumption declaration and detects implicit assumptions
 */

class AssumptionValidator {
    constructor() {
        this.requiredFields = [
            'assumptions_made',
            'missing_information',
            'ambiguities'
        ];

        // Common implicit assumptions to detect
        this.implicitPatterns = [
            { field: 'retry_count', default: 3, keywords: ['retry', 'retries', 'attempt'] },
            { field: 'timeout', default: 30, keywords: ['timeout', 'wait', 'delay'] },
            { field: 'cvv_length', default: 3, keywords: ['cvv', 'security code'] },
            { field: 'max_file_size', default: '10MB', keywords: ['upload', 'file size'] },
            { field: 'session_timeout', default: 30, keywords: ['session', 'login', 'authentication'] },
            { field: 'password_length', default: 8, keywords: ['password', 'credential'] },
            { field: 'page_size', default: 10, keywords: ['pagination', 'page', 'list'] },
            { field: 'max_attempts', default: 3, keywords: ['login', 'authentication', 'attempt'] }
        ];
    }

    /**
     * Validate AI response for explicit assumptions
     * @param {Object} aiResponse - AI generated response
     * @param {Object} understanding - Requirement understanding
     * @returns {Object} Validated response with formatted assumptions
     */
    validate(aiResponse, understanding) {
        // Check if assumptions field exists
        if (!aiResponse.assumptions || aiResponse.assumptions.length === 0) {
            // Detect if there are truly no assumptions or if AI forgot to declare them
            const implicitAssumptions = this.detectImplicitAssumptions(aiResponse, understanding);

            if (implicitAssumptions.length > 0) {
                // AI made assumptions without declaring them
                aiResponse.assumptions = implicitAssumptions.map(a => a.description);
                aiResponse.assumption_warnings = [
                    'Some implicit assumptions were detected and added automatically'
                ];
            }
        }

        // Format and categorize assumptions
        const formattedAssumptions = this.formatAssumptions(
            aiResponse.assumptions || [],
            understanding
        );

        return {
            ...aiResponse,
            assumptions: formattedAssumptions,
            assumption_summary: this.generateAssumptionSummary(formattedAssumptions)
        };
    }

    /**
     * Detect implicit assumptions in test cases
     * @param {Object} response - AI response
     * @param {Object} understanding - Requirement understanding
     * @returns {Array} Detected implicit assumptions
     */
    detectImplicitAssumptions(response, understanding) {
        const implicitAssumptions = [];
        const allTestCases = this.getAllTestCases(response);
        const requirementText = JSON.stringify(understanding).toLowerCase();

        allTestCases.forEach(tc => {
            const testText = JSON.stringify(tc).toLowerCase();

            this.implicitPatterns.forEach(pattern => {
                // Check if test mentions the concept but requirement doesn't specify value
                const testMentions = pattern.keywords.some(kw => testText.includes(kw));
                const requirementSpecifies = pattern.keywords.some(kw =>
                    requirementText.includes(kw) && requirementText.includes(pattern.default.toString())
                );

                if (testMentions && !requirementSpecifies) {
                    // Check if assumption already exists
                    const alreadyDeclared = (response.assumptions || []).some(a =>
                        a.toLowerCase().includes(pattern.field.replace('_', ' '))
                    );

                    if (!alreadyDeclared) {
                        implicitAssumptions.push({
                            field: pattern.field,
                            assumed_value: pattern.default,
                            test_case_id: tc.id,
                            description: `Assumed ${pattern.field.replace('_', ' ')} as ${pattern.default} (not specified in requirement)`
                        });
                    }
                }
            });
        });

        // Remove duplicates
        const unique = [];
        const seen = new Set();

        implicitAssumptions.forEach(assumption => {
            if (!seen.has(assumption.field)) {
                seen.add(assumption.field);
                unique.push(assumption);
            }
        });

        return unique;
    }

    /**
     * Get all test cases from response
     * @param {Object} response - AI response
     * @returns {Array} All test cases
     */
    getAllTestCases(response) {
        const testCases = [];

        ['functional', 'negative', 'edge', 'security', 'nonFunctional', 'apiChecklist'].forEach(category => {
            if (response[category] && Array.isArray(response[category])) {
                testCases.push(...response[category]);
            }
        });

        return testCases;
    }

    /**
     * Format and categorize assumptions
     * @param {Array} assumptions - Raw assumptions
     * @param {Object} understanding - Requirement understanding
     * @returns {Array} Formatted assumptions
     */
    formatAssumptions(assumptions, understanding) {
        return assumptions.map(assumption => {
            const assumptionText = typeof assumption === 'string' ? assumption : assumption.description;

            return {
                assumption: assumptionText,
                confidence: this.scoreAssumptionRisk(assumptionText),
                category: this.categorizeAssumption(assumptionText),
                impact: this.assessImpact(assumptionText)
            };
        });
    }

    /**
     * Score assumption risk level
     * @param {string} assumption - Assumption text
     * @returns {string} Risk level
     */
    scoreAssumptionRisk(assumption) {
        const highRiskKeywords = [
            'security', 'payment', 'authentication', 'authorization',
            'data loss', 'financial', 'transaction', 'privacy', 'compliance'
        ];

        const mediumRiskKeywords = [
            'validation', 'error', 'timeout', 'retry', 'session'
        ];

        const assumptionLower = assumption.toLowerCase();

        if (highRiskKeywords.some(kw => assumptionLower.includes(kw))) {
            return 'high';
        } else if (mediumRiskKeywords.some(kw => assumptionLower.includes(kw))) {
            return 'medium';
        }

        return 'low';
    }

    /**
     * Categorize assumption type
     * @param {string} assumption - Assumption text
     * @returns {string} Category
     */
    categorizeAssumption(assumption) {
        const categories = {
            'business_logic': ['rule', 'condition', 'workflow', 'process'],
            'data_format': ['format', 'length', 'type', 'structure', 'pattern'],
            'behavior': ['error', 'response', 'action', 'timeout', 'retry'],
            'integration': ['api', 'service', 'external', 'third-party', 'integration'],
            'security': ['security', 'authentication', 'authorization', 'encryption'],
            'performance': ['performance', 'speed', 'load', 'response time']
        };

        const assumptionLower = assumption.toLowerCase();

        for (const [category, keywords] of Object.entries(categories)) {
            if (keywords.some(kw => assumptionLower.includes(kw))) {
                return category;
            }
        }

        return 'other';
    }

    /**
     * Assess assumption impact
     * @param {string} assumption - Assumption text
     * @returns {string} Impact level
     */
    assessImpact(assumption) {
        const risk = this.scoreAssumptionRisk(assumption);

        if (risk === 'high') return 'critical';
        if (risk === 'medium') return 'moderate';
        return 'minor';
    }

    /**
     * Generate assumption summary
     * @param {Array} assumptions - Formatted assumptions
     * @returns {Object} Summary
     */
    generateAssumptionSummary(assumptions) {
        const byRisk = {
            high: assumptions.filter(a => a.confidence === 'high').length,
            medium: assumptions.filter(a => a.confidence === 'medium').length,
            low: assumptions.filter(a => a.confidence === 'low').length
        };

        const byCategory = {};
        assumptions.forEach(a => {
            byCategory[a.category] = (byCategory[a.category] || 0) + 1;
        });

        return {
            total: assumptions.length,
            by_risk: byRisk,
            by_category: byCategory,
            requires_attention: byRisk.high > 0,
            recommendation: byRisk.high > 0
                ? 'High-risk assumptions detected. Consider clarifying these areas before test execution.'
                : 'Assumptions are within acceptable risk levels.'
        };
    }
}

module.exports = new AssumptionValidator();
