const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// Persistent inquiry storage helper
const saveInquiryToFile = (inquiry) => {
    try {
        const dataDir = path.join(__dirname, '../../data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        const filePath = path.join(dataDir, 'contact_inquiries.json');
        let records = [];
        if (fs.existsSync(filePath)) {
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                records = JSON.parse(content || '[]');
            } catch (readErr) {
                logger.warn('Could not parse existing inquiries file, initializing new list', readErr.message);
                records = [];
            }
        }
        records.unshift(inquiry);
        // Keep up to 500 most recent inquiries
        if (records.length > 500) {
            records = records.slice(0, 500);
        }
        fs.writeFileSync(filePath, JSON.stringify(records, null, 2), 'utf8');
        return true;
    } catch (saveErr) {
        logger.error('Failed to write inquiry to persistent file:', saveErr);
        return false;
    }
};

/**
 * Handle public contact and support form submissions
 * Includes server-side validation, honeypot spam protection, persistent archive, and email dispatch
 */
exports.submitContact = async (req, res) => {
    try {
        const { firstName, lastName, email, message, company, website } = req.body;

        // 1. Honeypot check: Bots routinely fill hidden 'website' fields
        if (website && String(website).trim().length > 0) {
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

        const referenceId = `TN-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        const inquiryRecord = {
            id: referenceId,
            timestamp: new Date().toISOString(),
            firstName: cleanFirst,
            lastName: cleanLast,
            fullName: `${cleanFirst} ${cleanLast}`.trim(),
            email: cleanEmail,
            company: cleanCompany || 'Not specified',
            message: cleanMessage,
            ip: req.ip || req.connection?.remoteAddress || 'unknown',
            userAgent: req.headers['user-agent'] || 'unknown'
        };

        // 3. Persist inquiry locally so inquiries are never dropped
        const fileSaved = saveInquiryToFile(inquiryRecord);

        // 4. Safe logging
        logger.info('Contact inquiry received and stored', {
            referenceId,
            name: inquiryRecord.fullName,
            email: cleanEmail,
            company: inquiryRecord.company,
            messageLength: cleanMessage.length,
            ip: inquiryRecord.ip
        });

        // 5. Dispatch notification email if SMTP credentials are configured
        let emailSent = false;
        if (process.env.SMTP_USER && process.env.SMTP_PASS) {
            try {
                const transporter = nodemailer.createTransport({
                    host: process.env.SMTP_HOST || 'smtp.gmail.com',
                    port: parseInt(process.env.SMTP_PORT, 10) || 587,
                    secure: parseInt(process.env.SMTP_PORT, 10) === 465,
                    auth: {
                        user: process.env.SMTP_USER,
                        pass: process.env.SMTP_PASS.replace(/\s+/g, '')
                    },
                    connectionTimeout: 8000
                });

                const notificationRecipient = process.env.SUPPORT_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER;

                await transporter.sendMail({
                    from: `"TestNexa AI Inquiries" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
                    to: notificationRecipient,
                    replyTo: cleanEmail,
                    subject: `[TestNexa Contact - ${referenceId}] New message from ${inquiryRecord.fullName}`,
                    text: `Reference ID: ${referenceId}\nName: ${inquiryRecord.fullName}\nEmail: ${cleanEmail}\nCompany: ${cleanCompany || 'N/A'}\n\nMessage:\n${cleanMessage}`,
                    html: `
                        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 620px; padding: 24px; background: #080909; color: #F2F3F3; border: 1px solid #292D2D; border-radius: 8px;">
                            <div style="border-bottom: 1px solid #292D2D; padding-bottom: 16px; margin-bottom: 20px;">
                                <h2 style="color: #8BAF9A; margin: 0 0 6px 0; font-size: 1.25rem;">New Inbound Contact Inquiry</h2>
                                <span style="font-size: 0.8rem; color: #777E7E;">Reference: ${referenceId}</span>
                            </div>
                            <p style="margin: 6px 0;"><strong>Name:</strong> ${inquiryRecord.fullName}</p>
                            <p style="margin: 6px 0;"><strong>Email:</strong> <a href="mailto:${cleanEmail}" style="color: #8BAF9A; text-decoration: none;">${cleanEmail}</a></p>
                            <p style="margin: 6px 0;"><strong>Company:</strong> ${cleanCompany || 'Not specified'}</p>
                            <div style="margin: 20px 0; padding: 16px; background: #101112; border: 1px solid #292D2D; border-radius: 6px;">
                                <p style="white-space: pre-wrap; line-height: 1.6; margin: 0; color: #F2F3F3;">${cleanMessage}</p>
                            </div>
                            <p style="font-size: 0.75rem; color: #777E7E; margin-top: 24px; border-top: 1px solid #292D2D; padding-top: 12px;">
                                Received on ${new Date().toUTCString()} from IP ${inquiryRecord.ip}
                            </p>
                        </div>
                    `
                });
                emailSent = true;
            } catch (mailErr) {
                logger.warn('Failed to send contact notification email:', mailErr?.message || mailErr);
            }
        }

        // 6. Fail-safe delivery verification:
        // If neither persistent storage succeeded nor email delivery succeeded, return 500
        if (!fileSaved && !emailSent) {
            return res.status(500).json({
                success: false,
                message: 'We were temporarily unable to record your inquiry. Please try again or email support@testnexa.ai directly.'
            });
        }

        return res.status(200).json({
            success: true,
            referenceId,
            message: 'Thank you for contacting TestNexa. Our team has received your message and will respond within 1 business day.'
        });

    } catch (err) {
        logger.error('Error handling contact form submission:', err);
        return res.status(500).json({
            success: false,
            message: 'An unexpected error occurred while submitting your message. Please try again or email support@testnexa.ai directly.'
        });
    }
};
