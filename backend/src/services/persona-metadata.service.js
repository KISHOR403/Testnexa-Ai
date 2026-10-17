/**
 * Persona Metadata Enhancer Service
 * Adds persona-specific metadata to test cases
 */

class PersonaMetadataEnhancer {
    /**
     * Add persona-specific metadata to test cases
     * @param {Object} testCases - Generated test cases
     * @param {string} persona - User persona
     * @param {Object} understanding - Requirement understanding
     * @returns {Object} Enhanced test cases
     */
    enhanceWithPersonaMetadata(testCases, persona, understanding) {
        if (!persona || persona === 'default') {
            return testCases;
        }

        const enhanced = { ...testCases };

        // Enhance individual test cases
        ['functional', 'negative', 'edge', 'security', 'nonFunctional', 'apiChecklist'].forEach(category => {
            if (enhanced[category] && Array.isArray(enhanced[category])) {
                enhanced[category] = enhanced[category].map(tc =>
                    this.enhanceTestCase(tc, persona, understanding)
                );
            }
        });

        // Add persona-specific summary metadata
        enhanced[`${persona}Metadata`] = this.generatePersonaSummary(
            testCases,
            persona,
            understanding
        );

        return enhanced;
    }

    enhanceTestCase(testCase, persona, understanding) {
        switch (persona) {
            case 'sdet':
                return this.addSdetMetadata(testCase);
            case 'product_manager':
                return this.addPMMetadata(testCase, understanding);
            case 'fresher':
                return this.addFresherMetadata(testCase);
            default:
                return testCase;
        }
    }

    addSdetMetadata(testCase) {
        return {
            ...testCase,
            automationFeasibility: this.assessAutomationFeasibility(testCase),
            automationNotes: this.generateAutomationNotes(testCase),
            executionPrerequisites: this.identifyPrerequisites(testCase),
            isFlaky: this.detectFlakyness(testCase),
            testLevel: this.determineTestLevel(testCase)
        };
    }

    addPMMetadata(testCase, understanding) {
        return {
            ...testCase,
            businessImpact: testCase.riskType || 'UX',
            userScenarioMapping: this.mapToUserScenario(testCase),
            riskIfFails: this.describeBusinessRisk(testCase),
            complianceRelevance: this.identifyComplianceAspects(testCase, understanding)
        };
    }

    addFresherMetadata(testCase) {
        return {
            ...testCase,
            learningNote: this.generateLearningNote(testCase),
            testingConceptUsed: this.identifyTestingConcept(testCase),
            conceptExplanation: this.explainConcept(testCase),
            whyThisMatters: this.explainImportance(testCase),
            difficultyLevel: this.assessDifficulty(testCase)
        };
    }

    // SDET Helper Methods
    assessAutomationFeasibility(testCase) {
        const title = (testCase.title || '').toLowerCase();
        const steps = JSON.stringify(testCase.steps || []).toLowerCase();

        if (title.includes('api') || title.includes('validation') || steps.includes('api')) {
            return 'High';
        }

        if (title.includes('visual') || title.includes('manually') || steps.includes('verify appearance')) {
            return 'Low';
        }

        return 'Medium';
    }

    generateAutomationNotes(testCase) {
        const feasibility = this.assessAutomationFeasibility(testCase);

        if (feasibility === 'High') {
            return 'Straightforward automation. No UI dependency or complex setup required.';
        } else if (feasibility === 'Low') {
            return 'Manual verification required. Consider visual regression tools if automating.';
        }
        return 'Moderate automation complexity. May require test data setup or environment configuration.';
    }

    identifyPrerequisites(testCase) {
        const prerequisites = [];
        const text = JSON.stringify(testCase).toLowerCase();

        if (text.includes('database') || text.includes('data')) {
            prerequisites.push('Test data setup and cleanup scripts');
        }
        if (text.includes('api') || text.includes('endpoint')) {
            prerequisites.push('API credentials and test environment access');
        }
        if (text.includes('payment') || text.includes('card')) {
            prerequisites.push('Test payment gateway credentials');
        }
        if (text.includes('login') || text.includes('auth')) {
            prerequisites.push('Test user accounts with appropriate permissions');
        }

        return prerequisites.length > 0 ? prerequisites : ['Standard test environment setup'];
    }

    detectFlakyness(testCase) {
        const indicators = ['timeout', 'wait', 'eventually', 'async', 'polling', 'retry'];
        const text = JSON.stringify(testCase).toLowerCase();
        return indicators.some(indicator => text.includes(indicator));
    }

