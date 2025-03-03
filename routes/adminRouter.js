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
router.post('/addCategoryOffer',auth.admincheckSession,categoryController.addCategoryOffer);
router.post('/removeCategoryoffer',auth.admincheckSession,categoryController.removeCategoryoffer);
router.get('/listCategory',auth.admincheckSession,categoryController.getListCategory)
router.get('/unlistCategory',auth.admincheckSession,categoryController.getUnlistCategory)
router.get('/editCategory',auth.admincheckSession,categoryController.getEditCategory);
router.post('/editCategory/:id', auth.admincheckSession, categoryController.editCategory);

router.get('/addProducts',auth.admincheckSession,productController.getProductAddPage);
router.get('/products',auth.admincheckSession,productController.getProductInfo);
router.post('/addProducts',auth.admincheckSession,uploads.array('images',4),productController.addProducts)
router.post('/blockProduct',auth.admincheckSession, productController.blockProduct);
router.post('/unblockProduct',auth.admincheckSession, productController.unblockProduct);
router.get('/editProduct/:id', auth.admincheckSession, productController.getEditProduct);
router.post('/editProduct/:id', auth.admincheckSession, uploads.array('images', 4), productController.editProduct);


router.get('/orders', auth.admincheckSession, orderController.listOrders);
router.get('/order/:id', auth.admincheckSession, orderController.viewOrderDetails);
router.post('/update-order-status', auth.admincheckSession, orderController.updateOrderStatus);
router.post('/verify-return-request', auth.admincheckSession, orderController.verifyReturnRequest);


module.exports =router;


