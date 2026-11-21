# Testnexa AI — Test Case Review, Versioning & Requirements Specification

This document provides the authoritative architecture and specifications for test case approvals, versioning, optimistic concurrency, AI regeneration, and requirement traceability in Testnexa AI.

---

## 1. Core Principles

1. **Human Verification Guarantee**: Approval signifies that an authorized human reviewer inspected and verified this *exact* version of a test case.
2. **Immediate Approval Invalidation**: Any mutation to test case content (title, type, priority, severity, preconditions, steps, expected result, or linked requirements) immediately resets `approval_status` to `'pending'`, clears approval metadata, and advances the version counter.
3. **No Draft Sprawl**: Edits and regeneration previews remain purely client-side until explicitly saved or applied. No intermediate drafts are stored in the database.
4. **Derived Suite Status**: Suite-level status (`needs_review`, `approved`, `partially_approved`, `has_rejected`) is derived dynamically from canonical quality metrics. There is no independent "approve suite" database write.
5. **Canonical Metric Coherence**: Suite Detail, Traceability, Quality Insights, Intelligence, and Risk endpoints all derive figures strictly from `backend/src/services/qualityMetrics.service.js`.

---

## 2. Test Case Approval State Machine

```
                   ┌──────────────┐
                   │   pending    │ ◄────────────────────────┐
                   └──────┬───────┘                          │
                          │                                  │
            approve       │       reject                     │
       ┌──────────────────┴──────────────────┐               │
       ▼                                     ▼               │
┌──────────────┐                      ┌──────────────┐       │ reset /
│   approved   │                      │   rejected   │       │ content change /
└──────┬───────┘                      └──────┬───────┘       │ undo
       │                                     │               │
       └─────────────────────────────────────┴───────────────┘
```

### A. States
- **`pending`**: Default state for newly generated, edited, restored, or regenerated test cases. Awaiting human review.
- **`approved`**: Verified by an authorized reviewer. Only cases in this state are exported when `approved=only` is selected.
- **`rejected`**: Disapproved by a reviewer. Requires an explicit rejection reason (5..500 characters). Rejected cases are strictly excluded from all CI and export pipelines.

### B. Transitions & Endpoints
- **Approve** (`PATCH /api/v1/cases/:id/approval` with `{ action: 'approve', version: N }`):
  - Requires `version === case.version`. If stale, returns `409 CASE_CHANGED` containing the latest case state.
  - Sets `approval_status = 'approved'`, `approved_by = userId`, `approved_at = NOW()`, `approved_version = case.version`, and clears `stale_reason`.
  - Emits `approve` event to `case_events`.
- **Reject** (`PATCH /api/v1/cases/:id/approval` with `{ action: 'reject', version: N, reason: '...' }`):
  - Requires a non-empty `reason` (5..500 characters).
  - Sets `approval_status = 'rejected'`, `rejected_reason = reason`, clears `approved_*`.
  - Emits `reject` event to `case_events`.
- **Reset** (`PATCH /api/v1/cases/:id/approval` with `{ action: 'reset', version: N }`):
  - Reverts status to `'pending'`, clears `approved_*`, `rejected_reason`, and `stale_reason`.
  - Emits `reset` event to `case_events`.
- **Bulk Approve Remaining** (`POST /api/v1/suites/:id/approve-remaining` with `{ caseIds: [...], expectedCount: N }` and `Idempotency-Key`):
  - In ONE transaction, verifies that the suite's current pending count matches `expectedCount`. If mismatched, returns `409 PENDING_COUNT_MISMATCH` with the current count.
  - Approves all matching pending cases, creates an approval batch, and returns `{ approved, skipped, batchId }`.
- **Undo Approvals** (`POST /api/v1/approvals/undo` with `{ batchId }` or `{ caseIds }`):
  - Allowed within a 10-minute window from approval.
  - Reverts cases to `'pending'` ONLY if `case.version === case.approved_version` (unmodified).
  - Refuses any case whose version has advanced with a descriptive refusal message.

### C. Role-Based Access Control (RBAC)
- **Allowed Roles**: `owner`, `admin`, `editor`, `qa_manager`, `qa_engineer`, `reviewer`.
- **Viewer Role**: Strictly read-only (`403 PERMISSION_DENIED`).
- **Workspace Scoping**: Attempts to access cases outside the caller's workspace or organization return `404 NOT FOUND`.

---

## 3. Test Case Versioning & Optimistic Concurrency

