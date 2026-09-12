import React, { useState, useEffect, useCallback } from 'react';
import {
    X, Check, Award, CheckCircle2, ArrowRight, ChevronDown,
    Shield, Lock, CreditCard, Zap, Users, Building2,
    Minus
} from 'lucide-react';

/* ───────────────────────────────────────────
   Plan data
   ─────────────────────────────────────────── */
const PLANS = [
    {
        id: 'free',
        name: 'Free',
        icon: <Zap size={20} />,
        monthlyPrice: 0,
        annualPrice: 0,
        period: '/month',
        tagline: 'Try before you commit',
        description: 'For students, freelancers & curious devs testing the waters',
        features: [
            { text: '10 generations / month', included: true },
            { text: 'Functional & negative test cases', included: true },
            { text: 'Export to JSON only', included: true },
            { text: 'Community support', included: true },
            { text: 'Basic coverage analysis', included: true },
            { text: 'API & integration testing', included: false },
            { text: 'TMS export (TestRail, Zephyr)', included: false },
            { text: 'Priority support', included: false },
        ],
        cta: 'Current Plan',
        ctaStyle: 'muted',
        popular: false,
        accent: 'free',
    },
    {
        id: 'pro',
        name: 'Pro',
        icon: <Award size={20} />,
        monthlyPrice: 999,
        annualPrice: 799,
        period: '/month',
        tagline: 'Most popular for individual QA',
        description: 'For individual SDETs, freelance QA engineers & power users',
        features: [
            { text: '500 generations / month', included: true },
            { text: 'All test types (functional, negative, edge, API)', included: true },
            { text: 'Export to JSON, Markdown & CSV', included: true },
            { text: 'Priority email support (24hr SLA)', included: true },
            { text: 'Advanced coverage analytics', included: true },
            { text: 'TMS export — TestRail & Zephyr', included: true, soon: true },
            { text: 'Automation feasibility scoring', included: true, soon: true },
            { text: 'Early access to new features', included: true },
        ],
        cta: 'Upgrade to Pro',
        ctaStyle: 'primary',
        popular: true,
        accent: 'pro',
    },
    {
        id: 'team',
        name: 'Team',
        icon: <Users size={20} />,
        monthlyPrice: 3499,
        annualPrice: 2799,
        period: '/month',
        tagline: 'Built for QA squads',
        description: 'For small QA teams of 3–10 people with shared workspace',
        features: [
            { text: 'Everything in Pro', included: true, highlight: true },
            { text: '5 seats included', included: true },
            { text: '2,000 generations / month (pooled)', included: true },
            { text: 'Shared team workspace', included: true },
            { text: 'RTM generation', included: true, soon: true },
            { text: 'Direct export to Azure DevOps', included: true, soon: true },
            { text: 'Team usage analytics dashboard', included: true },
            { text: 'Dedicated onboarding session', included: true },
        ],
        cta: 'Start Team Trial',
        ctaStyle: 'secondary',
        popular: false,
        accent: 'team',
    },
    {
        id: 'enterprise',
        name: 'Enterprise',
        icon: <Building2 size={20} />,
        monthlyPrice: null,
        annualPrice: null,
        period: '',
        tagline: 'Tailored for your org',
        description: 'For organizations with 20+ seats needing custom solutions',
        features: [
            { text: 'Everything in Team', included: true, highlight: true },
            { text: 'Unlimited generations (fair-use)', included: true },
            { text: 'SSO & advanced security (SAML)', included: true },
            { text: 'Custom AI model fine-tuning', included: true },
            { text: 'Dedicated success manager', included: true },
            { text: 'SLA guarantees (99.9% uptime)', included: true },
            { text: 'On-premise deployment option', included: true },
            { text: 'Custom integrations & API access', included: true },
        ],
        cta: 'Contact Sales',
        ctaStyle: 'outline',
        popular: false,
        accent: 'enterprise',
    },
];

