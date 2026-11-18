# Testnexa AI — Support Requests, Help Center Intelligence & Status Architecture

This document describes the design, security safeguards, privacy controls, and integration guidelines for the public Help Center (`/help`), Support Request Pipeline, Article Feedback, Search Miss Intelligence, and the Real-Time System Status API.

---

## 1. Architecture Overview

```
                                  [Public Client / Help Center]
                                                |
                 +------------------------------+-------------------------------+
                 |                              |                               |
       POST /api/v1/support/requests    POST /api/v1/help/feedback       GET /api/v1/status
                 |                              |                               |
                 v                              v                               v
       [Abuse & Spam Filters]          [Daily Hash Dedup]               [Component Probes]
       - Honeypot check                 - Daily salted SHA-256           - Process API health
       - Min time-to-submit (>= 3s)     - No raw IP stored               - DB ping (3s timeout)
       - Links-only rejection           - Article slug allowlist         - AI reachability (60s cache)
       - Optional Turnstile/hCaptcha            |                               |
       - 20 KB body limit                       v                               v
                 |                      [help_feedback]                 [30s Cache Header]
                 v                                                              |
       [support_requests]                                                [Public CDN / Client]
                 |
      +----------+----------+
      |                     |
      v                     v
 [SUPPORT_INBOX]    [User Confirmation]
 (Plain Text Only)  (ID & Expected Time)
```

---

## 2. Contact Support Pipeline (`POST /api/v1/support/requests`)

### Request Schema & Joi Validation
| Field | Type | Rules | Description |
|---|---|---|---|
| `topic` | string | enum (`account`, `generation`, `traceability_coverage`, `export`, `integrations`, `billing`, `bug`, `other`) | Inquiry classification |
| `message` | string | `min(20)`, `max(4000)` | User inquiry text |
| `email` | string | Email format, `max(254)`. Required if anonymous | Sender email (auto-populated from JWT user if signed in) |
| `page_url` | string | Same-origin path validator (starts with `/`, no `://` or `//`) | Optional origin path |
| `app_version` | string | `max(50)` optional | Web app version |
| `consent` | boolean | Must be `true` | Explicit user agreement to be contacted |
| `website` | string | Honeypot field (hidden from genuine users) | Bots filling this are silently absorbed |
| `client_timestamp`| number | Epoch milliseconds | Used for minimum time-to-submit verification |
| `captcha_token` | string | Optional token | Cloudflare Turnstile or hCaptcha response |

### Anti-Spam & Abuse Protection
1. **Per-IP & Per-User Rate Limiting:** Enforces `5 requests/hour`. Requests exceeding this limit receive `429 Too Many Requests` with a `Retry-After` header.
2. **Honeypot Trap:** Hidden `website` field traps automated crawlers. Submissions with non-empty `website` return a silent `201 OK` (`id: 'sup_bot_absorbed'`) without inserting into the database or dispatching emails.
3. **Time-to-Submit Protection:** Submissions completing in under 3 seconds are rejected (`SUBMIT_TOO_FAST`).
4. **Links-Only Message Rejection:** Messages consisting overwhelmingly of URLs (>70% URL characters with less than 15 characters of descriptive text) are rejected (`INVALID_CONTENT`).
5. **Turnstile / hCaptcha Verification:** When `SUPPORT_CAPTCHA_SECRET` is configured in `.env`, the token is verified against the provider API. When unset, verification is cleanly bypassed.
6. **Strict Body Limit:** The route is bounded by `express.json({ limit: '20kb' })` to mitigate oversized payload DOS.

### Notification Emails
- **Support Inbox (`SUPPORT_INBOX`):** Dispatches plain text summary with topic, ID, requester email, context, and message.
- **User Acknowledgment:** Automatically sends requester an email confirming receipt with request ID, topic, expected response time (`SUPPORT_RESPONSE_TIME || 'within 24 business hours'`), and security notice.
- **Content Sanitization:** Plain text formatting only; all HTML tags are escaped to prevent email client script execution.

