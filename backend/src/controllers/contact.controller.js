const logger = require('../utils/logger');
const nodemailer = require('nodemailer');

const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

/**
 * Handle public contact and support form submissions
 * Includes server-side validation, honeypot spam protection, and email/log dispatch
 */
exports.submitContact = async (req, res) => {
    try {
        const { firstName, lastName, email, message, company, website } = req.body;

        // 1. Honeypot check: Bots routinely fill hidden 'website' fields
        if (website && website.trim().length > 0) {
            logger.warn('Spam submission detected via honeypot field', { ip: req.ip });
            // Return silent 200 OK so bots believe submission succeeded
            return res.status(200).json({
                success: true,
                message: 'Thank you for reaching out. We have received your message.'
            });
        }

        // 2. Server-side validation
        const cleanFirst = (firstName || '').trim();
        const cleanLast = (lastName || '').trim();
        const cleanEmail = (email || '').trim().toLowerCase();
        const cleanMessage = (message || '').trim();
        const cleanCompany = (company || '').trim();

        if (!cleanFirst || cleanFirst.length < 2) {
            return res.status(400).json({
                success: false,
                message: 'First name is required (minimum 2 characters).'
            });
        }

        if (cleanFirst.length > 50 || cleanLast.length > 50) {
            return res.status(400).json({
                success: false,
                message: 'Name fields cannot exceed 50 characters.'
            });
        }

        if (!cleanEmail || !isValidEmail(cleanEmail) || cleanEmail.length > 255) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid work email address.'
            });
        }

        if (!cleanMessage || cleanMessage.length < 10) {
            return res.status(400).json({
                success: false,
                message: 'Message must be at least 10 characters in length.'
            });
        }

        if (cleanMessage.length > 2000) {
            return res.status(400).json({
                success: false,
                message: 'Message cannot exceed 2000 characters.'
            });
        }

        // 3. Log submission safely (without logging sensitive credentials)
        logger.info('Contact form submission received', {
            name: `${cleanFirst} ${cleanLast}`.trim(),
            email: cleanEmail,
            company: cleanCompany || 'Not specified',
            messageLength: cleanMessage.length,
            ip: req.ip
        });

        // 4. Dispatch notification email if SMTP credentials are configured
        if (process.env.SMTP_USER && process.env.SMTP_PASS) {
            try {
                const transporter = nodemailer.createTransport({
                    host: process.env.SMTP_HOST || 'smtp.gmail.com',
                    port: parseInt(process.env.SMTP_PORT) || 587,
                    secure: parseInt(process.env.SMTP_PORT) === 465,
                    auth: {
                        user: process.env.SMTP_USER,
                        pass: process.env.SMTP_PASS.replace(/\s+/g, '')
                    },
                    connectionTimeout: 10000
                });

                const notificationRecipient = process.env.SUPPORT_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER;

                await transporter.sendMail({
                    from: `"TestNexa Inquiries" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
                    to: notificationRecipient,
                    replyTo: cleanEmail,
                    subject: `[TestNexa Contact] New message from ${cleanFirst} ${cleanLast}`,
                    text: `Name: ${cleanFirst} ${cleanLast}\nEmail: ${cleanEmail}\nCompany: ${cleanCompany || 'N/A'}\n\nMessage:\n${cleanMessage}`,
                    html: `
                        <div style="font-family: sans-serif; max-width: 600px; padding: 20px; background: #0A0A0A; color: #F5F5F5; border: 1px solid #1C1C1C; border-radius: 8px;">
                            <h2 style="color: #00D9C0; margin-top: 0;">New Contact Form Submission</h2>
                            <p><strong>Name:</strong> ${cleanFirst} ${cleanLast}</p>
                            <p><strong>Email:</strong> <a href="mailto:${cleanEmail}" style="color: #00D9C0;">${cleanEmail}</a></p>
                            <p><strong>Company:</strong> ${cleanCompany || 'N/A'}</p>
                            <hr style="border: 0; border-top: 1px solid #1C1C1C; margin: 20px 0;" />
                            <p style="white-space: pre-wrap; line-height: 1.6;">${cleanMessage}</p>
                        </div>
                    `
                });
            } catch (mailErr) {
                logger.warn('Failed to send contact notification email:', mailErr?.message || mailErr);
            }
        }

        return res.status(200).json({
            success: true,
            message: 'Thank you for contacting TestNexa. Our team has received your message and will respond shortly.'
        });

    } catch (err) {
        logger.error('Error handling contact form submission:', err);
        return res.status(500).json({
            success: false,
            message: 'An unexpected error occurred while submitting your message. Please try again or email support@testnexa.ai directly.'
        });
    }
};
