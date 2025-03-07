const product = require('../../models/productSchema');
const User = require("../../models/userschema");
const Wishlist = require('../../models/wishlistSchema');
const { orderSuccess } = require('./cartController');


const wishlist = async(req,res)=>{

    try {
        const userId = req.session.user;
        const userData = await User.findById(userId).lean();
        const wishlist = await Wishlist.findOne({ userId }).populate('products.productId').lean();
        if (wishlist && wishlist.products.length > 0) {
            console.log("First product details:", wishlist.products[0].productId);
          }
        res.render('wishlistPage',{
            user: userData,
            wishlist: wishlist || { products: [] }
        });
    } catch (error) {
        console.error('Error retrieving wishlist data:', error);
        res.redirect('/pageNotFound');
    }
}

const addWishlist = async (req, res) => {
    try {
        console.log("User ID:", req.session.user);
        const { id } = req.body;
        console.log("Product ID:", id);

        if (!id) {
            return res.status(400).send("Product id is required");
        }

        let wishlist = await Wishlist.findOne({ userId: req.session.user });
        console.log("Wishlist found:", wishlist);
        if (!wishlist) {
            wishlist = new Wishlist({ userId: req.session.user, products: [] });
            console.log("New wishlist created:", wishlist);
        }

        const productExists = wishlist.products.find(product => product.productId.toString() === id);
        console.log("Product exists:", productExists);
        if (productExists) {
            return res.json({ success: false, message: "Product already exists in wishlist" });
        }

        wishlist.products.push({ productId: id });
        console.log("Product pushed:", wishlist.products);
        await wishlist.save();
        console.log("Wishlist saved");
        res.json({ success: true, message: "Product added to wishlist" });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, message: 'Error adding product to wishlist' });
    }
};

module.exports = {
    wishlist,
    addWishlist 
}

