import React from 'react';
import Hero from '../components/Hero';
import ProductWorkflow from '../components/ProductWorkflow';
import ProductPreview from '../components/ProductPreview';
import RequirementIntelligence from '../components/RequirementIntelligence';
import TestSuiteSection from '../components/TestSuiteSection';
import CoverageRiskSection from '../components/CoverageRiskSection';
import TraceabilitySection from '../components/TraceabilitySection';
import RoleSection from '../components/RoleSection';
import IntegrationsApiSection from '../components/IntegrationsApiSection';
import SecurityTrustSection from '../components/SecurityTrustSection';
import FinalCTA from '../components/FinalCTA';

const GeneratorPage = () => {
    return (
        <div className="home-page tn-marketing-root">
            {/* 1. Hero: Problem framing, core value proposition & authentic TestNexa workspace preview */}
            <Hero />

            {/* 2. Product Workflow: 7-step horizontal timeline with interactive adjacent preview */}
            <ProductWorkflow />

            {/* 3. Real Product Preview: Connected tabbed views of REQ-142 Password Reset */}
            <ProductPreview />

            {/* 4. Requirement Intelligence: Raw input -> Analysis -> Structured testable criteria */}
            <RequirementIntelligence />

            {/* 5. Test Suite Generation: Master-detail table with TC-001..TC-005 and BDD syntax */}
            <TestSuiteSection />

            {/* 6. Coverage + Risk: 87% coverage audit and High/Med/Low risk severity breakdown */}
            <CoverageRiskSection />

            {/* 7. Traceability: Bidirectional requirement-to-test tree lineage */}
            <TraceabilitySection />

            {/* 8. Role-Based Stakeholder Value: QA Engineer, QA Lead, Eng Manager, PM */}
            <RoleSection />

            {/* 9. Integrations & REST API: Supported export formats and developer API curl */}
            <IntegrationsApiSection />

            {/* 10. Security & Enterprise Trust: Stateless inference, workspace isolation, RBAC */}
            <SecurityTrustSection />

            {/* 11. Final Action CTA: Enterprise CTA with authenticated workspace entry */}
            <FinalCTA />
        </div>
    );
};

export default GeneratorPage;
