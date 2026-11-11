import React from 'react';
import Hero from '../components/Hero';
import RequirementTransformation from '../components/RequirementTransformation';
import InteractiveTimelineSection from '../components/InteractiveTimelineSection';
import TypographicStatement from '../components/TypographicStatement';
import IntegrationsChapter from '../components/IntegrationsChapter';
import FinalCTA from '../components/FinalCTA';
import GlobalWorkflowIndicator from '../components/GlobalWorkflowIndicator';

const GeneratorPage = () => {
    return (
        <div className="home-page tn-marketing-root">
            {/* Subtle Vertical Workflow Indicator connecting chapters */}
            <GlobalWorkflowIndicator />

            {/* Hero: Problem framing, core value proposition & authentic product canvas (PRESERVED EXACTLY) */}
            <Hero />

            {/* 1. First Storytelling Section — Requirement Intelligence with Timeline Anchor */}
            <RequirementTransformation />

            {/* Dramatic Transition Statement 1 */}
            <TypographicStatement
                tag="[ SPECIFICATION RIGOR ]"
                text="Every requirement has a purpose."
            />

            {/* 2. Main Interactive Timeline (5-Stage Vention Charcoal #222426 Environment) */}
            <InteractiveTimelineSection />

            {/* Dramatic Transition Statement 2 */}
            <TypographicStatement
                tag="[ AUDITABLE LINEAGE ]"
                text="Every test needs a reason."
            />

            {/* 3. Developer Pipeline & CI/CD Integrations */}
            <IntegrationsChapter />

            {/* Dramatic Transition Statement 3 */}
            <TypographicStatement
                tag="[ ACCEPTANCE CRITERIA ]"
                text="Quality must be verified."
            />

            {/* 4. Final Typographic Call to Action */}
            <FinalCTA />
        </div>
    );
};

export default GeneratorPage;
