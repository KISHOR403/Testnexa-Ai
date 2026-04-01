// Custom Error Classes
class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
        this.code = 'VALIDATION_ERROR';
        this.statusCode = 400;
    }
}

class InputQualityError extends Error {
    constructor(message) {
        super(message);
        this.name = 'InputQualityError';
        this.code = 'INPUT_QUALITY_ERROR';
        this.statusCode = 422;
    }
}

class AIServiceError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AIServiceError';
        this.code = 'AI_SERVICE_ERROR';
        this.statusCode = 500;
    }
}

class RateLimitError extends Error {
    constructor(message) {
        super(message);
        this.name = 'RateLimitError';
        this.code = 'RATE_LIMIT_ERROR';
        this.statusCode = 429;
    }
}

class InternalError extends Error {
    constructor(message) {
        super(message);
        this.name = 'InternalError';
        this.code = 'INTERNAL_ERROR';
        this.statusCode = 500;
    }
}

// Error Response Formatter
const formatErrorResponse = (error) => {
    return {
        success: false,
        error: error.message || 'An unexpected error occurred',
        code: error.code || 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
    };
};

module.exports = {
    ValidationError,
    InputQualityError,
    AIServiceError,
    RateLimitError,
    InternalError,
    formatErrorResponse,
};
