const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin/adminController');
const customerController = require('../controllers/admin/customerController')
const categoryController = require('../controllers/admin/categoryController')
const auth=require('../middleware/admin/auth')




router.get('/login',auth.adminIsLogin,adminController.loadLogin);
router.post('/login',adminController.login)
router.get('/',auth.admincheckSession,adminController.loadDashboard)
router.get('/pageError',adminController.pageError)
router.get('/logout',adminController.logout);




router.get('/users',auth.admincheckSession,customerController.customerInfo)
router.get('/blockCustomer',auth.admincheckSession,customerController.blockCustomer);
router.get('/unblockCustomer',auth.admincheckSession,customerController.unblockCustomer)


router.get('/category',auth.admincheckSession,categoryController.categoryInfo)
router.post('/addCategory',auth.admincheckSession,categoryController.addCategory)

module.exports =router;


