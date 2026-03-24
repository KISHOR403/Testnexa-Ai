/**
 * Domain Detection Service
 * Identifies domain/context from requirements and applies domain-specific rules
 */

class DomainDetector {
    constructor() {
        this.domainPatterns = {
            'authentication': {
                keywords: ['login', 'password', 'signin', 'signup', 'auth', 'credential', 'session', 'logout', 'mfa', '2fa'],
                weight: 1.0
            },
            'payment': {
                keywords: ['payment', 'checkout', 'card', 'cvv', 'billing', 'transaction', 'refund', 'invoice', 'stripe', 'paypal'],
                weight: 1.0
            },
            'file_upload': {
                keywords: ['upload', 'file', 'attachment', 'document', 'image', 'pdf', 'download', 's3', 'storage'],
                weight: 0.9
            },
            'api': {
                keywords: ['api', 'endpoint', 'request', 'response', 'rest', 'graphql', 'webhook', 'json', 'xml'],
                weight: 0.8
            },
            'search': {
                keywords: ['search', 'filter', 'query', 'find', 'lookup', 'elasticsearch', 'index'],
                weight: 0.7
            },
            'notification': {
                keywords: ['email', 'sms', 'notification', 'alert', 'message', 'push', 'sendgrid', 'twilio'],
                weight: 0.7
            },
            'data_entry': {
                keywords: ['form', 'input', 'field', 'validation', 'submit', 'create', 'update'],
                weight: 0.6
            },
            'reporting': {
                keywords: ['report', 'analytics', 'dashboard', 'chart', 'export', 'csv', 'excel'],
                weight: 0.6
            }
        };
    }

    /**
     * Detect domains from requirement understanding
     * @param {Object} understanding - Requirement understanding
     * @returns {Array} Detected domains with confidence scores
     */
    detect(understanding) {
        const text = JSON.stringify(understanding).toLowerCase();
        const domains = [];

        for (const [domain, config] of Object.entries(this.domainPatterns)) {
            const matchedKeywords = config.keywords.filter(kw => text.includes(kw));
            const matchCount = matchedKeywords.length;

            if (matchCount >= 2) {
                const confidence = Math.min(
                    1.0,
                    (matchCount / config.keywords.length) * config.weight
                );

                domains.push({
                    domain,
                    confidence,
                    matched_keywords: matchedKeywords,
                    match_count: matchCount
                });
            }
        }

        // Sort by confidence
        return domains.sort((a, b) => b.confidence - a.confidence);
    }

    /**
     * Get domain-specific rules and requirements
     * @param {string} domain - Domain name
     * @returns {Object} Domain rules
     */
    getDomainRules(domain) {
        const rulesets = {
            'authentication': {
                mandatory_risks: ['security', 'unauthorized_access', 'session_management', 'brute_force'],
                focus_areas: ['negative_testing', 'boundary_testing', 'security_testing'],
                mandatory_scenarios: [
                    'Invalid credentials',
                    'Account lockout after failed attempts',
                    'Session expiration',
                    'Concurrent login attempts',
                    'Password reset flow'
                ],
                priority_boost: ['security', 'negative'],
                default_assumptions: [
                    'Session timeout: 30 minutes',
                    'Max failed attempts: 3',
                    'Password min length: 8 characters'
                ]
            },
            'payment': {
                mandatory_risks: ['security', 'data_integrity', 'financial_loss', 'compliance', 'pci_dss'],
                focus_areas: ['security_testing', 'error_handling', 'idempotency', 'transaction_integrity'],
                mandatory_scenarios: [
                    'Invalid card details',
                    'Insufficient funds',
                    'Network timeout during transaction',
                    'Duplicate transaction prevention',
                    'Refund processing',
                    'Payment gateway failure'
                ],
                priority_boost: ['security', 'financial', 'error_handling'],
                default_assumptions: [
                    'CVV length: 3 digits (Visa/Mastercard)',
                    'Transaction timeout: 30 seconds',
                    'Retry attempts: 2'
                ]
            },
            'file_upload': {
                mandatory_risks: ['security', 'performance', 'storage', 'malware'],
                focus_areas: ['boundary_testing', 'security_testing', 'performance_testing'],
                mandatory_scenarios: [
                    'File size exceeds limit',
                    'Invalid file type',
                    'Malicious file upload attempt',
                    'Concurrent uploads',
                    'Upload interruption',
                    'Virus scan integration'
                ],
                priority_boost: ['security', 'boundary'],
                default_assumptions: [
                    'Max file size: 10MB',
                    'Allowed types: PDF, JPG, PNG, DOCX',
                    'Virus scanning: Required'
                ]
            },
            'api': {
                mandatory_risks: ['security', 'performance', 'data_integrity', 'availability'],
                focus_areas: ['contract_testing', 'error_handling', 'performance_testing', 'authentication'],
                mandatory_scenarios: [
                    'Invalid request payload',
                    'Missing required fields',
                    'Rate limiting',
                    'Authentication failure',
                    'Timeout handling',
                    'API versioning'
                ],
                priority_boost: ['contract', 'error_handling', 'security'],
                default_assumptions: [
                    'Response time: < 2 seconds',
                    'Rate limit: 100 requests/minute',
                    'Authentication: Bearer token'
                ]
            },
            'search': {
                mandatory_risks: ['performance', 'accuracy', 'usability'],
                focus_areas: ['performance_testing', 'boundary_testing', 'usability_testing'],
                mandatory_scenarios: [
                    'Empty search query',
                    'Special characters in search',
                    'Large result sets',
                    'No results found',
                    'Search performance with filters'
                ],
                priority_boost: ['performance', 'usability'],
                default_assumptions: [
                    'Max results per page: 20',
                    'Search timeout: 5 seconds'
                ]
            },
            'notification': {
                mandatory_risks: ['reliability', 'delivery', 'privacy'],
                focus_areas: ['reliability_testing', 'error_handling', 'privacy_testing'],
                mandatory_scenarios: [
                    'Email delivery failure',
                    'Invalid recipient',
                    'Notification retry logic',
                    'Unsubscribe handling',
                    'Rate limiting'
                ],
                priority_boost: ['reliability', 'privacy'],
                default_assumptions: [
                    'Retry attempts: 3',
                    'Delivery timeout: 60 seconds'
                ]
            }
        };

        return rulesets[domain] || {
            mandatory_risks: [],
            focus_areas: [],
            mandatory_scenarios: [],
            priority_boost: [],
            default_assumptions: []
        };
    }

