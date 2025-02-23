const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const User = require("../../models/userschema");


const productDetails = async(req,res)=>{
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        const productId = req.query.id;
        const product = await Product.findById(productId).populate('category');
        // const findCategory = product.category;
        // const categoryOffer = findCategory ?.categoryOffer || 0;
        // const productOffer = product.product;
        res.render('product-details',{
            product:product,
            quantity:product.quantity,
            category:fiyyyyyyyy
            
        })


    } catch (error) {
        
    }
}

module.exports = {
    productDetails
}