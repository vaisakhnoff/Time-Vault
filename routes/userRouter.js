const express = require('express'); 
const router = express.Router();
const userController = require('../controllers/user/userController');
const passport = require('passport');
const auth=require('../middleware/user/auth')

router.get('/',userController.loadHomepage)
router.get('/pageNotFound',userController.pageNotFound)
router.get('/login',auth.isLogin,userController.loadLoginPage)
router.post('/login',userController.login)
router.get('/signup',auth.isLogin,userController.loadSignupPage)
router.post('/signup',userController.signUp)
router.get("/logout",userController.logout)
router.post('/verify-otp',userController.verifyOtp);
router.post('/resend-otp',userController.resendOtp)
router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}));
router.get(
    '/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/signup' }),
    userController.googleAuthCallback
  );



// router.get(
//     '/auth/google/callback',
//     passport.authenticate('google', { failureRedirect: '/signup' }),
//     (req, res) => {
//       // Set req.session.user using the authenticated user from Passport
//       req.session.user = req.user._id;
//       res.redirect('/');
//     }
//   );
  




module.exports = router; 