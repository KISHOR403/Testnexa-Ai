import React, { useEffect, useRef } from 'react';

const AnimatedBackground = () => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        let animationId;
        let width, height;
        let mouseX = 0;
        let mouseY = 0;
        let targetMouseX = 0;
        let targetMouseY = 0;
        let time = 0;

        const resize = () => {
            const pixelRatio = window.devicePixelRatio || 1;
            
            // Set the CSS Display size explicitly
            canvas.style.width = window.innerWidth + 'px';
            canvas.style.height = window.innerHeight + 'px';

            // Set the actual DOM element memory size
            const rect = canvas.getBoundingClientRect();
            width = rect.width;
            height = rect.height;

            canvas.width = width * pixelRatio;
            canvas.height = height * pixelRatio;
            
            // Normalize coordinate system to use css pixels
            ctx.scale(pixelRatio, pixelRatio);

            mouseX = width / 2;
            mouseY = height / 2;
            targetMouseX = width / 2;
            targetMouseY = height / 2;
        };

        const handleMouseMove = (e) => {
            targetMouseX = e.clientX;
            targetMouseY = e.clientY;
        };

        window.addEventListener('resize', resize);
        window.addEventListener('mousemove', handleMouseMove);
        resize();

        // --- Sparkle Particles ---
        const PARTICLE_COUNT = 100;
        class Sparkle {
            constructor() {
                this.reset();
            }
            
            reset() {
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                this.size = Math.random() * 2 + 0.5;
                this.baseOpacity = Math.random() * 0.5 + 0.1;
                this.vx = (Math.random() - 0.5) * 0.2;
                this.vy = Math.random() * -0.5 - 0.1; // Float slowly upwards
                this.pulseSpeed = Math.random() * 0.02 + 0.01;
                this.pulseOffset = Math.random() * Math.PI * 2;
            }

            update() {
                this.x += this.vx;
                this.y += this.vy;

                // Mouse repel effect
                const dx = this.x - mouseX;
                const dy = this.y - mouseY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 100) {
                    const force = (100 - dist) / 100 * 0.05;
                    this.x += dx * force;
                    this.y += dy * force;
                }

                if (this.y < -10) this.y = height + 10;
                if (this.x < -10) this.x = width + 10;
                if (this.x > width + 10) this.x = -10;
            }

            draw(ctx, time) {
                const opacity = this.baseOpacity + Math.sin(time * this.pulseSpeed + this.pulseOffset) * 0.3;
                
                ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.05, opacity)})`;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
                
                // Add tiny glow to some
                if (this.size > 1.5) {
                    const glowGrad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 3);
                    glowGrad.addColorStop(0, `rgba(255, 255, 255, ${opacity * 0.5})`);
                    glowGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
                    ctx.fillStyle = glowGrad;
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.size * 3, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        const sparkles = Array.from({ length: PARTICLE_COUNT }, () => new Sparkle());

        // --- Flowing Ribbons / Waves ---
        const drawWaves = (ctx, time) => {
            const waveCount = 3;
            
            for (let i = 0; i < waveCount; i++) {
                ctx.beginPath();
                let isFirst = true;

                // The wave properties
                const yOffset = height * 0.7 + i * 40; // Base Y position
                const amplitude = 50 + i * 20;
                const frequency = 0.002 + i * 0.001;
                const speed = time * 0.001 * (i + 1);

                // Mouse interaction influence
                const mouseInfluence = (mouseX / width - 0.5) * 100;
                const mouseAmplitude = (mouseY / height) * 50;

                for (let x = 0; x <= width; x += 20) {
                    // Complex sine wave
                    const y = yOffset 
                        + Math.sin(x * frequency + speed) * (amplitude + mouseAmplitude)
                        + Math.sin(x * frequency * 2.5 - speed * 1.5) * (amplitude * 0.5) 
                        + mouseInfluence;

                    if (isFirst) {
                        ctx.moveTo(x, y);
                        isFirst = false;
                    } else {
                        // Smooth bezier curve approximations could be used, but lineTo is fast and fine at x+=10/20
                        ctx.lineTo(x, y);
                    }
                }

                // Add gradient stroke to waves
                const waveGradients = [
                    ['rgba(0, 229, 255, 0)', 'rgba(0, 229, 255, 0.4)', 'rgba(0, 229, 255, 0)'],
                    ['rgba(235, 34, 187, 0)', 'rgba(235, 34, 187, 0.4)', 'rgba(235, 34, 187, 0)'],
                    ['rgba(67, 24, 255, 0)', 'rgba(67, 24, 255, 0.4)', 'rgba(67, 24, 255, 0)'],
                ];
                
                const grad = ctx.createLinearGradient(0, 0, width, 0);
                grad.addColorStop(0, waveGradients[i][0]);
                grad.addColorStop(0.5, waveGradients[i][1]);
                grad.addColorStop(1, waveGradients[i][2]);

                ctx.strokeStyle = grad;
                ctx.lineWidth = 2 + i * 0.5;
                ctx.stroke();
            }
        };

        // --- Main Animation Loop ---
        const animate = () => {
            time++;
            
            // Smooth mouse followers
            mouseX += (targetMouseX - mouseX) * 0.05;
            mouseY += (targetMouseY - mouseY) * 0.05;

            // Global composite operation to blend nicely
            ctx.globalCompositeOperation = 'source-over';
            
            // Dark elegant background base
            ctx.fillStyle = '#000000'; // Pure black
            ctx.fillRect(0, 0, width, height);

            // Draw Sparkles
            sparkles.forEach(sparkle => {
                sparkle.update();
                sparkle.draw(ctx, time);
            });

            // Removed Dynamic Liquid Waves

            animationId = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            cancelAnimationFrame(animationId);
            window.removeEventListener('resize', resize);
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: -1, // Ensure it's behind everything
            }}
            aria-hidden="true"
        />
    );
};

export default AnimatedBackground;
