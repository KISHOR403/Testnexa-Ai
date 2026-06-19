import React, { useState, useRef, useCallback } from 'react';
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
import {
    Sparkles, Terminal, AlertTriangle, HelpCircle, ChevronRight,
    ChevronDown, ChevronUp, Clock, Hash
} from 'lucide-react';


// ─── Helper: format timestamp ───
const formatTimestamp = (ts) => {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};


// ─── GenerationBlock: Collapsible wrapper for a single generation ───
const GenerationBlock = ({
    generation,
    versionLabel,
    isLatest,
    isGenerating,
    onSave,
    onRefineRegenerate,
    showClarification,
    setShowClarification,
}) => {
    const [collapsed, setCollapsed] = useState(!isLatest);
    const blockRef = useRef(null);

    const result = generation.result;
    const totalTests = result?.summary?.total ||
        ((result?.summary?.functional || 0) + (result?.summary?.negative || 0) +
         (result?.summary?.edge || 0) + (result?.summary?.apiChecklist || 0) +
         (result?.nonFunctional?.length || 0));

    return (
        <div
            ref={blockRef}
            id={`generation-${generation.id}`}
            className={`generation-block ${isLatest ? 'is-latest' : 'is-archived'} ${collapsed ? 'is-collapsed' : ''}`}
        >
            {/* Clickable header */}
            <div className="generation-header" onClick={() => setCollapsed(!collapsed)}>
                <div className="generation-header-left">
                    <span className="version-badge">{versionLabel}</span>
                    {isLatest && <span className="latest-pill">Latest</span>}
                    <span className="generation-prompt-preview" title={generation.prompt}>
                        {generation.prompt.length > 70
                            ? generation.prompt.slice(0, 70) + '…'
                            : generation.prompt}
                    </span>
                </div>
                <div className="generation-header-right">
                    <span className="generation-test-count">{totalTests} tests</span>
                    <span className="generation-timestamp">
                        <Clock size={13} />
                        {formatTimestamp(generation.timestamp)}
                    </span>
                    <span className={`generation-collapse-icon ${collapsed ? '' : 'rotated'}`}>
                        <ChevronDown size={18} />
                    </span>
                </div>
            </div>

            {/* Expandable content */}
            {!collapsed && (
                <div className="generation-content animate-slide-down">
                    {/* Clarification check — only on latest */}
                    {isLatest && showClarification && result?.questions?.length > 0 ? (
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
                                <h2 className="strong-heading text-gradient">{versionLabel} — Generation Results</h2>
                                <span className="timestamp-badge">{formatTimestamp(generation.timestamp)}</span>
                            </div>
                            <ResultsSection
                                result={result}
                                onSave={() => onSave(result)}
                                onRefineRegenerate={isLatest ? onRefineRegenerate : undefined}
                                isLatest={isLatest}
                            />
                        </>
                    )}
                </div>
            )}
        </div>
    );
};


// ─── VersionStrip: Horizontal navigation pills ───
const VersionStrip = ({ generations, activeGenerationId, onSelectGeneration }) => {
    if (generations.length <= 1) return null;

    return (
        <div className="version-strip glass-card">
            <span className="version-strip-label">
                <Hash size={14} />
                Versions
            </span>
            <div className="version-strip-pills">
                {generations.map((gen, idx) => (
                    <button
                        key={gen.id}
                        className={`version-pill ${gen.id === activeGenerationId ? 'active' : ''}`}
                        onClick={() => onSelectGeneration(gen.id)}
                        title={`${gen.prompt.slice(0, 50)}…`}
                    >
                        v{idx + 1}
                    </button>
                ))}
            </div>
        </div>
    );
};


