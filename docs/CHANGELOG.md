# Changelog — Testnexa AI

> Version history and categorized changes.

---

## [Unreleased] — September 2026

### ✨ Features

- **Stack-spread component** with sticky positioning and `overflow-x: clip` (`9ff2233`)
- **Thinking states animation** in hero headline via Transitions.dev (`7e1f82d`)
- **CSS shimmer text effect** on hero headline with refined CTA hierarchy (`36b2b78`)
- **Enterprise QA workbench** with workflow stepper, live milestones, and Copilot integration (`a98fb2f`)
- **Production-ready enterprise landing page** transformation (`1d1187c`)
- **Enterprise B2B authentication** redesign (`6a96618`)

### 🎨 Style

- Refined color system to enterprise-grade dark theme with single brand accent (`6ba3903`)
- Fixed high-contrast shimmer gradient for hero headline (`bb83c1c`)
- Established restrained enterprise font hierarchy and color scale (`0740cee`)

### 🐛 Fixes

- Removed excessive blank space from hero preview box and fixed header wrapping on mobile (`c692317`)

---

## [1.6.0] — QA Copilot

### ✨ Features

- **QA Copilot** — Contextual AI assistant with backend API and multi-tenant authorization (`e0b2216`)
- Redesigned Copilot as floating bottom-right assistant (`48856d0`)
- Smooth vertical scrolling in Copilot drawer findings (`f55c826`)

### 🐛 Fixes

- Resolved mobile visibility bug where Copilot button and panel collapsed to black (`019c515`)

---

## [1.5.0] — Database Migration & Enterprise App

### ✨ Features

- **Supabase PostgreSQL integration** for authentication, sessions, and test history (`dedc3e7`)
- Persistent AI workspace history with session resumption, versioning, and management (`af1d15c`)
- Centralized authentication flow with open redirect protection (`7ba9c39`)
- Real sign-out, session invalidation, and active session management (`9435c3c`)
- Strict multi-user test suite scoping and data isolation (`77b5436`)
- Synchronous generation persistence and automatic test suite navigation (`2749b48`)

### 🔧 Refactor

- **Permanently removed MongoDB** — migrated all persistence to Supabase (`38c6f44`)
- Synced Google/GitHub OAuth and email auth directly to Supabase (`ef86723`)

### ⚡ Performance

- Optimized Google & GitHub login speed with single-shot upsert and non-blocking background sync (`5dcfdfa`)

### 🐛 Fixes

- Fixed registration welcome email dispatch and ObjectId casting (`1f08672`)
- Ensured reliable welcome email delivery for Google OAuth signups (`1944229`)
- Wired welcome emails to OAuth signups and optimized Gmail transport (`5bc6e9c`)
- Fixed infinite loading on test suite detail page and improved breadcrumb navigation (`30f44dd`)

---

## [1.4.0] — Content & Documentation Pages

### ✨ Features

- Enterprise Help Center redesign (`9fa0c93`)
- API Reference redesign with 3-part layout, real endpoints, and Try It console (`1b79ce8`)
- Best Practices page with 3-column QA doc layout and interactive checklist (`13303ad`)
- About page redesign with QA platform positioning and workflow pipeline (`5399b8a`)
- Terms & Conditions and legal documentation hub redesign (`5fbfb50`)
- Dedicated enterprise settings page (`1498f79`)

### 🐛 Fixes

- Optimized mobile footer layout with 2-column link grid and typography (`62c9c5e`)
- Made user profile footer clickable with account menu and modal (`c3b183d`)
- Opened test suite workbench directly from history and sidebar (`c248a82`)
- Used dynamic window origin for share links with `/suites/:id` redirect (`1f892ee`)

### 🔧 Refactor

- Replaced AI sparkle symbols with mature QA and engineering icons (`5be4771`)
- Polished test-suite UX to enterprise QA standards (`bae0345`)

---

## [1.3.0] — Enterprise UI Overhaul

### ✨ Features

