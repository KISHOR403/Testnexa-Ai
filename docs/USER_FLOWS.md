# User Flows — Testnexa AI

> Comprehensive, end-to-end journey maps and technical walkthroughs for all user interactions.

---

## 🗺️ Master User Flow Index

| # | Journey Name | Primary Actor | Entry Route | Key API Endpoints | Data Persistence |
|---|---|---|---|---|---|
| **1** | [Guest Trial Flow](#1-guest-trial-flow) | Unregistered Visitor | `/` | `POST /api/v1/generate` | Ephemeral (localStorage) |
| **2** | [Registration Flow](#2-registration-flow) | New User | `/signup` | `POST /api/v1/auth/register`, OAuth callbacks | `users`, `auth_sessions` |
| **3** | [Test Generation Flow](#3-test-suite-generation-flow) | Any User | `/app/workspace` | `POST /api/v1/generate` | `workspace_sessions`, `test_history` |
| **4** | [Refine & Regenerate](#4-refine--regenerate-flow) | QA Engineer | Workspace Modal | `POST /api/v1/generate` (refine mode) | `versions` JSONB array updated |
| **5** | [QA Copilot Interaction](#5-qa-copilot-interaction-flow) | SDET / Tester | Copilot Drawer | `POST /api/v1/copilot/analyze` | Active suite patched |
| **6** | [History & Resumption](#6-history--session-resumption-flow) | Authenticated User | `/app/history` | `GET /api/v1/history`, `GET /api/v1/workspace/:id` | Read-only & full hydration |
| **7** | [Login & Authentication](#7-login-flow) | Returning User | `/login` | `POST /api/v1/auth/login`, OAuth | `auth_sessions` logged |
| **8** | [Password Reset Flow](#8-password-reset-flow) | Registered User | `/forgot-password` | `/forgot-password`, `/reset-password/:token` | Crypto token in `users` |
| **9** | [Test Suite Sharing](#9-test-suite-sharing-flow) | Team Member | `/suites/:id` | `GET /api/v1/test-suites/:id` | Read-access resolution |
| **10** | [Logout & Session Revocation](#10-logout--session-revocation-flow) | Authenticated User | Profile Menu / Settings | `POST /auth/logout`, `POST /auth/sessions/revoke` | `revoked_at` timestamp set |

---

## 1. Guest Trial Flow

Enables friction-free onboarding so prospective users can test the AI generator immediately without creating an account.

```mermaid
flowchart TD
    A["Visit testnexa.ai"] --> B["Landing Page (GeneratorPage)"]
    B --> C["Click 'Get Started' or 'Generate Test Suite'"]
    C --> D{"Authenticated?"}
    D -->|No| E["Guest JWT token generated"]
    E --> F["Open AI Workspace Modal"]
    F --> G["Paste requirement text or choose sample"]
    G --> H["Select settings (App Type, Detail Level)"]
    H --> I["Click 'Generate Test Suite'"]
    I --> J["View generated multi-category tests"]
    J --> K{"Action: Want to save to account?"}
    K -->|Yes| L["Prompted with Sign Up / Login Modal"]
    K -->|No| M["Export as JSON, CSV, or Markdown"]
    
    style E fill:#0d1117,stroke:#f59e0b,color:#fff
    style L fill:#0d1117,stroke:#00d4aa,stroke-width:2px,color:#fff
    style M fill:#0d1117,stroke:#3b82f6,color:#fff
```

### Detailed Step-by-Step Walkthrough:
1. **Landing & Exploration:** A visitor lands on `/`. The page features an interactive preview with pre-populated example requirements (e.g. E-Commerce Checkout, OAuth Login).
2. **Guest Token Issuance:** When the guest clicks "Generate", the frontend calls the backend with `optionalProtect`. A client-side guest session ID is assigned and stored in `sessionStorage`.
3. **Execution:** The generation pipeline executes identically to an authenticated request, returning full ISTQB test cases, ambiguity warnings, and quality scores.
4. **Export vs Save:**
   - **Export:** The user can freely download Markdown, CSV, or raw JSON immediately.
   - **Save Attempt:** If the user clicks "Save to Workspace" or attempts to access `/app/history`, an auth modal opens. Upon signup/login, the in-memory guest suite is automatically linked to their newly created account.

---

## 2. Registration Flow

### A. Email + Password Registration

```mermaid
flowchart TD
    A["Click 'Sign Up'"] --> B["SignUpPage (/signup)"]
    B --> C["Enter Full Name, Email, Password"]
    C --> D["Submit Form"]
    D --> E{"Client & Server Validation"}
    E -->|Fails| F["Display inline field error"]
    F --> C
    E -->|Passes| G["POST /api/v1/auth/register"]
    G --> H["Hash password with bcryptjs (10 rounds)"]
    H --> I["Insert record into Supabase users table"]
    I --> J["Generate JWT access token (24h expiry)"]
    J --> K["Queue welcome email via Nodemailer"]
    K --> L["Store token in localStorage & redirect to /app/workspace"]
    
    style I fill:#0d1117,stroke:#22c55e,stroke-width:2px,color:#fff
    style J fill:#0d1117,stroke:#00d4aa,color:#fff
```

### B. OAuth Social Registration (Google & GitHub)

```mermaid
flowchart TD
    A["Click 'Continue with Google / GitHub'"] --> B["GET /api/v1/auth/google or /github"]
    B --> C["Redirect to Provider Consent Screen"]
    C --> D["User authorizes application permissions"]
    D --> E["Provider callback to /api/v1/auth/:provider/callback"]
    E --> F["Passport.js extracts profile & email"]
    F --> G{"Does user exist in Supabase?"}
    G -->|No| H["Create user via upsertOAuthUser()"]
    G -->|Yes| I["Update last_login and login_count"]
    H --> J["Background: Dispatch welcome email"]
    I --> K["Generate signed JWT Bearer token"]
    J --> K
    K --> L["Redirect to frontend: /auth-success?token=xxx"]
    L --> M["AuthContext extracts token into localStorage"]
    M --> N["Redirect to /app/workspace with active session"]
    
    style H fill:#0d1117,stroke:#00d4aa,color:#fff
    style L fill:#0d1117,stroke:#a855f7,stroke-width:2px,color:#fff
```

---

## 3. Test Suite Generation Flow

The core value engine of Testnexa AI — converting raw requirements into execution-ready ISTQB test suites.

```mermaid
flowchart TD
    A["Open AI Workspace Modal"] --> B["InputPanel: Enter requirement (min 20 chars)"]
    B --> C["Configure Settings"]
    C --> C1["Target Platform: Web / Mobile / API"]
    C --> C2["Detail Level: Essential / Standard / Comprehensive"]
    C --> C3["Focus: Mixed / Functional / Non-Functional / API"]
    
    C1 & C2 & C3 --> D["Click 'Generate Test Suite'"]
    D --> E["POST /api/v1/generate"]
    E --> F["Display LoadingArea with step-by-step thinking state"]
    
    subgraph BackendOrchestration["Backend Processing Pipeline"]
        F --> G1["1. Joi schema validation & XSS sanitization"]
        G1 --> G2["2. Ambiguity Analyzer computes clarity score"]
        G2 --> G3["3. Two-Step Prompt compilation with persona rules"]
        G3 --> G4["4. Google Gemini 2.5 Flash execution"]
        G4 --> G5["5. ISTQB schema normalizer & error recovery"]
        G5 --> G6["6. Priority & severity calculation (High/Med/Low)"]
        G6 --> G7["7. Traceability linker assigns REQ_* IDs"]
    end
    
    G7 --> H{"Is User Authenticated?"}
    H -->|Yes| I["Persist in workspace_sessions & test_history"]
    H -->|No| J["Return ephemeral suite payload"]
    
    I --> K["Return 200 OK with full test suite JSON"]
    J --> K
    K --> L["Render ResultsSection (Cards, Badges, Metrics)"]
    L --> M["Trigger browser desktop notification"]

    style BackendOrchestration fill:#0d1117,stroke:#a855f7,stroke-width:2px,color:#fff
    style L fill:#0d1117,stroke:#00d4aa,stroke-width:2px,color:#fff
```

---

## 4. Refine & Regenerate Flow

Allows continuous test design iteration without losing previous work through automated session versioning.

```mermaid
flowchart TD
    A["Active Test Suite displayed in ResultsSection"] --> B["Click 'Refine' in RefineRegeneratePanel"]
    B --> C["Edit requirement text in inline editor"]
    C --> D["Optionally adjust target depth or focus"]
    D --> E["Click 'Regenerate'"]
    E --> F["Backend archives current suite into versions JSONB array"]
    F --> G["Execute new generation with updated parameters"]
    G --> H["current_version counter increments (e.g. v1 -> v2)"]
    H --> I["Display updated ResultsSection"]
    I --> J{"User satisfied with changes?"}
    J -->|No| K["Use version switcher dropdown to revert or re-refine"]
    J -->|Yes| L["Proceed to QA Copilot or Export"]
    
    style F fill:#0d1117,stroke:#f59e0b,color:#fff
    style H fill:#0d1117,stroke:#00d4aa,color:#fff
```

---

## 5. QA Copilot Interaction Flow

An embedded human-in-the-loop AI assistant that inspects the active test suite, discovers test gaps, and suggests immediate enhancements.

```mermaid
flowchart TD
    A["User clicks floating 'QA Copilot' button"] --> B["CopilotDrawer slides out from bottom-right"]
    B --> C{"Select Analysis Scope"}
    C -->|Full Suite| D1["Pass all categories and requirements"]
    C -->|Single Test| D2["Pass specific test scenario context"]
    C -->|Category| D3["Pass only edge cases or API tests"]
    
    D1 & D2 & D3 --> E["POST /api/v1/copilot/analyze"]
    E --> F["Enforce rate limit (40 requests / 5 minutes)"]
    F --> G["Copilot Engine audits suite against ISTQB coverage rules"]
    G --> H["Render categorized suggestions in drawer"]
    
    H --> S1["Coverage Gaps (Untested user flows)"]
    H --> S2["Security Risks (SQL injection, XSS, rate limits)"]
    H --> S3["Edge Conditions (Timeouts, concurrent sessions)"]
    
    S1 & S2 & S3 --> Action{"User Review Action"}
    Action -->|Click 'Add Test'| Patch1["POST /api/v1/copilot/actions/add-test"]
    Action -->|Click 'Improve'| Patch2["POST /api/v1/copilot/actions/improve-test"]
    Action -->|Click 'Dismiss'| Dismiss["Card dismissed from drawer"]
    
    Patch1 --> Update["Active suite immediately patched in frontend & DB"]
    Patch2 --> Update

    style E fill:#0d1117,stroke:#3b82f6,color:#fff
    style H fill:#0d1117,stroke:#00d4aa,stroke-width:2px,color:#fff
    style Update fill:#0d1117,stroke:#22c55e,color:#fff
```

---

## 6. History & Session Resumption Flow

Ensures engineers never lose past generation work, allowing them to search, inspect, or fully resume past sessions.

```mermaid
flowchart TD
    A["Navigate to /app/history or click History in sidebar"] --> B["HistoryPage mounts"]
    B --> C["GET /api/v1/history (scoped to req.user.id)"]
    C --> D["Display paginated generation cards with timestamps & counts"]
    D --> E["Filter by search keyword, app type, or date range"]
    E --> F["Click on a history card"]
    F --> G{"Does record link to a workspace_session?"}
    G -->|Yes| H["Navigate to /app/workspace/:sessionId"]
    G -->|No| I["Open read-only inspection modal with original payload"]
    H --> J["Full interactive workspace state hydrated from Supabase"]
    J --> K["Engineer can refine, regenerate, add copilot tests, or export"]

    style C fill:#0d1117,stroke:#3b82f6,color:#fff
    style J fill:#0d1117,stroke:#00d4aa,stroke-width:2px,color:#fff
```

---

## 7. Login Flow

```mermaid
flowchart TD
    A["Navigate to /login"] --> B["LoginPage"]
    B --> C{"Select Auth Provider"}
    C -->|Email & Password| D["Enter email & password"]
    C -->|Google| E["GET /api/v1/auth/google"]
    C -->|GitHub| F["GET /api/v1/auth/github"]
    
    D --> G["POST /api/v1/auth/login"]
    G --> H{"Rate limit: max 10 attempts / 15m?"}
    H -->|Exceeded| I["Return 429 Too Many Requests"]
    H -->|OK| J{"Verify bcrypt password against hash"}
    J -->|Invalid| K["Return 401: Invalid credentials"]
    J -->|Valid| L["Create auth_session (IP, Browser, OS, Device)"]
    
    E & F --> M["OAuth exchange & upsert user"]
    M --> L
    
    L --> N["Issue signed JWT Bearer Token (24h)"]
    N --> O["Frontend stores token in localStorage"]
    O --> P["Redirect to /app/workspace or returnUrl"]

    style L fill:#0d1117,stroke:#22c55e,stroke-width:2px,color:#fff
    style N fill:#0d1117,stroke:#00d4aa,color:#fff
```

---

## 8. Password Reset Flow

Protects user accounts with timing-attack resistant reset mechanics and expiring cryptographic tokens.

```mermaid
flowchart TD
    A["Click 'Forgot Password' on /login"] --> B["ForgotPasswordPage"]
    B --> C["Enter account email"]
    C --> D["POST /api/v1/auth/forgot-password"]
    D --> E{"Rate limit: 5 requests / 15 min"}
    E -->|Exceeded| F["Return 429 Too Many Requests"]
    E -->|OK| G{"Does email exist in Supabase users?"}
    G -->|No| H["Return 200 OK (Generic success to prevent user enumeration)"]
    G -->|Yes| I["Generate crypto random token (32 bytes hex)"]
    I --> J["Hash token & store reset_password_token + 1h expiry in DB"]
    J --> K["Send reset link via Nodemailer with token URL"]
    K --> L["User opens email and clicks link"]
    L --> M["ResetPasswordPage mounts (/reset-password/:token)"]
    M --> N["Enter new password & confirm"]
    N --> O["PUT /api/v1/auth/reset-password/:token"]
    O --> P{"Is token valid and unexpired?"}
    P -->|No| Q["Return 400: Invalid or expired token"]
    P -->|Yes| R["Hash new password with bcryptjs"]
    R --> S["Update users record & clear reset token fields"]
    S --> T["Redirect to /login with success toast"]

    style J fill:#0d1117,stroke:#f59e0b,color:#fff
    style R fill:#0d1117,stroke:#22c55e,stroke-width:2px,color:#fff
```

---

## 9. Test Suite Sharing Flow

```mermaid
flowchart TD
    A["User clicks 'Share Suite' in Workspace"] --> B["Copy permanent share link (/suites/:id)"]
    B --> C["Send link to team member or stakeholder"]
    C --> D["Recipient opens share link in browser"]
    D --> E["SuiteShareRedirect checks authentication"]
    E --> F{"Is recipient logged in?"}
    F -->|No| G["Redirect to /login?returnUrl=/app/test-suites/:id"]
    F -->|Yes| H["Redirect directly to /app/test-suites/:id"]
    G --> H
    H --> I["TestSuiteDetailPage fetches suite via GET /api/v1/workspace/:id"]
    I --> J["Render read-only suite with ISTQB tables and export buttons"]

    style B fill:#0d1117,stroke:#00d4aa,color:#fff
    style J fill:#0d1117,stroke:#3b82f6,color:#fff
```

---

## 10. Logout & Session Revocation Flow

Supports multi-device session management with instant database-level token invalidation.

```mermaid
flowchart TD
    A["User clicks 'Sign Out' in Avatar Dropdown"] --> B["POST /api/v1/auth/logout"]
    B --> C["Backend marks current auth_session as revoked (revoked_at = NOW())"]
    C --> D["Clear JWT token from client localStorage"]
    D --> E["Redirect to Landing Page (/)"]
    
    subgraph MultiDeviceManagement["Active Session Management (/app/settings)"]
        F["Open Settings → Active Sessions tab"] --> G["GET /api/v1/auth/sessions"]
        G --> H["Display list of active devices (Device, Browser, IP, Location)"]
        H --> I{"User action"}
        I -->|Revoke Specific Session| J["POST /api/v1/auth/sessions/:id/revoke"]
        I -->|Revoke All Other Sessions| K["POST /api/v1/auth/sessions/revoke-others"]
        J --> L["Target session immediately denied access on next API call"]
        K --> L
    end

    style C fill:#0d1117,stroke:#ef4444,stroke-width:2px,color:#fff
    style L fill:#0d1117,stroke:#22c55e,color:#fff
```

---

*Last updated: September 2026*
