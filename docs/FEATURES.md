# Features — Testnexa AI

> Complete feature catalog organized by category.

---

## 🧠 AI-Powered Test Generation

### Multi-Category Test Generation

Generates four categories of test cases simultaneously from a single requirement input:

| Category | ID Prefix | Description |
|----------|-----------|-------------|
| **Functional** | `TC_FUNC_*` | Happy-path and core user workflow tests |
| **Negative** | `TC_NEG_*` | Invalid input, error handling, and failure scenario tests |
| **Edge Case** | `TC_EDGE_*` | Boundary conditions, unusual inputs, and corner cases |
| **API** | `TC_API_*` | Endpoint-level tests with HTTP methods and status codes |

### Test Case Schema

Every generated test case follows a 12-field industry-standard schema (ISTQB/IEEE 829):

```json
{
  "id": "TC_FUNC_001",
  "testScenario": "User Authentication",
  "module": "Login",
  "title": "Verify successful login with valid credentials",
  "type": "Functional",
  "priority": "High",
  "severity": "Critical",
  "preconditions": "User has a registered account",
  "testData": "Email: testuser@example.com, Password: ValidPass123",
  "steps": [
    "Navigate to the login page",
    "Enter a valid registered email address",
    "Enter the correct password",
    "Click the Login button"
  ],
  "expectedResult": "User is redirected to the dashboard; a valid session token is issued",
  "requirementId": "REQ_001"
}
```

### Configurable Generation

| Setting | Options | Description |
|---------|---------|-------------|
| **App Type** | Web, Mobile, API, Desktop | Tailors test scenarios to platform context |
| **Detail Level** | Essential, Standard, Comprehensive | Controls test case count and depth |
| **Test Focus** | Mixed, Functional, Non-Functional, API | Filters generation category emphasis |

### Persona-Adaptive Output

Test output adapts based on the user persona:

- **SDET Mode** — Technical depth, automation feasibility, API-specific details
- **PM/BA Mode** — Business-focused language, acceptance criteria emphasis
- **Fresher Mode** — Explanatory content, learning-oriented descriptions

---

## 🔍 Ambiguity Detection Engine

### Automatic Analysis

The system proactively identifies:

- **Contradictions** — Conflicting statements within the requirement
- **Missing logic** — Undefined error handling, boundary conditions
- **Unclear specifications** — Vague language, unmeasurable criteria
- **Assumptions** — Implicit behaviors that need explicit validation

### Ambiguity Scoring

| Score | Meaning | Action |
|-------|---------|--------|
| **Low** | Requirement is clear and testable | Proceed with high confidence |
| **Medium** | Some areas need clarification | Generate with assumptions documented |
| **High** | Significant gaps detected | Surface clarification questions to user |

### Clarification Questions

When high ambiguity is detected, the system generates targeted questions to guide the user toward clearer requirements before or alongside test generation.

---

## 📊 Quality & Analytics

### Coverage Analytics

- **Coverage Confidence** — AI-assessed percentage (0–100%) of requirement coverage
- **Category Distribution** — Visual breakdown of functional, negative, edge, and API test counts
- **Module Coverage** — Tests grouped and counted by feature module

### Risk Analysis

- **Risk Areas** — Automatically identified high-risk areas from the requirement
- **Priority Distribution** — High/Medium/Low breakdown with rationale
- **Severity Assessment** — Critical/Major/Minor/Trivial impact ratings

### Requirement Intelligence

- **Quality Score** — Overall requirement quality assessment
- **Domain Detection** — Automatic identification of business domain (e-commerce, fintech, healthcare, etc.)
- **Assumption Tracking** — Explicit list of assumptions made during generation

### Traceability Matrix

- Maps each test case back to its source requirement via `requirementId`
- Visual requirement-to-test coverage display
- Identifies requirements with no test coverage

---

## 🤖 QA Copilot

### Context-Aware Analysis

An AI assistant embedded in the test suite workspace that provides:

| Analysis Type | Description |
|---------------|-------------|
| **Coverage Gap Analysis** | Identifies untested scenarios and missing test categories |
| **Security Risk Audit** | Flags potential security-related test gaps |
| **Edge Case Suggestions** | Proposes additional edge cases not captured |
| **Test Improvement** | Suggests enhancements to existing test cases |

