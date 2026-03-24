// AI Provider Configuration
require('dotenv').config();

const config = {
    provider: (process.env.AI_PROVIDER || 'openai').toLowerCase().trim(), // 'openai' or 'gemini'

    openai: {
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || 'gpt-4',
        maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 2000,
        temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7,
    },

    gemini: {
        apiKey: (process.env.GEMINI_API_KEY || '').trim(),
        model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
        maxTokens: parseInt(process.env.GEMINI_MAX_TOKENS) || 8192,
        temperature: parseFloat(process.env.GEMINI_TEMPERATURE) || 0.7,
    },

    // Retry configuration
    retry: {
        maxRetries: parseInt(process.env.AI_MAX_RETRIES) || 3,
        retryDelay: parseInt(process.env.AI_RETRY_DELAY) || 1000, // ms
    },
};

module.exports = config;
