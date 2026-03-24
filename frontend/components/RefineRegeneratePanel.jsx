import React, { useState, useEffect } from 'react';
import {
    RefreshCw, ChevronDown, ChevronUp, Target, AlertTriangle, Shield, Link, MessageSquare,
    CheckCircle, X, CheckSquare, Zap, Users, LayoutGrid, Info
} from 'lucide-react';

const TestTypeFocusSelector = ({ selectedType, onTypeChange }) => {
    const testTypes = [
        {
            id: 'functional',
            label: 'Functional Testing',
            description: 'Happy paths, edge cases, and user workflows',
            icon: CheckSquare
        },
        {
            id: 'non_functional',
            label: 'Non-Functional Testing',
            description: 'Performance, security, reliability, and usability',
            icon: Shield
        },
        {
            id: 'api',
            label: 'API Testing',
            description: 'Integration, contracts, and backend validations',
            icon: Link
        },
        {
            id: 'mixed',
            label: 'Mixed (Functional + Non-Functional)',
            description: 'Comprehensive coverage across all categories',
            icon: LayoutGrid
        }
    ];

    return (
        <div className="refine-section">
            <div className="refine-section-header">
                <h4 className="refine-section-label">What type of testing do you want to focus on?</h4>
                <p className="refine-section-subtitle">This determines which test categories are prioritized</p>
            </div>
            <div className="test-type-selector-grid">
                {testTypes.map((type) => {
                    const Icon = type.icon;
                    const isSelected = selectedType === type.id;
                    return (
                        <button
                            key={type.id}
                            className={`test-type-card ${isSelected ? 'selected' : ''}`}
                            onClick={() => onTypeChange(type.id)}
                        >
                            <div className="test-type-icon">
                                <Icon size={24} />
                            </div>
                            <div className="test-type-content">
                                <span className="test-type-label">{type.label}</span>
                                <span className="test-type-description">{type.description}</span>
                            </div>
                            <div className="test-type-radio">
                                <input
                                    type="radio"
                                    checked={isSelected}
                                    onChange={() => { }}
                                    readOnly
                                />
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

const FocusAreasSection = ({ selectedAreas, onToggle, testType }) => {
    const focusOptions = [
        // Functional options
        {
            id: 'edge_cases',
            label: 'Edge cases (functional boundaries)',
            description: 'Boundary conditions, limits, and unusual inputs',
            icon: Target,
            category: 'functional',
            badge: '🤖 Automation Candidate'
        },
        {
            id: 'negative_scenarios',
            label: 'Negative scenarios (error handling)',
            description: 'Failure paths, validation errors, and rejections',
            icon: AlertTriangle,
            category: 'functional',
            badge: '🤖 Automation Candidate'
        },
        // Non-functional options
        {
            id: 'performance_load',
            label: 'Performance & load testing (non-functional)',
            description: 'Response times, throughput, and scalability',
            icon: Zap,
            category: 'non_functional',
            badge: '🧪 Tool-Based / Manual'
        },
        {
            id: 'security_compliance',
            label: 'Security & compliance (non-functional)',
            description: 'Authentication, authorization, and data protection',
            icon: Shield,
            category: 'non_functional',
            badge: '🧪 Tool-Based / Manual'
        },
        {
            id: 'reliability_recovery',
            label: 'Reliability & failure recovery (non-functional)',
            description: 'Fault tolerance, disaster recovery, and resilience',
            icon: RefreshCw,
            category: 'non_functional',
            badge: '🧪 Tool-Based / Manual'
        },
        {
            id: 'usability',
            label: 'Usability (non-functional)',
            description: 'User experience, accessibility, and ease of use',
            icon: Users,
            category: 'non_functional',
            badge: '🧪 Tool-Based / Manual'
        },
        // API options
        {
            id: 'api_validations',
            label: 'API validations (integration-level)',
            description: 'Contracts, error codes, and backend validations',
            icon: Link,
            category: 'api',
            badge: '🤖 Automation Candidate'
        }
    ];

    const isFocusAreaDisabled = (option) => {
        if (testType === 'mixed') return false;
        if (testType === 'functional' && option.category !== 'functional') return true;
        if (testType === 'non_functional' && option.category !== 'non_functional') return true;
        if (testType === 'api' && option.category !== 'api') return true;
        return false;
    };

    return (
        <div className="refine-section">
            <div className="refine-section-header">
                <h4 className="refine-section-label">What should Testnexa AI focus on more?</h4>
                <p className="refine-section-subtitle">Select areas where you need deeper coverage</p>
            </div>
            <div className="focus-areas-grid">
                {focusOptions.map((option) => {
                    const Icon = option.icon;
                    const isSelected = selectedAreas.includes(option.id);
                    const isDisabled = isFocusAreaDisabled(option);
                    return (
                        <button
                            key={option.id}
                            className={`focus-checkbox-card ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                            onClick={() => !isDisabled && onToggle(option.id)}
                            disabled={isDisabled}
                        >
                            <div className="focus-checkbox-wrapper">
                                <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => { }}
                                    className="focus-checkbox-input"
                                    disabled={isDisabled}
                                />
                            </div>
                            <div className="focus-card-icon">
                                <Icon size={18} />
                            </div>
                            <div className="focus-card-content">
                                <span className="focus-card-label">{option.label}</span>
                                <span className="focus-card-description">{option.description}</span>
                                {option.badge && (
                                    <span className={`execution-context-badge ${option.category === 'functional' || option.category === 'api' ? 'automation-badge' : 'manual-badge'}`}>
                                        <span className="badge-icon">{option.badge.split(' ')[0]}</span>
                                        <span className="badge-label">{option.badge.substring(option.badge.indexOf(' ') + 1)}</span>
                                    </span>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

const TargetedFeedbackInput = ({ value, onChange }) => {
    const placeholders = [
        "Add more payment failure scenarios",
        "Focus on fraud detection edge cases",
        "Include slow network conditions",
        "Reduce happy-path duplication",
        "Add multi-currency validation",
        "Cover session timeout scenarios",
        "Include accessibility test cases"
    ];

    const [placeholder, setPlaceholder] = useState(placeholders[0]);

    useEffect(() => {
        const randomPlaceholder = placeholders[Math.floor(Math.random() * placeholders.length)];
        setPlaceholder(randomPlaceholder);
    }, []);

    const maxLength = 500;

    return (
        <div className="refine-section">
            <div className="refine-section-header">
                <h4 className="refine-section-label">What should be improved or corrected?</h4>
                <p className="refine-section-subtitle">Be specific about what's missing or needs adjustment</p>
            </div>
            <div className="feedback-textarea-wrapper">
                <textarea
                    className="feedback-textarea-luxury"
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    maxLength={maxLength}
                    rows={4}
                />
                <div className="feedback-char-counter">
                    <span className={value.length >= maxLength ? 'limit-reached' : ''}>
                        {value.length}/{maxLength}
                    </span>
                </div>
            </div>
        </div>
    );
};

const AssumptionOverridesSection = ({ assumptions, overrides, onOverrideChange }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!assumptions || assumptions.length === 0) {
        return null;
    }

    const parseAssumptions = () => {
        const fields = [];
        assumptions.forEach((assumption) => {
            const text = String(assumption || '');
            const lockMatch = text.match(/lock.*?(\d+)\s*(minute|min)/i);
            const retryMatch = text.match(/retry.*?(\d+)\s*(time|attempt)/i);
            const cvvMatch = text.match(/cvv.*?(\d+)\s*(digit)/i);
            const timeoutMatch = text.match(/timeout.*?(\d+)\s*(minute|min|second|sec)/i);
            const sizeMatch = text.match(/size.*?(\d+)\s*(mb|gb)/i);

            if (lockMatch) {
                fields.push({ key: 'lockDuration', label: 'Lock duration', value: parseInt(lockMatch[1]), unit: 'minutes' });
            } else if (retryMatch) {
                fields.push({ key: 'retryAttempts', label: 'Retry attempts', value: parseInt(retryMatch[1]), unit: 'times' });
            } else if (cvvMatch) {
                fields.push({ key: 'cvvLength', label: 'CVV length', value: parseInt(cvvMatch[1]), unit: 'digits' });
            } else if (timeoutMatch) {
                fields.push({ key: 'sessionTimeout', label: 'Session timeout', value: parseInt(timeoutMatch[1]), unit: 'minutes' });
            } else if (sizeMatch) {
                fields.push({ key: 'maxFileSize', label: 'Max file size', value: parseInt(sizeMatch[1]), unit: 'MB' });
            }
        });
        return fields;
    };

    const fields = parseAssumptions();

    if (fields.length === 0) {
        return null;
    }

    return (
        <div className="refine-section">
            <button
                className="assumption-override-header"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="assumption-header-left">
                    <h4 className="refine-section-label">Override assumptions (optional)</h4>
                    <span className="assumption-badge">{fields.length} assumption{fields.length > 1 ? 's' : ''} detected</span>
                </div>
                <div className="assumption-header-right">
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
            </button>

            {isExpanded && (
                <div className="assumption-overrides-content animate-slide-down">
                    <p className="refine-section-subtitle">Fine-tune parameters the AI inferred from your requirement</p>
                    <div className="assumption-fields-grid">
                        {fields.map((field) => (
                            <div key={field.key} className="assumption-override-field">
                                <label className="assumption-field-label">{field.label}</label>
                                <div className="assumption-field-input-wrapper">
                                    <input
                                        type="number"
                                        className="assumption-field-input"
                                        value={overrides[field.key] !== undefined ? overrides[field.key] : field.value}
                                        onChange={(e) => onOverrideChange(field.key, parseInt(e.target.value))}
                                        min="0"
                                    />
                                    <span className="assumption-field-unit">{field.unit}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button
                        className="btn-reset-assumptions"
                        onClick={() => onOverrideChange('reset', null)}
                    >
                        Reset to defaults
                    </button>
                </div>
            )}
        </div>
    );
};

const RegenerateButton = ({ onClick, isRegenerating, disabled }) => {
    return (
        <button
            className={`btn-regenerate-primary ${isRegenerating ? 'loading' : ''} ${disabled ? 'disabled' : ''}`}
            onClick={onClick}
            disabled={isRegenerating || disabled}
            title={disabled ? "Select at least one refinement option or provide feedback" : ""}
        >
            <RefreshCw size={18} className={isRegenerating ? 'animate-spin' : ''} />
            <span>{isRegenerating ? 'Regenerating...' : 'Regenerate with Refinements'}</span>
        </button>
    );
};

const RegenerationExplanationPanel = ({ testType, focusAreas, changes }) => {
    const getExplanation = () => {
        if (testType === 'non_functional') {
            return {
                title: 'What changed in this regeneration?',
                items: [
                    'Generated only non-functional test scenarios',
                    'Functional happy-path flows were intentionally skipped',
                    'Expanded security, performance, and reliability coverage',
                    `Added ${changes.testsAdded || 8} new non-functional test cases`
                ]
            };
        } else if (testType === 'functional') {
            return {
                title: 'What changed in this regeneration?',
                items: [
                    'Focused on functional test scenarios',
                    'Non-functional tests were intentionally excluded',
                    'Expanded edge cases and negative scenarios',
                    `Added ${changes.testsAdded || 12} new functional test cases`
                ]
            };
        } else if (testType === 'api') {
            return {
                title: 'What changed in this regeneration?',
                items: [
                    'Generated API-level integration tests',
                    'UI-level functional tests were intentionally skipped',
                    'Expanded contract validations and error handling',
                    `Added ${changes.testsAdded || 10} new API test cases`
                ]
            };
        } else {
            return {
                title: 'What changed in this regeneration?',
                items: changes.changesSummary || [
                    'Updated test suite based on your refinements',
                    'Expanded coverage across selected focus areas',
                    `Added ${changes.testsAdded || 15} new test cases`
                ]
            };
        }
    };

    const explanation = getExplanation();

    return (
        <div className="regeneration-explanation-panel glass-card animate-slide-down">
            <div className="explanation-header">
                <Info size={20} className="text-primary" />
                <h4>{explanation.title}</h4>
            </div>
            <ul className="explanation-list">
                {explanation.items.map((item, index) => (
                    <li key={index}>
                        <CheckCircle size={14} className="text-success" />
                        <span>{item}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
};

const PostRegenerationBanner = ({ changes, onDismiss }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onDismiss();
        }, 10000);

        return () => clearTimeout(timer);
    }, [onDismiss]);

    return (
        <div className="post-regen-banner animate-slide-down">
            <div className="banner-icon-wrapper">
                <CheckCircle size={32} className="text-success" />
            </div>
            <div className="banner-content">
                <h4 className="banner-title">Updated based on your feedback</h4>
                <ul className="banner-changes-list">
                    {changes.map((change, index) => (
                        <li key={index} className="banner-change-item">
                            <CheckCircle size={14} className="text-success" />
                            <span>{change}</span>
                        </li>
                    ))}
                </ul>
            </div>
            <button className="banner-dismiss-btn" onClick={onDismiss}>
                <X size={18} />
            </button>
        </div>
    );
};

const RefineRegeneratePanel = ({ onRegenerate, isRegenerating, testSuiteMetadata }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [testType, setTestType] = useState('mixed');
    const [focusAreas, setFocusAreas] = useState([]);
    const [targetedFeedback, setTargetedFeedback] = useState('');
    const [assumptionOverrides, setAssumptionOverrides] = useState({});
    const [showBanner, setShowBanner] = useState(false);
    const [showExplanation, setShowExplanation] = useState(false);
    const [changesSummary, setChangesSummary] = useState([]);
    const [regenerationMetadata, setRegenerationMetadata] = useState({});

    const handleTestTypeChange = (newType) => {
        setTestType(newType);

        // Auto-select focus areas based on test type
        if (newType === 'functional') {
            setFocusAreas(['edge_cases', 'negative_scenarios']);
        } else if (newType === 'non_functional') {
            setFocusAreas(['performance_load', 'security_compliance', 'reliability_recovery', 'usability']);
        } else if (newType === 'api') {
            setFocusAreas(['api_validations']);
        } else if (newType === 'mixed') {
            // Don't auto-select, let user choose
            setFocusAreas([]);
        }
    };

    const handleFocusAreaToggle = (areaId) => {
        setFocusAreas(prev =>
            prev.includes(areaId)
                ? prev.filter(id => id !== areaId)
                : [...prev, areaId]
        );
    };

    const handleOverrideChange = (key, value) => {
        if (key === 'reset') {
            setAssumptionOverrides({});
        } else {
            setAssumptionOverrides(prev => ({
                ...prev,
                [key]: value
            }));
        }
    };

    const handleRegenerate = async () => {
        const refinementData = {
            testType,
            focusAreas,
            targetedFeedback,
            assumptionOverrides
        };

        // Call the parent's regenerate function
        const result = await onRegenerate(refinementData);

        // Show explanation panel and success banner
        if (result) {
            setRegenerationMetadata(result.metadata || {});
            setChangesSummary(result.changesSummary || []);
            setShowExplanation(true);
            setShowBanner(true);
        }
    };

    const hasRefinements = focusAreas.length > 0 || targetedFeedback.trim().length > 0 || Object.keys(assumptionOverrides).length > 0;

    return (
        <>
            {showExplanation && (
                <RegenerationExplanationPanel
                    testType={testType}
                    focusAreas={focusAreas}
                    changes={regenerationMetadata}
                />
            )}

            {showBanner && (
                <PostRegenerationBanner
                    changes={changesSummary}
                    onDismiss={() => setShowBanner(false)}
                />
            )}

            <div className="refine-panel-luxury glass-card">
                <div className="refine-panel-header" onClick={() => setIsCollapsed(!isCollapsed)}>
                    <div className="refine-header-left">
                        <RefreshCw size={20} className="text-primary" />
                        <div className="refine-header-text">
                            <h3 className="refine-panel-title">Not satisfied with the results?</h3>
                            <p className="refine-panel-subtitle">Refine the output below and regenerate improved test cases.</p>
                        </div>
                    </div>
                    <button className="refine-collapse-btn">
                        {isCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                    </button>
                </div>

                {!isCollapsed && (
                    <div className="refine-panel-content">
                        <TestTypeFocusSelector
                            selectedType={testType}
                            onTypeChange={handleTestTypeChange}
                        />

                        <FocusAreasSection
                            selectedAreas={focusAreas}
                            onToggle={handleFocusAreaToggle}
                            testType={testType}
                        />

                        <TargetedFeedbackInput
                            value={targetedFeedback}
                            onChange={setTargetedFeedback}
                        />

                        <AssumptionOverridesSection
                            assumptions={testSuiteMetadata?.assumptions || []}
                            overrides={assumptionOverrides}
                            onOverrideChange={handleOverrideChange}
                        />

                        <div className="refine-action-footer">
                            <RegenerateButton
                                onClick={handleRegenerate}
                                isRegenerating={isRegenerating}
                                disabled={!hasRefinements}
                            />
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default RefineRegeneratePanel;
