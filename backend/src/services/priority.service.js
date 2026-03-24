/**
 * Priority Override Service
 * Backend-controlled priority assignment based on business rules, domain, and risk
 */

class PriorityEngine {
    constructor() {
        this.priorityScores = { 'High': 3, 'Medium': 2, 'Low': 1 };
    }

    /**
     * Assign final priority to a test case
     * @param {Object} testCase - Test case object
     * @param {Object} understanding - Requirement understanding
     * @param {Array} domainContext - Detected domains
     * @returns {Object} Test case with final priority
     */
    assignFinalPriority(testCase, understanding, domainContext) {
        // Step 1: Get AI-suggested priority
        const aiPriority = testCase.priority || 'Medium';

        // Step 2: Apply business rules
        const rulePriority = this.applyBusinessRules(testCase, understanding);

        // Step 3: Apply domain rules
        const domainPriority = this.applyDomainRules(testCase, domainContext);

        // Step 4: Apply risk-based rules
        const riskPriority = this.applyRiskRules(testCase, understanding);

        // Step 5: Calculate final priority
        const finalPriority = this.resolvePriority([
            { priority: aiPriority, weight: 0.3, source: 'AI' },
            { priority: rulePriority.priority, weight: 0.3, source: 'Business Rules' },
            { priority: domainPriority.priority, weight: 0.2, source: 'Domain' },
            { priority: riskPriority.priority, weight: 0.2, source: 'Risk' }
        ]);

        return {
            ...testCase,
            priority: finalPriority.priority,
            priority_rationale: finalPriority.rationale,
            priority_sources: finalPriority.sources,
            original_ai_priority: aiPriority
        };
    }

    /**
     * Apply business rule-based priority
     * @param {Object} testCase - Test case
     * @param {Object} understanding - Understanding
     * @returns {Object} Priority decision
     */
    applyBusinessRules(testCase, understanding) {
        const scenario = (testCase.scenario || testCase.title || '').toLowerCase();
        const description = (testCase.description || testCase.expectedResult || '').toLowerCase();
        const combinedText = `${scenario} ${description}`;

        // Critical business rules always get High priority
        const criticalKeywords = [
            'payment', 'transaction', 'money', 'financial', 'revenue',
            'security', 'authentication', 'authorization', 'breach',
            'data loss', 'corruption', 'compliance', 'gdpr', 'pci'
        ];

        if (criticalKeywords.some(kw => combinedText.includes(kw))) {
            return {
                priority: 'High',
                reason: 'Business-critical functionality (payment/security/compliance)'
            };
        }

        // User-facing features get Medium-High
        if (understanding.non_functional_signals?.user_facing) {
            return {
                priority: 'Medium',
                reason: 'User-facing feature'
            };
        }

        // Error handling and validation
        const errorKeywords = ['error', 'invalid', 'failure', 'exception', 'validation'];
        if (errorKeywords.some(kw => combinedText.includes(kw))) {
            return {
                priority: 'Medium',
                reason: 'Error handling and validation'
            };
        }

        return {
            priority: 'Medium',
            reason: 'Standard business logic'
        };
    }

    /**
     * Apply domain-specific priority rules
     * @param {Object} testCase - Test case
     * @param {Array} domainContext - Domain context
     * @returns {Object} Priority decision
     */
    applyDomainRules(testCase, domainContext) {
        if (!domainContext || domainContext.length === 0) {
            return { priority: 'Medium', reason: 'No domain context' };
        }

        const primaryDomain = domainContext[0].domain;
        const rules = this.getDomainPriorityRules(primaryDomain);

        const scenario = (testCase.scenario || testCase.title || '').toLowerCase();

        for (const rule of rules) {
            if (rule.keywords.some(kw => scenario.includes(kw))) {
                return {
                    priority: rule.priority,
                    reason: rule.reason
                };
            }
        }

        return {
            priority: 'Medium',
            reason: 'Standard domain scenario'
        };
    }

