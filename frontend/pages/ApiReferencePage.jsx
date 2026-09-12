import React, { useState, useEffect, useRef } from 'react';
import { Search, Copy, Check, Terminal, Play, Shield, Server, AlertCircle, ExternalLink, Code2 } from 'lucide-react';
import '../styles/apiReference.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

const CODE_EXAMPLES = {
    generate: {
        curl: `curl -X POST "${API_BASE_URL}/generate" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "requirement": "Users can reset their password using their registered email address. A 15-minute token is dispatched.",
    "appType": "web",
    "detailLevel": "detailed",
    "testFocus": "mixed"
  }'`,
        javascript: `const response = await fetch("${API_BASE_URL}/generate", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
  },
  body: JSON.stringify({
    requirement: "Users can reset their password using their registered email address. A 15-minute token is dispatched.",
    appType: "web",
    detailLevel: "detailed",
    testFocus: "mixed"
  })
});

const result = await response.json();
console.log(result.data.functional);`,
        python: `import requests

url = "${API_BASE_URL}/generate"
headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
}
payload = {
    "requirement": "Users can reset their password using their registered email address. A 15-minute token is dispatched.",
    "appType": "web",
    "detailLevel": "detailed",
    "testFocus": "mixed"
}

response = requests.post(url, json=payload, headers=headers)
data = response.json()
print(data["data"]["summary"])`,
        node: `const axios = require('axios');

async function generateTests() {
  const { data } = await axios.post('${API_BASE_URL}/generate', {
    requirement: 'Users can reset their password using their registered email address. A 15-minute token is dispatched.',
    appType: 'web',
    detailLevel: 'detailed',
    testFocus: 'mixed'
  }, {
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY',
      'Content-Type': 'application/json'
    }
  });

  console.log(\`Generated \${data.data.summary.total} test cases\`);
}

generateTests();`
    },
    history: {
        curl: `curl -X GET "${API_BASE_URL}/history?limit=20&page=1" \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
        javascript: `const response = await fetch("${API_BASE_URL}/history?limit=20&page=1", {
  headers: {
    "Authorization": "Bearer YOUR_API_KEY"
  }
});
const history = await response.json();`,
        python: `import requests

response = requests.get(
    "${API_BASE_URL}/history",
    params={"limit": 20, "page": 1},
    headers={"Authorization": "Bearer YOUR_API_KEY"}
)
print(response.json())`,
        node: `const axios = require('axios');

const { data } = await axios.get('${API_BASE_URL}/history', {
  params: { limit: 20, page: 1 },
  headers: { 'Authorization': 'Bearer YOUR_API_KEY' }
});`
    },
    sessionsList: {
        curl: `curl -X GET "${API_BASE_URL}/sessions?limit=20&page=1" \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
        javascript: `const response = await fetch("${API_BASE_URL}/sessions", {
  headers: { "Authorization": "Bearer YOUR_API_KEY" }
});
const sessions = await response.json();`,
        python: `import requests

response = requests.get("${API_BASE_URL}/sessions", headers={"Authorization": "Bearer YOUR_API_KEY"})
print(response.json())`,
        node: `const axios = require('axios');

const { data } = await axios.get('${API_BASE_URL}/sessions', {
  headers: { 'Authorization': 'Bearer YOUR_API_KEY' }
});`
    },
    health: {
        curl: `curl -X GET "http://localhost:5000/health"`,
        javascript: `const res = await fetch("http://localhost:5000/health");
const status = await res.json();
console.log(status);`,
        python: `import requests
res = requests.get("http://localhost:5000/health")
print(res.json())`,
        node: `const axios = require('axios');
const { data } = await axios.get('http://localhost:5000/health');`
    }
};

const SAMPLE_RESPONSES = {
    generate: `{
  "success": true,
  "data": {
    "feature": "Password Reset & Token Invalidation",
    "summary": {
      "total": 14,
      "functional": 6,
      "negative": 4,
      "edge": 3,
      "nonFunctional": 1,
      "apiChecklist": 4
    },
    "functional": [
      {
        "id": "TC-001",
        "title": "Successful password reset link dispatch",
        "scenario": "User submits valid registered email address",
        "priority": "HIGH",
        "severity": "CRITICAL",
        "steps": [
          "Navigate to /forgot-password",
          "Enter valid registered email 'user@example.com'",
          "Click Submit button"
        ],
        "expectedResult": "Success confirmation displayed; reset email sent with 15m single-use token"
      }
    ],
    "quality": {
      "score": 96,
      "completeness": "High",
      "testability": "High"
    }
  }
}`,
    history: `{
  "success": true,
  "count": 1,
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "pages": 1
  },
  "data": [
    {
      "_id": "664b9b94e82b79a5231c9401",
      "feature": "Password Reset Flow",
      "appType": "web",
      "detailLevel": "detailed",
      "totalTestCases": 14,
      "createdAt": "2026-09-12T10:15:00.000Z"
    }
  ]
}`,
    sessionsList: `{
  "success": true,
  "sessions": [
    {
      "_id": "673c9f21ab4519f048d21c10",
      "title": "Password Reset Suite",
      "requirement": "Users can reset password with 15m email token",
      "appType": "web",
      "detailLevel": "detailed",
      "testCasesCount": 18,
      "updatedAt": "2026-09-12T11:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "pages": 1
  }
}`,
    health: `{
  "status": "OK",
  "timestamp": "2026-09-12T12:00:00.000Z",
  "uptime": 9840.12,
  "memory": {
    "rss": 84213760,
    "heapTotal": 45154304,
    "heapUsed": 32901248
  }
}`
};

