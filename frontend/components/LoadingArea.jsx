import React from 'react';
import AiGenerationLoader from './loading/AiGenerationLoader';

/**
 * LoadingArea
 * Modernized to use the distinctive "Test Signal" motion language for TestNexa AI.
 * Replaces previous generic spinners with the engineering-grade AiGenerationLoader.
 */
export const LoadingArea = ({
    isGenerating,
    requirement = '',
    settings = {},
    error = null,
    onRetry = null,
    onCancel = null
}) => {
    if (!isGenerating && !error) return null;

    return (
        <div style={{ margin: '1.5rem 0' }}>
            <AiGenerationLoader
                requirement={requirement}
                settings={settings}
                error={error}
                onRetry={onRetry}
                onCancel={onCancel}
            />
        </div>
    );
};

export default LoadingArea;
