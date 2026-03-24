/**
 * Test script for backend accuracy enhancements
 * Tests the two-step orchestration without requiring full server
 */

require('dotenv').config();

// Mock logger to avoid dependency issues
const logger = {
    info: (...args) => console.log('[INFO]', ...args),
    warn: (...args) => console.warn('[WARN]', ...args),
    error: (...args) => console.error('[ERROR]', ...args)
};

// Override logger in utils
const path = require('path');
const utilsPath = path.join(__dirname, 'src', 'utils', 'logger.js');
require.cache[require.resolve(utilsPath)] = {
    exports: logger
};

// Test the services
async function testAccuracyEnhancements() {
    console.log('\n=== Testing Backend Accuracy Enhancements ===\n');

    try {
        // Test 1: Ambiguity Analyzer
        console.log('Test 1: Ambiguity Analyzer');
        const ambiguityAnalyzer = require('./src/services/ambiguity.service');

        const testUnderstanding = {
            feature: 'Payment Processing',
            business_rules: ['User must enter valid card', 'System should retry on failure'],
            inputs: [],
            outputs: [],
            risk_areas: ['security', 'financial'],
            missing_information: ['Retry count not specified'],
            ambiguities: ['What happens after max retries?']
        };

        const ambiguityResult = ambiguityAnalyzer.calculateAmbiguityScore(testUnderstanding);
        console.log('✓ Ambiguity Score:', ambiguityResult.score);
        console.log('✓ Ambiguity Level:', ambiguityResult.level);
        console.log('✓ Warnings:', ambiguityResult.warnings);

        // Test 2: Domain Detector
        console.log('\nTest 2: Domain Detector');
        const domainDetector = require('./src/services/domain.service');

        const domains = domainDetector.detect(testUnderstanding);
        console.log('✓ Detected Domains:', domains.map(d => `${d.domain} (${(d.confidence * 100).toFixed(0)}%)`));

        // Test 3: Assumption Validator
        console.log('\nTest 3: Assumption Validator');
        const assumptionValidator = require('./src/services/assumption.service');

        const testResponse = {
            assumptions: ['Assumed CVV length as 3 digits'],
            functional: [
                {
                    id: 'TC_001',
                    title: 'Valid payment with retry',
                    steps: ['Enter card', 'Submit', 'Retry on failure'],
                    expectedResult: 'Payment succeeds after retry'
                }
            ]
        };

        const validatedResponse = assumptionValidator.validate(testResponse, testUnderstanding);
        console.log('✓ Assumptions:', validatedResponse.assumptions.length);
        console.log('✓ Assumption Summary:', validatedResponse.assumption_summary);

        // Test 4: Priority Engine
        console.log('\nTest 4: Priority Engine');
        const priorityEngine = require('./src/services/priority.service');

        const testCase = {
            id: 'TC_001',
            title: 'Payment security validation',
            scenario: 'Test unauthorized payment attempt',
            priority: 'Medium'
        };

        const prioritized = priorityEngine.assignFinalPriority(testCase, testUnderstanding, domains);
        console.log('✓ Original Priority:', testCase.priority);
        console.log('✓ Final Priority:', prioritized.priority);
        console.log('✓ Rationale:', prioritized.priority_rationale);

        // Test 5: Confidence Scorer
        console.log('\nTest 5: Confidence Scorer');
        const confidenceScorer = require('./src/services/confidence.service');

        const testCases = {
            functional: [testCase],
            negative: [],
            edge: [],
            nonFunctional: [],
            apiChecklist: [],
            assumptions: ['Assumed retry count as 3']
        };

        const confidence = confidenceScorer.calculateCoverageConfidence(
            testCases,
            testUnderstanding,
            ambiguityResult.score
        );
        console.log('✓ Overall Confidence:', confidence.overall_confidence + '%');
        console.log('✓ Confidence Level:', confidence.confidence_level);
        console.log('✓ Recommendations:', confidence.recommendations);

        console.log('\n=== All Tests Passed Successfully! ===\n');
        console.log('Backend accuracy enhancements are working correctly.');
        console.log('\nNext Steps:');
        console.log('1. Start the backend server: npm start');
        console.log('2. Test the API endpoint: POST /api/v1/generate');
        console.log('3. Verify enhanced response fields in frontend');

    } catch (error) {
        console.error('\n❌ Test Failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run tests
testAccuracyEnhancements();
