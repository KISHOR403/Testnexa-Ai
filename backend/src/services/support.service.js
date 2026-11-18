/**
 * Testnexa AI — Support & Help Center Service
 * Handles support requests with spam protection, article feedback with IP hashing,
 * search miss normalization, retention purging, and admin intelligence summaries.
 */

const crypto = require('crypto');
const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const supabaseService = require('./supabaseData.service');

// Sanitizer for plain text emails to prevent HTML injection and header splitting
const sanitizePlainText = (str) => {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

class SupportService {
    constructor() {
        this.inMemorySupportRequests = new Map();
        this.inMemoryHelpFeedback = new Map();
        this.inMemoryHelpSearchMisses = new Map();
    }

    /**
     * Creates Nodemailer transporter using system SMTP configuration
     */
    _getTransporter() {
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS ? process.env.SMTP_PASS.replace(/\s+/g, '') : '';

        if (!user || !pass) return null;

        if (user.endsWith('@gmail.com')) {
            return nodemailer.createTransport({
                service: 'gmail',
                auth: { user, pass }
            });
        }

        return nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT, 10) || 587,
            secure: parseInt(process.env.SMTP_PORT, 10) === 465,
            auth: { user, pass },
            tls: { rejectUnauthorized: false }
        });
    }

    /**
     * Verifies Turnstile / hCaptcha token against provider API if secret configured
     */
    async verifyCaptcha(token, remoteIp) {
        const secret = process.env.SUPPORT_CAPTCHA_SECRET;
        if (!secret) return true; // Captcha disabled

        if (!token) return false;

        try {
            const axios = require('axios');
            // Cloudflare Turnstile / hCaptcha siteverify
            const verifyUrl = process.env.SUPPORT_CAPTCHA_VERIFY_URL || 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
            const res = await axios.post(verifyUrl, new URLSearchParams({
                secret,
                response: token,
                remoteip: remoteIp || ''
            }), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                timeout: 5000
            });
            return Boolean(res.data?.success);
        } catch (err) {
            logger.warn('Captcha verification request failed:', err.message);
            return false;
        }
    }

    /**
     * Checks whether message consists solely or overwhelmingly of links
     */
    isLinksOnly(message) {
        if (!message) return false;
        const urlRegex = /(https?:\/\/[^\s]+)/gi;
        const urls = message.match(urlRegex) || [];
        if (urls.length === 0) return false;

        const urlTextLength = urls.reduce((sum, u) => sum + u.length, 0);
        const nonUrlText = message.replace(urlRegex, '').trim();

        // If URL characters exceed 70% of the entire message and non-URL prose is under 15 chars
        return (urlTextLength / message.length > 0.70) && (nonUrlText.length < 15);
    }

    /**
     * Submits a support request
     */
    async createSupportRequest({
        topic,
        message,
        email,
        pageUrl = null,
        appVersion = null,
        userId = null,
        website = null,
        clientTimestamp = null,
        captchaToken = null,
        remoteIp = null
    }) {
        // 1. Honeypot check: Bots fill hidden 'website' fields
        if (website && String(website).trim().length > 0) {
            logger.warn('Support submission absorbed via honeypot');
            return {
                id: 'sup_bot_absorbed',
                expectedResponseTime: process.env.SUPPORT_RESPONSE_TIME || 'within 24 business hours'
            };
        }

        // 2. Minimum time-to-submit check (prevent bot fast-submits under 3 seconds)
        if (clientTimestamp) {
            const elapsed = Date.now() - Number(clientTimestamp);
            if (!isNaN(elapsed) && elapsed < 3000) {
                logger.warn('Support submission rejected: submitted too fast (< 3s)', { elapsed });
                const err = new Error('Submission too fast. Please take a moment to review your message.');
                err.status = 400;
                err.code = 'SUBMIT_TOO_FAST';
                throw err;
            }
        }

        // 3. Reject links-only messages
        if (this.isLinksOnly(message)) {
            const err = new Error('Message cannot consist solely of URLs. Please provide context.');
            err.status = 400;
            err.code = 'INVALID_CONTENT';
            throw err;
        }

        // 4. Captcha verification if enabled
        const captchaOk = await this.verifyCaptcha(captchaToken, remoteIp);
        if (!captchaOk) {
            const err = new Error('Security challenge verification failed. Please try again.');
            err.status = 400;
            err.code = 'CAPTCHA_FAILED';
            throw err;
        }

        const id = 'sup_' + crypto.randomBytes(12).toString('hex');
        const now = new Date().toISOString();
        const expectedResponseTime = process.env.SUPPORT_RESPONSE_TIME || 'within 24 business hours';

        const record = {
            id,
            user_id: userId || null,
            email: email.trim().toLowerCase(),
            topic,
            message: message.trim(),
            page_url: pageUrl ? pageUrl.trim() : null,
            app_version: appVersion ? appVersion.trim() : null,
            status: 'new',
            created_at: now
        };

        // Persist to Supabase if available
        let persisted = false;
        if (supabaseService.isAvailable) {
            try {
                const { error } = await supabaseService.supabase
                    .from('support_requests')
                    .insert(record);
                if (!error) {
                    persisted = true;
                }
            } catch (err) {
                logger.warn('Supabase support_requests insert fallback to in-memory:', err.message);
            }
        }

        if (!persisted) {
            this.inMemorySupportRequests.set(id, record);
        }

        // Safe logging: ONLY ids and counts, never message text
        logger.info('Support request created', {
            id,
            topic,
            emailDomain: record.email.split('@')[1],
            hasUser: Boolean(userId)
        });

        // Async email notifications (support team & requester acknowledgement)
        this._dispatchEmails({ record, expectedResponseTime }).catch(err => {
            logger.warn('Non-fatal: Support email dispatch failure:', err.message);
        });

        return {
            id,
            expectedResponseTime
        };
    }

    /**
     * Dispatches notification to SUPPORT_INBOX and confirmation to user
     */
    async _dispatchEmails({ record, expectedResponseTime }) {
        const transporter = this._getTransporter();
        if (!transporter) return;

        const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;
        const supportInbox = process.env.SUPPORT_INBOX || 'support@testnexa.ai';
        const sanitizedMsg = sanitizePlainText(record.message);

        // 1. Email to Support Team
        const adminMailOptions = {
            from: `"Testnexa Support Portal" <${fromAddress}>`,
            to: supportInbox,
            replyTo: record.email,
            subject: `[Support Request] [${record.topic.toUpperCase()}] ${record.id}`,
            text: [
                `Support Request: ${record.id}`,
                `Topic: ${record.topic}`,
                `Sender: ${record.email}`,
                `User ID: ${record.user_id || 'Anonymous'}`,
                `Page URL: ${record.page_url || 'N/A'}`,
                `App Version: ${record.app_version || 'N/A'}`,
                `Received: ${record.created_at}`,
                '',
                '--- Message Content ---',
                record.message,
                '',
                'Privacy Notice: Do not ask for or store passwords or API credentials.'
            ].join('\n')
        };

        // 2. Acknowledgement Email to Requester
        const userMailOptions = {
            from: `"Testnexa AI Support" <${fromAddress}>`,
            to: record.email,
            subject: `We received your request #${record.id} — Testnexa AI Support`,
            text: [
                `Hello,`,
                '',
                `Thank you for contacting Testnexa AI Support. We have received your request (Reference: ${record.id}) regarding "${record.topic}".`,
                '',
                `Our team typically responds ${expectedResponseTime}.`,
                '',
                '--- Your Submitted Message ---',
                record.message,
                '',
                '--- Privacy & Security Notice ---',
                'Testnexa support agents will never ask for your account password or secret API keys.',
                '',
                'Best regards,',
                'The Testnexa AI Support Team'
            ].join('\n')
        };

        try {
            await Promise.all([
                transporter.sendMail(adminMailOptions),
                transporter.sendMail(userMailOptions)
            ]);
        } catch (err) {
            logger.warn('Failed to send support email notification:', err.message);
        }
    }

    /**
     * Purges support requests older than retention window (default: 12 months)
     */
    async purgeOldSupportRequests(retentionMonths = 12) {
        const months = Number(retentionMonths) || 12;
        const cutoff = new Date(Date.now() - months * 30 * 24 * 60 * 60 * 1000).toISOString();
        let deletedCount = 0;

        if (supabaseService.isAvailable) {
            try {
                const { error, count } = await supabaseService.supabase
                    .from('support_requests')
                    .delete({ count: 'exact' })
                    .lt('created_at', cutoff);
                if (!error && typeof count === 'number') {
                    deletedCount = count;
                }
            } catch (err) {
                logger.warn('Supabase support_requests purge error:', err.message);
            }
        }

        // Clean in-memory entries
        for (const [id, req] of this.inMemorySupportRequests.entries()) {
            if (new Date(req.created_at) < new Date(cutoff)) {
                this.inMemorySupportRequests.delete(id);
                deletedCount++;
            }
        }

        logger.info('Support requests retention purge completed', { retentionMonths: months, deletedCount });
        return { deletedCount, cutoff };
    }

    /**
     * Cascading deletion: remove all support requests for a user
     */
    async deleteUserSupportRequests(userId) {
        if (!userId) return { count: 0 };
        let count = 0;

        if (supabaseService.isAvailable) {
            try {
                const { error, count: dbCount } = await supabaseService.supabase
                    .from('support_requests')
                    .delete({ count: 'exact' })
                    .eq('user_id', userId);
                if (!error && typeof dbCount === 'number') {
                    count = dbCount;
                }
            } catch (err) {
                logger.warn('Supabase delete user support requests error:', err.message);
            }
        }

        for (const [id, req] of this.inMemorySupportRequests.entries()) {
            if (req.user_id === userId) {
                this.inMemorySupportRequests.delete(id);
                count++;
            }
        }

        return { count };
    }

    /**
     * Records article helpfulness feedback (No IP stored, hashed with daily salt)
     */
    async recordArticleFeedback({ articleSlug, helpful, comment = null, ip = null, userId = null }) {
        // Daily salted hash for deduplication only (no raw IP storage)
        const dailySalt = new Date().toISOString().slice(0, 10) + (process.env.JWT_SECRET || 'salt');
        const ipHash = crypto.createHash('sha256').update(dailySalt + (ip || '0.0.0.0')).digest('hex');

        const id = 'hfb_' + crypto.randomBytes(12).toString('hex');
        const now = new Date().toISOString();

        const record = {
            id,
            article_slug: articleSlug.trim().toLowerCase(),
            helpful: Boolean(helpful),
            comment: comment ? comment.trim().slice(0, 500) : null,
            ip_hash: ipHash,
            user_id: userId || null,
            created_at: now
        };

        if (supabaseService.isAvailable) {
            try {
                await supabaseService.supabase
                    .from('help_feedback')
                    .insert(record);
            } catch (err) {
                this.inMemoryHelpFeedback.set(id, record);
            }
        } else {
            this.inMemoryHelpFeedback.set(id, record);
        }

        logger.info('Article feedback recorded', {
            articleSlug: record.article_slug,
            helpful: record.helpful,
            hasComment: Boolean(record.comment)
        });

        return { success: true, id };
    }

    /**
     * Records a search miss query (normalized, stripped of emails & long digits, upsert count)
     */
    async recordSearchMiss(rawQuery) {
        if (!rawQuery) {
            const err = new Error('Query string is required');
            err.status = 400;
            throw err;
        }

        let cleaned = String(rawQuery).toLowerCase().trim();

        // 1. Strip emails
        cleaned = cleaned.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '');

        // 2. Strip long digit sequences (e.g. phone numbers, IDs >= 4 digits)
        cleaned = cleaned.replace(/\b\d{4,}\b/g, '');

        // 3. Strip special punctuation and normalize whitespace
        cleaned = cleaned.replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim();

        if (cleaned.length < 2) {
            const err = new Error('Query must contain valid descriptive terms');
            err.status = 400;
            throw err;
        }

        const normalizedQuery = cleaned.slice(0, 100);
        const now = new Date().toISOString();

        // Supabase upsert
        if (supabaseService.isAvailable) {
            try {
                const { data: existing } = await supabaseService.supabase
                    .from('help_search_misses')
                    .select('query, count')
                    .eq('query', normalizedQuery)
                    .maybeSingle();

                if (existing) {
                    await supabaseService.supabase
                        .from('help_search_misses')
                        .update({
                            count: (existing.count || 1) + 1,
                            last_missed_at: now
                        })
                        .eq('query', normalizedQuery);
                } else {
                    await supabaseService.supabase
                        .from('help_search_misses')
                        .insert({
                            query: normalizedQuery,
                            count: 1,
                            last_missed_at: now
                        });
                }
            } catch (err) {
                this._upsertInMemorySearchMiss(normalizedQuery, now);
            }
        } else {
            this._upsertInMemorySearchMiss(normalizedQuery, now);
        }

        logger.info('Search miss logged', { queryLength: normalizedQuery.length });
        return { success: true, query: normalizedQuery };
    }

    _upsertInMemorySearchMiss(query, now) {
        const item = this.inMemoryHelpSearchMisses.get(query);
        if (item) {
            item.count += 1;
            item.last_missed_at = now;
        } else {
            this.inMemoryHelpSearchMisses.set(query, {
                query,
                count: 1,
                last_missed_at: now
            });
        }
    }

    /**
     * Admin intelligence summary of Help Center performance & inquiries
     */
    async getHelpAdminSummary() {
        // Collect feedback
        let feedbackRows = [];
        if (supabaseService.isAvailable) {
            try {
                const { data } = await supabaseService.supabase
                    .from('help_feedback')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(500);
                if (data) feedbackRows = data;
            } catch (err) {
                feedbackRows = Array.from(this.inMemoryHelpFeedback.values());
            }
        } else {
            feedbackRows = Array.from(this.inMemoryHelpFeedback.values());
        }

        // Top unhelpful articles
        const articleStats = {};
        for (const row of feedbackRows) {
            const slug = row.article_slug;
            if (!articleStats[slug]) {
                articleStats[slug] = { slug, helpful: 0, unhelpful: 0, total: 0 };
            }
            articleStats[slug].total++;
            if (row.helpful) {
                articleStats[slug].helpful++;
            } else {
                articleStats[slug].unhelpful++;
            }
        }

        const topUnhelpfulArticles = Object.values(articleStats)
            .sort((a, b) => b.unhelpful - a.unhelpful)
            .slice(0, 10);

        // Top missed searches
        let searchMisses = [];
        if (supabaseService.isAvailable) {
            try {
                const { data } = await supabaseService.supabase
                    .from('help_search_misses')
                    .select('*')
                    .order('count', { ascending: false })
                    .limit(20);
                if (data) searchMisses = data;
            } catch (err) {
                searchMisses = Array.from(this.inMemoryHelpSearchMisses.values())
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 20);
            }
        } else {
            searchMisses = Array.from(this.inMemoryHelpSearchMisses.values())
                .sort((a, b) => b.count - a.count)
                .slice(0, 20);
        }

        // Request counts per topic
        let requestRows = [];
        if (supabaseService.isAvailable) {
            try {
                const { data } = await supabaseService.supabase
                    .from('support_requests')
                    .select('topic, status');
                if (data) requestRows = data;
            } catch (err) {
                requestRows = Array.from(this.inMemorySupportRequests.values());
            }
        } else {
            requestRows = Array.from(this.inMemorySupportRequests.values());
        }

        const requestsByTopic = {};
        for (const r of requestRows) {
            requestsByTopic[r.topic] = (requestsByTopic[r.topic] || 0) + 1;
        }

        // Recent feedback comments
        const recentFeedbackComments = feedbackRows
            .filter(r => Boolean(r.comment))
            .slice(0, 20)
            .map(r => ({
                id: r.id,
                article_slug: r.article_slug,
                helpful: r.helpful,
                comment: r.comment,
                created_at: r.created_at
            }));

        return {
            topUnhelpfulArticles,
            topMissedSearches: searchMisses,
            requestsByTopic,
            recentFeedbackComments,
            generatedAt: new Date().toISOString()
        };
    }
}

module.exports = new SupportService();
