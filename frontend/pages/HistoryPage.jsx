import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, Trash2, ExternalLink, Calendar, Layers } from 'lucide-react';
import { useHistory } from '../hooks/useHistory';
import ResultsSection from '../components/ResultsSection';

const HistoryPage = () => {
    const { history, deleteFromHistory } = useHistory();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('All');
    const [selectedRecord, setSelectedRecord] = useState(null);
    const location = useLocation();

    // Auto-select item if navigated from sidebar
    useEffect(() => {
        if (location.state?.selectedId && history.length > 0) {
            const item = history.find(h => h.id === location.state.selectedId);
            if (item) {
                setSelectedRecord(item);
            }
        }
    }, [location.state, history]);

    const filters = ['All', 'Web App', 'Mobile App', 'API'];

    const filteredHistory = history.filter(item => {
        const feature = item.feature || item.title || '';
        const req = item.requirement || '';
        const matchesSearch = feature.toLowerCase().includes(searchQuery.toLowerCase()) ||
            req.toLowerCase().includes(searchQuery.toLowerCase());
        const appType = item.settings?.type || item.context || 'web';
        const matchesFilter = activeFilter === 'All' ||
            (activeFilter === 'Web App' && appType === 'web') ||
            (activeFilter === 'Mobile App' && appType === 'mobile') ||
            (activeFilter === 'API' && appType === 'api');
        return matchesSearch && matchesFilter;
    });

    if (selectedRecord) {
        const recordData = selectedRecord.data || selectedRecord.suite || selectedRecord.suiteData;
        return (
            <div className="container" style={{ paddingTop: '100px', paddingBottom: '5rem' }}>
                <button className="btn-ghost" onClick={() => setSelectedRecord(null)} style={{ marginBottom: '2rem' }}>
                    &larr; Back to History
                </button>
                <h1 className="text-gradient" style={{ marginBottom: '2rem' }}>History: {selectedRecord.feature || selectedRecord.title}</h1>
                <ResultsSection result={recordData} onSave={() => alert("Already in history")} />
            </div>
        );
    }

    return (
        <div className="container" style={{ paddingTop: '100px', paddingBottom: '5rem' }}>
            <div className="history-header">
                <h1 className="text-gradient">Generation History</h1>
                <div className="history-controls">
                    <div className="search-box glass-card">
                        <Search size={18} />
                        <input
                            type="text"
                            placeholder="Search features or requirements..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="filter-chips">
                {filters.map(filter => (
                    <button
                        key={filter}
                        className={`filter-chip ${activeFilter === filter ? 'active' : ''}`}
                        onClick={() => setActiveFilter(filter)}
                    >
                        {filter}
                    </button>
                ))}
            </div>

            <div className="history-grid">
                {filteredHistory.length > 0 ? (
                    filteredHistory.map(item => (
                        <div key={item.id} className="history-card glass-card">
                            <div className="history-card-header">
                                <div className="feature-info">
                                    <h3>{item.feature}</h3>
                                    <div className="history-meta">
                                        <span className="meta-item"><Calendar size={14} /> {new Date(item.date).toLocaleDateString()}</span>
                                        <span className="meta-item"><Layers size={14} /> {item.settings.type}</span>
                                    </div>
                                </div>
                                <div className="case-count">
                                    <span className="count">{item.totalCases}</span>
                                    <span className="label">cases</span>
                                </div>
                            </div>
                            <div className="history-card-body">
                                <p className="requirement-preview">{(item.requirement || '').substring(0, 100)}...</p>
                            </div>
                            <div className="history-card-footer">
                                <button className="btn-primary btn-sm" onClick={() => setSelectedRecord(item)}>
                                    <ExternalLink size={14} />
                                    <span>Open</span>
                                </button>
                                <button className="btn-ghost btn-sm text-danger" onClick={() => deleteFromHistory(item.id)}>
                                    <Trash2 size={14} />
                                    <span>Delete</span>
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="empty-history glass-card">
                        <p>No records found. Try generating some test suites!</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HistoryPage;
