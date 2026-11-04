/**
 * TestNexa AI — Organization & Team Management Frontend Service
 */

const API_BASE = '/api/v1/organizations';

const getAuthHeaders = () => {
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('token') || localStorage.getItem('auth_token') || localStorage.getItem('testnexa_token');
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
    }
};

export default organizationService;
