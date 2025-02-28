const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const User = require("../../models/userschema");


const productDetails = async(req,res)=>{
    try {
        const userId = req.session.user;
        const productId = req.query.id;

        // Check if productId exists
        if (!productId) {
            console.log("No product ID provided");
            return res.redirect('/pageNotFound');
        }

        // Find product and populate category
        const product = await Product.findById(productId)
            .populate('category')
            .lean();

        console.log(product);
        

        if (!product) {
            console.log("Product not found");
            return res.redirect('/pageNotFound');
        }

        // Format image paths
        product.productImage = product.productImage.map(img => `/uploads/product-images/${img}`);

        // Get related products from same category
        const relatedProducts = await Product.find({
            category: product.category._id,
            _id: { $ne: productId },
            isBlocked: false
        })
        .limit(4)
        .lean();

        // Format related products image paths
        relatedProducts.forEach(prod => {
            prod.productImage = prod.productImage.map(img => `/uploads/product-images/${img}`);
        });

        // Get user data if logged in
      
        const userData = userId ? await User.findById(userId).lean() : null;

        res.render('product-details', {
            product,
            relatedProducts,
            user: userData
        });

    } catch (error) {
        console.error("Error in product details:", error);
        res.redirect('/pageNotFound');
    }
}

module.exports = {
    productDetails,
   
}