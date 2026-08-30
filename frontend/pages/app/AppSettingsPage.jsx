import React, { useState } from 'react';
import { Settings, Save, CheckCircle2, Shield, Sliders, Bell } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';

const AppSettingsPage = () => {
    const { settings, updateSetting } = useSettings();
    const [saved, setSaved] = useState(false);

    const handleSave = () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '800px' }}>
            <div>
                <h1 style={{ fontSize: '1.6rem', fontWeight: '700', color: '#ffffff', margin: 0 }}>
                    Application Settings
                </h1>
                <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.5)', margin: '0.25rem 0 0' }}>
                    Configure default QA generation parameters, output formatting, and telemetry
                </p>
            </div>

            <div style={{ background: '#090d16', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.07)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#ffffff' }}>Default Test Framework</label>
                    <select
                        value={settings.framework || 'playwright'}
                        onChange={(e) => updateSetting('framework', e.target.value)}
                        style={{ background: 'rgba(4,7,14,0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#ffffff', padding: '0.65rem', borderRadius: '8px', outline: 'none' }}
                    >
                        <option value="playwright">Playwright (TypeScript / Python)</option>
                        <option value="cypress">Cypress (JavaScript)</option>
                        <option value="jest">Jest / Vitest</option>
                        <option value="gherkin">Gherkin / Cucumber BDD</option>
                    </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#ffffff' }}>Default Analysis Depth</label>
                    <select
                        value={settings.depth || 'Standard'}
                        onChange={(e) => updateSetting('depth', e.target.value)}
                        style={{ background: 'rgba(4,7,14,0.6)', border: '1px solid rgba(255,255,255,0.1)', color: '#ffffff', padding: '0.65rem', borderRadius: '8px', outline: 'none' }}
                    >
                        <option value="Essential">Essential (Fast baseline coverage)</option>
                        <option value="Standard">Standard (Balanced enterprise QA)</option>
                        <option value="Comprehensive">Comprehensive (Deep security & edge analysis)</option>
                    </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div>
                        <div style={{ color: '#ffffff', fontWeight: '500', fontSize: '0.9rem' }}>Desktop Generation Notifications</div>
                        <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>Notify when AI test synthesis completes in the background</span>
                    </div>
                    <input
                        type="checkbox"
                        checked={settings.notifications !== false}
                        onChange={(e) => updateSetting('notifications', e.target.checked)}
                        style={{ transform: 'scale(1.2)', accentColor: '#00f2de' }}
                    />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <button
                        type="button"
                        onClick={handleSave}
                        className="tn-btn-new-suite"
                        style={{ minHeight: '44px', width: 'auto' }}
                    >
                        {saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
                        <span>{saved ? 'Saved!' : 'Save Preferences'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AppSettingsPage;
