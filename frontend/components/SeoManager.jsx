import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '../utils/analytics';

const BASE_URL = 'https://testnexa.ai';
const DEFAULT_IMAGE = `${BASE_URL}/og-image.png`;

// Route metadata dictionary
const SEO_CONFIG = {
    '/': {
        title: 'TestNexa AI — Turn Requirements Into Production-Ready Test Suites',
        description: 'Transform natural-language software requirements into prioritized test scenarios, edge cases, coverage analysis, and traceability with TestNexa AI.',
        isPublic: true
    },
    '/features': {
        title: 'Features — TestNexa AI Quality Intelligence',
        description: 'Explore automated test case synthesis, BDD formatting, risk scoring, coverage auditing, and Jira-compatible exports with TestNexa AI.',
        isPublic: true
    },
    '/solutions': {
        title: 'Solutions for QA & Engineering Teams — TestNexa AI',
        description: 'Accelerate test coverage and eliminate requirement blind spots for QA Engineers, SDETs, and Engineering Leaders.',
        isPublic: true
    },
    '/how-it-works': {
        title: 'How It Works — Automated QA Workflow — TestNexa AI',
        description: 'See how TestNexa turns raw product requirements into executable test suites, risk matrices, and traceability graphs in seconds.',
        isPublic: true
    },
    '/audience': {
        title: 'Built for QA, SDETs & Product Teams — TestNexa AI',
        description: 'Tailored QA workflows for software engineers, product managers, and testing leads looking to build bulletproof test suites.',
        isPublic: true
    },
    '/help': {
        title: 'Documentation & Knowledge Base — TestNexa AI',
        description: 'Comprehensive guides, FAQs, and documentation for generating test cases, configuring workflows, and integrating TestNexa AI.',
        isPublic: true
    },
    '/api-reference': {
        title: 'API Reference — TestNexa AI Developer Platform',
        description: 'REST API endpoints, schemas, authentication, and integration guides for automating test generation programmatically.',
        isPublic: true
    },
    '/best-practices': {
        title: 'QA Best Practices & Test Design Guide — TestNexa AI',
        description: 'Industry-standard guidelines for writing testable requirements, boundary analysis, and maintaining complete test traceability.',
        isPublic: true
    },
    '/about': {
        title: 'About TestNexa AI — The Intelligent QA Platform',
        description: 'Learn about TestNexa AI’s mission to bridge the gap between product requirements and comprehensive software quality assurance.',
        isPublic: true
    },
    '/contact': {
        title: 'Contact Us — TestNexa AI Support & Enterprise',
        description: 'Get in touch with the TestNexa AI team for enterprise support, custom integrations, product inquiries, and feedback.',
        isPublic: true
    },
    '/privacy': {
        title: 'Privacy Policy — TestNexa AI',
        description: 'Learn how TestNexa AI collects, uses, protects, and isolates your personal and workspace data.',
        isPublic: true
    },
    '/terms': {
        title: 'Terms & Conditions — TestNexa AI',
        description: 'Terms of service and conditions governing your access to and use of the TestNexa AI testing intelligence platform.',
        isPublic: true
    },
    '/cookie-policy': {
        title: 'Cookie Policy — TestNexa AI',
        description: 'Understand how TestNexa AI uses necessary authentication cookies and optional analytics.',
        isPublic: true
    },
    '/api-terms': {
        title: 'Developer API Terms — TestNexa AI',
        description: 'Operational policies, rate limits, and guidelines for programmatic use of the TestNexa API.',
        isPublic: true
    },
    '/acceptable-use': {
        title: 'Acceptable Use Policy — TestNexa AI',
        description: 'Standards of conduct, security boundaries, and acceptable usage rules for TestNexa AI.',
        isPublic: true
    },
    '/legal': {
        title: 'Legal Documents & Policies — TestNexa AI',
        description: 'Official legal documentation, privacy standards, terms of service, and compliance policies for TestNexa AI.',
        isPublic: true
    },
    '/404': {
        title: 'Page Not Found (404) — TestNexa AI',
        description: 'The requested page could not be found on TestNexa AI.',
        isPublic: false
    }
};

const setMetaTag = (attrName, attrValue, content) => {
    let el = document.querySelector(`meta[${attrName}="${attrValue}"]`);
    if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attrName, attrValue);
        document.head.appendChild(el);
    }
    el.setAttribute('content', content);
};

const setCanonical = (url) => {
    let el = document.querySelector('link[rel="canonical"]');
    if (!el) {
        el = document.createElement('link');
        el.setAttribute('rel', 'canonical');
        document.head.appendChild(el);
    }
    el.setAttribute('href', url);
};

export const SeoManager = () => {
    const location = useLocation();

    useEffect(() => {
        const path = location.pathname;
        const config = SEO_CONFIG[path] || {
            title: path.startsWith('/app') ? 'Workspace | TestNexa AI' : 'TestNexa AI',
            description: 'Turn requirements into production-ready test suites with TestNexa AI.',
            isPublic: !path.startsWith('/app') && !path.startsWith('/login') && !path.startsWith('/signup') && !path.startsWith('/forgot-password') && !path.startsWith('/reset-password')
        };

        const canonicalUrl = `${BASE_URL}${path === '/' ? '' : path}`;

        // 1. Update Title
        document.title = config.title;

        // 2. Meta Description
        setMetaTag('name', 'description', config.description);

        // 3. Robots directive: noindex for app & auth pages, index for public marketing pages
        if (config.isPublic) {
            setMetaTag('name', 'robots', 'index, follow');
        } else {
            setMetaTag('name', 'robots', 'noindex, nofollow');
        }

        // 4. Canonical URL
        setCanonical(canonicalUrl);

        // 5. Open Graph Meta Tags
        setMetaTag('property', 'og:title', config.title);
        setMetaTag('property', 'og:description', config.description);
        setMetaTag('property', 'og:url', canonicalUrl);
        setMetaTag('property', 'og:image', DEFAULT_IMAGE);
        setMetaTag('property', 'og:type', 'website');
        setMetaTag('property', 'og:site_name', 'TestNexa AI');

        // 6. Twitter / X Meta Tags
        setMetaTag('name', 'twitter:card', 'summary_large_image');
        setMetaTag('name', 'twitter:title', config.title);
        setMetaTag('name', 'twitter:description', config.description);
        setMetaTag('name', 'twitter:image', DEFAULT_IMAGE);

        // 7. Fire Page View in Analytics (respecting consent)
        trackPageView(path);
    }, [location.pathname]);

    return null;
};

export default SeoManager;
