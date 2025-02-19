const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin/adminController');
const customerController = require('../controllers/admin/customerController')
const auth=require('../middleware/admin/auth')




router.get('/login',auth.adminIsLogin,adminController.loadLogin);
router.post('/login',adminController.login)
router.get('/',auth.admincheckSession,adminController.loadDashboard)
router.get('/pageError',adminController.pageError)
router.get('/logout',adminController.logout);




router.get('/users',auth.admincheckSession,customerController.customerInfo)
router.get('/blockCustomer',auth.admincheckSession,customerController.blockCustomer);
router.get('/unblockCustomer',auth.admincheckSession,customerController.unblockCustomer)



module.exports =router;


