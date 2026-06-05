// Production-Ready Prompt Templates for Test Case Generation
// Supports: Functional, Non-Functional, API, Mixed, and Regeneration modes
// Schema v2: Strict JSON with id, module, title, type, priority, preconditions, steps[], expectedResult, requirementId

// ============================================
// STRICT TEST CASE SCHEMA (shared across all prompts)
// ============================================
const TEST_CASE_SCHEMA_EXAMPLE = `{
  "id": "TC_FUNC_001",
  "module": "Login",
  "title": "Verify successful login with valid credentials",
  "type": "Functional",
  "priority": "High",
  "preconditions": "User has a registered account; application is accessible",
  "steps": [
    "Navigate to the login page",
    "Enter a valid registered email address",
    "Enter the correct password",
    "Click the Login button"
  ],
  "expectedResult": "User is redirected to the dashboard; a valid session token is issued",
  "requirementId": "REQ_001"
}`;

// ============================================
// BASE SYSTEM PROMPT (COMMON FOR ALL)
// ============================================
const SYSTEM_PROMPT = `You are a senior QA architect and SDET with deep industry experience.
Your task is to design high-quality, realistic, execution-ready test cases strictly following industry standards (e.g., ISTQB, IEEE 829, BDD).

Rules:
- ALL generated output MUST be industry standard.
- Use professional terminology, rigorous boundaries, and formal constraints.
- Steps MUST use precise, actionable language (like Given/When/Then or explicit procedural steps).
- Do NOT invent features.
- Do NOT assume unspecified behavior silently.
- If assumptions are required, explicitly mention them.
- Prefer clarity, structure, and testability.
- Expected results must have unambiguous pass/fail criteria.
- Think like a real QA engineer working in Agile teams.
- Output MUST be valid JSON only. No explanations outside JSON.

STRICT TEST CASE SCHEMA — Every test case object MUST have exactly these fields:
- "id": string (e.g. "TC_FUNC_001", "TC_NEG_002")
- "module": string (the feature module this test belongs to, e.g. "Login", "Payment", "Registration")
- "title": string (concise test case title)
- "type": string (one of: "Functional", "Negative", "Edge", "API", "Non-Functional")
- "priority": string (one of: "High", "Medium", "Low")
- "preconditions": string (pre-conditions that must be met before execution)
- "steps": array of strings (ordered execution steps)
- "expectedResult": string (unambiguous pass/fail criteria)
- "requirementId": string (traceability ID linking back to the requirement, e.g. "REQ_001")`;

// ============================================
// 1️⃣ FUNCTIONAL TEST FOCUS PROMPT
// ============================================
const buildFunctionalFocusPrompt = (requirement) => {
  return `Analyze the following requirement and generate ONLY FUNCTIONAL test cases.

Instructions:
- Focus on happy paths and core user workflows.
- Exclude performance, security, and non-functional tests.
- Include negative functional scenarios (invalid inputs).
- Every test case MUST follow the strict schema with all 9 fields: id, module, title, type, priority, preconditions, steps, expectedResult, requirementId.

Also return:
- ambiguityScore: Low | Medium | High
- coverageConfidence: number (0–100)
- assumptions: array (if any)

Requirement:
${requirement}

Return ONLY a JSON object with this exact structure:
{
  "understanding": {
    "feature": "Brief feature name",
    "rules": ["business rule 1", "rule 2"],
    "inputs": ["input 1"],
    "outputs": ["output 1"],
    "ambiguities": ["any vague terms if any"]
  },
  "quality": {
    "ambiguityScore": "Low|Medium|High",
    "coverageConfidence": 0-100,
    "confidenceWarnings": ["warning if any"]
  },
  "assumptions": ["Assumption 1", "Assumption 2"],
  "functional": [
    ${TEST_CASE_SCHEMA_EXAMPLE}
  ],
  "negative": [
    {
      "id": "TC_NEG_001",
      "module": "Login",
      "title": "Verify error on invalid password",
      "type": "Negative",
      "priority": "High",
      "preconditions": "User has a registered account",
      "steps": ["Navigate to login", "Enter valid email", "Enter wrong password", "Click Login"],
      "expectedResult": "Error message displayed: 'Invalid credentials'",
      "requirementId": "REQ_001"
    }
  ],
  "edge": [
    {
      "id": "TC_EDGE_001",
      "module": "Login",
      "title": "Verify login with boundary-length password",
      "type": "Edge",
      "priority": "Medium",
      "preconditions": "User account exists with minimum-length password",
      "steps": ["Navigate to login", "Enter valid email", "Enter 8-char password", "Click Login"],
      "expectedResult": "Login succeeds if password matches",
      "requirementId": "REQ_001"
    }
  ],
  "questions": ["Clarification question 1?", "Question 2?"]
}`;
};

