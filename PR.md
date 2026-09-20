# Pull Request

## Description

<!-- Provide a clear, concise summary of the changes in this PR. -->

**What does this PR do?**

<!-- Explain the problem being solved or the feature being added. -->

**Why is this change needed?**

<!-- Link to related issue(s), user stories, or product requirements. -->

Closes #<!-- issue number -->

---

## Type of Change

<!-- Check all that apply. -->

- [ ] 🐛 **Bug Fix** — Non-breaking change that fixes an issue
- [ ] ✨ **New Feature** — Non-breaking change that adds functionality
- [ ] 💥 **Breaking Change** — Fix or feature that would cause existing functionality to not work as expected
- [ ] 🔧 **Refactor** — Code restructuring without functional changes
- [ ] 🎨 **Style/UI** — Visual or CSS-only changes
- [ ] 📝 **Documentation** — Updates to docs, comments, or README
- [ ] ⚡ **Performance** — Optimization or speed improvement
- [ ] 🧪 **Tests** — Adding or updating tests
- [ ] 🏗️ **Infrastructure** — CI/CD, Docker, Kubernetes, or deployment changes

---

## Changes Made

### Frontend
<!-- List frontend changes, or write "N/A" -->
- 

### Backend
<!-- List backend changes, or write "N/A" -->
- 

### Database
<!-- List schema or migration changes, or write "N/A" -->
- 

### Infrastructure
<!-- List Docker, K8s, CI/CD changes, or write "N/A" -->
- 

---

## Screenshots / Recordings

<!-- If this PR includes UI changes, attach before/after screenshots or a screen recording. -->

| Before | After |
|--------|-------|
|        |       |

---

## Testing

### How was this tested?

<!-- Describe the tests you ran to verify your changes. -->

- [ ] Unit tests pass (`npm test`)
- [ ] E2E tests pass
- [ ] Manual testing on desktop (Chrome, Firefox, Edge)
- [ ] Manual testing on mobile viewport
- [ ] API tested via Postman/curl
- [ ] No console errors or warnings

### Test Configuration

- **Node.js version:** v20.x
- **Browser(s):** Chrome, Firefox
- **OS:** Windows / macOS / Linux

---

## Checklist

### Code Quality
- [ ] My code follows the project's coding conventions
- [ ] I have performed a self-review of my code
- [ ] I have commented my code in hard-to-understand areas
- [ ] My changes generate no new warnings or errors
- [ ] I have removed all `console.log` debugging statements

### Documentation
- [ ] I have updated the relevant documentation (if applicable)
- [ ] I have updated the `docs/CHANGELOG.md` (if applicable)

### Security
- [ ] No API keys, secrets, or credentials are committed
- [ ] Input validation is applied to any new user inputs
- [ ] New endpoints have appropriate authentication middleware (`protect` / `optionalProtect`)
- [ ] Rate limiting is applied to any new public-facing endpoints

### Database
- [ ] Schema changes are backward-compatible (or migration plan is included)
- [ ] New queries use appropriate indexes
- [ ] No N+1 query issues introduced

### Deployment
- [ ] Environment variables are documented in `.env.example`
- [ ] Docker builds are tested locally (`docker build`)
- [ ] Kubernetes manifests are updated (if applicable)

---

## Additional Context

<!-- Add any other context, design decisions, or trade-offs about the PR here. -->

---

## Reviewer Notes

<!-- Anything specific you'd like reviewers to focus on? -->

- [ ] Please review the AI prompt changes carefully
- [ ] Please verify the auth flow edge cases
- [ ] Please check mobile responsiveness
