const Joi = require('joi');
const { ValidationError } = require('../utils/errors');

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

    return value;
};

module.exports = {
    validateGenerateRequest,
};
