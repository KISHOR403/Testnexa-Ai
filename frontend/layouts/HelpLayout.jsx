import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import HelpHeader from '../components/help/HelpHeader';
import ContactSupportModal from '../components/help/ContactSupportModal';
import { Footer } from '../components/Footer';
import ScrollToTop from '../components/ScrollToTop';
import '../styles/HelpPage.css';

export const HelpLayout = () => {
    const [isSupportOpen, setIsSupportOpen] = useState(false);

    return (
        <div className="help-page-root">
            <ScrollToTop />
            <HelpHeader onOpenSupport={() => setIsSupportOpen(true)} />
            <Outlet context={{ onOpenSupport: () => setIsSupportOpen(true) }} />
            <Footer />
            <ContactSupportModal
                isOpen={isSupportOpen}
                onClose={() => setIsSupportOpen(false)}
            />
        </div>
    );
};

export default HelpLayout;
