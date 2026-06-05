/**
 * Two-Step Generation Orchestrator
 * Implements accuracy-focused test generation with requirement understanding phase
 * followed by controlled test case generation
 */

const { callAI } = require('./ai.service');
const ambiguityAnalyzer = require('./ambiguity.service');
const assumptionValidator = require('./assumption.service');
const domainDetector = require('./domain.service');
const priorityEngine = require('./priority.service');
const confidenceScorer = require('./confidence.service');
const personaPromptAdapter = require('./persona-prompt.service');
const personaMetadataEnhancer = require('./persona-metadata.service');
const personaMessagingAdapter = require('./persona-messaging.service');
const personaSafetyValidator = require('./persona-safety.service');
const logger = require('../utils/logger');

class TwoStepOrchestrator {
    /**
     * Main orchestration method for test case generation
     * @param {string} requirement - User requirement text
     * @param {Object} config - Generation configuration
     * @returns {Object} Complete test suite with metadata
     */
    async generateTestCases(requirement, config = {}) {
        try {
            const persona = config.userPersona || 'default';
            logger.info('Starting fast single-pass test generation', { persona });

            // FAST PATH: Single combined AI call for understanding + test generation
            logger.info('Combined phase: Understanding + Generating test cases');
            const combinedPrompt = this.buildCombinedPrompt(requirement, config);

            // Adapt prompt for persona
            const adaptedPrompt = personaPromptAdapter.adaptPrompt(combinedPrompt, persona);

            let combinedResult;
            try {
                const response = await callAI(adaptedPrompt, {
                    temperature: 0.2,
                    maxTokens: 65536
                });

                combinedResult = this.parseAIResponse(response);
            } catch (aiError) {
                logger.warn('AI call failed, using fallback generation:', aiError.message);

                // Check if it's a rate limit error — re-throw those
                if (aiError.statusCode === 429 || aiError.message.includes('429') || aiError.message.includes('RESOURCE_EXHAUSTED')) {
                    throw aiError;
                }

                // For other AI errors, generate fallback test cases
                combinedResult = this.generateFallbackTestCases(requirement, config);
            }

            // Extract understanding from combined result
            const understanding = {
                feature: combinedResult.feature || 'Unnamed feature',
                business_rules: combinedResult.business_rules || [],
                rules: combinedResult.business_rules || [],
                inputs: combinedResult.inputs || [],
                outputs: combinedResult.outputs || [],
                risk_areas: combinedResult.risk_areas || [],
                non_functional_signals: combinedResult.non_functional_signals || {},
                ambiguities: combinedResult.ambiguities || [],
                missing_information: combinedResult.missing_information || []
            };

            // Validate understanding
            const validated = this.validateUnderstanding(understanding);

            // Calculate ambiguity score (local, no AI call)
            logger.info('Analyzing ambiguity');
            const ambiguityAnalysis = ambiguityAnalyzer.calculateAmbiguityScore(validated);

            // Detect domain (local, no AI call)
            logger.info('Detecting domain');
            const detectedDomains = domainDetector.detect(validated);

            // Apply domain-specific rules
            const enhancedUnderstanding = domainDetector.applyDomainRules(
                validated,
                detectedDomains
            );

            // Use test cases from the combined result
            const testCases = {
                assumptions: combinedResult.assumptions || [],
                functional: combinedResult.functional || [],
                negative: combinedResult.negative || [],
                edge: combinedResult.edge || [],
                apiChecklist: combinedResult.apiChecklist || [],
                nonFunctional: combinedResult.nonFunctional || [],
                questions: combinedResult.questions || []
            };

            // Post-Processing (local, no AI call)
            logger.info('Post-processing and validation');
            const processed = await this.postProcess(
                testCases,
                enhancedUnderstanding,
                ambiguityAnalysis,
                detectedDomains,
                config
            );

            logger.info('Test generation completed successfully');
            return processed;

        } catch (error) {
            logger.error('Error in test generation:', error);
            throw error;
        }
    }

