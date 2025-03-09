const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const Address = require('../../models/addressSchema');
const User = require('../../models/userschema');
const Razorpay = require('razorpay');
const Cart = require('../../models/cartSchema');
const crypto = require('crypto');

const instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,         
    key_secret: process.env.RAZORPAY_KEY_SECRET   
});

const viewOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.id;
    const userId = req.session.user;

    // Get the order and populate product details only.
    const order = await Order.findOne({ _id: orderId, user: userId })
      .populate('items.productId')
      .lean();

    if (!order) {
      return res.redirect('/orders');
    }

    // Fetch the Address document for the user instead of searching by addressId.
    const addressDoc = await Address.findOne({ userId: userId }).lean();
console.log("1",addressDoc); // Debugging line

    let selectedAddress = null;


    if (addressDoc && addressDoc.address && order.address) {
      console.log("Order address value:", order.address.toString());
      console.log("User Addresses:", addressDoc.address.map(addr => addr._id.toString()));
      selectedAddress = addressDoc.address.find(addr =>
        addr._id.toString() === order.address.toString()
      );
    }

    console.log("Selected Address:", selectedAddress); // Debugging line
   

    res.render('orderDetails', {
      user: req.session.user,
      order: order,
      address: selectedAddress,
    });
  } catch (error) {
    console.error('Error viewing order details:', error);
    res.redirect('/pageNotFound');
  }
};

const cancelOrder = async (req, res) => {
  try {
    const orderId = req.body.orderId;
    const order = await Order.findById(orderId);
    
    if (!order) {
      return res.redirect('/orders');
    }
    
    if (order.orderStatus !== 'Pending') {
      console.error('Cancellation not allowed once order is processed');
      return res.redirect(`/order/${orderId}?error=Cancellation not allowed at this stage`);
    }
    
   
    for (const item of order.items) {
      const product = await Product.findById(item.productId);
      if (product) {
        product.quantity += item.quantity;
        await product.save();
      }
    }
    
    order.orderStatus = 'Cancelled';
    order.statusUpdates = {
      ...order.statusUpdates,
      Cancelled: new Date()
    };



    const user = await User.findById(order.user);
    if (user) {
      user.wallet = (user.wallet || 0) + order.totalAmount;
      console.log("User wallet updated:", user.wallet);
      
      await user.save();
    }




    await order.save();
    
    res.redirect(`/order/${orderId}`);
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.redirect('/pageNotFound');
  }
};




const submitReview = async (req, res) => {
  try {
    const { orderId, productId, rating, review } = req.body;
    const userId = req.session.user;

   
    await Order.updateOne(
      { 
        _id: orderId,
        'items.productId': productId 
      },
      { 
        $set: { 'items.$.reviewed': true }
      }
    );

   
    await Product.updateOne(
      { _id: productId },
      {
        $push: {
          reviews: {
            userId,
            rating: parseInt(rating),
            review,
            createdAt: new Date()
          }
        }
      }
    );

    res.redirect(`/order/${orderId}`);
  } catch (error) {
    console.error('Error submitting review:', error);
    res.redirect('/pageNotFound');
  }
};

const requestReturnOrder = async (req, res) => {
  try {
    const { orderId, reason } = req.body;
    const order = await Order.findById(orderId);
    if (!order) {
      return res.json({ success: false, message: 'Order not found' });
    }
    // Allow return only if the order is delivered.
    if (order.orderStatus !== 'Delivered') {
      return res.json({ success: false, message: 'Only delivered orders can be returned' });
    }
    // Set the return request details.
    order.orderStatus = 'Return Requested';
    order.returnRequest = {
      reason: reason || '',
      status: 'Requested',
      requestedAt: new Date()
    };
    await order.save();
    return res.json({ success: true, message: 'Return request submitted. Awaiting admin confirmation.' });
  } catch (error) {
    console.error('Error processing return request:', error);
    return res.json({ success: false, message: 'Error processing return request' });
  }
};

const createOnlineOrder = async (req, res) => {
  try {
      const userId = req.session.user;
      const { addressId } = req.body;
      
      const cart = await Cart.findOne({ userId }).populate('items.productId');
      if (!cart || cart.items.length === 0) {
          return res.status(400).json({ error: 'Cart is empty' });
      }
      // Calculate total (assumes product.salePrice is in rupees)
      const totalAmount = cart.items.reduce((total, item) => {
          return total + item.productId.salePrice * item.quantity;
      }, 0);
      // Convert to paise (multiply by 100)
      const amountInPaise = totalAmount * 100;
      
      const options = {
          amount: amountInPaise,
          currency: 'INR',
          receipt: 'receipt_order_' + Date.now()
      };

      const orderData = await instance.orders.create(options);
      // You may store orderData along with cart details temporarily if needed.
      return res.json({ orderData });
  } catch (error) {
      console.error('Error creating online order:', error);
      return res.status(500).json({ error: 'Unable to create order' });
  }
};

const onlinePaymentSuccess = async (req, res) => {
  try {
      const userId = req.session.user;
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, addressId } = req.body;

      // Get cart details
      const cart = await Cart.findOne({ userId }).populate('items.productId');
      if (!cart || cart.items.length === 0) {
          return res.status(400).json({ error: 'Cart is empty' });
      }

      // Calculate total amount (in rupees)
      const totalAmount = cart.items.reduce((total, item) => {
          return total + item.productId.salePrice * item.quantity;
      }, 0);
      
      // Create the order document using cart details
      const order = new Order({
          user: userId,
          items: cart.items.map(item => ({
              productId: item.productId._id,
              quantity: item.quantity,
              price: item.productId.salePrice,
              totalPrice: item.productId.salePrice * item.quantity
          })),
          address: addressId,
          paymentMethod: 'Online',
          paymentStatus: 'Completed',
          totalAmount: totalAmount,
          orderStatus: 'Pending'
      });
      await order.save();

      // Decrease each product's quantity by the purchased amount
      for (const item of cart.items) {
          await Product.findByIdAndUpdate(
              item.productId._id, 
              { $inc: { quantity: -item.quantity } }
          );
      }

      // Empty the cart
      cart.items = [];
      await cart.save();

      // Store the order ID in session for orderSuccess page to display
      req.session.lastOrderId = order._id;

      return res.json({ success: true });
  } catch (error) {
      console.error('Error finalizing online payment:', error);
      return res.status(500).json({ success: false, error: 'Unable to finalize order' });
  }
};

module.exports = {

  viewOrderDetails,
  cancelOrder,
  submitReview,
  // verifyReturnRequest,
  requestReturnOrder,  // new function
  createOnlineOrder,
  onlinePaymentSuccess
};