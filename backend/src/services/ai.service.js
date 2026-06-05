const { GoogleGenerativeAI } = require('@google/generative-ai');
const aiConfig = require('../config/ai.config');
const logger = require('../utils/logger');
const { AIServiceError } = require('../utils/errors');
const { SYSTEM_PROMPT } = require('./prompt.service');

// Initialize Gemini
const genAI = new GoogleGenerativeAI(aiConfig.gemini.apiKey);

// OpenAI Integration (kept for reference)
const callOpenAI = async (prompt, options = {}) => {
    const axios = require('axios');
    try {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: options.model || aiConfig.openai.model,
                messages: [
                    {
                        role: 'system',
                        content: options.systemPrompt || SYSTEM_PROMPT,
                    },
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
                max_tokens: options.maxTokens || aiConfig.openai.maxTokens,
                temperature: options.temperature || aiConfig.openai.temperature,
            },
            {
                headers: {
                    'Authorization': `Bearer ${aiConfig.openai.apiKey}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        return response.data.choices[0].message.content;
    } catch (error) {
        logger.error('OpenAI API error', error);
        throw new AIServiceError(`OpenAI API failed: ${error.response?.data?.error?.message || error.message}`);
    }
};

// Gemini Integration (Using official @google/generative-ai SDK)
const callGemini = async (prompt, options = {}) => {
    try {
        const modelName = options.model || aiConfig.gemini.model || 'gemini-2.5-flash';
        logger.info(`Calling Gemini with model: ${modelName}`);

        const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: options.systemPrompt || SYSTEM_PROMPT
        });

        const generationConfig = {
            maxOutputTokens: options.maxTokens || aiConfig.gemini.maxTokens,
            temperature: options.temperature || aiConfig.gemini.temperature,
            responseMimeType: 'application/json',
        };

        // For Gemini 2.5+ thinking models, set thinking budget
        if (modelName.includes('2.5')) {
            generationConfig.thinkingConfig = { thinkingBudget: 2048 };
        }

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig,
        });
        const response = await result.response;
        const text = response.text();

        // Log raw response length and preview for debugging
        logger.info(`Gemini raw response: ${text ? text.length : 0} chars`);
        if (text && text.length < 200) {
            logger.warn('Gemini response suspiciously short:', text);
        }

        // Save raw response for debugging
        try {
            const fs = require('fs');
            const path = require('path');
            fs.writeFileSync(
                path.join(__dirname, '../../debug_raw_ai_response.txt'),
                text || '(empty)'
            );
        } catch (e) { /* ignore file write errors */ }

        if (text) {
            return text;
        } else {
            throw new Error('Invalid response format from Gemini API: response.text is empty');
        }
    } catch (error) {
        logger.error('Gemini API error', { error: error.message });

        // Enhance error object with status code if possible
        const aiError = new AIServiceError(`Gemini API failed: ${error.message}`);
        if (error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED')) {
            aiError.statusCode = 429;
        }
        throw aiError;
    }
};

// Main AI Service Function with Robust Retry Logic
const callAI = async (prompt, options = {}) => {
    const provider = aiConfig.provider;
    const maxRetries = 3;
    const baseRetryDelay = 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            let response;
            if (provider === 'gemini') {
                response = await callGemini(prompt, options);
            } else if (provider === 'openai') {
                response = await callOpenAI(prompt, options);
            } else {
                throw new AIServiceError(`Unknown AI provider: ${provider}`);
            }

            return response;
        } catch (error) {
            const isRateLimit = error.statusCode === 429 || error.message.includes('429') || error.message.includes('Quota exceeded');

            logger.warn(`AI call attempt ${attempt} failed: ${error.message}`);

            if (attempt === maxRetries) throw error;

            // Wait longer for rate limit errors with exponential backoff
            const delay = isRateLimit
                ? Math.max(baseRetryDelay * 2, 5000) * Math.pow(1.5, attempt - 1)
                : baseRetryDelay * attempt;

            logger.info(`Retrying in ${Math.round(delay)}ms... (Attempt ${attempt + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};

module.exports = {
    callAI,
};
