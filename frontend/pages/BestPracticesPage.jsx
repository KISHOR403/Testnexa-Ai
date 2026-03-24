import React from 'react';
import { Lightbulb, Target, Settings, GitPullRequest, CheckCircle2 } from 'lucide-react';

const BestPracticesPage = () => {
    return (
        <div className="help-page bp-page-container">
            <div className="container">
                <div className="terms-header bp-header">
                    <div className="terms-icon-wrapper bp-icon-wrapper">
                        <Lightbulb size={48} className="icon-secondary" />
                    </div>
                    <h1 className="terms-title bp-title">Best Practices</h1>
                    <p className="terms-subtitle bp-subtitle">
                        Learn how to write better prompts and get the most accurate test cases out of TestNexa AI.
                    </p>
                </div>

                <div className="bp-grid">
                    <div className="glass-card bp-card">
                        <div className="bp-card-header">
                            <Target className="icon-primary" size={24} />
                            <h3 className="bp-card-title">Writing Prompts</h3>
                        </div>
                        <ul className="bp-list">
                            <li className="bp-list-item">
                                <CheckCircle2 className="bp-icon-success" size={18} />
                                <span><strong>Be Specific:</strong> Include roles, conditions, and exact expected outcomes.</span>
                            </li>
                            <li className="bp-list-item">
                                <CheckCircle2 className="bp-icon-success" size={18} />
                                <span><strong>Use Given/When/Then:</strong> BDD formats yield highly structured test cases.</span>
                            </li>
                            <li className="bp-list-item">
                                <CheckCircle2 className="bp-icon-success" size={18} />
                                <span><strong>Include Constraints:</strong> Mention character limits, valid formats, and timeouts.</span>
                            </li>
                        </ul>
                    </div>

                    <div className="glass-card bp-card">
                        <div className="bp-card-header">
                            <Settings className="icon-purple" size={24} />
                            <h3 className="bp-card-title">Test Configuration</h3>
                        </div>
                        <ul className="bp-list">
                            <li className="bp-list-item">
                                <CheckCircle2 className="bp-icon-success" size={18} />
                                <span><strong>Select relevant types:</strong> Don't request API tests for pure UI components.</span>
                            </li>
                            <li className="bp-list-item">
                                <CheckCircle2 className="bp-icon-success" size={18} />
                                <span><strong>Iterative generation:</strong> Generate functional first, refine the prompt, then generate negative cases.</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BestPracticesPage;
