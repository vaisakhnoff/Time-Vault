const express = require('express'); 
const router = express.Router();
const userController = require('../controllers/user/userController');
const passport = require('passport');
const auth=require('../middleware/user/auth')
const productController = require('../controllers/user/productController')
const profileController = require('../controllers/user/profileController')
const cartController = require('../controllers/user/cartController')
const orderController = require('../controllers/user/orderController')
const wishlistController = require('../controllers/user/wishlistController');

router.get('/',userController.loadHomepage)
router.get('/pageNotFound',userController.pageNotFound)
router.get('/login',userController.loadLoginPage)
router.post('/login',userController.login)
router.get('/signup',userController.loadSignupPage)
router.post('/signup',userController.signUp)
router.get("/logout",userController.logout)
router.post('/verify-otp',userController.verifyOtp);
router.post('/resend-otp',userController.resendOtp)
router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}));
router.get('/auth/google/callback', userController.handleGoogleAuth);
router.get('/forgotPassword',userController.forgotPassword)
router.post('/sendForgotOtp', userController.sendForgotOtp);
router.get('/resetPassword', userController.loadResetPassword)
router.post('/resetPassword', userController.resetPassword)


router.get('/productDetails',productController.productDetails);
router.get('/shopPage',userController.loadShopPage);

router.get('/userProfile',auth.checkSession,profileController.userProfile)
router.get('/changeEmail',auth.checkSession,profileController.changeEmail);
router.post('/changeEmail',auth.checkSession,profileController.changeEmailValid)
router.post('/verifyEmailOtp',auth.checkSession,profileController.verifyEmail)
router.post('/updateEmail',auth.checkSession,profileController.updateEmail);
router.get('/changePassword',auth.checkSession,profileController.changePassword);
router.post('/changePassword',auth.checkSession,profileController.changePasswordValid)
router.post('/verifyChangePassword',auth.checkSession,profileController.verifyChangePassword)
router.get('/editProfile',auth.checkSession,profileController.editProfile);
router.post('/updateProfile',auth.checkSession,profileController.updateProfile);

router.get('/userAddress',auth.checkSession,profileController.userAddress);
router.get('/addAddress',auth.checkSession,profileController.addAddressPage);
router.post('/addAddress',auth.checkSession,profileController.addAddress);
router.post('/editAddress',auth.checkSession,profileController.editAddressPage)
router.post('/updateAddress', auth.checkSession, profileController.updateAddress);
router.post('/deleteAddress', auth.checkSession, profileController.deleteAddress);

router.get('/orders',auth.checkSession,profileController.userOrders);
router.get('/order/:id', auth.checkSession, orderController.viewOrderDetails);
router.post('/cancelOrder', auth.checkSession, orderController.cancelOrder);
router.post('/submitReview', auth.checkSession, orderController.submitReview);

router.get('/cartPage',auth.checkSession,cartController.cartPage)
router.post('/addToCart', auth.checkSession, cartController.addToCart);
router.post('/removeFromCart', auth.checkSession, cartController.removeFromCart);
router.post('/updateCart', auth.checkSession, cartController.updateCart);

router.get('/wishlist',auth.checkSession,wishlistController.wishlist);
router.post('/addWishlist',wishlistController.addWishlist)



router.get('/checkoutPage',auth.checkSession,cartController.checkoutPage);
router.post('/placeOrder',auth.checkSession,cartController.placeOrder);
router.get('/orderSuccess',auth.checkSession,cartController.orderSuccess);



module.exports =router;