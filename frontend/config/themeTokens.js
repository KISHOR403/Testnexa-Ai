export const THEME = {
    colors: {
        bg: '#000000',
        surface: '#050505',
        surfaceElevated: '#0A0A0A',
        border: 'rgba(255, 255, 255, 0.08)',
        borderActive: 'rgba(255, 255, 255, 0.20)',
        borderGlow: 'rgba(56, 189, 248, 0.35)',
        text: {
            primary: '#FFFFFF',
            secondary: 'rgba(255, 255, 255, 0.76)',
            muted: 'rgba(255, 255, 255, 0.58)'
        },
        semantic: {
            green: '#22C55E',  // verified / pass
            amber: '#F59E0B',  // ambiguity / gap / needs review
            red: '#EF4444',    // failure / defect
            cyan: '#38BDF8'    // active / AI-processing glow
        }
    },
    fonts: {
        display: "'Space Grotesk', -apple-system, sans-serif",
        serif: "'Instrument Serif', Georgia, serif",
        body: "'Inter', sans-serif",
        mono: "'JetBrains Mono', monospace"
    },
    easing: [0.22, 1, 0.36, 1]
};

export default THEME;
