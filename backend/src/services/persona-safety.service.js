/**
 * Persona Safety Validator Service
 * Ensures persona adaptations don't compromise test quality
 */

const logger = require('../utils/logger');

class PersonaSafetyValidator {
    /**
     * Validate that persona adaptations don't violate safety rules
     * @param {Object} testCases - Generated test cases
     * @param {string} persona - User persona
     * @returns {Object} Validation result
     */
    validateSafety(testCases, persona) {
        const violations = [];

        // Rule 1: Test count must not be reduced below minimum threshold (except for Fresher)
        if (persona !== 'fresher') {
            const totalTests = this.countTotalTests(testCases);
            if (totalTests < 6) {
                violations.push({
                    rule: 'MINIMUM_TEST_COUNT',
                    message: `Test count (${totalTests}) below minimum threshold (6)`,
                    severity: 'error'
                });
            }
        } else {
            // Fresher mode should have 8-12 tests
            const totalTests = this.countTotalTests(testCases);
            if (totalTests < 6 || totalTests > 15) {
                violations.push({
                    rule: 'FRESHER_TEST_COUNT',
                    message: `Fresher mode test count (${totalTests}) outside recommended range (6-15)`,
                    severity: 'warning'
                });
            }
        }

        // Rule 2: High-priority security tests must never be downgraded
        const securityTests = this.getSecurityTests(testCases);
        securityTests.forEach(test => {
            if (test.priority !== 'High') {
                violations.push({
                    rule: 'SECURITY_PRIORITY',
                    message: `Security test ${test.id} must be High priority, found: ${test.priority}`,
                    severity: 'error'
                });
            }
        });

        // Rule 3: Confidence score must not be inflated
        if (testCases.quality?.coverageConfidence > 95) {
            violations.push({
                rule: 'CONFIDENCE_INFLATION',
                message: `Confidence score (${testCases.quality.coverageConfidence}%) suspiciously high`,
                severity: 'warning'
            });
        }

        // Rule 4: Core business scenarios must be covered
        if (testCases.domainContext?.domainCoverage) {
            const coverage = testCases.domainContext.domainCoverage.coverage_percentage || 0;
            if (coverage < 70) {
                violations.push({
                    rule: 'MANDATORY_COVERAGE',
                    message: `Mandatory scenario coverage (${coverage}%) below threshold (70%)`,
                    severity: 'warning'
                });
            }
        }

        // Rule 5: Persona-specific fields must not alter core test logic
        const coreFieldsIntact = this.verifyCoreFieldsIntact(testCases, persona);
        if (!coreFieldsIntact) {
            violations.push({
                rule: 'CORE_FIELDS_INTEGRITY',
                message: 'Core test fields have been modified by persona adaptation',
                severity: 'error'
            });
        }

        // Log violations
        if (violations.length > 0) {
            logger.warn('Persona safety violations detected', { persona, violations });
        }

        return {
            isValid: violations.filter(v => v.severity === 'error').length === 0,
            violations,
            warnings: violations.filter(v => v.severity === 'warning'),
            errors: violations.filter(v => v.severity === 'error')
        };
    }

    /**
     * Get security-related tests
     * @param {Object} testCases - Test cases
     * @returns {Array} Security tests
     */
    getSecurityTests(testCases) {
        const all = [];
        ['functional', 'negative', 'edge', 'nonFunctional'].forEach(cat => {
            if (testCases[cat]) {
                all.push(...testCases[cat].filter(t =>
                (t.riskType === 'Security' || t.businessImpact === 'Security' ||
                    (t.title && t.title.toLowerCase().includes('security')) ||
                    (t.title && t.title.toLowerCase().includes('unauthorized')) ||
                    (t.title && t.title.toLowerCase().includes('authentication')))
                ));
            }
        });
        return all;
    }

    /**
     * Count total test cases
     * @param {Object} testCases - Test cases
     * @returns {number} Total count
     */
    countTotalTests(testCases) {
        let count = 0;
        ['functional', 'negative', 'edge', 'nonFunctional', 'apiChecklist'].forEach(cat => {
            if (testCases[cat] && Array.isArray(testCases[cat])) {
                count += testCases[cat].length;
            }
        });
        return count;
    }

    /**
     * Verify core fields haven't been modified
     * @param {Object} testCases - Test cases
     * @param {string} persona - Persona
     * @returns {boolean} True if intact
     */
    verifyCoreFieldsIntact(testCases, persona) {
        // Check that core fields exist and are not corrupted
        const coreFields = ['functional', 'negative', 'edge', 'quality', 'understanding'];

        for (const field of coreFields) {
            if (field === 'quality' && testCases[field]) {
                // Verify quality metrics exist
                if (!testCases[field].coverageConfidence || !testCases[field].confidenceLevel) {
                    return false;
                }
            }
        }

        // Verify test cases have required fields
        const allTests = this.getAllTests(testCases);
        for (const test of allTests) {
            if (!test.id || !test.title || !test.priority) {
                return false;
            }
        }

        return true;
    }

    /**
     * Get all test cases
     * @param {Object} testCases - Test cases
     * @returns {Array} All tests
     */
    getAllTests(testCases) {
        const all = [];
        ['functional', 'negative', 'edge', 'nonFunctional', 'apiChecklist'].forEach(cat => {
            if (testCases[cat] && Array.isArray(testCases[cat])) {
                all.push(...testCases[cat]);
            }
        });
        return all;
    }

    /**
     * Get safety summary for logging
     * @param {Object} validationResult - Validation result
     * @returns {string} Summary
     */
    getSafetySummary(validationResult) {
        if (validationResult.isValid && validationResult.warnings.length === 0) {
            return 'All safety checks passed';
        }

        const parts = [];
        if (validationResult.errors.length > 0) {
            parts.push(`${validationResult.errors.length} error(s)`);
        }
        if (validationResult.warnings.length > 0) {
            parts.push(`${validationResult.warnings.length} warning(s)`);
        }

        return `Safety check: ${parts.join(', ')}`;
    }
}

module.exports = new PersonaSafetyValidator();
