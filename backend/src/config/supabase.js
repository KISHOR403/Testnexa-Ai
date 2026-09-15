require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

const supabaseUrl = process.env.SUPABASE_URL;
// Use secret key if available for backend operations, fallback to publishable key
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

let supabase = null;

if (supabaseUrl && supabaseKey) {
    try {
        supabase = createClient(supabaseUrl, supabaseKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            }
        });
        logger.info('✅ Supabase client initialized');
    } catch (err) {
        logger.error('❌ Failed to initialize Supabase client:', err);
    }
} else {
    logger.warn('⚠️  Supabase URL or Key not set in environment variables');
}

module.exports = supabase;
