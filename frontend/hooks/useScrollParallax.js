import { useEffect } from 'react';

/**
 * useScrollParallax
 *
 * Subtle, industry-standard scroll parallax system for TestNexa AI.
 * - Performance-first: direct GPU transform updates via requestAnimationFrame
 * - Zero React re-renders on scroll
 * - Cached layout measurements: zero getBoundingClientRect in the scroll loop
 * - IntersectionObserver: only updates sections currently near the viewport
 * - Section-bounded: strictly clamped between 0 and targetOffset, stopping at section boundaries
 * - Mobile-friendly: completely disabled on screens < 768px for battery and touch smoothness
 * - Accessibility-first: completely disabled when prefers-reduced-motion is active
 * - Compatible with existing text reveals (operates on inner product windows/cards)
 */
export const useScrollParallax = () => {
    useEffect(() => {
        if (typeof window === 'undefined') return;

        // 1. Accessibility: Check prefers-reduced-motion
        const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        let isReducedMotion = motionQuery.matches;

        const handleMotionChange = (e) => {
            isReducedMotion = e.matches;
            if (isReducedMotion) {
                resetAllTransforms();
            } else {
                measureAll();
                requestTick();
            }
        };

        if (motionQuery.addEventListener) {
            motionQuery.addEventListener('change', handleMotionChange);
        } else if (motionQuery.addListener) {
            motionQuery.addListener(handleMotionChange);
        }

        // 2. Discover all parallax target elements
        const elements = Array.from(document.querySelectorAll('[data-parallax-offset]'));
        if (elements.length === 0) return;

        // Map elements to their metadata and cached measurements
        const itemRegistry = new Map();
        const activeElements = new Set();

        const resetAllTransforms = () => {
            elements.forEach((el) => {
                el.style.transform = '';
            });
        };

        // Measure & cache layout metrics for each section/element
        const measureAll = () => {
            if (isReducedMotion || window.innerWidth < 768) {
                resetAllTransforms();
                return;
            }

            const viewportHeight = window.innerHeight;
            const scrollY = window.scrollY || window.pageYOffset;

            elements.forEach((el) => {
                const targetOffset = parseFloat(el.getAttribute('data-parallax-offset')) || 0;
                const targetScale = el.hasAttribute('data-parallax-scale')
                    ? parseFloat(el.getAttribute('data-parallax-scale'))
                    : null;
                const parallaxType = el.getAttribute('data-parallax-type') || 'section';

                // Locate the containing section for section boundaries
                const section = el.closest('section, header, .tn-section') || el;
                const rect = section.getBoundingClientRect();
                const sectionTop = rect.top + scrollY;
                const sectionHeight = section.offsetHeight || rect.height;

                // For standard sections:
                // enterY: scroll position where the top of section meets the bottom of viewport
                // exitY: scroll position where bottom of section leaves top of viewport
                const enterY = Math.max(0, sectionTop - viewportHeight);
                const exitY = sectionTop + sectionHeight;
                const totalDistance = Math.max(1, exitY - enterY);

                itemRegistry.set(el, {
                    el,
                    section,
                    targetOffset,
                    targetScale,
                    parallaxType,
                    sectionTop,
                    sectionHeight,
                    enterY,
                    exitY,
                    totalDistance,
                });
            });
        };

        // 3. IntersectionObserver: only track elements whose sections are visible
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    const sectionEl = entry.target;
                    elements.forEach((el) => {
                        const meta = itemRegistry.get(el);
                        if (meta && meta.section === sectionEl) {
                            if (entry.isIntersecting) {
                                activeElements.add(el);
                            } else {
                                activeElements.delete(el);
                                // Ensure clamped position at boundaries when leaving
                                if (!isReducedMotion && window.innerWidth >= 768) {
                                    applyTransformForElement(meta, window.scrollY || window.pageYOffset);
                                }
                            }
                        }
                    });
                });
                requestTick();
            },
            {
                rootMargin: '15% 0px 15% 0px',
                threshold: 0,
            }
        );

        // Observe unique parent sections
        const observedSections = new Set();
        elements.forEach((el) => {
            const section = el.closest('section, header, .tn-section') || el;
            if (!observedSections.has(section)) {
                observedSections.add(section);
                observer.observe(section);
            }
        });

        // 4. Update function: purely GPU translate3d + scale
        const applyTransformForElement = (meta, scrollY) => {
            const { el, targetOffset, targetScale, parallaxType, enterY, exitY, totalDistance, sectionHeight } = meta;

            let progress = 0;

            if (parallaxType === 'hero') {
                // Hero progress: 0 at top of page, 1.0 when hero is scrolled out of viewport
                const heroRange = Math.max(1, sectionHeight || 750);
                progress = Math.min(1, Math.max(0, scrollY / heroRange));
            } else {
                // Standard section: 0 when entering bottom of viewport, 1.0 when leaving top
                if (scrollY <= enterY) {
                    progress = 0;
                } else if (scrollY >= exitY) {
                    progress = 1;
                } else {
                    progress = (scrollY - enterY) / totalDistance;
                }
            }

            // Smooth displacement strictly bounded to [0, targetOffset]
            const y = progress * targetOffset;

            if (targetScale !== null) {
                // Smooth scale strictly bounded to [1.0, targetScale]
                const scale = 1 - progress * (1 - targetScale);
                el.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
            } else {
                el.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0)`;
            }
        };

        let ticking = false;

        const update = () => {
            ticking = false;

            if (isReducedMotion || window.innerWidth < 768) {
                resetAllTransforms();
                return;
            }

            const scrollY = window.scrollY || window.pageYOffset;

            // Only update elements in active sections
            activeElements.forEach((el) => {
                const meta = itemRegistry.get(el);
                if (meta) {
                    applyTransformForElement(meta, scrollY);
                }
            });
        };

        const requestTick = () => {
            if (!ticking) {
                ticking = true;
                requestAnimationFrame(update);
            }
        };

        // 5. Scroll listener (passive)
        window.addEventListener('scroll', requestTick, { passive: true });

        // 6. Resize listener (debounced)
        let resizeTimeout;
        const handleResize = () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                measureAll();
                requestTick();
            }, 120);
        };
        window.addEventListener('resize', handleResize, { passive: true });

        // Initial setup
        measureAll();
        // Mark all initially visible elements
        elements.forEach((el) => activeElements.add(el));
        requestTick();

        // Cleanup
        return () => {
            if (motionQuery.removeEventListener) {
                motionQuery.removeEventListener('change', handleMotionChange);
            } else if (motionQuery.removeListener) {
                motionQuery.removeListener(handleMotionChange);
            }
            window.removeEventListener('scroll', requestTick);
            window.removeEventListener('resize', handleResize);
            clearTimeout(resizeTimeout);
            observer.disconnect();
            resetAllTransforms();
        };
    }, []);
};

export default useScrollParallax;
