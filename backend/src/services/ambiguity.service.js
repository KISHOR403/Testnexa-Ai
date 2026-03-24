/**
 * Ambiguity Analysis Service
 * Calculates ambiguity scores and detects unclear requirements
 */

class AmbiguityAnalyzer {
    /**
     * Calculate overall ambiguity score for requirement understanding
     * @param {Object} understanding - Extracted requirement understanding
     * @returns {Object} Ambiguity analysis with score and details
     */
    calculateAmbiguityScore(understanding) {
        const factors = {
            missing_information: this.scoreMissingInfo(understanding),
            ambiguities: this.scoreAmbiguities(understanding),
            vague_language: this.detectVagueLanguage(understanding),
            incomplete_rules: this.detectIncompleteRules(understanding),
            conflicting_statements: this.detectConflicts(understanding)
        };

        const weights = {
            missing_information: 0.15,
            ambiguities: 0.20,
            vague_language: 0.25,
            incomplete_rules: 0.20,
            conflicting_statements: 0.20
        };

        let totalScore = 0;
        Object.keys(factors).forEach(key => {
            totalScore += factors[key] * weights[key];
        });

        const normalizedScore = Math.min(1.0, totalScore);

        return {
            score: normalizedScore,
            level: this.getAmbiguityLevel(normalizedScore),
            factors: factors,
            recommendation: this.getRecommendation(normalizedScore),
            warnings: this.generateWarnings(factors)
        };
    }

    scoreMissingInfo(understanding) {
        const missingInfo = understanding.missing_information || [];
        return Math.min(1.0, missingInfo.length * 0.15);
    }

    scoreAmbiguities(understanding) {
        const ambiguities = understanding.ambiguities || [];
        return Math.min(1.0, ambiguities.length * 0.20);
    }

    detectVagueLanguage(understanding) {
        const vagueTerms = [
            'should', 'might', 'could', 'possibly', 'maybe',
            'appropriate', 'reasonable', 'suitable', 'proper',
            'some', 'few', 'several', 'many', 'usually'
        ];

        const text = JSON.stringify(understanding).toLowerCase();
        const matches = vagueTerms.filter(term => text.includes(term));
        return Math.min(1.0, matches.length / 5);
    }

    detectIncompleteRules(understanding) {
        const rules = understanding.business_rules || understanding.rules || [];
        if (rules.length === 0) return 0.3; // Neutral penalty for no rules

        const incompletePatterns = [
            /if .+ then(?! .+)/i,
            /when .+(?! then)/i,
            /should (?!be|have|include)/i
        ];

        const incompleteCount = rules.filter(rule =>
            incompletePatterns.some(pattern => pattern.test(rule))
        ).length;

        return Math.min(1.0, incompleteCount / Math.max(1, rules.length));
    }

    detectConflicts(understanding) {
        const rules = understanding.business_rules || understanding.rules || [];
        const conflicts = [];

        for (let i = 0; i < rules.length; i++) {
            for (let j = i + 1; j < rules.length; j++) {
                if (this.rulesConflict(rules[i], rules[j])) {
                    conflicts.push([rules[i], rules[j]]);
                }
            }
        }

        return Math.min(1.0, conflicts.length / 3);
    }

    rulesConflict(rule1, rule2) {
        const contradictions = [
            ['must', 'must not'],
            ['required', 'optional'],
            ['always', 'never'],
            ['allow', 'reject']
        ];

        const r1 = rule1.toLowerCase();
        const r2 = rule2.toLowerCase();

        return contradictions.some(([term1, term2]) =>
            (r1.includes(term1) && r2.includes(term2)) ||
            (r1.includes(term2) && r2.includes(term1))
        );
    }

    getAmbiguityLevel(score) {
        if (score >= 0.7) return 'High';
        if (score >= 0.4) return 'Medium';
        return 'Low';
    }

    getRecommendation(score) {
        if (score >= 0.7) {
            return 'High ambiguity detected. Consider clarifying requirements before proceeding with test execution.';
        } else if (score >= 0.4) {
            return 'Moderate ambiguity present. Review assumptions and clarification questions carefully.';
        }
        return 'Requirement clarity is acceptable for test generation.';
    }

    generateWarnings(factors) {
        const warnings = [];

        if (factors.missing_information > 0.5) {
            warnings.push('Significant information is missing from the requirement');
        }
        if (factors.vague_language > 0.6) {
            warnings.push('Requirement contains vague or ambiguous language');
        }
        if (factors.incomplete_rules > 0.5) {
            warnings.push('Some business rules appear incomplete');
        }
        if (factors.conflicting_statements > 0.3) {
            warnings.push('Potential conflicts detected in requirement statements');
        }

        return warnings;
    }

    /**
     * Generate clarification questions based on ambiguity analysis
     * @param {Object} understanding - Requirement understanding
     * @param {Object} ambiguityAnalysis - Ambiguity analysis result
     * @param {string} domain - Detected domain
     * @returns {Array} Clarification questions
     */
    generateClarificationQuestions(understanding, ambiguityAnalysis, domain) {
        const questions = [];

        // Questions from missing information
        const missingInfo = understanding.missing_information || [];
        missingInfo.forEach(missing => {
            questions.push({
                question: `What should the system do regarding: ${missing}?`,
                priority: 'high',
                category: 'missing_spec'
            });
        });

        // Questions from ambiguities
        const ambiguities = understanding.ambiguities || [];
        ambiguities.forEach(ambiguity => {
            questions.push({
                question: ambiguity,
                priority: 'medium',
                category: 'ambiguous_spec'
            });
        });

        // Domain-specific questions
        if (domain) {
            const domainQuestions = this.getDomainSpecificQuestions(domain, understanding);
            questions.push(...domainQuestions);
        }

        return {
            questions,
            total_count: questions.length,
            high_priority_count: questions.filter(q => q.priority === 'high').length
        };
    }

    getDomainSpecificQuestions(domain, understanding) {
        const questionTemplates = {
            'payment': [
                'What payment methods should be supported?',
                'How should failed payment retries be handled?',
                'What is the refund policy and timeline?',
                'What happens when payment gateway is unavailable?'
            ],
            'authentication': [
                'What is the password complexity requirement?',
                'How many failed login attempts before account lockout?',
                'Should multi-factor authentication be supported?',
                'What is the session timeout duration?'
            ],
            'file_upload': [
                'What is the maximum file size allowed?',
                'What file types are permitted?',
                'How should virus-infected files be handled?',
                'What happens when storage quota is exceeded?'
            ],
            'api': [
                'What is the expected API response time?',
                'How should rate limiting be implemented?',
                'What authentication method is required?',
                'How should API versioning be handled?'
            ]
        };

        const questions = questionTemplates[domain] || [];

        return questions
            .filter(q => !this.isAnsweredInUnderstanding(q, understanding))
            .map(q => ({
                question: q,
                priority: 'medium',
                category: 'domain_specific'
            }));
    }

    isAnsweredInUnderstanding(question, understanding) {
        const text = JSON.stringify(understanding).toLowerCase();
        const questionLower = question.toLowerCase();

        // Simple keyword matching
        const keywords = questionLower.split(' ').filter(w => w.length > 4);
        const matchCount = keywords.filter(kw => text.includes(kw)).length;

        return matchCount >= keywords.length * 0.7;
    }
}

module.exports = new AmbiguityAnalyzer();