    determineTestLevel(testCase) {
        const title = (testCase.title || '').toLowerCase();

        if (title.includes('api') || title.includes('endpoint')) return 'integration';
        if (title.includes('e2e') || title.includes('end-to-end')) return 'e2e';
        if (title.includes('unit')) return 'unit';

        return 'integration';
    }

    // PM Helper Methods
    mapToUserScenario(testCase) {
        const title = (testCase.title || '').toLowerCase();

        if (title.includes('login') || title.includes('auth')) {
            return 'User authentication flow';
        }
        if (title.includes('payment') || title.includes('checkout')) {
            return 'Checkout completion flow';
        }
        if (title.includes('search')) {
            return 'Product discovery journey';
        }
        if (title.includes('profile') || title.includes('account')) {
            return 'Account management';
        }

        return 'Core user journey';
    }

    describeBusinessRisk(testCase) {
        const riskType = testCase.riskType || testCase.businessImpact || 'UX';

        const risks = {
            Security: 'Security vulnerability risk. Could lead to data breach and compliance violations.',
            Revenue: 'Direct revenue impact. Failure blocks core business flow and causes revenue loss.',
            UX: 'User experience degradation. May cause user frustration and potential churn.',
            Compliance: 'Regulatory compliance risk. Could result in fines or legal issues.',
            Reputation: 'Brand reputation risk. Negative user perception and trust issues.'
        };

        return risks[riskType] || 'Potential impact on user satisfaction and product quality.';
    }

    identifyComplianceAspects(testCase, understanding) {
        const text = JSON.stringify(testCase).toLowerCase();
        const domain = understanding.domain || '';

        if (text.includes('payment') || text.includes('card') || domain.includes('payment')) {
            return 'PCI-DSS payment processing compliance';
        }
        if (text.includes('gdpr') || text.includes('privacy') || text.includes('personal data')) {
            return 'GDPR data privacy compliance';
        }
        if (text.includes('accessibility') || text.includes('wcag')) {
            return 'WCAG accessibility compliance';
        }

        return 'Standard compliance requirements';
    }

    // Fresher Helper Methods
    identifyTestingConcept(testCase) {
        const title = (testCase.title || '').toLowerCase();
        const testType = (testCase.test_type || testCase.type || '').toLowerCase();

        if (testType === 'negative' || title.includes('invalid') || title.includes('error')) {
            return 'Negative Testing';
        }
        if (testType === 'edge' || title.includes('boundary') || title.includes('limit')) {
            return 'Boundary Testing';
        }
        if (title.includes('security') || title.includes('unauthorized')) {
            return 'Security Testing';
        }
        if (title.includes('performance') || title.includes('load')) {
            return 'Performance Testing';
        }
        return 'Positive Testing (Happy Path)';
    }

    explainConcept(testCase) {
        const concept = this.identifyTestingConcept(testCase);

        const explanations = {
            'Positive Testing (Happy Path)': 'Testing with valid inputs to ensure the feature works correctly in normal conditions.',
            'Negative Testing': 'Testing with invalid inputs to verify proper error handling and user feedback.',
            'Boundary Testing': 'Testing at the limits of valid input ranges to find edge case bugs.',
            'Security Testing': 'Testing access controls and data protection to prevent unauthorized access.',
            'Performance Testing': 'Testing system speed and scalability under various load conditions.'
        };

        return explanations[concept] || 'Testing a specific aspect of the system behavior.';
    }

    generateLearningNote(testCase) {
        const concept = this.identifyTestingConcept(testCase);
        const priority = testCase.priority;

        const notes = {
            'Positive Testing (Happy Path)': 'This tests the main success path - what should happen when everything goes right. Always start here.',
            'Negative Testing': 'This tests error handling - what happens when users make mistakes or provide invalid input. Critical for user experience.',
            'Boundary Testing': 'This tests the limits - minimum and maximum values. Bugs often hide at boundaries.',
            'Security Testing': 'This ensures unauthorized users cannot access protected features. Essential for data protection.',
            'Performance Testing': 'This checks if the system is fast enough under load. Affects user satisfaction.'
        };

        let note = notes[concept] || 'This validates an important aspect of the feature.';

        if (priority === 'High') {
            note += ' This is HIGH priority - test this first as it\'s critical to the feature.';
        }

        return note;
    }

    explainImportance(testCase) {
        const riskType = testCase.riskType || testCase.businessImpact || 'UX';

        if (riskType === 'Revenue' || riskType === 'Security') {
            return 'This test is critical because failure could directly impact the business or user security.';
        }

        return 'This test helps ensure the feature works correctly and provides a good user experience.';
    }

