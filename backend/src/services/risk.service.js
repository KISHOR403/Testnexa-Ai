/**
 * Centralized Threat Modeling & Risk Vectors Service
 * Provides business logic for:
 * - Summary aggregation with canonical quality metrics agreement
 * - Paginated risk query engine with multi-facet filters & sorting
 * - 5x5 Likelihood x Impact threat matrix
 * - Dynamic mitigation status computation
 * - Status transition lifecycle with mandatory accepted reasons & audit trail
 * - Test case linking/unlinking
 * - CSV and JSON exports
 * - Deterministic derived risk backfill across all suites
 */

const supabaseService = require('./supabaseData.service');
const qualityMetricsService = require('./qualityMetrics.service');
const {
    RISK_CATEGORIES,
    RISK_STATUSES,
    RISK_SOURCES,
    MITIGATION_STATES,
    calculateRiskScore,
    isEligibleRiskCase,
    deriveRiskCategory,
    deriveLikelihoodAndImpact,
    deriveThreatStatement,
    computeRiskMitigation,
    normalizeCanonicalTestType
} = require('./riskScoring');
const { extractValidTestCasesFromSession, isEligibleGeneratedSuite } = require('../utils/testCaseManagement.validation');
const { ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');

// Check feature flag for execution runs
const isExecutionEnabled = () => {
    return process.env.FEATURE_TEST_RUNS === 'true';
};

class RiskService {

    /**
     * Helper to load all accessible test cases and requirements for a user's suites
     */
    async _loadSuitesContext(userId) {
        const result = await supabaseService.listSessions({
            userId,
            page: 1,
            limit: 500,
            hasCases: true,
            onlyGenerated: true
        });

        const eligible = (result.sessions || []).filter(isEligibleGeneratedSuite);
        const allSessionsMap = new Map(eligible.map(s => [String(s.id || s._id), s]));

        const suiteCaseMap = new Map(); // suiteId -> array of cases
        const allCaseMap = new Map();   // caseId -> case
        const suiteReqMap = new Map();  // suiteId -> array of reqs
        const allReqMap = new Map();    // reqId -> req

        for (const session of eligible) {
            const sid = String(session.id || session._id);
            const suiteCases = extractValidTestCasesFromSession(session, allSessionsMap);

            suiteCases.forEach(tc => {
                tc.approval_status = qualityMetricsService.getCaseApprovalStatus(tc);
                tc.is_approved = tc.approval_status === 'approved';
                tc.canonicalType = normalizeCanonicalTestType(tc);
                allCaseMap.set(String(tc.id), tc);
            });
            suiteCaseMap.set(sid, suiteCases);

            const suiteReqs = qualityMetricsService.extractNormalizedRequirements(session, suiteCases);
            suiteReqMap.set(sid, suiteReqs);
            suiteReqs.forEach(r => allReqMap.set(String(r.id), r));
        }

        return {
            suites: eligible,
            allSessionsMap,
            suiteCaseMap,
            allCaseMap,
            suiteReqMap,
            allReqMap
        };
    }

    /**
     * Resolves test case links and requirement links for a raw risk record
     */
    async _hydrateRisk(risk, context) {
        const { allCaseMap, allReqMap, allSessionsMap } = context;
        const rid = String(risk.id);
        const sid = String(risk.suite_id);

        const linkedTestRecords = await supabaseService.getRiskTestCases(rid);
        const linkedReqRecords = await supabaseService.getRiskRequirements(rid);

        const tests = linkedTestRecords.map(item => {
            const cid = String(item.test_case_id);
            const tc = allCaseMap.get(cid);
            return {
                id: cid,
                key: cid,
                title: tc?.title || 'Linked test scenario',
                type: tc?.canonicalType || 'negative',
                approval: tc?.approval_status || 'pending',
                approval_status: tc?.approval_status || 'pending',
                rationale: item.rationale || null
            };
        });

        const requirements = linkedReqRecords.map(item => {
            const reqId = String(item.requirement_id);
            const req = allReqMap.get(reqId);
            return {
                id: reqId,
                key: reqId,
                title: req?.title || reqId,
                category: req?.category || 'Functional'
            };
        });

        // Compute dynamic mitigation state
        const mitigation = computeRiskMitigation(tests, isExecutionEnabled());

        const suiteSession = allSessionsMap.get(sid);
        const suiteName = suiteSession?.title || suiteSession?.feature || 'Test Suite';

        return {
            id: risk.id,
            user_id: risk.user_id,
            suite_id: risk.suite_id,
            suite: {
                id: sid,
                name: suiteName,
                title: suiteName
            },
            title: risk.title,
            threat: risk.threat,
            category: risk.category,
            likelihood: risk.likelihood,
            impact: risk.impact,
            score: risk.score,
            severity: risk.severity,
            status: risk.status,
            accepted_reason: risk.accepted_reason || null,
            source: risk.source,
            source_case_id: risk.source_case_id || null,
            mitigation,
            testsCount: tests.length,
            tests: tests.slice(0, 3),
            allTests: tests,
            requirementsCount: requirements.length,
            requirements: requirements.slice(0, 3),
            allRequirements: requirements,
            created_at: risk.created_at,
            updated_at: risk.updated_at
        };
    }

    /**
     * GET /api/v1/risks/summary?suite_id=<id|all>
     * Returns comprehensive risk metrics guaranteed to agree with Traceability & Intelligence.
     */
    async getSummary({ userId, suiteId = 'all' }) {
        if (!userId) {
            throw new ValidationError('User ID is required');
        }

        const context = await this._loadSuitesContext(userId);

        // Fetch all user risks matching suite filter
        const result = await supabaseService.listRisks({
            userId,
            suiteId: suiteId !== 'all' ? suiteId : null,
            limit: 5000
        });

        const rawRisks = result.risks || [];
        const hydrated = [];

        for (const r of rawRisks) {
            hydrated.push(await this._hydrateRisk(r, context));
        }

        const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
        const byStatus = { open: 0, mitigating: 0, accepted: 0, closed: 0 };
        const byMitigation = { unmitigated: 0, tests_planned: 0, tests_approved: 0, verified: 0 };
        const byCategory = {};
        RISK_CATEGORIES.forEach(cat => { byCategory[cat] = 0; });
        const sourceCounts = { derived: 0, generated: 0, manual: 0 };

        hydrated.forEach(r => {
            if (bySeverity[r.severity] !== undefined) bySeverity[r.severity]++;
            if (byStatus[r.status] !== undefined) byStatus[r.status]++;
            if (byMitigation[r.mitigation] !== undefined) byMitigation[r.mitigation]++;
            if (byCategory[r.category] !== undefined) byCategory[r.category]++;
            if (sourceCounts[r.source] !== undefined) sourceCounts[r.source]++;
        });

        return {
            total: hydrated.length,
            suiteId: suiteId || 'all',
            bySeverity,
            byStatus,
            byMitigation,
            byCategory,
            unmitigated: byMitigation.unmitigated,
            sourceCounts,
            executionEnabled: isExecutionEnabled(),
            checkedAt: new Date().toISOString()
        };
    }

    /**
     * GET /api/v1/risks
     * Filterable, sortable, paginated risk query engine.
     */
    async listRisks({
        userId,
        suiteId = 'all',
        severity = null,
        category = null,
        status = null,
        mitigation = null,
        source = null,
        q = null,
        sort = 'score',
        order = 'desc',
        page = 1,
        limit = 50
    }) {
        if (!userId) {
            throw new ValidationError('User ID is required');
        }

        const context = await this._loadSuitesContext(userId);

        // Pull full list for multi-facet hydration and accurate dynamic mitigation filtering
        const result = await supabaseService.listRisks({
            userId,
            suiteId: suiteId !== 'all' ? suiteId : null,
            severity,
            category,
            status,
            source,
            search: q,
            sort,
            order,
            limit: 5000
        });

        let hydrated = [];
        for (const r of result.risks || []) {
            hydrated.push(await this._hydrateRisk(r, context));
        }

        // Apply dynamic mitigation filter if specified
        if (mitigation && mitigation !== 'all') {
            hydrated = hydrated.filter(r => String(r.mitigation).toLowerCase() === String(mitigation).toLowerCase());
        }

        // Pagination
        const total = hydrated.length;
        const p = Math.max(1, parseInt(page, 10) || 1);
        const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
        const offset = (p - 1) * l;
        const paginated = hydrated.slice(offset, offset + l);

        return {
            risks: paginated,
            total,
            page: p,
            limit: l,
            totalPages: Math.ceil(total / l)
        };
    }

    /**
     * GET /api/v1/risks/matrix?suite_id=
     * Returns 5x5 Likelihood (1-5) x Impact (1-5) threat distribution grid.
     */
    async getMatrix({ userId, suiteId = 'all' }) {
        if (!userId) {
            throw new ValidationError('User ID is required');
        }

        const result = await supabaseService.listRisks({
            userId,
            suiteId: suiteId !== 'all' ? suiteId : null,
            limit: 5000
        });

        // Initialize 5x5 grid (rows: likelihood 1..5, cols: impact 1..5)
        const grid = {};
        for (let l = 1; l <= 5; l++) {
            grid[l] = {};
            for (let i = 1; i <= 5; i++) {
                grid[l][i] = {
                    likelihood: l,
                    impact: i,
                    score: l * i,
                    severity: l * i >= 20 ? 'critical' : l * i >= 12 ? 'high' : l * i >= 6 ? 'medium' : 'low',
                    count: 0,
                    riskIds: []
                };
            }
        }

        (result.risks || []).forEach(r => {
            const l = Math.max(1, Math.min(5, parseInt(r.likelihood, 10) || 1));
            const i = Math.max(1, Math.min(5, parseInt(r.impact, 10) || 1));
            grid[l][i].count++;
            grid[l][i].riskIds.push(r.id);
        });

        return {
            suiteId: suiteId || 'all',
            total: (result.risks || []).length,
            grid
        };
    }

    /**
     * GET /api/v1/risks/:id
     * Returns full risk details, test case associations, requirements, and audit events.
     */
    async getRiskById(id, userId) {
        if (!id || !userId) {
            throw new ValidationError('Risk ID and User ID are required');
        }

        const raw = await supabaseService.getRiskById(id, userId);
        if (!raw) return null;

        const context = await this._loadSuitesContext(userId);
        const hydrated = await this._hydrateRisk(raw, context);
        const events = await supabaseService.listRiskEvents(id);

        return {
            ...hydrated,
            events
        };
    }

    /**
     * POST /api/v1/risks
     * Manual risk creation
     */
    async createManualRisk(userId, riskData) {
        if (!userId) throw new ValidationError('User ID is required');
        if (!riskData.title || riskData.title.trim().length < 3) {
            throw new ValidationError('Risk title is required (at least 3 characters)');
        }
        if (!riskData.threat || riskData.threat.trim().length < 5) {
            throw new ValidationError('Threat description is required (at least 5 characters)');
        }
        if (!riskData.suiteId && !riskData.suite_id) {
            throw new ValidationError('Suite ID is required');
        }

        const sid = String(riskData.suiteId || riskData.suite_id);
        const category = String(riskData.category || 'other').toLowerCase();
        if (!RISK_CATEGORIES.includes(category)) {
            throw new ValidationError(`Invalid risk category. Allowed: ${RISK_CATEGORIES.join(', ')}`);
        }

        const scoreInfo = calculateRiskScore(riskData.likelihood || 3, riskData.impact || 3);

        const record = await supabaseService.upsertRisk({
            userId,
            suiteId: sid,
            title: riskData.title.trim(),
            threat: riskData.threat.trim(),
            category,
            likelihood: scoreInfo.likelihood,
            impact: scoreInfo.impact,
            score: scoreInfo.score,
            severity: scoreInfo.severity,
            status: 'open',
            source: 'manual',
            sourceCaseId: null
        });

        // Record creation audit event
        await supabaseService.recordRiskEvent({
            riskId: record.id,
            userId,
            type: 'risk_created',
            fromValue: null,
            toValue: 'open'
        });

        if (Array.isArray(riskData.testCaseIds) && riskData.testCaseIds.length > 0) {
            await supabaseService.linkRiskTestCases(record.id, riskData.testCaseIds);
        }
        if (Array.isArray(riskData.requirementIds) && riskData.requirementIds.length > 0) {
            await supabaseService.linkRiskRequirements(record.id, riskData.requirementIds);
        }

        return this.getRiskById(record.id, userId);
    }

    /**
     * PATCH /api/v1/risks/:id
     * Updates risk status. Enforces mandatory accepted_reason when status is 'accepted'.
     */
    async updateStatus(id, userId, { status, acceptedReason = null }) {
        if (!id || !userId) throw new ValidationError('Risk ID and User ID are required');

        const existing = await supabaseService.getRiskById(id, userId);
        if (!existing) return null;

        const cleanStatus = String(status || '').toLowerCase().trim();
        if (!RISK_STATUSES.includes(cleanStatus)) {
            throw new ValidationError(`Invalid status. Allowed: ${RISK_STATUSES.join(', ')}`);
        }

        // Mandatory reason when accepting risk
        if (cleanStatus === 'accepted') {
            if (!acceptedReason || typeof acceptedReason !== 'string' || acceptedReason.trim().length === 0) {
                throw new ValidationError('An accepted_reason is required when marking a risk as accepted (max 500 characters).');
            }
            if (acceptedReason.trim().length > 500) {
                throw new ValidationError('Accepted reason must not exceed 500 characters.');
            }
        }

        const fromStatus = existing.status;
        const updated = await supabaseService.updateRisk(id, userId, {
            status: cleanStatus,
            accepted_reason: cleanStatus === 'accepted' ? acceptedReason.trim() : null
        });

        // Record status change event in audit log
        if (fromStatus !== cleanStatus) {
            await supabaseService.recordRiskEvent({
                riskId: id,
                userId,
                type: 'status_changed',
                fromValue: fromStatus,
                toValue: cleanStatus
            });
        }

        return this.getRiskById(id, userId);
    }

    /**
     * POST /api/v1/risks/:id/tests
     * Links test cases to a risk vector
     */
    async linkTests(id, userId, testLinks = []) {
        const existing = await supabaseService.getRiskById(id, userId);
        if (!existing) return null;

        if (!Array.isArray(testLinks) || testLinks.length === 0) {
            throw new ValidationError('At least one test case must be provided');
        }

        await supabaseService.linkRiskTestCases(id, testLinks);

        for (const item of testLinks) {
            const cid = typeof item === 'string' ? item : item.testCaseId || item.test_case_id;
            await supabaseService.recordRiskEvent({
                riskId: id,
                userId,
                type: 'test_linked',
                fromValue: null,
                toValue: String(cid)
            });
        }

        return this.getRiskById(id, userId);
    }

    /**
     * DELETE /api/v1/risks/:id/tests/:testCaseId
     * Unlinks a test case from a risk vector
     */
    async unlinkTest(id, userId, testCaseId) {
        const existing = await supabaseService.getRiskById(id, userId);
        if (!existing) return null;

        if (!testCaseId) throw new ValidationError('Test case ID is required');

        await supabaseService.unlinkRiskTestCase(id, testCaseId);

        await supabaseService.recordRiskEvent({
            riskId: id,
            userId,
            type: 'test_unlinked',
            fromValue: String(testCaseId),
            toValue: null
        });

        return this.getRiskById(id, userId);
    }

    /**
     * GET /api/v1/risks/export?format=csv|json
     */
    async exportRisks({ userId, suiteId = 'all', format = 'json' }) {
        const { risks } = await this.listRisks({ userId, suiteId, limit: 5000 });

        if (format === 'csv') {
            const headers = [
                'ID',
                'Suite ID',
                'Suite Name',
                'Title',
                'Threat',
                'Category',
                'Likelihood',
                'Impact',
                'Score',
                'Severity',
                'Status',
                'Mitigation',
                'Source',
                'Linked Tests',
                'Linked Requirements',
                'Created At'
            ];

            const rows = risks.map(r => [
                r.id,
                r.suite_id,
                `"${(r.suite?.name || '').replace(/"/g, '""')}"`,
                `"${r.title.replace(/"/g, '""')}"`,
                `"${r.threat.replace(/"/g, '""')}"`,
                r.category,
                r.likelihood,
                r.impact,
                r.score,
                r.severity,
                r.status,
                r.mitigation,
                r.source,
                r.testsCount,
                r.requirementsCount,
                r.created_at
            ]);

            return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        }

        return {
            exportedAt: new Date().toISOString(),
            suiteId,
            total: risks.length,
            risks
        };
    }

    /**
     * Backfill Derived Risks from ALL Eligible Generated Suites
     * Idempotent: Can be run multiple times safely.
     * Supports dry-run and confirmation modes.
     */
    async backfillDerivedRisks({ userId = null, confirm = false }) {
        logger.info(`Starting Derived Risk Backfill [Mode: ${confirm ? 'CONFIRM' : 'DRY RUN'}]`);

        const result = await supabaseService.listSessions({
            userId,
            page: 1,
            limit: 500,
            hasCases: true,
            onlyGenerated: true
        });

        const eligible = (result.sessions || []).filter(isEligibleGeneratedSuite);
        const allSessionsMap = new Map(eligible.map(s => [String(s.id || s._id), s]));

        const suiteSummaries = [];
        let totalDerivedRisks = 0;
        let totalLinkedRequirements = 0;

        for (const session of eligible) {
            const sid = String(session.id || session._id);
            const uid = String(session.user_id || session.userId || 'system');
            const title = session.title || session.feature || 'Test Suite';

            const suiteCases = extractValidTestCasesFromSession(session, allSessionsMap);
            const suiteReqs = qualityMetricsService.extractNormalizedRequirements(session, suiteCases);

            // Filter strictly for eligible risk test cases (negative, security, edge, non_functional)
            const eligibleCases = suiteCases.filter(isEligibleRiskCase);

            let createdForSuite = 0;

            for (const tc of eligibleCases) {
                const cid = String(tc.id);
                const threatTitle = tc.title || tc.scenario || 'Identified Vulnerability';
                const threatText = deriveThreatStatement(tc);
                const category = deriveRiskCategory(tc);
                const scoreInfo = deriveLikelihoodAndImpact(tc);

                createdForSuite++;
                totalDerivedRisks++;

                if (confirm) {
                    const record = await supabaseService.upsertRisk({
                        userId: uid,
                        suiteId: sid,
                        title: threatTitle,
                        threat: threatText,
                        category,
                        likelihood: scoreInfo.likelihood,
                        impact: scoreInfo.impact,
                        score: scoreInfo.score,
                        severity: scoreInfo.severity,
                        status: 'open',
                        source: 'derived',
                        sourceCaseId: cid,
                        createdAt: session.created_at || session.createdAt
                    });

                    // Link source test case
                    await supabaseService.linkRiskTestCases(record.id, [{
                        testCaseId: cid,
                        rationale: `Derived from test scenario: ${tc.title}`
                    }]);

                    // Link requirement if test case has an associated requirement
                    const linkedReq = suiteReqs.find(r =>
                        r.explicitCaseRefs.includes(cid) ||
                        String(tc.requirementId) === String(r.id)
                    );
                    if (linkedReq) {
                        await supabaseService.linkRiskRequirements(record.id, [linkedReq.id]);
                        totalLinkedRequirements++;
                    }

                    // Record creation audit event
                    await supabaseService.recordRiskEvent({
                        riskId: record.id,
                        userId: uid,
                        type: 'risk_created',
                        fromValue: null,
                        toValue: 'open'
                    });
                }
            }

            suiteSummaries.push({
                suiteId: sid,
                title,
                totalCases: suiteCases.length,
                derivedRisks: createdForSuite
            });
        }

        return {
            mode: confirm ? 'CONFIRMED' : 'DRY_RUN',
            totalSuites: eligible.length,
            totalDerivedRisks,
            totalLinkedRequirements,
            suiteSummaries
        };
    }
}

module.exports = new RiskService();
