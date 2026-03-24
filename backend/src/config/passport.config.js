const passport = require('passport');
const mongoose = require('mongoose');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const User = require('../models/user.model');

passport.serializeUser((user, done) => {
    try {
        const userId = user._id || user.id;
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
        // Handle guest/temporary users
        if (typeof id === 'string' && id.startsWith('guest_')) {
            return done(null, { _id: id, isTemporary: true });
        }

        // Check if MongoDB is connected
        if (mongoose.connection.readyState !== 1) {
            return done(null, null);
        }

        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        if (err.name === 'MongooseError' || err.message.includes('buffering timed out')) {
            console.warn('MongoDB not available, continuing as guest');
            return done(null, null);
        }
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
            // Check if MongoDB is connected
            if (mongoose.connection.readyState !== 1) {
                console.warn('MongoDB not connected, allowing Google login in guest mode');
                // Return a shadow user if DB is down
                return done(null, {
                    _id: 'guest_' + profile.id,
                    googleId: profile.id,
                    displayName: profile.displayName,
                    email: profile.emails[0].value,
                    avatar: profile.photos[0].value,
                    isTemporary: true
                });
            }

            // Check if user already exists with this Google ID
            let user = await User.findOne({ googleId: profile.id });

            if (user) {
                return done(null, user);
            }

            // Check if user exists with this email but no Google ID linked
            const email = profile.emails[0].value;
            user = await User.findOne({ email });

            if (user) {
                // Link Google ID to existing account
                user.googleId = profile.id;
                if (!user.avatar) user.avatar = profile.photos[0].value;
                await user.save();
                return done(null, user);
            }

            // If no user exists at all, create a new one
            user = await User.create({
                googleId: profile.id,
                displayName: profile.displayName,
                email: email,
                avatar: profile.photos[0].value
            });

            done(null, user);
        } catch (err) {
            done(err, null);
        }
    }));
} else {
    console.warn('Google OAuth credentials missing. Google login will not work.');
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
            // Check if MongoDB is connected
            if (mongoose.connection.readyState !== 1) {
                console.warn('MongoDB not connected, allowing GitHub login in guest mode');
                // Return a shadow user if DB is down
                return done(null, {
                    _id: 'guest_' + profile.id,
                    githubId: profile.id,
                    displayName: profile.displayName || profile.username,
                    email: profile.emails ? profile.emails[0].value : `${profile.username}@github.com`,
                    avatar: profile.photos ? profile.photos[0].value : null,
                    isTemporary: true
                });
            }

            // Check if user already exists with this GitHub ID
            let user = await User.findOne({ githubId: profile.id });

            if (user) {
                return done(null, user);
            }

            // Check if user exists with this email but no GitHub ID linked
            const email = profile.emails ? profile.emails[0].value : `${profile.username}@github.com`;
            user = await User.findOne({ email });

            if (user) {
                // Link GitHub ID to existing account
                user.githubId = profile.id;
                if (!user.avatar && profile.photos) user.avatar = profile.photos[0].value;
                await user.save();
                return done(null, user);
            }

            // If no user exists at all, create a new one
            user = await User.create({
                githubId: profile.id,
                displayName: profile.displayName || profile.username,
                email: email,
                avatar: profile.photos ? profile.photos[0].value : null
            });

            done(null, user);
        } catch (err) {
            done(err, null);
        }
    }));
} else {
    console.warn('GitHub OAuth credentials missing. GitHub login will not work.');
}


module.exports = passport;
