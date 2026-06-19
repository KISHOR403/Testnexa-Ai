import React, { useState, useCallback } from 'react';
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
    ChevronDown, Clock, Hash
} from 'lucide-react';


// ─── Helper: format relative timestamp ───
const formatRelativeTime = (ts) => {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now - d;
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// ─── Helper: build compact stats string from a result ───
const buildStatsString = (result) => {
    if (!result) return '';
    const f = result.summary?.functional || result.functional?.length || 0;
    const n = result.summary?.negative || result.negative?.length || 0;
    const e = result.summary?.edge || result.edge?.length || 0;
    const a = result.summary?.apiChecklist || result.apiChecklist?.length || result.api?.length || 0;
    const nf = result.summary?.nonFunctional || result.nonFunctional?.length || 0;
    const parts = [];
    if (f) parts.push(`${f}F`);
    if (n) parts.push(`${n}N`);
    if (e) parts.push(`${e}E`);
    if (a) parts.push(`${a}API`);
    if (nf) parts.push(`${nf}NF`);
    return parts.join(' · ') || '0 tests';
};


// ─── VersionBlock: A single generation in the accordion ───
// isOpen is controlled entirely by the parent — no local collapse state.
// When closed, body is NOT mounted (perf).
const VersionBlock = ({
    generation,
    versionNumber,
    isLatest,
    isOpen,
    onToggle,
    onSave,
    onRefineRegenerate,
    showClarification,
    setShowClarification,
}) => {
    const result = generation.result;
    const promptPreview = (generation.prompt || '').replace(/\n/g, ' ');

    return (
        <div
            id={`generation-${generation.id}`}
            className={`version-block ${isLatest ? 'is-latest' : ''} ${isOpen ? 'is-open' : ''}`}
        >
            {/* ── Clickable header row ── */}
            <button className="version-header" onClick={onToggle} type="button">
                <span className={`v-badge ${isLatest ? 'v-latest' : 'v-old'}`}>
                    Output {versionNumber}{isLatest ? ' · Latest' : ''}
                </span>

                <span className="v-prompt" title={generation.prompt}>
                    {promptPreview}
                </span>

                {/* Compact stats — only when collapsed */}
                {!isOpen && (
                    <span className="v-stats">{buildStatsString(result)}</span>
                )}

                <span className="v-time">{formatRelativeTime(generation.timestamp)}</span>

                <span className={`v-chevron ${isOpen ? 'rotated' : ''}`}>
                    <ChevronDown size={16} />
                </span>
            </button>

            {/* ── Body — only mounted when open ── */}
            {isOpen && (
                <div className="version-body">
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
                                <h2 className="strong-heading text-gradient">
                                    Output {versionNumber} — Generation Results
                                </h2>
                                <span className="timestamp-badge">{formatRelativeTime(generation.timestamp)}</span>
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


// ─── GenerationFeed: The accordion container ───
const GenerationFeed = ({
    generations,
    openGenerationId,
    setOpenGenerationId,
    onSave,
    onRefineRegenerate,
    showClarification,
    setShowClarification,
}) => {
    return (
        <div className="generation-feed">
            {[...generations].reverse().map((gen, idx) => {
                const versionNumber = generations.length - idx;
                const isLatest = idx === 0; // first in reversed = newest
                const isOpen = openGenerationId === gen.id;

                return (
                    <VersionBlock
                        key={gen.id}
                        generation={gen}
                        versionNumber={versionNumber}
                        isLatest={isLatest}
                        isOpen={isOpen}
                        onToggle={() => setOpenGenerationId(isOpen ? null : gen.id)}
                        onSave={onSave}
                        onRefineRegenerate={onRefineRegenerate}
                        showClarification={showClarification}
                        setShowClarification={setShowClarification}
                    />
                );
            })}
        </div>
    );
};


// ─── VersionStrip: Horizontal navigation pills ───
const VersionStrip = ({ generations, openGenerationId, onSelectGeneration }) => {
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
                        className={`version-pill ${gen.id === openGenerationId ? 'active' : ''}`}
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

    // ── Generations array + single accordion open ID ──
    const [generations, setGenerations] = useState([]);
    const [openGenerationId, setOpenGenerationId] = useState(null);

    const { saveToHistory } = useHistory();
    const [showClarification, setShowClarification] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [pageError, setPageError] = useState(null);
    const inputReveal = useScrollReveal({ threshold: 0.1 });

    // Derived: the latest generation's result (used by merge logic & helpers)
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
            if (!canGenerateAsGuest()) {
                localStorage.setItem('testnexa_pending_generation', JSON.stringify({
                    requirement,
                    settings
                }));
                setShowLoginModal(true);
                setPendingAction(() => handleActualGenerate);
                return;
            }
            incrementGuestUsage();
        }

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
                
                finalSuite.metadata = {
                    ...latestResult.metadata,
                    generatedAt: new Date().toISOString()
                };
            }

            console.log('API Response received (processed):', finalSuite);

            // ── Append new generation, set it as the open accordion item ──
            const newGeneration = {
                id: crypto.randomUUID(),
                prompt: isRefinement ? requirement : reqToUse, // show original prompt in header for refinements
                settings: settingsToUse,
                timestamp: Date.now(),
                result: finalSuite,
                isRefinement,
            };

            setGenerations(prev => [...prev, newGeneration]);
            setOpenGenerationId(newGeneration.id); // accordion: only this one is open
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

            // Scroll to top of output so user sees new generation immediately
            setTimeout(() => {
                const outputSection = document.getElementById('output-section');
                if (outputSection) {
                    const yOffset = -80;
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

        // Pass previous test case titles so the AI can improve on them
        if (latestResult) {
            const allTestCases = [
                ...(latestResult.functional || []),
                ...(latestResult.negative || []),
                ...(latestResult.edge || []),
                ...(latestResult.apiChecklist || latestResult.api || []),
                ...(latestResult.nonFunctional || []),
            ];
            const previousTitles = allTestCases
                .slice(0, 30)
                .map(tc => `${tc.id}: ${tc.title}`)
                .join('\n');
            enrichedReq += `\n\nPREVIOUSLY GENERATED TEST CASES (improve upon these, don't just repeat):\n${previousTitles}`;
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

    // ── Version strip: scroll to + expand a specific generation ──
    const handleSelectGeneration = useCallback((genId) => {
        setOpenGenerationId(genId);
        setTimeout(() => {
            const el = document.getElementById(`generation-${genId}`);
            if (el) {
                const yOffset = -80;
                const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
                window.scrollTo({ top: y, behavior: 'smooth' });
            }
        }, 50);
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

                {/* 3. Generation Results — accordion feed */}
                {generations.length > 0 && (
                    <div
                        id="output-section"
                        className="output-section-wrapper animate-slide-up"
                        style={{ marginTop: '3rem' }}
                    >
                        {/* Version strip — quick navigation */}
                        <VersionStrip
                            generations={generations}
                            openGenerationId={openGenerationId}
                            onSelectGeneration={handleSelectGeneration}
                        />

                        {/* Accordion feed — newest first, only one open at a time */}
                        <GenerationFeed
                            generations={generations}
                            openGenerationId={openGenerationId}
                            setOpenGenerationId={setOpenGenerationId}
                            onSave={handleSave}
                            onRefineRegenerate={handleRefineRegenerate}
                            showClarification={showClarification}
                            setShowClarification={setShowClarification}
                        />
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
