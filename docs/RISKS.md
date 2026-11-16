# Risk Vectors & Threat Modeling Architecture (docs/RISKS.md)

## 1. Overview & Core Philosophy

In Testnexa AI, a **Risk Vector** is an explicit statement of a potential security vulnerability, boundary breakdown, or operational failure—formulated from the perspective of **what could go wrong if unmitigated** (the threat), rather than merely restating a positive test verification.

Test execution is currently disabled (`FEATURE_TEST_RUNS = false`). The Risk Intelligence subsystem operates deterministically at design time by analyzing the test suite inventory, linking risk vectors directly to requirements and test cases, tracking mitigation readiness, and recording full audit event trails.

---

## 2. Risk Scoring Formula & 5×5 Threat Matrix

Every risk vector is assigned a deterministic **Likelihood** ($1 \dots 5$) and **Impact** ($1 \dots 5$).

$$\text{Risk Score} = \text{Likelihood} \times \text{Impact} \quad (1 \le \text{Score} \le 25)$$

### Severity Thresholds

| Severity | Score Range | Operational Meaning | Action SLA |
|---|---|---|---|
| **Critical** | $\ge 20$ | Immediate threat to authentication, tenant isolation, or data confidentiality | Pre-release blocker; requires approved test mitigation |
| **High** | $12 \dots 19$ | High probability or major business disruption under common error states | Requires test mitigation before stage sign-off |
| **Medium** | $6 \dots 11$ | Edge case failure, recoverable resource degradation, or boundary defect | Scheduled in standard QA sprint |
| **Low** | $< 6$ | Minor cosmetic, non-blocking, or very low probability anomaly | Tracked in backlog |

### 5×5 Matrix Representation

```
 Likelihood
     ▲
   5 │   5 [Low]    10 [Med]    15 [High]   20 [Crit]   25 [Crit]
   4 │   4 [Low]     8 [Med]    12 [High]   16 [High]   20 [Crit]
   3 │   3 [Low]     6 [Med]     9 [Med]    12 [High]   15 [High]
   2 │   2 [Low]     4 [Low]     6 [Med]     8 [Med]    10 [Med]
   1 │   1 [Low]     2 [Low]     3 [Low]     4 [Low]     5 [Low]
     └─────────────────────────────────────────────────────────►
         1           2           3           4           5       Impact
```

---

## 3. Test Case Eligibility & Derivation Rules

### The Golden Rule: No Happy-Path Risks
A functional happy-path test case (e.g. `TC_FUNC_LOGIN_001` *"Successful Login with Valid Credentials"*) verifies expected business behavior. It is **never** a risk vector. Marking standard login or successful payment as a "Critical Risk" is false and prohibited.

### Eligible Test Case Types
Only test cases with implicit failure scenarios are eligible for derived risk generation:
1. `negative`: Direct rejection of malformed or unauthorized inputs (e.g. expired tokens, SQL injection, brute force).
2. `security`: Exploits against authentication, authorization, session boundaries, or data privacy.
3. `edge`: Boundary thresholds, concurrent session anomalies, or race conditions.
4. `non_functional`: Latency degradation, timeout handling, or resource starvation under load.

### Keyword Classification to Risk Categories

| Category | Defining Keywords | Example Threat |
|---|---|---|
| `rate_limiting` | rate limit, throttle, 429, brute force, flood, burst, credential stuffing | Unbounded automated requests allow credential stuffing or API resource exhaustion. |
| `session` | session, token reuse, expired token, jwt, invalidate, logout, hijack, fixate | Reusable or unexpired tokens allow persistent unauthorized account takeover. |
| `authorization` | idor, rbac, permission, role, privilege, access control, forbidden, 403 | Improper authorization allows tenant data leakage or vertical privilege escalation. |
| `input_validation` | injection, sql, xss, sanitize, malformed, payload, boundary, null byte | Malformed payloads bypass client checks, causing service failure or data corruption. |
| `data_exposure` | leak, mask, plaintext, shoulder surf, sensitive, pii, timing attack | Sensitive secrets or directory timings are exposed to unauthorized observers. |
| `authentication` | password, login, auth, credential, reset link, mfa, 2fa | Flaws in handshake logic permit credential bypass. |
| `availability` | dos, crash, deadlock, hang, timeout, unresponsive | Resource starvation under abnormal conditions triggers service denial. |
| `performance` | latency, p99, throughput, bottleneck, sluggish | Extreme response times under load degrade feature usability. |
| `other` | boundary condition, unhandled state | General boundary vulnerability. |

---

## 4. Mitigation States & Lifecycle

Mitigation is **dynamically computed** from the approval and execution state of linked test cases. It is never manually typed:

