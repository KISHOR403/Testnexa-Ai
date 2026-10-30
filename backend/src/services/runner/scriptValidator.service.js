const vm = require('vm');
const automationInventory = require('./automationInventory.service');

// Prohibited APIs and security keywords
const PROHIBITED_SECURITY_PATTERNS = [
    { pattern: /\b(child_process|exec|execSync|spawn|spawnSync|fork)\b/, reason: 'Process execution and shell spawning are strictly prohibited.' },
    { pattern: /\b(process\.exit|process\.kill|process\.binding|process\.env)\b/, reason: 'Direct process control and environment secret access are prohibited.' },
    { pattern: /\bfs\.(unlink|rmdir|rm|write|append|createWriteStream)\b/, reason: 'Destructive filesystem write operations are prohibited.' },
    { pattern: /\b(require\s*\(\s*['"]fs['"]\s*\)|require\s*\(\s*['"]child_process['"]\s*\))\b/, reason: 'Dynamic imports of system modules are prohibited.' },
    { pattern: /\b(eval\s*\(|new\s+Function\s*\()/, reason: 'Dynamic eval and arbitrary Function constructors are prohibited in test scripts.' },
    { pattern: /\b(__dirname|__filename|process\.cwd\(\))/, reason: 'Host server path inspection is restricted.' }
];

class ScriptValidatorService {
    /**
     * Comprehensive static validation of an automation script configuration
     */
    validateConfiguration({
        scriptSource = 'custom', // 'existing' | 'custom'
        scriptRef = '',
        automationTestId = '',
        scriptCode = '',
        framework = 'playwright',
        targetEnvironment = null,
        executionTimeout = 30000
    }) {
        const errors = [];
        const warnings = [];

        // 1. Framework check
        if (framework && framework.toLowerCase() !== 'playwright') {
            errors.push(`Unsupported framework "${framework}". Only Playwright is currently supported.`);
        }

        // 2. Automation Test ID check
        if (!automationTestId || !automationTestId.trim()) {
            errors.push('Automation Test ID is required.');
        } else if (!/^[a-zA-Z0-9_\-#.]+$/.test(automationTestId.trim())) {
            errors.push('Automation Test ID must only contain alphanumeric characters, hyphens, underscores, dots, or hash (#).');
        }

        // 3. Execution Timeout validation
        const timeoutNum = parseInt(executionTimeout, 10);
        if (isNaN(timeoutNum) || timeoutNum < 1000) {
            errors.push('Execution timeout must be at least 1000ms (1 second).');
        } else if (timeoutNum > 120000) {
            errors.push('Execution timeout cannot exceed 120000ms (2 minutes) to prevent runaway worker sessions.');
        }

        // 4. Source-specific validation
        if (scriptSource === 'existing') {
            if (!scriptRef || !scriptRef.trim()) {
                errors.push('Script reference is required when using an existing approved automation script.');
            } else {
                const check = automationInventory.verifyScriptReference(scriptRef.trim(), automationTestId.trim());
                if (!check.exists) {
                    errors.push(check.error);
                } else if (!check.test.code) {
                    warnings.push('The referenced test file does not define a standalone code snippet; it will execute via test runner identifier.');
                }
            }
        } else {
            // Custom Automation Script Validation
            if (!scriptCode || !scriptCode.trim()) {
                errors.push('Script code cannot be empty for custom automation scripts.');
            } else {
                const trimmed = scriptCode.trim();

                // Security pattern audit
                for (const sec of PROHIBITED_SECURITY_PATTERNS) {
                    if (sec.pattern.test(trimmed)) {
                        errors.push(`Security Violation: ${sec.reason}`);
                    }
                }

                // JavaScript Syntax Validation using isolated Node vm.Script parsing
                try {
                    let parseTarget = trimmed;
                    if (trimmed.startsWith('async') || trimmed.startsWith('(') || trimmed.startsWith('function')) {
                        parseTarget = `(${trimmed})`;
                    } else {
                        parseTarget = `async function validateWrapper(page, expect, context) {\n${trimmed}\n}`;
                    }

                    new vm.Script(parseTarget, { filename: 'custom_script_validation.js' });
                } catch (syntaxErr) {
                    errors.push(`JavaScript Syntax Error: ${syntaxErr.message}`);
                }

                // Check Playwright signature expectations
                if (!trimmed.includes('page') && !trimmed.includes('expect')) {
                    warnings.push('The custom script does not appear to reference "page" or "expect". Verify your Playwright automation logic.');
                }

                // Check for hardcoded credentials or passwords
                if (/password\s*[:=]\s*['"][^'"]{6,}['"]/i.test(trimmed) && !trimmed.includes('[Approved Test Password]')) {
                    warnings.push('Potential hardcoded password detected in custom script body. Use approved test fixture credentials or environment variables.');
                }
            }
        }

        // 5. Target environment check
        if (!targetEnvironment) {
            warnings.push('No target environment assigned; test will default to workspace default staging URL.');
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            validatedAt: new Date().toISOString()
        };
    }
}

module.exports = new ScriptValidatorService();
