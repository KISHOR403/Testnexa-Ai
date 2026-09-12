import React, { useState, useRef, useEffect } from 'react';
import {
    Clipboard, Loader2,
    Layers, Zap, Trash2, Lightbulb, ChevronDown, Info,
    Globe, Smartphone, Server, Gauge, Target, Rocket
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const InputPanel = ({ value, onChange, onGenerate, isGenerating, settings, setSettings }) => {
    const { isAuthenticated, guestGenerationsUsed, GUEST_LIMIT } = useAuth();
    const maxLength = 2000;
    const cardRef = useRef(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [isFocused, setIsFocused] = useState(false);
    const [showSampleDropdown, setShowSampleDropdown] = useState(false);

    const sampleRequirements = {
        Authentication: [
            { name: 'Standard Login', text: 'As a user, I want to login with my email and password. Email must be valid format. Password must be at least 8 characters.' },
            { name: 'OTP Verification', text: 'User should receive a 6-digit OTP on mobile for two-factor authentication. OTP expires in 5 minutes.' }
        ],
        Payments: [
            { name: 'Credit Card Checkout', text: 'Process a payment using Stripe. Validate card number, expiry date, and CVV. Show success message on approval.' },
            { name: 'Subscription Plan', text: 'User selects a monthly or yearly plan. Handle pro-rated billing and trial period logic.' }
        ],
        API: [
            { name: 'GET User Profile', text: 'Endpoint /api/v1/profile should return user details. Handle 401 Unauthorized and 404 Not Found.' },
            { name: 'Rate Limiting', text: 'Ensure API rejects more than 100 requests per minute from the same IP with a 429 status.' }
        ],
        General: [
            { name: 'Global Search', text: 'Search through products, categories, and brands. Results should be ranked by relevance and paginated.' },
            { name: 'User Dashboard', text: 'Dashboard should load within 2 seconds and display recent activity, pending tasks, and notifications.' }
        ]
    };

    const handleSample = (text) => {
        onChange(text);
        setShowSampleDropdown(false);
    };

    const handleClear = () => onChange('');

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            onChange(value + text);
        } catch (err) {
            console.error('Failed to read clipboard contents: ', err);
        }
    };

    const handleMouseMove = (e) => {
        if (!cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        setMousePos({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        });
    };

    const detailTips = {
        Essential: 'Critical happy paths & primary failures',
        Standard: 'Functional, negative & edge conditions',
        Comprehensive: 'Security, API contracts & boundary analysis'
    };

    const contextIcons = { WEB: Globe, MOBILE: Smartphone, API: Server };
    const depthIcons = { Essential: Gauge, Standard: Target, Comprehensive: Rocket };

    const qualityLevel = value.length < 50 ? 'low' : value.length < 150 ? 'medium' : 'high';
    const qualityText = {
        low: 'Add more detail for richer results',
        medium: 'Good clarity — ready for analysis',
        high: 'Excellent detail — deep edge case detection'
    };

    return (
        <div
            ref={cardRef}
            className={`ip-2026 ${isFocused ? 'ip-focused' : ''}`}
            onMouseMove={handleMouseMove}
            style={{
                '--mouse-x': `${mousePos.x}px`,
                '--mouse-y': `${mousePos.y}px`,
            }}
        >
            {/* Cursor-following spotlight overlay */}
            <div className="ip-spotlight" />

            {/* Top gradient border */}
            <div className="ip-border-glow" />

            {/* ─── Header ─── */}
            <div className="ip-header">
                <div className="ip-header-left">
                    <div className="ip-logo-badge">
                        <img src="/testnexa-logo.png" alt="Testnexa AI" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px' }} />
                    </div>
                    <div>
                        <h3 className="ip-title">AI Workspace</h3>
                        <p className="ip-subtitle">Describe your requirement — the AI analyzes clarity, risks & designs tests</p>
                    </div>
                </div>
                <div className="ip-header-actions">
                    <div className="sample-dropdown-container">
                        <button
                            className={`ip-btn-ghost ${showSampleDropdown ? 'active' : ''}`}
                            onClick={() => setShowSampleDropdown(!showSampleDropdown)}
                            disabled={isGenerating}
                        >
                            <Lightbulb size={14} />
                            <span className="ip-btn-label">Examples</span>
                            <ChevronDown size={12} className={showSampleDropdown ? 'rotate-180' : ''} />
                        </button>

                        {showSampleDropdown && (
                            <div className="ip-dropdown">
                                {Object.entries(sampleRequirements).map(([category, items]) => (
                                    <div key={category} className="ip-dropdown-group">
                                        <div className="ip-dropdown-label">{category}</div>
                                        {items.map((item) => (
                                            <button
                                                key={item.name}
                                                className="ip-dropdown-item"
                                                onClick={() => handleSample(item.text)}
                                            >
                                                {item.name}
                                            </button>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    {value && (
                        <button className="ip-btn-ghost ip-btn-danger" onClick={handleClear} disabled={isGenerating}>
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* ─── Textarea ─── */}
            <div className="ip-editor-area">
                <textarea
                    placeholder={"Describe your requirement in natural language...\n\nExamples: User authentication flow, payment processing, API rate limiting"}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    maxLength={maxLength}
                    className="ip-textarea"
                    disabled={isGenerating}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                />
                <button
                    className="ip-paste-btn"
                    onClick={handlePaste}
                    disabled={isGenerating}
                    title="Paste from clipboard"
                >
                    <Clipboard size={14} />
                </button>

                {/* Quality bar */}
                {value.length > 0 && (
                    <div className={`ip-quality-bar ip-quality-${qualityLevel}`}>
                        <div className="ip-quality-bar-fill" style={{
                            width: `${Math.min((value.length / 200) * 100, 100)}%`
                        }} />
                        <span className="ip-quality-label">
                            <Gauge size={10} />
                            {qualityText[qualityLevel]}
                        </span>
                    </div>
                )}
            </div>

            {/* ─── Controls Row ─── */}
            <div className="ip-controls">
                {/* App Context Selector */}
                <div className="ip-control-group">
                    <span className="ip-control-label">
                        <Layers size={12} />
                        Context
                    </span>
                    <div className="ip-chip-row">
                        {['WEB', 'MOBILE', 'API'].map((type) => {
                            const Icon = contextIcons[type];
                            const isActive = settings.type.toUpperCase() === type;
                            return (
                                <button
                                    key={type}
                                    className={`ip-chip ${isActive ? 'ip-chip-active' : ''}`}
                                    onClick={() => setSettings({ ...settings, type: type.toLowerCase() })}
                                >
                                    <Icon size={13} />
                                    <span>{type}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="ip-controls-divider" />

                {/* Coverage Depth */}
                <div className="ip-control-group">
                    <span className="ip-control-label">
                        <Zap size={12} />
                        Depth
                    </span>
                    <div className="ip-chip-row">
                        {['Essential', 'Standard', 'Comprehensive'].map((level) => {
                            const Icon = depthIcons[level];
                            const isActive = settings.level === level;
                            return (
                                <div key={level} className="ip-chip-wrapper">
                                    <button
                                        className={`ip-chip ${isActive ? 'ip-chip-active' : ''}`}
                                        onClick={() => setSettings({ ...settings, level })}
                                    >
                                        <Icon size={13} />
                                        <span>{level}</span>
                                    </button>
                                    <div className="ip-tooltip">
                                        <Info size={10} />
                                        <span>{detailTips[level]}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ─── Footer ─── */}
            <div className="ip-footer">
                <div className="ip-footer-meta">
                    <span className="ip-char-count">
                        {value.length}<span className="ip-char-sep">/</span>{maxLength}
                    </span>
                    <div className="ip-tags-row">
                        <span className="ip-tags-label">AI analyzes:</span>
                        {['Clarity', 'Ambiguities', 'Risk Areas', 'Edge Cases'].map((tag) => (
                            <span key={tag} className="ip-tag">{tag}</span>
                        ))}
                    </div>
                </div>
                <div className="ip-footer-action">
                    <button
                        className={`ip-generate-btn ${isGenerating ? 'ip-generating' : ''}`}
                        onClick={onGenerate}
                        disabled={isGenerating || !value.trim()}
                    >
                        <span className="ip-generate-bg" />
                        {isGenerating ? (
                            <Loader2 className="animate-spin" size={18} />
                        ) : (
                            <Zap size={18} />
                        )}
                        <span>{isGenerating ? 'Analyzing...' : 'Analyze & Generate Tests'}</span>
                    </button>
                    {!isAuthenticated && (
                        <div className="ip-usage-badge">
                            <span className={guestGenerationsUsed >= GUEST_LIMIT ? 'ip-limit-hit' : ''}>
                                {guestGenerationsUsed >= GUEST_LIMIT
                                    ? '🔒 Sign in to continue'
                                    : `${guestGenerationsUsed} of ${GUEST_LIMIT} free generations used`}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Pro Tip ─── */}
            <div className="ip-pro-tip">
                <Info size={12} />
                <span>Multi-step test analysis: requirement parsing → ambiguity detection → risk assessment → test synthesis</span>
            </div>
        </div>
    );
};

export default InputPanel;
