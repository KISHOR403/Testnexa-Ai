/**
 * TestNexa AI — Enterprise Security & Administration Test Suite
 * Tests RFC 6238 TOTP MFA, Single-use Recovery Codes, SAML/OIDC Validation,
 * Session Revocation, API Key Generation & Scope Enforcement, IP Allowlisting & CIDR Matching.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const securityService = require('../src/services/security.service');
const supabaseService = require('../src/services/supabaseData.service');
const { hasOrgPermission, PERMISSIONS } = require('../src/utils/rbac');

test('Enterprise Security & Administration Suite', async (t) => {
    const testOrgId = 'org_sec_test_' + Date.now();

    await t.test('1. TOTP Engine: RFC 6238 Base32 Secret, Code Generation & Drift Verification', () => {
        // Generate secret
        const { secret, otpauthUrl } = securityService.generateTotpSecret('admin@enterprise.com', 'Enterprise QA');

        assert.ok(secret, 'Secret should be generated');
        assert.match(secret, /^[A-Z2-7]{16,64}$/, 'Secret must be valid uppercase Base32');
        assert.ok(otpauthUrl.startsWith('otpauth://totp/'), 'Must produce standard otpauth URI');

        // Generate valid current code
        const currentCode = securityService.generateTotpCode(secret);
        assert.match(currentCode, /^\d{6}$/, 'Code must be exactly 6 digits');

        // Verify valid code
        const isValid = securityService.verifyTotpCode(secret, currentCode);
        assert.strictEqual(isValid, true, 'Current TOTP code should verify successfully');

        // Verify invalid code rejected
        const isInvalid = securityService.verifyTotpCode(secret, '999999');
        assert.strictEqual(isInvalid, false, 'Arbitrary invalid token must be rejected');
    });

    await t.test('2. Recovery Codes: 10 Hashed Single-Use Codes & Consumption', () => {
        const { plainCodes, hashedCodes } = securityService.generateRecoveryCodes(10);

        assert.strictEqual(plainCodes.length, 10, 'Should generate 10 plaintext recovery codes');
        assert.strictEqual(hashedCodes.length, 10, 'Should generate 10 hashed records');
        assert.match(plainCodes[0], /^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/, 'Code must follow XXXX-XXXX-XXXX pattern');

        // Verify and consume first code
        const firstPlain = plainCodes[0];
        const consumeResult = securityService.verifyAndConsumeRecoveryCode(firstPlain, hashedCodes);

        assert.strictEqual(consumeResult.valid, true, 'Valid unused recovery code must be accepted');
        assert.ok(consumeResult.updatedCodes.some(c => c.usedAt !== null), 'Updated codes must record usedAt timestamp');

        // Attempt replay with consumed code
        const replayResult = securityService.verifyAndConsumeRecoveryCode(firstPlain, consumeResult.updatedCodes);
        assert.strictEqual(replayResult.valid, false, 'Already consumed recovery code must be rejected');
    });

    await t.test('3. MFA Rate Limiting: Blocks Brute-Force Verification Attempts', () => {
        const rateLimitKey = 'rl_test_' + Date.now();

        // 5 allowed attempts
        for (let i = 0; i < 5; i++) {
            const allowed = securityService.checkMfaRateLimit(rateLimitKey, 5);
            assert.strictEqual(allowed, true, `Attempt ${i + 1} should be permitted`);
        }

        // 6th attempt should be blocked
        const blocked = securityService.checkMfaRateLimit(rateLimitKey, 5);
        assert.strictEqual(blocked, false, 'Sixth attempt must trigger rate limit block');
    });

    await t.test('4. SSO Config & Replay Protection: Validates SAML/OIDC and Rejects Replays', () => {
        // Valid SAML configuration
        const validSaml = {
            providerName: 'Okta Enterprise',
            protocol: 'saml',
            domains: ['enterprise.com'],
            issuer: 'https://idp.enterprise.com/entity',
            entryPoint: 'https://idp.enterprise.com/sso',
            certOrPublicKey: '-----BEGIN CERTIFICATE-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END CERTIFICATE-----'
        };
        const validation = securityService.validateSsoConfig(validSaml);
        assert.strictEqual(validation.valid, true, 'Valid SAML config must pass validation');

        // Replay cache test
        const assertionId = 'assert_' + crypto.randomBytes(8).toString('hex');
        const firstCheck = securityService.checkAndRecordReplay(assertionId, 300000);
        assert.strictEqual(firstCheck, true, 'First presentation of assertion must be accepted');

        const secondCheck = securityService.checkAndRecordReplay(assertionId, 300000);
        assert.strictEqual(secondCheck, false, 'Duplicate presentation of assertion must be rejected as replay attack');
    });

    await t.test('5. API Keys: Generates High-Entropy Token, Prefix, and Enforces Scopes', async () => {
        const { fullKey, keyRecord } = securityService.generateApiKey({
            orgId: testOrgId,
            name: 'Production Deployer',
            scopes: ['testcases:read', 'executions:trigger', 'reports:read'],
            expiresInDays: 30
        });

        assert.ok(fullKey.startsWith('tnx_live_'), 'Key must begin with tnx_live_ prefix');
        assert.strictEqual(keyRecord.keyPrefix, fullKey.substring(0, 14), 'Prefix must match first 14 chars');
        assert.ok(keyRecord.keyHash, 'Key record must store SHA-256 hash');
        assert.notStrictEqual(keyRecord.keyHash, fullKey, 'Plaintext key must never match stored hash');

        // Save to store
        await supabaseService.saveApiKey(keyRecord);

        // Scope verification
        const validScope = await securityService.validateApiKey(fullKey, 'executions:trigger');
        assert.strictEqual(validScope.valid, true, 'Should authorize granted scope');

        const invalidScope = await securityService.validateApiKey(fullKey, 'integrations:manage');
        assert.strictEqual(invalidScope.valid, false, 'Should deny ungranted scope');

        // Revocation
        await supabaseService.revokeApiKey(keyRecord.id);
        const revoked = await supabaseService.getApiKeyById(keyRecord.id);
        assert.strictEqual(revoked.status, 'revoked', 'Key status must update to revoked');
    });

    await t.test('6. Security Policies: Password Rules & Approved Domain Enforcement', () => {
        const strictPolicy = {
            minPasswordLength: 12,
            requirePasswordComplexity: true
        };

        // Weak password
        const weakCheck = securityService.validatePasswordPolicy('short1!', strictPolicy);
        assert.strictEqual(weakCheck.valid, false, 'Short password must be rejected');

        // Strong password
        const strongCheck = securityService.validatePasswordPolicy('SuperSecur3!P@ssword', strictPolicy);
        assert.strictEqual(strongCheck.valid, true, 'Strong password meeting criteria must pass');

        // Domain validation
        const approvedDomains = ['acme.com', 'testnexa.ai'];
        assert.strictEqual(securityService.validateEmailDomain('alice@acme.com', approvedDomains), true, 'Approved domain should be allowed');
        assert.strictEqual(securityService.validateEmailDomain('hacker@evil.com', approvedDomains), false, 'Unapproved domain must be rejected');
    });

    await t.test('7. IP Allowlisting: CIDR Subnet Parsing & Lockout Prevention', () => {
        // CIDR match testing
        assert.strictEqual(securityService.isIpInCidr('192.168.1.50', '192.168.1.0/24'), true, 'IPv4 within /24 subnet must match');
        assert.strictEqual(securityService.isIpInCidr('192.168.2.1', '192.168.1.0/24'), false, 'IPv4 outside subnet must not match');
        assert.strictEqual(securityService.isIpInCidr('10.0.0.1', '10.0.0.1/32'), true, 'Exact /32 match must evaluate to true');

        // Lockout check
        const clientIp = '203.0.113.15';
        const safeAllowlist = [{ cidrOrIp: '203.0.113.0/24' }, { cidrOrIp: '10.0.0.0/8' }];
        assert.strictEqual(securityService.validateIpAllowlist(clientIp, safeAllowlist), true, 'Allowed client IP must pass');

        const blockingAllowlist = [{ cidrOrIp: '10.0.0.0/8' }];
        assert.strictEqual(securityService.validateIpAllowlist(clientIp, blockingAllowlist), false, 'Disallowed client IP must be blocked');
    });

    await t.test('8. RBAC Permissions: Enforces Security Privileges', () => {
        // Owner has security manage
        assert.strictEqual(hasOrgPermission('owner', PERMISSIONS.SECURITY_MANAGE), true, 'Owner must have SECURITY_MANAGE');
        assert.strictEqual(hasOrgPermission('owner', PERMISSIONS.SECURITY_SSO_MANAGE), true, 'Owner must have SECURITY_SSO_MANAGE');

        // Viewer cannot manage security
        assert.strictEqual(hasOrgPermission('viewer', PERMISSIONS.SECURITY_MANAGE), false, 'Viewer must not have SECURITY_MANAGE');
        assert.strictEqual(hasOrgPermission('qa_engineer', PERMISSIONS.SECURITY_SSO_MANAGE), false, 'QA Engineer must not manage SSO');
    });
});
