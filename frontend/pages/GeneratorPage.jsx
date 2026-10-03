import React from 'react';
import useScrollParallax from '../hooks/useScrollParallax';
import Hero from '../components/Hero';
import RequirementTransformation from '../components/RequirementTransformation';
import TestSuiteChapter from '../components/TestSuiteChapter';
import TraceabilityGraph from '../components/TraceabilityGraph';
import CoverageTraceChapter from '../components/CoverageTraceChapter';
import IntegrationsChapter from '../components/IntegrationsChapter';
import EnterpriseWorkflowChapter from '../components/EnterpriseWorkflowChapter';
import FinalCTA from '../components/FinalCTA';
import GlobalWorkflowIndicator from '../components/GlobalWorkflowIndicator';

const GeneratorPage = () => {
    useScrollParallax();

    return (
        <div className="home-page tn-marketing-root">
            {/* Subtle Vertical Workflow Indicator connecting chapters */}
            <GlobalWorkflowIndicator />

            {/* 1. Hero: Problem framing, core value proposition & authentic Testnexa product canvas */}
            <Hero />

            {/* 2. Signature Requirement Transformation: Scroll-driven & interactive 5-stage transformation */}
            <RequirementTransformation />

            {/* 3. Test Case Generation: Master-detail executable test cases & Cucumber BDD specs */}
            <TestSuiteChapter />

            {/* 4. Signature Traceability Graph: Requirement ── Scenario ── Test Cases, Risk & Coverage */}
            <TraceabilityGraph />

            {/* 5. Coverage + Risk: Know what is covered before execution */}
            <CoverageTraceChapter />

            {/* 6. Developer Pipeline & API: REST API cURL terminal and supported schemas */}
            <IntegrationsChapter />

            {/* 7. Enterprise QA Governance: Role-based workflow and trust assurances */}
            <EnterpriseWorkflowChapter />

            {/* 8. Restrained Enterprise Final CTA */}
            <FinalCTA />
        </div>
    );
};

export default GeneratorPage;
