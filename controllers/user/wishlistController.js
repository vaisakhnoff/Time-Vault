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
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }
        const id = req.body.id; // Extract id from request body
        console.log("User ID:", req.session.user);
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

const removeFromWishlist = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }
        const { productId } = req.body;
        if (!productId) {
            return res.status(400).json({ success: false, message: 'Product id is required' });
        }
        // Find wishlist by user
        let wishlist = await Wishlist.findOne({ userId: req.session.user });
        if (!wishlist) {
            return res.json({ success: false, message: "Wishlist not found" });
        }

        // Filter out the product
        wishlist.products = wishlist.products.filter(
            (product) => product.productId.toString() !== productId
        );
        await wishlist.save();
        res.json({ success: true, message: "Product removed from wishlist" });
    } catch (error) {
        console.error('Error removing product from wishlist:', error);
        res.status(500).json({ success: false, message: "Error removing product from wishlist" });
    }
};

module.exports = {
    wishlist,
    addWishlist,
    removeFromWishlist
};

