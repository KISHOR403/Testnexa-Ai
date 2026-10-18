/**
 * SSRF and Environment URL Validator for TestNexa AI
 * Protects against server-side request forgery, loopback exploits, and cloud metadata access.
 */

// Private IPv4 regex ranges
const PRIVATE_IP_REGEX = /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})$/;
const LOOPBACK_REGEX = /^(127\.\d{1,3}\.\d{1,3}\.\d{1,3}|0\.0\.0\.0|localhost|::1|\[::1\])$/i;
const CLOUD_METADATA_HOSTS = ['169.254.169.254', 'metadata.google.internal', 'instance-data'];

function validateEnvironmentUrl(urlString, allowLocalhost = false) {
    if (!urlString || typeof urlString !== 'string') {
        return { valid: false, message: 'URL string is required.' };
    }

    const trimmed = urlString.trim();
    if (!trimmed) {
        return { valid: false, message: 'URL cannot be empty.' };
    }

    let parsed;
    try {
        parsed = new URL(trimmed);
    } catch {
        return { valid: false, message: 'Invalid URL format. Must be a valid HTTP or HTTPS URL.' };
    }

    // Protocol enforcement
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { valid: false, message: 'Only HTTP and HTTPS protocols are allowed.' };
    }

    // Reject credentials embedded in URL (e.g., https://admin:secret@target.com)
    if (parsed.username || parsed.password) {
        return { valid: false, message: 'URLs must not contain embedded user credentials.' };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Always block cloud metadata endpoints
    if (CLOUD_METADATA_HOSTS.includes(hostname) || hostname.endsWith('.internal')) {
        return { valid: false, message: 'Access to cloud metadata endpoints is strictly forbidden.' };
    }

    // Check loopback / localhost
    const isLoopback = LOOPBACK_REGEX.test(hostname);
    if (isLoopback && !allowLocalhost) {
        return { valid: false, message: 'Localhost and loopback URLs are not permitted in production environments.' };
    }

    // Check private RFC 1918 networks in production
    const isPrivate = PRIVATE_IP_REGEX.test(hostname);
    if (isPrivate && !allowLocalhost) {
        return { valid: false, message: 'Private network addresses are not permitted.' };
    }

    return {
        valid: true,
        sanitizedUrl: parsed.origin + parsed.pathname.replace(/\/+$/, '')
    };
}

module.exports = {
    validateEnvironmentUrl
};
