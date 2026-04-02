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

    const handleActualGenerate = async (overrideReq = null, overrideSettings = null, isRefinement = false) => {
        const reqToUse = overrideReq !== null ? overrideReq : requirement;
        const settingsToUse = overrideSettings !== null ? overrideSettings : settings;

        if (!reqToUse.trim()) return;

        setIsGenerating(true);
        if (!isRefinement) {
            setResult(null);
        }
        setShowClarification(false);
        setPageError(null);

        try {
            const generatedSuite = await apiService.generateTestSuite(reqToUse, settingsToUse);
            let finalSuite = generatedSuite;

            if (isRefinement && result) {
                // Merge the new suite into the old suite
                finalSuite = { ...result };
                
                // Helper to merge arrays uniquely by ID or Title
                const mergeArrays = (arr1, arr2) => {
                    const map = new Map();
                    (arr1 || []).forEach(item => map.set(item.id || item.title, item));
                    (arr2 || []).forEach(item => map.set(item.id || item.title, item));
                    return Array.from(map.values());
                };

                finalSuite.functional = mergeArrays(result.functional, generatedSuite.functional);
                finalSuite.negative = mergeArrays(result.negative, generatedSuite.negative);
                finalSuite.edge = mergeArrays(result.edge, generatedSuite.edge);
                finalSuite.apiChecklist = mergeArrays(result.apiChecklist, generatedSuite.apiChecklist);
                finalSuite.api = mergeArrays(result.api, generatedSuite.api);
                finalSuite.nonFunctional = mergeArrays(result.nonFunctional, generatedSuite.nonFunctional);
                finalSuite.questions = Array.from(new Set([...(result.questions || []), ...(generatedSuite.questions || [])]));
                
                const getApiCount = (suite) => Math.max(suite.apiChecklist?.length || 0, suite.api?.length || 0);
                
                // Update summary counts
                finalSuite.summary = {
                    ...finalSuite.summary,
                    functional: finalSuite.functional.length,
                    negative: finalSuite.negative.length,
                    edge: finalSuite.edge.length,
                    apiChecklist: getApiCount(finalSuite),
                    nonFunctional: finalSuite.nonFunctional.length,
                    total: finalSuite.functional.length + finalSuite.negative.length + finalSuite.edge.length + 
                           getApiCount(finalSuite) + finalSuite.nonFunctional.length
                };
                
                // Merge metadata intelligently
                finalSuite.metadata = {
                    ...result.metadata,
                    generatedAt: new Date().toISOString()
                };
            }

            console.log('API Response received (processed):', finalSuite);
            setResult(finalSuite);
            console.log('Result state updated:', !!finalSuite);

            // Auto-save to history
            saveToHistory(finalSuite, reqToUse, settingsToUse);

            if (finalSuite.quality?.ambiguityScore === 'High' && finalSuite.questions?.length > 0) {
                setShowClarification(true);
            }

            // Desktop Notification
            if (globalSettings.notifications && Notification.permission === 'granted') {
                new Notification('Test Suite Ready!', {
                    body: `AI has successfully generated ${finalSuite.summary?.total || 0} test cases for your requirement.`,
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
            
            return finalSuite;
        } catch (error) {
            console.error('Generation failed:', error);
            setPageError(error.message);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleRefineRegenerate = async (refinementData) => {
        let enrichedReq = requirement + "\n\n--- ADDITIONAL CONTEXT & REFINEMENTS ---\n";
        if (refinementData.targetedFeedback) {
            enrichedReq += `\nFeedback: ${refinementData.targetedFeedback}`;
        }
        if (refinementData.focusAreas && refinementData.focusAreas.length > 0) {
            enrichedReq += `\nFocus Areas: ${refinementData.focusAreas.join(', ')}`;
        }
        if (refinementData.assumptionOverrides && Object.keys(refinementData.assumptionOverrides).length > 0) {
            enrichedReq += "\nOverwritten Assumptions: " + JSON.stringify(refinementData.assumptionOverrides);
        }

        // Auth Guard Logic for Refinement
        if (!isAuthenticated) {
            if (!canGenerateAsGuest()) {
                setShowLoginModal(true);
                return null;
            }
            incrementGuestUsage();
        }

        const updatedSettings = {
            ...settings,
            testFocus: refinementData.testType
        };

        const previousTotal = result?.summary?.total || 
            ((result?.summary?.functional || 0) + (result?.summary?.negative || 0) + (result?.summary?.edge || 0) + (result?.apiChecklist?.length || result?.api?.length || 0));

        const newSuite = await handleActualGenerate(enrichedReq, updatedSettings, true);

        if (newSuite) {
            const newTotal = newSuite.summary?.total || 
                ((newSuite.summary?.functional || 0) + (newSuite.summary?.negative || 0) + (newSuite.summary?.edge || 0) + Math.max(newSuite.apiChecklist?.length || 0, newSuite.api?.length || 0) + (newSuite.summary?.nonFunctional || 0));
            
            const diff = newTotal - previousTotal;
            const actualAdded = Math.max(0, diff);

            return {
                changesSummary: [
                    "Merged your refinements perfectly!",
                    `Expanded coverage in: ${refinementData.testType}`,
                    `Your suite now has ${newTotal} total test cases.`,
                    actualAdded > 0 ? `Successfully isolated and added ${actualAdded} new test case(s).` : "Existing test cases were optimized without increasing the total count."
                ],
                metadata: { testsAdded: actualAdded }
            };
        }
        return null;
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <span>{pageError.replace('Test generation failed: ', '')}</span>
                            {pageError.includes("couldn't understand") && (
                                <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>
                                    💡 Try something like: "User registration with email, password, and phone number validation"
                                </span>
                            )}
                        </div>
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
                                <ResultsSection result={result} onSave={() => handleSave(result)} onRefineRegenerate={handleRefineRegenerate} />
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