const FAQ_ITEMS = [
    {
        q: 'Can I cancel anytime?',
        a: 'Yes — you can cancel your subscription at any time from your account settings. Your access continues until the end of the current billing period. No penalties, no lock-in.',
    },
    {
        q: 'Do you offer refunds?',
        a: 'Absolutely. We offer a 7-day money-back guarantee on all paid plans. If you\'re not satisfied, contact us within 7 days of purchase for a full refund, no questions asked.',
    },
    {
        q: 'What payment methods do you accept?',
        a: 'We accept all major credit/debit cards (Visa, Mastercard, Amex, RuPay), UPI, net banking, and international cards. Payments are securely processed via Razorpay.',
    },
    {
        q: 'Is my data secure?',
        a: 'Your data is encrypted with AES-256 at rest and TLS 1.3 in transit. We never store your source code or requirements beyond the active session. Our infrastructure is SOC-2 compliant.',
    },
    {
        q: 'Can I switch between plans?',
        a: 'Yes — upgrade or downgrade anytime. When upgrading, you\'ll get immediate access to new features with pro-rated billing. When downgrading, the change takes effect at the next billing cycle.',
    },
    {
        q: 'What happens when I hit my generation limit?',
        a: 'You\'ll receive a notification at 80% and 100% usage. Once you hit the limit, you can upgrade your plan or wait for the next billing cycle to reset. We never delete your existing work.',
    },
];

/* ───────────────────────────────────────────
   Component
   ─────────────────────────────────────────── */
