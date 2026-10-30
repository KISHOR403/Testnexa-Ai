const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');

/**
 * Automation Inventory Service
 * Discovers and exposes approved project-owned Playwright automation test suites and test identifiers.
 */
class AutomationInventoryService {
    constructor() {
        this.baseDirs = [
            path.resolve(__dirname, '../../../../tests/e2e'),
            path.resolve(__dirname, '../../../tests/e2e'),
            path.resolve(__dirname, '../../e2e'),
            path.resolve(process.cwd(), 'tests/e2e'),
            path.resolve(process.cwd(), '../tests/e2e'),
            path.resolve(process.cwd(), 'e2e'),
            path.resolve(process.cwd(), '../e2e')
        ];
    }

    /**
     * List all approved Playwright test suites and their registered tests
     */
    listApprovedSuites() {
        const suites = [];
        const seenFiles = new Set();

        for (const dir of this.baseDirs) {
            if (!fs.existsSync(dir)) continue;

            try {
                const files = fs.readdirSync(dir).filter(f => f.endsWith('.spec.js') || f.endsWith('.test.js'));
                for (const file of files) {
                    const fullPath = path.join(dir, file);
                    const relPath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');

                    if (seenFiles.has(relPath)) continue;
                    seenFiles.add(relPath);

                    try {
                        // Safe load of approved module definition
                        delete require.cache[require.resolve(fullPath)];
                        const mod = require(fullPath);

                        if (mod && Array.isArray(mod.tests)) {
                            suites.push({
                                file: relPath,
                                filename: file,
                                module: mod.module || path.basename(file, path.extname(file)),
                                framework: mod.framework || 'playwright',
                                version: mod.version || '1.0.0',
                                testsCount: mod.tests.length,
                                tests: mod.tests.map(t => ({
                                    testId: t.testId,
                                    title: t.title,
                                    version: t.version || mod.version || '1.0.0',
                                    scriptRef: `${relPath}#${t.testId}`,
                                    code: t.code || (typeof t.fn === 'function' ? t.fn.toString() : '')
                                }))
                            });
                        }
                    } catch (loadErr) {
                        logger.warn(`Failed to inspect approved test suite ${relPath}:`, loadErr.message);
                    }
                }
            } catch (scanErr) {
                logger.warn(`Failed to scan automation directory ${dir}:`, scanErr.message);
            }
        }

        return suites;
    }

    /**
     * Find a specific approved test by script reference or test identifier
     */
    findTest(scriptRef, testId = null) {
        if (!scriptRef) return null;

        let targetFile = scriptRef;
        let targetId = testId;

        if (scriptRef.includes('#')) {
            const parts = scriptRef.split('#');
            targetFile = parts[0];
            targetId = targetId || parts[1];
        }

        const normalizedFile = targetFile.replace(/\\/g, '/');
        const suites = this.listApprovedSuites();

        for (const suite of suites) {
            if (suite.file === normalizedFile || suite.file.endsWith(normalizedFile) || normalizedFile.endsWith(suite.file)) {
                if (targetId) {
                    const found = suite.tests.find(t => t.testId === targetId || t.title === targetId);
                    if (found) {
                        return {
                            ...found,
                            suiteFile: suite.file,
                            framework: suite.framework,
                            suiteVersion: suite.version
                        };
                    }
                } else if (suite.tests.length > 0) {
                    return {
                        ...suite.tests[0],
                        suiteFile: suite.file,
                        framework: suite.framework,
                        suiteVersion: suite.version
                    };
                }
            }
        }

        return null;
    }

    /**
     * Validate whether an approved script reference exists
     */
    verifyScriptReference(scriptRef, testId = null) {
        const found = this.findTest(scriptRef, testId);
        if (!found) {
            return {
                exists: false,
                error: `Approved Playwright script not found for reference: "${scriptRef}". Ensure the file and test identifier exist in the project inventory.`
            };
        }
        return {
            exists: true,
            test: found
        };
    }
}

module.exports = new AutomationInventoryService();