### A. Version Progression
- Initial generation creates `version = 1`.
- Any content mutation increments `version = version + 1`, generates a new SHA-256 `content_hash`, and saves the previous version snapshot in `case_versions`.
- **Tag-Only Changes**: Modifications exclusively affecting `tags` update the case record but do **NOT** increment `version` and do **NOT** invalidate approval.
- **Unchanged Content**: Submitting an edit identical to the current content returns `200 OK` without creating a new version.

### B. Optimistic Concurrency
- `PUT /api/v1/cases/:id` inspects `If-Match: <version>` header (or `body.version`).
- If `version !== case.version`, the mutation is rejected with `409 CASE_CHANGED` and returns the current server-side case in the response body.

### C. Version History & Restore
- `GET /api/v1/cases/:id/versions`: Returns the list of immutable version snapshots from `case_versions`, sorted by `version DESC`.
- `POST /api/v1/cases/:id/versions/:v/restore`: Restores content from snapshot `v`, advances the case to a new sequential version number (e.g., $N+1$), resets `approval_status` to `'pending'`, and logs a `restore` event.

---

## 4. Requirement Model & Linking Rules

### A. Normalized Key Format
- Every requirement possesses an immutable canonical key in the format:
  $$\text{REQ\_<SUITE>\_<NNN>}$$
  *(e.g., `REQ_CHECKOUT_001`, `REQ_AUTH_002`)*.
- Legacy keys (such as `REQ-001`, `REQ-002`) are stored in `requirement_key_aliases` to maintain backwards compatibility and redirects.

### B. Provenance
- **`extracted`**: Extracted directly from user specification text during AI generation. Has `source_quote`.
- **`derived`**: Inferred from test scenarios when no formal specification was supplied.
- **`manual`**: Created or updated manually by a QA engineer.

### C. Linking Constraints
1. **Same-Suite Invariant**: A test case and requirement must belong to the exact same test suite. Cross-suite linking attempts are rejected with `400 CROSS_SUITE_LINKING_PROHIBITED`.
2. **LAST_LINK Rule**: Unlinking a requirement from a test case that has only one link returns `422 LAST_LINK` unless the caller explicitly sets `confirmUnlinked: true`.
3. **Deletion Guard**: Deleting a requirement linked to active test cases returns `409 REQUIREMENT_IN_USE` unless `force: true` is supplied.
4. **Stale Flagging**: When a requirement's `title` or `description` is modified, all linked test cases are automatically flagged with `stale_reason = 'requirement_changed'` and emit `stale_flagged` events.

---

## 5. AI Case Regeneration

### A. Stateless Preview (`POST /api/v1/cases/:id/regenerate/preview`)
- Assembles grounded context from:
  1. The target test case.
  2. Linked requirements (`key`, `title`, `source`, `description`).
  3. Sibling cases in the suite (`id`, `title`, `type` only).
- **Prompt Injection Defense**: User instructions and requirement texts are strictly encapsulated within `<user_instruction>` and `<requirement_context>` delimiters, accompanied by directives instructing the model to treat content inside delimiters strictly as untrusted data.
- **Rate Limits**: 20 requests/hour per user; 5 requests/hour per case. Returns `429 RATE_LIMIT_EXCEEDED` with `Retry-After` header.
- **Abort & Timeout**: 30-second server timeout; client disconnect (`req.on('close')`) immediately aborts upstream AI calls.
- **Diff Summary & Similarity**: Returns changed field keys and flags `similarTo` if title Jaccard similarity exceeds 0.8 with any sibling case.
- **Zero-Write Guarantee**: Previews write zero rows to database tables.

### B. Explicit Apply (`POST /api/v1/cases/:id/regenerate/apply`)
- Re-validates the proposed payload server-side using the identical validation schema as manual edits.
- Enforces optimistic concurrency (`version === case.version`).
- Creates a new version snapshot in `case_versions` with `change_type = 'regenerated'`, increments `version`, sets `source = 'regenerated'`, and resets `approval_status` to `'pending'`.

---

## 6. Export & CI Ingestion Rules

- **Filter Parameter**: `GET /api/v1/suites/:id/export/playwright` and `GET /api/v1/pipelines/:id/export` accept `?approved=only|include_pending` (default: `only`).
- **Rejected Exclusion**: Rejected cases are **never** exported under any filter setting.
- **Skipped Reporting**: Response headers `X-Exported-Count` and `X-Skipped-Count` report exactly how many scenarios were exported and omitted.