    /**
     * Build combined prompt for single-pass understanding + test generation
     * @param {string} requirement - Requirement text
     * @param {Object} config - Configuration
     * @returns {string} Combined prompt
     */
    buildCombinedPrompt(requirement, config = {}) {
        const testFocus = (config.testFocus || 'mixed').toLowerCase();
        const detailLevel = (config.detailLevel || 'medium').toLowerCase();
        const appType = (config.appType || 'web').toLowerCase();

        const detailInstructions = {
            basic: 'Limit to 3-5 high-priority test cases per category. Focus ONLY on the most critical essential paths.',
            medium: 'Provide a balanced test suite with 5-8 test cases per category, covering typical paths and common edge cases.',
            detailed: 'Provide an exhaustive test suite with 8-12+ test cases per category, deeply uncovering security, boundaries, and complex interactions.'
        };

        const appTypeInstructions = {
            web: 'Focus heavily on UI/UX workflows, responsive behaviors, client-side state, and browser-specific validations. MANDATORY: You MUST also generate backend API validation tests in the apiChecklist array.',
            mobile: 'Focus heavily on mobile gestures, network connectivity changes, device rotation, interruptions, and app lifecycle. MANDATORY: You MUST also generate backend API validation tests in the apiChecklist array.',
            api: 'Focus entirely on backend logic. Deeply populate the apiChecklist with contract validations, headers, limits, and payload schemas. While focusing on API, you may still include critical functional integration tests in other categories.'
        };
        return `You are a Senior QA Architect and SDET with deep industry experience in testing standards (ISTQB, Agile, BDD).
Analyze the following requirement and generate comprehensive, industry-standard test cases in a single pass.

Requirement:
${requirement}

CONTEXT RULES:
Application Type: ${appType} -> ${appTypeInstructions[appType] || appTypeInstructions.web}
Detail Depth: ${detailLevel} -> ${detailInstructions[detailLevel] || detailInstructions.medium}
Test Focus Category: ${testFocus}

STRICT TEST CASE SCHEMA — Every test case object MUST contain exactly these 9 fields (NO additional fields allowed):
- "id": string (e.g. "TC_FUNC_001")
- "module": string (feature module name, e.g. "Login", "Payment")
- "title": string (concise test case title, max 80 chars, NO prose)
- "type": string (MUST be one of: "Functional", "Negative", "Edge", "API", "Non-Functional")
- "priority": string (MUST be one of: "High", "Medium", "Low")
- "preconditions": string[] (array of prerequisite conditions, each a short declarative statement)
- "steps": array of objects, each with exactly {"action": string, "expected": string}
    - "action": what the tester DOES (imperative verb, e.g. "Enter valid email in the email field")
    - "expected": what the system SHOULD do (e.g. "Email field accepts input without error")
- "expectedResult": string (final pass/fail verdict for the entire test case)
- "requirementId": string (traceability ID, e.g. "REQ_001")

ABSOLUTE CONSTRAINTS ON FIELD VALUES:
- "title": Must be a concise noun phrase. NO sentences, NO prose, NO "Verify that..." phrasing.
  ✅ GOOD: "Valid Credit Card Payment"
  ❌ BAD: "Verify that the user can successfully make a payment using a valid credit card"
- "steps[].action": Must start with an imperative verb (Enter, Click, Navigate, Submit, Send, Select).
  NO "Given/When/Then" prefixes. NO prose paragraphs.
  ✅ GOOD: "Enter 'test@email.com' in the email field"
  ❌ BAD: "Given the user is on the login page, when they enter their email..."
- "steps[].expected": Must be a short, verifiable assertion.
  ✅ GOOD: "Email field accepts input and shows no validation error"
  ❌ BAD: "The system should properly validate and accept the email input from the user"
- "preconditions": Must be an array of short declarative statements.
  ✅ GOOD: ["User is logged in", "Cart has at least 1 item"]
  ❌ BAD: "The user must be logged in and have items in their cart"
- "expectedResult": One concise sentence with clear pass/fail criteria.
- ALL string values must be plain text. NO markdown, NO HTML, NO bullet points inside strings.

Return ONLY valid JSON with this exact structure:
{
  "feature": "Brief feature name",
  "business_rules": ["Rule 1", "Rule 2"],
  "inputs": [{"name": "field", "type": "string", "constraints": "max 50 chars"}],
  "outputs": [{"name": "response", "type": "object", "structure": "..."}],
  "risk_areas": ["security", "data_integrity"],
  "non_functional_signals": {
    "performance_critical": true,
    "security_sensitive": true,
    "user_facing": true
  },
  "ambiguities": ["What happens if X?"],
  "missing_information": ["Error handling not specified"],
  "assumptions": ["Assumed X as Y because Z"],
  "functional": [
    {
      "id": "TC_FUNC_001",
      "module": "Payment",
      "title": "Valid Credit Card Checkout",
      "type": "Functional",
      "priority": "High",
      "preconditions": ["User is logged in", "Cart contains items"],
      "steps": [
        {"action": "Navigate to checkout page", "expected": "Checkout page loads with cart summary"},
        {"action": "Enter valid credit card details", "expected": "Card fields accept input without error"},
        {"action": "Click 'Place Order' button", "expected": "Order is submitted and confirmation page appears"}
      ],
      "expectedResult": "Order placed successfully with confirmation number displayed",
      "requirementId": "REQ_001"
    }
  ],
  "negative": [{"id": "TC_NEG_001", "module": "Module", "title": "Expired Card Rejection", "type": "Negative", "priority": "High", "preconditions": ["User on payment page"], "steps": [{"action": "Enter expired card details", "expected": "System displays expiration error message"}], "expectedResult": "Payment rejected with clear error", "requirementId": "REQ_001"}],
  "edge": [{"id": "TC_EDGE_001", "module": "Module", "title": "Boundary Amount Test", "type": "Edge", "priority": "Medium", "preconditions": ["Cart ready"], "steps": [{"action": "Set order total to $0.01", "expected": "System accepts minimum amount"}], "expectedResult": "Order processes for minimum valid amount", "requirementId": "REQ_001"}],
  "apiChecklist": [{"id": "TC_API_001", "module": "Payment API", "title": "POST /api/payment - Valid Card", "type": "API", "priority": "High", "preconditions": ["API server running", "Valid auth token"], "steps": [{"action": "Send POST with valid card payload", "expected": "Response status 200"}, {"action": "Validate response schema", "expected": "Body contains transactionId and status=success"}], "expectedResult": "HTTP 200 with valid transaction object", "requirementId": "REQ_API_001"}],
  "nonFunctional": [{"id": "TC_NF_001", "module": "Module", "title": "Checkout Page Load Time", "type": "Non-Functional", "priority": "Medium", "preconditions": ["Standard network conditions"], "steps": [{"action": "Load checkout page with 10 items", "expected": "Page renders within 2 seconds"}], "expectedResult": "Page load time under 2s at P95", "requirementId": "REQ_NF_001"}],
  "questions": ["Clarification question 1?"]
}

CRITICAL RULES:
1. EVERY test case must match the schema EXACTLY. No extra fields, no missing fields.
2. "steps" MUST be an array of {"action": string, "expected": string} objects. NOT an array of strings.
3. "preconditions" MUST be an array of strings. NOT a single string.
4. NO prose anywhere in test case bodies. Keep all values concise and machine-readable.
5. "title" must be under 80 characters. NO sentences. Noun phrase only.
6. For "apiChecklist": include HTTP method, endpoint path, status codes, and response schema validation.
7. Generate comprehensive coverage across functional, negative, edge, API, and non-functional categories.
8. List ALL assumptions explicitly in the "assumptions" array.
9. IMPORTANT: Return ONLY valid JSON. START with '{' and END with '}'. DO NOT use markdown code blocks.`;
    }