### Human-in-the-Loop Actions

- **Add Suggested Test** — One-click addition of Copilot-suggested test cases to the suite
- **Improve Test** — Apply Copilot-recommended improvements to existing test cases
- **Context Retrieval** — Copilot maintains full suite context for informed analysis

### Copilot Architecture

- Floating bottom-right assistant panel
- Scoped context (full suite, single test, specific category)
- Rate-limited to 40 requests per 5-minute window

---

## 🔄 Iterative Refinement

### Refine & Regenerate

- **Refine Requirement** — Update the original requirement with more detail, then regenerate
- **Regenerate with Feedback** — Provide specific feedback to improve output quality
- **Version History** — Each regeneration creates a new version, preserving all prior outputs

### Version Management

- Workspace sessions track `current_version` (integer)
- All versions stored in `versions` JSONB array
- Users can compare and switch between versions

---

## 📤 Export System

### Supported Formats

| Format | Content | Use Case |
|--------|---------|----------|
| **JSON** | Structured test data with full metadata | Import into test management tools, CI/CD pipelines |
| **Markdown** | Formatted test cases with tables | Documentation, wiki pages, pull requests |
| **Copy to Clipboard** | Individual or bulk test case copy | Quick sharing and pasting |

### Export Content

Exports include:
- All test cases with full 12-field schema
- Generation metadata (timestamp, processing time, model)
- Quality scores and coverage metrics
- Requirement text and assumptions

---

## 📜 History & Sessions

### Generation History

- **Persistent Storage** — All generations saved to Supabase `test_history` table
- **Search & Filter** — Browse past generations with filtering
- **Quick Access** — Collapsible sidebar for recent history
- **Cross-Device Sync** — History accessible from any authenticated device

### Workspace Sessions

- **Session Resumption** — Return to any previous workspace session
- **Auto-Save** — Workspace state persisted on every generation
- **Session Metadata** — Title, status, app type, context, and timestamps
- **CRUD Operations** — Create, read, update, delete sessions

---

## 🔐 Authentication System

### Supported Methods

| Method | Description |
|--------|-------------|
| **Guest Mode** | Try the tool with limited free generations (no signup required) |
| **Email/Password** | Traditional registration with JWT token authentication |
| **Google OAuth** | One-click Google sign-in via Passport.js |
| **GitHub OAuth** | Developer-friendly GitHub login via Passport.js |

### Session Management

- **Active Sessions** — View all logged-in devices with browser/OS/IP info
- **Session Revocation** — Revoke individual or all other sessions
- **Device Tracking** — User-agent parsing for device identification
- **Welcome Emails** — Automatic welcome email on first signup (via Nodemailer)

### Password Management

- **Forgot Password** — Email-based password reset flow
- **Reset Token** — Time-limited reset tokens with expiration
- **Change Password** — Authenticated password change from settings

---

## 🎨 User Interface Features

### Premium Dark UI

- True Black design system with glassmorphism elements
- Animated particle background on landing page
- Smooth CSS shimmer text effects
- Scroll-reveal animations on section entry

### Responsive Design

- Full multi-breakpoint responsive system (mobile, tablet, desktop)
- Collapsible sidebar navigation in app layout
- Mobile-optimized input panels and result displays

### Desktop Notifications

- Browser Notification API integration
- Alerts when test suite generation completes (useful for long generation times)

### Guided Tour

- First-time user onboarding walkthrough
- Step-by-step feature introduction

---

## 📚 Content Pages

| Page | Route | Description |
|------|-------|-------------|
| **Help Center** | `/help` | Comprehensive documentation with search |
| **API Reference** | `/api-reference` | Interactive API documentation with Try It console |
| **Best Practices** | `/best-practices` | QA best practices guide with Do/Avoid checklists |
| **About Us** | `/about` | Company and team information |
| **Contact** | `/contact` | Contact form and support info |
| **Terms of Service** | `/terms` | Legal terms and conditions |
| **Privacy Policy** | `/privacy` | Data privacy policy |
| **Cookie Policy** | `/cookie-policy` | Cookie usage policy |
| **API Terms** | `/api-terms` | API-specific terms of service |
| **Acceptable Use** | `/acceptable-use` | Usage guidelines |

---

*Last updated: September 2026*