const ApiReferencePage = () => {
    const [activeLang, setActiveLang] = useState('curl');
    const [activeSection, setActiveSection] = useState('generate-test-suite');
    const [searchQuery, setSearchQuery] = useState('');
    const [copiedMap, setCopiedMap] = useState({});
    const searchInputRef = useRef(null);

    // Interactive Try It State
    const [tryMode, setTryMode] = useState(false);
    const [tryRequirement, setTryRequirement] = useState(
        'Users can reset their password using their registered email address. System sends a single-use token valid for 15 minutes with rate limiting.'
    );
    const [tryAppType, setTryAppType] = useState('web');
    const [tryDetailLevel, setTryDetailLevel] = useState('detailed');
    const [tryTestFocus, setTryTestFocus] = useState('mixed');
    const [tryLoading, setTryLoading] = useState(false);
    const [tryResponse, setTryResponse] = useState(null);
    const [tryStatus, setTryStatus] = useState(null);
    const [tryLatency, setTryLatency] = useState(null);

    // Focus search on '/' keypress
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === '/' && document.activeElement !== searchInputRef.current && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const copyToClipboard = (text, key) => {
        navigator.clipboard.writeText(text);
        setCopiedMap(prev => ({ ...prev, [key]: true }));
        setTimeout(() => {
            setCopiedMap(prev => ({ ...prev, [key]: false }));
        }, 2000);
    };

    const handleSendTryRequest = async () => {
        setTryLoading(true);
        setTryResponse(null);
        setTryStatus(null);
        const startTime = performance.now();

        try {
            const token = localStorage.getItem('testnexa_token') || localStorage.getItem('token');
            const headers = {
                'Content-Type': 'application/json'
            };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const res = await fetch(`${API_BASE_URL}/generate`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    requirement: tryRequirement,
                    appType: tryAppType,
                    detailLevel: tryDetailLevel,
                    testFocus: tryTestFocus
                })
            });

            const duration = ((performance.now() - startTime) / 1000).toFixed(2);
            setTryLatency(`${duration}s`);
            setTryStatus(res.status);

            const json = await res.json();
            setTryResponse(JSON.stringify(json, null, 2));
        } catch (err) {
            const duration = ((performance.now() - startTime) / 1000).toFixed(2);
            setTryLatency(`${duration}s`);
            setTryStatus(500);
            setTryResponse(JSON.stringify({ error: err.message || 'Failed to connect to API server' }, null, 2));
        } finally {
            setTryLoading(false);
        }
    };

    const scrollToSection = (id) => {
        setActiveSection(id);
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    // Filter endpoints for search
    const endpointsList = [
        { id: 'overview', title: 'Overview', group: 'Getting Started', tags: ['base', 'url', 'formats', 'json'] },
        { id: 'authentication', title: 'Authentication', group: 'Getting Started', tags: ['bearer', 'token', 'authorization', 'header', 'key'] },
        { id: 'errors', title: 'Errors & Status Codes', group: 'Getting Started', tags: ['400', '401', '422', '429', '500', 'validation'] },
        { id: 'rate-limits', title: 'Rate Limits', group: 'Getting Started', tags: ['limits', 'throttling', 'quota', 'headers'] },
        { id: 'generate-test-suite', title: 'Generate Test Suite', method: 'POST', path: '/api/v1/generate', group: 'Test Suites', tags: ['requirement', 'appType', 'detailLevel', 'testFocus', 'persona', 'functional', 'negative', 'edge'] },
        { id: 'generation-history', title: 'Generation History', method: 'GET', path: '/api/v1/history', group: 'Test Suites', tags: ['history', 'pagination', 'limit', 'page'] },
        { id: 'list-sessions', title: 'List Sessions', method: 'GET', path: '/api/v1/sessions', group: 'Workspaces', tags: ['sessions', 'workspaces', 'suites', 'search'] },
        { id: 'create-session', title: 'Create Session', method: 'POST', path: '/api/v1/sessions', group: 'Workspaces', tags: ['session', 'workspace', 'create'] },
        { id: 'get-session', title: 'Get Session Details', method: 'GET', path: '/api/v1/sessions/:id', group: 'Workspaces', tags: ['id', 'coverage', 'risks', 'traceability'] },
        { id: 'health-check', title: 'System Health', method: 'GET', path: '/health', group: 'Utility', tags: ['health', 'uptime', 'probe', 'status'] },
    ];

    const filteredEndpoints = endpointsList.filter(item => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
            item.title.toLowerCase().includes(q) ||
            (item.path && item.path.toLowerCase().includes(q)) ||
            (item.method && item.method.toLowerCase().includes(q)) ||
            item.tags.some(t => t.toLowerCase().includes(q))
        );
    });

    const activeCodeKey = activeSection === 'generation-history' ? 'history'
        : activeSection === 'list-sessions' || activeSection === 'create-session' || activeSection === 'get-session' ? 'sessionsList'
        : activeSection === 'health-check' ? 'health'
        : 'generate';

    return (
        <div className="tn-api-root">
            {/* ─── Clean Header Bar ─── */}
            <header className="tn-api-header">
                <div className="tn-api-header__container">
                    <div className="tn-api-header__titles">
                        <div className="tn-api-title-row">
                            <h1 className="tn-api-heading">API Reference</h1>
                            <span className="tn-api-version-badge">API v1</span>
                        </div>
                        <p className="tn-api-subheading">
                            Integrate Testnexa into your CI/CD pipelines, automation workflows and internal QA tools.
                        </p>
                    </div>

                    <div className="tn-api-search-wrapper">
                        <Search size={15} className="tn-api-search-icon" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            className="tn-api-search-input"
                            placeholder="Search API documentation..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <kbd className="tn-api-search-kbd">/</kbd>
                    </div>
                </div>
            </header>

            {/* ─── 3-Column Developer Layout ─── */}
            <div className="tn-api-layout">
                {/* ─── Left Sidebar Navigation ─── */}
                <aside className="tn-api-sidebar">
                    {/* Getting Started */}
                    <div className="tn-api-nav-group">
                        <h4 className="tn-api-nav-heading">Getting Started</h4>
                        <ul className="tn-api-nav-list">
                            {filteredEndpoints.filter(e => e.group === 'Getting Started').map(item => (
                                <li key={item.id}>
                                    <button
                                        type="button"
                                        className={`tn-api-nav-item-btn ${activeSection === item.id ? 'active' : ''}`}
                                        onClick={() => scrollToSection(item.id)}
                                    >
                                        {item.title}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Test Suites */}
                    <div className="tn-api-nav-group">
                        <h4 className="tn-api-nav-heading">Test Suites</h4>
                        <ul className="tn-api-nav-list">
                            {filteredEndpoints.filter(e => e.group === 'Test Suites').map(item => (
                                <li key={item.id}>
                                    <button
                                        type="button"
                                        className={`tn-api-nav-item-btn ${activeSection === item.id ? 'active' : ''}`}
                                        onClick={() => scrollToSection(item.id)}
                                    >
                                        <span className={`tn-api-nav-badge tn-api-nav-badge--${item.method?.toLowerCase()}`}>
                                            {item.method}
                                        </span>
                                        <span>{item.title}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Workspace Sessions */}
                    <div className="tn-api-nav-group">
                        <h4 className="tn-api-nav-heading">Workspaces & Sessions</h4>
                        <ul className="tn-api-nav-list">
                            {filteredEndpoints.filter(e => e.group === 'Workspaces').map(item => (
                                <li key={item.id}>
                                    <button
                                        type="button"
                                        className={`tn-api-nav-item-btn ${activeSection === item.id ? 'active' : ''}`}
                                        onClick={() => scrollToSection(item.id)}
                                    >
                                        <span className={`tn-api-nav-badge tn-api-nav-badge--${item.method?.toLowerCase()}`}>
                                            {item.method}
                                        </span>
                                        <span>{item.title}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Utility */}
                    <div className="tn-api-nav-group">
                        <h4 className="tn-api-nav-heading">Utility</h4>
                        <ul className="tn-api-nav-list">
                            {filteredEndpoints.filter(e => e.group === 'Utility').map(item => (
                                <li key={item.id}>
                                    <button
                                        type="button"
                                        className={`tn-api-nav-item-btn ${activeSection === item.id ? 'active' : ''}`}
                                        onClick={() => scrollToSection(item.id)}
                                    >
                                        <span className={`tn-api-nav-badge tn-api-nav-badge--${item.method?.toLowerCase()}`}>
                                            {item.method}
                                        </span>
                                        <span>{item.title}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                </aside>

                {/* ─── Center Column: Documentation ─── */}
                <main className="tn-api-doc-center">
                    {/* SECTION: Overview */}
                    <section id="overview" className="tn-api-section">
                        <div className="tn-api-section-header">
                            <h2 className="tn-api-section-title">Overview</h2>
                            <p className="tn-api-section-desc">
                                The Testnexa REST API provides programmatic access to automated test case generation, test suites, and workspace sessions. Use it to automatically turn user stories and Jira tickets into test suites directly inside CI/CD pipelines (GitHub Actions, GitLab CI) or QA workflows.
                            </p>
                        </div>

                        <h3 className="tn-api-subheading-label">Base URL</h3>
                        <div className="tn-api-table-card">
                            <table className="tn-api-table">
                                <thead>
                                    <tr>
                                        <th>Environment</th>
                                        <th>Base URL</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>Production</td>
                                        <td><code>https://api.testnexa.ai/api/v1</code></td>
                                    </tr>
                                    <tr>
                                        <td>Local Development</td>
                                        <td><code>http://localhost:5000/api/v1</code></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <h3 className="tn-api-subheading-label">Content Type & Protocol</h3>
                        <p className="tn-api-param-desc">
                            All API requests must use HTTPS (except in local development). All request payloads must be formatted as <code>application/json</code> with UTF-8 encoding. Responses return standard JSON envelopes with a top-level <code>success: true/false</code> boolean.
                        </p>
                    </section>

                    {/* SECTION: Authentication */}
                    <section id="authentication" className="tn-api-section">
                        <div className="tn-api-section-header">
                            <h2 className="tn-api-section-title">Authentication</h2>
                            <p className="tn-api-section-desc">
                                Testnexa API uses Bearer token authentication. Authenticate requests by providing your token in the standard HTTP <code>Authorization</code> header.
                            </p>
                        </div>

                        <div className="tn-api-table-card">
                            <table className="tn-api-table">
                                <thead>
                                    <tr>
                                        <th>Header</th>
                                        <th>Format</th>
                                        <th>Description</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td><span className="tn-api-param-name">Authorization</span></td>
                                        <td><code>Bearer &lt;API_KEY&gt;</code></td>
                                        <td>
                                            Provide your Bearer token prefixed with <code>Bearer </code>. For anonymous generation on public endpoints, this header is optional.
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="tn-api-code-card" style={{ marginBottom: '16px' }}>
                            <div className="tn-api-code-header">
                                <span style={{ fontSize: '0.74rem', color: '#9ca3af', fontWeight: 600 }}>Header Example</span>
                                <button
                                    type="button"
                                    className="tn-api-copy-btn"
                                    onClick={() => copyToClipboard('Authorization: Bearer YOUR_API_KEY', 'authHeader')}
                                >
                                    {copiedMap['authHeader'] ? <Check size={12} color="#00d9c0" /> : <Copy size={12} />}
                                    <span>{copiedMap['authHeader'] ? 'Copied' : 'Copy'}</span>
                                </button>
                            </div>
                            <pre className="tn-api-code-body">Authorization: Bearer YOUR_API_KEY</pre>
                        </div>
                    </section>

                    {/* SECTION: Errors & Status Codes */}
                    <section id="errors" className="tn-api-section">
                        <div className="tn-api-section-header">
                            <h2 className="tn-api-section-title">Errors & Status Codes</h2>
                            <p className="tn-api-section-desc">
                                Testnexa uses conventional HTTP response codes to indicate the success or failure of API requests.
                            </p>
                        </div>

                        <div className="tn-api-table-card">
                            <table className="tn-api-table">
                                <thead>
                                    <tr>
                                        <th>Status Code</th>
                                        <th>Meaning</th>
                                        <th>Description</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td><code>200 OK</code></td>
                                        <td>Success</td>
                                        <td>The request succeeded and the test suite or payload is returned.</td>
                                    </tr>
                                    <tr>
                                        <td><code>400 Bad Request</code></td>
                                        <td>Validation Error</td>
                                        <td>Missing required fields or invalid parameters (e.g. requirement under 20 chars).</td>
                                    </tr>
                                    <tr>
                                        <td><code>401 Unauthorized</code></td>
                                        <td>Authentication Failed</td>
                                        <td>Missing or invalid Bearer token on protected endpoints.</td>
                                    </tr>
                                    <tr>
                                        <td><code>422 Unprocessable</code></td>
                                        <td>Input Quality Failure</td>
                                        <td>Requirement text lacks software specification context (e.g. random gibberish).</td>
                                    </tr>
                                    <tr>
                                        <td><code>429 Rate Limited</code></td>
                                        <td>Too Many Requests</td>
                                        <td>Rate limit or model quota exceeded. Back off and retry with exponential delay.</td>
                                    </tr>
                                    <tr>
                                        <td><code>500 Server Error</code></td>
                                        <td>Internal Error</td>
                                        <td>Server or inference provider error. Check system health or retry.</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* SECTION: Rate Limits */}
                    <section id="rate-limits" className="tn-api-section">
                        <div className="tn-api-section-header">
                            <h2 className="tn-api-section-title">Rate Limits</h2>
                            <p className="tn-api-section-desc">
                                API requests are subject to rate limiting to safeguard availability and compute capacity. Rate limits are tracked per token or IP address.
                            </p>
                        </div>

                        <div className="tn-api-table-card">
                            <table className="tn-api-table">
                                <thead>
                                    <tr>
                                        <th>Plan Tier</th>
                                        <th>Generation Limit</th>
                                        <th>Standard Requests</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>Free Developer</td>
                                        <td>15 generations / hour</td>
                                        <td>60 requests / min</td>
                                    </tr>
                                    <tr>
                                        <td>Team & Enterprise</td>
                                        <td>300 generations / hour</td>
                                        <td>600 requests / min</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* SECTION: Generate Test Suite */}
                    <section id="generate-test-suite" className="tn-api-section">
                        <div className="tn-api-section-header">
                            <div className="tn-api-endpoint-meta-row">
                                <span className="tn-api-method-pill tn-api-method-pill--post">POST</span>
                                <code className="tn-api-path-code">/api/v1/generate</code>
                                <span className="tn-api-auth-tag">Auth: Optional</span>
                            </div>
                            <h2 className="tn-api-section-title">Generate Test Suite</h2>
                            <p className="tn-api-section-desc">
                                Generate structured, prioritized test cases (functional, negative, edge cases, API checklists) from software requirements text using deterministic multi-agent orchestration.
                            </p>
                        </div>

                        <h3 className="tn-api-subheading-label">Headers</h3>
                        <div className="tn-api-table-card">
                            <table className="tn-api-table">
                                <thead>
                                    <tr>
                                        <th>Header</th>
                                        <th>Type</th>
                                        <th>Requirement</th>
                                        <th>Description</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td><span className="tn-api-param-name">Content-Type</span></td>
                                        <td><code>string</code></td>
                                        <td><span className="tn-api-param-req">Required</span></td>
                                        <td>Must be <code>application/json</code></td>
                                    </tr>
                                    <tr>
                                        <td><span className="tn-api-param-name">Authorization</span></td>
                                        <td><code>string</code></td>
                                        <td><span className="tn-api-param-opt">Optional</span></td>
                                        <td><code>Bearer YOUR_API_KEY</code>. If provided, test suites are saved to user workspace history.</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <h3 className="tn-api-subheading-label">Request Body</h3>
                        <div className="tn-api-table-card">
                            <table className="tn-api-table">
                                <thead>
                                    <tr>
                                        <th>Field</th>
                                        <th>Type</th>
                                        <th>Requirement</th>
                                        <th>Description</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>
                                            <span className="tn-api-param-name">requirement</span>
                                            <span className="tn-api-param-type">string</span>
                                        </td>
                                        <td><code>string</code></td>
                                        <td><span className="tn-api-param-req">Required</span></td>
                                        <td>
                                            Software requirement or user story text. Length must be between <strong>20</strong> and <strong>2000</strong> characters.
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <span className="tn-api-param-name">appType</span>
                                            <span className="tn-api-param-type">string</span>
                                        </td>
                                        <td><code>enum</code></td>
                                        <td><span className="tn-api-param-req">Required</span></td>
                                        <td>
                                            Target application ecosystem.
                                            <div>
                                                <span className="tn-api-enum-tag">"web"</span>
                                                <span className="tn-api-enum-tag">"mobile"</span>
                                                <span className="tn-api-enum-tag">"api"</span>
                                            </div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <span className="tn-api-param-name">detailLevel</span>
                                            <span className="tn-api-param-type">string</span>
                                        </td>
                                        <td><code>enum</code></td>
                                        <td><span className="tn-api-param-req">Required</span></td>
                                        <td>
                                            Verification depth and step granularity.
                                            <div>
                                                <span className="tn-api-enum-tag">"basic"</span>
                                                <span className="tn-api-enum-tag">"medium"</span>
                                                <span className="tn-api-enum-tag">"detailed"</span>
                                            </div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <span className="tn-api-param-name">testFocus</span>
                                            <span className="tn-api-param-type">string</span>
                                        </td>
                                        <td><code>enum</code></td>
                                        <td><span className="tn-api-param-opt">Optional</span></td>
                                        <td>
                                            Primary focus area for generated suites. Default is <code>"mixed"</code>.
                                            <div>
                                                <span className="tn-api-enum-tag">"mixed"</span>
                                                <span className="tn-api-enum-tag">"functional"</span>
                                                <span className="tn-api-enum-tag">"non_functional"</span>
                                                <span className="tn-api-enum-tag">"api"</span>
                                            </div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>
                                            <span className="tn-api-param-name">userPersona</span>
                                            <span className="tn-api-param-type">string</span>
                                        </td>
                                        <td><code>enum</code></td>
                                        <td><span className="tn-api-param-opt">Optional</span></td>
                                        <td>
                                            Tone and depth profile for generation. Default is <code>"default"</code>.
                                            <div>
                                                <span className="tn-api-enum-tag">"default"</span>
                                                <span className="tn-api-enum-tag">"sdet"</span>
                                                <span className="tn-api-enum-tag">"product_manager"</span>
                                                <span className="tn-api-enum-tag">"fresher"</span>
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <h3 className="tn-api-subheading-label">Response Attributes (200 OK)</h3>
                        <div className="tn-api-table-card">
                            <table className="tn-api-table">
                                <thead>
                                    <tr>
                                        <th>Field</th>
                                        <th>Type</th>
                                        <th>Description</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td><code>data.feature</code></td>
                                        <td><code>string</code></td>
                                        <td>Derived feature name from requirement analysis.</td>
                                    </tr>
                                    <tr>
                                        <td><code>data.functional</code></td>
                                        <td><code>array</code></td>
                                        <td>List of functional test cases with ID, title, scenario, steps, and expectedResult.</td>
                                    </tr>
                                    <tr>
                                        <td><code>data.negative</code></td>
                                        <td><code>array</code></td>
                                        <td>Negative validation test cases, invalid input payloads, and boundary errors.</td>
                                    </tr>
                                    <tr>
                                        <td><code>data.edge</code></td>
                                        <td><code>array</code></td>
                                        <td>Edge conditions, concurrent triggers, TTL expiration, and race condition tests.</td>
                                    </tr>
                                    <tr>
                                        <td><code>data.apiChecklist</code></td>
                                        <td><code>array</code></td>
                                        <td>Endpoint contracts, response code validations, headers, and security checks.</td>
                                    </tr>
                                    <tr>
                                        <td><code>data.quality</code></td>
                                        <td><code>object</code></td>
                                        <td>Overall quality score (0-100), completeness, and testability ratings.</td>
                                    </tr>
                                    <tr>
                                        <td><code>data.summary</code></td>
                                        <td><code>object</code></td>
                                        <td>Summary counts of total, functional, negative, edge, and non-functional test cases.</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* SECTION: Generation History */}
                    <section id="generation-history" className="tn-api-section">
                        <div className="tn-api-section-header">
                            <div className="tn-api-endpoint-meta-row">
                                <span className="tn-api-method-pill tn-api-method-pill--get">GET</span>
                                <code className="tn-api-path-code">/api/v1/history</code>
                                <span className="tn-api-auth-tag tn-api-auth-tag--required">Auth: Required</span>
                            </div>
                            <h2 className="tn-api-section-title">Generation History</h2>
                            <p className="tn-api-section-desc">
                                Retrieve paginated history of all test suites generated by the authenticated account.
                            </p>
                        </div>

                        <h3 className="tn-api-subheading-label">Query Parameters</h3>
                        <div className="tn-api-table-card">
                            <table className="tn-api-table">
                                <thead>
                                    <tr>
                                        <th>Parameter</th>
                                        <th>Type</th>
                                        <th>Default</th>
                                        <th>Description</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td><span className="tn-api-param-name">limit</span></td>
                                        <td><code>integer</code></td>
                                        <td><code>20</code></td>
                                        <td>Maximum number of records to return per page (max 50).</td>
                                    </tr>
                                    <tr>
                                        <td><span className="tn-api-param-name">page</span></td>
                                        <td><code>integer</code></td>
                                        <td><code>1</code></td>
                                        <td>Page index for pagination.</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* SECTION: Workspace Sessions */}
                    <section id="list-sessions" className="tn-api-section">
                        <div className="tn-api-section-header">
                            <div className="tn-api-endpoint-meta-row">
                                <span className="tn-api-method-pill tn-api-method-pill--get">GET</span>
                                <code className="tn-api-path-code">/api/v1/sessions</code>
                                <span className="tn-api-auth-tag tn-api-auth-tag--required">Auth: Required</span>
                            </div>
                            <h2 className="tn-api-section-title">List Workspace Sessions</h2>
                            <p className="tn-api-section-desc">
                                Fetch active sessions and test suite workspaces created by the authenticated user with search and pagination.
                            </p>
                        </div>

                        <h3 className="tn-api-subheading-label">Query Parameters</h3>
                        <div className="tn-api-table-card">
                            <table className="tn-api-table">
                                <thead>
                                    <tr>
                                        <th>Parameter</th>
                                        <th>Type</th>
                                        <th>Requirement</th>
                                        <th>Description</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td><span className="tn-api-param-name">search</span></td>
                                        <td><code>string</code></td>
                                        <td><span className="tn-api-param-opt">Optional</span></td>
                                        <td>Search query filtering session titles and requirement text.</td>
                                    </tr>
                                    <tr>
                                        <td><span className="tn-api-param-name">page</span></td>
                                        <td><code>integer</code></td>
                                        <td><span className="tn-api-param-opt">Optional</span></td>
                                        <td>Page number (default: 1).</td>
                                    </tr>
                                    <tr>
                                        <td><span className="tn-api-param-name">limit</span></td>
                                        <td><code>integer</code></td>
                                        <td><span className="tn-api-param-opt">Optional</span></td>
                                        <td>Sessions per page (default: 20).</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* SECTION: Create Session */}
                    <section id="create-session" className="tn-api-section">
                        <div className="tn-api-section-header">
                            <div className="tn-api-endpoint-meta-row">
                                <span className="tn-api-method-pill tn-api-method-pill--post">POST</span>
                                <code className="tn-api-path-code">/api/v1/sessions</code>
                                <span className="tn-api-auth-tag tn-api-auth-tag--required">Auth: Required</span>
                            </div>
                            <h2 className="tn-api-section-title">Create Workspace Session</h2>
                            <p className="tn-api-section-desc">
                                Create a persistent workspace session containing requirement specifications, test cases, and version history.
                            </p>
                        </div>

                        <h3 className="tn-api-subheading-label">Request Body</h3>
                        <div className="tn-api-table-card">
                            <table className="tn-api-table">
                                <thead>
                                    <tr>
                                        <th>Field</th>
                                        <th>Type</th>
                                        <th>Requirement</th>
                                        <th>Description</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td><span className="tn-api-param-name">title</span></td>
                                        <td><code>string</code></td>
                                        <td><span className="tn-api-param-opt">Optional</span></td>
                                        <td>Custom title for the suite (e.g. "Checkout Flow v2").</td>
                                    </tr>
                                    <tr>
                                        <td><span className="tn-api-param-name">requirement</span></td>
                                        <td><code>string</code></td>
                                        <td><span className="tn-api-param-req">Required</span></td>
                                        <td>Requirement specification text.</td>
                                    </tr>
                                    <tr>
                                        <td><span className="tn-api-param-name">appType</span></td>
                                        <td><code>enum</code></td>
                                        <td><span className="tn-api-param-opt">Optional</span></td>
                                        <td><code>"web" | "mobile" | "api"</code> (default: "web").</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* SECTION: Get Session Details */}
                    <section id="get-session" className="tn-api-section">
                        <div className="tn-api-section-header">
                            <div className="tn-api-endpoint-meta-row">
                                <span className="tn-api-method-pill tn-api-method-pill--get">GET</span>
                                <code className="tn-api-path-code">/api/v1/sessions/:id</code>
                                <span className="tn-api-auth-tag tn-api-auth-tag--required">Auth: Required</span>
                            </div>
                            <h2 className="tn-api-section-title">Get Session Details</h2>
                            <p className="tn-api-section-desc">
                                Retrieve complete session state including active test cases, coverage breakdown, risks matrix, and requirement traceability.
                            </p>
                        </div>

                        <h3 className="tn-api-subheading-label">Path Parameters</h3>
                        <div className="tn-api-table-card">
                            <table className="tn-api-table">
                                <thead>
                                    <tr>
                                        <th>Parameter</th>
                                        <th>Type</th>
                                        <th>Description</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td><span className="tn-api-param-name">id</span></td>
                                        <td><code>string</code></td>
                                        <td>24-character hexadecimal MongoDB ObjectId representing the session.</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* SECTION: System Health */}
                    <section id="health-check" className="tn-api-section">
                        <div className="tn-api-section-header">
                            <div className="tn-api-endpoint-meta-row">
                                <span className="tn-api-method-pill tn-api-method-pill--get">GET</span>
                                <code className="tn-api-path-code">/health</code>
                                <span className="tn-api-auth-tag">Auth: None</span>
                            </div>
                            <h2 className="tn-api-section-title">System Health Check</h2>
                            <p className="tn-api-section-desc">
                                Public liveness probe returning API service uptime, memory consumption, and status for container health monitoring.
                            </p>
                        </div>
                    </section>
                </main>

                {/* ─── Right Column: Code & Interactive Playground ─── */}
                <aside className="tn-api-code-column">
                    <div className="tn-api-code-card">
                        {/* Header Tabs */}
                        <div className="tn-api-code-header">
                            <div className="tn-api-code-tabs">
                                <button
                                    type="button"
                                    className={`tn-api-tab-btn ${!tryMode && activeLang === 'curl' ? 'active' : ''}`}
                                    onClick={() => { setTryMode(false); setActiveLang('curl'); }}
                                >
                                    cURL
                                </button>
                                <button
                                    type="button"
                                    className={`tn-api-tab-btn ${!tryMode && activeLang === 'javascript' ? 'active' : ''}`}
                                    onClick={() => { setTryMode(false); setActiveLang('javascript'); }}
                                >
                                    JavaScript
                                </button>
                                <button
                                    type="button"
                                    className={`tn-api-tab-btn ${!tryMode && activeLang === 'python' ? 'active' : ''}`}
                                    onClick={() => { setTryMode(false); setActiveLang('python'); }}
                                >
                                    Python
                                </button>
                                <button
                                    type="button"
                                    className={`tn-api-tab-btn ${!tryMode && activeLang === 'node' ? 'active' : ''}`}
                                    onClick={() => { setTryMode(false); setActiveLang('node'); }}
                                >
                                    Node.js
                                </button>
                                <button
                                    type="button"
                                    className={`tn-api-tab-btn ${tryMode ? 'active' : ''}`}
                                    onClick={() => setTryMode(true)}
                                    style={{ color: tryMode ? '#00d9c0' : '#34d399' }}
                                >
                                    ▶ Try It
                                </button>
                            </div>

                            {!tryMode && (
                                <button
                                    type="button"
                                    className="tn-api-copy-btn"
                                    onClick={() => copyToClipboard(CODE_EXAMPLES[activeCodeKey]?.[activeLang] || '', 'codeSnippet')}
                                >
                                    {copiedMap['codeSnippet'] ? <Check size={12} color="#00d9c0" /> : <Copy size={12} />}
                                    <span>{copiedMap['codeSnippet'] ? 'Copied' : 'Copy'}</span>
                                </button>
                            )}
                        </div>

                        {/* Mode 1: Static Code Example */}
                        {!tryMode ? (
                            <>
                                <pre className="tn-api-code-body">
                                    {CODE_EXAMPLES[activeCodeKey]?.[activeLang] || CODE_EXAMPLES.generate.curl}
                                </pre>

                                <div className="tn-api-code-header" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                    <span style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 600 }}>
                                        RESPONSE (200 OK)
                                    </span>
                                    <button
                                        type="button"
                                        className="tn-api-copy-btn"
                                        onClick={() => copyToClipboard(SAMPLE_RESPONSES[activeCodeKey] || SAMPLE_RESPONSES.generate, 'respSnippet')}
                                    >
                                        {copiedMap['respSnippet'] ? <Check size={12} color="#00d9c0" /> : <Copy size={12} />}
                                        <span>{copiedMap['respSnippet'] ? 'Copied' : 'Copy'}</span>
                                    </button>
                                </div>
                                <pre className="tn-api-code-body" style={{ maxHeight: '280px' }}>
                                    {SAMPLE_RESPONSES[activeCodeKey] || SAMPLE_RESPONSES.generate}
                                </pre>
                            </>
                        ) : (
                            /* Mode 2: Interactive Try It Console */
                            <div className="tn-api-try-panel">
                                <div className="tn-api-try-header">
                                    <span className="tn-api-try-title">
                                        <Play size={13} fill="#00d9c0" />
                                        Interactive Request
                                    </span>
                                    <button
                                        type="button"
                                        className="tn-api-copy-btn"
                                        onClick={() => copyToClipboard(CODE_EXAMPLES.generate.curl, 'tryCurl')}
                                    >
                                        {copiedMap['tryCurl'] ? <Check size={12} color="#00d9c0" /> : <Copy size={12} />}
                                        <span>Copy cURL</span>
                                    </button>
                                </div>

                                <div className="tn-api-try-form">
                                    <div className="tn-api-field-group">
                                        <label className="tn-api-field-label">requirement *</label>
                                        <textarea
                                            className="tn-api-field-textarea"
                                            value={tryRequirement}
                                            onChange={(e) => setTryRequirement(e.target.value)}
                                            placeholder="Enter requirement text (min 20 chars)..."
                                        />
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                        <div className="tn-api-field-group">
                                            <label className="tn-api-field-label">appType</label>
                                            <select
                                                className="tn-api-field-select"
                                                value={tryAppType}
                                                onChange={(e) => setTryAppType(e.target.value)}
                                            >
                                                <option value="web">web</option>
                                                <option value="mobile">mobile</option>
                                                <option value="api">api</option>
                                            </select>
                                        </div>

                                        <div className="tn-api-field-group">
                                            <label className="tn-api-field-label">detailLevel</label>
                                            <select
                                                className="tn-api-field-select"
                                                value={tryDetailLevel}
                                                onChange={(e) => setTryDetailLevel(e.target.value)}
                                            >
                                                <option value="detailed">detailed</option>
                                                <option value="medium">medium</option>
                                                <option value="basic">basic</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="tn-api-field-group">
                                        <label className="tn-api-field-label">testFocus</label>
                                        <select
                                            className="tn-api-field-select"
                                            value={tryTestFocus}
                                            onChange={(e) => setTryTestFocus(e.target.value)}
                                        >
                                            <option value="mixed">mixed</option>
                                            <option value="functional">functional</option>
                                            <option value="non_functional">non_functional</option>
                                            <option value="api">api</option>
                                        </select>
                                    </div>

                                    <button
                                        type="button"
                                        className="tn-api-send-btn"
                                        onClick={handleSendTryRequest}
                                        disabled={tryLoading || tryRequirement.trim().length < 20}
                                    >
                                        {tryLoading ? (
                                            <span>Sending Request...</span>
                                        ) : (
                                            <>
                                                <Play size={13} fill="#050505" />
                                                <span>Send Request</span>
                                            </>
                                        )}
                                    </button>
                                </div>

                                {tryResponse && (
                                    <div className="tn-api-try-response">
                                        <div className="tn-api-response-meta">
                                            <span className={`tn-api-status-badge tn-api-status-badge--${tryStatus === 200 ? '200' : '400'}`}>
                                                {tryStatus} {tryStatus === 200 ? 'OK' : tryStatus === 422 ? 'Unprocessable' : tryStatus === 400 ? 'Bad Request' : 'Error'}
                                            </span>
                                            {tryLatency && <span className="tn-api-latency-text">{tryLatency}</span>}
                                        </div>
                                        <pre className="tn-api-code-body" style={{ maxHeight: '260px' }}>
                                            {tryResponse}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </aside>
            </div>
        </div>
    );
};

export default ApiReferencePage;
