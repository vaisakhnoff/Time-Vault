const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const User = require("../../models/userschema");
const Cart = require('../../models/cartSchema');
const Address = require('../../models/addressSchema'); 
const Order = require('../../models/orderSchema.js');

const cartPage = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findById(userId).lean();
    const cart = await Cart.findOne({ userId }).populate('items.productId').lean();
    if (cart && cart.items.length > 0) {
      console.log("First product details:", cart.items[0].productId);
    }

    res.render('cart', {
      user: userData,
      cart: cart || { items: [] }
    });
    
  } catch (error) {
    console.error('Error retrieving cart data:', error);
    res.redirect('/pageNotFound');
  } 
};

const addToCart = async (req, res) => {
  try {
    
    const userId = req.session.user;
    const productId = req.body.id;
    const quantity = parseInt(req.body.quantity) || 1;
    if (!req.session.user) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
  }
    const product = await Product.findById(productId).lean();
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    // Determine maximum allowed quantity: the lower of the product stock and 4
    const maxAllowed = Math.min(product.quantity, 4);
    if (quantity > maxAllowed) {
      return res.status(400).json({ 
        success: false, 
        message: `Maximum ${maxAllowed} quantities allowed per product` 
      });
    }

    const price = product.salePrice || product.regularPrice;

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    const existingItemIndex = cart.items.findIndex(
      item => item.productId.toString() === productId
    );

    if (existingItemIndex > -1) {
      const newQuantity = cart.items[existingItemIndex].quantity + quantity;
      if (newQuantity > maxAllowed) {
        return res.status(400).json({ 
          success: false, 
          message: `You can only have a maximum of ${maxAllowed} quantities of this product in your cart` 
        });
      }
      cart.items[existingItemIndex].quantity = newQuantity;
      cart.items[existingItemIndex].totalPrice = newQuantity * price;
    } else {
      // For a new product, if added quantity exceeds maxAllowed
      if (quantity > maxAllowed) {
        return res.status(400).json({ 
          success: false, 
          message: `Maximum ${maxAllowed} quantities allowed per product` 
        });
      }
      cart.items.push({
        productId: product._id,
        quantity: quantity,
        price: price,
        totalPrice: price * quantity
      });
    }

    await cart.save();
    res.json({ success: true, message: 'Product added to cart successfully' });
  } catch (error) {
    console.error('Error adding to cart:', error);
    res.status(500).json({ success: false, message: 'Error adding item to cart' });
  }
};

const removeFromCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId } = req.body;

    // Find the user's cart
    const cart = await Cart.findOne({ userId });
    
    if (!cart) {
      return res.redirect('/cartPage');
    }

    
    cart.items = cart.items.filter(item => 
      item.productId.toString() !== productId
    );

    await cart.save();
    res.redirect('/cartPage');

  } catch (error) {
    console.error('Error removing item from cart:', error);
    res.redirect('/pageNotFound');
  }
};

const checkoutPage = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findById(userId).lean();
    const cart = await Cart.findOne({ userId }).populate('items.productId').lean();
    
  
    const addressData = await Address.find({ userId: userId }).lean();
    console.log(addressData);
    

    
    console.log("addressData:", addressData);

 
    if (addressData && addressData.length > 0) {
      userData.addressId = addressData[0]._id;
    }

    res.render('checkoutPage', {
      user: userData,
      cart: cart || { items: [] },
      address: addressData.length > 0 ? addressData[0].address : []
    });
    
  } catch (error) {
    console.error('Error retrieving cart data:', error);
    res.redirect('/pageNotFound');
  }
}


const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const { addressId, paymentMethod } = req.body;

    const cart = await Cart.findOne({ userId }).populate('items.productId');
    if (!cart || !cart.items.length) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    // Fix: Find the address inside the embedded array
    const addressDoc = await Address.findOne({ "address._id": addressId });
    if (!addressDoc) {
      return res.status(400).json({ message: 'Invalid address' });
    }

    // Extract the specific address
    const selectedAddress = addressDoc.address.find(addr => addr._id.toString() === addressId);

    const totalAmount = cart.items.reduce((total, item) => {
      return total + item.productId.salePrice * item.quantity;
    }, 0);

    const order = new Order({
      user: userId,
      items: cart.items.map(item => ({
        productId: item.productId._id,
        quantity: item.quantity,
        price: item.productId.salePrice,
        totalPrice: item.productId.salePrice * item.quantity
      })),
      address: selectedAddress, // Use the extracted address
      paymentMethod,
      totalAmount,
      orderStatus: 'Pending',
      paymentStatus: paymentMethod === 'COD' ? 'Pending' : 'Processing'
    });

    await order.save();

    // Decrease each product's quantity by the purchased amount
    for (const item of cart.items) {
      await Product.findByIdAndUpdate(item.productId._id, { $inc: { quantity: -item.quantity } });
    }

    cart.items = [];
    await cart.save();

    if (paymentMethod === 'COD') {
      return res.redirect('/orderSuccess');
    } else {
      return res.redirect('/payment');
    }
  } catch (error) {
    console.error('Error placing order:', error);
    return res.redirect('/pageNotFound');
  }
};


const orderSuccess = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findById(userId).lean();
    
    
    const latestOrder = await Order.findOne({ user: userId })
      .sort({ createdAt: -1 })
      .populate('items.productId')
      .populate('address')
      .lean();

    if (!latestOrder) {
      return res.redirect('/cartPage');
    }

    res.render('orderSuccess', {
      user: userData,
      order: latestOrder,
      orderId: latestOrder._id
    });
  } catch (error) {
    console.error('Error displaying order success:', error);
    return res.redirect('/pageNotFound');
  }
}

const updateCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const updatedItems = req.body.items;

    if (!updatedItems || !Array.isArray(updatedItems)) {
      return res.status(400).json({ success: false, message: 'Invalid items data' });
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    // Update items
    for (const updatedItem of updatedItems) {
      const index = cart.items.findIndex(item => item.productId.toString() === updatedItem.productId);
      if (index !== -1) {
        const product = await Product.findById(updatedItem.productId);
        if (!product) {
          return res.status(404).json({ success: false, message: `Product ${updatedItem.productId} not found` });
        }
        if (updatedItem.quantity > product.quantity) {
          return res.status(400).json({ 
            success: false, 
            message: `Quantity ${updatedItem.quantity} exceeds stock (${product.quantity}) for product ${product.productName}` 
          });
        }
        cart.items[index].quantity = updatedItem.quantity;
        cart.items[index].totalPrice = updatedItem.quantity * cart.items[index].price;
      }
    }

    await cart.save();
    res.json({ success: true, message: 'Cart updated successfully' });
  } catch (error) {
    console.error('Error updating cart:', error);
    res.status(500).json({ success: false, message: 'Error updating cart' });
  }
};


module.exports = {
  addToCart,
  cartPage,
  removeFromCart,
  checkoutPage,
  placeOrder,
  orderSuccess,
  updateCart
};