import React from 'react';
import Hero from '../components/Hero';
import RequirementTransformation from '../components/RequirementTransformation';
import EnterpriseWorkflowChapter from '../components/EnterpriseWorkflowChapter';
import TestSuiteChapter from '../components/TestSuiteChapter';
import TraceabilityGraph from '../components/TraceabilityGraph';
import IntegrationsChapter from '../components/IntegrationsChapter';
import FinalCTA from '../components/FinalCTA';
import GlobalWorkflowIndicator from '../components/GlobalWorkflowIndicator';

const GeneratorPage = () => {
    return (
        <div className="home-page tn-marketing-root">
            {/* Subtle Vertical Workflow Indicator connecting chapters */}
            <GlobalWorkflowIndicator />

            {/* Hero: Problem framing, core value proposition & authentic product canvas */}
            <Hero />

            {/* Section A: Requirement Intelligence — Natural language to verified acceptance logic */}
            <RequirementTransformation />

            {/* Section B: Complete QA Workflow — Connected end-to-end engineering pipeline */}
            <EnterpriseWorkflowChapter />

            {/* Section C: Review and Risk — Interactive test case inspection, edge cases & BDD */}
            <TestSuiteChapter />

            {/* Section D: Bidirectional Traceability — Verifiable lineage from spec to risk mitigation */}
            <TraceabilityGraph />

            {/* Section E: Developer Pipeline & Integrations — Native test runners, cURL & CI/CD quality gates */}
            <IntegrationsChapter />

            {/* Final CTA: Editorial closing canvas */}
            <FinalCTA />
        </div>
    );
};

export default GeneratorPage;
