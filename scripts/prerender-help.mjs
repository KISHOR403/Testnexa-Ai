import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const indexPath = path.join(distDir, 'index.html');
const helpIndexPath = path.join(rootDir, 'frontend', 'content', 'help-index.json');

const FAQ_ITEMS = [
    {
        question: "How does Testnexa generate test cases?",
        answer: "Testnexa parses your natural language requirements or acceptance criteria, evaluates them against established QA heuristics across positive, negative, and edge vectors, and generates deterministic test cases with clear preconditions, steps, and expected outcomes."
    },
    {
        question: "Does Testnexa save incomplete drafts or session history?",
        answer: "No. Testnexa operates statelessly during generation. Nothing is stored in your workspace until a test suite is fully generated and saved. Testnexa does not maintain unfinished drafts or unsaved generation history."
    },
    {
        question: "What is the difference between Linked and Verified coverage?",
        answer: "Linked coverage is a design-time metric representing requirement acceptance criteria mapped to approved test cases. Verified coverage is an execution-time metric representing test cases that have successfully executed and passed within your CI/CD runner."
    },
    {
        question: "Does Testnexa execute tests directly in the cloud?",
        answer: "Test execution is currently performed inside your own CI/CD pipeline (such as GitHub Actions) using exported Playwright suites. In-app cloud test execution is coming soon in Phase 2."
    },
    {
        question: "Which export formats are supported?",
        answer: "Testnexa supports exporting approved test suites to Playwright (TypeScript and Python), Cypress (JavaScript), Cucumber/Gherkin (.feature files), and standard JSON and CSV data interchange formats."
    }
];

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

async function prerenderHelp() {
    if (!fs.existsSync(indexPath)) {
        console.log('[prerender] dist/index.html not found, skipping prerender (run after vite build).');
        return;
    }
    if (!fs.existsSync(helpIndexPath)) {
        console.error('[prerender] help-index.json not found!');
        process.exit(1);
    }

    const template = fs.readFileSync(indexPath, 'utf8');
    const helpData = JSON.parse(fs.readFileSync(helpIndexPath, 'utf8'));

    console.log(`[prerender] Pre-rendering ${helpData.articles.length} articles and hub pages...`);

    // Helper to generate customized HTML
    function createPageHtml({ title, description, canonicalUrl, ogType = 'website', jsonLd = null, preRenderBody = '' }) {
        let html = template;

        // Replace Title
        html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);

        // Prepare head tags
        let headTags = `
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:type" content="${ogType}" />
    <meta property="og:site_name" content="Testnexa" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />`;

        if (jsonLd) {
            headTags += `\n    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;
        }

        html = html.replace('</head>', `${headTags}\n  </head>`);

        // Pre-inject semantic noscript/fallback content inside root for bots & SEO
        if (preRenderBody) {
            html = html.replace(
                '<div id="root"></div>',
                `<div id="root"><noscript><main class="prerendered-content">${preRenderBody}</main></noscript></div>`
            );
        }

        return html;
    }

    // 1. Hub Page: /help
    const hubFaqJsonLd = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": FAQ_ITEMS.map(faq => ({
            "@type": "Question",
            "name": faq.question,
            "acceptedAnswer": {
                "@type": "Answer",
                "text": faq.answer
            }
        }))
    };

    const hubHtml = createPageHtml({
        title: "Help Center & Documentation | Testnexa",
        description: "Explore guides, technical documentation, architectural references, and API tutorials for Testnexa AI test suite generation.",
        canonicalUrl: "https://testnexa.ai/help",
        jsonLd: hubFaqJsonLd,
        preRenderBody: `
            <h1>Testnexa Help Center</h1>
            <p>Documentation and guides for requirements analysis, test generation, and coverage traceability.</p>
            <h2>Popular Guides</h2>
            <ul>
                ${helpData.articles.slice(0, 4).map(a => `<li><a href="${a.url}">${escapeHtml(a.title)}</a>: ${escapeHtml(a.description)}</li>`).join('\n')}
            </ul>
            <h2>Frequently Asked Questions</h2>
            ${FAQ_ITEMS.map(faq => `<h3>${escapeHtml(faq.question)}</h3><p>${escapeHtml(faq.answer)}</p>`).join('\n')}
        `
    });

    const helpOutDir = path.join(distDir, 'help');
    fs.mkdirSync(helpOutDir, { recursive: true });
    fs.writeFileSync(path.join(helpOutDir, 'index.html'), hubHtml, 'utf8');

    // 2. Search Page: /help/search
    const searchHtml = createPageHtml({
        title: "Search Documentation | Testnexa Help Center",
        description: "Search Testnexa documentation, articles, and guides by keywords or topics.",
        canonicalUrl: "https://testnexa.ai/help/search"
    });
    const searchOutDir = path.join(helpOutDir, 'search');
    fs.mkdirSync(searchOutDir, { recursive: true });
    fs.writeFileSync(path.join(searchOutDir, 'index.html'), searchHtml, 'utf8');

    // 3. Glossary Page: /help/glossary (redirects or renders glossary article)
    const glossaryArticle = helpData.articles.find(a => a.slug === 'glossary');
    if (glossaryArticle) {
        const glossaryOutDir = path.join(helpOutDir, 'glossary');
        fs.mkdirSync(glossaryOutDir, { recursive: true });
        const glossaryHtml = createPageHtml({
            title: `${glossaryArticle.title} | Testnexa Docs`,
            description: glossaryArticle.description,
            canonicalUrl: "https://testnexa.ai/help/resources/glossary",
            ogType: "article"
        });
        fs.writeFileSync(path.join(glossaryOutDir, 'index.html'), glossaryHtml, 'utf8');
    }

    // 4. Each Article: /help/:category/:slug
    for (const article of helpData.articles) {
        const articleDir = path.join(helpOutDir, article.category, article.slug);
        fs.mkdirSync(articleDir, { recursive: true });

        const articleJsonLd = {
            "@context": "https://schema.org",
            "@type": "TechArticle",
            "headline": article.title,
            "description": article.description,
            "dateModified": article.updated,
            "publisher": {
                "@type": "Organization",
                "name": "Testnexa",
                "url": "https://testnexa.ai"
            }
        };

        const articleHtml = createPageHtml({
            title: `${article.title} | Testnexa Docs`,
            description: article.description,
            canonicalUrl: `https://testnexa.ai${article.url}`,
            ogType: "article",
            jsonLd: articleJsonLd,
            preRenderBody: `
                <article>
                    <h1>${escapeHtml(article.title)}</h1>
                    <p class="article-meta">Category: ${escapeHtml(article.categoryName)} | Last updated: ${article.updated} | ${article.readingTimeMinutes} min read</p>
                    <p>${escapeHtml(article.description)}</p>
                    <div class="article-body">
                        ${article.rawBody.replace(/#+\s+(.+)/g, '<h3>$1</h3>').replace(/```[\s\S]*?```/g, '<pre><code>[Code Block]</code></pre>')}
                    </div>
                </article>
            `
        });

        fs.writeFileSync(path.join(articleDir, 'index.html'), articleHtml, 'utf8');
    }

    console.log(`[prerender] Pre-rendered HTML files generated successfully in dist/help/`);
}

prerenderHelp().catch(err => {
    console.error('[prerender] Error during prerendering:', err);
    process.exit(1);
});
