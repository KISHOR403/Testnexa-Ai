# Testnexa AI — Requirement Traceability & Coverage Specification

This document defines the mathematical models, coverage metrics, status definitions, gap discovery rules, and matrix representation for Requirement Traceability in Testnexa AI.

---

## 1. Core Coverage Metrics

Traceability replaces the ambiguous concept of "covered" with two mathematically distinct, mutually exclusive metrics:

### A. Linked % (Design Coverage)
The proportion of requirements that have at least one test case explicitly associated with them.
$$\text{Linked \%} = \begin{cases} \left\lfloor \frac{\text{Covered Requirements}}{\text{Total Requirements}} \times 100 \right\rceil & \text{if } \text{Total Requirements} > 0 \\ 0 & \text{if } \text{Total Requirements} = 0 \end{cases}$$
* **Covered Requirements:** Any requirement where `linked_test_count \ge 1`.
* **Interpretation:** Indicates test design completeness. 100% Linked means every requirement has at least one scenario designed to validate it.

### B. Verified % (Execution Verification)
The proportion of requirements whose associated test cases have **all** been executed in a test run and **all passed**.
$$\text{Verified \%} = \begin{cases} \left\lfloor \frac{\text{Verified Requirements}}{\text{Total Requirements}} \times 100 \right\rceil & \text{if } \text{Total Requirements} > 0 \\ 0 & \text{if } \text{Total Requirements} = 0 \end{cases}$$
* **Interpretation:** Indicates production readiness. A suite can have 100% Linked tests while having 0% Verified requirements if no test execution runs have taken place.

> **Rule:** The UI must never display "Covered" without explicitly distinguishing whether it refers to **Linked** or **Verified**.

---

## 2. Mutually Exclusive Requirement Status Buckets

Every requirement in a suite belongs to **exactly one** of the following five states at any point in time. The sum of the counts across these five states **always equals the Total Requirements count**:

$$\text{Total} = \text{Verified} + \text{Partial} + \text{Failing} + \text{Unverified} + \text{Uncovered}$$

| Status | Condition | Meaning | Visual Pill |
| :--- | :--- | :--- | :--- |
| **Verified** | $\text{linked} > 0 \land \text{executed} = \text{linked} \land \text{passed} = \text{linked}$ | All linked tests executed and passed. | Outline with check icon (`CheckCircle2`) |
| **Partial** | $\text{linked} > 0 \land \text{failed} = 0 \land \text{executed} > 0 \land \text{passed} < \text{linked}$ | Tests partially executed (some pending or skipped), with 0 failures so far. | Dashed outline with minus icon (`MinusCircle`) |
| **Failing** | $\text{linked} > 0 \land \text{failed} > 0$ | At least one linked test case has failed during execution. | Double outline with X icon (`XCircle`) |
| **Unverified** | $\text{linked} > 0 \land \text{executed} = 0$ | Test cases are designed and linked, but 0 have been executed. | Muted outline with clock icon (`Clock`) |
| **Uncovered** | $\text{linked} = 0$ | No test cases are linked to this requirement specification. | Outline with alert icon (`AlertCircle`) |

---

## 3. Requirement Sources & Auditability

Requirements in Testnexa AI are first-class entities with an explicit `source` provenance:

1. **`extracted` (Spec-derived):**
   - Extracted directly from the user's specification input text during generation.
   - Includes `source_quote`: The exact verbatim excerpt or substring from the specification that justifies the requirement.
   - Displayed with source tag: `Extracted`.

2. **`derived` (Backfilled / Inferred):**
   - Inferred from test case names, IDs, or legacy suite summaries when explicit requirement records were not generated.
   - Displayed with source tag: `Derived`.
   - The UI displays an explicit warning notice: *"Derived from test labels. Review."* Derived requirements are never falsely presented as if they came from the original specification.

3. **`manual` (User-authored or Edited):**
   - Created manually or modified by a user in the UI (e.g. edited title, description, or priority).
   - Generates an audit trail entry logging the user ID, timestamp, and field changes.
   - Displayed with source tag: `Manual`.

---

## 4. Gaps Calculation Rules

The `/traceability/gaps` endpoint computes actionable insights using deterministic rules:

1. **Uncovered Requirements (`uncovered`):**
   - Condition: Requirements where `linkedCount === 0`.
   - Action: `Add tests`
2. **Single-Test Coverage (`single_test`):**
   - Condition: Requirements where `linkedCount === 1` and priority is `High` or `Critical`.
   - Action: `Review` (recommends adding edge/negative scenarios).
3. **Missing Negative or Security Coverage (`missing_negative_or_security`):**
   - Condition: High-priority requirement where none of the linked test cases have type `Negative` or `Security`.
   - Action: `Add tests` (suggests generating adversarial inputs).
4. **Unmapped Test Cases (`unlinked_tests`):**
   - Condition: Test cases in the suite that do not link to any requirement ID.
   - Action: `Link` (opens mapping dialog).
5. **Failing Requirements (`failing`):**
   - Condition: Requirements where `failedCount > 0`.
   - Action: `Open` (filters table to failing requirements for immediate inspection).

---

## 5. Traceability Matrix Visual Symbols

The Matrix view adheres to a strict black-and-white theme. Cell state is **never conveyed by color alone**, relying exclusively on monochrome shapes:

| State | Glyph | Visual Representation | Meaning |
| :--- | :---: | :--- | :--- |
| **Passed** | `✓` | Check mark | Linked test executed and passed |
| **Failed** | `✕` | Cross mark | Linked test executed and failed |
| **Not Executed** | `○` | Hollow circle | Linked test has not yet run |
| **Linked** | `●` | Solid white circle | Linked test (generic / active) |
| **Not Linked** | *empty* | Clean space (no glyph) | Test case does not apply to this requirement |

### Hover & Keyboard Navigation
- Hovering or focusing a matrix cell opens a tooltip containing:
  - Requirement Key & Title
  - Test Case ID & Title
  - Rationale ("Why this test exists")
  - Execution Outcome
- Clicking a cell highlights both its entire row and column, and opens the detail drawer.