    assessDifficulty(testCase) {
        const concept = this.identifyTestingConcept(testCase);

        if (concept === 'Positive Testing (Happy Path)') return 'Beginner';
        if (concept === 'Negative Testing') return 'Beginner';
        if (concept === 'Boundary Testing') return 'Intermediate';
        if (concept === 'Security Testing') return 'Intermediate';
        if (concept === 'Performance Testing') return 'Advanced';

        return 'Intermediate';
    }

    // Summary Generation
    generatePersonaSummary(testCases, persona, understanding) {
        switch (persona) {
            case 'sdet':
                return this.generateSdetSummary(testCases);
            case 'product_manager':
                return this.generatePMSummary(testCases, understanding);
            case 'fresher':
                return this.generateFresherSummary(testCases);
            default:
                return {};
        }
    }

    generateSdetSummary(testCases) {
        const allTests = this.getAllTests(testCases);

        return {
            automationCandidates: {
                high: allTests.filter(t => t.automationFeasibility === 'High').length,
                medium: allTests.filter(t => t.automationFeasibility === 'Medium').length,
                low: allTests.filter(t => t.automationFeasibility === 'Low').length
            },
            flakyTestCount: allTests.filter(t => t.isFlaky).length,
            apiCoveragePercentage: this.calculateApiCoverage(testCases),
            recommendedAutomationFramework: 'API testing with REST Assured or Postman for high-feasibility tests'
        };
    }

    generatePMSummary(testCases, understanding) {
        return {
            requirementGaps: understanding.missing_information || [],
            ambiguityExplanation: this.categorizeAmbiguities(understanding),
            businessRiskBreakdown: this.calculateBusinessRiskDistribution(testCases),
            missingAcceptanceCriteria: understanding.ambiguities || []
        };
    }

    generateFresherSummary(testCases) {
        const allTests = this.getAllTests(testCases);
        const concepts = {};

        allTests.forEach(test => {
            const concept = test.testingConceptUsed || 'Other';
            concepts[concept] = (concepts[concept] || 0) + 1;
        });

        return {
            testingConceptsCovered: Object.entries(concepts).map(([concept, count]) => ({
                concept,
                explanation: this.getConceptExplanation(concept),
                testCount: count
            })),
            learningPath: [
                'Start with positive tests (happy path) - if these fail, the feature is broken',
                'Then try negative tests (error handling) - checks error messages',
                'Finally explore edge cases (boundary conditions) - finds edge case bugs'
            ],
            totalTestsGenerated: allTests.length,
            whyFewerTests: allTests.length < 15 ? 'We focused on quality over quantity. These tests cover the most important scenarios.' : null
        };
    }

    // Utility Methods
    getAllTests(testCases) {
        const all = [];
        ['functional', 'negative', 'edge', 'security', 'nonFunctional', 'apiChecklist'].forEach(cat => {
            if (testCases[cat]) all.push(...testCases[cat]);
        });
        return all;
    }

    calculateApiCoverage(testCases) {
        const allTests = this.getAllTests(testCases);
        const apiTests = allTests.filter(t =>
            (t.title || '').toLowerCase().includes('api') ||
            JSON.stringify(t.steps || []).toLowerCase().includes('api')
        );

        return allTests.length > 0 ? Math.round((apiTests.length / allTests.length) * 100) : 0;
    }

    categorizeAmbiguities(understanding) {
        const ambiguities = understanding.ambiguities || [];

        return {
            high: ambiguities.filter(a =>
                a.toLowerCase().includes('not specified') ||
                a.toLowerCase().includes('undefined')
            ),
            medium: ambiguities.filter(a =>
                !a.toLowerCase().includes('not specified') &&
                !a.toLowerCase().includes('undefined')
            )
        };
    }

    calculateBusinessRiskDistribution(testCases) {
        const allTests = this.getAllTests(testCases);
        const distribution = { revenue: 0, compliance: 0, reputation: 0, ux: 0, security: 0 };

        allTests.forEach(test => {
            const risk = (test.riskType || test.businessImpact || 'UX').toLowerCase();
            if (distribution[risk] !== undefined) {
                distribution[risk]++;
            } else {
                distribution.ux++;
            }
        });

        return distribution;
    }

    getConceptExplanation(concept) {
        const explanations = {
            'Positive Testing (Happy Path)': 'Testing with valid inputs to ensure normal operation',
            'Negative Testing': 'Testing with invalid inputs to ensure proper error handling',
            'Boundary Testing': 'Testing at the limits of valid input ranges',
            'Security Testing': 'Testing access controls and data protection',
            'Performance Testing': 'Testing speed and scalability under load'
        };
        return explanations[concept] || 'Testing a specific aspect of the system';
    }
}

module.exports = new PersonaMetadataEnhancer();
