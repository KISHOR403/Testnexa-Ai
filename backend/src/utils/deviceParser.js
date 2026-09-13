/**
 * Device & User-Agent parser utility for TestNexa AI
 * Extracts browser name, OS, and device type without heavy external dependencies.
 */

function parseUserAgent(userAgentString = '') {
    const ua = userAgentString || '';

    let browser = 'Unknown Browser';
    let os = 'Unknown OS';

    // 1. Detect Operating System (check mobile iOS/Android before desktop)
    if (/iPhone/i.test(ua)) {
        const match = ua.match(/OS (\d+([._]\d+)?)/i);
        os = match ? `iOS ${match[1].replace('_', '.')}` : 'iOS';
    } else if (/iPad/i.test(ua)) {
        const match = ua.match(/OS (\d+([._]\d+)?)/i);
        os = match ? `iPadOS ${match[1].replace('_', '.')}` : 'iPadOS';
    } else if (/Android (\d+(\.\d+)?)/i.test(ua)) {
        const match = ua.match(/Android (\d+(\.\d+)?)/i);
        os = match ? `Android ${match[1]}` : 'Android';
    } else if (/Windows NT 10.0/i.test(ua)) {
        // Windows 11 and Windows 10 share NT 10.0
        os = 'Windows 11';
    } else if (/Windows NT 6.3/i.test(ua)) {
        os = 'Windows 8.1';
    } else if (/Windows NT 6.1/i.test(ua)) {
        os = 'Windows 7';
    } else if (/Mac OS X/i.test(ua) || /Macintosh/i.test(ua)) {
        os = 'macOS';
    } else if (/Linux/i.test(ua)) {
        os = 'Linux';
    }

    // 2. Detect Browser
    if (/Edg\/(\d+)/i.test(ua)) {
        browser = 'Microsoft Edge';
    } else if (/OPR\/(\d+)|Opera/i.test(ua)) {
        browser = 'Opera';
    } else if (/Chrome\/(\d+)/i.test(ua) && !/Edg/i.test(ua) && !/OPR/i.test(ua)) {
        browser = 'Chrome';
    } else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) {
        browser = 'Safari';
    } else if (/Firefox\/(\d+)/i.test(ua)) {
        browser = 'Firefox';
    }

    // Clean display string
    const deviceDisplay = (browser !== 'Unknown Browser' && os !== 'Unknown OS')
        ? `${browser} on ${os}`
        : browser !== 'Unknown Browser'
            ? browser
            : os !== 'Unknown OS'
                ? os
                : 'Web Browser';

    return {
        browser,
        os,
        deviceDisplay
    };
}

function parseClientIp(req) {
    if (!req) return '127.0.0.1';
    const forwarded = req.headers ? req.headers['x-forwarded-for'] : null;
    if (forwarded) {
        const first = forwarded.split(',')[0].trim();
        if (first) return first;
    }
    return req.ip || req.connection?.remoteAddress || '127.0.0.1';
}

function getLocationFromIp(ip) {
    if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip === 'Unknown IP') {
        return 'Local Network';
    }
    return 'Active Location';
}

module.exports = {
    parseUserAgent,
    parseClientIp,
    getLocationFromIp
};