// ============================================
// 2️⃣ NON-FUNCTIONAL TEST FOCUS PROMPT
// ============================================
const buildNonFunctionalFocusPrompt = (requirement) => {
  return `Analyze the following requirement and generate ONLY NON-FUNCTIONAL test scenarios.

IMPORTANT:
- Do NOT generate functional happy-path flows.
- Do NOT include UI navigation steps unless required for context.
- Focus strictly on quality attributes: Performance, Security, Reliability & Recovery, Usability, Scalability.
- Every test case MUST follow the strict schema with all 9 fields: id, module, title, type, priority, preconditions, steps, expectedResult, requirementId.
- Set "type" to "Non-Functional" for all test cases.

Also return:
- ambiguityScore: Low | Medium | High
- coverageConfidence: number (0–100)
- assumptions: array (explicit assumptions made)

Requirement:
${requirement}

Return ONLY a JSON object with this exact structure:
{
  "understanding": {
    "feature": "Brief feature name",
    "rules": ["business rule 1", "rule 2"],
    "inputs": ["input 1"],
    "outputs": ["output 1"],
    "ambiguities": ["any vague terms if any"]
  },
  "quality": {
    "ambiguityScore": "Low|Medium|High",
    "coverageConfidence": 0-100,
    "confidenceWarnings": ["warning if any"]
  },
  "assumptions": ["Assumption 1", "Assumption 2"],
  "nonFunctional": [
    {
      "id": "TC_NF_001",
      "module": "Login",
      "title": "Verify login page loads within 2 seconds under normal load",
      "type": "Non-Functional",
      "priority": "High",
      "preconditions": "Application is deployed to staging; network latency < 50ms",
      "steps": ["Open browser", "Navigate to login URL", "Measure page load time"],
      "expectedResult": "Page fully renders within 2 seconds (LCP < 2s)",
      "requirementId": "REQ_NF_001"
    }
  ],
  "questions": ["Clarification question 1?", "Question 2?"]
}`;
};

// ============================================
// 3️⃣ API TEST FOCUS PROMPT
// ============================================
const buildAPIFocusPrompt = (requirement) => {
  return `Analyze the following requirement and generate ONLY API-LEVEL test cases.

Instructions:
- Focus on integration, contracts, and backend validations.
- Exclude UI-level functional tests.
- Include API error handling and edge cases.
- Every test case MUST follow the strict schema with all 9 fields: id, module, title, type, priority, preconditions, steps, expectedResult, requirementId.
- Set "type" to "API" for all test cases.

Also return:
- ambiguityScore: Low | Medium | High
- coverageConfidence: number (0–100)
- assumptions: array (if any)

Requirement:
${requirement}

Return ONLY a JSON object with this exact structure:
{
  "understanding": {
    "feature": "Brief feature name",
    "rules": ["business rule 1", "rule 2"],
    "inputs": ["input 1"],
    "outputs": ["output 1"],
    "ambiguities": ["any vague terms if any"]
  },
  "quality": {
    "ambiguityScore": "Low|Medium|High",
    "coverageConfidence": 0-100,
    "confidenceWarnings": ["warning if any"]
  },
  "assumptions": ["Assumption 1", "Assumption 2"],
  "apiChecklist": [
    {
      "id": "TC_API_001",
      "module": "Auth API",
      "title": "POST /api/v1/login — valid credentials return 200 with JWT",
      "type": "API",
      "priority": "High",
      "preconditions": "API server is running; test user exists in database",
      "steps": ["Send POST to /api/v1/login with valid email and password", "Verify response status is 200", "Verify response body contains 'token' field", "Verify token is a valid JWT"],
      "expectedResult": "HTTP 200 OK; response contains valid JWT token and user object",
      "requirementId": "REQ_API_001"
    }
  ],
  "questions": ["Clarification question 1?", "Question 2?"]
}`;
};