const UpgradeModal = ({ isOpen, onClose }) => {
    const [billingCycle, setBillingCycle] = useState('monthly');
    const [selectedPlan, setSelectedPlan] = useState('pro');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [openFaq, setOpenFaq] = useState(null);

    useEffect(() => {
        if (!isOpen) {
            setTimeout(() => {
                setSelectedPlan('pro');
                setSubmitted(false);
                setBillingCycle('monthly');
                setOpenFaq(null);
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

    const handleUpgrade = useCallback((planId) => {
        if (planId === 'enterprise') {
            window.open('mailto:sales@testnexa.ai?subject=Enterprise%20Inquiry', '_blank');
            return;
        }
        if (planId === 'free') return;

        setIsSubmitting(true);
        setSelectedPlan(planId);
        setTimeout(() => {
            setIsSubmitting(false);
            setSubmitted(true);
            setTimeout(() => onClose(), 2500);
        }, 1500);
    }, [onClose]);

    const formatPrice = (price) => {
        if (price === null) return 'Custom';
        if (price === 0) return '₹0';
        return `₹${price.toLocaleString('en-IN')}`;
    };

    if (!isOpen) return null;

    return (
        <div className="upgrade-modal-overlay" onClick={onClose}>
            <div className="upgrade-modal-v2" onClick={(e) => e.stopPropagation()}>
                <button className="upgrade-modal-close" onClick={onClose}>
                    <X size={18} />
                </button>

                {submitted ? (
                    <div className="upgrade-success">
                        <div className="upgrade-success-icon-wrap">
                            <CheckCircle2 size={32} />
                        </div>
                        <h3>Welcome to {PLANS.find(p => p.id === selectedPlan)?.name}!</h3>
                        <p>Your account has been upgraded successfully. You now have access to all {selectedPlan} features.</p>
                    </div>
                ) : (
                    <div className="upgrade-modal-scroll">
                        {/* ── Header ── */}
                        <div className="upgrade-modal-header">
                            <div className="upgrade-header-badge">
                                <Award size={14} />
                                <span>Choose Your Plan</span>
                            </div>
                            <h3>Simple, transparent pricing</h3>
                            <p>Start free. Upgrade when you're ready. Cancel anytime.</p>
                        </div>

                        {/* ── Billing Toggle ── */}
                        <div className="billing-toggle-wrap">
                            <div className="billing-toggle">
                                <button
                                    className={`billing-toggle-btn ${billingCycle === 'monthly' ? 'active' : ''}`}
                                    onClick={() => setBillingCycle('monthly')}
                                >
                                    Monthly
                                </button>
                                <button
                                    className={`billing-toggle-btn ${billingCycle === 'annual' ? 'active' : ''}`}
                                    onClick={() => setBillingCycle('annual')}
                                >
                                    Annual
                                    <span className="save-badge">Save 20%</span>
                                </button>
                                <div className={`billing-toggle-slider ${billingCycle === 'annual' ? 'slide-right' : ''}`} />
                            </div>
                        </div>

                        {/* ── Plans Grid ── */}
                        <div className="upgrade-plans-grid-v2">
                            {PLANS.map((plan) => {
                                const price = billingCycle === 'annual' ? plan.annualPrice : plan.monthlyPrice;
                                const isCurrentPlan = plan.id === 'free';
                                return (
                                    <div
                                        key={plan.id}
                                        className={`upgrade-plan-card-v2 accent-${plan.accent} ${plan.popular ? 'plan-popular-v2' : ''} ${selectedPlan === plan.id ? 'plan-selected-v2' : ''}`}
                                        onClick={() => setSelectedPlan(plan.id)}
                                    >
                                        {plan.popular && <div className="plan-popular-badge-v2">Most Popular</div>}

                                        <div className="plan-header-v2">
                                            <div className="plan-icon-name">
                                                <div className={`plan-icon-wrap accent-${plan.accent}`}>
                                                    {plan.icon}
                                                </div>
                                                <h4 className="plan-name-v2">{plan.name}</h4>
                                            </div>

                                            <div className="plan-price-wrap-v2">
                                                <span className="plan-price-v2">{formatPrice(price)}</span>
                                                {plan.period && <span className="plan-period-v2">{plan.period}</span>}
                                            </div>

                                            {billingCycle === 'annual' && plan.annualPrice !== null && plan.annualPrice > 0 && (
                                                <div className="plan-annual-note">
                                                    Billed ₹{(plan.annualPrice * 12).toLocaleString('en-IN')}/year
                                                </div>
                                            )}

                                            <p className="plan-desc-v2">{plan.description}</p>
                                        </div>

                                        <div className="plan-features-v2">
                                            {plan.features.map((feature, i) => (
                                                <div key={i} className={`plan-feature-item-v2 ${!feature.included ? 'feature-excluded' : ''} ${feature.highlight ? 'feature-highlight' : ''}`}>
                                                    <div className={`feature-check-v2 ${!feature.included ? 'check-excluded' : ''}`}>
                                                        {feature.included ? <Check size={12} /> : <Minus size={12} />}
                                                    </div>
                                                    <span>
                                                        {feature.text}
                                                        {feature.soon && <span className="coming-soon-badge">Soon</span>}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>

                                        <button
                                            className={`plan-btn-v2 plan-btn-${plan.ctaStyle}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleUpgrade(plan.id);
                                            }}
                                            disabled={isSubmitting || isCurrentPlan}
                                        >
                                            <span>
                                                {isSubmitting && selectedPlan === plan.id
                                                    ? 'Processing...'
                                                    : plan.cta}
                                            </span>
                                            {!isSubmitting && !isCurrentPlan && <ArrowRight size={16} />}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>

                        {/* ── Trust Badges ── */}
                        <div className="trust-badges-row">
                            <div className="trust-badge">
                                <Lock size={14} />
                                <span>Secured by Razorpay</span>
                            </div>
                            <div className="trust-badge">
                                <Shield size={14} />
                                <span>7-day money-back guarantee</span>
                            </div>
                            <div className="trust-badge">
                                <CreditCard size={14} />
                                <span>AES-256 encryption</span>
                            </div>
                        </div>

                        {/* ── FAQ Section ── */}
                        <div className="upgrade-faq-section">
                            <h4 className="faq-section-title">Frequently Asked Questions</h4>
                            <div className="faq-list">
                                {FAQ_ITEMS.map((item, i) => (
                                    <div
                                        key={i}
                                        className={`faq-item ${openFaq === i ? 'faq-open' : ''}`}
                                    >
                                        <button
                                            className="faq-question"
                                            onClick={() => setOpenFaq(openFaq === i ? null : i)}
                                        >
                                            <span>{item.q}</span>
                                            <ChevronDown size={16} className={`faq-chevron ${openFaq === i ? 'faq-chevron-open' : ''}`} />
                                        </button>
                                        <div className="faq-answer-wrap">
                                            <div className="faq-answer">
                                                <p>{item.a}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UpgradeModal;
