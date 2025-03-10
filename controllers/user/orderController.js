const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const Address = require('../../models/addressSchema');
const User = require('../../models/userschema');
const Razorpay = require('razorpay');
const Cart = require('../../models/cartSchema');
const crypto = require('crypto');
const WalletTransaction = require('../../models/walletSchema');  // add this line

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
    
    // Restore product quantity
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

    // Process refund only for online orders which received payment
    if (order.paymentMethod === 'Online' && order.paymentStatus === 'Completed') {
      const user = await User.findById(order.user);
      if (user) {
        // Add refunded amount to user's wallet
        user.wallet = (user.wallet || 0) + order.totalAmount;
        console.log("User wallet updated:", user.wallet);
        await user.save();

        // Record the wallet transaction
        const walletTx = new WalletTransaction({
          userId: order.user,
          amount: order.totalAmount,
          type: "Credit",
          description: "Refund for cancelled online order"
        });
        await walletTx.save();
      }
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
    
    // Calculate cart total
    let totalAmount = cart.items.reduce((total, item) => {
      return total + item.productId.salePrice * item.quantity;
    }, 0);
    
    // Subtract coupon discount if applied
    let couponDiscount = req.session.coupon ? req.session.coupon.offerPrice : 0;
    let discountedTotal = totalAmount - couponDiscount;
    if (discountedTotal < 0) discountedTotal = 0;

    // Convert to paise (multiply by 100)
    const amountInPaise = discountedTotal * 100;
    
    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: 'receipt_order_' + Date.now()
    };

    const orderData = await instance.orders.create(options);
    // Order data will be used later upon payment confirmation.
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

      // Calculate total from salePrice
      const totalAmount = cart.items.reduce((total, item) => {
          return total + item.productId.salePrice * item.quantity;
      }, 0);
      
      // Subtract coupon discount if applied
      let couponDiscount = req.session.coupon ? req.session.coupon.offerPrice : 0;
      let discountedTotal = totalAmount - couponDiscount;
      if (discountedTotal < 0) discountedTotal = 0;

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
          totalAmount: discountedTotal,
          orderStatus: 'Pending'
      });
      await order.save();

      // Decrease each product's quantity
      for (const item of cart.items) {
          await Product.findByIdAndUpdate(item.productId._id, { $inc: { quantity: -item.quantity } });
      }

      // Empty the cart and clear coupon
      cart.items = [];
      await cart.save();
      req.session.coupon = undefined;

      // Store order ID in session to display on orderSuccess page
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
  requestReturnOrder, 
  createOnlineOrder,
  onlinePaymentSuccess
};