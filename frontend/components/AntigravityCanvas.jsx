import React, { useEffect, useRef } from 'react';

/**
 * AntigravityCanvas
 * Interactive zero-gravity floating particle field inspired by Google Antigravity.
 * Lightweight, 60fps HTML5 canvas with gentle upward levitation physics and subtle cursor repulsion.
 */
const AntigravityCanvas = () => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Check reduced motion preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReducedMotion) return;

        let animationFrameId;
        let width = (canvas.width = window.innerWidth);
        let height = (canvas.height = window.innerHeight);

        const handleResize = () => {
            if (!canvas) return;
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', handleResize);

        // Mouse tracking for zero-gravity cursor interaction
        const mouse = { x: -1000, y: -1000, radius: 140 };

        const handleMouseMove = (e) => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
        };

        const handleMouseLeave = () => {
            mouse.x = -1000;
            mouse.y = -1000;
        };

        window.addEventListener('mousemove', handleMouseMove, { passive: true });
        document.addEventListener('mouseleave', handleMouseLeave);

        // Particle definitions
        // Distinctive Antigravity palette: jade, cool blue, subtle amber, soft white
        const colors = [
            'rgba(139, 175, 154, ',  // Mineral Jade
            'rgba(79, 140, 255, ',   // Deep Antigravity Blue
            'rgba(200, 153, 60, ',   // Subtle Amber
            'rgba(242, 243, 243, '   // Crisp White
        ];

        const particleCount = Math.min(Math.floor((width * height) / 18000), 75);
        const particles = [];

        class Particle {
            constructor() {
                this.reset(true);
            }

            reset(initial = false) {
                this.x = Math.random() * width;
                this.y = initial ? Math.random() * height : height + 10;
                this.size = Math.random() * 1.8 + 0.8;
                // Zero-gravity upward drift
                this.vy = -(Math.random() * 0.35 + 0.15);
                this.vx = (Math.random() - 0.5) * 0.25;
                this.baseAlpha = Math.random() * 0.45 + 0.15;
                this.alpha = this.baseAlpha;
                this.colorBase = colors[Math.floor(Math.random() * colors.length)];
                this.pulseSpeed = Math.random() * 0.02 + 0.008;
                this.pulseAngle = Math.random() * Math.PI * 2;
                // Confetti/mote shape: some circular, some tiny square specks
                this.isMote = Math.random() > 0.6;
                this.angle = Math.random() * Math.PI * 2;
                this.rotSpeed = (Math.random() - 0.5) * 0.02;
            }

            update() {
                this.pulseAngle += this.pulseSpeed;
                this.alpha = this.baseAlpha + Math.sin(this.pulseAngle) * 0.12;
                this.angle += this.rotSpeed;

                // Mouse repulsion (Antigravity displacement)
                const dx = mouse.x - this.x;
                const dy = mouse.y - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < mouse.radius) {
                    const force = (1 - dist / mouse.radius) * 1.8;
                    const angle = Math.atan2(dy, dx);
                    this.x -= Math.cos(angle) * force;
                    this.y -= Math.sin(angle) * force;
                }

                // Upward drift
                this.x += this.vx;
                this.y += this.vy;

                // Wrap around edges
                if (this.y < -15) this.reset(false);
                if (this.x < -15) this.x = width + 10;
                if (this.x > width + 15) this.x = -10;
            }

            draw() {
                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.rotate(this.angle);
                ctx.fillStyle = `${this.colorBase}${Math.max(0, this.alpha)})`;

                if (this.isMote) {
                    // Small rectangular micro-mote
                    ctx.fillRect(-this.size * 0.8, -this.size * 0.4, this.size * 1.6, this.size * 0.8);
                } else {
                    // Soft circular particle with gentle glow
                    ctx.beginPath();
                    ctx.arc(0, 0, this.size, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
            }
        }

        for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle());
        }

        // Animation loop
        const render = () => {
            ctx.clearRect(0, 0, width, height);

            for (let i = 0; i < particles.length; i++) {
                particles[i].update();
                particles[i].draw();
            }

            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseleave', handleMouseLeave);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="tn-antigravity-canvas"
            aria-hidden="true"
        />
    );
};

export default AntigravityCanvas;
