import { ShieldCheck, Layers, CheckCircle2, AlertTriangle, ArrowRight, Info } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useHistory } from '../../hooks/useHistory';
import { DataLoadingState } from '../../components/loading';

const CoveragePage = () => {
    const { history, isLoading } = useHistory();

    // Derive real coverage items from the authenticated user's workspace
    const userSuites = history
        .filter(item => item.suite || item.totalCases > 0 || ['Generated', 'Approved', 'NeedsReview'].includes(item.status))
        .map((item, idx) => {
            const functionalCount = item.suite?.functional?.length || 0;
            const negativeCount = item.suite?.negative?.length || 0;
            const edgeCount = item.suite?.edge?.length || 0;
            const nonFunctionalCount = item.suite?.nonFunctional?.length || 0;
            const totalTests = item.totalCases || item.summary?.total || (functionalCount + negativeCount + edgeCount + nonFunctionalCount);

            const reqId = item.suite?.understanding?.requirementId ||
                item.suite?.functional?.[0]?.reqId ||
                `REQ-${String(idx + 1).padStart(3, '0')}`;

            // Explainable coverage: ratio of covered test dimensions (functional, negative, edge)
            const hasFunctional = functionalCount > 0 ? 1 : 0;
            const hasNegative = negativeCount > 0 ? 1 : 0;
            const hasEdge = edgeCount > 0 ? 1 : 0;
            const dimensionScore = Math.round(((hasFunctional * 45) + (hasNegative * 30) + (hasEdge * 25)));

            const coverageNum = item.quality?.coverageConfidence
                ? item.quality.coverageConfidence
                : (item.summary?.requirementCoverage ? parseInt(item.summary.requirementCoverage, 10) : (totalTests > 0 ? dimensionScore : 0));

            const typeLabel = item.context === 'api'
                ? 'API'
                : item.context === 'mobile'
                    ? 'Mobile'
                    : 'Web';

            return {
                id: item.id || item.sessionId || `req-${idx + 1}`,
                req: reqId,
                label: item.title || item.feature || item.requirement?.slice(0, 45) || `Requirement #${idx + 1}`,
                coverage: coverageNum,
                tests: totalTests,
                functionalCount,
                negativeCount,
                edgeCount,
                status: coverageNum >= 90 ? 'Optimal' : coverageNum >= 75 ? 'Standard' : 'Needs Review',
                type: typeLabel
            };
        });

    const totalScenarios = userSuites.reduce((acc, s) => acc + s.tests, 0);
    const avgCoverage = userSuites.length > 0
        ? (userSuites.reduce((acc, s) => acc + s.coverage, 0) / userSuites.length).toFixed(1) + '%'
        : '0%';
    const coveredReqs = userSuites.length > 0
        ? `${userSuites.length} / ${userSuites.length}`
        : '0 / 0';

    return (
        <div className="ws-page-container">
            {/* Header */}
            <div className="ws-page-header">
                <div className="ws-page-title-wrap">
                    <h1>Requirement Coverage</h1>
                    <p>
                        Traceability-grounded coverage analysis derived from verified requirement specifications
                    </p>
                </div>

                <div className="ws-header-actions">
                    <NavLink to="/app/workspace" className="ws-btn-primary">
                        <span>+ New Test Suite</span>
                    </NavLink>
                </div>
            </div>

            {isLoading && userSuites.length === 0 ? (
                <DataLoadingState
                    message="Evaluating test coverage metrics..."
                    telemetryTag="COVERAGE MATRIX"
                    skeletonType="metrics-detail"
                />
            ) : userSuites.length === 0 ? (
                /* Meaningful Empty State */
                <div className="ws-empty-state">
                    <div className="ws-empty-icon-wrap">
                        <ShieldCheck size={28} />
                    </div>

                    <div className="ws-empty-text-wrap" style={{ maxWidth: '440px' }}>
                        <h2>No test suite coverage yet.</h2>
                        <p>
                            Generate a test suite in AI Workspace to map requirements to test cases and view real coverage breakdowns.
                        </p>
                    </div>

                    <div className="ws-empty-actions">
                        <NavLink to="/app/workspace" className="ws-btn-primary">
                            <span>Generate in AI Workspace &rarr;</span>
                        </NavLink>
                        <NavLink to="/app/test-suites" className="ws-btn-secondary">
                            <span>All Test Suites</span>
                        </NavLink>
                    </div>
                </div>
            ) : (
                <>
                    {/* Metrics Overview */}
                    <div className="ws-stats-grid">
                        <div className="ws-stat-card">
                            <span className="ws-stat-card__label">AVERAGE COVERAGE</span>
                            <h2 className="ws-stat-card__val ws-stat-card__val--accent">{avgCoverage}</h2>
                        </div>
                        <div className="ws-stat-card">
                            <span className="ws-stat-card__label">TOTAL TEST CASES</span>
                            <h2 className="ws-stat-card__val">{totalScenarios}</h2>
                        </div>
                        <div className="ws-stat-card">
                            <span className="ws-stat-card__label">COVERED REQUIREMENTS</span>
                            <h2 className="ws-stat-card__val ws-stat-card__val--success">{coveredReqs}</h2>
                        </div>
                        <div className="ws-stat-card">
                            <span className="ws-stat-card__label">ACTIVE SUITES</span>
                            <h2 className="ws-stat-card__val">{userSuites.length}</h2>
                        </div>
                    </div>

                    {/* Coverage Calculation Methodology Notice */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.75rem 1rem',
                        background: '#101112',
                        border: '1px solid #292D2D',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        color: '#A0A5A5'
                    }}>
                        <Info size={15} style={{ color: '#8BAF9A', flexShrink: 0 }} />
                        <span>
                            <strong>Explainable Coverage Calculation:</strong> Scores reflect multidimensional test depth across functional happy paths (45%), negative exception states (30%), and boundary edge cases (25%).
                        </span>
                    </div>

                    {/* Breakdown Table */}
                    <div className="ws-card">
                        <div className="ws-card-header">
                            <span>Requirement Coverage Breakdown</span>
                            <span style={{ fontSize: '0.75rem', color: '#777E7E', fontWeight: 500 }}>
                                {userSuites.length} Active {userSuites.length === 1 ? 'Specification' : 'Specifications'}
                            </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {userSuites.map((item) => (
                                <div
                                    key={item.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        flexWrap: 'wrap',
                                        gap: '0.85rem',
                                        padding: '0.9rem 1.25rem',
                                        borderBottom: '1px solid #292D2D',
                                        transition: 'background 0.12s ease'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: '240px', flex: '1' }}>
                                        <span style={{
                                            color: '#8BAF9A',
                                            fontWeight: '600',
                                            fontSize: '0.78rem',
                                            fontFamily: 'monospace',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            background: 'rgba(139, 175, 154, 0.1)',
                                            border: '1px solid rgba(139, 175, 154, 0.2)'
                                        }}>
                                            {item.req}
                                        </span>
                                        <div>
                                            <div style={{ color: '#F2F3F3', fontWeight: '550', fontSize: '0.86rem' }}>{item.label}</div>
                                            <span style={{ fontSize: '0.72rem', color: '#777E7E' }}>{item.type} Target • {item.functionalCount} fn / {item.negativeCount} neg / {item.edgeCount} edge</span>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexShrink: 0 }}>
                                        <div style={{ width: '110px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '0.25rem', color: '#A0A5A5' }}>
                                                <span>{item.coverage}%</span>
                                                <span style={{ color: item.coverage >= 90 ? '#8BAF9A' : '#E5C07B', fontWeight: 600 }}>{item.status}</span>
                                            </div>
                                            <div style={{ height: '4px', background: '#161819', borderRadius: '2px', overflow: 'hidden' }}>
                                                <div style={{
                                                    height: '100%',
                                                    width: `${item.coverage}%`,
                                                    background: '#8BAF9A',
                                                    borderRadius: '2px'
                                                }} />
                                            </div>
                                        </div>
                                        <span style={{ fontSize: '0.78rem', color: '#777E7E', minWidth: '60px', textAlign: 'right' }}>
                                            {item.tests} tests
                                        </span>
                                        <NavLink
                                            to={`/app/test-suites/${item.id}`}
                                            style={{ color: '#8BAF9A', display: 'flex', alignItems: 'center', textDecoration: 'none' }}
                                            title="View Test Suite"
                                        >
                                            <ArrowRight size={15} />
                                        </NavLink>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default CoveragePage;
