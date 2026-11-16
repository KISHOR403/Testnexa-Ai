# Test Execution Architecture & Feature Flag Guide

This document describes the upcoming Test Execution engine for TestNexa AI, including manual test runs, automated Playwright execution, feature flags, and rollout procedures.

---

## 1. Status Overview

Test execution is currently **in development** and safely guarded by feature flags across the frontend and backend.

- **Frontend Flag**: `VITE_FEATURE_TEST_RUNS` (default: `false`)
- **Backend Flag**: `FEATURE_TEST_RUNS` (default: `false`)
- **Runtime Flag Endpoint**: `GET /api/v1/features`

When disabled:
- All run creation, mutation, execution, and cancellation routes return `HTTP 501 Not Implemented` with `{ code: "FEATURE_DISABLED", feature: "testRuns", message: "Test execution is coming soon." }`.
- Read-only routes (such as `GET /api/v1/runs`) return empty lists.
- User interface buttons and triggers show an outlined `"Soon"` badge and open the `<ComingSoonDialog>` on click without graying out or disabling controls.
- Visiting `/app/test-runs/new`, `/app/runs/new`, or `/runs/new` automatically redirects to `/app/runs` and displays the coming soon dialog.

---

## 2. Planned Architecture

### 2.1 Manual Step-by-Step Execution
- Interactive test execution workspace allowing QA testers to execute tests step-by-step.
- Assertion checklist recording actual vs expected outcomes, notes, and attachments (screenshots, logs).
- Execution session persistence with automatic draft recovery and step timers.

### 2.2 Automated Execution with Playwright
- Headless Chromium runner executing Playwright scenarios defined in test cases.
- Real-time step telemetry, video/trace recordings, and console/network log aggregation.
- Failure root cause isolation and cryptographic verification linkage.

### 2.3 Verification & Traceability Lineage
- Once runs complete, requirement verification statuses transition automatically from `Unverified` to `Verified` (100% pass) or `Failing` (>= 1 failed test case).
- Full cryptographic audit trails connecting raw requirement clauses to test execution outcomes.

---

## 3. How to Enable the Feature

### Backend
In `backend/.env`:
```bash
FEATURE_TEST_RUNS=true
```
Restart the backend service. Once enabled, `requireFeature('testRuns')` middleware will permit all execution endpoints.

### Frontend
In `frontend/.env` (or root `.env`):
```bash
VITE_FEATURE_TEST_RUNS=true
```
The frontend also queries `GET /api/v1/features` at runtime on startup. If the backend reports `testRuns: { enabled: true }`, the frontend updates dynamically without requiring a rebuild.

---

## 4. API Reference When Enabled

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/features` | Returns current platform feature flags |
| `GET` | `/api/v1/runs` | List execution runs (paginated, filtered) |
| `POST` | `/api/v1/runs` | Create a new manual or automated test run |
| `GET` | `/api/v1/runs/:id` | Fetch run details and test case snapshots |
| `POST` | `/api/v1/runs/:id/execute-automated` | Trigger headless Playwright runner |
| `POST` | `/api/v1/runs/:id/cancel` | Cancel an active execution run |
| `POST` | `/api/v1/runs/:id/cases/:caseId/execute` | Record manual case execution outcome |
