/**
 * TestNexa AI — Organization & Team Management Frontend Service
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';
const API_BASE = `${API_BASE_URL}/organizations`;

const getAuthHeaders = () => {
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('testnexa_token') || localStorage.getItem('token') || localStorage.getItem('auth_token');
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
};

const handleResponse = async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.message || data.error || `Request failed (HTTP ${res.status})`);
    }
    return data;
};

export const organizationService = {
    async getUserOrganizations() {
        const res = await fetch(`${API_BASE}`, {
            headers: getAuthHeaders()
        });
        return handleResponse(res);
    },

    async getOrganization(orgId) {
        const res = await fetch(`${API_BASE}/${orgId}`, {
            headers: getAuthHeaders()
        });
        return handleResponse(res);
    },

    async createOrganization(payload) {
        const res = await fetch(`${API_BASE}`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        return handleResponse(res);
    },

    async updateOrganization(orgId, updates) {
        const res = await fetch(`${API_BASE}/${orgId}`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify(updates)
        });
        return handleResponse(res);
    },

    async deleteOrganization(orgId) {
        const res = await fetch(`${API_BASE}/${orgId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        return handleResponse(res);
    },

    async transferOwnership(orgId, newOwnerId) {
        const res = await fetch(`${API_BASE}/${orgId}/transfer-ownership`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ newOwnerId })
        });
        return handleResponse(res);
    },

    async getMembers(orgId) {
        const res = await fetch(`${API_BASE}/${orgId}/members`, {
            headers: getAuthHeaders()
        });
        return handleResponse(res);
    },

    async updateMemberRole(orgId, userId, role) {
        const res = await fetch(`${API_BASE}/${orgId}/members/${userId}`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ role })
        });
        return handleResponse(res);
    },

    async removeMember(orgId, userId) {
        const res = await fetch(`${API_BASE}/${orgId}/members/${userId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        return handleResponse(res);
    },

    async getInvitations(orgId, status = 'pending') {
        const res = await fetch(`${API_BASE}/${orgId}/invitations?status=${encodeURIComponent(status)}`, {
            headers: getAuthHeaders()
        });
        return handleResponse(res);
    },

    async createInvitation(orgId, payload) {
        const res = await fetch(`${API_BASE}/${orgId}/invitations`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        return handleResponse(res);
    },

    async cancelInvitation(orgId, invitationId) {
        const res = await fetch(`${API_BASE}/${orgId}/invitations/${invitationId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        return handleResponse(res);
    },

    async resendInvitation(orgId, invitationId) {
        const res = await fetch(`${API_BASE}/${orgId}/invitations/${invitationId}/resend`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        return handleResponse(res);
    },

    async acceptInvitation(token) {
        const res = await fetch(`${API_BASE}/invitations/${token}/accept`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        return handleResponse(res);
    },

    async rejectInvitation(token) {
        const res = await fetch(`${API_BASE}/invitations/${token}/reject`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        return handleResponse(res);
    },

    async getWorkspaces(orgId, includeArchived = false) {
        const res = await fetch(`${API_BASE}/${orgId}/workspaces?includeArchived=${includeArchived}`, {
            headers: getAuthHeaders()
        });
        return handleResponse(res);
    },

    async createWorkspace(orgId, payload) {
        const res = await fetch(`${API_BASE}/${orgId}/workspaces`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        return handleResponse(res);
    },

    async archiveWorkspace(orgId, workspaceId, isArchived = true) {
        const res = await fetch(`${API_BASE}/${orgId}/workspaces/${workspaceId}/archive`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ isArchived })
        });
        return handleResponse(res);
    },

    async getActivity(orgId, limit = 50) {
        const res = await fetch(`${API_BASE}/${orgId}/activity?limit=${limit}`, {
            headers: getAuthHeaders()
        });
        return handleResponse(res);
    },

    async getAuditLogs(orgId, filters = {}) {
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(filters)) {
            if (v !== undefined && v !== null && v !== '' && v !== 'all') {
                params.append(k, v);
            }
        }
        const qs = params.toString();
        const url = `${API_BASE}/${orgId}/audit-logs${qs ? `?${qs}` : ''}`;
        const res = await fetch(url, {
            headers: getAuthHeaders()
        });
        return handleResponse(res);
    },

    async getAuditLogDetails(orgId, eventId) {
        const res = await fetch(`${API_BASE}/${orgId}/audit-logs/${eventId}`, {
            headers: getAuthHeaders()
        });
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
        const url = `${API_BASE}/${orgId}/audit-logs/export${qs ? `?${qs}` : ''}`;
        const res = await fetch(url, {
            headers: getAuthHeaders()
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.message || 'Failed to export audit logs');
        }
        const blob = await res.blob();
        return blob;
    },

    async getResourceActivity(resourceType, resourceId, options = {}) {
        const params = new URLSearchParams();
        if (options.limit) params.append('limit', options.limit);
        if (options.orgId) params.append('orgId', options.orgId);
        const qs = params.toString();
        const res = await fetch(`${API_BASE_URL}/audit/resource/${resourceType}/${resourceId}${qs ? `?${qs}` : ''}`, {
            headers: getAuthHeaders(),
            credentials: 'include'
        });
        return handleResponse(res);
    },

    async getUsage(orgId) {
        const res = await fetch(`${API_BASE}/${orgId}/usage`, {
            headers: getAuthHeaders()
        });
        return handleResponse(res);
    },

    async getUsageHistory(orgId, filters = {}) {
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(filters)) {
            if (v !== undefined && v !== null && v !== '' && v !== 'all') {
                params.append(k, v);
            }
        }
        const qs = params.toString();
        const res = await fetch(`${API_BASE}/${orgId}/usage/history${qs ? `?${qs}` : ''}`, {
            headers: getAuthHeaders()
        });
        return handleResponse(res);
    },

    async getUsageWarnings(orgId) {
        const res = await fetch(`${API_BASE}/${orgId}/usage/warnings`, {
            headers: getAuthHeaders()
        });
        return handleResponse(res);
    }
};

export default organizationService;

