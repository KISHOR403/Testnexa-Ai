require('dotenv').config();

// Ensure Playwright uses local node_modules browser directory on cloud hosts (Render / container runtimes)
if (process.env.RENDER || (!process.env.PLAYWRIGHT_BROWSERS_PATH && process.env.NODE_ENV === 'production')) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || '0';
}
const express = require('express');
const cors = require('cors');
const supabaseService = require('./services/supabaseData.service');
const session = require('express-session');
const passport = require('./config/passport.config');

const apiRoutes = require('./routes/api.routes');
const authRoutes = require('./routes/auth.routes');

const logger = require('./utils/logger');
const { formatErrorResponse } = require('./utils/errors');

const app = express();
const PORT = process.env.PORT || 5000;

// Database connection status
if (supabaseService.isAvailable) {
    logger.info('✅ Database active: Supabase PostgreSQL connected');
} else {
    logger.warn('⚠️  Supabase URL or Key not set - database operations unavailable');
}

// Trust reverse proxy for secure cookie handling and HTTPS detection behind ELB / Vercel / Nginx
app.set('trust proxy', 1);

// Security Headers Middleware
app.use((req, res, next) => {
    // Prevent MIME-sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Prevent clickjacking / frame embedding
    res.setHeader('X-Frame-Options', 'DENY');
    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Restrict browser features
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');

    // Strict Transport Security (HSTS) - apply when in production or when connection is HTTPS
    if (process.env.NODE_ENV === 'production' || req.secure) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    // Disable caching for sensitive API responses
    if (req.path.startsWith('/api/')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }

    next();
});

// Middleware
app.use(cors({
    origin: function(origin, callback) {
        if (!origin) return callback(null, true);
        if (origin.startsWith('http://localhost:')) {
            return callback(null, true);
        }
        if (origin === process.env.FRONTEND_URL) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'testnexa_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Request logging middleware
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
    });
    next();
});

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1', apiRoutes);
app.use('/api/v1/sessions', require('./routes/session.routes'));
app.use('/api/v1/test-suites', require('./routes/testSuite.routes'));
app.use('/api/v1/copilot', require('./routes/copilot.routes'));
app.use('/api/v1/workspaces', require('./routes/workspace.routes'));
app.use('/api/v1/runs', require('./routes/execution.routes'));

// Admin operational routes (active locally / in deployment, safely omitted in public git)
try {
    const adminRoutes = require('./routes/admin.routes');
    app.use('/api/v1/admin', adminRoutes);
} catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') {
        logger.error('Error mounting admin routes:', e);
    }
}



const { callAI } = require('./services/ai.service');


// Health check endpoint (liveness probe)
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
    });
});

// Readiness probe endpoint
app.get('/ready', (req, res) => {
    if (supabaseService.isAvailable) {
        return res.json({ status: 'READY', db: 'supabase_connected' });
    }
    return res.status(503).json({ status: 'NOT_READY', db: 'supabase_unavailable' });
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        code: 'NOT_FOUND',
        timestamp: new Date().toISOString(),
    });
});

// Global Error Handler
app.use((err, req, res, next) => {
    logger.error('Unhandled error', err);

    const errorResponse = formatErrorResponse(err);
    const statusCode = err.statusCode || 500;

    res.status(statusCode).json(errorResponse);
});

// Start Server
app.listen(PORT, () => {
    logger.info(`🚀 TestNexa AI Backend running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`AI Provider: ${process.env.AI_PROVIDER || 'openai'}`);
});

module.exports = app;
