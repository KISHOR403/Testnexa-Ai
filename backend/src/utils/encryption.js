/**
 * TestNexa AI — Cryptographic Encryption Utility
 * Provides authenticated AES-256-GCM encryption for sensitive third-party credentials
 * (such as GitHub Personal Access Tokens and Webhook Secrets).
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Derives a consistent 32-byte key from environment secret
 */
function getMasterKey() {
    const secret = process.env.ENCRYPTION_KEY ||
        process.env.SESSION_SECRET ||
        process.env.JWT_SECRET ||
        'testnexa_ci_secure_encryption_key_default_32b';
    return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypt a plaintext string using AES-256-GCM
 * Returns formatted string: `${ivHex}:${authTagHex}:${cipherHex}`
 */
function encryptSecret(plaintext) {
    if (!plaintext || typeof plaintext !== 'string') {
        throw new Error('Plaintext string is required for encryption');
    }

    const key = getMasterKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt an AES-256-GCM encrypted string
 */
function decryptSecret(cipherPayload) {
    if (!cipherPayload || typeof cipherPayload !== 'string') {
        return null;
    }

    try {
        const parts = cipherPayload.split(':');
        if (parts.length !== 3) {
            throw new Error('Malformed encrypted secret payload');
        }

        const [ivHex, authTagHex, encryptedHex] = parts;
        const key = getMasterKey();
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (err) {
        throw new Error('Failed to decrypt secret: ' + err.message);
    }
}

/**
 * Masks a token for safe UI display and logging (e.g., ghp_••••••••••••3a4f)
 */
function maskSecret(token) {
    if (!token || typeof token !== 'string') return '';
    const trimmed = token.trim();
    if (trimmed.length <= 8) {
        return '••••••••';
    }
    const prefix = trimmed.slice(0, 4);
    const suffix = trimmed.slice(-4);
    return `${prefix}••••••••••••${suffix}`;
}

module.exports = {
    encryptSecret,
    decryptSecret,
    maskSecret
};