    /**
     * Get domain-specific priority rules
     * @param {string} domain - Domain name
     * @returns {Array} Priority rules
     */
    getDomainPriorityRules(domain) {
        const rules = {
            'payment': [
                {
                    keywords: ['fraud', 'security', 'unauthorized', 'breach'],
                    priority: 'High',
                    reason: 'Payment security vulnerability'
                },
                {
                    keywords: ['refund', 'chargeback', 'dispute'],
                    priority: 'High',
                    reason: 'Direct financial impact'
                },
                {
                    keywords: ['timeout', 'failure', 'retry'],
                    priority: 'High',
                    reason: 'Transaction reliability'
                }
            ],
            'authentication': [
                {
                    keywords: ['bypass', 'unauthorized', 'privilege', 'escalation'],
                    priority: 'High',
                    reason: 'Critical security vulnerability'
                },
                {
                    keywords: ['lockout', 'brute force', 'attack'],
                    priority: 'High',
                    reason: 'Account security threat'
                },
                {
                    keywords: ['session', 'timeout', 'expiration'],
                    priority: 'Medium',
                    reason: 'Session management'
                }
            ],
            'file_upload': [
                {
                    keywords: ['malicious', 'virus', 'script', 'executable'],
                    priority: 'High',
                    reason: 'Security threat - malware'
                },
                {
                    keywords: ['size limit', 'memory', 'dos'],
                    priority: 'Medium',
                    reason: 'Resource management'
                }
            ],
            'api': [
                {
                    keywords: ['authentication', 'authorization', 'token'],
                    priority: 'High',
                    reason: 'API security'
                },
                {
                    keywords: ['rate limit', 'throttle', 'abuse'],
                    priority: 'High',
                    reason: 'API protection'
                },
                {
                    keywords: ['validation', 'schema', 'contract'],
                    priority: 'Medium',
                    reason: 'API contract integrity'
                }
            ]
        };

        return rules[domain] || [];
    }

    /**
     * Apply risk-based priority
     * @param {Object} testCase - Test case
     * @param {Object} understanding - Understanding
     * @returns {Object} Priority decision
     */
    applyRiskRules(testCase, understanding) {
        const riskAreas = understanding.risk_areas || [];
        const scenario = (testCase.scenario || testCase.title || '').toLowerCase();

        // Map risk areas to priority
        const highRiskAreas = [
            'security', 'data_integrity', 'financial_loss',
            'compliance', 'pci_dss', 'gdpr', 'unauthorized_access'
        ];

        const hasHighRisk = riskAreas.some(risk =>
            highRiskAreas.includes(risk) && scenario.includes(risk.replace('_', ' '))
        );

        if (hasHighRisk) {
            return {
                priority: 'High',
                reason: 'High-risk area identified'
            };
        }

        // Check test case risk type
        const riskType = testCase.riskType || '';
        if (riskType === 'Revenue' || riskType === 'Security') {
            return {
                priority: 'High',
                reason: `${riskType} impact`
            };
        }

        return {
            priority: 'Medium',
            reason: 'Standard risk level'
        };
    }

    /**
     * Resolve final priority from multiple sources
     * @param {Array} prioritySources - Priority sources with weights
     * @returns {Object} Final priority decision
     */
    resolvePriority(prioritySources) {
        let weightedScore = 0;
        const sources = [];

        prioritySources.forEach(({ priority, weight, source }) => {
            const score = this.priorityScores[priority] || 2;
            weightedScore += score * weight;
            sources.push(`${source}: ${priority}`);
        });

        // Convert back to priority
        let finalPriority;
        if (weightedScore >= 2.5) {
            finalPriority = 'High';
        } else if (weightedScore >= 1.5) {
            finalPriority = 'Medium';
        } else {
            finalPriority = 'Low';
        }

        return {
            priority: finalPriority,
            rationale: `Calculated from: ${sources.join(', ')}`,
            sources: prioritySources,
            weighted_score: weightedScore
        };
    }

    /**
     * Batch process priorities for all test cases
     * @param {Object} testCases - All test cases
     * @param {Object} understanding - Understanding
     * @param {Array} domainContext - Domain context
     * @returns {Object} Test cases with updated priorities
     */
    processAllPriorities(testCases, understanding, domainContext) {
        const categories = ['functional', 'negative', 'edge', 'nonFunctional', 'apiChecklist'];

        categories.forEach(category => {
            if (testCases[category] && Array.isArray(testCases[category])) {
                testCases[category] = testCases[category].map(tc =>
                    this.assignFinalPriority(tc, understanding, domainContext)
                );
            }
        });

        return testCases;
    }
}

module.exports = new PriorityEngine();