    /**
     * Apply domain rules to enhance understanding
     * @param {Object} understanding - Requirement understanding
     * @param {Array} detectedDomains - Detected domains
     * @returns {Object} Enhanced understanding
     */
    applyDomainRules(understanding, detectedDomains) {
        const enhancedUnderstanding = { ...understanding };

        // Initialize arrays if not present
        enhancedUnderstanding.risk_areas = understanding.risk_areas || [];
        enhancedUnderstanding.test_focus_areas = understanding.test_focus_areas || [];
        enhancedUnderstanding.mandatory_scenarios = understanding.mandatory_scenarios || [];
        enhancedUnderstanding.domain_assumptions = understanding.domain_assumptions || [];

        detectedDomains.forEach(({ domain, confidence }) => {
            const rules = this.getDomainRules(domain);

            // Only apply rules for high-confidence domains
            if (confidence >= 0.5) {
                // Enhance risk areas
                enhancedUnderstanding.risk_areas = [
                    ...new Set([
                        ...enhancedUnderstanding.risk_areas,
                        ...rules.mandatory_risks
                    ])
                ];

                // Add domain-specific test focus areas
                enhancedUnderstanding.test_focus_areas = [
                    ...new Set([
                        ...enhancedUnderstanding.test_focus_areas,
                        ...rules.focus_areas
                    ])
                ];

                // Add mandatory test scenarios
                enhancedUnderstanding.mandatory_scenarios = [
                    ...new Set([
                        ...enhancedUnderstanding.mandatory_scenarios,
                        ...rules.mandatory_scenarios
                    ])
                ];

                // Add domain-specific default assumptions
                enhancedUnderstanding.domain_assumptions = [
                    ...new Set([
                        ...enhancedUnderstanding.domain_assumptions,
                        ...rules.default_assumptions
                    ])
                ];
            }
        });

        // Add domain context
        enhancedUnderstanding.detected_domains = detectedDomains;
        enhancedUnderstanding.primary_domain = detectedDomains.length > 0
            ? detectedDomains[0].domain
            : 'general';

        return enhancedUnderstanding;
    }

    /**
     * Check if mandatory scenarios are covered in test cases
     * @param {Object} testCases - Generated test cases
     * @param {Array} mandatoryScenarios - Required scenarios
     * @returns {Object} Coverage analysis
     */
    ensureMandatoryScenarios(testCases, mandatoryScenarios) {
        const allTestCases = this.getAllTestCases(testCases);
        const existingScenarios = allTestCases.map(tc =>
            (tc.title || tc.scenario || '').toLowerCase()
        );

        const missingScenarios = mandatoryScenarios.filter(scenario =>
            !existingScenarios.some(existing =>
                this.scenariosMatch(existing, scenario)
            )
        );

        const coverage = {
            total_mandatory: mandatoryScenarios.length,
            covered: mandatoryScenarios.length - missingScenarios.length,
            missing: missingScenarios,
            coverage_percentage: mandatoryScenarios.length > 0
                ? ((mandatoryScenarios.length - missingScenarios.length) / mandatoryScenarios.length) * 100
                : 100
        };

        return {
            ...testCases,
            domain_coverage: coverage,
            coverage_gaps: missingScenarios.length > 0
                ? missingScenarios.map(s => `Missing mandatory scenario: ${s}`)
                : [],
            warnings: missingScenarios.length > 0
                ? [`${missingScenarios.length} mandatory domain scenarios not covered. Consider regenerating with focus on these areas.`]
                : []
        };
    }

    getAllTestCases(testCases) {
        const all = [];
        ['functional', 'negative', 'edge', 'nonFunctional', 'apiChecklist'].forEach(category => {
            if (testCases[category] && Array.isArray(testCases[category])) {
                all.push(...testCases[category]);
            }
        });
        return all;
    }

    scenariosMatch(existing, required) {
        const existingWords = existing.toLowerCase().split(/\s+/);
        const requiredWords = required.toLowerCase().split(/\s+/).filter(w => w.length > 3);

        const matchCount = requiredWords.filter(word =>
            existingWords.some(ew => ew.includes(word) || word.includes(ew))
        ).length;

        return matchCount >= requiredWords.length * 0.6;
    }
}

module.exports = new DomainDetector();
