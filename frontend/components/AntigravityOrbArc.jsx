import React, { useState } from 'react';
import {
    Sparkles,
    Code,
    GitBranch,
    RefreshCw,
    CheckCircle2,
    Terminal,
    ShieldAlert,
    Cpu
} from 'lucide-react';

const ORB_ITEMS = [
    {
        id: 'parser',
        label: 'Semantic Parser',
        sub: 'RFC 5322 & Acceptance Decomp',
        icon: Sparkles,
        accent: 'jade',
        delay: '0s'
    },
    {
        id: 'ast',
        label: 'Playwright & Cypress',
        sub: 'Executable runner AST code',
        icon: Code,
        accent: 'blue',
        delay: '0.6s'
    },
    {
        id: 'trace',
        label: 'Traceability Matrix',
        sub: 'Bidirectional requirement link',
        icon: GitBranch,
        accent: 'jade',
        delay: '1.2s'
    },
    {
        id: 'regen',
        label: 'Continuous Refine',
        sub: 'Regenerate on spec change',
        icon: RefreshCw,
        accent: 'amber',
        delay: '1.8s'
    },
    {
        id: 'gate',
        label: 'CI/CD Quality Gate',
        sub: 'GitHub Actions & GitLab check',
        icon: CheckCircle2,
        accent: 'green',
        delay: '0.9s'
    },
    {
        id: 'risk',
        label: 'Risk & Boundary Audit',
        sub: 'Implicit edge case flags',
        icon: ShieldAlert,
        accent: 'rose',
        delay: '1.5s'
    }
];

export const AntigravityOrbArc = ({ onSelectOrb }) => {
    const [hoveredId, setHoveredId] = useState(null);

    return (
        <div className="tn-orb-arc-wrapper" aria-label="Antigravity Tool Ecosystem">
            <div className="tn-orb-arc-track">
                {ORB_ITEMS.map((item, idx) => {
                    const IconComponent = item.icon;
                    const isHovered = hoveredId === item.id;

                    return (
                        <div
                            key={item.id}
                            className={`tn-orb-item tn-orb--${item.accent} tn-orb-float-${(idx % 4) + 1} ${isHovered ? 'is-hovered' : ''}`}
                            onMouseEnter={() => setHoveredId(item.id)}
                            onMouseLeave={() => setHoveredId(null)}
                            onClick={() => onSelectOrb && onSelectOrb(item.id)}
                            role="button"
                            tabIndex={0}
                            aria-label={`${item.label}: ${item.sub}`}
                        >
                            <div className="tn-orb-circle">
                                <IconComponent size={15} className="tn-orb-icon" />
                                <span className="tn-orb-ambient-ring" />
                            </div>

                            <div className="tn-orb-tooltip">
                                <span className="tn-orb-tooltip-title">{item.label}</span>
                                <span className="tn-orb-tooltip-sub">{item.sub}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default AntigravityOrbArc;
