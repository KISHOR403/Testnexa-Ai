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
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const workspaceUrl = `${frontendUrl}/app/workspace`;

        const mailOptions = {
            from: `"Testnexa AI" <${fromAddress}>`,
            to: email,
            subject: 'Welcome to Testnexa AI — Production-Ready QA at Scale 🚀',
            html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0B0F19; border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); color: #f1f5f9;">
                    <!-- Header -->
                    <div style="background: linear-gradient(135deg, #090D16 0%, #111827 100%); padding: 36px 30px; text-align: center; border-bottom: 1px solid rgba(0, 212, 193, 0.2);">
                        <div style="display: inline-block; padding: 8px 16px; background: rgba(0, 212, 193, 0.1); border: 1px solid rgba(0, 212, 193, 0.3); border-radius: 20px; margin-bottom: 14px;">
                            <span style="color: #00d4c1; font-size: 13px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase;">Enterprise AI QA Platform</span>
                        </div>
                        <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">Welcome to Testnexa AI</h1>
                        <p style="color: #94a3b8; margin: 8px 0 0; font-size: 15px;">Turn Requirements Into Production-Ready Test Suites</p>
                    </div>

                    <!-- Body -->
                    <div style="padding: 32px 30px; background: #0F1523;">
                        <p style="font-size: 16px; margin-top: 0; color: #ffffff;">Hi <strong>${name || 'there'}</strong>,</p>
                        <p style="font-size: 14px; line-height: 1.7; color: #cbd5e1; margin-bottom: 24px;">
                            Thank you for joining <strong>Testnexa AI</strong>. Your workspace is ready to transform product specs, user stories, and API definitions into comprehensive, enterprise-grade test suites in seconds.
                        </p>

                        <!-- CTA Button -->
                        <div style="text-align: center; margin: 28px 0;">
                            <a href="${workspaceUrl}" style="background: #00d4c1; color: #070a12; text-decoration: none; padding: 13px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block; box-shadow: 0 4px 14px rgba(0, 212, 193, 0.35); letter-spacing: 0.2px;">
                                Launch TestNexa Workspace →
                            </a>
                        </div>

                        <!-- Feature Box -->
                        <div style="background: rgba(0, 212, 193, 0.04); border: 1px solid rgba(0, 212, 193, 0.18); border-radius: 8px; padding: 20px; margin: 24px 0;">
                            <p style="margin: 0 0 10px 0; font-size: 14px; color: #00d4c1; font-weight: 600;">What you can do right away:</p>
                            <ul style="color: #94a3b8; font-size: 13px; line-height: 1.8; padding-left: 20px; margin: 0;">
                                <li><strong style="color: #e2e8f0;">AI Test Generation:</strong> Generate BDD, regression, smoke, and boundary tests automatically.</li>
                                <li><strong style="color: #e2e8f0;">Context Aware:</strong> Target Web, Mobile, API, or Microservices architectures.</li>
                                <li><strong style="color: #e2e8f0;">One-Click Export:</strong> Export tests directly to Jira, Gherkin, Markdown, or Excel.</li>
                            </ul>
                        </div>

                        <p style="font-size: 13px; line-height: 1.6; color: #64748b; margin-bottom: 0;">
                            Need assistance or have questions? Simply reply to this email or visit our help center.<br/><br/>
                            Best regards,<br/>
                            <strong style="color: #e2e8f0;">The Testnexa AI Engineering Team</strong>
                        </p>
                    </div>

                    <!-- Footer -->
                    <div style="background: #090D16; padding: 18px 30px; text-align: center; border-top: 1px solid rgba(255,255,255,0.06);">
                        <p style="margin: 0; font-size: 12px; color: #475569;">
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
