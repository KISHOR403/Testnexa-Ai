/**
 * Persona Prompt Adapter Service
 * Modifies prompts based on user persona to adapt AI reasoning emphasis
 */

class PersonaPromptAdapter {
    constructor() {
        this.personaEnhancements = {
            sdet: this.getSdetEnhancement(),
            product_manager: this.getPMEnhancement(),
            fresher: this.getFresherEnhancement()
        };
    }

    /**
     * Adapt prompt based on persona
     * @param {string} basePrompt - Base prompt
     * @param {string} persona - User persona
     * @returns {string} Enhanced prompt
     */
    adaptPrompt(basePrompt, persona) {
        if (!persona || persona === 'default') {
            return basePrompt;
        }

        const enhancement = this.personaEnhancements[persona];
        if (!enhancement) {
            return basePrompt;
        }

        // Inject persona instructions before the main prompt
        return `${enhancement}\n\n${basePrompt}`;
    }

    getSdetEnhancement() {
        return `PERSONA: SDET (Automation Engineer)

OUTPUT REQUIREMENTS:
- For each test case, include "automationFeasibility": "High|Medium|Low"
- Add "executionPrerequisites": ["prerequisite 1", "prerequisite 2"]
- Flag "isFlaky": true/false for timing/environment-dependent tests
- Include "automationNotes": "Technical considerations for automation"
- Prioritize API-level tests over UI-only tests
- Use technical terminology (status codes, response schemas, error codes)
- Focus on test independence and repeatability

EMPHASIS:
- Automation readiness and feasibility
- Technical precision over explanation
- Test stability and maintainability
- API coverage and contract validation
- Clear execution prerequisites`;
    }

    getPMEnhancement() {
        return `PERSONA: Product Manager

OUTPUT REQUIREMENTS:
- For each test case, include "businessImpact": "Revenue|UX|Compliance|Reputation"
- Add "userScenarioMapping": "Which user journey this validates"
- Include "riskIfFails": "Business consequences of failure"
- Use business-oriented language (user impact, conversion, risk)
- Highlight missing acceptance criteria
- Focus on user-facing scenarios

EMPHASIS:
- Business risk and impact
- Requirement completeness and gaps
- User-facing scenarios and journeys
- Acceptance criteria clarity
- Compliance and regulatory concerns`;
    }

    getFresherEnhancement() {
        return `PERSONA: QA Fresher (Learning Mode)

OUTPUT REQUIREMENTS:
- Generate FEWER test cases (max 10-12 total, focus on quality over quantity)
- For each test case, include "learningNote": "Why this test is important"
- Add "testingConceptUsed": "Boundary Testing|Negative Testing|Happy Path|etc."
- Include "conceptExplanation": "Brief explanation of the testing concept"
- Use simple, clear language without jargon
- Provide detailed, step-by-step test steps
- Focus on fundamental scenarios before advanced edge cases

EMPHASIS:
- Learning and understanding
- Clarity over completeness
- Foundational test scenarios
- Concept explanations and educational value
- Simplified priority reasoning`;
    }
}

module.exports = new PersonaPromptAdapter();