    /**
     * Phase 1: Understand the requirement (kept as fallback)
     * @param {string} requirement - Requirement text
     * @param {Object} config - Configuration
     * @returns {Object} Structured understanding
     */
    async understandRequirement(requirement, config) {
        const understandingPrompt = this.buildUnderstandingPrompt(requirement);

        const response = await callAI(understandingPrompt, {
            temperature: 0.1,
            maxTokens: 4096
        });

        const understanding = this.parseAIResponse(response);
        return understanding;
    }

    /**
     * Build understanding phase prompt
     * @param {string} requirement - Requirement text
     * @returns {string} Prompt
     */
    buildUnderstandingPrompt(requirement) {
        return `You are a requirements analyst. Extract structured information from the following requirement.

Requirement:
${requirement}

Extract and return ONLY valid JSON with this exact structure:
{
  "feature": "Brief feature name",
  "business_rules": ["Rule 1", "Rule 2"],
  "inputs": [{"name": "field", "type": "string", "constraints": "max 50 chars"}],
  "outputs": [{"name": "response", "type": "object", "structure": "..."}],
  "risk_areas": ["security", "data_integrity"],
  "non_functional_signals": {
    "performance_critical": true/false,
    "security_sensitive": true/false,
    "user_facing": true/false
  },
  "ambiguities": ["What happens if X?", "Is Y required?"],
  "missing_information": ["Error handling not specified"]
}

Rules:
- If information is unclear, add to "ambiguities"
- If information is missing, add to "missing_information"
- Do NOT make assumptions - mark them explicitly
- Extract only what is stated or clearly implied
- IMPORTANT: Return ONLY valid JSON. START your response with '{' and END with '}'.
- DO NOT use markdown code blocks (like \`\`\`json).
- DO NOT include any preamble, introduction, or concluding text.`;
    }

    /**
     * Phase 2: Generate test cases
     * @param {Object} understanding - Enhanced understanding
     * @param {Object} ambiguityAnalysis - Ambiguity analysis
     * @param {Array} domains - Detected domains
     * @param {Object} config - Configuration
     * @returns {Object} Generated test cases
     */
    async generateTests(understanding, ambiguityAnalysis, domains, config) {
        const basePrompt = this.buildTestnexaerationPrompt(
            understanding,
            ambiguityAnalysis,
            domains,
            config
        );

        // Adapt prompt for persona
        const persona = config.userPersona || 'default';
        const adaptedPrompt = personaPromptAdapter.adaptPrompt(basePrompt, persona);

        const response = await callAI(adaptedPrompt, {
            temperature: 0.3, // Slightly higher for variety
            maxTokens: 8192
        });

        const testCases = this.parseAIResponse(response);

        return testCases;
    }

