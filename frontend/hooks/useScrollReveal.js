import { useEffect, useRef, useState } from 'react';

/**
 * Custom hook for scroll-triggered reveal animations using IntersectionObserver.
 * 
 * @param {Object} options
 * @param {number} options.threshold - Visibility threshold (0-1) to trigger animation. Default: 0.15
 * @param {string} options.rootMargin - Root margin for the observer. Default: '0px 0px -60px 0px'
 * @param {boolean} options.triggerOnce - If true, animation only triggers once. Default: true
 * @returns {{ ref: React.RefObject, isVisible: boolean }}
 */
const useScrollReveal = ({
    threshold = 0.15,
    rootMargin = '0px 0px -60px 0px',
    triggerOnce = true,
} = {}) => {
    const ref = useRef(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const element = ref.current;
        if (!element) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    if (triggerOnce) {
                        observer.unobserve(element);
                    }
                } else if (!triggerOnce) {
                    setIsVisible(false);
                }
            },
            { threshold, rootMargin }
        );

        observer.observe(element);

        return () => {
            observer.unobserve(element);
        };
    }, [threshold, rootMargin, triggerOnce]);

    return { ref, isVisible };
};

export default useScrollReveal;
