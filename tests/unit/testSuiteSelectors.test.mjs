import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    computeSuiteMetrics,
    filterAndSortSuites,
    paginateSuites,
    normalizeSuite
} from '../../frontend/utils/testSuiteSelectors.js';

describe('Test Suite Selector Utilities & Consistency', () => {
    // Mock sample suites
    const mockRawRecords = [
        {
            id: 'SUITE-001',
            title: 'Authentication & Session Suite',
            requirement: 'End-to-end user authentication flow and token refresh',
            status: 'Active',
            updatedAt: '2026-11-15T12:00:00Z',
            suiteData: {
                projectName: 'AuthService',
                tags: ['security', 'jwt', 'api'],
                context: 'api',
                testCases: [
                    { id: 'TC-1', title: 'Login with valid credentials', status: 'approved', executionType: 'automated' },
                    { id: 'TC-2', title: 'Login with invalid credentials', status: 'approved', executionType: 'automated' },
                    { id: 'TC-3', title: 'Token expiry after 15 mins', status: 'draft', executionType: 'manual' }
                ]
            }
        },
        {
            id: 'SUITE-002',
            title: 'Checkout & Payment Gateway',
            requirement: 'Stripe integration and cart validation',
            status: 'Active',
            updatedAt: '2026-11-14T09:30:00Z',
            suiteData: {
                projectName: 'Storefront',
                tags: ['e-commerce', 'stripe'],
                context: 'web',
                testCases: [
                    { id: 'TC-4', title: 'Complete credit card purchase', status: 'approved', executionType: 'automated' },
                    { id: 'TC-5', title: 'Handle declined card error', status: 'draft', executionType: 'manual' }
                ]
            }
        },
        {
            id: 'SUITE-003',
            title: 'Mobile Push Notifications',
            requirement: 'APNS and FCM notification handling',
            status: 'Draft',
            updatedAt: '2026-11-10T14:15:00Z',
            suiteData: {
                projectName: 'MobileApp',
                tags: ['mobile', 'notifications'],
                context: 'mobile',
                testCases: [
                    { id: 'TC-6', title: 'Receive background push', status: 'draft', executionType: 'manual' }
                ]
            }
        },
        {
            id: 'SUITE-004',
            title: 'Legacy Reporting V1',
            requirement: 'Deprecated tabular reporting module',
            status: 'Archived',
            updatedAt: '2026-10-01T08:00:00Z',
            suiteData: {
                projectName: 'Reports',
                tags: ['legacy'],
                context: 'web',
                testCases: [
                    { id: 'TC-7', title: 'Generate CSV export', status: 'approved', executionType: 'manual' }
                ]
            }
        }
    ];

    const mockRuns = [
        {
            id: 'RUN-101',
            suiteId: 'SUITE-001',
            completedAt: '2026-11-15T14:00:00Z',
            status: 'passed',
            passedCount: 2,
            failedCount: 0
        },
        {
            id: 'RUN-102',
            suiteId: 'SUITE-002',
            completedAt: '2026-11-14T10:00:00Z',
            status: 'failed',
            passedCount: 1,
            failedCount: 1
        }
    ];

    const normalizedSuites = mockRawRecords.map(r => normalizeSuite(r, mockRuns));

    describe('computeSuiteMetrics agreement with rows', () => {
        it('calculates metrics from a single source of truth that match suite rows', () => {
            const metrics = computeSuiteMetrics(normalizedSuites);

            assert.equal(metrics.all, 4, 'Total suites should equal 4');
            assert.equal(metrics.active, 2, 'Active suites should equal 2 (excluding draft and archived)');
            assert.equal(metrics.draft, 1, 'Draft suites should equal 1');
            assert.equal(metrics.archived, 1, 'Archived suites should equal 1');
            assert.equal(metrics.cases, 7, 'Total test cases across all suites should equal 7 (3+2+1+1)');
            assert.equal(metrics.approved, 4, 'Approved cases across all suites should equal 4');
            assert.equal(metrics.withRuns, 2, 'Suites with runs should equal 2 (SUITE-001 and SUITE-002)');
        });
    });

    describe('filterAndSortSuites', () => {
        it('filters by status correctly and agrees with metrics', () => {
            const activeOnly = filterAndSortSuites(normalizedSuites, { statusFilter: 'active' });
            assert.equal(activeOnly.length, 2);
            assert.ok(activeOnly.every(s => s.status === 'Active' && !s.archived));

            const archivedOnly = filterAndSortSuites(normalizedSuites, { statusFilter: 'archived' });
            assert.equal(archivedOnly.length, 1);
            assert.equal(archivedOnly[0].id, 'SUITE-004');

            const withRunsOnly = filterAndSortSuites(normalizedSuites, { statusFilter: 'withRuns' });
            assert.equal(withRunsOnly.length, 2);
            assert.ok(withRunsOnly.every(s => s.runs.length > 0));
        });

        it('filters by platform correctly', () => {
            const apiSuites = filterAndSortSuites(normalizedSuites, { platformFilter: 'api' });
            assert.equal(apiSuites.length, 1);
            assert.equal(apiSuites[0].id, 'SUITE-001');

            const mobileSuites = filterAndSortSuites(normalizedSuites, { platformFilter: 'mobile' });
            assert.equal(mobileSuites.length, 1);
            assert.equal(mobileSuites[0].id, 'SUITE-003');
        });

        it('searches across name, ID, description, project and tags', () => {
            // Search by name
            const byName = filterAndSortSuites(normalizedSuites, { query: 'checkout' });
            assert.equal(byName.length, 1);
            assert.equal(byName[0].id, 'SUITE-002');

            // Search by ID
            const byId = filterAndSortSuites(normalizedSuites, { query: 'SUITE-003' });
            assert.equal(byId.length, 1);
            assert.equal(byId[0].id, 'SUITE-003');

            // Search by description
            const byDesc = filterAndSortSuites(normalizedSuites, { query: 'token refresh' });
            assert.equal(byDesc.length, 1);
            assert.equal(byDesc[0].id, 'SUITE-001');

            // Search by project
            const byProject = filterAndSortSuites(normalizedSuites, { query: 'Storefront' });
            assert.equal(byProject.length, 1);
            assert.equal(byProject[0].id, 'SUITE-002');

            // Search by tag
            const byTag = filterAndSortSuites(normalizedSuites, { query: 'stripe' });
            assert.equal(byTag.length, 1);
            assert.equal(byTag[0].id, 'SUITE-002');
        });

        it('sorts suites by name, cases, last execution and updated', () => {
            const sortedNameAsc = filterAndSortSuites(normalizedSuites, { sort: 'name_asc' });
            assert.equal(sortedNameAsc[0].name, 'Authentication & Session Suite');
            assert.equal(sortedNameAsc[3].name, 'Mobile Push Notifications');

            const sortedCasesDesc = filterAndSortSuites(normalizedSuites, { sort: 'cases_desc' });
            assert.equal(sortedCasesDesc[0].totalCases, 3); // SUITE-001
            assert.equal(sortedCasesDesc[3].totalCases, 1);

            const sortedUpdatedDesc = filterAndSortSuites(normalizedSuites, { sort: 'updated_desc' });
            assert.equal(sortedUpdatedDesc[0].id, 'SUITE-001');
            assert.equal(sortedUpdatedDesc[3].id, 'SUITE-004');
        });
    });

    describe('paginateSuites', () => {
        it('handles single page without pagination required', () => {
            const p = paginateSuites(normalizedSuites, 1, 10);
            assert.equal(p.totalPages, 1);
            assert.equal(p.rows.length, 4);
            assert.equal(p.startIndex, 1);
            assert.equal(p.endIndex, 4);
        });

        it('correctly segments pages and sets "1-2 of N"', () => {
            const p1 = paginateSuites(normalizedSuites, 1, 2);
            assert.equal(p1.totalPages, 2);
            assert.equal(p1.rows.length, 2);
            assert.equal(p1.startIndex, 1);
            assert.equal(p1.endIndex, 2);

            const p2 = paginateSuites(normalizedSuites, 2, 2);
            assert.equal(p2.totalPages, 2);
            assert.equal(p2.rows.length, 2);
            assert.equal(p2.startIndex, 3);
            assert.equal(p2.endIndex, 4);
        });
    });
});