### Privacy & Retention
- **No Sensitive Context:** Requirements text, Playwright test code, tokens, and passwords are never collected or stored.
- **Retention Purge:** `purgeOldSupportRequests(retentionMonths)` purges records older than `SUPPORT_RETENTION_MONTHS` (default: 12 months).
- **Cascading Account Deletion:** When a user deletes their account via settings, all associated `support_requests` are permanently removed.

---

## 3. Help Center Feedback & Search Miss Intelligence

### Article Feedback (`POST /api/v1/help/feedback`)
- Rate limited: `20 requests/hour` per IP.
- Slug validation: Lowercase alphanumeric kebab-case pattern (`/^[a-z0-9]+(?:-[a-z0-9]+)*$/`).
- **Privacy & Deduplication:** Raw IP addresses are **never stored**. A daily salted hash (`SHA-256(YYYY-MM-DD + JWT_SECRET + IP)`) is used strictly to prevent duplicate votes.

### Search Misses (`POST /api/v1/help/search-misses`)
- Rate limited: `30 requests/hour` per IP.
- **Normalization & PII Scrubbing:**
  1. Lowercased and trimmed.
  2. Strips email addresses (`user@domain.com`).
  3. Strips long numbers / phone sequences (`\d{4,}`).
  4. Trims punctuation and collapses whitespace.
- Upsert behavior: Increments `count` for the normalized query without creating duplicate rows. No user IDs or IPs are stored.

### Admin Summary (`GET /api/v1/help/admin-summary`)
Guarded by `protect` and `requireAdmin`. Returns:
- `topUnhelpfulArticles`: Articles with the highest ratio of negative votes.
- `topMissedSearches`: Most frequently missed queries for editorial prioritization.
- `requestsByTopic`: Aggregate distribution of support tickets across categories.
- `recentFeedbackComments`: Qualitative user feedback notes.

---

## 4. System Status API (`GET /api/v1/status`)

### Response Format
```json
{
  "status": "operational",
  "checkedAt": "2026-11-18T14:30:00.000Z",
  "components": [
    { "name": "api", "status": "operational", "uptimeSeconds": 1420, "checkedAt": "..." },
    { "name": "database", "status": "operational", "latencyMs": 28, "checkedAt": "..." },
    { "name": "ai_provider", "status": "operational", "cached": true, "latencyMs": 140, "checkedAt": "..." }
  ]
}
```

### Probes & Safeguards
1. **API:** Measures process event loop and uptime.
2. **Database:** Probes Supabase PostgreSQL with a strict 3-second timeout.
   - `< 1500ms`: `operational`
   - `>= 1500ms`: `degraded`
   - Error or timeout: `outage`
3. **AI Provider:**
   - **60-Second Cache:** Probe results are cached for 60 seconds to prevent hammering Gemini / OpenAI APIs.
   - Validates reachability and API key configuration.
4. **Caching:** Endpoint sets `Cache-Control: public, max-age=30, s-maxage=30`.
5. **Failure Policy:** The endpoint **never returns 'operational'** if any component fails or times out.

---

## 5. Integrating Hosted Status Pages

To connect a hosted status page provider (e.g. Instatus, Better Uptime, Atlassian Statuspage):

1. **Instatus / Better Uptime:**
   - Add a monitor pointing to `https://app.testnexa.ai/api/v1/status`.
   - Set HTTP method: `GET`.
   - Expect HTTP status: `200`.
   - JSON response assertion: `$.status` must equal `"operational"`.
   - Alert threshold: Trigger degraded notification when `$.status == "degraded"` or outage when `$.status == "outage"`.
2. **Atlassian Statuspage:**
   - Configure a webhook or custom component probe pulling component states:
     - Map `components[name=database]` to Statuspage database component.
     - Map `components[name=ai_provider]` to AI engine component.
