# Testnexa AI — QA Health & Execution Intelligence Specification

This document defines the architecture, metric formulations, single source of truth guarantees, gap discovery rules, and caching semantics for the QA Health & Intelligence system in Testnexa AI.

---

## 1. Overview & Architectural Principles

The Intelligence subsystem (`/app/intelligence` on the frontend, `/api/v1/intelligence/*` on the backend) provides a single pane of glass into:
1. **Authoring Quality & Progress:** Suite generation volume, test case distributions, and review completion.
2. **Traceability Health:** Design coverage (`Linked %`) and execution verification (`Verified %`), sharing the exact canonical logic of the Traceability module.
3. **Actionable Authoring Gaps:** Deterministic detection of high-risk scenarios (such as critical requirements with only 1 test, or lacking negative validation).
4. **Execution Intelligence & Trends:** Gated cleanly behind the `testRuns` feature flag. When execution is unavailable, no false zeros or misleading statuses ("All Quiet", "Steady Quality") are shown.

---

## 2. Core Metrics & Mathematical Formulations

All metrics are user-scoped and calculated dynamically from active test suites and test cases.

### A. Totals
- **Suites:** Total count of eligible generated suites ($N_{\text{suites}}$).
- **Test Cases:** Total unique test cases belonging to eligible suites ($N_{\text{cases}}$).
- **Requirements:** Total extracted/normalized requirements across the selected suite or workspace ($N_{\text{reqs}}$).

### B. Review Progress
- **Approved Cases ($N_{\text{approved}}$):** Test cases where `is_approved = true`, `status = 'approved'`, or `lifecycle = 'ready'`.
- **Pending Review ($N_{\text{pending}}$):** $N_{\text{cases}} - N_{\text{approved}}$.
- **Approval %:**
  $$\text{Approval \%} = \begin{cases} \left\lfloor \frac{N_{\text{approved}}}{N_{\text{cases}}} \times 100 \right\rceil & \text{if } N_{\text{cases}} > 0 \\ 0 & \text{if } N_{\text{cases}} = 0 \end{cases}$$

### C. Traceability (Canonical Single Source of Truth)
To prevent disparate counts between the Traceability page and Intelligence dashboard, `/api/v1/intelligence/overview` directly imports and delegates to `traceabilityService.getTraceabilitySummary(suiteId, userId)`:
- **`linkedPct`:** Proportion of requirements having $\ge 1$ linked test case.
- **`verifiedPct`:** Proportion of requirements where all linked test cases have been executed and passed (0% when `testRuns` is disabled).
- **`requirementsLinked`:** Count of requirements with $\ge 1$ linked test.
- **`requirementsTotal`:** Total requirement specifications.

### D. Test Mix & Priority Distributions
- **`byType`:** Categorization by test intent (`functional`, `negative`, `edge`, `nonFunctional`, `api`).
- **`byPriority`:** Normalization of test priority into three buckets:
  - `high`: `Critical` and `High` priority test cases.
  - `medium`: `Medium` priority test cases.
  - `low`: `Low` and `Trivial` priority test cases.

---

## 3. Gap Discovery Rules & Taxonomy

When test execution is disabled, gap detection focuses on authoring rigor and risk reduction rather than runtime failures:

| Rule Key | Condition | Description |
| :--- | :--- | :--- |
| **`single_test`** | Requirement priority $\in \{\text{High}, \text{Critical}\} \land \text{linkedTests} = 1$ | High-impact requirements depending on a single test point of failure. |
| **`missing_negative_or_security`** | Requirement priority $\in \{\text{High}, \text{Critical}\} \land \text{linkedTests} > 0 \land \neg \exists \text{ test} \in \{\text{negative}, \text{edge}, \text{security}\}$ | High-risk requirements lacking error-handling or boundary verification. |
| **`unlinked_tests`** | Test case ID $\notin \bigcup \text{Requirements.linkedTests}$ | Tests created without clear traceability to a stated specification. |
| **`review_target`** | Test case $\text{approved} \ne \text{true}$ | Test cases awaiting QA sign-off before execution. |

---

## 4. Feature Flag Gating & HTTP 501 Contracts

When `FEATURE_TEST_RUNS = false`:
1. All execution intelligence endpoints (`/api/v1/runs/trends/*`, `/api/v1/runs/intelligence/*`, `/api/v1/maintenance/*`) are protected by the `requireFeature('testRuns')` middleware.
2. Calls to these endpoints immediately return:
   ```json
   {
     "code": "FEATURE_DISABLED",
     "feature": "testRuns",
     "message": "Test execution is currently disabled. Enable FEATURE_TEST_RUNS to use this feature."
   }
   ```
   with HTTP Status `501 Not Implemented`.
3. The frontend displays an informative "Soon" panel describing planned capabilities (Execution trends, failure fingerprinting, AI flakiness detection) without false runtime zeros.

---

## 5. In-Memory Caching & Invalidation

To guarantee sub-50ms dashboard responsiveness while eliminating stale data:
- Cache key: `${userId}:${suiteId}`.
- TTL: 60 seconds.
- Invalidation: Any creation, update, approval, or deletion of test suites or test cases immediately triggers `invalidateIntelligenceCache(userId, suiteId)`.

---

## 6. Strict Black-and-White Design System

The Intelligence page enforces strict monochrome styling:
- Palette: `--bg: #000`, `--surface: #0A0A0A`, `--surface-2: #111`, `--line: rgba(255,255,255,0.10)`, `--text-1: #fff`, `--text-2: rgba(255,255,255,0.72)`.
- No color hues: Green, blue, amber, red, yellow, or cyan are strictly forbidden.
- Information hierarchy is conveyed via typography, border weights, tactile fills, and standard monochrome iconography.
