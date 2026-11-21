/**
 * TestNexa AI — Playwright Suite Export & Workflow Template Service
 *
 * Design Principle:
 * - Testnexa does NOT run tests.
 * - Customer's own GitHub Actions runner executes the exported Playwright suite.
 * - Every exported test MUST start with its case key in brackets: `[TC_...] <Title>`
 * - Ingestion matches output back to test cases via regex: /^\[([A-Z]{2,5}(?:_[A-Z0-9]+)+)\]/
 */

const { SUITE_CASE_KEYS, unwrapSuiteData } = require('../../utils/testCaseManagement.validation');

class PipelineExportService {
    /**
     * Generates a complete, ready-to-run Playwright .spec.js file for a test suite.
     * Ensures every test title begins with `[<TC_KEY>] <Title>` for unambiguous mapping.
     */
    generatePlaywrightSuiteCode(session, options = {}) {
        if (!session) throw new Error('Test suite session is required');

        const approvedFilter = String(options.approved || 'only').toLowerCase(); // 'only' | 'include_pending'
        const suiteData = unwrapSuiteData(session);
        const suiteTitle = session.title || suiteData.testSuiteName || suiteData.feature || 'Test Suite';
        const safeSuiteTitle = suiteTitle.replace(/['"\\]/g, '\\$&');

        // Extract test cases
        const cases = [];
        const seenIds = new Set();
        let totalEncountered = 0;
        let skippedCount = 0;

        SUITE_CASE_KEYS.forEach(category => {
            const list = suiteData[category];
            if (Array.isArray(list)) {
                list.forEach(item => {
                    if (!item || typeof item !== 'object') return;
                    const id = String(item.id || item.testCaseId || '').trim();
                    if (!id || seenIds.has(id)) return;
                    seenIds.add(id);
                    totalEncountered++;

                    const approvalStatus = String(item.approval_status || (item.is_approved ? 'approved' : 'pending')).toLowerCase();

                    // Rule 1: Rejected cases are NEVER exported under any circumstance
                    if (approvalStatus === 'rejected') {
                        skippedCount++;
                        return;
                    }

                    // Rule 2: If approved='only', only include explicitly approved cases
                    if (approvedFilter === 'only' && approvalStatus !== 'approved') {
                        skippedCount++;
                        return;
                    }

                    // Rule 3: If approved='include_pending', include approved and pending cases
                    cases.push({
                        id,
                        title: String(item.title || item.testScenario || item.name || 'Untitled Scenario').trim(),
                        category: item.type || item.category || category,
                        priority: item.priority || 'Medium',
                        preconditions: item.preconditions || '',
                        steps: Array.isArray(item.steps) ? item.steps : (item.steps ? [String(item.steps)] : []),
                        expectedResult: item.expectedResult || item.expected || '',
                        automationMapping: item.automationMapping || item.playwrightBinding || null,
                        approvalStatus
                    });
                });
            }
        });

        // Build file content
        const lines = [
            `// ==============================================================================`,
            `// TestNexa AI — Exported Playwright Test Suite`,
            `// Suite: ${suiteTitle}`,
            `// Total Scenarios: ${cases.length}`,
            `// Notice: Test titles contain bracketed case keys [TC_...] for CI result ingestion.`,
            `// ==============================================================================`,
            ``,
            `import { test, expect } from '@playwright/test';`,
            ``,
            `test.describe('${safeSuiteTitle}', () => {`
        ];

        if (cases.length === 0) {
            lines.push(`    test('[TC_EMPTY_001] Placeholder Scenario', async ({ page }) => {`);
            lines.push(`        // No test cases defined in this suite yet.`);
            lines.push(`        expect(true).toBe(true);`);
            lines.push(`    });`);
        } else {
            cases.forEach(tc => {
                const safeCaseTitle = tc.title.replace(/['"\\]/g, '\\$&');
                // Crucial requirement: test title begins with [<CASE_KEY>]
                const testDeclaration = `    test('[${tc.id}] ${safeCaseTitle}', async ({ page }) => {`;
                lines.push(testDeclaration);

                if (tc.preconditions) {
                    const precondStr = Array.isArray(tc.preconditions) ? tc.preconditions.join('; ') : String(tc.preconditions);
                    lines.push(`        // Preconditions: ${precondStr.replace(/\n/g, ' ')}`);
                }

                if (tc.steps && tc.steps.length > 0) {
                    lines.push(`        // Steps:`);
                    tc.steps.forEach((st, idx) => {
                        const stepText = typeof st === 'object' ? `${st.action || ''} -> ${st.expected || ''}` : String(st);
                        lines.push(`        //   ${idx + 1}. ${stepText.replace(/\n/g, ' ')}`);
                    });
                }

                if (tc.expectedResult) {
                    lines.push(`        // Expected: ${tc.expectedResult.replace(/\n/g, ' ')}`);
                }

                // If user configured custom Playwright script code, embed it
                const customScript = tc.automationMapping?.scriptCode || tc.automationMapping?.code;
                if (customScript && typeof customScript === 'string' && customScript.trim()) {
                    lines.push(`        // Configured automation script:`);
                    // If it is an async function body
                    if (customScript.includes('async (page') || customScript.includes('async ({ page') || customScript.includes('test(')) {
                        lines.push(`        await (async () => {`);
                        customScript.split('\n').forEach(l => {
                            lines.push(`            ${l}`);
                        });
                        lines.push(`        })();`);
                    } else {
                        customScript.split('\n').forEach(l => {
                            lines.push(`        ${l}`);
                        });
                    }
                } else {
                    // Standard step assertions template
                    lines.push(`        // Standard verification template:`);
                    lines.push(`        await page.goto('/');`);
                    lines.push(`        await expect(page.locator('body')).toBeVisible();`);
                }

                lines.push(`    });`);
                lines.push(``);
            });
        }

        lines.push(`});`);
        lines.push(``);

        const codeString = lines.join('\n');
        const result = new String(codeString);
        result.specCode = codeString;
        result.exportedCount = cases.length;
        result.skippedCount = skippedCount;
        result.totalEncountered = totalEncountered;
        return result;
    }

    /**
     * Generates GitHub Actions workflow YAML strictly adhering to security and reporting rules:
     * - Pins actions to major versions (@v4)
     * - Uses PLAYWRIGHT_JSON_OUTPUT_NAME with --reporter=json
     * - Upload step uses `if: always()`
     * - Uses Idempotency-Key `${{ github.run_id }}-${{ github.run_attempt }}`
     * - Never embeds tokens (uses ${{ secrets.TESTNEXA_TOKEN }})
     */
    generateWorkflowYaml({ pipeline, suite, appUrl = 'https://app.testnexa.ai' }) {
        const branches = Array.isArray(pipeline?.branch_filters) && pipeline.branch_filters.length > 0
            ? pipeline.branch_filters
            : ['main'];
        const branchListStr = branches.map(b => `'${b}'`).join(', ');

        const triggers = pipeline?.triggers || { pull_request: true, push: true };
        const pipelineId = pipeline?.id || 'pipe_sample_id';
        const suiteId = pipeline?.suite_id || suite?.id || 'suite_sample_id';

        const onClauses = [];
        if (triggers.push) {
            onClauses.push(`  push:\n    branches: [ ${branchListStr} ]`);
        }
        if (triggers.pull_request) {
            onClauses.push(`  pull_request:\n    branches: [ ${branchListStr} ]`);
        }
        onClauses.push(`  workflow_dispatch:\n    inputs:\n      suite_id:\n        description: 'Testnexa Suite ID override'\n        required: false\n        default: '${suiteId}'`);

        return `# ==============================================================================
# TestNexa AI — Automated Playwright Verification Workflow
# Pipeline: ${pipeline?.name || 'Playwright CI Pipeline'}
# Linked Suite: ${suite?.title || suiteId}
# ==============================================================================

name: TestNexa Quality Gate

on:
${onClauses.join('\n')}

permissions:
  contents: read
  checks: write
  pull-requests: read

jobs:
  testnexa-e2e:
    name: Run Playwright Tests & Report to TestNexa
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install Dependencies
        run: |
          npm ci || npm install

      - name: Install Playwright Browsers
        run: |
          npx playwright install --with-deps chromium

      - name: Fetch Latest Test Suite from TestNexa (Optional)
        continue-on-error: true
        run: |
          mkdir -p tests/testnexa
          curl -s -f -H "Authorization: Bearer \${{ secrets.TESTNEXA_TOKEN }}" \\
            "${appUrl}/api/v1/pipelines/${pipelineId}/export" \\
            -o tests/testnexa/suite.spec.js || true

      - name: Execute Playwright Tests with JSON Reporter
        id: playwright-run
        run: |
          export PLAYWRIGHT_JSON_OUTPUT_NAME=results.json
          npx playwright test --reporter=json

      - name: Upload Test Report to TestNexa AI
        if: always()
        run: |
          if [ -f results.json ]; then
            echo "Posting Playwright results.json to TestNexa..."
            curl -s -X POST "${appUrl}/api/v1/ci/results" \\
              -H "Content-Type: application/json" \\
              -H "Authorization: Bearer \${{ secrets.TESTNEXA_TOKEN }}" \\
              -H "Idempotency-Key: \${{ github.run_id }}-\${{ github.run_attempt }}" \\
              -H "X-Commit-Sha: \${{ github.sha }}" \\
              -H "X-Branch: \${{ github.ref_name }}" \\
              -H "X-PR-Number: \${{ github.event.pull_request.number || '' }}" \\
              -H "X-Run-Url: \${{ github.server_url }}/\${{ github.repository }}/actions/runs/\${{ github.run_id }}" \\
              -H "X-Actor: \${{ github.actor }}" \\
              -d @results.json
          else
            echo "No results.json found to upload."
          fi

      - name: Archive Playwright Artifacts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-results
          path: |
            results.json
            playwright-report/
          retention-days: 14
`;
    }
}

module.exports = new PipelineExportService();
