const { RateLimitError } = require('../utils/errors');
const logger = require('../utils/logger');

// Store request timestamps: key -> array of timestamps (ms)
const requestMap = new Map();

// Periodic cleanup of stale entries every 10 minutes
setInterval(() => {
    const now = Date.now();
    const windowMs = 5 * 60 * 1000;
    for (const [key, timestamps] of requestMap.entries()) {
        const valid = timestamps.filter(t => now - t < windowMs);
        if (valid.length === 0) {
            requestMap.delete(key);
        } else {
            requestMap.set(key, valid);
        }
    }
}, 10 * 60 * 1000).unref();

/**
 * Creates a sliding-window rate limiter middleware.
 * @param {Object} options
 * @param {number} options.windowMs - Time window in milliseconds (default: 5 min)
 * @param {number} options.max - Maximum requests per window (default: 30)
 * @param {string} options.message - Custom error message
 */
const createRateLimiter = ({
    windowMs = 5 * 60 * 1000,
    max = 30,
    message = 'Too many Copilot analysis requests. Please wait a moment before trying again.'
} = {}) => {
    return (req, res, next) => {
        const key = (req.user?._id || req.user?.id || req.ip || 'unknown').toString();
        const now = Date.now();

        const timestamps = (requestMap.get(key) || []).filter(t => now - t < windowMs);

        if (timestamps.length >= max) {
            const oldest = timestamps[0];
            const retryAfterSec = Math.ceil((windowMs - (now - oldest)) / 1000);

            res.setHeader('Retry-After', retryAfterSec);
            logger.warn(`Copilot rate limit exceeded for ${key}`, {
                requests: timestamps.length,
                retryAfterSec
            });

            return res.status(429).json({
                success: false,
                code: 'RATE_LIMIT_ERROR',
                message,
                retryAfter: retryAfterSec
            });
        }

        timestamps.push(now);
        requestMap.set(key, timestamps);
        next();
    };
};

const copilotRateLimiter = createRateLimiter({
    windowMs: 5 * 60 * 1000,
    max: 40,
    message: 'Too many Copilot requests. Please wait a few moments before trying again.'
});

const authLoginRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many sign-in attempts. Please wait 15 minutes before trying again.'
});

const authRegisterRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many account creation attempts. Please wait a while before trying again.'
});

const authPasswordResetRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many password reset requests. Please wait 15 minutes before trying again.'
});

const contactRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many message submissions. Please wait 15 minutes before trying again.'
});

module.exports = {
    createRateLimiter,
    copilotRateLimiter,
    authLoginRateLimiter,
    authRegisterRateLimiter,
    authPasswordResetRateLimiter,
    contactRateLimiter
};
