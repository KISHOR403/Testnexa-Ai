import React from 'react';
import { Info, Layers, Globe, Zap } from 'lucide-react';

const SettingsPanel = ({ settings, setSettings }) => {
    const detailTips = {
        Basic: 'Fewer test cases, focusing only on core happy paths.',
        Medium: 'Recommended. A balanced output of functional and critical negative cases.',
        Detailed: 'Full coverage. Includes exhaustive negative, edge cases, and API checklists.'
    };

    return (
        <div className="settings-panel-luxury glass-card">
            <div className="settings-grid">
                <div className="setting-group">
                    <div className="setting-label">
                        <Layers size={18} />
                        <span>App Type</span>
                    </div>
                    <div className="pill-group">
                        {['web', 'mobile', 'api'].map((type) => (
                            <button
                                key={type}
                                className={`pill-btn ${settings.type === type ? 'active' : ''}`}
                                onClick={() => setSettings({ ...settings, type })}
                            >
                                {type.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="setting-group">
                    <div className="setting-label">
                        <Zap size={18} />
                        <span>Detail Level</span>
                    </div>
                    <div className="pill-group-vertical">
                        {['Basic', 'Medium', 'Detailed'].map((level) => (
                            <div key={level} className="pill-wrapper-tooltip-vertical">
                                <button
                                    className={`pill-btn ${settings.level === level ? 'active' : ''}`}
                                    onClick={() => setSettings({ ...settings, level })}
                                >
                                    {level}
                                </button>
                                <div className="tooltip-on-hover-side">
                                    <Info size={14} />
                                    <span className="tooltip-text-side">{detailTips[level]}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="setting-group">
                    <div className="setting-label">
                        <Globe size={18} />
                        <span>Output Language</span>
                    </div>
                    <select
                        className="select-custom"
                        value={settings.language}
                        onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                    >
                        <option value="english">English (US)</option>
                        <option value="hindi">Hindi</option>
                        <option value="spanish">Spanish</option>
                        <option value="french">French</option>
                    </select>
                </div>
            </div>
        </div>
    );
};

export default SettingsPanel;
