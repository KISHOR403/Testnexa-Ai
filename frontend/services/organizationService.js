/**
 * TestNexa AI — Organization & Team Management Frontend Service
 * Includes RBAC, Audit Logging, Usage Limits & Quotas, and Enterprise Security.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';
const API_BASE = `${API_BASE_URL}/organizations`;
const SECURITY_API_BASE = `${API_BASE_URL}/security`;

const getAuthHeaders = () => {
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('testnexa_token') || localStorage.getItem('token') || localStorage.getItem('auth_token');
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
};

/**
 * Fetch wrapper with timeout and credentials
 */
const safeFetch = async (url, options = {}, timeoutMs = 6000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch(url, {
            ...options,
            credentials: 'include',
            headers: {
                ...getAuthHeaders(),
                ...(options.headers || {})
            },
            signal: options.signal || controller.signal
        });
        clearTimeout(timer);
        return res;
    } catch (err) {
        clearTimeout(timer);
        if (err.name === 'AbortError') {
            throw new Error('Request timed out. Please check your network connection.');
        }
        throw err;
    }
};

const handleResponse = async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.message || data.error || `Request failed (HTTP ${res.status})`);
    }
    return data;
};

export const organizationService = {
    // ==========================================
    // ORGANIZATIONS & MEMBERS
    // ==========================================
    async getUserOrganizations() {
        try {
            const res = await safeFetch(`${API_BASE}`);
            const data = await handleResponse(res);
            if (data?.data && Array.isArray(data.data) && data.data.length > 0) {
                try {
                    localStorage.setItem('testnexa_cached_orgs', JSON.stringify(data.data));
                } catch {}
            }
            return data;
        } catch (err) {
            try {
                const cached = localStorage.getItem('testnexa_cached_orgs');
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (parsed.length > 0) {
                        return { success: true, data: parsed, fromCache: true };
                    }
                }
            } catch {}
            throw err;
        }
    },

    async getOrganization(orgId) {
        const res = await safeFetch(`${API_BASE}/${encodeURIComponent(orgId)}`);
        return handleResponse(res);
    },

    async createOrganization(payload) {
        const res = await safeFetch(`${API_BASE}`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        return handleResponse(res);
    },

    async updateOrganization(orgId, updates) {
        const res = await safeFetch(`${API_BASE}/${encodeURIComponent(orgId)}`, {
            method: 'PATCH',
            body: JSON.stringify(updates)
        });
        return handleResponse(res);
    },

    async deleteOrganization(orgId) {
        const res = await safeFetch(`${API_BASE}/${encodeURIComponent(orgId)}`, {
            method: 'DELETE'
        });
        return handleResponse(res);
    },

    async transferOwnership(orgId, newOwnerId) {
        const res = await safeFetch(`${API_BASE}/${encodeURIComponent(orgId)}/transfer-ownership`, {
            method: 'POST',
            body: JSON.stringify({ newOwnerId })
        });
        return handleResponse(res);
    },

    async getMembers(orgId) {
        const res = await safeFetch(`${API_BASE}/${encodeURIComponent(orgId)}/members`);
        return handleResponse(res);
    },

    async updateMemberRole(orgId, userId, role) {
        const res = await safeFetch(`${API_BASE}/${encodeURIComponent(orgId)}/members/${encodeURIComponent(userId)}`, {
            method: 'PATCH',
            body: JSON.stringify({ role })
        });
        return handleResponse(res);
    },

    async removeMember(orgId, userId) {
        const res = await safeFetch(`${API_BASE}/${encodeURIComponent(orgId)}/members/${encodeURIComponent(userId)}`, {
            method: 'DELETE'
        });
        return handleResponse(res);
    },

    async getInvitations(orgId, status = 'pending') {
        const res = await safeFetch(`${API_BASE}/${encodeURIComponent(orgId)}/invitations?status=${encodeURIComponent(status)}`);
        return handleResponse(res);
    },

    async createInvitation(orgId, payload) {
        const res = await safeFetch(`${API_BASE}/${encodeURIComponent(orgId)}/invitations`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        return handleResponse(res);
    },

    async cancelInvitation(orgId, invitationId) {
        const res = await safeFetch(`${API_BASE}/${encodeURIComponent(orgId)}/invitations/${encodeURIComponent(invitationId)}`, {
            method: 'DELETE'
        });
        return handleResponse(res);
    },

    async resendInvitation(orgId, invitationId) {
        const res = await safeFetch(`${API_BASE}/${encodeURIComponent(orgId)}/invitations/${encodeURIComponent(invitationId)}/resend`, {
            method: 'POST'
        });
        return handleResponse(res);
    },

    async acceptInvitation(token) {
        const res = await safeFetch(`${API_BASE}/invitations/${encodeURIComponent(token)}/accept`, {
            method: 'POST'
        });
        return handleResponse(res);
    },

    async rejectInvitation(token) {
        const res = await safeFetch(`${API_BASE}/invitations/${encodeURIComponent(token)}/reject`, {
            method: 'POST'
        });
        return handleResponse(res);
    },

    async getWorkspaces(orgId, includeArchived = false) {
        const res = await safeFetch(`${API_BASE}/${encodeURIComponent(orgId)}/workspaces?includeArchived=${includeArchived}`);
        return handleResponse(res);
    },

    async createWorkspace(orgId, payload) {
        const res = await safeFetch(`${API_BASE}/${encodeURIComponent(orgId)}/workspaces`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        return handleResponse(res);
    },

    async archiveWorkspace(orgId, workspaceId, isArchived = true) {
        const res = await safeFetch(`${API_BASE}/${encodeURIComponent(orgId)}/workspaces/${encodeURIComponent(workspaceId)}/archive`, {
            method: 'PATCH',
            body: JSON.stringify({ isArchived })
        });
        return handleResponse(res);
    },

    async getActivity(orgId, limit = 20) {
        const res = await safeFetch(`${API_BASE}/${encodeURIComponent(orgId)}/activity?limit=${limit}`);
        return handleResponse(res);
    },

    // ==========================================
    // AUDIT LOGS
    // ==========================================
    async getAuditLogs(orgId, filters = {}) {
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(filters)) {
            if (v !== undefined && v !== null && v !== '' && v !== 'all') {
                params.append(k, v);
            }
        }
        const qs = params.toString();
        const res = await safeFetch(`${API_BASE}/${encodeURIComponent(orgId)}/audit-logs${qs ? `?${qs}` : ''}`);
        return handleResponse(res);
    },

    async getAuditLogDetails(orgId, eventId) {
        const res = await safeFetch(`${API_BASE}/${encodeURIComponent(orgId)}/audit-logs/${encodeURIComponent(eventId)}`);
        return handleResponse(res);
    },

    async exportAuditLogs(orgId, filters = {}) {
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(filters)) {
            if (v !== undefined && v !== null && v !== '' && v !== 'all') {
                params.append(k, v);
            }
        }
        const qs = params.toString();
        const res = await safeFetch(`${API_BASE}/${encodeURIComponent(orgId)}/audit-logs/export${qs ? `?${qs}` : ''}`);
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.message || 'Export failed');
        }
        return res.blob();
    },

    // ==========================================
    // USAGE LIMITS & QUOTAS
    // ==========================================
    async getUsage(orgId) {
        try {
            const res = await safeFetch(`${API_BASE}/${encodeURIComponent(orgId)}/usage`);
            const data = await handleResponse(res);
            if (data?.data) {
                try {
                    localStorage.setItem(`testnexa_cached_usage_${orgId}`, JSON.stringify(data.data));
                } catch {}
            }
            return data;
        } catch (err) {
            try {
                const cached = localStorage.getItem(`testnexa_cached_usage_${orgId}`);
                if (cached) {
                    return { success: true, data: JSON.parse(cached), fromCache: true };
                }
            } catch {}
            throw err;
        }
    },

    async getUsageHistory(orgId, filters = {}) {
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(filters)) {
            if (v !== undefined && v !== null && v !== '' && v !== 'all') {
                params.append(k, v);
            }
        }
        const qs = params.toString();
        const res = await safeFetch(`${API_BASE}/${encodeURIComponent(orgId)}/usage/history${qs ? `?${qs}` : ''}`);
        return handleResponse(res);
    },

    async getUsageWarnings(orgId) {
        const res = await safeFetch(`${API_BASE}/${encodeURIComponent(orgId)}/usage/warnings`);
        return handleResponse(res);
    },

    // ==========================================
    // ENTERPRISE SECURITY (SSO, MFA, Sessions, API Keys, Policies, Allowlist)
    // ==========================================
    async getSsoConfig(orgId) {
        const res = await safeFetch(`${API_BASE}/${encodeURIComponent(orgId)}/security/sso`);
        return handleResponse(res);
    },

    async configureSso(orgId, configPayload) {
        const res = await safeFetch(`${API_BASE}/${encodeURIComponent(orgId)}/security/sso`, {
            method: 'POST',
            body: JSON.stringify(configPayload)
        });
        return handleResponse(res);
    },

    async testSsoConfig(orgId) {
        const res = await safeFetch(`${API_BASE}/${encodeURIComponent(orgId)}/security/sso/test`, {
            method: 'POST'
        });
        return handleResponse(res);
    },

    async toggleSsoEnforcement(orgId, isEnforced) {
        const res = await safeFetch(`${API_BASE}/${encodeURIComponent(orgId)}/security/sso/enforce`, {
            method: 'PATCH',
            body: JSON.stringify({ isEnforced })
        });
        return handleResponse(res);
    },

    async deleteSsoConfig(orgId) {
        const res = await safeFetch(`${API_BASE}/${encodeURIComponent(orgId)}/security/sso`, {
            method: 'DELETE'
        });
        return handleResponse(res);
    },

    // MFA Management
    async getMfaStatus() {
        const res = await safeFetch(`${SECURITY_API_BASE}/mfa/status`);
        return handleResponse(res);
    },

    async setupMfa() {
        const res = await safeFetch(`${SECURITY_API_BASE}/mfa/setup`, {
            method: 'POST'
        });
        return handleResponse(res);
    },

    async verifyMfa(code) {
        const res = await safeFetch(`${SECURITY_API_BASE}/mfa/verify`, {
            method: 'POST',
            body: JSON.stringify({ code })
        });
        return handleResponse(res);
    },

    async disableMfa(password, code) {
        const res = await safeFetch(`${SECURITY_API_BASE}/mfa/disable`, {
            method: 'POST',
            body: JSON.stringify({ password, code })
        });
        return handleResponse(res);
    },

    async regenerateRecoveryCodes(password) {
        const res = await safeFetch(`${SECURITY_API_BASE}/mfa/recovery-codes`, {
            method: 'POST',
            body: JSON.stringify({ password })
        });
        return handleResponse(res);
    },

    // Sessions Management
    async listSessions() {
        const res = await safeFetch(`${SECURITY_API_BASE}/sessions`);
        return handleResponse(res);
    },

    async revokeSession(sessionId) {
        const res = await safeFetch(`${SECURITY_API_BASE}/sessions/${encodeURIComponent(sessionId)}`, {
            method: 'DELETE'
        });
        return handleResponse(res);
    },

    async revokeAllOtherSessions() {
        const res = await safeFetch(`${SECURITY_API_BASE}/sessions/revoke-others`, {
            method: 'POST'
        });
        return handleResponse(res);
    },

    // Organization API Keys
    async listApiKeys(orgId) {
        const res = await safeFetch(`${API_BASE}/${encodeURIComponent(orgId)}/security/api-keys`);
        return handleResponse(res);
    },

    async createApiKey(orgId, payload) {
        const res = await safeFetch(`${API_BASE}/${encodeURIComponent(orgId)}/security/api-keys`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        return handleResponse(res);
    },

    async rotateApiKey(orgId, keyId, expiryDays = 90) {
        const res = await safeFetch(`${API_BASE}/${encodeURIComponent(orgId)}/security/api-keys/${encodeURIComponent(keyId)}/rotate`, {
            method: 'POST',
            body: JSON.stringify({ expiryDays })
        });
        return handleResponse(res);
    },

    async revokeApiKey(orgId, keyId) {
        const res = await safeFetch(`${API_BASE}/${encodeURIComponent(orgId)}/security/api-keys/${encodeURIComponent(keyId)}`, {
            method: 'DELETE'
        });
        return handleResponse(res);
    },

    // Organization Security Policies
    async getSecurityPolicy(orgId) {
        const res = await safeFetch(`${API_BASE}/${encodeURIComponent(orgId)}/security/policy`);
        return handleResponse(res);
    },

    async updateSecurityPolicy(orgId, updates) {
        const res = await safeFetch(`${API_BASE}/${encodeURIComponent(orgId)}/security/policy`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
        return handleResponse(res);
    },

    // IP Allowlist
    async listIpAllowlist(orgId) {
        const res = await safeFetch(`${API_BASE}/${encodeURIComponent(orgId)}/security/ip-allowlist`);
        return handleResponse(res);
    },

    async addIpAllowlistEntry(orgId, payload) {
        const res = await safeFetch(`${API_BASE}/${encodeURIComponent(orgId)}/security/ip-allowlist`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        return handleResponse(res);
    },

    async removeIpAllowlistEntry(orgId, entryId) {
        const res = await safeFetch(`${API_BASE}/${encodeURIComponent(orgId)}/security/ip-allowlist/${encodeURIComponent(entryId)}`, {
            method: 'DELETE'
        });
        return handleResponse(res);
    },

    async getMyIp() {
        const res = await safeFetch(`${SECURITY_API_BASE}/my-ip`);
        return handleResponse(res);
    },

    // Security Audit Log Stream
    async listSecurityEvents(orgId, limit = 50) {
        const res = await safeFetch(`${API_BASE}/${encodeURIComponent(orgId)}/security/events?limit=${limit}`);
        return handleResponse(res);
    }
};

export default organizationService;