| Mitigation State | Computation Rule | Meaning |
|---|---|---|
| `unmitigated` | $\text{count}(\text{linkedTests}) = 0$ | No test cases are assigned to verify this threat. High priority gap. |
| `tests_planned` | $\text{count}(\text{linkedTests}) > 0 \land \forall tc \in \text{linkedTests}, \text{approval} \ne \text{'approved'}$ | Tests are authored, but none have passed peer review or approval. |
| `tests_approved` | $\exists tc \in \text{linkedTests}, \text{approval} = \text{'approved'}$ | At least one mitigating test case is reviewed and approved. |
| `verified` | $\text{FEATURE\_TEST\_RUNS} = \text{true} \land \forall tc \in \text{linkedTests}, \text{lastExecution} = \text{'passed'}$ | Mitigating tests passed in the latest execution run. (Always `false` while execution flag is off). |

### Risk Status Lifecycle
While mitigation is computed, **Status** is the QA lead's managerial decision:
- `open` (default): Active threat requiring engineering or QA attention.
- `mitigating`: Mitigations are in progress.
- `accepted`: Organization accepts the residual risk (e.g. mitigated by external WAF).
  > **Strict Rule:** Transition to `accepted` **strictly requires** an `accepted_reason` (up to 500 characters). Omission returns HTTP 400.
- `closed`: Risk verified and archived.

Every status transition automatically creates a timestamped row in `public.risk_events`.

---

## 5. API Reference

All routes are mounted under `/api/v1/risks`, require JWT bearer authentication, and enforce tenant isolation.

### `GET /api/v1/risks/summary?suite_id=<id|all>`
Returns aggregated metrics guaranteed to align with Intelligence and Traceability pages:
```json
{
  "success": true,
  "data": {
    "total": 20,
    "suiteId": "all",
    "bySeverity": { "critical": 4, "high": 8, "medium": 6, "low": 2 },
    "byStatus": { "open": 18, "mitigating": 1, "accepted": 1, "closed": 0 },
    "byMitigation": { "unmitigated": 2, "tests_planned": 6, "tests_approved": 12, "verified": 0 },
    "byCategory": { "rate_limiting": 4, "session": 4, ... },
    "unmitigated": 2,
    "sourceCounts": { "derived": 18, "generated": 0, "manual": 2 },
    "executionEnabled": false,
    "checkedAt": "2026-11-16T16:00:00.000Z"
  }
}
```

### `GET /api/v1/risks?suite_id=&severity=&category=&status=&mitigation=&source=&q=&sort=&order=&page=&limit=`
Paginated risk inventory. Returns rows with:
- `id`, `title`, `threat`, `category`, `likelihood`, `impact`, `score`, `severity`, `status`, `accepted_reason`, `mitigation`, `source`
- `suite`: `{ id, name }`
- `tests`: Array of first 3 linked test objects with `approval_status` and total `testsCount`
- `requirements`: Array of first 3 linked requirements with key and total `requirementsCount`

### `GET /api/v1/risks/matrix?suite_id=<id|all>`
Returns a 5×5 object matrix mapping `[likelihood][impact]` to cell count and array of risk IDs.

### `GET /api/v1/risks/:id`
Returns full risk record including linked requirements, linked test cases with rationales, and complete audit history (`events`).

### `POST /api/v1/risks`
Manual risk creation. Validates title (min 3 chars), threat (min 5 chars), suiteId, category, likelihood (1-5), impact (1-5).

### `PATCH /api/v1/risks/:id`
Updates status. If `status: "accepted"`, `acceptedReason` is strictly required.

### `POST /api/v1/risks/:id/tests` & `DELETE /api/v1/risks/:id/tests/:testCaseId`
Links or unlinks test cases with audit logging.

### `GET /api/v1/risks/export?format=csv|json`
Rate-limited export of risk vectors with full mitigation and linkage details.

---

## 6. Database Schema (`public.risks`)

```sql
CREATE TABLE public.risks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    suite_id TEXT NOT NULL,
    title TEXT NOT NULL,
    threat TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN (
        'authentication', 'authorization', 'session', 'input_validation',
        'data_exposure', 'rate_limiting', 'availability', 'performance', 'other'
    )),
    likelihood INT NOT NULL CHECK (likelihood BETWEEN 1 AND 5),
    impact INT NOT NULL CHECK (impact BETWEEN 1 AND 5),
    score INT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'mitigating', 'accepted', 'closed')),
    accepted_reason TEXT CHECK (accepted_reason IS NULL OR char_length(accepted_reason) <= 500),
    source TEXT NOT NULL CHECK (source IN ('derived', 'generated', 'manual')),
    source_case_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_risks_suite_title UNIQUE (suite_id, title)
);
```
