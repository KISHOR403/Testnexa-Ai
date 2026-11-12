import React from 'react';
import { Terminal, Shield, Cpu, Layers, GitPullRequest, Code2 } from 'lucide-react';

const INTEGRATIONS = [
    { name: 'Playwright', ext: '.spec.ts', tag: 'TypeScript', desc: 'Atomic locators & strict assertions' },
    { name: 'Cypress', ext: '.cy.js', tag: 'JavaScript', desc: 'Browser-driven network interceptors' },
    { name: 'Cucumber BDD', ext: '.feature', tag: 'Gherkin', desc: 'Human-readable acceptance syntax' },
    { name: 'TestRail', ext: 'REST API', tag: 'TMS Sync', desc: 'Automated test run result publishing' },
    { name: 'Jira & Zephyr', ext: 'Webhook', tag: 'Atlassian', desc: 'Bi-directional issue traceability' },
    { name: 'Azure DevOps', ext: 'Pipeline', tag: 'CI Gate', desc: 'Build-blocking quality gates' },
    { name: 'GitHub Actions', ext: '.yml', tag: 'CI/CD', desc: 'Pull request quality gate automation' }
];

export const IntegrationsStrip = () => {
    return (
        <section
            id="integrations-section"
            className="tn-integrations-section"
            aria-label="Supported Test Runners and CI/CD Integrations"
        >
            <div className="tn-max-container">
                <div className="tn-eyebrow-mono" style={{ textAlign: 'center', justifyContent: 'center' }}>
                    <span className="tn-eyebrow-ping" />
                    <span>NATIVE RUNNER COMPATIBILITY // ZERO VENDOR LOCK-IN</span>
                </div>

                <h2 className="tn-integrations-heading">
                    Plug directly into your production pipelines.
                </h2>

                <p className="tn-integrations-sub">
                    Export verified test suites in native format. No proprietary runtimes, no lock-in.
                </p>
            </div>

            {/* Marquee Strip with Pause on Hover */}
            <div className="tn-marquee-container" data-cursor="Export">
                <div className="tn-marquee-track">
                    {/* Quadrupled for ultra-wide seamless looping */}
                    {[...INTEGRATIONS, ...INTEGRATIONS, ...INTEGRATIONS, ...INTEGRATIONS].map((item, idx) => (
                        <div key={idx} className="tn-marquee-item tn-glow-card">
                            <div className="tn-marquee-item-top">
                                <span className="tn-marquee-name">{item.name}</span>
                                <span className="tn-marquee-tag">{item.tag}</span>
                            </div>
                            <div className="tn-marquee-ext"><code>{item.ext}</code></div>
                            <p className="tn-marquee-desc">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default IntegrationsStrip;
