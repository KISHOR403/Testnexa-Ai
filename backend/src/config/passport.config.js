const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const supabaseService = require('../services/supabaseData.service');
const { sendWelcomeEmail } = require('../services/email.service');
const logger = require('../utils/logger');

passport.serializeUser((user, done) => {
    try {
        const userId = user.id || user._id;
        if (!userId) {
            return done(new Error('Cannot serialize user: no id found'));
        }
        done(null, userId.toString());
    } catch (err) {
        done(err);
    }
});

passport.deserializeUser(async (id, done) => {
    try {
        if (typeof id === 'string' && id.startsWith('guest_')) {
            return done(null, { _id: id, id, isTemporary: true });
        }

        let user = null;

        if (supabaseService.isAvailable) {
            const sbUser = await supabaseService.findUserById(id);
            if (sbUser) {
                user = {
                    _id: sbUser.id,
                    id: sbUser.id,
                    name: sbUser.name,
                    displayName: sbUser.display_name || sbUser.name,
                    email: sbUser.email,
                    avatar: sbUser.avatar,
                    provider: sbUser.provider,
                    totalTestsGenerated: sbUser.total_tests_generated || 0,
                    createdAt: sbUser.created_at
                };
            }
        }

        done(null, user);
    } catch (err) {
        logger.error('Deserialize user error:', err);
        done(err, null);
    }
});

// Google Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
        proxy: true
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
            const displayName = profile.displayName || (profile.name ? `${profile.name.givenName || ''} ${profile.name.familyName || ''}`.trim() : 'Google User');
            const avatar = profile.photos && profile.photos[0] ? profile.photos[0].value : null;

            let authenticatedUser = null;
            let isNewUser = false;

            if (supabaseService.isAvailable && email) {
                try {
                    const existingSb = await supabaseService.findUserByEmail(email);
                    if (!existingSb) isNewUser = true;

                    const sbUser = await supabaseService.upsertOAuthUser({
                        email,
                        name: displayName,
                        avatar,
                        provider: 'google'
                    });

                    authenticatedUser = {
                        _id: sbUser.id,
                        id: sbUser.id,
                        email: sbUser.email,
                        name: sbUser.name,
                        displayName: sbUser.display_name || sbUser.name,
                        avatar: sbUser.avatar,
                        provider: 'google',
                        isVerified: true,
                        isNewUser
                    };
                } catch (sbErr) {
                    logger.error('Supabase Google fast upsert error:', sbErr);
                }
            }

            if (!authenticatedUser) {
                authenticatedUser = {
                    _id: 'guest_' + profile.id,
                    id: 'guest_' + profile.id,
                    googleId: profile.id,
                    displayName,
                    email,
                    avatar,
                    isTemporary: true,
                    isNewUser
                };
            }

            authenticatedUser.isNewUser = isNewUser;
            done(null, authenticatedUser);

            // Background welcome email if new user
            if (isNewUser && email) {
                setImmediate(async () => {
                    try {
                        logger.info(`[OAuth Google] Dispatching welcome email to ${email}`);
                        await sendWelcomeEmail(displayName, email);
                    } catch (mailErr) {
                        logger.warn('[OAuth Google] Welcome email error:', mailErr?.message || mailErr);
                    }
                });
            }
        } catch (err) {
            logger.error('Google strategy error:', err);
            done(err, null);
        }
    }));
} else {
    logger.warn('Google OAuth credentials missing.');
}

// GitHub Strategy
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET && process.env.GITHUB_CLIENT_ID !== 'your_github_client_id_here') {
    passport.use(new GitHubStrategy({
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: process.env.GITHUB_CALLBACK_URL,
        proxy: true
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails && profile.emails[0] ? profile.emails[0].value : `${profile.username}@github.com`;
            const displayName = profile.displayName || profile.username || 'GitHub User';
            const avatar = profile.photos && profile.photos[0] ? profile.photos[0].value : null;

            let authenticatedUser = null;
            let isNewUser = false;

            if (supabaseService.isAvailable && email) {
                try {
                    const existingSb = await supabaseService.findUserByEmail(email);
                    if (!existingSb) isNewUser = true;

                    const sbUser = await supabaseService.upsertOAuthUser({
                        email,
                        name: displayName,
                        avatar,
                        provider: 'github'
                    });

                    authenticatedUser = {
                        _id: sbUser.id,
                        id: sbUser.id,
                        email: sbUser.email,
                        name: sbUser.name,
                        displayName: sbUser.display_name || sbUser.name,
                        avatar: sbUser.avatar,
                        provider: 'github',
                        isVerified: true,
                        isNewUser
                    };
                } catch (sbErr) {
                    logger.error('Supabase GitHub fast upsert error:', sbErr);
                }
            }

            if (!authenticatedUser) {
                authenticatedUser = {
                    _id: 'guest_' + profile.id,
                    id: 'guest_' + profile.id,
                    githubId: profile.id,
                    displayName,
                    email,
                    avatar,
                    isTemporary: true,
                    isNewUser
                };
            }

            authenticatedUser.isNewUser = isNewUser;
            done(null, authenticatedUser);

            if (isNewUser && email) {
                setImmediate(async () => {
                    try {
                        logger.info(`[OAuth GitHub] Dispatching welcome email to ${email}`);
                        await sendWelcomeEmail(displayName, email);
                    } catch (mailErr) {
                        logger.warn('[OAuth GitHub] Welcome email error:', mailErr?.message || mailErr);
                    }
                });
            }
        } catch (err) {
            logger.error('GitHub strategy error:', err);
            done(err, null);
        }
    }));
} else {
    logger.warn('GitHub OAuth credentials missing.');
}

module.exports = passport;
