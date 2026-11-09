/**
 * TestNexa AI — Role-Based Access Control (RBAC) Module
 * Defines roles, permission sets, and authorization validators for Organizations and Workspaces.
 */

const ROLES = {
    OWNER: 'owner',
    ADMIN: 'admin',
    QA_MANAGER: 'qa_manager',
    QA_ENGINEER: 'qa_engineer',
    VIEWER: 'viewer'
};

const ROLE_HIERARCHY = {
    [ROLES.OWNER]: 50,
    [ROLES.ADMIN]: 40,
    [ROLES.QA_MANAGER]: 30,
    [ROLES.QA_ENGINEER]: 20,
    [ROLES.VIEWER]: 10
};

const PERMISSIONS = {
    // Organization Management
    ORG_MANAGE_SETTINGS: 'org:manage_settings',
    ORG_MANAGE_BILLING: 'org:manage_billing',
    ORG_TRANSFER_OWNERSHIP: 'org:transfer_ownership',
    ORG_DELETE: 'org:delete',
    ORG_MANAGE_MEMBERS: 'org:manage_members',
    ORG_MANAGE_WORKSPACES: 'org:manage_workspaces',
    ORG_MANAGE_INTEGRATIONS: 'org:manage_integrations',
    ORG_VIEW_ACTIVITY: 'org:view_activity',

    // Workspace & Projects
    WORKSPACE_CREATE: 'workspace:create',
    WORKSPACE_MANAGE: 'workspace:manage',
    WORKSPACE_ARCHIVE: 'workspace:archive',

    // Test Suites & Cases
    SUITE_MANAGE: 'suite:manage',
    TESTCASE_CREATE_EDIT: 'testcase:create_edit',
    TESTCASE_DELETE: 'testcase:delete',

    // Execution & Reports
    EXECUTION_TRIGGER: 'execution:trigger',
    EXECUTION_VIEW: 'execution:view',
    REPORT_VIEW: 'report:view',

    // Audit Logs & Activity
    AUDIT_VIEW: 'audit.view',
    AUDIT_EXPORT: 'audit.export',

    // Quality Insights & Advanced Analytics
    ANALYTICS_VIEW: 'analytics.view',
    ANALYTICS_EXPORT: 'analytics.export',
    ANALYTICS_GENERATE_AI: 'analytics.generate_ai',

    // Enterprise Security & Administration
    SECURITY_VIEW: 'security.view',
    SECURITY_MANAGE: 'security.manage',
    SECURITY_SSO_MANAGE: 'security.sso.manage',
    SECURITY_MFA_MANAGE: 'security.mfa.manage',
    SECURITY_SESSIONS_MANAGE: 'security.sessions.manage',
    SECURITY_APIKEYS_MANAGE: 'security.apikeys.manage',
    SECURITY_POLICIES_MANAGE: 'security.policies.manage',
    SECURITY_AUDIT_VIEW: 'security.audit.view'
};