- Modernized workspace and IA to enterprise QA standards (`9f9e85f`)
- Overhauled entire website to true neutral black design system (`29c3685`)
- Complete multi-breakpoint responsive design engine (mobile, tablet, desktop) (`ec8e25b`)
- Separated marketing and application navigation with collapsible enterprise shell (`6f6a259`)
- AI Workspace moved into full-screen overlay modal (`a82f9c5`)

### 🎨 Style

- Updated Hero showcase, FinalCTA component, and styling enhancements (`67bede3`)
- Enterprise output UI with master-detail table, detail pane, coverage, risks, and traceability (`e4e7074`)
- Unified 1240px global grid, editorial layouts, and vertical rhythm pass (`6caae76`)
- Complete landing page redesign (`d0962d5`)

### 🐛 Fixes

- Removed top demo workbench box from Hero section (`6c85881`)
- Fixed navbar overlap and alignment (`9fc1c5c`)

---

## [1.2.0] — AI Accuracy & Test Quality

### ✨ Features

- Expanded test case schema to 13-field industry standard format (`fa20a6c`)
- Strict JSON schema + table UI for test cases (`934891c`)
- Structured steps enforcement in AI prompt with clean table render (`f9dc372`)
- Real Coverage Analytics dashboard replacing cosmetic quality scores (`f13105c`)
- Premium 3D waving gravity mesh background animation (`66aecb2`)

### 🐛 Fixes

- Fixed Two-Step Orchestrator AI prompt for proper API test case generation (`b30c2a0`)
- Fixed API generation count, case-sensitivity in prompts, and UI mapping (`b69bbf2`)
- Fixed copy to clipboard functionality in test case cards (`54b2089`)
- Fixed API backend generation count and prompt mapping (`11a9f3a`)
- UI sync bug for apiChecklist and enforced QA standards in AI output (`3de3510`)

### 🔧 Refactor

- Replaced accordion with tab switcher — one output on screen at a time (`de64b5e`)
- True accordion behavior for generation history — one version open at a time (`34cb68d`)
- Regenerate now preserves previous output as versioned history (`401efda`)

---

## [1.1.0] — Auth & Profile System

### ✨ Features

- Secure forgot and reset password flow (`5b68bf9`)
- Input quality validation, AI fallback, and mobile responsiveness (`0cda97e`)
- Smooth scroll-reveal animations (`4e93df1`)
- Persistent history and profile stats synced with database (`663ece9`)
- Login tracking, provider storage, and TestHistory collection (`6a3d97f`)
- Advanced navbar profile avatar dropdown (`ad877c2`)
- Full-featured account center and restyled navbar (`606c25c`)

### 🐛 Fixes

- Welcome email issue for Google and Manual login (`4abe47c`)
- Guest generation limit enforcement on refinement actions (`ac5b732`)
- JWT tokens bound to API service fetch requests for cross-platform history (`9c5ff3d`)
- Full test data stored and synced in history across devices (`643d0a3`)
- JSON download — structured, readable output with metadata (`4fa8483`)
- Hide hamburger menu icon on desktop navbar (`5f3606a`)

### 🎨 Style

- Modernized navbar profile icon and dropdown menu (`57e2259`)
- Improved profile modal layout for mobile/tablet responsiveness (`03759c9`)

---

## [1.0.0] — Initial Release

### ✨ Features

- AI-powered test case generation from product requirements
- Multi-category output (Functional, Negative, Edge Case, API)
- Landing page with Hero, Features, How It Works, and CTA sections
- Basic authentication (email/password)
- Google and GitHub OAuth integration
- Export to JSON and Markdown
- Comprehensive README with Mermaid architecture diagrams

---

### 🏗️ Infrastructure

- Docker multi-stage builds for frontend (Nginx) and backend (Node.js)
- Kubernetes manifests for Minikube deployment
- AWS EKS production deployment support
- Prometheus + Grafana monitoring stack
- GitHub Actions CI/CD pipeline
- Vercel frontend deployment configuration

---

*Last updated: September 2026*
