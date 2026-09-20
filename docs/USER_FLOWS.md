# User Flows — Testnexa AI

> Detailed user journey maps for all key interactions.

---

## 1. Guest Trial Flow

A new visitor can use Testnexa without signing up, with limited free generations.

```mermaid
flowchart TD
    A["Visit testnexa.ai"] --> B["Landing Page (GeneratorPage)"]
    B --> C["Click 'Get Started' or 'Generate Test Suite'"]
    C --> D{"Authenticated?"}
    D -->|No| E["Guest JWT token generated"]
    E --> F["Open AI Workspace"]
    F --> G["Paste requirement"]
    G --> H["Select settings (App Type, Detail Level)"]
    H --> I["Click Generate"]
    I --> J["View generated test suite"]
    J --> K{"Want to save?"}
    K -->|Yes| L["Prompted to Sign Up / Login"]
    K -->|No| M["Export or copy results"]
    
    style E fill:#1a1a2e,stroke:#f59e0b,color:#fff
    style L fill:#1a1a2e,stroke:#00d4aa,color:#fff
```

---

## 2. Registration Flow

### Email Registration

```mermaid
flowchart TD
    A["Click 'Sign Up'"] --> B["SignUpPage"]
    B --> C["Enter name, email, password"]
    C --> D["Submit registration form"]
    D --> E{"Validation passes?"}
    E -->|No| F["Show validation errors"]
    F --> C
    E -->|Yes| G["POST /api/v1/auth/register"]
    G --> H["User created in Supabase"]
    H --> I["JWT token generated"]
    I --> J["Welcome email sent (Nodemailer)"]
    J --> K["Redirect to workspace"]
    
    style H fill:#1a1a2e,stroke:#22c55e,color:#fff
```

### OAuth Registration (Google / GitHub)

```mermaid
flowchart TD
    A["Click 'Continue with Google/GitHub'"] --> B["Redirect to OAuth provider"]
    B --> C["User authorizes Testnexa"]
    C --> D["Provider callback to /api/v1/auth/google/callback"]
    D --> E["Passport.js strategy executes"]
    E --> F{"User exists in Supabase?"}
    F -->|No| G["Create user via upsertOAuthUser"]
    F -->|Yes| H["Update last_login, login_count"]
    G --> I["Welcome email dispatched (background)"]
    H --> J["Generate JWT token"]
    I --> J
    J --> K["Redirect to frontend with ?token=xxx"]
    K --> L["Frontend stores token in localStorage"]
    L --> M["User lands on workspace"]
    
    style G fill:#1a1a2e,stroke:#00d4aa,color:#fff
    style K fill:#1a1a2e,stroke:#a855f7,color:#fff
```

---

## 3. Test Suite Generation Flow

The core user journey — from requirement to test suite.

```mermaid
flowchart TD
    A["Open Workspace"] --> B["InputPanel component"]
    B --> C{"Use example?"}
    C -->|Yes| D["Select from examples dropdown"]
    C -->|No| E["Type/paste requirement text"]
    D --> F["Requirement populated"]
    E --> F
    F --> G["Configure settings"]
    G --> G1["App Type: Web / Mobile / API"]
    G --> G2["Detail Level: Essential / Standard / Comprehensive"]
    G --> G3["Test Focus: Mixed / Functional / Non-Functional / API"]
    G1 --> H["Click Generate"]
    G2 --> H
    G3 --> H
    H --> I["POST /api/v1/generate"]
    I --> J["LoadingArea shown with progress"]
    
    J --> K["Backend Orchestration Pipeline"]
    K --> K1["Validate input (Joi)"]
    K1 --> K2["Build combined prompt"]
    K2 --> K3["Adapt for persona"]
    K3 --> K4["Call Gemini AI"]
    K4 --> K5["Parse AI response"]
    K5 --> K6["Ambiguity analysis"]
    K6 --> K7["Domain detection"]
    K7 --> K8["Priority assignment"]
    K8 --> K9["Confidence scoring"]
    K9 --> K10["Persona enrichment"]
    
    K10 --> L["ResultsSection displayed"]
    L --> L1["Test cases by category"]
    L --> L2["Quality scores"]
    L --> L3["Coverage analytics"]
    L --> L4["Assumptions & risks"]
    
    L --> M{"Save to workspace?"}
    M -->|Authenticated| N["Auto-saved to workspace_sessions"]
    M -->|Guest| O["Available for export only"]
    
    N --> P["Desktop notification: 'Test suite ready'"]
    
    style K fill:#1a1a2e,stroke:#a855f7,color:#fff
    style L fill:#1a1a2e,stroke:#00d4aa,color:#fff
```

---

## 4. Refine & Regenerate Flow

```mermaid
flowchart TD
    A["View generated test suite"] --> B["Click 'Refine' in RefineRegeneratePanel"]
    B --> C["Edit requirement text"]
    C --> D["Optionally adjust settings"]
    D --> E["Click 'Regenerate'"]
    E --> F["Current version saved to versions array"]
    F --> G["New generation with updated requirement"]
    G --> H["current_version incremented"]
    H --> I["Updated ResultsSection displayed"]
    I --> J{"Satisfied?"}
    J -->|No| B
    J -->|Yes| K["Export or continue in workspace"]
    
    style F fill:#1a1a2e,stroke:#f59e0b,color:#fff
```

---

## 5. QA Copilot Interaction Flow

