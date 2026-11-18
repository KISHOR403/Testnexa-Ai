import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const contentDir = path.join(rootDir, 'content', 'help');
const helpIndexPath = path.join(rootDir, 'frontend', 'content', 'help-index.json');
const distHelpDir = path.join(rootDir, 'dist', 'help');
const helpCssPath = path.join(rootDir, 'frontend', 'styles', 'HelpPage.css');

describe('Help Center Architecture & Content Verification', () => {

    test('1. Typed Index & Content Count', () => {
        assert.ok(fs.existsSync(helpIndexPath), 'help-index.json must exist');
        const indexData = JSON.parse(fs.readFileSync(helpIndexPath, 'utf8'));

        assert.equal(indexData.totalArticles, 13, 'Must contain exactly 13 help articles');
        assert.ok(indexData.categories.length >= 8, 'Must have at least 8 structured categories');

        const slugs = indexData.articles.map(a => a.slug);
        const expectedSlugs = [
            'create-your-first-test-suite',
            'review-and-approve-cases',
            'linked-vs-verified-coverage',
            'risks',
            'recommendations',
            'export-formats',
            'github-actions-setup',
            'data-and-privacy',
            'account-and-sessions',
            'test-execution',
            'troubleshooting',
            'glossary',
            'whats-new'
        ];

        for (const expected of expectedSlugs) {
            assert.ok(slugs.includes(expected), `Index must contain slug "${expected}"`);
        }
    });

    test('2. Frontmatter Completeness and Validity', () => {
        const indexData = JSON.parse(fs.readFileSync(helpIndexPath, 'utf8'));
        const slugSet = new Set(indexData.articles.map(a => a.slug));

        for (const article of indexData.articles) {
            assert.ok(article.title && article.title.length > 5, `Article ${article.slug} must have a valid title`);
            assert.ok(article.description && article.description.length > 15, `Article ${article.slug} must have description`);
            assert.ok(article.category, `Article ${article.slug} must specify category`);
            assert.ok(typeof article.order === 'number', `Article ${article.slug} order must be number`);
            assert.match(article.updated, /^\d{4}-\d{2}-\d{2}$/, `Article ${article.slug} updated date must be YYYY-MM-DD`);
            assert.ok(Array.isArray(article.keywords) && article.keywords.length > 0, `Article ${article.slug} must have keywords`);
            assert.ok(Array.isArray(article.related), `Article ${article.slug} must have related array`);

            // Verify related slugs exist
            for (const rel of article.related) {
                assert.ok(slugSet.has(rel), `Related slug "${rel}" referenced in "${article.slug}" must exist`);
            }
        }
    });

    test('3. Absence of Retired Forbidden Phrases & Brand Name Consistency', () => {
        const forbiddenPhrases = [
            'restore previous sessions',
            'snapshots',
            'saved to your workspace history automatically'
        ];
        const forbiddenBrandSpellings = [
            'TestNexa',
            'TESTNEXA AI'
        ];

        function checkFolder(dir) {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    checkFolder(fullPath);
                } else if (entry.name.endsWith('.mdx') || entry.name.endsWith('.md')) {
                    const content = fs.readFileSync(fullPath, 'utf8');

                    for (const phrase of forbiddenPhrases) {
                        assert.ok(
                            !content.toLowerCase().includes(phrase.toLowerCase()),
                            `File ${entry.name} must NOT contain retired phrase "${phrase}"`
                        );
                    }

                    for (const spelling of forbiddenBrandSpellings) {
                        assert.ok(
                            !content.includes(spelling),
                            `File ${entry.name} must NOT contain brand spelling "${spelling}". Must be "Testnexa".`
                        );
                    }
                }
            }
        }

        checkFolder(contentDir);
    });

    test('4. Core Product Truths Reflected in Documentation', () => {
        const indexData = JSON.parse(fs.readFileSync(helpIndexPath, 'utf8'));

        // 1. Stateless generation / nothing stored until generated
        const firstSuite = indexData.articles.find(a => a.slug === 'create-your-first-test-suite');
        assert.ok(firstSuite.rawBody.toLowerCase().includes('stateless'), 'Must document stateless generation');
        assert.ok(firstSuite.rawBody.toLowerCase().includes('nothing is stored'), 'Must document nothing is stored until generated');

        // 2. Pending test case lifecycle
        const reviewCases = indexData.articles.find(a => a.slug === 'review-and-approve-cases');
        assert.ok(reviewCases.rawBody.includes('Pending'), 'Must document Pending review status');

        // 3. Linked vs Verified coverage separation
        const coverageGuide = indexData.articles.find(a => a.slug === 'linked-vs-verified-coverage');
        assert.ok(coverageGuide.rawBody.includes('Linked Coverage') && coverageGuide.rawBody.includes('Verified Coverage'), 'Must define both coverage metrics');

        // 4. Test execution status (coming soon)
        const executionGuide = indexData.articles.find(a => a.slug === 'test-execution');
        assert.ok(executionGuide.rawBody.toLowerCase().includes('coming soon'), 'Must document test execution is coming soon');
    });

    test('5. Search Indexing Logic & Keyword Matching', () => {
        const indexData = JSON.parse(fs.readFileSync(helpIndexPath, 'utf8'));

        function search(query) {
            const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
            return indexData.articles.map(art => {
                let score = 0;
                const titleLower = art.title.toLowerCase();
                const descLower = art.description.toLowerCase();
                const kwStr = (art.keywords || []).join(' ').toLowerCase();
                const headingsStr = (art.toc || []).map(t => t.title).join(' ').toLowerCase();
                const snippet = (art.searchTokens?.snippet || '').toLowerCase();

                for (const term of terms) {
                    if (titleLower.includes(term)) score += 10;
                    if (descLower.includes(term)) score += 5;
                    if (kwStr.includes(term)) score += 6;
                    if (headingsStr.includes(term)) score += 4;
                    if (snippet.includes(term)) score += 2;
                }
                return { article: art, score };
            }).filter(item => item.score > 0).sort((a, b) => b.score - a.score);
        }

        // Title search
        const titleMatch = search('Linked vs Verified');
        assert.ok(titleMatch.length > 0, 'Must match title query');
        assert.equal(titleMatch[0].article.slug, 'linked-vs-verified-coverage');

        // Heading search
        const headingMatch = search('risk matrix');
        assert.ok(headingMatch.length > 0, 'Must match heading query');
        assert.equal(headingMatch[0].article.slug, 'risks');

        // Keyword search
        const kwMatch = search('playwright');
        assert.ok(kwMatch.length > 0, 'Must match keyword query');
        assert.ok(kwMatch.some(m => m.article.slug === 'export-formats'));

        // Zero results
        const emptyMatch = search('xyznonexistentquery123');
        assert.equal(emptyMatch.length, 0, 'Non-existent term must return 0 results');
    });

    test('6. Static Pre-rendered HTML & SEO Artifacts', () => {
        assert.ok(fs.existsSync(distHelpDir), 'dist/help directory must exist');

        const hubHtml = fs.readFileSync(path.join(distHelpDir, 'index.html'), 'utf8');
        assert.ok(hubHtml.includes('<title>Help Center &amp; Documentation | Testnexa</title>') || hubHtml.includes('Help Center'), 'Hub must have correct title');
        assert.ok(hubHtml.includes('https://schema.org') && hubHtml.includes('FAQPage'), 'Hub must have FAQPage JSON-LD');
        assert.ok(hubHtml.includes('rel="canonical" href="https://testnexa.ai/help"'), 'Hub must have canonical URL');

        // Check article HTML
        const articleHtmlPath = path.join(distHelpDir, 'getting-started', 'create-your-first-test-suite', 'index.html');
        assert.ok(fs.existsSync(articleHtmlPath), 'Article pre-rendered HTML must exist');
        const articleHtml = fs.readFileSync(articleHtmlPath, 'utf8');
        assert.ok(articleHtml.includes('<title>Create your first test suite | Testnexa Docs</title>'));
        assert.ok(articleHtml.includes('TechArticle'), 'Article must include TechArticle JSON-LD');
        assert.ok(articleHtml.includes('prerendered-content'), 'Article must include pre-rendered noscript HTML');
    });

    test('7. Strict Monochrome CSS Compliance', () => {
        assert.ok(fs.existsSync(helpCssPath), 'HelpPage.css must exist');
        const css = fs.readFileSync(helpCssPath, 'utf8');

        // Verify strict tokens
        assert.ok(css.includes('--help-bg: #000000;'), 'Must define pure black bg token');
        assert.ok(css.includes('--help-surface: #0A0A0A;'), 'Must define surface token');
        assert.ok(css.includes('--help-surface-2: #111111;'), 'Must define surface-2 token');

        // Disallowed color hex codes
        const forbiddenHexCodes = [
            '#8BAF9A', '#8baf9a', // legacy jade green
            '#3B82F6', '#3b82f6', // blue
            '#10B981', '#10b981', // green
            '#EF4444', '#ef4444', // red
            '#F59E0B', '#f59e0b', // amber
            '#06B6D4', '#06b6d4'  // cyan
        ];

        for (const hex of forbiddenHexCodes) {
            assert.ok(!css.includes(hex), `HelpPage.css must NOT contain colored hex ${hex}`);
        }
    });
});