// ============================================
// 4️⃣ MIXED MODE PROMPT (DEFAULT / FULL COVERAGE)
// ============================================
const buildMixedFocusPrompt = (requirement, appType, detailLevel) => {
  const detailInstructions = {
    basic: '3-5 functional, 3-5 negative, 3-4 edge cases',
    medium: '5-8 functional, 5-8 negative, 4-6 edge cases',
    detailed: '8-12 functional, 8-12 negative, 6-8 edge cases',
  };

  return `Analyze the following requirement and generate a COMPLETE test suite.

Generate test cases across these categories:
- Functional (set type = "Functional")
- Negative (set type = "Negative")
- Edge / Boundary (set type = "Edge")
- API Validation (set type = "API") — if applicable
- Non-Functional (set type = "Non-Functional") — Performance, Security, Reliability

Rules:
- Prioritize business-critical and risk-heavy areas.
- Avoid duplicate or overlapping scenarios.
- Assign realistic priorities based on impact.
- EVERY test case MUST follow the strict schema with ALL 9 fields: id, module, title, type, priority, preconditions, steps, expectedResult, requirementId.

Also return:
- ambiguityScore: Low | Medium | High
- coverageConfidence: number (0–100)
- assumptions: array
- clarificationQuestions: array (if requirement is unclear)

Requirement:
${requirement}

Application Type: ${appType}
Detail Level: ${detailLevel}

Return ONLY a JSON object with this exact structure:
{
  "understanding": {
    "feature": "Brief feature name",
    "rules": ["business rule 1", "rule 2"],
    "inputs": ["input 1"],
    "outputs": ["output 1"],
    "ambiguities": ["any vague terms if any"]
  },
  "quality": {
    "ambiguityScore": "Low|Medium|High",
    "coverageConfidence": 0-100,
    "confidenceWarnings": ["e.g., 'Some security assumptions were made'"]
  },
  "assumptions": ["Implicit assumption 1", "Assumed rule 2"],
  "functional": [
    {
      "id": "TC_FUNC_001",
      "module": "Feature Module",
      "title": "Test case title",
      "type": "Functional",
      "priority": "High|Medium|Low",
      "preconditions": "Pre-conditions for this test",
      "steps": ["Step 1", "Step 2"],
      "expectedResult": "Expected result with clear pass/fail criteria",
      "requirementId": "REQ_001"
    }
  ],
  "negative": [
    {
      "id": "TC_NEG_001",
      "module": "Feature Module",
      "title": "Negative test title",
      "type": "Negative",
      "priority": "High|Medium|Low",
      "preconditions": "Pre-conditions",
      "steps": ["Step 1"],
      "expectedResult": "Expected error behavior",
      "requirementId": "REQ_001"
    }
  ],
  "edge": [
    {
      "id": "TC_EDGE_001",
      "module": "Feature Module",
      "title": "Edge case title",
      "type": "Edge",
      "priority": "Medium|Low",
      "preconditions": "Pre-conditions",
      "steps": ["Step 1"],
      "expectedResult": "Expected boundary behavior",
      "requirementId": "REQ_001"
    }
  ],
  "apiChecklist": [
    {
      "id": "TC_API_001",
      "module": "API Module",
      "title": "API test title",
      "type": "API",
      "priority": "High|Medium",
      "preconditions": "API server running; auth token available",
      "steps": ["Send request", "Verify status code", "Verify response schema"],
      "expectedResult": "HTTP 200 with valid response",
      "requirementId": "REQ_API_001"
    }
  ],
  "nonFunctional": [
    {
      "id": "TC_NF_001",
      "module": "Feature Module",
      "title": "Non-functional test title",
      "type": "Non-Functional",
      "priority": "High|Medium|Low",
      "preconditions": "Pre-conditions for NFR test",
      "steps": ["Step 1"],
      "expectedResult": "Expected performance/security metric",
      "requirementId": "REQ_NF_001"
    }
  ],
  "questions": ["specific clarification question 1", "question 2"]
}

Instructions:
1. ${detailInstructions[detailLevel]}.
2. Generate 3-5 non-functional test cases.
3. ${appType === 'api' ? 'Include detailed API checklist.' : 'API checklist can be minimal or empty for UI apps.'}
4. "assumptions": Explicitly list any assumptions made because of vague or missing info.
5. "confidenceWarnings": Specific warnings for the user where coverage might be weak or assumptions are heavy.`;
};

