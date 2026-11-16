import React, { createContext, useContext, useState, useRef, useCallback } from 'react';

const ComingSoonContext = createContext({
    isOpen: false,
    activeFeature: 'testRuns',
    open: (feature = 'testRuns') => {},
    close: () => {}
});

export const ComingSoonProvider = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeFeature, setActiveFeature] = useState('testRuns');
    const triggerRef = useRef(null);

    const open = useCallback((feature = 'testRuns') => {
        triggerRef.current = document.activeElement;
        setActiveFeature(feature);
        setIsOpen(true);
    }, []);

    const close = useCallback(() => {
        setIsOpen(false);
        if (triggerRef.current && typeof triggerRef.current.focus === 'function') {
            setTimeout(() => {
                triggerRef.current?.focus();
            }, 50);
        }
    }, []);

    return (
        <ComingSoonContext.Provider value={{ isOpen, activeFeature, open, close }}>
            {children}
        </ComingSoonContext.Provider>
    );
};

export const useComingSoon = () => useContext(ComingSoonContext);
