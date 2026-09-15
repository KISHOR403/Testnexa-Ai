const nodemailer = require('nodemailer');

/**
 * Creates a Nodemailer transporter from environment variables.
 */
const createTransporter = () => {
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS ? process.env.SMTP_PASS.replace(/\s+/g, '') : '';
    
    // For Gmail accounts, using service: 'gmail' is much more reliable and standard
    if (user && user.endsWith('@gmail.com')) {
        return nodemailer.createTransport({
            service: 'gmail',
            auth: { user, pass },
            connectionTimeout: 10000,
            greetingTimeout: 5000,
            socketTimeout: 10000
        });
    }

    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: parseInt(process.env.SMTP_PORT) === 465,
        auth: { user, pass },
        connectionTimeout: 10000,
        greetingTimeout: 5000,
        socketTimeout: 10000,
        tls: { rejectUnauthorized: false }
    });
};

/**
 * Sends a welcome email to a newly registered user.
 *
 * @param {string} name - The user's display name
 * @param {string} email - The user's email address
 */
const sendWelcomeEmail = async (name, email) => {
    try {
        if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
            console.warn('⚠️  SMTP credentials not configured — skipping welcome email');
            return { success: false, message: 'SMTP credentials missing' };
        }

        const transporter = createTransporter();
        const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;

        const mailOptions = {
            from: `"Testnexa AI" <${fromAddress}>`,
            to: email,
            subject: 'Welcome to Testnexa AI! 🚀',
            html: `
                <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f0f1a; border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);">
                    <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7); padding: 40px 30px; text-align: center;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Welcome to Testnexa AI</h1>
                        <p style="color: rgba(255,255,255,0.85); margin: 10px 0 0; font-size: 16px;">AI-Powered Test Case Generation</p>
                    </div>
                    <div style="padding: 30px; color: #e2e8f0; background: #13141f;">
                        <p style="font-size: 18px; margin-top: 0;">Hi <strong>${name || 'there'}</strong>,</p>
                        <p style="font-size: 15px; line-height: 1.7; color: #cbd5e1;">
                            Thanks for signing up! You now have access to our AI-powered platform for generating comprehensive test cases from your requirements.
                        </p>
                        <div style="background: rgba(99, 102, 241, 0.1); border-left: 4px solid #6366f1; padding: 15px 20px; border-radius: 0 8px 8px 0; margin: 20px 0;">
                            <p style="margin: 0; font-size: 14px; color: #a5b4fc; font-weight: 600;">Here is what you can do:</p>
                            <ul style="color: #cbd5e1; font-size: 14px; line-height: 1.8; padding-left: 20px; margin: 8px 0 0;">
                                <li>Generate complete test cases from requirements</li>
                                <li>Select test depth, context (Web, Mobile, API), and QA focus</li>
                                <li>Export directly into Jira, Markdown, or Excel</li>
                            </ul>
                        </div>
                        <p style="font-size: 14px; color: #94a3b8; margin-bottom: 0;">
                            Happy testing!<br/>
                            <strong style="color: #a5b4fc;">The Testnexa AI Team</strong>
                        </p>
                    </div>
                    <div style="background: #0a0a12; padding: 15px 30px; text-align: center;">
                        <p style="margin: 0; font-size: 12px; color: #64748b;">
                            © ${new Date().getFullYear()} Testnexa AI. All rights reserved.
                        </p>
                    </div>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Welcome email sent to ${email}: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error(`❌ Failed to send welcome email to ${email}:`, error.message);
        return { success: false, error: error.message };
    }
};

/**
 * Sends a password reset email with a secure link.
 *
 * @param {string} email - The user's email address
 * @param {string} resetUrl - The full URL containing the reset token
 */
const sendPasswordResetEmail = async (email, resetUrl) => {
    try {
        if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
             console.warn('⚠️  SMTP credentials not configured — skipping password reset email');
             return { success: false, message: 'Email service not configured.' };
        }

        const transporter = createTransporter();
        const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;

        const mailOptions = {
            from: `"Testnexa AI" <${fromAddress}>`,
            to: email,
            subject: 'Password Reset Request 🔐',
            html: `
                <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f0f1a; border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);">
                    <div style="background: linear-gradient(135deg, #0f172a, #1e293b); padding: 40px 30px; text-align: center; border-bottom: 2px solid #00d4c1;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700;">Password Reset</h1>
                    </div>
                    <div style="padding: 30px; color: #e2e8f0; background: #13141f;">
                         <p style="font-size: 16px; margin-top: 0; line-height: 1.6;">Hello,</p>
                         <p style="font-size: 15px; line-height: 1.7; color: #cbd5e1;">
                             You are receiving this email because you (or someone else) have requested the reset of a password for your account.
                         </p>
                         <div style="text-align: center; margin: 30px 0;">
                             <a href="${resetUrl}" style="background: linear-gradient(135deg, #00d4c1, #00b3a3); color: #000; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(0, 212, 193, 0.3);">Reset Password</a>
                         </div>
                         <p style="font-size: 15px; line-height: 1.7; color: #cbd5e1;">
                             Or copy and paste this link into your browser: <br/>
                             <a href="${resetUrl}" style="color: #00d4c1; word-break: break-all;">${resetUrl}</a>
                         </p>
                         <p style="font-size: 14px; color: #94a3b8; margin-bottom: 0; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
                             If you did not request this, please ignore this email and your password will remain unchanged. This link will expire in 15 minutes.
                         </p>
                    </div>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ Password reset email sent to ${email}`);
        return { success: true };
    } catch (error) {
        console.error(`❌ Failed to send password reset email to ${email}:`, error.message);
        return { success: false, message: 'Email could not be sent.' };
    }
};

module.exports = { sendWelcomeEmail, sendPasswordResetEmail };
