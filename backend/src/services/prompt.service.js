// Production-Ready Prompt Templates for Test Case Generation
// Supports: Functional, Non-Functional, API, Mixed, and Regeneration modes

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
- Output MUST be valid JSON only. No explanations outside JSON.`;

// ============================================
// 1️⃣ FUNCTIONAL TEST FOCUS PROMPT
// ============================================
const buildFunctionalFocusPrompt = (requirement) => {
  return `Analyze the following requirement and generate ONLY FUNCTIONAL test cases.

Instructions:
- Focus on happy paths and core user workflows.
- Exclude performance, security, and non-functional tests.
- Include negative functional scenarios (invalid inputs).
- Each test case must include:
  - id
  - title
  - priority (High / Medium / Low)
  - steps (array)
  - expectedResult
  - reason (why this test exists)

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
    {
      "id": "TC_FUNC_001",
      "title": "Test case title",
      "priority": "High|Medium|Low",
      "steps": ["Step 1", "Step 2"],
      "expectedResult": "Expected result",
      "reason": "Why this test exists",
      "riskType": "Revenue|Security|UX",
      "priorityExplanation": "For High priority only",
      "intentGroup": "Validation|Success|Security|UX"
    }
  ],
  "negative": [
    {
      "id": "TC_NEG_001",
      "title": "Negative test title",
      "priority": "High|Medium|Low",
      "steps": ["Step 1"],
      "expectedResult": "Expected error",
      "reason": "Why this test exists",
      "riskType": "Revenue|Security|UX",
      "priorityExplanation": "For High priority only",
      "intentGroup": "Validation|Success|Security|UX"
    }
  ],
  "edge": [
    {
      "id": "TC_EDGE_001",
      "title": "Edge case title",
      "priority": "Medium|Low",
      "steps": ["Step 1"],
      "expectedResult": "Expected behavior",
      "reason": "Why this test exists",
      "riskType": "Revenue|Security|UX",
      "intentGroup": "Validation|Success|Security|UX"
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
- Focus strictly on quality attributes.

Group test cases into the following categories:
- Performance
- Security
- Reliability & Recovery
- Usability
- Scalability

For each test case include:
- id
- category
- title
- priority (High / Medium / Low)
- scenario (clear description)
- expectedOutcome
- reason (why this test exists)

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
      "id": "TC_NF_PERF_001",
      "category": "Performance",
      "title": "Test case title",
      "priority": "High|Medium|Low",
      "scenario": "Clear description of the test scenario",
      "expectedOutcome": "Expected performance metric or behavior",
      "reason": "Why this test exists",
      "riskType": "Revenue|Security|UX",
      "priorityExplanation": "For High priority only"
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
- Each test case must include:
  - id
  - title
  - priority (High / Medium / Low)
  - steps or scenario
  - expectedResult
  - reason (why this test exists)

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
      "title": "API test case title",
      "priority": "High|Medium|Low",
      "checkpoints": ["Checkpoint 1", "Checkpoint 2"],
      "expectedResult": "Expected API response",
      "reason": "Why this test exists",
      "riskType": "Revenue|Security|UX",
      "priorityExplanation": "For High priority only"
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
- Functional
- Negative
- Edge / Boundary
- API Validation (if applicable)
- Non-Functional (Performance, Security, Reliability)

Rules:
- Prioritize business-critical and risk-heavy areas.
- Avoid duplicate or overlapping scenarios.
- Assign realistic priorities based on impact.

Each test case must include:
- id
- type (Functional / Negative / Edge / API / Non-Functional)
- title
- priority
- steps or scenario
- expectedResult
- reason

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
      "title": "...", 
      "priority": "High|Medium|Low", 
      "steps": ["..."], 
      "expectedResult": "...", 
      "testData": {}, 
      "reason": "Why this test exists", 
      "riskType": "Revenue|Security|UX",
      "priorityExplanation": "Briefly why High (only for High)",
      "intentGroup": "Validation|Success|Security|UX"
    }
  ],
  "negative": [
    { "id": "TC_NEG_001", "title": "...", "priority": "High|Medium|Low", "steps": ["..."], "expectedResult": "...", "testData": {}, "reason": "...", "riskType": "...", "priorityExplanation": "...", "intentGroup": "..." }
  ],
  "edge": [
    { "id": "TC_EDGE_001", "title": "...", "priority": "Medium|Low", "steps": ["..."], "expectedResult": "...", "testData": {}, "reason": "...", "riskType": "...", "priorityExplanation": "...", "intentGroup": "..." }
  ],
  "apiChecklist": [
    { "id": "TC_API_001", "title": "...", "priority": "High|Medium", "checkpoints": ["..."] }
  ],
  "nonFunctional": [
    { "id": "TC_NF_001", "title": "...", "category": "Performance|Security|Usability|Reliability", "priority": "High|Medium|Low", "expectedOutcome": "...", "testData": {} }
  ],
  "questions": ["specific clarification question 1", "question 2"]
}

Instructions:
1. ${detailInstructions[detailLevel]}.
2. Generate 3-5 non-functional test cases.
3. ${appType === 'api' ? 'Include detailed API checklist.' : 'API checklist can be minimal or empty for UI apps.'}
4. For each test case, Provide:
   - "riskType": The primary area of impact (Revenue, Security, or UX).
   - "intentGroup": A grouping for better readability (e.g., "Success Flows", "Validation Errors", "Security Guardrails").
   - "priorityExplanation": For HIGH priority cases, provide a 1-line business impact statement (e.g., "Failure directly impacts transaction revenue").
5. "assumptions": Explicitly list any assumptions made because of vague or missing info.
6. "confidenceWarnings": Specific warnings for the user where coverage might be weak or assumptions are heavy.`;
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

Return:
- updatedTestCases (complete updated test suite)
- changesSummary (array of improvements made)
- updatedCoverageConfidence
- updatedAmbiguityScore
- assumptions (if any)

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
  "functional": [...],
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
