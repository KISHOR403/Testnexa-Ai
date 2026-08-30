import React from 'react';
import Hero from '../components/Hero';
import Features from '../components/Features';
import ProductStory from '../components/ProductStory';
import PainPoints from '../components/PainPoints';
import HowItWorks from '../components/HowItWorks';
import WhoIsThisFor from '../components/WhoIsThisFor';
import WhyThisMatters from '../components/WhyThisMatters';
import FinalCTA from '../components/FinalCTA';

const GeneratorPage = () => {
    return (
        <div className="home-page">
            {/* 1. Hero - Clean Marketing & Product Demonstration with New-Tab Workspace CTA */}
            <Hero />

            {/* 2. Key Features */}
            <Features />

            {/* 3. Product Story — Transformation Pipeline */}
            <ProductStory />

            {/* 4. Real QA Pain Points */}
            <PainPoints />

            {/* 5. How Testnexa AI Works */}
            <HowItWorks />

            {/* 6. Who is this for? */}
            <WhoIsThisFor />

            {/* 7. Metrics */}
            <WhyThisMatters />

            {/* 8. Final CTA with New-Tab Workspace CTA */}
            <FinalCTA />
        </div>
    );
};

export default GeneratorPage;