const ROLE_PERMISSIONS = {
    [ROLES.OWNER]: [
        PERMISSIONS.ORG_MANAGE_SETTINGS,
        PERMISSIONS.ORG_MANAGE_BILLING,
        PERMISSIONS.ORG_TRANSFER_OWNERSHIP,
        PERMISSIONS.ORG_DELETE,
        PERMISSIONS.ORG_MANAGE_MEMBERS,
        PERMISSIONS.ORG_MANAGE_WORKSPACES,
        PERMISSIONS.ORG_MANAGE_INTEGRATIONS,
        PERMISSIONS.ORG_VIEW_ACTIVITY,
        PERMISSIONS.AUDIT_VIEW,
        PERMISSIONS.AUDIT_EXPORT,
        PERMISSIONS.ANALYTICS_VIEW,
        PERMISSIONS.ANALYTICS_EXPORT,
        PERMISSIONS.ANALYTICS_GENERATE_AI,
        PERMISSIONS.SECURITY_VIEW,
        PERMISSIONS.SECURITY_MANAGE,
        PERMISSIONS.SECURITY_SSO_MANAGE,
        PERMISSIONS.SECURITY_MFA_MANAGE,
        PERMISSIONS.SECURITY_SESSIONS_MANAGE,
        PERMISSIONS.SECURITY_APIKEYS_MANAGE,
        PERMISSIONS.SECURITY_POLICIES_MANAGE,
        PERMISSIONS.SECURITY_AUDIT_VIEW,
        PERMISSIONS.WORKSPACE_CREATE,
        PERMISSIONS.WORKSPACE_MANAGE,
        PERMISSIONS.WORKSPACE_ARCHIVE,
        PERMISSIONS.SUITE_MANAGE,
        PERMISSIONS.TESTCASE_CREATE_EDIT,
        PERMISSIONS.TESTCASE_DELETE,
        PERMISSIONS.EXECUTION_TRIGGER,
        PERMISSIONS.EXECUTION_VIEW,
        PERMISSIONS.REPORT_VIEW
    ],
    [ROLES.ADMIN]: [
        PERMISSIONS.ORG_MANAGE_MEMBERS,
        PERMISSIONS.ORG_MANAGE_WORKSPACES,
        PERMISSIONS.ORG_MANAGE_INTEGRATIONS,
        PERMISSIONS.ORG_VIEW_ACTIVITY,
        PERMISSIONS.AUDIT_VIEW,
        PERMISSIONS.AUDIT_EXPORT,
        PERMISSIONS.ANALYTICS_VIEW,
        PERMISSIONS.ANALYTICS_EXPORT,
        PERMISSIONS.ANALYTICS_GENERATE_AI,
        PERMISSIONS.SECURITY_VIEW,
        PERMISSIONS.SECURITY_MANAGE,
        PERMISSIONS.SECURITY_SSO_MANAGE,
        PERMISSIONS.SECURITY_MFA_MANAGE,
        PERMISSIONS.SECURITY_SESSIONS_MANAGE,
        PERMISSIONS.SECURITY_APIKEYS_MANAGE,
        PERMISSIONS.SECURITY_POLICIES_MANAGE,
        PERMISSIONS.SECURITY_AUDIT_VIEW,
        PERMISSIONS.WORKSPACE_CREATE,
        PERMISSIONS.WORKSPACE_MANAGE,
        PERMISSIONS.WORKSPACE_ARCHIVE,
        PERMISSIONS.SUITE_MANAGE,
        PERMISSIONS.TESTCASE_CREATE_EDIT,
        PERMISSIONS.TESTCASE_DELETE,
        PERMISSIONS.EXECUTION_TRIGGER,
        PERMISSIONS.EXECUTION_VIEW,
        PERMISSIONS.REPORT_VIEW
    ],
    [ROLES.QA_MANAGER]: [
        PERMISSIONS.ORG_VIEW_ACTIVITY,
        PERMISSIONS.AUDIT_VIEW,
        PERMISSIONS.ANALYTICS_VIEW,
        PERMISSIONS.ANALYTICS_EXPORT,
        PERMISSIONS.ANALYTICS_GENERATE_AI,
        PERMISSIONS.SECURITY_VIEW,
        PERMISSIONS.SECURITY_AUDIT_VIEW,
        PERMISSIONS.SUITE_MANAGE,
        PERMISSIONS.TESTCASE_CREATE_EDIT,
        PERMISSIONS.TESTCASE_DELETE,
        PERMISSIONS.EXECUTION_TRIGGER,
        PERMISSIONS.EXECUTION_VIEW,
        PERMISSIONS.REPORT_VIEW
    ],
    [ROLES.QA_ENGINEER]: [
        PERMISSIONS.ANALYTICS_VIEW,
        PERMISSIONS.ANALYTICS_GENERATE_AI,
        PERMISSIONS.TESTCASE_CREATE_EDIT,
        PERMISSIONS.EXECUTION_TRIGGER,
        PERMISSIONS.EXECUTION_VIEW,
        PERMISSIONS.REPORT_VIEW
    ],
    [ROLES.VIEWER]: [
        PERMISSIONS.ANALYTICS_VIEW,
        PERMISSIONS.EXECUTION_VIEW,
        PERMISSIONS.REPORT_VIEW
    ]
};

