import React from 'react';
import useScrollParallax from '../hooks/useScrollParallax';
import Hero from '../components/Hero';
import StickyProductStory from '../components/StickyProductStory';
import TestSuiteChapter from '../components/TestSuiteChapter';
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

            {/* Hero: Problem framing, core value proposition & authentic TestNexa workspace preview */}
            <Hero />

            {/* CHAPTER 1: Requirement → AI Analysis (Sticky Scroll Product Story) */}
            <StickyProductStory />

            {/* CHAPTER 2: Test Case Generation (From scenarios to executable tests) */}
            <TestSuiteChapter />

            {/* CHAPTER 3: Coverage + Risk + Traceability (Know what is covered before execution) */}
            <CoverageTraceChapter />

            {/* CHAPTER 4: Workflow + Integrations (Connect QA to your engineering workflow) */}
            <IntegrationsChapter />

            {/* CHAPTER 5: Enterprise QA Workflow (A complete QA workflow, not just a test generator) */}
            <EnterpriseWorkflowChapter />

            {/* FINAL CTA: Turn requirements into structured test suites */}
            <FinalCTA />
        </div>
    );
};

export default GeneratorPage;
