import React from 'react';
import {
    CheckCircle2,
    Code,
    Layers,
    ShieldAlert,
    FileCheck,
    ArrowRight
} from 'lucide-react';

const STAKEHOLDER_ROLES = [
    {
        role: 'QA Engineer',
        icon: Code,
        objective: 'Review generated test cases and edge cases.',
        details: 'Instantly get structured scenarios with preconditions, input parameters, step-by-step actions, and BDD Gherkin syntax without repetitive manual authoring.',
        keyOutputs: ['Full precondition specs', 'Step-by-step verification flows', 'Gherkin BDD exports']
    },
    {
        role: 'QA Lead',
        icon: Layers,
        objective: 'Review coverage, risks and traceability.',
        details: 'Audit test suites against requirement clauses, ensure negative and security scenarios are covered, and maintain unbroken bidirectional lineage.',
        keyOutputs: ['Coverage distribution audit', 'Risk severity prioritization', 'Clause-to-test traceability']
    },
    {
        role: 'Engineering Manager',
        icon: ShieldAlert,
        objective: 'Understand quality gaps and release risk.',
        details: 'Identify untested edge cases, abuse vulnerabilities, and critical path deficiencies early in the sprint before code moves to staging.',
        keyOutputs: ['Sprint release risk rating', 'Security vulnerability flags', 'Regression readiness status']
    },
    {
        role: 'Product Manager',
        icon: FileCheck,
        objective: 'Validate that requirements are testable.',
        details: 'Catch missing acceptance criteria, conflicting business rules, and unstated assumptions during grooming before engineering begins development.',
        keyOutputs: ['Ambiguity detection alerts', 'Acceptance criteria audit', 'Testability verification score']
    }
];

export const RoleSection = () => {
    return (
        <section className="tn-section tn-role-section" aria-labelledby="role-heading">
            <div className="tn-container">
                <div className="tn-section-header">
                    <span className="tn-kicker">Stakeholder Alignment</span>
                    <h2 id="role-heading" className="tn-section-title">
                        One requirement. Role-specific views.
                    </h2>
                    <p className="tn-section-subtitle">
                        QA, leads, engineering, and product work from the same testable specification.
                    </p>
                </div>

                <div className="tn-roles-grid">
                    {STAKEHOLDER_ROLES.map((item) => {
                        const Icon = item.icon;
                        return (
                            <div key={item.role} className="tn-role-card-pro">
                                <div className="tn-role-card-pro__header">
                                    <div className="tn-role-icon-box">
                                        <Icon size={18} />
                                    </div>
                                    <div>
                                        <h3 className="tn-role-name">{item.role}</h3>
                                        <p className="tn-role-obj">{item.objective}</p>
                                    </div>
                                </div>

                                <p className="tn-role-body">{item.details}</p>

                                <div className="tn-role-outputs-list">
                                    {item.keyOutputs.map((output, idx) => (
                                        <div key={idx} className="tn-role-output-item">
                                            <CheckCircle2 size={13} className="text-accent" />
                                            <span>{output}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};

export default RoleSection;