    /**
     * Build test generation prompt
     * @param {Object} understanding - Understanding
     * @param {Object} ambiguityAnalysis - Ambiguity
     * @param {Array} domains - Domains
     * @param {Object} config - Config
     * @returns {string} Prompt
     */
    buildTestGenerationPrompt(understanding, ambiguityAnalysis, domains, config) {
        const domainContext = domains.length > 0 ? domains[0].domain : 'general';
        const mandatoryScenarios = understanding.mandatory_scenarios || [];
        const detailLevel = (config?.detailLevel || 'medium').toLowerCase();
        const appType = (config?.appType || 'web').toLowerCase();

        const detailInstructions = {
            basic: 'Limit to 3-5 high-priority test cases per category. Focus ONLY on the most critical essential paths.',
            medium: 'Provide a balanced test suite with 5-8 test cases per category, covering typical paths and common edge cases.',
            detailed: 'Provide an exhaustive test suite with 8-12+ test cases per category, deeply uncovering security, boundaries, and complex interactions.'
        };

        const appTypeInstructions = {
            web: 'Focus heavily on UI/UX workflows, responsive behaviors, client-side state, and browser-specific validations. MANDATORY: You MUST also generate backend API validation tests in the apiChecklist array.',
            mobile: 'Focus heavily on mobile gestures, network connectivity changes, device rotation, interruptions, and app lifecycle. MANDATORY: You MUST also generate backend API validation tests in the apiChecklist array.',
            api: 'Focus entirely on backend logic. Deeply populate the apiChecklist with contract validations, headers, limits, and payload schemas. While focusing on API, you may still include critical functional integration tests in other categories.'
        };

        return `You are a Senior QA Architect. Generate industry-standard test cases based on this validated requirement understanding:

${JSON.stringify(understanding, null, 2)}

Domain Context: ${domainContext}
Ambiguity Level: ${ambiguityAnalysis.level}
Mandatory Scenarios: ${mandatoryScenarios.join(', ')}

CONTEXT RULES:
Application Type: ${appType} -> ${appTypeInstructions[appType] || appTypeInstructions.web}
Detail Depth: ${detailLevel} -> ${detailInstructions[detailLevel] || detailInstructions.medium}

STRICT TEST CASE SCHEMA — Every test case MUST contain exactly these 9 fields:
- "id", "module", "title", "type", "priority", "preconditions", "steps", "expectedResult", "requirementId"

CRITICAL ASSUMPTION RULES:
1. You MUST list every assumption you make in the "assumptions" array
2. If you use a default value, state it explicitly
3. Format: "Assumed [what] as [value] because [reason]"

Return ONLY a JSON object with this exact structure:
{
  "assumptions": ["Explicit assumption 1", "Assumption 2"],
  "functional": [
    {
      "id": "TC_FUNC_001",
      "module": "Feature Module",
      "title": "Test case title",
      "type": "Functional",
      "priority": "High|Medium|Low",
      "preconditions": "Pre-conditions for this test",
      "steps": ["Step 1", "Step 2"],
      "expectedResult": "Expected result",
      "requirementId": "REQ_001"
    }
  ],
  "negative": [{ "id": "TC_NEG_001", "module": "Module", "title": "...", "type": "Negative", "priority": "...", "preconditions": "...", "steps": ["..."], "expectedResult": "...", "requirementId": "REQ_001" }],
  "edge": [{ "id": "TC_EDGE_001", "module": "Module", "title": "...", "type": "Edge", "priority": "...", "preconditions": "...", "steps": ["..."], "expectedResult": "...", "requirementId": "REQ_001" }],
  "apiChecklist": [{ "id": "TC_API_001", "module": "API Module", "title": "...", "type": "API", "priority": "High", "preconditions": "...", "steps": ["Check 1"], "expectedResult": "...", "requirementId": "REQ_API_001" }],
  "nonFunctional": [{ "id": "TC_NF_001", "module": "Module", "title": "...", "type": "Non-Functional", "priority": "...", "preconditions": "...", "steps": ["..."], "expectedResult": "...", "requirementId": "REQ_NF_001" }],
  "questions": ["Clarification question 1?"]
}

Generate comprehensive coverage across all categories.
CRITICAL FORMATTING INSTRUCTIONS for INDUSTRY STANDARD OUTPUT:
- Steps MUST use BDD formulation (Given/When/Then) or explicit setup/execution/verification formats.
- Preconditions go in the "preconditions" field, NOT as step 1.
- Expected Results must be formal pass/fail criteria.
- Expected Results must establish absolute, formal pass/fail criteria (e.g., "HTTP 200 OK with schema X", or "Button is disabled and red"). Do not use colloquial language.
- For API endpoints, validate headers, tokens, parameters, and payload schemas rigorously.
- IMPORTANT: Return ONLY valid JSON. START your response with '{' and END with '}'.
- DO NOT use markdown code blocks (like \`\`\`json).
- DO NOT include any preamble, introduction, or concluding text.`;
    }

