const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const env = require('./env');
const User = require('../models/User.model');

if (!env.GOOGLE.ENABLED) {
  console.error(
    'Google OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL in your environment.'
  );
  process.exit(1);
}

passport.use(
  new GoogleStrategy(
    {
      clientID: env.GOOGLE.CLIENT_ID,
      clientSecret: env.GOOGLE.CLIENT_SECRET,
      callbackURL: env.GOOGLE.CALLBACK_URL,
      proxy: true
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        if (!profile || !profile.emails || !profile.emails.length) {
          const error = new Error('Google profile did not include an email address');
          return done(error, null);
        }

        let user = await User.findOne({ email: profile.emails[0].value });

        if (user) {
          if (!user.googleId) {
            user.googleId = profile.id;
            await user.save();
          }
          return done(null, user);
        }

        user = await User.create({
          firstName: profile.name?.givenName || 'Google',
          lastName: profile.name?.familyName || 'User',
          email: profile.emails[0].value,
          password: Math.random().toString(36).slice(-16),
          phone: '000-000-0000',
          role: 'customer',
          isActive: true,
          googleId: profile.id
        });

        return done(null, user);
      } catch (error) {
        logger.error('GoogleStrategy verify callback failed:', error);
        return done(error, null);
      }
    }
  )
);

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;