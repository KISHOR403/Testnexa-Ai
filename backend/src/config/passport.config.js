const passport = require('passport');
const mongoose = require('mongoose');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const User = require('../models/user.model');
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

        // 1. Check Supabase first (fastest)
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

        // 2. Check MongoDB if not found
        if (!user && mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(id)) {
            user = await User.findById(id);
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

            // 1. Single-shot fast upsert in Supabase
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
                        isVerified: true
                    };
                } catch (sbErr) {
                    logger.error('Supabase Google fast upsert error:', sbErr);
                }
            }

            // 2. MongoDB fast check if Supabase didn't run
            if (!authenticatedUser && mongoose.connection.readyState === 1) {
                try {
                    let mongoUser = await User.findOne({
                        $or: [{ googleId: profile.id }, { email }]
                    });
                    if (!mongoUser) {
                        isNewUser = true;
                        mongoUser = await User.create({
                            googleId: profile.id,
                            name: displayName,
                            displayName,
                            email,
                            avatar,
                            provider: 'google',
                            isVerified: true
                        });
                    }
                    authenticatedUser = mongoUser;
                } catch (mErr) {
                    logger.warn('Mongo Google auth fallback error:', mErr.message);
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
                    isTemporary: true
                };
            }

            // Return user immediately for fast redirect
            done(null, authenticatedUser);

            // 3. Background tasks (Non-blocking): MongoDB dual-sync & welcome email
            setImmediate(async () => {
                try {
                    if (mongoose.connection.readyState === 1) {
                        let mongoUser = await User.findOne({
                            $or: [{ googleId: profile.id }, { email }]
                        });
                        const now = new Date();
                        if (mongoUser) {
                            mongoUser.googleId = profile.id;
                            mongoUser.lastLogin = now;
                            mongoUser.loginCount = (mongoUser.loginCount || 0) + 1;
                            if (!mongoUser.name) mongoUser.name = displayName;
                            if (!mongoUser.avatar && avatar) mongoUser.avatar = avatar;
                            await mongoUser.save();
                        } else {
                            isNewUser = true;
                            await User.create({
                                googleId: profile.id,
                                name: displayName,
                                displayName,
                                email,
                                avatar,
                                provider: 'google',
                                isVerified: true,
                                lastLogin: now,
                                loginCount: 1
                            });
                        }
                    }

                    if (isNewUser && email) {
                        sendWelcomeEmail(displayName, email).catch(e => logger.warn('Welcome email error:', e.message));
                    }
                } catch (bgErr) {
                    logger.warn('Background MongoDB sync note:', bgErr.message);
                }
            });
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

            // 1. Single-shot fast upsert in Supabase
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
                        isVerified: true
                    };
                } catch (sbErr) {
                    logger.error('Supabase GitHub fast upsert error:', sbErr);
                }
            }

            if (!authenticatedUser && mongoose.connection.readyState === 1) {
                try {
                    let mongoUser = await User.findOne({
                        $or: [{ githubId: profile.id }, { email }]
                    });
                    if (!mongoUser) {
                        isNewUser = true;
                        mongoUser = await User.create({
                            githubId: profile.id,
                            name: displayName,
                            displayName,
                            email,
                            avatar,
                            provider: 'github',
                            isVerified: true
                        });
                    }
                    authenticatedUser = mongoUser;
                } catch (mErr) {
                    logger.warn('Mongo GitHub auth fallback error:', mErr.message);
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
                    isTemporary: true
                };
            }

            // Return user immediately for fast redirect
            done(null, authenticatedUser);

            // 3. Background tasks (Non-blocking): MongoDB dual-sync
            setImmediate(async () => {
                try {
                    if (mongoose.connection.readyState === 1) {
                        let mongoUser = await User.findOne({
                            $or: [{ githubId: profile.id }, { email }]
                        });
                        const now = new Date();
                        if (mongoUser) {
                            mongoUser.githubId = profile.id;
                            mongoUser.lastLogin = now;
                            mongoUser.loginCount = (mongoUser.loginCount || 0) + 1;
                            if (!mongoUser.name) mongoUser.name = displayName;
                            if (!mongoUser.avatar && avatar) mongoUser.avatar = avatar;
                            await mongoUser.save();
                        } else {
                            isNewUser = true;
                            await User.create({
                                githubId: profile.id,
                                name: displayName,
                                displayName,
                                email,
                                avatar,
                                provider: 'github',
                                isVerified: true,
                                lastLogin: now,
                                loginCount: 1
                            });
                        }
                    }

                    if (isNewUser && email) {
                        sendWelcomeEmail(displayName, email).catch(e => logger.warn('Welcome email error:', e.message));
                    }
                } catch (bgErr) {
                    logger.warn('Background MongoDB GitHub sync note:', bgErr.message);
                }
            });
        } catch (err) {
            logger.error('GitHub strategy error:', err);
            done(err, null);
        }
    }));
} else {
    logger.warn('GitHub OAuth credentials missing.');
}

module.exports = passport;
