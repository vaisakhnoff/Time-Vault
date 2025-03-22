const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/product-images'); 
  },
  filename: function (req, file, cb) {
    const filename = Date.now() + '-' + file.originalname;
    cb(null, filename);
  }
});

const uploads = multer({ storage: storage });




const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin/adminController');
const customerController = require('../controllers/admin/customerController')
const categoryController = require('../controllers/admin/categoryController')
const orderController = require('../controllers/admin/orderController');
const productController = require('../controllers/admin/productController')
const auth=require('../middleware/admin/auth')
const couponController = require('../controllers/admin/couponController');
const dashboardController = require('../controllers/admin/dashboardController');





router.get('/login',auth.adminAlreadyLoggedIn,adminController.loadLogin);
router.post('/login',adminController.login)
// router.get('/dashboard',auth.adminIsLogin,adminController.loadDashboard)
router.get('/pageError',adminController.pageError)
router.get('/logout',adminController.logout);




router.get('/users',auth.adminIsLogin,customerController.customerInfo)
router.get('/blockCustomer',auth.admincheckSession,customerController.blockCustomer);
router.get('/unblockCustomer',auth.admincheckSession,customerController.unblockCustomer)


router.get('/category',auth.adminIsLogin,categoryController.categoryInfo)
router.post('/addCategory',auth.adminIsLogin,categoryController.addCategory)
router.post('/addCategoryOffer',auth.adminIsLogin,categoryController.addCategoryOffer);
router.post('/removeCategoryoffer',auth.adminIsLogin,categoryController.removeCategoryoffer);
router.get('/listCategory',auth.adminIsLogin,categoryController.getListCategory)
router.get('/unlistCategory',auth.adminIsLogin,categoryController.getUnlistCategory)
router.get('/editCategory',auth.adminIsLogin,categoryController.getEditCategory);
router.post('/editCategory/:id', auth.admincheckSession, categoryController.editCategory);

router.get('/addProducts',auth.admincheckSession,productController.getProductAddPage);
router.get('/products',auth.admincheckSession,productController.getProductInfo);
router.post('/addProducts',auth.admincheckSession,uploads.array('images',4),productController.addProducts)
router.post('/blockProduct',auth.admincheckSession, productController.blockProduct);
router.post('/unblockProduct',auth.admincheckSession, productController.unblockProduct);
router.get('/editProduct/:id', auth.admincheckSession, productController.getEditProduct);
router.post('/editProduct/:id', auth.admincheckSession, uploads.array('images', 4), productController.editProduct);
router.post('/addProductOffer', productController.addProductOffer);
router.post('/removeProductOffer', productController.removeProductOffer);

router.get('/coupon', auth.adminIsLogin, couponController.couponInfo);
router.post('/addCoupon', auth.adminIsLogin, couponController.addCoupon);
router.get('/editCoupon', auth.adminIsLogin, couponController.getEditCoupon);
router.post('/editCoupon', auth.adminIsLogin, couponController.editCoupon);
router.get('/deleteCoupon', auth.adminIsLogin, couponController.deleteCoupon);

router.get('/orders', auth.admincheckSession, orderController.listOrders);
router.get('/order/:id', auth.admincheckSession, orderController.viewOrderDetails);
router.post('/update-order-status', auth.admincheckSession, orderController.updateOrderStatus);

router.get('/return-requests', auth.adminIsLogin, orderController.listReturnRequests);
router.post('/process-return-request', auth.adminIsLogin, orderController.processReturnRequest);

router.get('/dashboard', auth.adminIsLogin, dashboardController.getDashboardStats);
router.get('/sales-report', auth.adminIsLogin, dashboardController.generateSalesReport);
router.get('/download-report', auth.adminIsLogin, dashboardController.downloadSalesReport);

module.exports =router;
