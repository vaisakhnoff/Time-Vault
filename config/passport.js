// const passport = require("passport");
// const GoogleStrategy = require("passport-google-oauth20").Strategy;
// const User = require("../models/userschema");
// require('dotenv').config();

// passport.use(new GoogleStrategy({
//     clientID: process.env.GOOGLE_CLIENT_ID,
//     clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//     callbackURL: '/auth/google/callback'
//   },
//   async (accessToken, refreshToken, profile, done) => {
//     try {
//       // Ensure profile.emails exists and has a value
//       if (!profile.emails || profile.emails.length === 0) {
//         return done(new Error("No email found in the Google profile"), null);
//       }
      
//       let user = await User.findOne({ googleId: profile.id });
//       if (user) {
//         return done(null, user);
//       } else {
//         // Split displayName into first and last names
//         const nameParts = profile.displayName ? profile.displayName.split(" ") : [];
//         const firstName = nameParts[0] || "";
//         const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

//         // Create new user with the extracted names
//         user = new User({
//           firstName: firstName,
//           lastName: lastName,
//           email: profile.emails[0].value,
//           googleId: profile.id
//         });
//         await user.save();
       
        
//         return done(null, user);
//       }
//     } catch (error) {
//       return done(error, null);
//     }
//   }
// ));

// passport.serializeUser((user, done) => {
//   done(null, user.id);
// });

// passport.deserializeUser((id, done) => {
//   User.findById(id)
//     .then(user => done(null, user))
//     .catch(err => done(err, null));
// });
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/userschema");
require('dotenv').config();

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback'
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Ensure profile.emails exists and has a value
      if (!profile.emails || profile.emails.length === 0) {
        return done(new Error("No email found in the Google profile"), null);
      }
      
      let user = await User.findOne({ googleId: profile.id });
      
      if (user) {
        // If the user exists but is blocked, signal failure with a message.
        if (user.isBlocked) {
          return done(null, false, { message: "User is blocked by admin" });
        }
        return done(null, user);
      } else {
        // Split displayName into first and last names
        const nameParts = profile.displayName ? profile.displayName.split(" ") : [];
        const firstName = nameParts[0] || "";
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

        // Create new user with the extracted names
        user = new User({
          firstName: firstName,
          lastName: lastName,
          email: profile.emails[0].value,
          googleId: profile.id
        });
        await user.save();
        return done(null, user);
      }
    } catch (error) {
      return done(error, null);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findById(id)
    .then(user => done(null, user))
    .catch(err => done(err, null));
});



module.exports = passport;
