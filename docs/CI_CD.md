# Testnexa AI — CI/CD Integration Architecture & Specification

## 1. Core Design Principle

**Testnexa does NOT run test executions.**

Instead, Testnexa operates as an intelligent test specification, authoring, and quality analytics platform. Test execution takes place entirely inside the customer's own continuous integration infrastructure (such as GitHub Actions runners). 

The customer's GitHub Actions runner executes the exported Playwright test specifications and posts the resulting JSON report back to Testnexa via the secure ingestion endpoint (`POST /api/v1/ci/results`). Testnexa ingests the execution results, maps each result to the canonical test case and requirement, updates verification metrics across Traceability, Intelligence, and Risks, and posts a GitHub Check Run back to the commit.

```
+-----------------------------------------------------------------------------------+
| Customer Repository (GitHub)                                                      |
|   1. Commit / Pull Request triggers .github/workflows/testnexa.yml                |
|   2. Customer's GitHub Actions Runner:                                            |
|        - Installs Playwright dependencies                                         |
|        - Runs: PLAYWRIGHT_JSON_OUTPUT_NAME=results.json npx playwright test ...   |
|        - Ingests: POST /api/v1/ci/results (with Idempotency-Key & Bearer Token)   |
+-----------------------------------------------------------------------------------+
                                    |
                                    v  (HTTPS POST JSON Report)
+-----------------------------------------------------------------------------------+
| Testnexa AI Backend                                                               |
|   1. Validates Bearer Token (SHA-256 constant-time lookup)                        |
|   2. Enforces Idempotency (pipeline_id + idempotency_key)                         |
|   3. Maps Test Cases via regex ^\[([A-Z]{2,5}(?:_[A-Z0-9]+)+)\]                   |
|   4. Atomic insertion into test_runs & test_run_results                           |
|   5. Updates Verification Status (shared across Intelligence, Coverage, Risks)    |
|   6. Non-blocking GitHub Check Run status update posted to GitHub API             |
+-----------------------------------------------------------------------------------+
```

---

## 2. GitHub App Integration Architecture

### 2.1 Permissions Requested & Rationale

| Permission | Access Level | Justification |
| :--- | :--- | :--- |
| **Checks** | Read & write | Allows Testnexa to post structured commit check runs with pass/fail summaries directly on customer Pull Requests and commits. |
| **Metadata** | Read-only | Required by GitHub for all GitHub Apps to query repository names, branches, and installation metadata. |
| **Pull requests** | Read-only | Allows Testnexa to read PR metadata (branch name, author, PR number) for linking CI test runs to PRs. |

### 2.2 Short-Lived Installation Token Security

- Long-lived GitHub user OAuth tokens are **never requested or stored**.
- Authentication to the GitHub REST API is powered by an asymmetric RS256 Private Key (`GITHUB_APP_PRIVATE_KEY`) signed as a short-lived GitHub App JWT (9-minute expiration).
- Installation access tokens are minted on-demand from GitHub (`POST /app/installations/:id/access_tokens`) and cached strictly **in-memory** with a 58-minute TTL (1-hour GitHub token validity minus 2-minute buffer).
- Installation access tokens are **never written to disk or database tables**.

### 2.3 SSRF Protection

All outbound GitHub API HTTP calls are strictly validated against an approved hostname allowlist (`api.github.com`, `github.com`). Redirections to internal IP addresses or arbitrary hosts are rejected.

### 2.4 CSRF Prevention on Connection

The installation redirect URL uses a 10-minute signed HMAC state parameter containing `{ userId, workspaceId, nonce, timestamp }`. The state signature is verified in constant time before accepting any installation callback.

### 2.5 Inbound Webhook Security

