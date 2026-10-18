/**
 * Calm, restrained background for TestNexa enterprise landing page.
 * Uses #080909 base and subtle hairline technical grid without floating particles.
 */
const AnimatedBackground = () => {
    return (
        <div className="tn-bg-root" aria-hidden="true">
            {/* Base dark enterprise background #080909 */}
            <div className="tn-bg-base" />
            {/* Subtle technical hairline grid */}
            <div className="tn-bg-grid" />
        </div>
    );
};

export default AnimatedBackground;
