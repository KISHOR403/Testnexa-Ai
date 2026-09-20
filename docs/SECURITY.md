# Security — Testnexa AI

> Security measures, threat mitigations, and best practices.

---

## Security Architecture Overview

Testnexa AI implements defense-in-depth security across all layers:

```mermaid
flowchart TB
    subgraph Edge["Edge Layer"]
        CORS["CORS Policy"]
        RateLimit["Rate Limiting"]
    end

    subgraph Auth["Authentication Layer"]
        JWT["JWT Verification"]
        OAuth["OAuth 2.0 (PKCE)"]
        Session["Session Management"]
    end

    subgraph App["Application Layer"]
        Validation["Input Validation (Joi)"]
        Sanitization["Prompt Injection Guard"]
        ErrorHandling["Error Sanitization"]
    end

    subgraph Data["Data Layer"]
        Hashing["Password Hashing (bcrypt)"]
        Secrets["K8s Secrets Management"]
        Encryption["TLS in Transit"]
    end

    subgraph Infra["Infrastructure Layer"]
        NonRoot["Non-root Containers"]
        HealthChecks["Health Probes"]
        Monitoring["Prometheus Monitoring"]
    end

    Edge --> Auth --> App --> Data --> Infra

    style Edge fill:#1a1a2e,stroke:#ef4444,color:#fff
    style Auth fill:#1a1a2e,stroke:#f59e0b,color:#fff
    style App fill:#1a1a2e,stroke:#3b82f6,color:#fff
    style Data fill:#1a1a2e,stroke:#22c55e,color:#fff
    style Infra fill:#1a1a2e,stroke:#6b7280,color:#fff
```

---

## CORS Configuration

The backend enforces strict Cross-Origin Resource Sharing:

```javascript
app.use(cors({
    origin: function(origin, callback) {
        if (!origin) return callback(null, true);
        if (origin.startsWith('http://localhost:')) {
            return callback(null, true);
        }
        if (origin === process.env.FRONTEND_URL) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));
```

**Policy:**
- Allows all `localhost` origins (development)
- Allows only the configured `FRONTEND_URL` (production)
- Rejects all other origins
- Credentials (cookies, auth headers) are enabled

---

## Rate Limiting

A custom sliding-window rate limiter protects against abuse:

### Implementation

- **Algorithm:** Sliding window with per-key timestamp arrays
- **Key:** User ID (if authenticated) or IP address (if anonymous)
- **Cleanup:** Stale entries purged every 10 minutes

### Configured Limits

| Endpoint Group | Window | Max Requests | Purpose |
|----------------|--------|-------------|---------|
| Login | 15 min | 10 | Prevent brute-force password attacks |
| Registration | 15 min | 5 | Prevent account spam |
| Password Reset | 15 min | 5 | Prevent reset flood |
| Copilot | 5 min | 40 | Prevent AI abuse |

### Rate Limit Response

```json
{
    "success": false,
    "code": "RATE_LIMIT_ERROR",
    "message": "Too many sign-in attempts. Please wait 15 minutes before trying again.",
    "retryAfter": 542
}
```

Response includes `Retry-After` header with seconds until window resets.

---

## Input Validation

### Joi Schema Validation

All API inputs are validated using Joi schemas in `validation.service.js`:

- **Requirement text:** Minimum 20 characters
- **App type:** Enum validation (`web`, `mobile`, `api`, `desktop`)
- **Detail level:** Enum validation (`basic`, `medium`, `detailed`)
- **Email format:** RFC 5322 compliance
- **Password strength:** Minimum length enforcement

### Prompt Injection Protection

The `validation.service.js` includes conversational prompt rejection rules to block:
- Attempts to manipulate the AI system prompt
- Non-requirement inputs (greetings, random text)
- Malicious prompt injection patterns

---

## Password Security

### Hashing

All passwords are hashed using **bcryptjs** with adaptive cost factor:

```javascript
const hashedPassword = await bcrypt.hash(password, 10);
const isMatch = await bcrypt.compare(inputPassword, hashedPassword);
```

### Password Reset

- Reset tokens are cryptographically generated
- Tokens are time-limited (stored with `reset_password_expire`)
- Used tokens are immediately cleared after successful reset
- Endpoint always returns success to prevent email enumeration

---

## Session Security

### JWT Security

- Tokens signed with `JWT_SECRET` environment variable
- Tokens expire after 7 days
- Session ID embedded in token for session-level revocation

### Session Validation

Every authenticated request validates:
1. JWT signature and expiration
2. Session not revoked (`revoked_at IS NULL`)
3. Session not expired (`expires_at > NOW()`)
4. User still exists in database

### Session Revocation

Immediate token invalidation via database check:
- Individual sessions can be revoked
- "Revoke all other sessions" for security incidents
- Logout revokes the current session

---

## Open Redirect Protection

OAuth callback redirects are controlled:
- Frontend URL is configured via `FRONTEND_URL` environment variable
- OAuth callbacks redirect only to the configured frontend
- No user-controlled redirect parameters in auth flows

---

## Docker Security

### Non-Root Containers (Backend)

```dockerfile
# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Set ownership
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser
```

### Minimal Images

- **Frontend:** Multi-stage build → `nginx:alpine` (no Node.js in production)
- **Backend:** `node:20-alpine` with production-only dependencies (`npm ci --omit=dev`)

### Health Checks

Both containers include Docker `HEALTHCHECK` directives:
- Frontend: HTTP check on port 80
- Backend: HTTP check on `/health` endpoint

---

## Kubernetes Security

### Secrets Management

Sensitive values stored as Kubernetes Secrets (`k8s/secret.yaml`):
- Supabase URL and keys
- JWT secret
- OAuth client IDs and secrets
- SMTP credentials

All secret values are base64-encoded and injected as environment variables.

### Network Isolation

- Frontend: Exposed via NodePort (`:30080`) or LoadBalancer
- Backend: Internal ClusterIP only (`:5000`) — not directly accessible from outside
- Frontend proxies API requests to backend via internal DNS

### Resource Limits

Kubernetes manifests define CPU and memory limits to prevent resource exhaustion.

---

## Error Handling

### Sanitized Error Responses

The global error handler in `server.js` ensures:
- Stack traces are never exposed to clients
- Error responses follow a consistent format
- Internal server errors return generic messages
- Custom error classes (`AIServiceError`, `RateLimitError`) map to appropriate HTTP status codes

```javascript
app.use((err, req, res, next) => {
    logger.error('Unhandled error', err);
    const errorResponse = formatErrorResponse(err);
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json(errorResponse);
});
```

---

## API Security Headers

The Nginx frontend configuration adds security headers:
- Content served over HTTPS in production
- SPA routing handled server-side (prevents 404 leaks)

---

## Data Privacy

- User passwords are never stored in plaintext
- OAuth tokens (access/refresh) are not persisted — only user profile data is stored
- Test generation data is scoped to authenticated user (multi-tenant isolation)
- Guest data is ephemeral and not persisted to database
- No third-party analytics or tracking scripts

---

## Known Considerations

| Area | Current State | Recommendation |
|------|--------------|----------------|
| HTTPS | Enforced at ingress/proxy level | Ensure TLS 1.2+ only |
| CSP Headers | Not explicitly configured | Add Content-Security-Policy headers |
| SQL Injection | Mitigated by Supabase client parameterization | Maintain parameterized queries |
| XSS | React auto-escapes JSX output | Avoid `dangerouslySetInnerHTML` |
| CSRF | JWT-based (no cookies for auth) | Low risk; consider SameSite cookies for sessions |
| API Key Exposure | Gemini key server-side only | Never expose in frontend bundle |

---

*Last updated: September 2026*
