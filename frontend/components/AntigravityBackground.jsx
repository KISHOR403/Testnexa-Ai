import React, { useRef, useEffect } from 'react';

const AntigravityBackground = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId;
    let particles = [];

    const colors = [
      '#4285F4', '#34A853', '#FBBC05', '#EA4335',
      '#8AB4F8', '#F28B82', '#FDE293', '#81C995',
      '#C58AF9', '#FF8BCB',
    ];

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    class Particle {
      constructor(w, h) {
        this.w = w;
        this.h = h;
        this.x = (Math.random() - 0.5) * w * 2;
        this.y = (Math.random() - 0.5) * h * 2;
        this.z = Math.random() * w;
        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.speed = 2 + Math.random() * 3;
      }

      reset() {
        this.x = (Math.random() - 0.5) * this.w * 2;
        this.y = (Math.random() - 0.5) * this.h * 2;
        this.z = this.w;
        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.speed = 2 + Math.random() * 3;
      }

      update() {
        this.z -= this.speed;
        if (this.z <= 0) this.reset();
      }

      draw(ctx) {
        const k = this.w / 2;
        if (this.z < 1) return;

        const sx = (this.x * k) / this.z + this.w / 2;
        const sy = (this.y * k) / this.z + this.h / 2;

        const pz = this.z + this.speed * 6;
        const px = (this.x * k) / pz + this.w / 2;
        const py = (this.y * k) / pz + this.h / 2;

        const r = Math.min((k / this.z) * 0.5, 3);

        let a = 1;
        if (this.z > this.w * 0.8) {
          a = 1 - (this.z - this.w * 0.8) / (this.w * 0.2);
        } else if (this.z < this.w * 0.05) {
          a = this.z / (this.w * 0.05);
        }

        ctx.globalAlpha = Math.max(0, Math.min(1, a));
        ctx.strokeStyle = this.color;
        ctx.fillStyle = this.color;

        const dx = sx - px;
        const dy = sy - py;
        const d = Math.sqrt(dx * dx + dy * dy);

        if (d > 1) {
          ctx.beginPath();
          ctx.lineWidth = r * 1.2;
          ctx.lineCap = 'round';
          ctx.moveTo(px, py);
          ctx.lineTo(sx, sy);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(sx, sy, Math.max(r, 0.5), 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.globalAlpha = 1;
      }
    }

    const initParticles = () => {
      particles = [];
      const count = Math.min(Math.floor((canvas.width * canvas.height) / 2000), 1200);
      for (let i = 0; i < count; i++) {
        particles.push(new Particle(canvas.width, canvas.height));
      }
    };

    const animate = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw(ctx);
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    resizeCanvas();
    initParticles();
    animationFrameId = requestAnimationFrame(animate);

    const handleResize = () => {
      resizeCanvas();
      initParticles();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -1,
        backgroundColor: '#000000',
        pointerEvents: 'none',
      }}
    />
  );
};

export default AntigravityBackground;
