import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, NavLink } from 'react-router-dom';
import { Building2, CheckCircle2, XCircle, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { organizationService } from '../../services/organizationService';
import { useAuth } from '../../context/AuthContext';
import '../../styles/app/OrganizationManagement.css';

const InvitationAcceptancePage = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    const { isAuthenticated, user } = useAuth();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [status, setStatus] = useState('pending'); // 'pending', 'accepted', 'rejected', 'error'
    const [errorMessage, setErrorMessage] = useState('');

    const handleAccept = async () => {
        setIsSubmitting(true);
        setErrorMessage('');
        try {
            await organizationService.acceptInvitation(token);
            setStatus('accepted');
            setTimeout(() => {
                navigate('/app/organization');
            }, 2000);
        } catch (err) {
            setStatus('error');
            setErrorMessage(err.message || 'Failed to accept invitation');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReject = async () => {
        setIsSubmitting(true);
        try {
            await organizationService.rejectInvitation(token);
            setStatus('rejected');
        } catch (err) {
            setErrorMessage(err.message || 'Failed to decline invitation');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B0F12', padding: '1.5rem' }}>
            <div className="org-card" style={{ maxWidth: '480px', width: '100%', textAlign: 'center', padding: '2.5rem 2rem' }}>
                <div style={{ width: '48px', height: '48px', backgroundColor: 'rgba(139, 175, 154, 0.15)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                    <Building2 size={24} color="#8BAF9A" />
                </div>

                <h2 style={{ fontSize: '1.5rem', color: '#F8FAFC', margin: '0 0 0.5rem' }}>
                    Team Organization Invitation
                </h2>
                <p style={{ fontSize: '0.875rem', color: '#94A3B8', margin: '0 0 1.5rem', lineHeight: 1.5 }}>
                    You have been invited to collaborate on QA test suites, Playwright executions, and team workspaces.
                </p>

                {errorMessage && (
                    <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#F87171', padding: '0.75rem', borderRadius: '6px', fontSize: '0.8125rem', marginBottom: '1.5rem' }}>
                        <AlertCircle size={14} style={{ display: 'inline', marginRight: '6px' }} />
                        {errorMessage}
                    </div>
                )}

                {status === 'accepted' ? (
                    <div>
                        <div style={{ color: '#8BAF9A', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                            <CheckCircle2 size={20} />
                            Invitation Accepted!
                        </div>
                        <p style={{ fontSize: '0.8125rem', color: '#94A3B8' }}>
                            Redirecting you to your team workspaces...
                        </p>
                    </div>
                ) : status === 'rejected' ? (
                    <div>
                        <div style={{ color: '#94A3B8', fontSize: '1rem', fontWeight: 500, marginBottom: '0.5rem' }}>
                            Invitation Declined
                        </div>
                        <NavLink to="/" className="cicd-btn cicd-btn--secondary" style={{ marginTop: '1rem', textDecoration: 'none' }}>
                            Return Home
                        </NavLink>
                    </div>
                ) : (
                    <div>
                        {!isAuthenticated ? (
                            <div>
                                <p style={{ fontSize: '0.8125rem', color: '#F87171', marginBottom: '1rem' }}>
                                    Please sign in or create an account to accept this invitation.
                                </p>
                                <NavLink to="/login" className="cicd-btn cicd-btn--primary" style={{ width: '100%', justifyContent: 'center', textDecoration: 'none' }}>
                                    Sign In to Accept
                                    <ArrowRight size={14} />
                                </NavLink>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                                <button
                                    className="cicd-btn cicd-btn--secondary"
                                    onClick={handleReject}
                                    disabled={isSubmitting}
                                >
                                    Decline
                                </button>
                                <button
                                    className="cicd-btn cicd-btn--primary"
                                    onClick={handleAccept}
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? 'Joining Team...' : 'Accept Invitation'}
                                    <ShieldCheck size={16} />
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default InvitationAcceptancePage;
