# API Reference — Testnexa AI

> Complete REST API documentation for all backend endpoints.

---

## Base URL

```
Development: http://localhost:5000/api/v1
Production:  https://your-backend-domain.com/api/v1
```

## Authentication

Most endpoints use JWT Bearer token authentication:

```
Authorization: Bearer <jwt_token>
```

Middleware types:
- **`protect`** — Requires valid JWT. Returns `401` if missing or invalid.
- **`optionalProtect`** — Extracts user if token is valid, but allows anonymous access.

---

## 1. Test Generation

### POST `/api/v1/generate`

Generate a comprehensive test suite from a requirement.

**Auth:** `optionalProtect` (works for guests, persists history for authenticated users)

**Request Body:**

```json
{
  "requirement": "User should be able to login with email and password, with validation for empty fields and incorrect credentials",
  "appType": "web",
  "detailLevel": "medium",
  "testFocus": "mixed",
  "language": "en-US",
  "sessionId": "optional-session-uuid"
}
```

| Field | Type | Required | Values | Description |
|-------|------|----------|--------|-------------|
| `requirement` | string | ✅ | min 20 chars | The product requirement to analyze |
| `appType` | string | ❌ | `web`, `mobile`, `api`, `desktop` | Application platform context |
| `detailLevel` | string | ❌ | `basic`, `medium`, `detailed` | Test generation depth |
| `testFocus` | string | ❌ | `mixed`, `functional`, `non-functional`, `api` | Category emphasis |
| `language` | string | ❌ | `en-US` | Output language |
| `sessionId` | string | ❌ | UUID | Link to existing workspace session |

**Response (200):**

```json
{
  "success": true,
  "data": {
    "feature": "User Login",
    "functional": [ /* test case objects */ ],
    "negative": [ /* test case objects */ ],
    "edge": [ /* test case objects */ ],
    "apiChecklist": [ /* test case objects */ ],
    "summary": {
      "total": 25,
      "functional": 8,
      "negative": 6,
      "edge": 7,
      "api": 4
    },
    "quality": {
      "coverageConfidence": 85,
      "ambiguityScore": "Low",
      "assumptions": ["Password policy not specified"]
    },
    "understanding": {
      "feature": "User Login",
      "business_rules": ["Email must be valid format"],
      "inputs": ["email", "password"],
      "outputs": ["JWT token", "error message"],
      "risk_areas": ["SQL injection", "brute force"],
      "ambiguities": []
    },
    "processing_time": "4.23s",
    "model": "gemini-2.5-flash",
    "generationId": "gen_abc123",
    "sessionId": "session_xyz789"
  }
}
```

**Error Responses:**

| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_ERROR` | Requirement too short or invalid format |
| 422 | `INPUT_QUALITY_ERROR` | Input is not a software requirement |
| 429 | `RATE_LIMIT` | Gemini API quota exhausted |
| 500 | `AI_SERVICE_ERROR` | AI provider failure after retries |

---

### GET `/api/v1/generations/:id`

Get the status of a specific generation.

**Auth:** `optionalProtect`

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "gen_abc123",
    "status": "completed",
    "result": { /* same as generate response */ }
  }
}
```

---

### GET `/api/v1/history`

Get the authenticated user's test generation history.

**Auth:** `protect` (required)

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "hist_001",
      "generation_id": "gen_abc123",
      "requirement": "User login with email...",
      "app_type": "web",
      "detail_level": "medium",
      "test_focus": "mixed",
      "summary": { "total": 25 },
      "quality": { "coverageConfidence": 85 },
      "processing_time": "4.23s",
      "model": "gemini-2.5-flash",
      "created_at": "2026-09-20T10:00:00Z"
    }
  ]
}
```

---

## 2. Authentication

### POST `/api/v1/auth/register`

Register a new user with email and password.

**Auth:** None  
**Rate Limit:** 5 requests / 15 minutes

**Request Body:**

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecureP@ss123"
}
```

**Response (201):**

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "provider": "email",
    "totalTestsGenerated": 0
  }
}
```

---

### POST `/api/v1/auth/login`

Authenticate with email and password.

**Auth:** None  
**Rate Limit:** 10 requests / 15 minutes

**Request Body:**

```json
{
  "email": "john@example.com",
  "password": "SecureP@ss123"
}
```

**Response (200):**

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "avatar": null,
    "provider": "email",
    "totalTestsGenerated": 12
  }
}
```

---

### GET `/api/v1/auth/google`

Initiate Google OAuth flow.

**Auth:** None

Redirects to Google consent screen. Callback URL: `/api/v1/auth/google/callback`

**Callback Response:** Redirects to `{FRONTEND_URL}?token={jwt}` on success.

---

### GET `/api/v1/auth/github`

Initiate GitHub OAuth flow.

**Auth:** None

Redirects to GitHub authorization page. Callback URL: `/api/v1/auth/github/callback`

**Callback Response:** Redirects to `{FRONTEND_URL}?token={jwt}` on success.

---

### POST `/api/v1/auth/logout`

Logout and revoke current session.

**Auth:** `optionalProtect`

**Response (200):**

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### POST `/api/v1/auth/forgot-password`

Initiate password reset email flow.

**Auth:** None  
**Rate Limit:** 5 requests / 15 minutes

**Request Body:**

```json
{
  "email": "john@example.com"
}
```

**Response (200):** Always returns success (prevents email enumeration).

---

### PUT `/api/v1/auth/reset-password/:token`

Reset password using the emailed token.

**Auth:** None  
**Rate Limit:** 5 requests / 15 minutes

**Request Body:**

