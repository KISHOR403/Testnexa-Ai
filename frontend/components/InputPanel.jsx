import React, { useState } from 'react';
import {
    FileText, Sparkles, X, Clipboard, Loader2,
    BookOpen, Info, Layers, Zap, Globe, Trash2, Lightbulb, ChevronDown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const InputPanel = ({ value, onChange, onGenerate, isGenerating, settings, setSettings }) => {
    const { isAuthenticated, guestGenerationsUsed, GUEST_LIMIT } = useAuth();
    const maxLength = 2000;

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
        setShowSampleDropdown(false); // Close dropdown after selection
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

    const detailTips = {
        Essential: 'AI focuses on critical happy paths and primary failures · Best for low-risk features',
        Standard: 'AI analyzes functional flows, negative cases, and common edge conditions · Best for production features',
        Comprehensive: 'AI performs deep analysis: security risks, API contracts, boundary conditions · Best for payment flows, authentication'
    };

    return (
        <div className="prompt-card glass-card luxury-glow">
            {/* 1. Header Row */}
            <div className="prompt-header">
                <div className="header-left">
                    <Sparkles size={18} className="text-primary" />
                    <div>
                        <span className="header-title">AI Workspace</span>
                        <p className="header-subtitle">Describe your requirement — the AI will analyze clarity, detect risks, and design comprehensive tests</p>
                    </div>
                </div>
                <div className="header-right">
                    <div className="sample-dropdown-container">
                        <button
                            className={`btn-icon-text ${showSampleDropdown ? 'active' : ''}`}
                            onClick={() => setShowSampleDropdown(!showSampleDropdown)}
                            disabled={isGenerating}
                        >
                            <Lightbulb size={14} />
                            <span>Example Requirements</span>
                            <ChevronDown size={14} className={showSampleDropdown ? 'rotate-180' : ''} />
                        </button>

                        {showSampleDropdown && (
                            <div className="sample-dropdown-menu glass-card">
                                {Object.entries(sampleRequirements).map(([category, items]) => (
                                    <div key={category} className="sample-category">
                                        <div className="category-label">{category}</div>
                                        {items.map((item) => (
                                            <button
                                                key={item.name}
                                                className="sample-item"
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
                        <button className="btn-icon-text danger" onClick={handleClear} disabled={isGenerating}>
                            <Trash2 size={14} />
                            <span>Clear</span>
                        </button>
                    )}
                </div>
            </div>

            {/* 2. Textarea Section */}
            <div className="prompt-main-area">
                <textarea
                    placeholder="Describe your requirement in natural language...&#10;&#10;Examples: User authentication flow, payment processing, API rate limiting"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    maxLength={maxLength}
                    className="prompt-textarea"
                    disabled={isGenerating}
                />
                <button
                    className="btn-paste-chat"
                    onClick={handlePaste}
                    disabled={isGenerating}
                    title="Paste from clipboard"
                >
                    <Clipboard size={16} />
                </button>

                {/* Requirement Quality Indicator */}
                {value.length > 0 && (
                    <div className={`quality-indicator ${value.length < 50 ? 'low' : value.length < 150 ? 'medium' : 'high'}`}>
                        <Sparkles size={12} />
                        <span>
                            {value.length < 50 ? 'Add more detail for better analysis' :
                                value.length < 150 ? 'Good clarity — ready for analysis' :
                                    'High clarity — AI can detect nuanced edge cases'}
                        </span>
                    </div>
                )}
            </div>

            {/* 3. Parameters Row (Inline ChatGPT style) */}
            <div className="prompt-parameters-bar">
                {/* App Type Chips */}
                <div className="param-group">
                    <label className="param-label"><Layers size={14} /> Application Context</label>
                    <div className="chip-group">
                        {['WEB', 'MOBILE', 'API'].map((type) => (
                            <button
                                key={type}
                                className={`chip-pill ${settings.type.toUpperCase() === type ? 'active' : ''}`}
                                onClick={() => setSettings({ ...settings, type: type.toLowerCase() })}
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Detail Level Pills */}
                <div className="param-group">
                    <label className="param-label"><Zap size={14} /> Coverage Depth</label>
                    <div className="chip-group">
                        {['Essential', 'Standard', 'Comprehensive'].map((level) => (
                            <div key={level} className="chip-pill-wrapper">
                                <button
                                    className={`chip-pill ${settings.level === level ? 'active' : ''}`}
                                    onClick={() => setSettings({ ...settings, level })}
                                >
                                    {level}
                                </button>
                                <div className="chip-tooltip">
                                    <Info size={12} />
                                    <span className="tooltip-text">{detailTips[level]}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Language Dropdown */}
                <div className="param-group language">
                    <label className="param-label"><Globe size={14} /> Test Language</label>
                    <select
                        className="prompt-select"
                        value={settings.language}
                        onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                    >
                        <option value="english">English (US)</option>
                        <option value="hindi">Hindi</option>
                        <option value="spanish">Spanish</option>
                    </select>
                </div>
            </div>

            {/* 4. Footer Row */}
            <div className="prompt-footer">
                <div className="footer-left">
                    <span className="char-counter">
                        {value.length} characters {value.length > 0 && `· ${value.length < 50 ? 'Add more detail for better analysis' : value.length < 150 ? 'Good clarity detected' : 'High clarity detected'}`}
                    </span>
                    <div className="guidance-chips">
                        <span className="guidance-tag">AI analyzes:</span>
                        <span className="chip-simple">Clarity</span>
                        <span className="chip-simple">Ambiguities</span>
                        <span className="chip-simple">Risk Areas</span>
                        <span className="chip-simple">Edge Cases</span>
                    </div>
                </div>
                <div className="footer-right">
                    <div className="generate-button-wrapper">
                        <button
                            className={`btn-generate-chat ${isGenerating ? 'loading' : ''}`}
                            onClick={onGenerate}
                            disabled={isGenerating || !value.trim()}
                        >
                            {isGenerating ? (
                                <Loader2 className="animate-spin" size={18} />
                            ) : (
                                <Sparkles size={18} fill="currentColor" />
                            )}
                            <span>{isGenerating ? 'Analyzing requirement...' : 'Analyze & Generate Tests'}</span>
                        </button>
                        {!isAuthenticated && (
                            <div className="guest-usage-counter">
                                <span className={`usage-text ${guestGenerationsUsed >= GUEST_LIMIT ? 'limit-reached' : ''}`}>
                                    {guestGenerationsUsed >= GUEST_LIMIT
                                        ? '🔒 Sign in to continue generating'
                                        : `${guestGenerationsUsed} of ${GUEST_LIMIT} free generations used`}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {/* 5. Pro Tip micro-content */}
            <div className="pro-tip-box">
                <Sparkles size={14} className="text-primary" />
                <span>The AI performs multi-step analysis: requirement understanding → ambiguity detection → risk assessment → test synthesis</span>
            </div>
        </div>
    );
};

export default InputPanel;
