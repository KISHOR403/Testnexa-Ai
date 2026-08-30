import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ScrollToTop from '../components/ScrollToTop';
import AnimatedBackground from '../components/AnimatedBackground';

const MarketingLayout = () => {
    return (
        <div className="marketing-layout-root">
            <ScrollToTop />
            <AnimatedBackground />
            {/* Clean marketing navbar with no sidebar toggle or application artifacts */}
            <Navbar isMarketingLayout={true} />
            <main className="marketing-content-wrapper">
                <Outlet />
            </main>
            <Footer />
        </div>
    );
};

export default MarketingLayout;
