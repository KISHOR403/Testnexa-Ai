import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export const BrandIntro = ({ onComplete }) => {
    const [isVisible, setIsVisible] = useState(true);

    const handleSkip = () => {
        setIsVisible(false);
        if (onComplete) onComplete();
    };

    useEffect(() => {
        // Automatically dismiss after 1.1s
        const timer = setTimeout(() => {
            handleSkip();
        }, 1100);

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                handleSkip();
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            clearTimeout(timer);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    className="tn-brand-intro-overlay"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } }}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 999999,
                        background: '#000000',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'auto'
                    }}
                    role="dialog"
                    aria-label="Brand Introduction"
                >
                    <div style={{ textAlign: 'center', position: 'relative' }}>
                        {/* 1s Logo Stroke Draw Animation */}
                        <svg
                            width="64"
                            height="64"
                            viewBox="0 0 32 32"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            style={{ margin: '0 auto 18px' }}
                        >
                            {/* Outer Hexagon Draw */}
                            <motion.path
                                d="M16 2.5 L27.5 9.2 V22.8 L16 29.5 L4.5 22.8 V9.2 Z"
                                stroke="#FFFFFF"
                                strokeWidth="1.75"
                                strokeLinejoin="round"
                                initial={{ pathLength: 0, opacity: 0 }}
                                animate={{ pathLength: 1, opacity: 1 }}
                                transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                            />

                            {/* Inner Facets Draw */}
                            <motion.path
                                d="M16 2.5 V16 M4.5 9.2 L16 16 M27.5 9.2 L16 16"
                                stroke="#FFFFFF"
                                strokeWidth="1.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                initial={{ pathLength: 0, opacity: 0 }}
                                animate={{ pathLength: 1, opacity: 0.4 }}
                                transition={{ duration: 0.5, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
                            />

                            {/* Central Core Accent Glow */}
                            <motion.path
                                d="M16 10 L22 14 V20 L16 23.5 L10 20 Z"
                                stroke="#7DD3FC"
                                strokeWidth="1.5"
                                fill="rgba(125, 211, 252, 0.2)"
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ duration: 0.4, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
                            />

                            <motion.circle
                                cx="16"
                                cy="16"
                                r="2.2"
                                fill="#FFFFFF"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ duration: 0.3, delay: 0.45 }}
                            />
                        </svg>

                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.45, delay: 0.2 }}
                            style={{
                                fontFamily: "'Space Grotesk', sans-serif",
                                fontSize: '20px',
                                fontWeight: 600,
                                letterSpacing: '0.12em',
                                color: '#FFFFFF',
                                textTransform: 'uppercase'
                            }}
                        >
                            TestNexa<span style={{ color: '#7DD3FC' }}>.</span>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.4, delay: 0.4 }}
                            style={{
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: '12px',
                                letterSpacing: '0.18em',
                                color: 'rgba(255, 255, 255, 0.45)',
                                marginTop: '6px'
                            }}
                        >
                            INTELLIGENT QA REASONING ENGINE
                        </motion.div>
                    </div>

                    {/* Minimalist Skip Button */}
                    <button
                        type="button"
                        onClick={handleSkip}
                        style={{
                            position: 'absolute',
                            bottom: '36px',
                            right: '40px',
                            background: 'transparent',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            borderRadius: '3px',
                            color: 'rgba(255, 255, 255, 0.55)',
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: '12px',
                            padding: '6px 14px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#FFFFFF';
                            e.currentTarget.style.borderColor = '#7DD3FC';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.55)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                        }}
                    >
                        Skip [Esc]
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default BrandIntro;
