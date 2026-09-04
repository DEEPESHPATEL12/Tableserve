const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const userModel = require("../models/user.model");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const googleId = profile.id;
        const email = profile.emails?.[0]?.value?.toLowerCase();
        const name = profile.displayName;
        const avatarUrl = profile.photos?.[0]?.value;

        if (!email) {
          return done(new Error("Google account has no email"), null);
        }

        // 1. Already signed up with Google before -> just log in
        let user = await userModel.findByGoogleId(googleId);
        if (user) return done(null, user);

        // 2. Email already exists (signed up with password) -> link Google to that account
        const existingByEmail = await userModel.findByEmail(email);
        if (existingByEmail) {
          const linked = await userModel.linkGoogleId(existingByEmail.id, googleId);
          return done(null, linked);
        }

        // 3. Brand new user -> create account via Google
        const newUser = await userModel.createWithGoogle({ name, email, googleId, avatarUrl });
        return done(null, newUser);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

// We use JWTs, not sessions, so these are minimal passthroughs (required by passport's API)
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => done(null, { id }));

module.exports = passport;
