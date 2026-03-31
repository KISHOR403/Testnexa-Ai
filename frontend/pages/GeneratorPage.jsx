import React, { useState } from 'react';
import Hero from '../components/Hero';
import PainPoints from '../components/PainPoints';
import Features from '../components/Features';
import WhoIsThisFor from '../components/WhoIsThisFor';
import HowItWorks from '../components/HowItWorks';
import WhyThisMatters from '../components/WhyThisMatters';
import InputPanel from '../components/InputPanel';
import SettingsPanel from '../components/SettingsPanel';
import LoadingArea from '../components/LoadingArea';
import ResultsSection from '../components/ResultsSection';
import LoginModal from '../components/LoginModal';
import { apiService } from '../services/apiService';
import { useHistory } from '../hooks/useHistory';
import useScrollReveal from '../hooks/useScrollReveal';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { Sparkles, Terminal, AlertTriangle, HelpCircle, ChevronRight } from 'lucide-react';


const GeneratorPage = () => {
    const { isAuthenticated, canGenerateAsGuest, incrementGuestUsage, setPendingAction } = useAuth();
    const { settings: globalSettings } = useSettings();
    const [requirement, setRequirement] = useState('');
    const [settings, setSettings] = useState({
        type: 'web',
        level: 'Standard',
        language: 'english'
    });

    // Global Error Reporter for Crashes
    React.useEffect(() => {
        const handleError = (event) => {
            alert(`CRITICAL UI CRASH: ${event.message}\nAt: ${event.filename}:${event.lineno}`);
            console.error('Full UI Error:', event);
        };
        window.addEventListener('error', handleError);
        return () => window.removeEventListener('error', handleError);
    }, []);

    const [isGenerating, setIsGenerating] = useState(false);
    const [result, setResult] = useState(null);
    const { saveToHistory } = useHistory();
    const [showClarification, setShowClarification] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [pageError, setPageError] = useState(null);
    const inputReveal = useScrollReveal({ threshold: 0.1 });


    React.useEffect(() => {
        // --- Post-Login Resume Logic ---
        const checkResume = async () => {
            const savedData = localStorage.getItem('testnexa_pending_generation');
            if (isAuthenticated && savedData) {
                try {
                    const { requirement: savedReq, settings: savedSettings } = JSON.parse(savedData);

                    // Restore state
                    setRequirement(savedReq);
                    setSettings(savedSettings);

                    // Clear storage first to prevent loops
                    localStorage.removeItem('testnexa_pending_generation');

                    // Trigger generation
                    console.log('Resuming generation after login...');
                    // We need to pass the values directly because state updates might not be flushed yet
                    await handleActualGenerate(savedReq, savedSettings);
                } catch (e) {
                    console.error('Failed to resume generation:', e);
                    localStorage.removeItem('testnexa_pending_generation');
                }
            }
        };

        checkResume();
    }, [isAuthenticated]);

    const handleSave = (suite) => {
        saveToHistory(suite, requirement, settings);
        alert("Saved to history!");
    };

    const handleGenerate = async () => {
        if (!requirement.trim()) return;

        // Auth Guard Logic
        if (!isAuthenticated) {
            // Check if guest can still generate
            if (!canGenerateAsGuest()) {
                // Save current state to resume after login
                localStorage.setItem('testnexa_pending_generation', JSON.stringify({
                    requirement,
                    settings
                }));

                // Show login modal
                setShowLoginModal(true);
                // Store the generation action (for non-refresh scenarios like email login if implemented later)
                setPendingAction(() => handleActualGenerate);
                return;
            }
            // Increment guest usage counter
            incrementGuestUsage();
        }

        // Proceed with generation
        await handleActualGenerate();
    };

    const handleActualGenerate = async (overrideReq = null, overrideSettings = null) => {
        const reqToUse = overrideReq !== null ? overrideReq : requirement;
        const settingsToUse = overrideSettings !== null ? overrideSettings : settings;

        if (!reqToUse.trim()) return;

        setIsGenerating(true);
        setResult(null);
        setShowClarification(false);
        setPageError(null);

        try {
            const generatedSuite = await apiService.generateTestSuite(reqToUse, settingsToUse);
            console.log('API Response received:', generatedSuite);
            setResult(generatedSuite);
            console.log('Result state updated:', !!generatedSuite);

            // Auto-save to history
            saveToHistory(generatedSuite, reqToUse, settingsToUse);

            if (generatedSuite.quality?.ambiguityScore === 'High' && generatedSuite.questions?.length > 0) {
                setShowClarification(true);
            }

            // Desktop Notification
            if (globalSettings.notifications && Notification.permission === 'granted') {
                new Notification('Test Suite Ready!', {
                    body: `AI has successfully generated ${generatedSuite.testCases?.length || 0} test cases for your requirement.`,
                    icon: '/favicon.ico'
                });
            }

            setTimeout(() => {
                const outputSection = document.getElementById('output-section');
                if (outputSection) {
                    const yOffset = -80; // Offset for fixed navbar
                    const y = outputSection.getBoundingClientRect().top + window.pageYOffset + yOffset;
                    window.scrollTo({ top: y, behavior: 'smooth' });
                }
            }, 300); // Slightly longer delay to ensure DOM is ready
        } catch (error) {
            console.error('Generation failed:', error);
            setPageError(error.message);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="home-page">
            {/* 1. Hero - What is Testnexa AI? */}
            <Hero />

            <div className="container" style={{ paddingBottom: '8rem' }}>
                {/* 2. Requirement Input - Primary action (Try It) */}
                <div
                    ref={inputReveal.ref}
                    className={`generator-content-wrapper scroll-reveal-zoom ${inputReveal.isVisible ? 'revealed' : ''}`}
                >
                    <InputPanel
                        value={requirement}
                        onChange={setRequirement}
                        onGenerate={handleGenerate}
                        isGenerating={isGenerating}
                        settings={settings}
                        setSettings={setSettings}
                    />
                </div>

                <LoadingArea isGenerating={isGenerating} />

                {pageError && (
                    <div className="form-error-banner animate-fade-in" style={{ marginTop: '2rem' }}>
                        <AlertTriangle size={20} />
                        <span>{pageError}</span>
                    </div>
                )}

                {/* 3. Generation Results - Conditional (only after Generate) */}
                {result && (
                    <div
                        id="output-section"
                        className="output-section-wrapper animate-slide-up"
                        style={{
                            marginTop: '3rem'
                        }}
                    >
                        {showClarification ? (
                            <div className="clarification-required-luxury glass-card luxury-glow">
                                <div className="clarification-header">
                                    <div className="warning-icon-badge">
                                        <AlertTriangle size={24} className="text-warning" />
                                    </div>
                                    <div className="header-text">
                                        <h2 className="clarification-title">Clarification Required</h2>
                                        <p className="clarification-subtitle">To generate high-accuracy tests, the AI needs more details on these points.</p>
                                    </div>
                                </div>

                                <div className="questions-list-luxury">
                                    {result.questions.map((q, i) => (
                                        <div key={i} className="question-item-v2 glass-card">
                                            <HelpCircle size={18} className="text-primary" />
                                            <p className="question-text">{q}</p>
                                        </div>
                                    ))}
                                </div>

                                <div className="clarification-footer">
                                    <button
                                        className="btn-secondary-bright"
                                        onClick={() => setShowClarification(false)}
                                    >
                                        Proceed with current logic
                                    </button>
                                    <button
                                        className="btn-primary-bright"
                                        onClick={() => {
                                            const el = document.querySelector('.prompt-textarea');
                                            if (el) el.focus();
                                        }}
                                    >
                                        <span>Refine Requirement</span>
                                        <ChevronRight size={18} />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="result-header-row">
                                    <h2 className="strong-heading text-gradient">Generation Results</h2>
                                    <span className="timestamp-badge">Generated just now</span>
                                </div>
                                <ResultsSection result={result} onSave={() => handleSave(result)} />
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* 4. Key Features */}
            <Features />

            {/* 5. Real QA Pain Points, Solved */}
            <PainPoints />

            {/* 5. How Testnexa AI Works */}
            <HowItWorks />

            {/* 6. Who is this for? */}
            <WhoIsThisFor />

            {/* 7. Why This Matters */}
            <WhyThisMatters />

            {/* Login Modal */}
            <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
        </div>
    );
};

export default GeneratorPage;
