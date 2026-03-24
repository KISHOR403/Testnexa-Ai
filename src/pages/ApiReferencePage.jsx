import React from 'react';
import { BookOpen, Code, Server, Zap, Shield, FileJson } from 'lucide-react';

const ApiReferencePage = () => {
    return (
        <div className="help-page api-page-container">
            <div className="container">
                <div className="terms-header api-header">
                    <div className="terms-icon-wrapper api-icon-wrapper">
                        <Code size={48} className="icon-primary" />
                    </div>
                    <h1 className="terms-title api-title">API Reference</h1>
                    <p className="terms-subtitle api-subtitle">
                        Integrate TestNexa AI directly into your CI/CD pipelines and custom tools.
                    </p>
                </div>

                <div className="glass-card api-card">
                    <div className="api-section-header">
                        <Server className="icon-primary" />
                        <h2 className="api-section-title">Authentication</h2>
                    </div>
                    <p className="api-text">
                        All API requests require a Bearer token in the Authorization header. You can generate API keys from your account settings.
                    </p>
                    <div className="api-code-block">
                        Authorization: Bearer YOUR_API_KEY
                    </div>

                    <div className="api-endpoint-group">
                        {/* Endpoint 1 */}
                        <div className="api-endpoint-item">
                            <div className="api-endpoint-header">
                                <span className="api-method-badge">POST</span>
                                <code className="api-route">/api/v1/generate</code>
                            </div>
                            <p className="api-text">Generates test cases from provided requirements text.</p>
                            
                            <h4 className="api-label">Request Body (JSON)</h4>
                            <div className="api-code-block">
                                <pre>{`{
  "prompt": "As a user, I want to reset my password using my email address.",
  "types": ["functional", "negative", "edge_case"],
  "format": "json"
}`}</pre>
                            </div>

                            <h4 className="api-label">Response (200 OK)</h4>
                            <div className="api-code-block">
                                <pre>{`{
  "status": "success",
  "data": {
    "testCases": [ ... ]
  }
}`}</pre>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ApiReferencePage;