// ============================================
// 5️⃣ REGENERATION PROMPT
// ============================================
const buildRegenerationPrompt = (requirement, previousSummary, userRefinement, focusAreas, testType) => {
  const focusAreasText = focusAreas && focusAreas.length > 0
    ? focusAreas.join(', ')
    : 'No specific focus areas selected';

  const testTypeInstruction = testType === 'non_functional'
    ? 'Focus ONLY on non-functional test scenarios. Do NOT generate functional happy-path flows.'
    : testType === 'functional'
      ? 'Focus ONLY on functional test scenarios. Do NOT generate non-functional tests.'
      : testType === 'api'
        ? 'Focus ONLY on API-level integration tests. Do NOT generate UI-level functional tests.'
        : 'Generate comprehensive coverage across all test types.';

  return `You previously generated test cases for this requirement.

Original Requirement:
${requirement}

Previous Output Summary:
${previousSummary}

User Refinement Instructions:
${userRefinement || 'No specific refinement instructions provided'}

User Focus Areas:
${focusAreasText}

Test Type Focus:
${testType || 'mixed'}

Instructions:
- Improve the test suite based on user feedback.
- Do NOT regenerate everything blindly.
- Expand only the requested areas.
- Keep previously valid test cases stable.
- Explicitly mention what changed.
- ${testTypeInstruction}
- EVERY test case MUST follow the strict schema with ALL 9 fields: id, module, title, type, priority, preconditions, steps, expectedResult, requirementId.

Return ONLY a JSON object with this exact structure:
{
  "understanding": {
    "feature": "Brief feature name",
    "rules": ["business rule 1", "rule 2"],
    "inputs": ["input 1"],
    "outputs": ["output 1"],
    "ambiguities": ["any vague terms if any"]
  },
  "quality": {
    "ambiguityScore": "Low|Medium|High",
    "coverageConfidence": 0-100,
    "confidenceWarnings": ["warning if any"]
  },
  "assumptions": ["Assumption 1", "Assumption 2"],
  "functional": [
    {
      "id": "TC_FUNC_001",
      "module": "Module Name",
      "title": "Test title",
      "type": "Functional",
      "priority": "High",
      "preconditions": "Pre-conditions",
      "steps": ["Step 1"],
      "expectedResult": "Expected result",
      "requirementId": "REQ_001"
    }
  ],
  "negative": [...],
  "edge": [...],
  "apiChecklist": [...],
  "nonFunctional": [...],
  "changesSummary": [
    "Added 8 performance test cases",
    "Expanded security coverage",
    "Updated CVV validation assumptions"
  ],
  "questions": ["Clarification question 1?"]
}

Output JSON only.`;
};

// ============================================
// LEGACY UNIFIED PROMPT (BACKWARD COMPATIBILITY)
// ============================================
const buildUnifiedPrompt = (requirement, appType, detailLevel) => {
  return buildMixedFocusPrompt(requirement, appType, detailLevel);
};

// ============================================
// MAIN PROMPT BUILDER
// ============================================
const buildPrompt = (options) => {
  const {
    requirement,
    appType = 'web',
    detailLevel = 'medium',
    testFocus = 'mixed',
    isRegeneration = false,
    previousSummary = '',
    userRefinement = '',
    focusAreas = [],
  } = options;

  // If regeneration, use regeneration prompt
  if (isRegeneration) {
    return buildRegenerationPrompt(
      requirement,
      previousSummary,
      userRefinement,
      focusAreas,
      testFocus
    );
  }

  // Otherwise, select prompt based on testFocus
  switch (testFocus) {
    case 'functional':
      return buildFunctionalFocusPrompt(requirement);

    case 'non_functional':
      return buildNonFunctionalFocusPrompt(requirement);

    case 'api':
      return buildAPIFocusPrompt(requirement);

    case 'mixed':
    default:
      return buildMixedFocusPrompt(requirement, appType, detailLevel);
  }
};

// ============================================
// EXPORTS
// ============================================
module.exports = {
  SYSTEM_PROMPT,
  buildPrompt,
  buildFunctionalFocusPrompt,
  buildNonFunctionalFocusPrompt,
  buildAPIFocusPrompt,
  buildMixedFocusPrompt,
  buildRegenerationPrompt,
  // Legacy exports for backward compatibility
  buildUnifiedPrompt,
};