/**
 * Permission aliases mapping (legacy and alternative notations)
 */
const PERMISSION_ALIASES = {
    'org:view_activity': ['org:view_activity', 'audit.view', 'audit:view'],
    'audit.view': ['audit.view', 'audit:view', 'org:view_activity'],
    'audit:view': ['audit.view', 'audit:view', 'org:view_activity'],
    'audit.export': ['audit.export', 'audit:export'],
    'audit:export': ['audit.export', 'audit:export'],
    'analytics.view': ['analytics.view', 'analytics:view'],
    'analytics:view': ['analytics.view', 'analytics:view'],
    'analytics.export': ['analytics.export', 'analytics:export'],
    'analytics:export': ['analytics.export', 'analytics:export'],
    'analytics.generate_ai': ['analytics.generate_ai', 'analytics:generate_ai'],
    'analytics:generate_ai': ['analytics.generate_ai', 'analytics:generate_ai'],
    'security.view': ['security.view', 'security:view'],
    'security:view': ['security.view', 'security:view'],
    'security.manage': ['security.manage', 'security:manage'],
    'security:manage': ['security.manage', 'security:manage'],
    'security.sso.manage': ['security.sso.manage', 'security:sso_manage'],
    'security.mfa.manage': ['security.mfa.manage', 'security:mfa_manage'],
    'security.sessions.manage': ['security.sessions.manage', 'security:sessions_manage'],
    'security.apikeys.manage': ['security.apikeys.manage', 'security:apikeys_manage'],
    'security.policies.manage': ['security.policies.manage', 'security:policies_manage']
};

/**
 * Checks whether a given role has a specific permission
 */
function hasOrgPermission(role, permission) {
    if (!role || !permission) return false;
    const normalizedRole = role.toLowerCase().trim();
    const permissions = ROLE_PERMISSIONS[normalizedRole];
    if (!permissions) return false;

    if (permissions.includes(permission)) return true;

    // Check alias variants if any
    const aliases = PERMISSION_ALIASES[permission];
    if (aliases && aliases.some(alias => permissions.includes(alias))) {
        return true;
    }

    return false;
}

/**
 * Compares two roles by hierarchy (returns true if userRole is >= minimumRequiredRole)
 */
function isRoleAtLeast(userRole, minimumRequiredRole) {
    if (!userRole || !minimumRequiredRole) return false;
    const userRank = ROLE_HIERARCHY[userRole.toLowerCase().trim()] || 0;
    const reqRank = ROLE_HIERARCHY[minimumRequiredRole.toLowerCase().trim()] || 0;
    return userRank >= reqRank;
}

/**
 * Validates whether a role is recognized
 */
function isValidRole(role) {
    if (!role || typeof role !== 'string') return false;
    return Object.values(ROLES).includes(role.toLowerCase().trim());
}

/**
 * Returns role metadata and label
 */
function getRoleMeta(role) {
    const r = (role || '').toLowerCase().trim();
    switch (r) {
        case ROLES.OWNER:
            return { id: r, name: 'Owner', description: 'Full organization authority, settings, billing, and ownership management.' };
        case ROLES.ADMIN:
            return { id: r, name: 'Admin', description: 'Manage members, workspaces, projects, integrations, and activity.' };
        case ROLES.QA_MANAGER:
            return { id: r, name: 'QA Manager', description: 'Manage test suites, test cases, execution reviews, and QA workflows.' };
        case ROLES.QA_ENGINEER:
            return { id: r, name: 'QA Engineer', description: 'Create and edit test cases, run automated/manual tests, and investigate failures.' };
        case ROLES.VIEWER:
            return { id: r, name: 'Viewer', description: 'Read-only access to suites, runs, and quality reports.' };
        default:
            return { id: r, name: r, description: '' };
    }
}

module.exports = {
    ROLES,
    PERMISSIONS,
    ROLE_HIERARCHY,
    ROLE_PERMISSIONS,
    hasOrgPermission,
    isRoleAtLeast,
    isValidRole,
    getRoleMeta
};

