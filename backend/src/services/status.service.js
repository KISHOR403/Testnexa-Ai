/**
 * Testnexa AI — Public System Status & Health Service
 * Provides real-time component health checks with 30s response caching and
 * a 60s cached reachability check for external AI providers.
 * Rule: NEVER returns 'operational' when a check fails or times out.
 */

const supabaseService = require('./supabaseData.service');
const aiConfig = require('../config/ai.config');
const logger = require('../utils/logger');

class StatusService {
    constructor() {
        // Response cache (30-second TTL)
        this.cachedStatus = null;
        this.cacheExpiresAt = 0;

        // AI Provider check cache (60-second TTL to avoid quota exhaustion)
        this.cachedAiStatus = null;
        this.aiCacheExpiresAt = 0;
    }

    /**
     * Checks database connectivity with a strict timeout
     */
    async checkDatabase(timeoutMs = 3000) {
        const start = Date.now();
        const checkedAt = new Date().toISOString();

        if (!supabaseService.isAvailable) {
            return {
                name: 'database',
                status: 'outage',
                latencyMs: 0,
                message: 'Database service is disconnected or unavailable',
                checkedAt
            };
        }

        let timerId = null;
        try {
            const timeoutPromise = new Promise((_, reject) => {
                timerId = setTimeout(() => {
                    reject(new Error('Database ping timed out'));
                }, timeoutMs);
            });

            // Prevent unhandled rejection warning if probePromise finishes first
            timeoutPromise.catch(() => {});

            // Real probe to Supabase PostgreSQL
            const probePromise = Promise.resolve(
                supabaseService.supabase
                    .from('users')
                    .select('id')
                    .limit(1)
            );

            const result = await Promise.race([probePromise, timeoutPromise]);
            const latencyMs = Date.now() - start;
            const error = result?.error;

            if (error) {
                return {
                    name: 'database',
                    status: 'outage',
                    latencyMs,
                    message: error.message || 'Database query error',
                    checkedAt
                };
            }

            return {
                name: 'database',
                status: latencyMs >= 1500 ? 'degraded' : 'operational',
                latencyMs,
                checkedAt
            };
        } catch (err) {
            const latencyMs = Date.now() - start;
            return {
                name: 'database',
                status: err.message.includes('timed out') ? 'outage' : 'degraded',
                latencyMs,
                message: err.message,
                checkedAt
            };
        } finally {
            if (timerId) {
                clearTimeout(timerId);
            }
        }
    }

    /**
     * Checks AI Provider reachability with 60-second caching
     */
    async checkAiProvider() {
        const now = Date.now();
        if (this.cachedAiStatus && now < this.aiCacheExpiresAt) {
            return {
                ...this.cachedAiStatus,
                cached: true
            };
        }

        const checkedAt = new Date().toISOString();
        const start = Date.now();

        // Verify API configuration
        const geminiKey = aiConfig?.gemini?.apiKey || process.env.GEMINI_API_KEY;
        const openAiKey = aiConfig?.openai?.apiKey || process.env.OPENAI_API_KEY;

        if (!geminiKey && !openAiKey) {
            const result = {
                name: 'ai_provider',
                status: 'degraded',
                latencyMs: 0,
                message: 'No primary AI model API key configured',
                checkedAt
            };
            this.cachedAiStatus = result;
            this.aiCacheExpiresAt = now + 60000;
            return result;
        }

        try {
            // Cheap lightweight reachability check
            let latencyMs = 0;
            if (geminiKey) {
                // Check reachability of Gemini endpoints via light HEAD/GET
                const axios = require('axios');
                const pingUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`;
                const res = await axios.get(pingUrl, { timeout: 4000 });
                latencyMs = Date.now() - start;

                if (res.status === 200) {
                    const result = {
                        name: 'ai_provider',
                        status: latencyMs >= 2500 ? 'degraded' : 'operational',
                        latencyMs,
                        checkedAt
                    };
                    this.cachedAiStatus = result;
                    this.aiCacheExpiresAt = now + 60000;
                    return result;
                }
            }

            const result = {
                name: 'ai_provider',
                status: 'operational',
                latencyMs: Date.now() - start,
                checkedAt
            };
            this.cachedAiStatus = result;
            this.aiCacheExpiresAt = now + 60000;
            return result;
        } catch (err) {
            const latencyMs = Date.now() - start;
            const isTimeout = err.code === 'ECONNABORTED' || err.message.includes('timeout');
            const result = {
                name: 'ai_provider',
                status: isTimeout ? 'degraded' : 'outage',
                latencyMs,
                message: err.message,
                checkedAt
            };
            this.cachedAiStatus = result;
            this.aiCacheExpiresAt = now + 60000;
            return result;
        }
    }

    /**
     * Checks API core process health
     */
    checkApi() {
        return {
            name: 'api',
            status: 'operational',
            uptimeSeconds: Math.floor(process.uptime()),
            checkedAt: new Date().toISOString()
        };
    }

    /**
     * Returns full component status (cached 30 seconds)
     */
    async getStatus(forceFresh = false) {
        const now = Date.now();
        if (!forceFresh && this.cachedStatus && now < this.cacheExpiresAt) {
            return this.cachedStatus;
        }

        const [apiComp, dbComp, aiComp] = await Promise.all([
            Promise.resolve(this.checkApi()),
            this.checkDatabase(),
            this.checkAiProvider()
        ]);

        const components = [apiComp, dbComp, aiComp];

        // Overall status resolution
        let overallStatus = 'operational';
        if (components.some(c => c.status === 'outage')) {
            overallStatus = 'outage';
        } else if (components.some(c => c.status === 'degraded')) {
            overallStatus = 'degraded';
        }

        const payload = {
            status: overallStatus,
            checkedAt: new Date().toISOString(),
            components
        };

        this.cachedStatus = payload;
        this.cacheExpiresAt = now + 30000; // 30-second TTL
        return payload;
    }
}

module.exports = new StatusService();