```mermaid
flowchart TD
    A["Open Copilot panel (bottom-right button)"] --> B["Copilot Drawer opens"]
    B --> C{"Select analysis scope"}
    C --> D["Full Suite Analysis"]
    C --> E["Single Test Case"]
    C --> F["Specific Category"]
    
    D --> G["POST /api/v1/copilot/analyze"]
    E --> G
    F --> G
    
    G --> H["Copilot returns findings"]
    H --> I["Coverage gaps listed"]
    H --> J["Security risks flagged"]
    H --> K["Improvement suggestions"]
    H --> L["New test case suggestions"]
    
    I --> M{"Take action?"}
    J --> M
    K --> M
    L --> M
    
    M -->|Add test| N["POST /api/v1/copilot/actions/add-test"]
    M -->|Improve test| O["POST /api/v1/copilot/actions/improve-test"]
    M -->|Dismiss| P["Close suggestion"]
    
    N --> Q["Test added to suite"]
    O --> R["Test updated in suite"]
    
    style G fill:#1a1a2e,stroke:#3b82f6,color:#fff
    style H fill:#1a1a2e,stroke:#00d4aa,color:#fff
```

---

## 6. History & Session Resumption Flow

```mermaid
flowchart TD
    A["Click History in sidebar or /app/history"] --> B["HistoryPage loads"]
    B --> C["GET /api/v1/history"]
    C --> D["Display generation history list"]
    D --> E["Search or filter results"]
    E --> F["Click on history entry"]
    F --> G{"Has workspace session?"}
    G -->|Yes| H["Navigate to /app/workspace/:sessionId"]
    G -->|No| I["View read-only history detail"]
    H --> J["Full workspace restored"]
    J --> K["Can refine, regenerate, or export"]
    
    style J fill:#1a1a2e,stroke:#00d4aa,color:#fff
```

---

## 7. Login Flow

```mermaid
flowchart TD
    A["Navigate to /login"] --> B["LoginPage"]
    B --> C{"Choose method"}
    C --> D["Email + Password"]
    C --> E["Google OAuth"]
    C --> F["GitHub OAuth"]
    
    D --> G["POST /api/v1/auth/login"]
    G --> H{"Rate limit check (10/15min)"}
    H -->|Blocked| I["429: Too many attempts"]
    H -->|OK| J{"Credentials valid?"}
    J -->|No| K["401: Invalid email or password"]
    J -->|Yes| L["Create auth_session record"]
    L --> M["Return JWT token"]
    
    E --> N["GET /api/v1/auth/google"]
    N --> O["Google consent screen"]
    O --> P["Callback with token redirect"]
    
    F --> Q["GET /api/v1/auth/github"]
    Q --> R["GitHub authorization"]
    R --> S["Callback with token redirect"]
    
    M --> T["Store token in localStorage"]
    P --> T
    S --> T
    T --> U["Redirect to /app/workspace"]
    
    style L fill:#1a1a2e,stroke:#22c55e,color:#fff
```

---

## 8. Password Reset Flow

```mermaid
flowchart TD
    A["Click 'Forgot Password' on login page"] --> B["ForgotPasswordPage"]
    B --> C["Enter email address"]
    C --> D["POST /api/v1/auth/forgot-password"]
    D --> E{"Rate limit check (5/15min)"}
    E -->|Blocked| F["429: Too many attempts"]
    E -->|OK| G{"Email exists?"}
    G -->|No| H["Respond OK (prevents enumeration)"]
    G -->|Yes| I["Generate reset token"]
    I --> J["Store reset_password_token + expire in users"]
    J --> K["Send reset email via Nodemailer"]
    K --> L["User clicks reset link"]
    L --> M["ResetPasswordPage (/reset-password/:token)"]
    M --> N["Enter new password"]
    N --> O["PUT /api/v1/auth/reset-password/:token"]
    O --> P["Hash new password (bcryptjs)"]
    P --> Q["Clear reset_password_token"]
    Q --> R["Redirect to login"]
    
    style I fill:#1a1a2e,stroke:#f59e0b,color:#fff
    style P fill:#1a1a2e,stroke:#22c55e,color:#fff
```

---

## 9. Test Suite Sharing Flow

```mermaid
flowchart TD
    A["Generate or open test suite"] --> B["Copy share link"]
    B --> C["Link format: /suites/:id"]
    C --> D["Recipient opens link"]
    D --> E["SuiteShareRedirect component"]
    E --> F["Redirect to /app/test-suites/:id"]
    F --> G{"Authenticated?"}
    G -->|No| H["Redirect to login with return URL"]
    G -->|Yes| I["Load test suite detail page"]
    
    style E fill:#1a1a2e,stroke:#3b82f6,color:#fff
```

---

## 10. Logout & Session Revocation Flow

```mermaid
flowchart TD
    A["Click profile menu → Sign Out"] --> B["POST /api/v1/auth/logout"]
    B --> C["Current auth_session revoked (revoked_at set)"]
    C --> D["JWT token removed from localStorage"]
    D --> E["Redirect to / (landing page)"]
    
    F["Settings → Active Sessions"] --> G["GET /api/v1/auth/sessions"]
    G --> H["Display active sessions with device info"]
    H --> I{"Revoke action"}
    I --> J["Revoke single session"]
    I --> K["Revoke all other sessions"]
    J --> L["POST /api/v1/auth/sessions/:id/revoke"]
    K --> M["POST /api/v1/auth/sessions/revoke-others"]
    
    style C fill:#1a1a2e,stroke:#ef4444,color:#fff
```

---

*Last updated: September 2026*
