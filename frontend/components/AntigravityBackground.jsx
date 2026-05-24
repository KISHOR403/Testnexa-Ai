import React, { useEffect, useRef } from 'react';

const AntigravityBackground = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = null;
    let width = 0;
    let height = 0;
    
    // Mouse coordinates
    let mouseX = -9999;
    let mouseY = -9999;
    let targetMouseX = -9999;
    let targetMouseY = -9999;
    let isInside = false;
    let time = 0;

    // 3D Grid settings - enlarged to blanket the entire screen (including navbar area)
    const FOV = 750;
    const GRID_SPACING = 55;
    const PLANE_WIDTH = 2200; // Extra wide to prevent empty sides on tilt
    const PLANE_DEPTH = 1800; // Extra deep to completely fill from top to bottom
    
    let tiltX = 0.65; // Slightly steeper elegant pitch angle for better navbar coverage
    let tiltY = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    // 3D Projection
    const project = (x, y, z) => {
      // Rotation X (Pitch)
      const cosX = Math.cos(tiltX);
      const sinX = Math.sin(tiltX);
      let y1 = y * cosX - z * sinX;
      let z1 = y * sinX + z * cosX;

      // Rotation Y (Yaw)
      const cosY = Math.cos(tiltY);
      const sinY = Math.sin(tiltY);
      let x2 = x * cosY - z1 * sinY;
      let z2 = x * sinY + z1 * cosY;

      const cameraZ = z2 + 1000; // Push depth back to fit larger grid
      if (cameraZ <= 0) return null;

      const scale = FOV / cameraZ;
      return {
        // Shift center upwards (-80) to cover the top navbar area
        x: width / 2 + x2 * scale,
        y: height / 2 - 80 + y1 * scale,
        scale: scale
      };
    };

    const handleMouseMove = (e) => {
      targetMouseX = e.clientX;
      targetMouseY = e.clientY;
      isInside = true;
    };

    const handleMouseLeave = () => {
      targetMouseX = -9999;
      targetMouseY = -9999;
      isInside = false;
    };

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);
    resize();

    const animate = () => {
      time += 0.015;

      // Smooth mouse coordinates
      if (targetMouseX === -9999) {
        if (mouseX !== -9999) {
          mouseX += (-9999 - mouseX) * 0.1;
          mouseY += (-9999 - mouseY) * 0.1;
          if (Math.abs(mouseX + 9999) < 1) {
            mouseX = -9999;
            mouseY = -9999;
          }
        }
      } else {
        if (mouseX === -9999) {
          mouseX = targetMouseX;
          mouseY = targetMouseY;
        } else {
          mouseX += (targetMouseX - mouseX) * 0.08;
          mouseY += (targetMouseY - mouseY) * 0.08;
        }
      }

      // 3D Perspective Tilt Sway
      const ambientTiltX = 0.62 + Math.sin(time * 0.5) * 0.04;
      const ambientTiltY = Math.cos(time * 0.4) * 0.08;

      let targetTiltX = ambientTiltX;
      let targetTiltY = ambientTiltY;

      if (isInside && targetMouseX !== -9999) {
        targetTiltX = 0.62 - ((targetMouseY / height) - 0.5) * 0.18;
        targetTiltY = ((targetMouseX / width) - 0.5) * 0.35;
      }

      tiltX += (targetTiltX - tiltX) * 0.05;
      tiltY += (targetTiltY - tiltY) * 0.05;

      // Clear & draw background base
      ctx.fillStyle = '#030712';
      ctx.fillRect(0, 0, width, height);

      // Subtle atmospheric background gradient glow
      const radialGrad = ctx.createRadialGradient(
        width / 2, 100, 100,
        width / 2, 100, Math.max(width, height) * 0.7
      );
      radialGrad.addColorStop(0, 'rgba(0, 212, 193, 0.06)');
      radialGrad.addColorStop(0.5, 'rgba(99, 102, 241, 0.02)');
      radialGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = radialGrad;
      ctx.fillRect(0, 0, width, height);

      // Build 3D mesh points map
      const startX = -PLANE_WIDTH / 2;
      const endX = PLANE_WIDTH / 2;
      const startZ = -PLANE_DEPTH / 2;
      const endZ = PLANE_DEPTH / 2;

      const cols = Math.floor((endX - startX) / GRID_SPACING);
      const rows = Math.floor((endZ - startZ) / GRID_SPACING);

      const points = [];

      for (let c = 0; c <= cols; c++) {
        points[c] = [];
        const px = startX + c * GRID_SPACING;

        for (let r = 0; r <= rows; r++) {
          const pz = startZ + r * GRID_SPACING;

          // 1. Gentle continuous 3D wave height (Antigravity sway)
          let py = Math.sin(px * 0.0035 + time) * Math.cos(pz * 0.0035 + time) * 35;

          // 2. Interactive gravity deformation (Mouse pushes/pulls the grid fabric)
          let ptResting = project(px, 0, pz);
          let distToMouse = 9999;
          
          if (ptResting && mouseX !== -9999) {
            const dx = mouseX - ptResting.x;
            const dy = mouseY - ptResting.y;
            distToMouse = Math.sqrt(dx * dx + dy * dy);
            
            const gravityRadius = 260;
            if (distToMouse < gravityRadius) {
              const force = 1 - distToMouse / gravityRadius;
              py += force * force * -65; 
            }
          }

          // Project coordinates to 2D Screen
          const pt = project(px, py, pz);
          points[c][r] = {
            pt: pt,
            distToMouse: distToMouse
          };
        }
      }

      // Draw the 3D Grid mesh lines
      for (let c = 0; c <= cols; c++) {
        for (let r = 0; r <= rows; r++) {
          const cell = points[c][r];
          if (!cell.pt) continue;

          // Blend line color based on proximity to cursor
          let baseOpacity = 0.04 + (cell.pt.scale * 0.045);
          let color = `rgba(255, 255, 255, ${baseOpacity})`;

          if (cell.distToMouse < 260) {
            const ratio = 1 - cell.distToMouse / 260;
            color = `rgba(0, 212, 193, ${baseOpacity + ratio * 0.28})`;
          }

          ctx.strokeStyle = color;
          ctx.lineWidth = cell.pt.scale * 0.6;

          // Draw line to right neighbor
          if (c < cols && points[c + 1][r].pt) {
            ctx.beginPath();
            ctx.moveTo(cell.pt.x, cell.pt.y);
            ctx.lineTo(points[c + 1][r].pt.x, points[c + 1][r].pt.y);
            ctx.stroke();
          }

          // Draw line to bottom neighbor
          if (r < rows && points[c][r + 1].pt) {
            ctx.beginPath();
            ctx.moveTo(cell.pt.x, cell.pt.y);
            ctx.lineTo(points[c][r + 1].pt.x, points[c][r + 1].pt.y);
            ctx.stroke();
          }
        }
      }

      // Draw vector dots at mesh intersections
      for (let c = 0; c <= cols; c++) {
        for (let r = 0; r <= rows; r++) {
          const cell = points[c][r];
          if (!cell.pt) continue;

          if (cell.distToMouse < 260) {
            const ratio = 1 - cell.distToMouse / 260;
            ctx.fillStyle = `rgba(0, 212, 193, ${0.22 + ratio * 0.65})`;
            ctx.beginPath();
            ctx.arc(cell.pt.x, cell.pt.y, cell.pt.scale * 1.8, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillStyle = `rgba(255, 255, 255, ${cell.pt.scale * 0.14})`;
            ctx.beginPath();
            ctx.arc(cell.pt.x, cell.pt.y, cell.pt.scale * 0.8, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Clean spotlight under mouse cursor
      if (mouseX !== -9999) {
        const spotlight = ctx.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, 260);
        spotlight.addColorStop(0, 'rgba(0, 212, 193, 0.02)');
        spotlight.addColorStop(1, 'transparent');
        ctx.fillStyle = spotlight;
        ctx.beginPath();
        ctx.arc(mouseX, mouseY, 260, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animId) cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="ag-bg-canvas"
      aria-hidden="true"
      role="presentation"
    />
  );
};

export default AntigravityBackground;
