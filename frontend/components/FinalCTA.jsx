import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import useScrollReveal from '../hooks/useScrollReveal';

const FinalCTA = () => {
    const reveal = useScrollReveal({ threshold: 0.15 });

    return (
        <section className="tn-cta" aria-labelledby="cta-heading">
            {/* Background glow */}
            <div className="tn-cta__glow" aria-hidden="true" />

            <div
                ref={reveal.ref}
                className={`container tn-cta__inner scroll-reveal-fade-up ${reveal.isVisible ? 'revealed' : ''}`}
            >
                {/* Decorative product interface silhouette */}
                <div className="tn-cta__product-ghost" aria-hidden="true">
                    <div className="tn-cta__ghost-chrome">
                        <span /><span /><span />
                    </div>
                    <div className="tn-cta__ghost-lines">
                        <div /><div /><div /><div />
                    </div>
                </div>

                <div className="tn-cta__content">
                    <div className="tn-cta__badge">
                        <Sparkles size={14} />
                        <span>Ready to start?</span>
                    </div>

                    <h2 id="cta-heading" className="tn-cta__headline">
                        Stop Writing Test Cases<br />
                        From Scratch.
                    </h2>

                    <p className="tn-cta__subtext">
                        Turn your next requirement into a complete, prioritized test suite in seconds.
                    </p>

                    <div className="tn-cta__actions">
                        <Link to="/login" className="tn-btn tn-btn--primary tn-btn--lg">
                            Try Testnexa AI
                            <ArrowRight size={18} />
                        </Link>
                        <Link to="/" className="tn-btn tn-btn--ghost">
                            Explore the Product
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default FinalCTA;