    /**
     * Phase 3: Post-process test cases
     * @param {Object} testCases - Generated tests
     * @param {Object} understanding - Understanding
     * @param {Object} ambiguityAnalysis - Ambiguity
     * @param {Array} domains - Domains
     * @param {Object} config - Configuration
     * @returns {Object} Processed test suite
     */
    async postProcess(testCases, understanding, ambiguityAnalysis, domains, config = {}) {
        // Step 1: Validate and format assumptions
        logger.info('Validating assumptions');
        const withAssumptions = assumptionValidator.validate(testCases, understanding);

        // Step 2: Apply priority overrides
        logger.info('Applying priority overrides');
        const withPriorities = priorityEngine.processAllPriorities(
            withAssumptions,
            understanding,
            domains
        );

        // Step 3: Adjust confidence based on ambiguity
        logger.info('Calculating confidence scores');
        const withConfidence = confidenceScorer.adjustConfidenceByAmbiguity(
            withPriorities,
            ambiguityAnalysis.score
        );

        // Step 4: Calculate overall confidence
        const confidenceAnalysis = confidenceScorer.calculateCoverageConfidence(
            withConfidence,
            understanding,
            ambiguityAnalysis.score
        );

        // Step 5: Check domain coverage
        logger.info('Checking domain coverage');
        const withDomainCoverage = domainDetector.ensureMandatoryScenarios(
            withConfidence,
            understanding.mandatory_scenarios || []
        );

        // Step 6: Add persona-specific enhancements
        const persona = config.userPersona || 'default';
        let personaEnhanced = withDomainCoverage;

        if (persona && persona !== 'default') {
            logger.info('Applying persona enhancements', { persona });

            // Add persona-specific metadata
            personaEnhanced = personaMetadataEnhancer.enhanceWithPersonaMetadata(
                withDomainCoverage,
                persona,
                understanding
            );

            // Adapt messaging for persona
            personaEnhanced = personaMessagingAdapter.adaptMessaging(personaEnhanced, persona);

            // Validate safety rules
            const safetyCheck = personaSafetyValidator.validateSafety(personaEnhanced, persona);
            if (!safetyCheck.isValid) {
                logger.error('Persona safety validation failed', safetyCheck.violations);
                // Log but continue - safety warnings are informational
            }

            // Add safety check to metadata
            personaEnhanced.personaSafetyCheck = safetyCheck;
        }

        // Step 7: Compile final response
        const finalResponse = {
            // Original AI output
            understanding: {
                feature: understanding.feature,
                rules: understanding.business_rules || understanding.rules || [],
                inputs: understanding.inputs || [],
                outputs: understanding.outputs || [],
                ambiguities: understanding.ambiguities || []
            },

            // Quality metrics
            quality: {
                ambiguityScore: ambiguityAnalysis.level,
                ambiguityScoreNumeric: ambiguityAnalysis.score,
                coverageConfidence: confidenceAnalysis.overall_confidence,
                confidenceLevel: confidenceAnalysis.confidence_level,
                confidenceWarnings: ambiguityAnalysis.warnings,
                confidenceBreakdown: confidenceAnalysis.breakdown,
                confidenceByType: confidenceAnalysis.breakdown_by_type
            },

            // Assumptions
            assumptions: personaEnhanced.assumptions || [],
            assumptionSummary: personaEnhanced.assumption_summary,

            // Test cases
            functional: personaEnhanced.functional || [],
            negative: personaEnhanced.negative || [],
            edge: personaEnhanced.edge || [],
            apiChecklist: personaEnhanced.apiChecklist || personaEnhanced.api || [],
            nonFunctional: personaEnhanced.nonFunctional || [],

            // Clarification questions
            questions: [
                ...(personaEnhanced.questions || []),
                ...(understanding.clarification_questions?.questions || []).map(q => q.question)
            ],

            // Domain context
            domainContext: {
                detectedDomains: domains,
                primaryDomain: domains.length > 0 ? domains[0].domain : 'general',
                domainCoverage: personaEnhanced.domain_coverage
            },

            // Coverage gaps and warnings
            coverageGaps: personaEnhanced.coverage_gaps || [],
            warnings: personaEnhanced.warnings || [],
            recommendations: personaEnhanced.recommendations || confidenceAnalysis.recommendations,

            // Metadata
            metadata: {
                generatedAt: new Date().toISOString(),
                totalTestCases: this.countTotalTests(personaEnhanced),
                generationMethod: 'two_step_orchestration',
                version: '2.0',
                persona: persona !== 'default' ? persona : undefined
            }
        };

        // Add persona-specific summary metadata if present
        if (personaEnhanced.sdetMetadata) {
            finalResponse.sdetMetadata = personaEnhanced.sdetMetadata;
        }
        if (personaEnhanced.product_managerMetadata) {
            finalResponse.pmMetadata = personaEnhanced.product_managerMetadata;
        }
        if (personaEnhanced.fresherMetadata) {
            finalResponse.fresherMetadata = personaEnhanced.fresherMetadata;
        }

        return finalResponse;
    }

    /**
     * Validate understanding structure
     * @param {Object} understanding - Understanding object
     * @returns {Object} Validated understanding
     */
    validateUnderstanding(understanding) {
        // Ensure required fields exist
        return {
            feature: understanding.feature || 'Unnamed feature',
            business_rules: understanding.business_rules || understanding.rules || [],
            rules: understanding.business_rules || understanding.rules || [],
            inputs: understanding.inputs || [],
            outputs: understanding.outputs || [],
            risk_areas: understanding.risk_areas || [],
            non_functional_signals: understanding.non_functional_signals || {},
            ambiguities: understanding.ambiguities || [],
            missing_information: understanding.missing_information || []
        };
    }

