# Testnexa AI — QA Copilot Architecture & Operating Principles

This document defines the engineering standards, security rules, context assembly models, and privacy invariants governing **QA Copilot**, the AI assistant embedded across Testnexa AI.

---

## 1. Core Engineering Principles

1. **Grounded in Authoritative Data**: The Copilot answers strictly from the provided test suite facts (`cases`, `approved`, `requirements`, `linkedPct`, `gaps`, and test definitions). If information is not in the facts, it explicitly states: *"I don't have that information in your test data."*
2. **Deterministic Source of Truth**: Metric numbers are calculated server-side exclusively by `backend/src/services/qualityMetrics.service.js`. Client-sent fact payloads are never trusted.
3. **Strict Zero-Persistence**: Conversations exist in memory only on the client and during stream processing on the server. **No messages, prompts, model outputs, or context are stored in databases, caches, disk, or logs.**
4. **Human in the Loop**: The Copilot proposes and recommends; it never directly mutates or approves database records. All actions require explicit user confirmation.
5. **No Execution Capability**: While `FEATURE_TEST_RUNS = false`, test execution queries are answered honestly: test execution is disabled and coming in a future update.

---

## 2. Context Builder (`GET /api/v1/copilot/context`)

The context builder reconstructs authoritative metadata for any page or state:

```
GET /api/v1/copilot/context?page=<page>&suite_id=<id>&case_id=<id>&requirement_id=<id>
```

### Scope Resolution
- `none`: When no `suite_id` is passed (e.g. on the Create page before generation). Facts are completely empty `{}`. Coverage is never fabricated or defaulted.
- `suite`: When `suite_id` is supplied without a specific case or requirement.
- `case`: When `case_id` is specified within an authorized suite. Detailed step text is included **only** for this case.
- `requirement`: When `requirement_id` is specified within an authorized suite.

### Fact Size Limits
- At most **60 test cases** (`id`, `title`, `type`, `priority`, `approval_status`, `requirementId`).
- At most **20 requirements** (`id`, `key`, `title`, `priority`, `source`).
- At most **5 quality gaps**.
- Detailed steps (`preconditions`, `steps`, `expectedResult`, `testData`) are included **only** for the currently focused test case.

---

## 3. Streaming Chat Endpoint (`POST /api/v1/copilot/chat`)

Stateless Server-Sent Events (SSE) protocol:

### Request Contract
- `messages`: Up to 12 turns, each `{ role: 'user' | 'assistant', content: string (max 2000 chars) }`. Older turns are trimmed server-side.
- `page`: Page type (`create`, `suite`, `cases`, `traceability`, `risks`, `intelligence`, `recommendations`, `other`).
- `suite_id`, `case_id`, `requirement_id`: Optional resource IDs.
- `draftText`: Unsaved requirement text typed on the Create page (max 3000 chars). Delimited as passive data; never saved to disk or database.
- Body size limit: **20 KB**.

### SSE Event Stream
```text
event: message
data: {"type":"delta","text":"Analyzing requirement "}

event: message
data: {"type":"citations","citations":[{"type":"case","key":"TC-001"}]}

event: message
data: {"type":"actions","actions":[{"type":"open_case","params":{"caseId":"TC-001"}}]}

event: message
data: {"type":"done"}
```

- **Heartbeat**: `: ping\n\n` emitted every 15 seconds.
- **Client Abort**: HTTP socket close (`req.on('close')`) immediately halts the generation loop.
- **Hard Timeout**: 45-second execution ceiling returns `{ type: 'error', code: 'TIMEOUT', message: 'Response generation timed out after 45 seconds.' }`.

---

## 4. Citation & Hallucination Enforcement

The assistant outputs citation tokens:
- Test Cases: `[[case:KEY]]` (e.g. `[[case:TC-001]]`)
- Requirements: `[[req:KEY]]` (e.g. `[[req:REQ_REG_001]]`)

**Post-Generation Verification**:
1. Every cited key is checked against the authoritative `caseList` and `requirementList`.
2. Any citation token referencing a non-existent key is stripped from the output.
3. Factual claim checking: If generated text makes assertions about suite numbers (e.g. claiming 100 cases when the suite has 10), the text is replaced with a safe fallback: *"I can't verify that from your data."*

---

## 5. Allowed Action Types

Only actions conforming to the strict allow-list are returned to the client:
- `open_case`: `{ caseId: string }`
- `open_requirement`: `{ requirementId: string }`
- `open_recommendations`: `{}`
- `add_case_draft`: `{ title, type, priority, steps, expectedResult }`

Any other action emitted by the model is silently discarded.

---

## 6. Rate Limiting & Concurrency

- **30 messages per hour** per user.
- **150 messages per day** per user.
- **1 concurrent stream** per user. Subsequent simultaneous requests receive `429 { code: 'RATE_LIMITED', retryAfter: 2 }`.
- Feedback submission limited to 30 requests/hour.

---

## 7. User Feedback (`POST /api/v1/copilot/feedback`)

- Payload: `{ rating: 'up' | 'down', reason: 'wrong' | 'unhelpful' | 'unsafe' | 'other', page: string }`
- **Zero Content Logging**: Only rating, reason enum, page identifier, and timestamp are saved. **No message text or user prompts are ever collected.**