Inbound GitHub webhooks (`POST /api/v1/webhooks/github`) are protected by:
- **HMAC-SHA256 signature verification**: `X-Hub-Signature-256` is verified against the raw request body buffer using `crypto.timingSafeEqual` and `GITHUB_APP_WEBHOOK_SECRET`.
- **Replay attack deduplication**: Every incoming delivery ID (`X-GitHub-Delivery`) is recorded in `webhook_deliveries`. If a duplicate delivery ID is received, it is immediately acknowledged and ignored.

---

## 3. Pipeline Token Management

Each pipeline links a repository to a test suite.

### 3.1 Token Generation & Storage
- Tokens are generated as 32 cryptographically random bytes formatted as `tnx_ci_<64-hex-chars>`.
- **One-time reveal**: The plaintext token is returned **only once** in the HTTP response upon creation or rotation.
- **Database storage**: Only the SHA-256 hash (`token_hash`) and a display prefix (`prefix`, first 15 characters, e.g. `tnx_ci_a1b2c3d...`) are stored in `pipeline_tokens`.
- **Usage tracking**: `last_used_at` is updated on each successful ingestion.

### 3.2 Token Rotation
- `POST /api/v1/pipelines/:id/token` revokes all existing active tokens for the pipeline immediately (`revoked_at = now()`) and returns a new plaintext token once.
- Once revoked, requests using the old token receive `401 INVALID_TOKEN`.

---

## 4. Test Case Export Specification

Testnexa exports Playwright specifications where every test case title is prefixed with its canonical identifier in square brackets:

```javascript
test('[TC_AUTH_001] Valid email and password credentials', async ({ page }) => {
    // Generated verification steps
});
```

Regex extraction rule:
```javascript
const CASE_KEY_REGEX = /^\[([A-Z]{2,5}(?:_[A-Z0-9]+)+)\]/;
```

### Supported Status Mappings:
| Playwright Status | Testnexa Outcome |
| :--- | :--- |
| `expected` (passed) | `passed` |
| `unexpected` (failed) | `failed` |
| `flaky` | `flaky` |
| `skipped` | `skipped` |

---

## 5. Ingestion API Endpoint

### `POST /api/v1/ci/results`

#### Required Headers:
- `Authorization: Bearer <pipeline_token>`
- `Idempotency-Key: <run_id>-<run_attempt>`
- `X-Commit-Sha: <40-character-hex-sha>`
- `Content-Type: application/json`

#### Optional Headers:
- `X-Branch: main`
- `X-PR-Number: 42`
- `X-Actor: octocat`
- `X-Run-Url: https://github.com/org/repo/actions/runs/12345`

#### Idempotency Behavior:
Duplicate submissions with the same `(pipeline_id, idempotency_key)` are detected. The existing run is returned immediately without creating duplicate records or skewing metrics.

#### Feature Gating:
The ingestion endpoint is strictly gated behind the `FEATURE_TEST_RUNS` feature flag. When `FEATURE_TEST_RUNS !== 'true'`, the endpoint returns:
```json
HTTP/1.1 501 Not Implemented
{
  "success": false,
  "code": "FEATURE_DISABLED",
  "message": "FEATURE_DISABLED: Test run ingestion is not enabled on this environment."
}
```

---

## 6. Retention and Privacy Policy

- **Run History Retention**: Test runs and results are retained for 12 months by default (configurable per enterprise policy).
- **Zero Customer Code Stored**: Testnexa only ingests test case titles, outcomes, execution duration, and error snippets. No customer application source code is transmitted or stored.
- **Error Summary Capping**: Failure messages and assertion snippets are capped at 1,000 characters to prevent accidental leakage of sensitive runtime strings.

---

## 7. Future Provider Extensibility (Phase 3)

The `POST /api/v1/ci/results` ingestion endpoint is provider-agnostic. While Phase 1 and 2 focus on GitHub Actions via the GitHub App, GitLab CI (`.gitlab-ci.yml`) and Jenkins (`Jenkinsfile`) will reuse the identical Bearer token authentication, idempotency protocol, and Playwright JSON reporter format.
