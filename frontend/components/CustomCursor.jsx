import React, { useEffect, useState, useRef } from 'react';

export const CustomCursor = () => {
    const [isHovered, setIsHovered] = useState(false);
    const [cursorLabel, setCursorLabel] = useState('');
    const [isVisible, setIsVisible] = useState(false);
    const cursorRef = useRef(null);

    useEffect(() => {
        // Disable on touch devices
        if (window.matchMedia('(pointer: coarse)').matches) return;

        let mouseX = window.innerWidth / 2;
        let mouseY = window.innerHeight / 2;
        let currentX = mouseX;
        let currentY = mouseY;
        let rafId;

        const handleMouseMove = (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
            if (!isVisible) setIsVisible(true);

            // Check if hovering interactive target
            const target = e.target.closest('button, a, input, [data-cursor], .tn-glow-card');
            if (target) {
                setIsHovered(true);
                const customLabel = target.getAttribute('data-cursor');
                setCursorLabel(customLabel || '');
            } else {
                setIsHovered(false);
                setCursorLabel('');
            }
        };

        const handleMouseLeave = () => {
            setIsVisible(false);
        };

        const render = () => {
            // Smooth lerp
            currentX += (mouseX - currentX) * 0.18;
            currentY += (mouseY - currentY) * 0.18;

            if (cursorRef.current) {
                cursorRef.current.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) translate(-50%, -50%)`;
            }

            rafId = requestAnimationFrame(render);
        };

        window.addEventListener('mousemove', handleMouseMove, { passive: true });
        document.body.addEventListener('mouseleave', handleMouseLeave, { passive: true });
        rafId = requestAnimationFrame(render);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            document.body.removeEventListener('mouseleave', handleMouseLeave);
            cancelAnimationFrame(rafId);
        };
    }, [isVisible]);

    if (!isVisible) return null;

    return (
        <div
            ref={cursorRef}
            className={`tn-custom-cursor ${isHovered ? 'is-expanded' : ''}`}
            aria-hidden="true"
        >
            {cursorLabel && <span className="tn-custom-cursor-label">{cursorLabel}</span>}
        </div>
    );
};

export default CustomCursor;
