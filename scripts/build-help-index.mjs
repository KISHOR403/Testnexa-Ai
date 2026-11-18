import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const contentDir = path.join(rootDir, 'content', 'help');
const outputDir = path.join(rootDir, 'frontend', 'content');
const publicDir = path.join(rootDir, 'public');

// Category metadata definitions
const CATEGORIES = {
    'getting-started': {
        id: 'getting-started',
        name: 'Getting Started',
        description: 'First steps with test generation, workspace navigation, and core workflows.',
        order: 1
    },
    'test-authoring': {
        id: 'test-authoring',
        name: 'Test Authoring',
        description: 'Reviewing, approving, editing, and managing test cases across your suites.',
        order: 2
    },
    'analysis': {
        id: 'analysis',
        name: 'Coverage & Traceability',
        description: 'Linked vs Verified metrics, risk analysis, and smart AI recommendations.',
        order: 3
    },
    'export': {
        id: 'export',
        name: 'Exporting & Automation',
        description: 'Exporting suites to Playwright, Cypress, Gherkin, JSON, and CSV.',
        order: 4
    },
    'integrations': {
        id: 'integrations',
        name: 'Integrations & CI/CD',
        description: 'Connecting GitHub Actions to execute tests and ingest verification results.',
        order: 5
    },
    'security': {
        id: 'security',
        name: 'Security & Privacy',
        description: 'Data handling, stateless generation architecture, and enterprise compliance.',
        order: 6
    },
    'account': {
        id: 'account',
        name: 'Account & Workspaces',
        description: 'Managing workspaces, user roles, invitations, and session security.',
        order: 7
    },
    'execution': {
        id: 'execution',
        name: 'Test Execution',
        description: 'Understanding execution runners, CI runners, and the upcoming Test Runs engine.',
        order: 8
    },
    'troubleshooting': {
        id: 'troubleshooting',
        name: 'Troubleshooting',
        description: 'Solutions for common errors, rate limits, timeouts, and support channels.',
        order: 9
    },
    'resources': {
        id: 'resources',
        name: 'Resources & Reference',
        description: 'Complete QA glossary, changelog, and release announcements.',
        order: 10
    }
};

const FORBIDDEN_PHRASES = [
    'restore previous sessions',
    'snapshots',
    'saved to your workspace history automatically'
];

const FORBIDDEN_BRAND_SPELLINGS = [
    'TestNexa',
    'TESTNEXA AI'
];

function slugify(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');
}

function parseFrontMatter(rawContent, filePath) {
    const match = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!match) {
        throw new Error(`File ${filePath} is missing valid YAML frontmatter blocks (--- ... ---)`);
    }

    const frontMatterBlock = match[1];
    const body = match[2];
    const data = {};

    for (const line of frontMatterBlock.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const colonIdx = trimmed.indexOf(':');
        if (colonIdx === -1) continue;

        const key = trimmed.slice(0, colonIdx).trim();
        let value = trimmed.slice(colonIdx + 1).trim();

        // Handle string quotes
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        } else if (value.startsWith('[') && value.endsWith(']')) {
            // Parse array of strings
            const items = value
                .slice(1, -1)
                .split(',')
                .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
                .filter(Boolean);
            value = items;
        } else if (!Number.isNaN(Number(value)) && value !== '') {
            value = Number(value);
        }

        data[key] = value;
    }

    // Required fields validation
    const required = ['title', 'description', 'category', 'order', 'updated', 'keywords', 'related'];
    for (const field of required) {
        if (data[field] === undefined || data[field] === null || data[field] === '') {
            throw new Error(`File ${filePath} is missing required frontmatter field: "${field}"`);
        }
    }

    // Validate ISO date format YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.updated)) {
        throw new Error(`File ${filePath} has invalid updated date format "${data.updated}", expected YYYY-MM-DD`);
    }

    if (!Array.isArray(data.keywords) || data.keywords.length === 0) {
        throw new Error(`File ${filePath} keywords must be a non-empty array`);
    }

    if (!Array.isArray(data.related)) {
        throw new Error(`File ${filePath} related must be an array of slugs`);
    }

    return { data, body };
}