    /**
     * Parse AI response (handle both JSON and text)
     * @param {string} response - AI response
     * @returns {Object} Parsed object
     */
    parseAIResponse(response) {
        if (!response || typeof response !== 'string') {
            throw new Error('Empty or invalid response from AI');
        }

        // Step 1: Extract JSON string from response
        let targetString = this.extractJSONString(response);

        // Step 2: Try progressively aggressive parsing strategies
        const strategies = [
            { name: 'direct', fn: (s) => JSON.parse(s) },
            { name: 'sanitized', fn: (s) => JSON.parse(this.sanitizeJSONString(s)) },
            { name: 'repaired', fn: (s) => JSON.parse(this.repairTruncatedJSON(this.sanitizeJSONString(s))) },
            { name: 'aggressive', fn: (s) => JSON.parse(this.aggressiveJSONRepair(s)) },
        ];

        for (const strategy of strategies) {
            try {
                const result = strategy.fn(targetString);
                if (strategy.name !== 'direct') {
                    logger.info(`JSON parsed successfully with strategy: ${strategy.name}`);
                }
                return result;
            } catch (err) {
                logger.warn(`JSON parse strategy '${strategy.name}' failed: ${err.message}`);
            }
        }

        // Step 3: Last resort — try to extract partial data
        logger.error('All JSON parse strategies failed, attempting partial extraction...');
        logger.error('Response preview:', targetString.substring(0, 500));
        const partial = this.extractPartialJSON(targetString);
        if (partial) {
            logger.warn('Returning partially extracted JSON data');
            return partial;
        }

        throw new Error(`Invalid JSON response from AI. All repair strategies failed. Preview: ${response.substring(0, 100).replace(/\n/g, ' ')}...`);
    }

    /**
     * Extract JSON string from AI response (handles markdown blocks, preamble, etc.)
     * @param {string} response - Raw AI response
     * @returns {string} Extracted JSON string
     */
    extractJSONString(response) {
        let str = response.trim();

        // Strategy 1: Look for markdown code blocks
        const markdownMatch = str.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (markdownMatch) {
            str = markdownMatch[1].trim();
        }

        // Strategy 2: Extract outermost JSON object using brace matching
        if (!str.startsWith('{')) {
            const firstBrace = str.indexOf('{');
            if (firstBrace !== -1) {
                str = str.substring(firstBrace);
            }
        }

        // Remove any trailing text after the last closing brace
        const lastBrace = str.lastIndexOf('}');
        if (lastBrace !== -1 && lastBrace < str.length - 1) {
            str = str.substring(0, lastBrace + 1);
        }

        return str;
    }

