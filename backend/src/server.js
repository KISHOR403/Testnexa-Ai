require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('./config/passport.config');

const apiRoutes = require('./routes/api.routes');
const authRoutes = require('./routes/auth.routes');

const logger = require('./utils/logger');
const { formatErrorResponse } = require('./utils/errors');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB with timeout
if (process.env.MONGODB_URI) {
    mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds
        socketTimeoutMS: 45000,
    })
        .then(() => logger.info('✅ Connected to MongoDB'))
        .catch(err => {
            logger.error('❌ MongoDB connection error:', err);
            logger.warn('⚠️  Running without MongoDB - authentication features will be limited');
        });
} else {
    logger.warn('⚠️  MONGODB_URI not configured - running without database');
}

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



const { callAI } = require('./services/ai.service');


// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
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
