import React from 'react';
import useScrollParallax from '../hooks/useScrollParallax';
import Hero from '../components/Hero';
import RequirementTransformation from '../components/RequirementTransformation';
import EnterpriseWorkflowChapter from '../components/EnterpriseWorkflowChapter';
import TestSuiteChapter from '../components/TestSuiteChapter';
import TraceabilityGraph from '../components/TraceabilityGraph';
import IntegrationsChapter from '../components/IntegrationsChapter';
import FinalCTA from '../components/FinalCTA';
import GlobalWorkflowIndicator from '../components/GlobalWorkflowIndicator';

const GeneratorPage = () => {
    useScrollParallax();

    return (
        <div className="home-page tn-marketing-root">
            {/* Subtle Vertical Workflow Indicator connecting chapters */}
            <GlobalWorkflowIndicator />

            {/* Section A: Hero — Problem framing, core value proposition & emerging product canvas */}
            <Hero />

            {/* Section B: Requirement Intelligence — Asymmetric split layout with Annotation UI */}
            <RequirementTransformation />

            {/* Section C: Complete QA Workflow — Interactive Real Product Workspace */}
            <EnterpriseWorkflowChapter />

            {/* Section D: Executable Test Suites — Full-width developer experience with steps & BDD */}
            <TestSuiteChapter />

            {/* Section E: Traceability Architecture — Horizontal lineage flow from requirement to risk */}
            <TraceabilityGraph />

            {/* Section F: Developer Pipeline & Integrations — cURL terminal & runner ecosystem */}
            <IntegrationsChapter />

            {/* Section G: Production-Ready Final CTA — Editorial open canvas */}
            <FinalCTA />
        </div>
    );
};

export default GeneratorPage;
