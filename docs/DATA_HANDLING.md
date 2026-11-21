# Testnexa AI — Data Handling & AI Provider Retention Policy

This document details how Testnexa AI handles user specifications, test cases, and AI Copilot interactions, documenting data retention terms with upstream AI providers.

---

## 1. Zero-Retention Invariant for QA Copilot

Testnexa AI enforces a strict **zero-retention architecture** for all Copilot interactions:

1. **In-Memory Volatility**: User messages, draft requirements, and assembled test suite facts reside solely in volatile process memory during stream generation.
2. **No Persistent Storage**:
   - No database records or tables are allocated for Copilot conversations or turn histories.
   - No cache layers (e.g. Redis, memcached) store prompts or model outputs.
   - No debug files or filesystem buffers log model inputs or outputs.
3. **Log Sanitization**:
   - Backend logging output for Copilot requests captures only non-content operational telemetry: `{ userId, page, scopeType, tokenCounts, latencyMs, outcome, errorCode }`.
   - User prompt content, draft text, and AI generated tokens are strictly excluded from console logs, file logs, and error monitors.
4. **Anonymous Feedback**:
   - Ratings submitted via `/api/v1/copilot/feedback` record only `{ rating: 'up' | 'down', reason: enum, page: string, timestamp }`.
   - Message text, prompt contents, or response bodies are **never** attached to feedback entries.

---

## 2. Upstream AI Provider Retention Terms

Testnexa AI connects to foundation models via server-side API integrations (Google Gemini API with OpenAI fallback):

### A. Google Gemini API (Primary Provider)
- **Model Training Exclusion**: Under Google Cloud and Google AI Studio enterprise API commercial terms, customer data (prompts, completions, and contextual embeddings) is **never used to train or fine-tune Google models**.
- **Data Retention**: Google does not log customer content for human review on paid tier API endpoints. Transient inference tokens are flushed immediately following generation completion.
- **Encryption**: Payloads are encrypted in transit via TLS 1.3 and at rest with Google-managed or customer-managed encryption keys (FIPS 140-2 Level 3).

### B. OpenAI API (Fallback Provider)
- **Model Training Exclusion**: OpenAI does not use data submitted via the commercial API (`api.openai.com`) to train or fine-tune models unless an organization explicitly opts in.
- **Retention Period**: API data is retained ephemerally for a maximum of 30 days for abuse detection and compliance monitoring, after which it is purged. Zero-data-retention (ZDR) agreements can be configured for eligible enterprise accounts.
- **Encryption**: TLS 1.3 in transit and AES-256 at rest.

---

## 3. Test Data Sanitization & Credential Protection

Before any test case data is transmitted for AI generation or analysis:
- Realistic credentials (bearer tokens, passwords, private keys, authorization headers) are sanitized to standardized placeholders (e.g. `[AUTH_BEARER_TOKEN]`, `[REDACTED_PASSWORD]`).
- Control characters and potential prompt injection sequences are stripped via `sanitizeDataText`.
- All untrusted user content is enclosed in explicit passive data boundaries (`<<<FACTS_DATA>>>`, `<<<UNSAVED_DRAFT_SPECIFICATION>>>`).