    /**
     * Sanitize a JSON string by fixing common AI response issues
     * @param {string} json - JSON string to sanitize
     * @returns {string} Sanitized JSON string
     */
    sanitizeJSONString(json) {
        let str = json;

        // Fix unescaped control characters inside string values
        // Replace literal tabs, carriage returns, form feeds, backspaces
        str = str.replace(/[\t]/g, '\\t');
        str = str.replace(/[\r]/g, '');
        str = str.replace(/[\f]/g, '\\f');
        str = str.replace(/[\b]/g, '\\b');

        // Fix unescaped newlines inside JSON string values
        // We rebuild the string, tracking whether we're inside a JSON string
        let result = '';
        let inString = false;
        let escaped = false;

        for (let i = 0; i < str.length; i++) {
            const ch = str[i];

            if (escaped) {
                result += ch;
                escaped = false;
                continue;
            }

            if (ch === '\\' && inString) {
                result += ch;
                escaped = true;
                continue;
            }

            if (ch === '"') {
                inString = !inString;
                result += ch;
                continue;
            }

            if (inString && ch === '\n') {
                result += '\\n';
                continue;
            }

            result += ch;
        }

        str = result;

        // Fix trailing commas before } or ]
        str = str.replace(/,\s*([\]}])/g, '$1');

        return str;
    }

    /**
     * Attempt to repair truncated JSON by closing unclosed brackets/braces
     * @param {string} json - Potentially truncated JSON string
     * @returns {string} Repaired JSON string
     */
    repairTruncatedJSON(json) {
        let str = json.trim();

        // Remove trailing comma if present
        str = str.replace(/,\s*$/, '');

        // Remove incomplete key-value pairs at the end
        // e.g., "someKey": "incomplete value without closing quote
        str = str.replace(/,\s*"[^"]*"?\s*:\s*"[^"]*$/g, '');
        // e.g., "someKey": [incomplete array
        str = str.replace(/,\s*"[^"]*"?\s*:\s*\[[^\]]*$/g, '');
        // e.g., trailing incomplete key without value
        str = str.replace(/,\s*"[^"]*$/, '');
        // e.g., `: "incomplete`
        str = str.replace(/:\s*"[^"]*$/, ': ""');

        // Remove trailing comma again after truncation cleanup
        str = str.replace(/,\s*$/, '');

        // Count unclosed brackets and braces
        let openBraces = 0;
        let openBrackets = 0;
        let inString = false;
        let escaped = false;

        for (let i = 0; i < str.length; i++) {
            const ch = str[i];
            if (escaped) { escaped = false; continue; }
            if (ch === '\\') { escaped = true; continue; }
            if (ch === '"') { inString = !inString; continue; }
            if (inString) continue;
            if (ch === '{') openBraces++;
            else if (ch === '}') openBraces--;
            else if (ch === '[') openBrackets++;
            else if (ch === ']') openBrackets--;
        }

        // If we ended inside a string, close it
        if (inString) {
            str += '"';
            // Recount after closing the string
            str = str.replace(/,\s*$/, '');
        }

        // Close any unclosed brackets and braces (in correct order)
        for (let i = 0; i < openBrackets; i++) str += ']';
        for (let i = 0; i < openBraces; i++) str += '}';

        // Final trailing comma cleanup
        str = str.replace(/,\s*([\]}])/g, '$1');

        return str;
    }

    /**
     * Aggressive JSON repair — handles deeply malformed responses
     * @param {string} json - Malformed JSON string
     * @returns {string} Repaired JSON string
     */
    aggressiveJSONRepair(json) {
        let str = this.sanitizeJSONString(json);

        // Remove any non-JSON content before the first {
        const firstBrace = str.indexOf('{');
        if (firstBrace > 0) {
            str = str.substring(firstBrace);
        }

        // Try to find balanced JSON by walking character by character
        let depth = 0;
        let inString = false;
        let escaped = false;
        let endPos = -1;

        for (let i = 0; i < str.length; i++) {
            const ch = str[i];
            if (escaped) { escaped = false; continue; }
            if (ch === '\\' && inString) { escaped = true; continue; }
            if (ch === '"') { inString = !inString; continue; }
            if (inString) continue;
            if (ch === '{' || ch === '[') depth++;
            else if (ch === '}' || ch === ']') {
                depth--;
                if (depth === 0) {
                    endPos = i;
                    break;
                }
            }
        }

        // If we found a balanced JSON object, use it
        if (endPos !== -1) {
            str = str.substring(0, endPos + 1);
        } else {
            // Otherwise, repair the truncated version
            str = this.repairTruncatedJSON(str);
        }

        return str;
    }

    /**
     * Last resort: Extract partial data from malformed JSON
     * @param {string} json - Malformed JSON string
     * @returns {Object|null} Partially extracted data or null
     */
    extractPartialJSON(json) {
        try {
            const sanitized = this.sanitizeJSONString(json);
            const result = {};

            // Try to extract top-level arrays by key name
            const arrayKeys = ['assumptions', 'functional', 'negative', 'edge', 'apiChecklist', 'nonFunctional', 'questions'];

            for (const key of arrayKeys) {
                const regex = new RegExp(`"${key}"\\s*:\\s*\\[`, 'g');
                const match = regex.exec(sanitized);
                if (match) {
                    // Find the matching closing bracket
                    const startIdx = match.index + match[0].length;
                    let depth = 1;
                    let inStr = false;
                    let esc = false;
                    let endIdx = -1;

                    for (let i = startIdx; i < sanitized.length && depth > 0; i++) {
                        const ch = sanitized[i];
                        if (esc) { esc = false; continue; }
                        if (ch === '\\' && inStr) { esc = true; continue; }
                        if (ch === '"') { inStr = !inStr; continue; }
                        if (inStr) continue;
                        if (ch === '[') depth++;
                        else if (ch === ']') {
                            depth--;
                            if (depth === 0) endIdx = i;
                        }
                    }

                    if (endIdx !== -1) {
                        const arrayStr = sanitized.substring(startIdx, endIdx);
                        try {
                            result[key] = JSON.parse('[' + arrayStr + ']');
                        } catch (e) {
                            // Try repair on the array content
                            try {
                                const repairedArray = this.repairTruncatedJSON('[' + arrayStr + ']');
                                result[key] = JSON.parse(repairedArray);
                            } catch (e2) {
                                // Skip this key
                            }
                        }
                    }
                }
            }

            return Object.keys(result).length > 0 ? result : null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Count total test cases
     * @param {Object} testCases - Test cases object
     * @returns {number} Total count
     */
    countTotalTests(testCases) {
        let total = 0;
        ['functional', 'negative', 'edge', 'nonFunctional', 'apiChecklist'].forEach(category => {
            if (testCases[category] && Array.isArray(testCases[category])) {
                total += testCases[category].length;
            }
        });
        return total;
    }

    /**
     * Generate fallback test cases when AI call fails.
     * Derives basic but useful test cases from the requirement text.
     * @param {string} requirement - Original requirement text
     * @param {Object} config - Configuration
     * @returns {Object} Fallback test case structure
     */
    generateFallbackTestCases(requirement, config = {}) {
        logger.info('Generating fallback test cases from requirement text');

        // Extract meaningful keywords from the requirement
        const words = requirement.toLowerCase().split(/\s+/);
        const actionWords = words.filter(w => 
            ['login', 'register', 'create', 'delete', 'update', 'search', 'filter', 
             'submit', 'upload', 'download', 'send', 'receive', 'add', 'remove',
             'edit', 'view', 'display', 'click', 'select', 'enter', 'navigate',
             'checkout', 'pay', 'order', 'book', 'cancel', 'reset', 'verify',
             'validate', 'authenticate', 'authorize', 'export', 'import', 'save',
             'load', 'fetch', 'process', 'generate', 'calculate', 'convert'].includes(w)
        );

        const featureName = requirement.substring(0, 60).replace(/[^a-zA-Z0-9\s]/g, '').trim();
        const mainAction = actionWords.length > 0 ? actionWords[0] : 'process';

        return {
            feature: featureName || 'Feature Under Test',
            business_rules: [`The system should ${mainAction} as described in the requirement`],
            inputs: [{ name: 'user_input', type: 'string', constraints: 'As per requirement' }],
            outputs: [{ name: 'result', type: 'object', structure: 'Expected output' }],
            risk_areas: ['input_validation', 'error_handling'],
            non_functional_signals: { performance_critical: false, security_sensitive: true, user_facing: true },
            ambiguities: ['Some details may need clarification from the requirement'],
            missing_information: [],
            assumptions: [
                'Assumed standard validation rules apply',
                'Assumed the feature requires authentication',
                'Note: These are AI-fallback test cases. Try regenerating for more detailed results.'
            ],
            functional: [
                {
                    id: 'TC_FUNC_001',
                    title: `Verify successful ${mainAction} with valid data`,
                    priority: 'High',
                    steps: [
                        'Navigate to the feature page',
                        'Enter valid input data as per the requirement',
                        `Click the ${mainAction} button or trigger the action`,
                        'Observe the system response'
                    ],
                    expectedResult: `The system should successfully ${mainAction} and show a confirmation`,
                    reason: 'Core happy path validation',
                    riskType: 'Revenue',
                    priorityExplanation: 'Primary success path must work correctly',
                    intentGroup: 'Success'
                },
                {
                    id: 'TC_FUNC_002',
                    title: `Verify ${mainAction} result is displayed correctly`,
                    priority: 'High',
                    steps: [
                        `Complete the ${mainAction} action with valid data`,
                        'Check the response/result displayed on screen',
                        'Verify all expected fields are present',
                        'Verify data accuracy'
                    ],
                    expectedResult: 'All result data should be displayed accurately and completely',
                    reason: 'Output validation is critical for user trust',
                    riskType: 'UX',
                    priorityExplanation: 'Users must see correct results',
                    intentGroup: 'Validation'
                },
                {
                    id: 'TC_FUNC_003',
                    title: `Verify ${mainAction} with all required fields filled`,
                    priority: 'Medium',
                    steps: [
                        'Navigate to the feature',
                        'Fill in all required fields with valid data',
                        `Perform the ${mainAction} action`,
                        'Verify successful completion'
                    ],
                    expectedResult: 'The action should complete successfully with all required fields provided',
                    reason: 'Ensures all required field validations work',
                    intentGroup: 'Validation'
                }
            ],
            negative: [
                {
                    id: 'TC_NEG_001',
                    title: `Verify ${mainAction} fails with empty required fields`,
                    priority: 'High',
                    steps: [
                        'Navigate to the feature',
                        'Leave all required fields empty',
                        `Attempt to ${mainAction}`,
                        'Observe error handling'
                    ],
                    expectedResult: 'System should display appropriate validation error messages for each empty required field',
                    reason: 'Empty field handling is a top failure scenario',
                    intentGroup: 'Validation'
                },
                {
                    id: 'TC_NEG_002',
                    title: `Verify ${mainAction} with invalid/malformed input`,
                    priority: 'Medium',
                    steps: [
                        'Navigate to the feature',
                        'Enter invalid data (special characters, wrong format)',
                        `Attempt to ${mainAction}`,
                        'Observe error handling'
                    ],
                    expectedResult: 'System should reject invalid input with clear, user-friendly error messages',
                    reason: 'Invalid input is a common real-world scenario',
                    intentGroup: 'Error Handling'
                }
            ],
            edge: [
                {
                    id: 'TC_EDGE_001',
                    title: `Verify ${mainAction} with boundary value inputs`,
                    priority: 'Medium',
                    steps: [
                        'Navigate to the feature',
                        'Enter minimum allowed values for all fields',
                        `Perform the ${mainAction} action`,
                        'Repeat with maximum allowed values'
                    ],
                    expectedResult: 'System should handle both minimum and maximum boundary values correctly',
                    reason: 'Boundary conditions often reveal bugs',
                    intentGroup: 'Boundary'
                },
                {
                    id: 'TC_EDGE_002',
                    title: `Verify rapid repeated ${mainAction} actions`,
                    priority: 'Low',
                    steps: [
                        'Navigate to the feature',
                        `Click ${mainAction} button multiple times rapidly`,
                        'Observe system behavior',
                        'Check for duplicate submissions or errors'
                    ],
                    expectedResult: 'System should handle rapid clicks gracefully without duplicate processing',
                    reason: 'Double-submit is a common user behavior',
                    intentGroup: 'Concurrency'
                }
            ],
            apiChecklist: [
                {
                    id: 'TC_API_001',
                    title: `Verify API endpoint for ${mainAction}`,
                    priority: 'High',
                    steps: [
                        `Send POST request to ${mainAction} endpoint with valid payload`,
                        'Verify response status code is 200 or 201',
                        'Verify response payload matches expected schema'
                    ],
                    expectedResult: 'API should return success status code and correct schema structure',
                    reason: 'API contract validation is critical for frontend integration'
                }
            ],
            nonFunctional: [
                {
                    id: 'TC_NF_001',
                    title: `Verify ${mainAction} response time is acceptable`,
                    priority: 'Medium',
                    steps: [
                        `Perform the ${mainAction} action with valid data`,
                        'Measure the response time',
                        'Verify it completes within acceptable time limits'
                    ],
                    expectedResult: 'The action should complete within 3 seconds under normal conditions',
                    reason: 'Performance directly affects user experience'
                }
            ],
            questions: [
                'What are the exact validation rules for each input field?',
                'What error messages should be shown for different failure scenarios?',
                'Are there any rate limits or usage restrictions for this feature?'
            ]
        };
    }
}

module.exports = new TwoStepOrchestrator();
