import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import useScrollReveal from '../hooks/useScrollReveal';
import { ProductWorkbench } from './Hero';

const FinalCTA = () => {
    const reveal = useScrollReveal({ threshold: 0.12 });

    return (
        <section className="tn-cta" aria-labelledby="cta-heading">
            <div
                ref={reveal.ref}
                className={`tn-container tn-cta__layout scroll-reveal-fade-up ${reveal.isVisible ? 'revealed' : ''}`}
            >
                <div className="tn-cta__content">
                    <div className="tn-eyebrow"><Sparkles size={14} /> Ready when you are</div>
                    <h2 id="cta-heading">Stop writing test cases from scratch.</h2>
                    <p>Turn your next requirement into a complete, prioritized test suite with Testnexa AI.</p>
                    <div className="tn-cta__actions">
                        <Link to="/login" className="tn-btn tn-btn--primary tn-btn--lg">
                            Try Testnexa AI
                            <ArrowRight size={18} />
                        </Link>
                        <Link to="/" className="tn-btn tn-btn--secondary tn-btn--lg">
                            Explore the Product
                        </Link>
                    </div>
                </div>
                <div className="tn-cta__product" aria-hidden="true">
                    <ProductWorkbench compact />
                </div>
            </div>
        </section>
    );
};

export default FinalCTA;
