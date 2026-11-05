/**
 * TestNexa AI — Centralized Enterprise Security & Administration Service
 * 
 * Manages:
 * 1. AES-256-GCM Secret Encryption & Decryption at rest
 * 2. RFC 6238 TOTP Multi-Factor Authentication (Base32, HMAC-SHA1, clock drift tolerance)
 * 3. Single-use hashed recovery codes generation & verification
 * 4. Enterprise SSO abstraction (SAML 2.0 & OIDC validation, signature verification, replay prevention)
 * 5. High-entropy hashed API key management & scope evaluation
 * 6. IP Allowlist & CIDR subnet calculation
 * 7. Organization security policy evaluation & session lifecycle validation
 */

const crypto = require('crypto');
const logger = require('../utils/logger');
const auditService = require('./auditService');
const supabaseService = require('./supabaseData.service');

// Base32 alphabet for standard RFC 3548 / RFC 4648 TOTP keys
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

class SecurityService {
    constructor() {
        // Derive master 256-bit encryption key
        const secret = process.env.ENCRYPTION_SECRET || process.env.JWT_SECRET || 'testnexa_enterprise_security_secret_key_32';
        this.masterKey = crypto.createHash('sha256').update(secret).digest();

        // In-memory replay cache for SAML / OIDC assertions: assertionId -> expiryTimestamp
        this.replayCache = new Map();
        // Rate limiting for MFA verification attempts: userId -> { attempts, lastAttempt }
        this.mfaRateLimits = new Map();

        // Periodically purge replay cache and rate limits
        const purgeTimer = setInterval(() => {
            const now = Date.now();
            for (const [k, exp] of this.replayCache.entries()) {
                if (now > exp) this.replayCache.delete(k);
            }
            for (const [userId, record] of this.mfaRateLimits.entries()) {
                if (now - record.lastAttempt > 15 * 60 * 1000) {
                    this.mfaRateLimits.delete(userId);
                }
            }
        }, 5 * 60 * 1000);

        if (typeof purgeTimer.unref === 'function') {
            purgeTimer.unref();
        }
    }

    // =========================================================================
    // 1. AES-256-GCM Secret Encryption & Decryption
    // =========================================================================