function extractHeadingsAndTOC(body) {
    const toc = [];
    const lines = body.split(/\r?\n/);
    for (const line of lines) {
        const h2 = line.match(/^##\s+(.+)$/);
        const h3 = line.match(/^###\s+(.+)$/);
        if (h2) {
            const title = h2[1].replace(/`|[*_]/g, '').trim();
            toc.push({ level: 2, title, id: slugify(title) });
        } else if (h3) {
            const title = h3[1].replace(/`|[*_]/g, '').trim();
            toc.push({ level: 3, title, id: slugify(title) });
        }
    }
    return toc;
}

function extractSearchTokens(title, description, keywords, headings, body) {
    const cleanBody = body
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/`[^`]+`/g, ' ')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/[#*>-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    return {
        title,
        description,
        keywords: keywords.join(' '),
        headings: headings.map(h => h.title).join(' '),
        snippet: cleanBody.slice(0, 300)
    };
}

function validateForbiddenPhrases(filePath, content) {
    for (const phrase of FORBIDDEN_PHRASES) {
        if (content.toLowerCase().includes(phrase.toLowerCase())) {
            throw new Error(`[FORBIDDEN PHRASE] Found retired phrase "${phrase}" in file ${filePath}`);
        }
    }

    for (const spelling of FORBIDDEN_BRAND_SPELLINGS) {
        if (content.includes(spelling)) {
            throw new Error(`[INVALID BRAND SPELLING] Found prohibited spelling "${spelling}" in file ${filePath}. Must use strictly "Testnexa".`);
        }
    }
}

async function buildHelpIndex() {
    console.log('[help-index] Scanning content/help directory...');
    if (!fs.existsSync(contentDir)) {
        throw new Error(`Content directory not found: ${contentDir}`);
    }

    const categoriesOnDisk = fs.readdirSync(contentDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);

    const articles = [];
    const slugMap = new Map();

    for (const cat of categoriesOnDisk) {
        const catPath = path.join(contentDir, cat);
        const files = fs.readdirSync(catPath).filter(f => f.endsWith('.mdx') || f.endsWith('.md'));

        for (const file of files) {
            const filePath = path.join(catPath, file);
            const raw = fs.readFileSync(filePath, 'utf8');
            const slug = path.basename(file, path.extname(file));

            validateForbiddenPhrases(filePath, raw);

            const { data, body } = parseFrontMatter(raw, filePath);

            if (data.category !== cat) {
                throw new Error(`Category mismatch in ${filePath}: frontmatter says "${data.category}" but folder is "${cat}"`);
            }

            const toc = extractHeadingsAndTOC(body);
            const wordCount = body.trim().split(/\s+/).length;
            const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

            const articleObj = {
                slug,
                url: `/help/${cat}/${slug}`,
                repoPath: `content/help/${cat}/${file}`,
                title: data.title,
                description: data.description,
                category: cat,
                categoryName: CATEGORIES[cat]?.name || cat,
                order: data.order,
                updated: data.updated,
                keywords: data.keywords,
                related: data.related,
                toc,
                wordCount,
                readingTimeMinutes,
                searchTokens: extractSearchTokens(data.title, data.description, data.keywords, toc, body),
                rawBody: body
            };

            articles.push(articleObj);
            slugMap.set(slug, articleObj);
        }
    }

    // Sort by category order then article order
    articles.sort((a, b) => {
        const catOrderA = CATEGORIES[a.category]?.order || 99;
        const catOrderB = CATEGORIES[b.category]?.order || 99;
        if (catOrderA !== catOrderB) return catOrderA - catOrderB;
        return a.order - b.order;
    });

    console.log(`[help-index] Parsed ${articles.length} articles across ${categoriesOnDisk.length} categories.`);

    // Validate internal link resolution
    console.log('[help-index] Validating internal links and related references...');
    for (const article of articles) {
        // Validate related articles
        for (const relSlug of article.related) {
            if (!slugMap.has(relSlug)) {
                throw new Error(`[BROKEN RELATED LINK] Article "${article.slug}" references non-existent related slug "${relSlug}"`);
            }
        }

        // Validate markdown links: e.g. [title](/help/category/slug) or [title](/help/slug)
        const linkMatches = article.rawBody.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g);
        for (const match of linkMatches) {
            const href = match[2];
            if (href.startsWith('/help/')) {
                const parts = href.replace('/help/', '').split('#')[0].split('/').filter(Boolean);
                if (parts.length === 0) continue; // /help is valid
                const targetSlug = parts[parts.length - 1];
                // Check if targetSlug is a known slug, glossary, or search
                if (!slugMap.has(targetSlug) && targetSlug !== 'glossary' && targetSlug !== 'search' && targetSlug !== 'first-test-suite') {
                    throw new Error(`[BROKEN INTERNAL LINK] In "${article.slug}": link "${href}" does not resolve to an active help article.`);
                }
            }
        }
    }

    // Prepare category summaries
    const categorySummaries = Object.values(CATEGORIES).map(cat => {
        const catArticles = articles.filter(a => a.category === cat.id);
        return {
            ...cat,
            count: catArticles.length,
            articles: catArticles.map(a => ({
                slug: a.slug,
                url: a.url,
                title: a.title,
                description: a.description,
                order: a.order
            }))
        };
    }).filter(cat => cat.count > 0);

    // Prepare payload
    const indexPayload = {
        generatedAt: new Date().toISOString(),
        totalArticles: articles.length,
        categories: categorySummaries,
        articles: articles.map(a => ({
            slug: a.slug,
            url: a.url,
            repoPath: a.repoPath,
            title: a.title,
            description: a.description,
            category: a.category,
            categoryName: a.categoryName,
            order: a.order,
            updated: a.updated,
            keywords: a.keywords,
            related: a.related,
            toc: a.toc,
            wordCount: a.wordCount,
            readingTimeMinutes: a.readingTimeMinutes,
            searchTokens: a.searchTokens,
            rawBody: a.rawBody
        }))
    };

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, 'help-index.json');
    fs.writeFileSync(outputPath, JSON.stringify(indexPayload, null, 2), 'utf8');
    console.log(`[help-index] Successfully wrote typed index to ${outputPath}`);

    // Generate Sitemap and Robots.txt
    if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
    }

    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://testnexa.ai/help</loc>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://testnexa.ai/help/search</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
${articles.map(a => `  <url>
    <loc>https://testnexa.ai${a.url}</loc>
    <lastmod>${a.updated}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('\n')}
</urlset>
`;
    fs.writeFileSync(path.join(publicDir, 'sitemap-help.xml'), sitemapXml, 'utf8');
    console.log('[help-index] Generated public/sitemap-help.xml');

    // Robots.txt update
    const robotsTxtPath = path.join(publicDir, 'robots.txt');
    let robotsTxt = `User-agent: *\nAllow: /\nSitemap: https://testnexa.ai/sitemap-help.xml\n`;
    if (fs.existsSync(robotsTxtPath)) {
        const existingRobots = fs.readFileSync(robotsTxtPath, 'utf8');
        if (!existingRobots.includes('sitemap-help.xml')) {
            robotsTxt = existingRobots.trim() + `\nSitemap: https://testnexa.ai/sitemap-help.xml\n`;
        } else {
            robotsTxt = existingRobots;
        }
    }
    fs.writeFileSync(robotsTxtPath, robotsTxt, 'utf8');
    console.log('[help-index] Updated public/robots.txt');
}

buildHelpIndex().catch(err => {
    console.error('\n❌ BUILD FAILED:');
    console.error(err.message);
    process.exit(1);
});