```json
{
  "password": "NewSecureP@ss456"
}
```

---

### GET `/api/v1/auth/me`

Get current authenticated user's profile.

**Auth:** `protect`

**Response (200):**

```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "displayName": "John",
    "email": "john@example.com",
    "avatar": "https://...",
    "provider": "google",
    "totalTestsGenerated": 42,
    "createdAt": "2026-01-15T10:00:00Z"
  }
}
```

---

### PUT `/api/v1/auth/update-profile`

Update user profile information.

**Auth:** `protect`

**Request Body:**

```json
{
  "name": "John Updated",
  "displayName": "Johnny"
}
```

---

### PUT `/api/v1/auth/change-password`

Change password for authenticated user.

**Auth:** `protect`

**Request Body:**

```json
{
  "currentPassword": "OldP@ss123",
  "newPassword": "NewP@ss456"
}
```

---

### GET `/api/v1/auth/sessions`

List all active login sessions for the user.

**Auth:** `protect`

**Response (200):**

```json
{
  "success": true,
  "sessions": [
    {
      "id": "session_uuid",
      "device": "Windows Desktop",
      "browser": "Chrome 130",
      "os": "Windows 11",
      "ip_address": "192.168.1.1",
      "location": "Mumbai, IN",
      "last_active_at": "2026-09-20T10:00:00Z",
      "created_at": "2026-09-15T08:00:00Z",
      "is_current": true
    }
  ]
}
```

---

### POST `/api/v1/auth/sessions/:sessionId/revoke`

Revoke a specific login session.

**Auth:** `protect`

---

### POST `/api/v1/auth/sessions/revoke-others`

Revoke all sessions except the current one.

**Auth:** `protect`

---

## 3. Workspace Sessions

All session routes require authentication (`protect` middleware).

### GET `/api/v1/sessions`

List all workspace sessions for the authenticated user.

### POST `/api/v1/sessions`

Create a new workspace session.

**Request Body:**

```json
{
  "title": "Login Feature Tests",
  "requirement": "User login with email and password...",
  "appType": "web",
  "detailLevel": "Standard"
}
```

### GET `/api/v1/sessions/:id`

Get a specific workspace session with all data.

### PATCH `/api/v1/sessions/:id`

Update a workspace session (title, status, suite data, etc.).

### DELETE `/api/v1/sessions/:id`

Delete a workspace session.

### GET `/api/v1/sessions/:id/versions`

Get all versions for a workspace session.

### POST `/api/v1/sessions/:id/versions`

Create a new version snapshot for a session.

---

## 4. Test Suites

All test suite routes require authentication (`protect` middleware).  
These routes share the same controller as Sessions (scoped to user's workspace).

### GET `/api/v1/test-suites`

List all test suites for the authenticated user.

### POST `/api/v1/test-suites`

Create a new test suite.

### GET `/api/v1/test-suites/:id`

Get a specific test suite with full data.

### PATCH `/api/v1/test-suites/:id`

Update a test suite.

### DELETE `/api/v1/test-suites/:id`

Delete a test suite.

### GET `/api/v1/test-suites/:id/versions`

Get version history for a test suite.

### POST `/api/v1/test-suites/:id/versions`

Create a new version snapshot.

---

## 5. QA Copilot

All Copilot routes use `optionalProtect` and rate limiting (40 requests / 5 minutes).

### POST `/api/v1/copilot/analyze`

Run context-aware QA analysis on a test suite.

**Request Body:**

```json
{
  "suiteData": { /* full suite object */ },
  "requirement": "Original requirement text",
  "testCaseId": "TC_FUNC_001",
  "contextScope": "full",
  "action": "analyze"
}
```

**Response (200):**

```json
{
  "success": true,
  "analysis": {
    "coverageGaps": ["No test for concurrent login sessions"],
    "securityRisks": ["Missing brute-force protection test"],
    "improvements": [
      {
        "testId": "TC_FUNC_001",
        "suggestion": "Add specific test data values"
      }
    ],
    "suggestedTests": [
      {
        "title": "Verify account lockout after 5 failed attempts",
        "type": "Negative",
        "priority": "High"
      }
    ]
  }
}
```

### POST `/api/v1/copilot/actions/add-test`

Add a Copilot-suggested test case to the suite.

### POST `/api/v1/copilot/actions/improve-test`

Apply a Copilot-recommended improvement to an existing test case.

### GET `/api/v1/copilot/context/:testSuiteId`

Retrieve compact context for a test suite (used by Copilot internally).

---

## 6. Health & Readiness

### GET `/health`

Liveness probe endpoint.

**Response (200):**

```json
{
  "status": "OK",
  "timestamp": "2026-09-20T10:00:00.000Z",
  "uptime": 86400,
  "memory": {
    "rss": 52428800,
    "heapTotal": 20971520,
    "heapUsed": 15728640
  }
}
```

### GET `/ready`

Readiness probe endpoint. Returns `503` if Supabase is unavailable.

```json
{
  "status": "READY",
  "db": "supabase_connected"
}
```

---

## Common Error Response Format

All errors follow a consistent format:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "timestamp": "2026-09-20T10:00:00.000Z"
}
```

| HTTP Status | Common Codes |
|-------------|-------------|
| 400 | `VALIDATION_ERROR` |
| 401 | `UNAUTHORIZED`, `SESSION_REVOKED` |
| 404 | `NOT_FOUND` |
| 422 | `INPUT_QUALITY_ERROR` |
| 429 | `RATE_LIMIT_ERROR` |
| 500 | `AI_SERVICE_ERROR`, `INTERNAL_ERROR` |

---

*Last updated: September 2026*
