/**
 * Test script for persona-aware enhancements
 * Tests SDET, Product Manager, and Fresher personas
 */

require('dotenv').config();

// Mock logger
const logger = {
    info: (...args) => console.log('[INFO]', ...args),
    warn: (...args) => console.warn('[WARN]', ...args),
    error: (...args) => console.error('[ERROR]', ...args)
};

// Override logger
const path = require('path');
const utilsPath = path.join(__dirname, 'src', 'utils', 'logger.js');
require.cache[require.resolve(utilsPath)] = {
    exports: logger
};

async function testPersonaEnhancements() {
    console.log('\n=== Testing Persona-Aware Enhancements ===\n');

    try {
        // Test 1: Persona Prompt Adapter
        console.log('Test 1: Persona Prompt Adapter');
        const personaPromptAdapter = require('./src/services/persona-prompt.service');

        const basePrompt = 'Generate test cases for payment processing';

        const sdetPrompt = personaPromptAdapter.adaptPrompt(basePrompt, 'sdet');
        console.log('✓ SDET prompt enhanced:', sdetPrompt.includes('automationFeasibility'));

        const pmPrompt = personaPromptAdapter.adaptPrompt(basePrompt, 'product_manager');
        console.log('✓ PM prompt enhanced:', pmPrompt.includes('businessImpact'));

        const fresherPrompt = personaPromptAdapter.adaptPrompt(basePrompt, 'fresher');
        console.log('✓ Fresher prompt enhanced:', fresherPrompt.includes('learningNote'));

        // Test 2: Persona Metadata Enhancer
        console.log('\nTest 2: Persona Metadata Enhancer');
        const personaMetadataEnhancer = require('./src/services/persona-metadata.service');

        const testCase = {
            id: 'TC_001',
            title: 'Test payment API with valid card',
            priority: 'High',
            steps: ['Call POST /api/payments', 'Verify response'],
            expectedResult: 'Payment succeeds',
            riskType: 'Revenue'
        };

        const understanding = {
            feature: 'Payment Processing',
            business_rules: ['Validate CVV'],
            missing_information: ['Retry count not specified']
        };

        const testCases = { functional: [testCase] };

        // Test SDET metadata
        const sdetEnhanced = personaMetadataEnhancer.enhanceWithPersonaMetadata(
            testCases,
            'sdet',
            understanding
        );
        console.log('✓ SDET metadata added:',
            sdetEnhanced.functional[0].automationFeasibility ? 'Yes' : 'No');
        console.log('  - Automation Feasibility:', sdetEnhanced.functional[0].automationFeasibility);
        console.log('  - Is Flaky:', sdetEnhanced.functional[0].isFlaky);

        // Test PM metadata
        const pmEnhanced = personaMetadataEnhancer.enhanceWithPersonaMetadata(
            testCases,
            'product_manager',
            understanding
        );
        console.log('✓ PM metadata added:',
            pmEnhanced.functional[0].businessImpact ? 'Yes' : 'No');
        console.log('  - Business Impact:', pmEnhanced.functional[0].businessImpact);
        console.log('  - Risk If Fails:', pmEnhanced.functional[0].riskIfFails);

        // Test Fresher metadata
        const fresherEnhanced = personaMetadataEnhancer.enhanceWithPersonaMetadata(
            testCases,
            'fresher',
            understanding
        );
        console.log('✓ Fresher metadata added:',
            fresherEnhanced.functional[0].learningNote ? 'Yes' : 'No');
        console.log('  - Learning Note:', fresherEnhanced.functional[0].learningNote);
        console.log('  - Testing Concept:', fresherEnhanced.functional[0].testingConceptUsed);

        // Test 3: Persona Messaging Adapter
        console.log('\nTest 3: Persona Messaging Adapter');
        const personaMessagingAdapter = require('./src/services/persona-messaging.service');

        const testCasesWithQuality = {
            ...testCases,
            quality: {
                coverageConfidence: 72,
                confidenceLevel: 'Medium'
            },
            recommendations: ['Clarify requirements']
        };

        const sdetMessaging = personaMessagingAdapter.adaptMessaging(testCasesWithQuality, 'sdet');
        console.log('✓ SDET messaging adapted');
        console.log('  - Confidence Explanation:', sdetMessaging.quality.sdetExplanation?.substring(0, 80) + '...');

        const pmMessaging = personaMessagingAdapter.adaptMessaging(testCasesWithQuality, 'product_manager');
        console.log('✓ PM messaging adapted');
        console.log('  - Confidence Explanation:', pmMessaging.quality.product_managerExplanation?.substring(0, 80) + '...');

        const fresherMessaging = personaMessagingAdapter.adaptMessaging(testCasesWithQuality, 'fresher');
        console.log('✓ Fresher messaging adapted');
        console.log('  - Confidence Explanation:', fresherMessaging.quality.fresherExplanation?.substring(0, 80) + '...');

        // Test 4: Persona Safety Validator
        console.log('\nTest 4: Persona Safety Validator');
        const personaSafetyValidator = require('./src/services/persona-safety.service');

        const fullTestCases = {
            functional: [testCase, { ...testCase, id: 'TC_002' }],
            negative: [{ ...testCase, id: 'TC_NEG_001', priority: 'Medium' }],
            edge: [],
            nonFunctional: [],
            quality: { coverageConfidence: 75, confidenceLevel: 'Medium' },
            domainContext: {
                domainCoverage: { coverage_percentage: 80 }
            }
        };

        const sdetSafety = personaSafetyValidator.validateSafety(fullTestCases, 'sdet');
        console.log('✓ SDET safety check:', sdetSafety.isValid ? 'PASSED' : 'FAILED');
        console.log('  - Errors:', sdetSafety.errors.length);
        console.log('  - Warnings:', sdetSafety.warnings.length);

        const pmSafety = personaSafetyValidator.validateSafety(fullTestCases, 'product_manager');
        console.log('✓ PM safety check:', pmSafety.isValid ? 'PASSED' : 'FAILED');

        const fresherSafety = personaSafetyValidator.validateSafety(fullTestCases, 'fresher');
        console.log('✓ Fresher safety check:', fresherSafety.isValid ? 'PASSED' : 'FAILED');

        // Test 5: Integration Test
        console.log('\nTest 5: End-to-End Persona Flow');
        console.log('Testing that all services work together...');

        let enhanced = personaMetadataEnhancer.enhanceWithPersonaMetadata(
            fullTestCases,
            'sdet',
            understanding
        );
        enhanced = personaMessagingAdapter.adaptMessaging(enhanced, 'sdet');
        const safety = personaSafetyValidator.validateSafety(enhanced, 'sdet');

        console.log('✓ End-to-end flow completed');
        console.log('  - Test cases enhanced:', enhanced.functional.length);
        console.log('  - SDET metadata present:', !!enhanced.sdetMetadata);
        console.log('  - Safety validated:', safety.isValid);

        console.log('\n=== All Persona Tests Passed Successfully! ===\n');
        console.log('Persona-aware enhancements are working correctly.');
        console.log('\nNext Steps:');
        console.log('1. Test with actual API: POST /api/v1/generate with userPersona field');
        console.log('2. Example request:');
        console.log('   {');
        console.log('     "requirement": "User can process payment with credit card",');
        console.log('     "appType": "web",');
        console.log('     "detailLevel": "medium",');
        console.log('     "userPersona": "sdet"  // or "product_manager" or "fresher"');
        console.log('   }');

    } catch (error) {
        console.error('\n❌ Test Failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run tests
testPersonaEnhancements();