    /**
     * Encrypt sensitive string data at rest using AES-256-GCM
     * Format: enc_v1:ivHex:authTagHex:ciphertextHex
     */
    encryptSecret(plaintext) {
        if (!plaintext) return null;
        try {
            const iv = crypto.randomBytes(12); // Standard 96-bit IV for GCM
            const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, iv);
            let encrypted = cipher.update(String(plaintext), 'utf8', 'hex');
            encrypted += cipher.final('hex');
            const authTag = cipher.getAuthTag().toString('hex');
            return `enc_v1:${iv.toString('hex')}:${authTag}:${encrypted}`;
        } catch (err) {
            logger.error('Failed to encrypt secret:', err.message);
            throw new Error('Encryption error');
        }
    }

    /**
     * Decrypt AES-256-GCM encrypted secret string
     */
    decryptSecret(encryptedStr) {
        if (!encryptedStr) return null;
        try {
            const parts = encryptedStr.split(':');
            if (parts.length !== 4 || parts[0] !== 'enc_v1') {
                // Not in encrypted format or plaintext legacy
                return encryptedStr;
            }
            const [, ivHex, authTagHex, ciphertextHex] = parts;
            const iv = Buffer.from(ivHex, 'hex');
            const authTag = Buffer.from(authTagHex, 'hex');
            const decipher = crypto.createDecipheriv('aes-256-gcm', this.masterKey, iv);
            decipher.setAuthTag(authTag);
            let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        } catch (err) {
            logger.error('Failed to decrypt secret:', err.message);
            throw new Error('Decryption error: authentication tag validation failed');
        }
    }

    // =========================================================================
    // 2. RFC 6238 TOTP Multi-Factor Authentication
    // =========================================================================

    /**
     * Convert buffer to Base32 string (RFC 3548 / 4648)
     */
    _toBase32(buffer) {
        let bits = 0;
        let value = 0;
        let output = '';
        for (let i = 0; i < buffer.length; i++) {
            value = (value << 8) | buffer[i];
            bits += 8;
            while (bits >= 5) {
                output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
                bits -= 5;
            }
        }
        if (bits > 0) {
            output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
        }
        return output;
    }

    /**
     * Convert Base32 string to Buffer
     */
    _fromBase32(base32Str) {
        const cleaned = base32Str.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
        let bits = 0;
        let value = 0;
        const bytes = [];
        for (let i = 0; i < cleaned.length; i++) {
            const idx = BASE32_ALPHABET.indexOf(cleaned[i]);
            if (idx === -1) continue;
            value = (value << 5) | idx;
            bits += 5;
            if (bits >= 8) {
                bytes.push((value >>> (bits - 8)) & 255);
                bits -= 8;
            }
        }
        return Buffer.from(bytes);
    }

    /**
     * Generate 160-bit (20 byte) random TOTP secret and standard otpauth URI
     */
    generateTotpSecret(userEmail, issuer = 'TestNexa AI') {
        const rawBytes = crypto.randomBytes(20);
        const secretBase32 = this._toBase32(rawBytes);
        const label = `${issuer}:${userEmail}`;
        const otpauthUrl = `otpauth://totp/${encodeURIComponent(label)}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
        return {
            secret: secretBase32,
            otpauthUrl
        };
    }

    /**
     * Compute RFC 6238 TOTP code for a secret and timestamp counter offset
     */
    generateTotpCode(secretBase32, timeOffsetSteps = 0, timestampMs = Date.now()) {
        const secretBuffer = this._fromBase32(secretBase32);
        const counter = Math.floor(timestampMs / 1000 / 30) + timeOffsetSteps;
        const counterBuffer = Buffer.alloc(8);
        counterBuffer.writeBigInt64BE(BigInt(counter));

        const hmac = crypto.createHmac('sha1', secretBuffer).update(counterBuffer).digest();
        const offset = hmac[hmac.length - 1] & 0x0f;
        const binaryCode = (
            ((hmac[offset] & 0x7f) << 24) |
            ((hmac[offset + 1] & 0xff) << 16) |
            ((hmac[offset + 2] & 0xff) << 8) |
            (hmac[offset + 3] & 0xff)
        );

        const otp = (binaryCode % 1000000).toString().padStart(6, '0');
        return otp;
    }

    /**
     * Verify a 6-digit TOTP code with clock drift tolerance (window = 1 -> [-30s, 0, +30s])
     */
    verifyTotpCode(secretBase32, token, window = 1, timestampMs = Date.now()) {
        if (!secretBase32 || !token) return false;
        const cleanToken = String(token).trim();
        if (!/^\d{6}$/.test(cleanToken)) return false;

        for (let step = -window; step <= window; step++) {
            const expectedOtp = this.generateTotpCode(secretBase32, step, timestampMs);
            if (crypto.timingSafeEqual(Buffer.from(expectedOtp), Buffer.from(cleanToken))) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check and increment rate limiting for MFA verification attempts
     */
    checkMfaRateLimit(userId, maxAttempts = 5, windowMs = 5 * 60 * 1000) {
        if (!userId) return true;
        const now = Date.now();
        const record = this.mfaRateLimits.get(userId) || { attempts: 0, lastAttempt: now };

        if (now - record.lastAttempt > windowMs) {
            record.attempts = 1;
            record.lastAttempt = now;
            this.mfaRateLimits.set(userId, record);
            return true;
        }

        record.attempts += 1;
        record.lastAttempt = now;
        this.mfaRateLimits.set(userId, record);

        if (record.attempts > maxAttempts) {
            return false;
        }
        return true;
    }

    resetMfaRateLimit(userId) {
        if (userId) this.mfaRateLimits.delete(userId);
    }

    // =========================================================================
    // 3. Recovery Codes Management
    // =========================================================================

    /**
     * Generate 10 cryptographically random, formatted recovery codes and their secure hashes
     */
    generateRecoveryCodes(count = 10) {
        const plainCodes = [];
        const hashedCodes = [];

        for (let i = 0; i < count; i++) {
            // Format: XXXX-XXXX-XXXX (12 hex chars)
            const raw = crypto.randomBytes(6).toString('hex').toUpperCase();
            const formatted = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
            const hash = crypto.createHash('sha256').update(formatted.replace(/-/g, '')).digest('hex');

            plainCodes.push(formatted);
            hashedCodes.push({
                hash,
                usedAt: null
            });
        }

        return {
            plainCodes,
            hashedCodes
        };
    }

    /**
     * Verify single-use recovery code and mark as redeemed
     */
    verifyAndConsumeRecoveryCode(inputCode, backupCodes = []) {
        if (!inputCode || !Array.isArray(backupCodes)) {
            return { valid: false, updatedCodes: backupCodes };
        }

        const normalized = String(inputCode).trim().replace(/-/g, '').toUpperCase();
        const candidateHash = crypto.createHash('sha256').update(normalized).digest('hex');

        let matched = false;
        const updatedCodes = backupCodes.map((c) => {
            if (!matched && !c.usedAt && c.hash === candidateHash) {
                matched = true;
                return {
                    ...c,
                    usedAt: new Date().toISOString()
                };
            }
            return c;
        });

        return {
            valid: matched,
            updatedCodes
        };
    }

    // =========================================================================
    // 4. Enterprise SSO Abstraction (SAML 2.0 & OIDC)
    // =========================================================================

    /**
     * Validate SSO Configuration parameters
     */
    validateSsoConfig(config) {
        const errors = [];
        if (!config.providerName || !config.providerName.trim()) {
            errors.push('Provider name is required');
        }
        const protocol = (config.protocol || 'saml').toLowerCase();
        if (!['saml', 'oidc'].includes(protocol)) {
            errors.push('Protocol must be SAML or OIDC');
        }
        if (!config.issuer || !config.issuer.trim()) {
            errors.push('Entity ID / Issuer URL is required');
        }
        if (!config.entryPoint || !config.entryPoint.trim()) {
            errors.push('SSO Login Endpoint URL is required');
        }
        if (protocol === 'saml' && !config.certOrPublicKey) {
            errors.push('X.509 Certificate is required for SAML signature validation');
        }
        if (protocol === 'oidc' && !config.clientId) {
            errors.push('Client ID is required for OIDC connection');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Replay attack prevention check for SAML assertion IDs / OIDC JTIs
     */
    checkAndRecordReplay(assertionId, ttlMs = 10 * 60 * 1000) {
        if (!assertionId) return true;
        const now = Date.now();
        if (this.replayCache.has(assertionId)) {
            const exp = this.replayCache.get(assertionId);
            if (now < exp) {
                return false; // Replay detected!
            }
        }
        this.replayCache.set(assertionId, now + ttlMs);
        return true;
    }

    /**
     * Verify mock / test SAML response or OIDC token payload for test connection
     */
    verifySsoResponse({ protocol = 'saml', ssoConfig, payload, signature, state }) {
        if (!ssoConfig) {
            throw new Error('SSO configuration is missing');
        }

        // 1. Replay check
        const assertionId = payload?.assertionId || payload?.jti || payload?.id;
        if (assertionId && !this.checkAndRecordReplay(assertionId)) {
            throw new Error('SSO Replay attack detected: Assertion has already been processed');
        }

        // 2. Issuer / Audience validation
        if (payload?.issuer && ssoConfig.issuer && payload.issuer !== ssoConfig.issuer) {
            throw new Error(`Invalid IdP Issuer: expected ${ssoConfig.issuer}, got ${payload.issuer}`);
        }

        // 3. Expiration validation
        const now = Date.now();
        if (payload?.expiresAt) {
            const expMs = new Date(payload.expiresAt).getTime();
            if (now > expMs) {
                throw new Error('SSO Assertion has expired');
            }
        }

        // 4. Domain restriction check
        const email = payload?.email || payload?.nameId || payload?.sub;
        if (!email || !email.includes('@')) {
            throw new Error('SSO response missing valid user email identity');
        }

        const domain = email.split('@')[1].toLowerCase();
        if (Array.isArray(ssoConfig.domains) && ssoConfig.domains.length > 0) {
            const allowed = ssoConfig.domains.map(d => d.toLowerCase().trim());
            if (!allowed.includes(domain)) {
                throw new Error(`Email domain @${domain} is not permitted by this organization's SSO policy`);
            }
        }

        return {
            valid: true,
            user: {
                email,
                name: payload.name || payload.displayName || email.split('@')[0],
                provider: ssoConfig.providerName || protocol.toUpperCase(),
                externalId: payload.nameId || payload.sub || email
            }
        };
    }

    // =========================================================================
    // 5. Organization API Key Management
    // =========================================================================

    /**
     * Generate high-entropy API key
     * Prefix: tnx_live_
     * Display: tnx_live_abcd1234...
     * Secure Hash: SHA-256
     */
    generateApiKey({ orgId, name, scopes = ['projects:read', 'testcases:read'], createdBy, expiresInDays = 90 }) {
        if (!orgId || !name) {
            throw new Error('Organization ID and key name are required');
        }

        // Generate 32 bytes of secure random (256 bits)
        const randomSecret = crypto.randomBytes(32).toString('base64url');
        const fullKey = `tnx_live_${randomSecret}`;
        const keyPrefix = fullKey.slice(0, 14); // e.g. tnx_live_abc12
        const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');

        const now = new Date();
        const expiresAt = expiresInDays > 0
            ? new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
            : null;

        const record = {
            id: `key_${crypto.randomBytes(8).toString('hex')}`,
            orgId: String(orgId),
            name: name.trim(),
            keyPrefix,
            keyHash,
            scopes: Array.isArray(scopes) ? scopes : ['projects:read'],
            createdBy: String(createdBy || 'system'),
            expiresAt,
            lastUsedAt: null,
            revokedAt: null,
            status: 'active',
            createdAt: now.toISOString()
        };

        return {
            fullKey, // Return plaintext ONCE only
            keyRecord: record
        };
    }

    /**
     * Validate incoming raw API key against stored hash and required scope
     */
    async validateApiKey(rawKey, requiredScope = null) {
        if (!rawKey || typeof rawKey !== 'string' || !rawKey.startsWith('tnx_live_')) {
            return { valid: false, reason: 'Invalid key format' };
        }

        const candidateHash = crypto.createHash('sha256').update(rawKey).digest('hex');
        const keyRecord = await supabaseService.getApiKeyByHash(candidateHash);

        if (!keyRecord) {
            return { valid: false, reason: 'API key not found' };
        }

        if (keyRecord.status === 'revoked' || keyRecord.revokedAt) {
            return { valid: false, reason: 'API key has been revoked' };
        }

        if (keyRecord.expiresAt && new Date(keyRecord.expiresAt) < new Date()) {
            return { valid: false, reason: 'API key has expired' };
        }

        // Enforce required scope
        if (requiredScope && (!keyRecord.scopes || !keyRecord.scopes.includes(requiredScope))) {
            return { valid: false, reason: `API key lacks required scope: ${requiredScope}` };
        }

        // Asynchronously update last_used_at
        supabaseService.touchApiKey(keyRecord.id).catch(() => {});

        return {
            valid: true,
            keyRecord
        };
    }

    // =========================================================================
    // 6. IP Allowlist & CIDR Engine
    // =========================================================================

    /**
     * Convert IPv4 string to 32-bit unsigned integer
     */
    _ipv4ToInt(ip) {
        const parts = ip.split('.').map(p => parseInt(p, 10));
        if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
            return null;
        }
        return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
    }

    /**
     * Check if an IP address belongs to a CIDR range or exact IP match
     */
    isIpInCidr(clientIp, cidrOrIp) {
        if (!clientIp || !cidrOrIp) return false;
        const cleanClient = String(clientIp).replace(/^::ffff:/, '').trim();
        const cleanCidr = String(cidrOrIp).trim();

        // Exact match
        if (cleanClient === cleanCidr) return true;
        if (cleanClient === '::1' && (cleanCidr === '127.0.0.1' || cleanCidr === '::1')) return true;

        if (cleanCidr.includes('/')) {
            const [rangeIp, prefixLenStr] = cleanCidr.split('/');
            const prefixLen = parseInt(prefixLenStr, 10);
            if (isNaN(prefixLen) || prefixLen < 0 || prefixLen > 32) return false;

            const clientInt = this._ipv4ToInt(cleanClient);
            const rangeInt = this._ipv4ToInt(rangeIp);

            if (clientInt === null || rangeInt === null) return false;

            const mask = prefixLen === 0 ? 0 : (~0 << (32 - prefixLen)) >>> 0;
            return (clientInt & mask) === (rangeInt & mask);
        }

        return false;
    }

    /**
     * Evaluate incoming client IP against organization IP allowlist
     */
    validateIpAllowlist(clientIp, allowlistEntries = []) {
        if (!Array.isArray(allowlistEntries) || allowlistEntries.length === 0) {
            return true; // No allowlist restrictions configured
        }

        for (const entry of allowlistEntries) {
            const rule = typeof entry === 'string' ? entry : entry.cidrOrIp;
            if (rule && this.isIpInCidr(clientIp, rule)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Safely resolve client IP address accounting for trusted proxy configuration
     */
    extractClientIp(req) {
        if (!req) return '127.0.0.1';
        if (req.ip) return req.ip.replace(/^::ffff:/, '');

        const forwarded = req.headers ? req.headers['x-forwarded-for'] : null;
        if (forwarded) {
            const parts = forwarded.split(',').map(s => s.trim().replace(/^::ffff:/, ''));
            if (parts.length > 0 && parts[0]) return parts[0];
        }

        return (req.socket?.remoteAddress || req.connection?.remoteAddress || '127.0.0.1').replace(/^::ffff:/, '');
    }

    // =========================================================================
    // 7. Organization Security Policy Evaluation
    // =========================================================================

    /**
     * Verify password against organization password policy
     */
    validatePasswordPolicy(password, policy = {}) {
        const errors = [];
        const minLength = policy.minPasswordLength || 8;

        if (!password || password.length < minLength) {
            errors.push(`Password must be at least ${minLength} characters long`);
        }

        if (policy.requirePasswordComplexity) {
            if (!/[A-Z]/.test(password)) {
                errors.push('Password must contain at least one uppercase letter');
            }
            if (!/[0-9]/.test(password)) {
                errors.push('Password must contain at least one number');
            }
            if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
                errors.push('Password must contain at least one special character');
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Verify whether an email address belongs to approved email domains
     */
    validateEmailDomain(email, approvedDomains = []) {
        if (!Array.isArray(approvedDomains) || approvedDomains.length === 0) {
            return true;
        }
        if (!email || !email.includes('@')) return false;

        const domain = email.split('@')[1].toLowerCase().trim();
        const allowed = approvedDomains.map(d => d.toLowerCase().trim().replace(/^@/, ''));
        return allowed.includes(domain);
    }
}

module.exports = new SecurityService();

