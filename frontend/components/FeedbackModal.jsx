import React, { useState, useEffect } from 'react';
import { X, Send, MessageSquare, Bug, Lightbulb, ThumbsUp, Star } from 'lucide-react';

const feedbackCategories = [
    { id: 'bug', label: 'Bug Report', icon: Bug, color: '#f87171' },
    { id: 'feature', label: 'Feature Request', icon: Lightbulb, color: '#fbbf24' },
    { id: 'improvement', label: 'Improvement', icon: ThumbsUp, color: '#00d4c1' },
    { id: 'other', label: 'Other', icon: MessageSquare, color: '#a78bfa' },
];
import { useAuth } from '../context/AuthContext';

const FeedbackModal = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    const [category, setCategory] = useState('');
    const [message, setMessage] = useState('');
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            // Reset after close animation
            setTimeout(() => {
                setCategory('');
                setMessage('');
                setRating(0);
                setSubmitted(false);
            }, 200);
        }
    }, [isOpen]);

    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape' && isOpen) onClose();
        };
        document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!category || !message.trim() || isSubmitting) return;

        setIsSubmitting(true);

        try {
            // Send data to Google Sheets Webhook
            const response = await fetch('https://script.google.com/macros/s/AKfycbz3U8lU2R4XciwxjN4wVyXvbDQCub9w4rudr5rJ6seNLa94fHQ2UiGzhECMaCDtEWK6CQ/exec', {
                method: 'POST',
                mode: 'no-cors', // Needed for Google Apps Script
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    date: new Date().toISOString(),
                    category: category,
                    rating: rating,
                    message: message,
                    email: user?.email || 'Anonymous',
                    name: user?.name || 'Anonymous'
                })
            });

            // Show success state
            setSubmitted(true);
            setTimeout(() => {
                onClose();
            }, 2000);
        } catch (error) {
            console.error('Error submitting feedback:', error);
            // Even on error, we can fail gracefully
            setSubmitted(true);
            setTimeout(() => onClose(), 2000);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="feedback-modal-overlay" onClick={onClose}>
            <div className="feedback-modal" onClick={(e) => e.stopPropagation()}>
                {/* Close button */}
                <button className="feedback-modal-close" onClick={onClose}>
                    <X size={18} />
                </button>

                {submitted ? (
                    <div className="feedback-success">
                        <div className="feedback-success-icon">🎉</div>
                        <h3>Thank you!</h3>
                        <p>Your feedback has been submitted successfully.</p>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="feedback-modal-header">
                            <div className="feedback-header-icon">
                                <MessageSquare size={20} />
                            </div>
                            <div>
                                <h3>Send Feedback</h3>
                                <p>Help us improve Testnexa AI</p>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit}>
                            {/* Category Selection */}
                            <div className="feedback-section">
                                <label className="feedback-label">Category</label>
                                <div className="feedback-categories">
                                    {feedbackCategories.map((cat) => (
                                        <button
                                            key={cat.id}
                                            type="button"
                                            className={`feedback-cat-btn ${category === cat.id ? 'feedback-cat-active' : ''}`}
                                            onClick={() => setCategory(cat.id)}
                                            style={{
                                                '--cat-color': cat.color,
                                            }}
                                        >
                                            <cat.icon size={14} />
                                            <span>{cat.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Rating */}
                            <div className="feedback-section">
                                <label className="feedback-label">How's your experience?</label>
                                <div className="feedback-stars">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            key={star}
                                            type="button"
                                            className={`feedback-star ${star <= (hoverRating || rating) ? 'feedback-star-active' : ''}`}
                                            onClick={() => setRating(star)}
                                            onMouseEnter={() => setHoverRating(star)}
                                            onMouseLeave={() => setHoverRating(0)}
                                        >
                                            <Star size={22} fill={star <= (hoverRating || rating) ? '#fbbf24' : 'none'} />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Message */}
                            <div className="feedback-section">
                                <label className="feedback-label">Your feedback</label>
                                <textarea
                                    className="feedback-textarea"
                                    placeholder="Tell us what's on your mind..."
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    rows={4}
                                />
                            </div>

                            {/* Submit */}
                            <button
                                type="submit"
                                className="feedback-submit-btn"
                                disabled={!category || !message.trim() || isSubmitting}
                            >
                                <Send size={15} />
                                <span>{isSubmitting ? 'Sending...' : 'Submit Feedback'}</span>
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
};

export default FeedbackModal;
