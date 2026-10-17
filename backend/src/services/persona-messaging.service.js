/**
 * Persona Messaging Adapter Service
 * Adapts confidence and priority messaging based on user persona
 */

class PersonaMessagingAdapter {
    /**
     * Adapt confidence and priority messaging for persona
     * @param {Object} testCases - Test cases with quality metrics
     * @param {string} persona - User persona
     * @returns {Object} Test cases with adapted messaging
     */
    adaptMessaging(testCases, persona) {
        if (!persona || persona === 'default') {
            return testCases;
        }

        const adapted = { ...testCases };

        // Adapt confidence messaging
        if (adapted.quality) {
            adapted.quality[`${persona}Explanation`] = this.explainConfidence(
                adapted.quality.coverageConfidence,
                adapted.quality.confidenceLevel,
                persona,
                adapted
            );
        }

        // Adapt priority explanations for each test case
        ['functional', 'negative', 'edge', 'security', 'nonFunctional', 'apiChecklist'].forEach(category => {
            if (adapted[category] && Array.isArray(adapted[category])) {
                adapted[category] = adapted[category].map(tc => ({
                    ...tc,
                    priorityExplanation: this.adaptPriorityExplanation(tc, persona)
                }));
            }
        });

        // Adapt recommendations
        if (adapted.recommendations) {
            adapted.recommendations = adapted.recommendations.map(rec =>
                this.adaptRecommendation(rec, persona)
            );
        }

        return adapted;
    }

    /**
     * Explain confidence score for persona
     * @param {number} score - Confidence score
     * @param {string} level - Confidence level
     * @param {string} persona - User persona
     * @param {Object} testCases - Test cases
     * @returns {string} Persona-specific explanation
     */
    explainConfidence(score, level, persona, testCases) {
        const explanations = {
            sdet: {
                High: `${score}% confidence indicates excellent automation readiness. Most tests are API-level with low flakiness risk. Proceed with automation framework setup.`,
                Medium: `${score}% confidence suggests good coverage but some automation challenges. Review Medium-feasibility tests for stabilization needs. Consider mock data strategy for flaky scenarios.`,
                Low: `${score}% confidence indicates significant automation gaps or requirement ambiguity. Recommend requirement clarification before automation investment.`,
                'Very Low': `${score}% confidence signals major automation blockers. High flakiness risk or unclear requirements. Defer automation until requirements are refined.`
            },
            product_manager: {
                High: `${score}% confidence means requirements are well-defined with clear acceptance criteria. Test coverage aligns with business goals. Low risk of rework during UAT.`,
                Medium: `${score}% confidence suggests some requirement ambiguity. Review 'Requirement Gaps' to clarify missing acceptance criteria. This will reduce UAT surprises and rework.`,
                Low: `${score}% confidence indicates significant requirement gaps. Recommend stakeholder alignment session to clarify acceptance criteria and edge case handling before development.`,
                'Very Low': `${score}% confidence signals critical requirement issues. Schedule requirements workshop with stakeholders to define clear acceptance criteria and business rules.`
            },
            fresher: {
                High: `${score}% confidence is great! The requirements are clear and the tests cover the important scenarios. You can proceed with testing confidently.`,
                Medium: `${score}% confidence is okay - the tests cover most cases, but some areas need clarification. Check the 'Questions' section to see what's unclear. This is normal in real projects!`,
                Low: `${score}% confidence means there's a lot of uncertainty. Don't worry - this happens when requirements aren't detailed enough. Review the questions and ask your team lead for clarification.`,
                'Very Low': `${score}% confidence means the requirements need more work. This is a learning opportunity! Ask your team lead to help clarify the unclear parts before you start testing.`
            }
        };

        return explanations[persona]?.[level] || `Confidence: ${score}%`;
    }

    /**
     * Adapt priority explanation for persona
     * @param {Object} testCase - Test case
     * @param {string} persona - User persona
     * @returns {string} Adapted explanation
     */
    adaptPriorityExplanation(testCase, persona) {
        const priority = testCase.priority;
        const riskType = testCase.riskType || testCase.businessImpact || 'UX';

        // Only adapt High priority explanations for clarity
        if (priority !== 'High') {
            return testCase.priorityExplanation || testCase.reason || 'Standard test case';
        }

        const explanations = {
            sdet: this.getSdetPriorityExplanation(testCase, riskType),
            product_manager: this.getPMPriorityExplanation(testCase, riskType),
            fresher: this.getFresherPriorityExplanation(testCase, riskType)
        };

        return explanations[persona] || testCase.priorityExplanation;
    }

    getSdetPriorityExplanation(testCase, riskType) {
        const reasons = {
            Security: 'Critical security validation. Failure exposes vulnerability. High automation priority.',
            Revenue: 'Core business logic. Failure breaks revenue flow. Must be stable and automated.',
            UX: 'User-facing functionality. Regression risk high. Include in smoke test suite.',
            Compliance: 'Regulatory requirement. Must be validated in every release. Automate for compliance audit trail.'
        };
        return reasons[riskType] || 'Critical test case. High automation value.';
    }

    getPMPriorityExplanation(testCase, riskType) {
        const reasons = {
            Security: 'Security vulnerability risk. Failure could lead to data breach and compliance violations.',
            Revenue: 'Direct revenue impact. Failure blocks core business flow and causes revenue loss.',
            UX: 'Critical user experience. Failure causes user frustration and potential churn.',
            Compliance: 'Regulatory compliance requirement. Failure could result in fines or legal issues.',
            Reputation: 'Brand reputation risk. Failure could damage customer trust and brand image.'
        };
        return reasons[riskType] || 'High business impact. Must pass before release.';
    }

    getFresherPriorityExplanation(testCase, riskType) {
        return `This is HIGH priority because it's critical to the feature. If this test fails, it means the core functionality is broken. Always test high-priority cases first.`;
    }

    /**
     * Adapt recommendation for persona
     * @param {string} recommendation - Original recommendation
     * @param {string} persona - User persona
     * @returns {string} Adapted recommendation
     */
    adaptRecommendation(recommendation, persona) {
        const adaptations = {
            sdet: {
                'clarify requirements': 'Request detailed API specifications and error code documentation',
                'add more tests': 'Expand API coverage and add integration test scenarios',
                'review assumptions': 'Validate test data requirements and environment dependencies',
                'improve coverage': 'Identify automation gaps and add missing API validations'
            },
            product_manager: {
                'clarify requirements': 'Schedule requirements refinement session with stakeholders',
                'add more tests': 'Identify missing user scenarios and edge cases in acceptance criteria',
                'review assumptions': 'Validate business rules and compliance requirements with legal/finance',
                'improve coverage': 'Review user journeys to identify untested scenarios'
            },
            fresher: {
                'clarify requirements': 'Ask your team lead to explain the unclear parts of the requirement',
                'add more tests': 'Think about what else could go wrong and add tests for those scenarios',
                'review assumptions': 'Check with your team if the assumptions make sense',
                'improve coverage': 'Review the test cases with your mentor to identify missing scenarios'
            }
        };

        const recLower = recommendation.toLowerCase();
        for (const [pattern, adaptation] of Object.entries(adaptations[persona] || {})) {
            if (recLower.includes(pattern)) {
                return adaptation;
            }
        }

        return recommendation;
    }
}

module.exports = new PersonaMessagingAdapter();