// ─── Main Page ───
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

    // ── CORE FIX: Array of generations instead of a single result ──
    const [generations, setGenerations] = useState([]);
    const [activeGenerationId, setActiveGenerationId] = useState(null);

    const { saveToHistory } = useHistory();
    const [showClarification, setShowClarification] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [pageError, setPageError] = useState(null);
    const inputReveal = useScrollReveal({ threshold: 0.1 });

    // Derived: the latest generation's result (used by helpers)
    const latestGeneration = generations.length > 0 ? generations[generations.length - 1] : null;
    const latestResult = latestGeneration?.result || null;


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
        setShowClarification(false);
        setPageError(null);

        try {
            const generatedSuite = await apiService.generateTestSuite(reqToUse, settingsToUse);
            let finalSuite = generatedSuite;

            if (isRefinement && latestResult) {
                // Merge the new suite into the latest generation's result
                finalSuite = { ...latestResult };
                
                // Helper to merge arrays uniquely by ID or Title
                const mergeArrays = (arr1, arr2) => {
                    const map = new Map();
                    (arr1 || []).forEach(item => map.set(item.id || item.title, item));
                    (arr2 || []).forEach(item => map.set(item.id || item.title, item));
                    return Array.from(map.values());
                };

                finalSuite.functional = mergeArrays(latestResult.functional, generatedSuite.functional);
                finalSuite.negative = mergeArrays(latestResult.negative, generatedSuite.negative);
                finalSuite.edge = mergeArrays(latestResult.edge, generatedSuite.edge);
                
                const mergedApi = mergeArrays(latestResult.apiChecklist || latestResult.api, generatedSuite.apiChecklist || generatedSuite.api);
                finalSuite.apiChecklist = mergedApi;
                finalSuite.api = mergedApi;
                
                finalSuite.nonFunctional = mergeArrays(latestResult.nonFunctional, generatedSuite.nonFunctional);
                finalSuite.questions = Array.from(new Set([...(latestResult.questions || []), ...(generatedSuite.questions || [])]));
                
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
                    ...latestResult.metadata,
                    generatedAt: new Date().toISOString()
                };
            }

            console.log('API Response received (processed):', finalSuite);

            // ── CORE FIX: Append a new generation instead of overwriting ──
            const newGeneration = {
                id: crypto.randomUUID(),
                prompt: reqToUse,
                settings: settingsToUse,
                timestamp: Date.now(),
                result: finalSuite,
                isRefinement,
            };

            setGenerations(prev => [...prev, newGeneration]);
            setActiveGenerationId(newGeneration.id);
            console.log('New generation appended:', newGeneration.id);

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
            }, 300);
            
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

        // ── NEW: Pass previous output context so the AI can diff ──
        if (latestResult) {
            const allTestCases = [
                ...(latestResult.functional || []),
                ...(latestResult.negative || []),
                ...(latestResult.edge || []),
                ...(latestResult.apiChecklist || latestResult.api || []),
                ...(latestResult.nonFunctional || []),
            ];
            const tcSummary = allTestCases.slice(0, 30).map(tc => ({
                id: tc.id,
                title: tc.title,
                type: tc.type || 'Functional',
            }));
            enrichedReq += `\n\nPREVIOUSLY GENERATED TEST CASES (for reference — improve upon these, don't just repeat):\n${JSON.stringify(tcSummary)}`;
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

        const previousTotal = latestResult?.summary?.total || 
            ((latestResult?.summary?.functional || 0) + (latestResult?.summary?.negative || 0) + (latestResult?.summary?.edge || 0) + (latestResult?.apiChecklist?.length || latestResult?.api?.length || 0));

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

    // ── Scroll to a specific generation ──
    const scrollToGeneration = useCallback((genId) => {
        setActiveGenerationId(genId);
        const el = document.getElementById(`generation-${genId}`);
        if (el) {
            const yOffset = -80;
            const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
            window.scrollTo({ top: y, behavior: 'smooth' });
        }
    }, []);

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

                {/* 3. Generation Results — ALL generations, not just the latest */}
                {generations.length > 0 && (
                    <div
                        id="output-section"
                        className="output-section-wrapper animate-slide-up"
                        style={{ marginTop: '3rem' }}
                    >
                        {/* Version Strip — quick navigation */}
                        <VersionStrip
                            generations={generations}
                            activeGenerationId={activeGenerationId}
                            onSelectGeneration={scrollToGeneration}
                        />

                        {/* Generations Feed — newest first */}
                        <div className="generations-feed">
                            {[...generations].reverse().map((gen, idx) => (
                                <GenerationBlock
                                    key={gen.id}
                                    generation={gen}
                                    versionLabel={`Output ${generations.length - idx}`}
                                    isLatest={gen.id === generations[generations.length - 1].id}
                                    isGenerating={isGenerating}
                                    onSave={handleSave}
                                    onRefineRegenerate={handleRefineRegenerate}
                                    showClarification={showClarification}
                                    setShowClarification={setShowClarification}
                                />
                            ))}
                        </div>
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
