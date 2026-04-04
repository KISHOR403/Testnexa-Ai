const Joi = require('joi');
const { ValidationError, InputQualityError } = require('../utils/errors');

// Request Validation Schema
const generateRequestSchema = Joi.object({
    requirement: Joi.string()
        .min(20)
        .max(2000)
        .required()
        .messages({
            'string.empty': 'Requirement is required',
            'string.min': 'Requirement is too short. Please add more details (minimum 20 characters)',
            'string.max': 'Requirement is too long. Please keep it under 2000 characters',
            'any.required': 'Requirement is required',
        }),

    appType: Joi.string()
        .valid('web', 'mobile', 'api')
        .required()
        .messages({
            'any.only': 'App type must be one of: web, mobile, api',
            'any.required': 'App type is required',
        }),

    detailLevel: Joi.string()
        .valid('basic', 'medium', 'detailed')
        .required()
        .messages({
            'any.only': 'Detail level must be one of: basic, medium, detailed',
            'any.required': 'Detail level is required',
        }),

    testFocus: Joi.string()
        .valid('functional', 'non_functional', 'api', 'mixed')
        .optional()
        .default('mixed')
        .messages({
            'any.only': 'Test focus must be one of: functional, non_functional, api, mixed',
        }),

    userPersona: Joi.string()
        .valid('sdet', 'product_manager', 'fresher', 'default')
        .optional()
        .default('default')
        .messages({
            'any.only': 'User persona must be one of: sdet, product_manager, fresher, default',
        }),

    language: Joi.string()
        .optional()
        .default('en-US'),
});

/**
 * Check if the input text is meaningful enough for test case generation.
 * Returns { isValid: boolean, reason: string }
 */
const checkInputQuality = (text) => {
    const trimmed = (text || '').trim();

    // 1. Check for excessive special characters (gibberish like "!@#$%^&*()")
    const specialCharRatio = (trimmed.replace(/[a-zA-Z0-9\s]/g, '').length) / trimmed.length;
    if (specialCharRatio > 0.5) {
        return { isValid: false, reason: 'Your input contains too many special characters. Please describe a software feature or requirement in plain language.' };
    }

    // 2. Check for repeated characters (e.g. "aaaaaaaaaa", "abcabcabcabc")
    const repeatedPattern = /(.{1,4})\1{4,}/i;
    if (repeatedPattern.test(trimmed.replace(/\s/g, ''))) {
        return { isValid: false, reason: 'Your input appears to contain repeated characters. Please describe a real software feature or requirement.' };
    }

    // 3. Check if it has enough real words (at least 3 words with 2+ letters)
    const words = trimmed.split(/\s+/).filter(w => /[a-zA-Z]{2,}/.test(w));
    if (words.length < 3) {
        return { isValid: false, reason: 'Your input is too short or unclear. Please describe what the feature should do, including user actions and expected behavior (at least 3 meaningful words).' };
    }

    // 4. Check for keyboard-mash patterns (consonant clusters without vowels)
    const lowered = trimmed.toLowerCase();
    const consonantCluster = /[bcdfghjklmnpqrstvwxyz]{6,}/;
    if (consonantCluster.test(lowered)) {
        return { isValid: false, reason: 'We couldn\'t understand your input. Please describe a software feature in plain English, e.g. "User login with email and password".' };
    }

    // 5. Check vowel ratio — real English text typically has 30-45% vowels 
    const letters = lowered.replace(/[^a-z]/g, '');
    if (letters.length > 10) {
        const vowels = letters.replace(/[^aeiou]/g, '').length;
        const vowelRatio = vowels / letters.length;
        if (vowelRatio < 0.1) {
            return { isValid: false, reason: 'Your input doesn\'t appear to be readable text. Please write a clear description of the feature you want to test.' };
        }
    }

    // 6. Check for purely numeric input
    if (/^\d[\d\s.,-]*$/.test(trimmed)) {
        return { isValid: false, reason: 'Your input contains only numbers. Please describe a software feature or user story that you want to generate test cases for.' };
    }

    // 7. Check for general conversational or educational/support prompts
    const conversationalPatterns = [
        /help me (to )?(learn|understand|code|write a script)/i,
        /how (do|can) i (learn|write|code|understand)/i,
        /what is (the meaning of|a good way to)/i,
        /explain (how|what|why)/i,
        /write a (poem|story|essay|blog|script in python|java program)/i,
        /^hi(\s|,|!|$)/i, /^hello(\s|,|!|$)/i, /^hey(\s|,|!|$)/i
    ];

    for (const pattern of conversationalPatterns) {
        if (pattern.test(trimmed)) {
            return { isValid: false, reason: 'This appears to be a general question or conversational prompt. Testnexa AI is specifically designed to generate QA test cases from software requirements. Please describe a software feature (e.g., "User login module handling forgot password").' };
        }
    }

    return { isValid: true, reason: '' };
};

// Validation Service
const validateGenerateRequest = (data) => {
    const { error, value } = generateRequestSchema.validate(data, {
        abortEarly: false,
        stripUnknown: true,
    });

    if (error) {
        const errorMessage = error.details.map(detail => detail.message).join('; ');
        throw new ValidationError(errorMessage);
    }

    // Check input quality AFTER schema validation passes
    const qualityCheck = checkInputQuality(value.requirement);
    if (!qualityCheck.isValid) {
        throw new InputQualityError(qualityCheck.reason);
    }

    return value;
};

module.exports = {
    validateGenerateRequest,
    checkInputQuality,
};
