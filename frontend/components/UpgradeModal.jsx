import React, { useState, useEffect } from 'react';
import { X, Check, Sparkles, Zap, Shield, ArrowRight } from 'lucide-react';

const plans = [
    {
        id: 'pro',
        name: 'Pro',
        price: '₹999/',
        period: '/month',
        description: 'For individuals and small teams',
        features: [
            'Unlimited tests generation',
            'Full API & Integration testing',
            'Export to JSON, Markdown, CSV',
            'Priority email support',
            'Early access to new features'
        ],
        popular: true,
        buttonText: 'Upgrade to Pro'
    },
    {
        id: 'enterprise',
        name: 'Enterprise',
        price: 'Custom',
        period: '',
        description: 'For scaling organizations',
        features: [
            'Everything in Pro',
            'Custom AI model training',
            'SSO & Advanced Security',
            'Dedicated success manager',
            'SLA guarantees'
        ],
        popular: false,
        buttonText: 'Contact Sales'
    }
];

const UpgradeModal = ({ isOpen, onClose }) => {
    const [selectedPlan, setSelectedPlan] = useState('pro');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setTimeout(() => {
                setSelectedPlan('pro');
                setSubmitted(false);
            }, 200);
        }
    }, [isOpen]);

    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape' && isOpen) onClose();
        };
        document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    const handleUpgrade = (planId) => {
        setIsSubmitting(true);
        // Simulate API call for upgrade
        setTimeout(() => {
            setIsSubmitting(false);
            setSubmitted(true);
            setTimeout(() => {
                onClose();
            }, 2500);
        }, 1500);
    };

    if (!isOpen) return null;

    return (
        <div className="upgrade-modal-overlay" onClick={onClose}>
            <div className="upgrade-modal" onClick={(e) => e.stopPropagation()}>
                {/* Close button */}
                <button className="upgrade-modal-close" onClick={onClose}>
                    <X size={18} />
                </button>

                {submitted ? (
                    <div className="upgrade-success">
                        <div className="upgrade-success-icon-wrap">
                            <Sparkles size={32} />
                        </div>
                        <h3>Welcome to Pro!</h3>
                        <p>Your account has been upgraded successfully. You now have access to all premium features.</p>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="upgrade-modal-header">
                            <div className="upgrade-header-badge">
                                <Sparkles size={14} />
                                <span>Upgrade Plan</span>
                            </div>
                            <h3>Unlock Next-Level QA</h3>
                            <p>Generate complex test scenarios instantly with advanced AI</p>
                        </div>

                        {/* Plans Grid */}
                        <div className="upgrade-plans-grid">
                            {plans.map((plan) => (
                                <div
                                    key={plan.id}
                                    className={`upgrade-plan-card ${plan.popular ? 'plan-popular' : ''} ${selectedPlan === plan.id ? 'plan-selected' : ''}`}
                                    onClick={() => setSelectedPlan(plan.id)}
                                >
                                    {plan.popular && <div className="plan-popular-badge">Most Popular</div>}

                                    <div className="plan-header">
                                        <h4 className="plan-name">{plan.name}</h4>
                                        <div className="plan-price-wrap">
                                            <span className="plan-price">{plan.price}</span>
                                            <span className="plan-period">{plan.period}</span>
                                        </div>
                                        <p className="plan-desc">{plan.description}</p>
                                    </div>

                                    <div className="plan-features">
                                        {plan.features.map((feature, i) => (
                                            <div key={i} className="plan-feature-item">
                                                <div className="feature-check">
                                                    <Check size={12} />
                                                </div>
                                                <span>{feature}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <button
                                        className={`plan-btn ${plan.popular ? 'plan-btn-primary' : 'plan-btn-secondary'}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleUpgrade(plan.id);
                                        }}
                                        disabled={isSubmitting}
                                    >
                                        <span>{isSubmitting && selectedPlan === plan.id ? 'Processing...' : plan.buttonText}</span>
                                        {!isSubmitting && <ArrowRight size={16} />}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default UpgradeModal;
