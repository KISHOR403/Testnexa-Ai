# Roadmap — Testnexa AI

> Planned features, improvements, and long-term vision.

---

## Current State (September 2026)

Testnexa AI is a fully functional AI-powered QA test case generator with:
- ✅ Multi-category test generation (Functional, Negative, Edge, API)
- ✅ Google Gemini AI integration with Two-Step Orchestrator
- ✅ Full authentication system (Email, Google, GitHub OAuth)
- ✅ Persistent workspace sessions with versioning
- ✅ QA Copilot for coverage analysis
- ✅ Enterprise dark-theme UI with responsive design
- ✅ Docker + Kubernetes deployment
- ✅ CI/CD via GitHub Actions

---

## Short-Term (Next Release)

### 🧪 Test Automation Script Export

> Generate ready-to-run automation scripts from test cases.

- [ ] Export to Playwright test format
- [ ] Export to Cypress test format
- [ ] Export to Selenium/WebDriver format
- [ ] Export to Postman Collection (for API tests)
- [ ] Language selection (JavaScript, Python, Java)

### 👥 Team Collaboration

> Enable multi-user workspace sharing and collaboration.

- [ ] Team workspaces with role-based access
- [ ] Share test suites with team members (read/write permissions)
- [ ] Collaborative review and approval workflows
- [ ] Comment threads on individual test cases
- [ ] Activity feed for workspace changes

### 📊 Advanced Analytics Dashboard

> Deeper insights into test coverage and quality trends.

- [ ] Test coverage trend charts over time
- [ ] Generation quality score comparison across sessions
- [ ] Requirement complexity heatmaps
- [ ] Priority distribution analytics
- [ ] Export analytics reports as PDF

---

## Medium-Term (Q1 2027)

### 🔗 Test Management Tool Integration

> Direct sync with popular test management platforms.

- [ ] Jira integration (create test issues from generated cases)
- [ ] TestRail import/export
- [ ] Zephyr Scale integration
- [ ] Azure DevOps Test Plans sync
- [ ] qTest integration

### 🔄 CI/CD Pipeline Integration

> Embed test generation into development workflows.

- [ ] GitHub Actions plugin for automatic test generation on PR
- [ ] GitLab CI integration
- [ ] Jenkins pipeline step
- [ ] Webhook API for event-driven generation
- [ ] Auto-generate tests when requirement documents are updated

### 📝 Requirement Source Integration

> Import requirements directly from source systems.

- [ ] Import from Jira user stories/epics
- [ ] Import from Confluence pages
- [ ] Import from Google Docs
- [ ] Import from Notion pages
- [ ] Bulk file upload (PDF, DOCX, CSV)

### 🧠 AI Improvements

> Enhanced AI accuracy and capabilities.

- [ ] Multi-turn conversation for requirement refinement
- [ ] Custom AI model fine-tuning on user's domain
- [ ] Test case dependency graph (prerequisite chains)
- [ ] Regression test selection from codebase changes
- [ ] BDD/Gherkin output format (Given/When/Then)

---

## Long-Term (Q2–Q4 2027)

### 🌍 Multi-Language Support

> Internationalize the platform for global teams.

- [ ] UI localization (Spanish, German, French, Japanese, Hindi)
- [ ] Test case output in multiple languages
- [ ] Requirement input in any language (AI translation)
- [ ] RTL language support

### 🏢 Enterprise Features

> Enterprise-grade features for large organizations.

- [ ] SSO/SAML integration (Okta, Azure AD)
- [ ] Audit logging for compliance
- [ ] Custom data retention policies
- [ ] On-premise deployment option
- [ ] SLA-backed uptime guarantee
- [ ] Dedicated customer success manager

### 📱 Platform Expansion

> Extend beyond web-based access.

- [ ] VS Code extension for inline test generation
- [ ] CLI tool for terminal-based generation
- [ ] Slack/Teams bot for conversational test generation
- [ ] Mobile app (iOS/Android) for on-the-go review

### 🤖 Advanced AI Features

> Next-generation AI capabilities.

- [ ] Visual test generation from UI screenshots/mockups
- [ ] Codebase-aware test generation (analyze actual source code)
- [ ] Test maintenance AI (detect and update stale tests)
- [ ] Smart deduplication across test suites
- [ ] AI-powered test execution prediction (which tests to run)

---

## Community Wishlist

Features requested by users and the community:

| Request | Priority | Feasibility |
|---------|----------|-------------|
| Dark/Light theme toggle | Medium | Easy |
| Custom test case template editor | Medium | Medium |
| API rate limit increase for paid plans | High | Easy |
| Batch generation (multiple requirements) | High | Medium |
| Test case version diff view | Medium | Medium |
| Real-time collaboration (Google Docs-style) | Low | Hard |
| Self-hosted deployment guide | Medium | Medium |
| Webhook notifications (Slack, Discord) | Medium | Easy |

---

## Contributing

We welcome contributions! See [PR.md](../PR.md) for the pull request template and contribution guidelines.

**Priority areas for contributors:**
1. Frontend component tests (Playwright / Vitest)
2. Additional export formats
3. UI accessibility improvements
4. Documentation translations
5. Performance optimization

---

*Last updated: September 2026*
