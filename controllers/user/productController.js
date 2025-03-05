const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const User = require("../../models/userschema");


const productDetails = async(req,res)=>{
    try {
        const userId = req.session.user;
        const productId = req.query.id;

       
        if (!productId) {
            console.log("No product ID provided");
            return res.redirect('/pageNotFound');
        }

        
        const product = await Product.findById(productId)
            .populate('category')
            .lean();

        
        

        if (!product) {
            console.log("Product not found");
            return res.redirect('/pageNotFound');
        }

       
        product.productImage = product.productImage.map(img => `/uploads/product-images/${img}`);

  
        const relatedProducts = await Product.find({
            category: product.category._id,
            _id: { $ne: productId },
            isBlocked: false
        })
        .limit(4)
        .lean();

     
        relatedProducts.forEach(prod => {
            prod.productImage = prod.productImage.map(img => `/uploads/product-images/${img}`);
        });

       
      
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