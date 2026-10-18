import { GitBranch, CheckCircle2, ChevronRight, Layers, FileText, ArrowRight, Search } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useHistory } from '../../hooks/useHistory';
import { DataLoadingState } from '../../components/loading';

const TraceabilityPage = () => {
    const { history, isLoading } = useHistory();
    const [search, setSearch] = useState('');

    // Build real traceability matrix mapping specifications to test cases
    const traceRows = [];

    history
        .filter(item => item.suite || item.totalCases > 0 || ['Generated', 'Approved', 'NeedsReview'].includes(item.status))
        .forEach((item, idx) => {
            const suite = item.suite;
            const reqId = suite?.understanding?.requirementId ||
                suite?.functional?.[0]?.reqId ||
                `REQ-${String(idx + 1).padStart(3, '0')}`;

            const allCases = [
                ...(suite?.functional || []),
                ...(suite?.negative || []),
                ...(suite?.edge || []),
                ...(suite?.nonFunctional || [])
            ];

            if (allCases.length === 0) {
                // Uncovered / pending requirement
                traceRows.push({
                    reqId,
                    title: item.title || item.feature || item.requirement?.slice(0, 45) || `Requirement #${idx + 1}`,
                    suiteId: item.id || item.sessionId,
                    suiteTitle: item.title || 'Untitled Suite',
                    testCases: [],
                    isCovered: false
                });
            } else {
                traceRows.push({
                    reqId,
                    title: item.title || item.feature || item.requirement?.slice(0, 45) || `Requirement #${idx + 1}`,
                    suiteId: item.id || item.sessionId,
                    suiteTitle: item.title || 'Untitled Suite',
                    testCases: allCases.map(tc => ({
                        id: tc.id || 'TC',
                        title: tc.title || tc.scenario || 'Verified test scenario',
                        type: tc.type || 'Functional',
                        priority: tc.priority || 'Medium',
                        status: tc.status || 'Needs Review'
                    })),
                    isCovered: true
                });
            }
        });

    const filteredRows = traceRows.filter(r =>
        r.reqId.toLowerCase().includes(search.toLowerCase()) ||
        r.title.toLowerCase().includes(search.toLowerCase())
    );

    const totalReqs = traceRows.length;
    const coveredReqs = traceRows.filter(r => r.isCovered).length;
    const uncoveredReqs = traceRows.filter(r => !r.isCovered).length;
    const totalMappedTests = traceRows.reduce((acc, r) => acc + r.testCases.length, 0);

    return (
        <div className="ws-page-container">
            {/* Header */}
            <div className="ws-page-header">
                <div className="ws-page-title-wrap">
                    <h1>Requirement Traceability Matrix</h1>
                    <p>
                        Navigable bidirectional mapping linking specifications to executed test assertions
                    </p>
                </div>

                <div className="ws-header-actions">
                    <NavLink to="/app/workspace" className="ws-btn-primary">
                        <span>+ New Test Suite</span>
                    </NavLink>
                </div>
            </div>

            {isLoading && traceRows.length === 0 ? (
                <DataLoadingState
                    message="Mapping requirement traceability matrix..."
                    telemetryTag="LINEAGE VERIFICATION"
                    skeletonType="table"
                    count={5}
                />
            ) : traceRows.length === 0 ? (
                /* Empty state */
                <div className="ws-empty-state">
                    <div className="ws-empty-icon-wrap">
                        <GitBranch size={28} />
                    </div>

                    <div className="ws-empty-text-wrap" style={{ maxWidth: '440px' }}>
                        <h2>No traceability matrix available.</h2>
                        <p>
                            Generate a test suite in AI Workspace to establish bidirectional requirement-to-test links.
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
                    {/* Matrix Metrics */}
                    <div className="ws-stats-grid">
                        <div className="ws-stat-card">
                            <span className="ws-stat-card__label">TOTAL REQUIREMENTS</span>
                            <h2 className="ws-stat-card__val">{totalReqs}</h2>
                        </div>
                        <div className="ws-stat-card">
                            <span className="ws-stat-card__label">MAPPED TEST CASES</span>
                            <h2 className="ws-stat-card__val ws-stat-card__val--accent">{totalMappedTests}</h2>
                        </div>
                        <div className="ws-stat-card">
                            <span className="ws-stat-card__label">COVERED REQUIREMENTS</span>
                            <h2 className="ws-stat-card__val ws-stat-card__val--success">{coveredReqs}</h2>
                        </div>
                        <div className="ws-stat-card">
                            <span className="ws-stat-card__label">UNCOVERED REQUIREMENTS</span>
                            <h2 className="ws-stat-card__val" style={{ color: uncoveredReqs > 0 ? '#E5C07B' : '#777E7E' }}>{uncoveredReqs}</h2>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="ws-search-bar">
                        <Search size={16} style={{ color: '#777E7E' }} />
                        <input
                            type="text"
                            placeholder="Filter by requirement ID (REQ-001) or specification title..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    {/* Compact Matrix Table */}
                    <div className="ws-card">
                        <div className="ws-card-header">
                            <span>Bidirectional Traceability Matrix</span>
                            <span style={{ fontSize: '0.75rem', color: '#777E7E', fontWeight: 500 }}>
                                {filteredRows.length} {filteredRows.length === 1 ? 'Requirement' : 'Requirements'}
                            </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {filteredRows.map((row) => (
                                <div
                                    key={row.suiteId}
                                    style={{
                                        padding: '1rem 1.25rem',
                                        borderBottom: '1px solid #292D2D',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.75rem'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <span style={{
                                                fontFamily: 'monospace',
                                                fontSize: '0.78rem',
                                                fontWeight: 600,
                                                color: '#8BAF9A',
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                                background: 'rgba(139, 175, 154, 0.1)',
                                                border: '1px solid rgba(139, 175, 154, 0.2)'
                                            }}>
                                                {row.reqId}
                                            </span>
                                            <span style={{ color: '#F2F3F3', fontWeight: 600, fontSize: '0.88rem' }}>
                                                {row.title}
                                            </span>
                                            {row.isCovered ? (
                                                <span className="tn-tag tn-tag--ready">
                                                    {row.testCases.length} Tests Linked
                                                </span>
                                            ) : (
                                                <span className="tn-tag tn-tag--alert">
                                                    Uncovered
                                                </span>
                                            )}
                                        </div>

                                        <NavLink
                                            to={`/app/test-suites/${row.suiteId}`}
                                            className="ws-btn-secondary"
                                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.76rem' }}
                                        >
                                            <span>Open Suite</span>
                                            <ArrowRight size={13} />
                                        </NavLink>
                                    </div>

                                    {/* Linked Test Cases Row / Matrix Chips */}
                                    {row.testCases.length > 0 ? (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', paddingLeft: '0.5rem' }}>
                                            {row.testCases.map((tc) => (
                                                <div
                                                    key={tc.id}
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '0.45rem',
                                                        padding: '0.25rem 0.6rem',
                                                        borderRadius: '4px',
                                                        background: '#161819',
                                                        border: '1px solid #292D2D',
                                                        fontSize: '0.74rem'
                                                    }}
                                                >
                                                    <span style={{ fontFamily: 'monospace', color: '#8BAF9A', fontWeight: 600 }}>
                                                        {tc.id}
                                                    </span>
                                                    <span style={{ color: '#A0A5A5', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {tc.title}
                                                    </span>
                                                    <span className={`tn-prio-tag tn-prio-tag--${tc.priority.toLowerCase()}`} style={{ fontSize: '0.64rem', padding: '1px 4px' }}>
                                                        {tc.priority}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: '0.76rem', color: '#E5C07B', paddingLeft: '0.5rem' }}>
                                            ⚠ No test cases currently mapped to this requirement.
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default TraceabilityPage;
