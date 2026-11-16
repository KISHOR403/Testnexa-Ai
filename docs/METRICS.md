# Testnexa AI — Canonical Quality & Coverage Metrics Specification

This document provides the authoritative definitions, mathematical formulations, gap rules, and provenance standards for all QA metrics across Testnexa AI. Every UI surface (Suite Detail, Test Suites List, Traceability, Coverage, and Intelligence) derives its figures exclusively from `backend/src/services/qualityMetrics.service.js`.

---

## 1. Core Metric Formulations

### A. Approved vs Pending Review
- **`approved`**: A test case where `approval_status = 'approved'` **ONLY**.
  - Newly generated test cases start strictly as `'pending'`.
  - The status `'ready'`, `'draft'`, `'Not Executed'`, or missing approval fields are **never** treated as approved.
- **`notApproved`**: Count of cases where `approval_status != 'approved'` (`cases - approved`).
- **`approvalPct`**:
  $$\text{approvalPct} = \begin{cases} \left\lfloor \frac{\text{approvedCount}}{\text{cases}} \times 100 \right\rceil & \text{if } \text{cases} > 0 \\ 0 & \text{if } \text{cases} = 0 \end{cases}$$

### B. Linked % (Design Coverage)
- **`linkedRequirement`**: Any requirement that has at least one associated test case ($\text{linkedCases} \ge 1$).
- **`linkedPct`**:
  $$\text{linkedPct} = \begin{cases} \left\lfloor \frac{\text{linkedRequirements}}{\text{requirements}} \times 100 \right\rceil & \text{if } \text{requirements} > 0 \\ 0 & \text{if } \text{requirements} = 0 \end{cases}$$
- **Interpretation**: Measures test design completeness. 100% Linked means every stated requirement is mapped to at least one test scenario.

### C. Verified % (Execution Readiness)
- **`verifiedRequirement`**: A requirement whose associated test cases have **all** been executed and **all passed** in their latest run.
- **`verifiedPct`**:
  $$\text{verifiedPct} = \begin{cases} \left\lfloor \frac{\text{verifiedRequirements}}{\text{requirements}} \times 100 \right\rceil & \text{if } \text{requirements} > 0 \\ 0 & \text{if } \text{requirements} = 0 \end{cases}$$
- **Gating Rule**: While `FEATURE_TEST_RUNS = false`, `verifiedRequirements` is strictly `0` and `verifiedPct` is `0%`, labeled clearly in the UI as *"Needs test execution (soon)"*.

---

## 2. Shared Canonical Classifications

### A. Test Types (`byType`)
No merged strings in the API layer. The API exposes discrete buckets:
- `functional`: Positive user workflows and baseline functionality.
- `negative`: Error handling, invalid inputs, and security rejections.
- `edge`: Boundary limits, race conditions, and unusual environment inputs.
- `non_functional`: Performance, load, accessibility, and resilience.
- `security`: Authentication, authorization, token expiration, and CSRF/CORS.
- `api`: API checklist, status codes, payload schema, and header assertions.

### B. Test Priorities (`byPriority`)
- `high`: `Critical` and `High` severity cases.
- `medium`: `Medium` severity cases.
- `low`: `Low` and `Trivial` severity cases.
- `unset`: Cases without an assigned priority or severity.

---

## 3. Requirement Provenance (`requirementsBySource`)

Requirements must never be falsely presented as original user specifications if they were derived from test labels:
1. **`extracted`**: Extracted directly from user specification text during AI generation. Has `source_quote` containing the verbatim excerpt.
2. **`derived`**: Inferred by scanning test case IDs or category tags (`REQ_...`) when no formal requirement specification was provided. Has `source_quote: ''`.
3. **`manual`**: Authored or edited directly by a human QA engineer in the workspace.

---

## 4. Deterministic Gap Rules

The `/overview` endpoint evaluates 5 deterministic quality rules on authoring and review state:

| Rule Key | Severity | Condition | Description |
| :--- | :--- | :--- | :--- |
| **`single_test_requirement`** | `medium` | $\text{linkedTests} = 1$ | Requirements covered by only a single test case. |
| **`no_negative_or_security_test`** | `high` | $\text{priority} \in \{\text{High}, \text{Critical}\} \land \neg \exists \text{ test} \in \{\text{negative}, \text{security}, \text{edge}\}$ | High-priority requirements lacking negative, edge, or security validation. |
| **`unlinked_test_case`** | `medium` | $\text{case.requirementId} = \text{null}$ | Test cases not associated with any requirement specification. |
| **`review_backlog`** | `low` | $\text{approval\_status} = \text{'pending'}$ | Test cases awaiting QA review and approval. |
| **`missing_priority`** | `low` | $\text{priority} = \text{'unset'}$ | Test cases without an assigned priority. |

The API always returns `rulesChecked: [...]` and `checkedAt` so the UI can honestly report *"No gaps found. 5 rules checked."*

---

## 5. Centralized Case Events (`case_events`)

All progression in the activity chart derives from the immutable `case_events` table:
- **`suite_created`**: Emitted when a suite is generated.
- **`case_generated`**: Emitted for each test case created in a suite.
- **`case_approved`**: Emitted when a user approves a test case.
- **`case_rejected`**: Emitted when a user rejects a test case.
- **`case_edited`**: Emitted when a user edits test case content.

Events are created in the same transaction as the action. Historical events are backfilled from trustworthy `created_at` timestamps with `source = 'backfill'`, never using `updated_at`.
