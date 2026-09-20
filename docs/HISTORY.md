# Project History — Testnexa AI

> Evolution timeline and key milestones from initial commit to present.

---

## Origins

Testnexa AI (originally named **AutoTestGen**) was created as an AI-powered QA test case generator. The project has evolved through multiple phases — from a simple single-page prototype to a full-stack enterprise QA platform.

---

## Timeline

### Phase 1: Foundation (Initial Commit)

**`5442976` — Initial commit**

- Basic project scaffolding
- Vite + React frontend setup
- Initial component structure

---

### Phase 2: Core Product Build

**Key commits:**

- **`a83e2b6`** — Comprehensive README with screenshots and project documentation
- **`2903b5a`** — Mermaid flowchart diagrams added to README
- **`113ba3b`** — Detailed READMEs for both backend and frontend
- **`78ac478`** — Renamed `src/` to `frontend/`, established dual-project structure

**What was built:**
- React frontend with core components (Hero, InputPanel, ResultsSection)
- Express backend with AI service integration
- Initial OpenAI integration for test generation
- Basic landing page with feature sections

---

### Phase 3: AI Accuracy & Schema Standardization

**Key commits:**

- **`fa20a6c`** — Expanded test case schema to 13-field industry standard (ISTQB/IEEE 829)
- **`934891c`** — Strict JSON schema + table UI for test cases
- **`f9dc372`** — Enforced structured steps in AI prompt, rendered as clean table
- **`b30c2a0`** — Fixed Two-Step Orchestrator to properly generate API test cases
- **`bca544b`** — Added conversational prompt rejection rules to validation

**Impact:** Test output quality dramatically improved with structured, industry-standard formatting.

---

### Phase 4: Authentication & User System

**Key commits:**

- **`5b68bf9`** — Implemented secure forgot and reset password flow
- **`0cda97e`** — Added input quality validation, AI fallback, and OAuth profile display
- **`663ece9`** — Synced frontend with MongoDB for persistent history and profile stats
- **`6a3d97f`** — Added login tracking, provider storage, and TestHistory collection

**What was built:**
- Email/password registration and login
- Google OAuth integration
- GitHub OAuth integration
- JWT-based authentication
- Password reset via email

---

### Phase 5: UI/UX Transformation

**Key commits:**

- **`d0962d5`** — Redesigned landing page
- **`6caae76`** — Unified 1240px global grid, editorial layouts, vertical rhythm
- **`e4e7074`** — Redesigned output UI into enterprise QA workspace with master-detail table
- **`a82f9c5`** — Moved AI Workspace into full-screen overlay modal
- **`6f6a259`** — Separated marketing and application navigation
- **`29c3685`** — Overhauled entire website to true neutral black design system
- **`ec8e25b`** — Complete multi-breakpoint responsive design engine

**Impact:** Transformed from a basic prototype UI to a premium enterprise dark-theme design.

---

### Phase 6: Enterprise Application Shell

**Key commits:**

- **`9f9e85f`** — Modernized workspace and IA to enterprise QA standards
- **`af1d15c`** — Implemented persistent AI workspace history with session resumption and versioning
- **`9435c3c`** — Centralized auth flow with open redirect protection
- **`7ba9c39`** — Implemented real sign-out, session invalidation, and active session management
- **`77b5436`** — Enforced strict multi-user test suite scoping (data isolation)
- **`2749b48`** — Synchronous generation persistence and automatic test suite navigation

**Impact:** Application became a multi-tenant, session-managed QA workbench.

---

### Phase 7: Database Migration (MongoDB → Supabase)

**Key commits:**

- **`dedc3e7`** — Integrated Supabase PostgreSQL for authentication, sessions, and test history
- **`ef86723`** — Synced Google/GitHub OAuth and email auth directly to Supabase
- **`38c6f44`** — **Permanently removed MongoDB** and migrated all persistence to Supabase

**Impact:** Eliminated MongoDB dependency entirely. All data now lives in Supabase PostgreSQL with proper relational schema, indexes, and referential integrity.

---

### Phase 8: QA Copilot

**Key commits:**

- **`e0b2216`** — Redesigned "Ask Testnexa" into a contextual QA Copilot with backend API and multi-tenant authorization
- **`48856d0`** — Redesigned as floating bottom-right contextual QA assistant
- **`019c515`** — Fixed mobile visibility bug
- **`f55c826`** — Enabled smooth vertical scrolling in Copilot drawer findings

**What was built:**
- Context-aware AI analysis engine (coverage gaps, security risks, improvements)
- Human-in-the-loop actions (add suggested tests, improve existing tests)
- Rate-limited API with dedicated routes
- Floating drawer UI with scoped analysis modes

---

### Phase 9: Content & Documentation Pages

**Key commits:**

- **`9fa0c93`** — Redesigned Help & Documentation into enterprise Help Center
- **`1b79ce8`** — Redesigned API Reference with 3-part layout, real endpoints, Try It console
- **`13303ad`** — Redesigned Best Practices page with Do/Avoid guidelines and interactive checklist
- **`5399b8a`** — Redesigned About page with QA platform positioning
- **`5fbfb50`** — Redesigned Terms & Conditions and legal documentation hub
- **`1498f79`** — Redesigned account settings into dedicated enterprise settings page

---

### Phase 10: Infrastructure & CI/CD

**Key commits:**

- **`171ec06`** — Fixed Docker image builds when DockerHub secrets unavailable
- **`ccb5668`** — Merged PR #1: fix failing GitHub Actions job
- **`1bb0c2e`** — Fixed CI: exposed secrets via env to resolve conditional expressions

**What was built:**
- Multi-stage Docker builds (frontend + backend)
- Kubernetes manifests (namespace, deployments, services, secrets)
- Prometheus + Grafana monitoring stack
- GitHub Actions CI/CD pipeline
- AWS EKS deployment support

---

### Phase 11: Polish & Refinement (Current)

**Key commits:**

- **`6ba3903`** — Refined color system to enterprise-grade dark theme with single brand accent
- **`0740cee`** — Established restrained enterprise font hierarchy and color scale
- **`a98fb2f`** — Redesigned workspace into enterprise QA workbench with workflow stepper
- **`6a96618`** — Redesigned authentication to enterprise B2B SaaS standard
- **`7e1f82d`** — Integrated thinking states animation into hero headline
- **`36b2b78`** — Refined primary CTA hierarchy with pure CSS shimmer text effect
- **`9ff2233`** — Added stack-spread component and sticky positioning fixes

---

## Technology Evolution

| Component | Phase 1–3 | Phase 4–6 | Phase 7–11 (Current) |
|-----------|-----------|-----------|---------------------|
| **Frontend** | React + basic CSS | React + design system | React 19 + enterprise dark theme |
| **Backend** | Express + OpenAI | Express + Gemini | Express + Gemini 2.5 + orchestrator |
| **Database** | None (in-memory) | MongoDB Atlas | **Supabase PostgreSQL** |
| **Auth** | None | JWT + OAuth | JWT + OAuth + session management |
| **Deployment** | Local only | Docker | Docker + K8s + Vercel + EKS |
| **AI Pipeline** | Simple prompt → response | Two-step orchestration | Combined prompt + 10-service chain |

---

## Commit Statistics

- **Total commits:** 60+
- **First commit:** `5442976` (Initial commit)
- **Latest commit:** `9ff2233` (Stack-spread component)
- **Contributors:** Testnexa AI Team
- **Primary language:** JavaScript (React + Node.js)

---

*Last updated: September 2026*
