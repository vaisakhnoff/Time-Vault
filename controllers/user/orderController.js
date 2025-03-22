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

    const order = await Order.findOne({ _id: orderId, user: userId })
      .populate('items.productId')
      .lean();

    if (!order) {
      return res.redirect('/orders');
    }

    // Check if order is delivered
    if (order.orderStatus === 'Delivered') {
      // Get the items that are still eligible for return (no status or status is still pending)
      const pendingItems = order.items.filter(item => !item.status || item.status === 'Pending');

      // Global return will be available only if:
      // • There is more than one product in the order
      // • And ALL items are pending (meaning none have been returned already)
      order.showGlobalReturn = order.items.length > 1 && pendingItems.length === order.items.length;

      // Individual return buttons show if there is at least one pending item
      // but if global return is available, we don't show individual returns.
      order.showIndividualReturn = !order.showGlobalReturn && pendingItems.length > 0;
    } else {
      order.showGlobalReturn = false;
      order.showIndividualReturn = false;
    }

    const addressDoc = await Address.findOne({ userId: userId }).lean();
    let selectedAddress = null;
    if (addressDoc && addressDoc.address && order.address) {
      selectedAddress = addressDoc.address.find(addr =>
        addr._id.toString() === order.address.toString()
      );
    }

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

// In global cancellation (cancelOrder):
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
    
    // Restore product stock for all items
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

    // Refund: calculate refund for only non-cancelled items
    if (
      (order.paymentMethod === 'Online' || order.paymentMethod === 'Wallet') &&
      order.paymentStatus === 'Completed'
    ) {
      const user = await User.findById(order.user);
      if (user) {
        const refundableAmount = order.items.reduce((total, item) => {
          // If an item is already cancelled individually, do not count its amount
          if (item.status && item.status === 'Cancelled') {
            return total;
          }
          return total + Number(item.price * item.quantity);
        }, 0);
        user.wallet = (Number(user.wallet) || 0) + refundableAmount;
        console.log("User wallet updated:", user.wallet);
        await user.save();

        const walletTx = new WalletTransaction({
          userId: order.user,
          amount: refundableAmount,
          type: "Credit",
          description:
            order.paymentMethod === 'Online'
              ? `Refund for cancelled online order. ${order._id}`
              : `Refund for cancelled wallet order. ${order._id}`
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

// const requestReturnOrder = async (req, res) => {
//   try {
//     const { orderId, reason } = req.body;
//     const order = await Order.findById(orderId);
//     if (!order) {
//       return res.json({ success: false, message: 'Order not found' });
//     }
    
//     if (order.orderStatus !== 'Delivered') {
//       return res.json({ success: false, message: 'Only delivered orders can be returned' });
//     }

//     order.orderStatus = 'Return Requested';
//     order.returnRequest = {
//       reason: reason || '',
//       status: 'Requested',
//       requestedAt: new Date()
//     };
//     await order.save();
//     return res.json({ success: true, message: 'Return request submitted. Awaiting admin confirmation.' });
//   } catch (error) {
//     console.error('Error processing return request:', error);
//     return res.json({ success: false, message: 'Error processing return request' });
//   }
// };

const createOnlineOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const { addressId } = req.body;
    
    const cart = await Cart.findOne({ userId }).populate('items.productId');
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }
    
    let totalAmount = cart.items.reduce((total, item) => {
      return total + item.productId.salePrice * item.quantity;
    }, 0);
    
    let couponDiscount = req.session.coupon ? req.session.coupon.offerPrice : 0;
    let discountedTotal = totalAmount - couponDiscount;
    if (discountedTotal < 0) discountedTotal = 0;

    const amountInPaise = discountedTotal * 100;
    
    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: 'receipt_order_' + Date.now()
    };

    const orderData = await instance.orders.create(options);
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


      const cart = await Cart.findOne({ userId }).populate('items.productId');
      if (!cart || cart.items.length === 0) {
          return res.status(400).json({ error: 'Cart is empty' });
      }

      const totalAmount = cart.items.reduce((total, item) => {
          return total + item.productId.salePrice * item.quantity;
      }, 0);
      
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

      for (const item of cart.items) {
          await Product.findByIdAndUpdate(item.productId._id, { $inc: { quantity: -item.quantity } });
      }

      cart.items = [];
      await cart.save();
      req.session.coupon = undefined;

      req.session.lastOrderId = order._id;

      return res.json({ success: true });
  } catch (error) {
      console.error('Error finalizing online payment:', error);
      return res.status(500).json({ success: false, error: 'Unable to finalize order' });
  }
};

const walletPaymentOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const { addressId } = req.body;
    
    // Get the cart and calculate total
    const cart = await Cart.findOne({ userId }).populate('items.productId');
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }
    
    let totalAmount = cart.items.reduce((total, item) => {
      return total + item.productId.salePrice * item.quantity;
    }, 0);
    
    let couponDiscount = req.session.coupon ? req.session.coupon.offerPrice : 0;
    let discountedTotal = totalAmount - couponDiscount;
    if (discountedTotal < 0) discountedTotal = 0;
    
    // Fetch user to check wallet balance
    const user = await User.findById(userId);
    if (user.wallet < discountedTotal) {
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }
    
    // Deduct wallet amount and save the user
    user.wallet -= discountedTotal;
    await user.save();
    
    // Create order with payment method set to "Wallet"
    const order = new Order({
      user: userId,
      items: cart.items.map(item => ({
        productId: item.productId._id,
        quantity: item.quantity,
        price: item.productId.salePrice,
        totalPrice: item.productId.salePrice * item.quantity,
      })),
      address: addressId,
      paymentMethod: 'Wallet',
      paymentStatus: 'Completed',
      totalAmount: discountedTotal,
      orderStatus: 'Pending'
    });
    await order.save();
    
    // Now create the wallet transaction using the saved order's id
    const walletTx = new WalletTransaction({
      userId: userId,
      amount: discountedTotal,
      type: "Debit",
      description: `Payment for order id: ${order._id}`
    });
    await walletTx.save();
    
    // Update products stock
    for (const item of cart.items) {
      await Product.findByIdAndUpdate(item.productId._id, { $inc: { quantity: -item.quantity } });
    }
    cart.items = [];
    await cart.save();
    
    // Clear applied coupon from session
    req.session.coupon = undefined;
    
    // Respond with order details
    return res.json({ success: true, orderId: order._id });
    
  } catch (error) {
    console.error('Error processing wallet payment:', error);
    return res.status(500).json({ error: 'Unable to process wallet payment' });
  }
};

// In individual cancellation (cancelOrderItem):
const cancelOrderItem = async (req, res) => {
    try {
        const { orderId, itemId, reason } = req.body;
        const userId = req.session.user;
        const order = await Order.findOne({ _id: orderId, user: userId });
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        // Find the order item
        const item = order.items.find(i => i._id.toString() === itemId);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Order item not found' });
        }
        if (item.status && item.status !== 'Pending') {
            return res.status(400).json({ success: false, message: 'This item cannot be cancelled' });
        }
        // Mark item as cancelled
        item.status = 'Cancelled';
        item.cancelReason = reason || '';
        
        // Process refund for the cancelled item if needed.
        // Calculate refund as price * quantity.
        if ((order.paymentMethod === 'Online' || order.paymentMethod === 'Wallet') && order.paymentStatus === 'Completed') {
            const refundAmount = Number(item.price * item.quantity) || 0;
            const currentUser = await User.findById(userId);
            const product = await Product.findById(item.productId);
    const productName = product ? product.productName : 'Unknown Product';

            if (currentUser) {
                const currentWallet = Number(currentUser.wallet) || 0;
                currentUser.wallet = currentWallet + refundAmount;
                await currentUser.save();
                await new WalletTransaction({
                    userId: currentUser._id,
                    amount: refundAmount,
                    type: 'Credit',
                    description: `Refund for cancelled product ${productName} in order id: ${orderId}`
                }).save();
            }
        }
        // Restore the canceled item stock
        const product = await Product.findById(item.productId);
        if (product) {
            product.quantity += item.quantity;
            await product.save();
        }
        await order.save();
        return res.json({ success: true, message: 'Order item successfully cancelled' });
    } catch (error) {
        console.error('Error cancelling order item:', error);
        return res.status(500).json({ success: false, message: 'Error cancelling order item' });
    }
};

const returnOrderItem = async (req, res) => {
    try {
        const { orderId, itemId, reason } = req.body;
        const userId = req.session.user;
        const order = await Order.findOne({ _id: orderId, user: userId });
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        // Allow individual return only if the overall order is Delivered and item is pending action
        if (order.orderStatus !== 'Delivered') {
            return res.status(400).json({ success: false, message: 'Only delivered orders can be returned' });
        }
        const item = order.items.find(i => i._id.toString() === itemId);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Order item not found' });
        }
        if (item.status && item.status !== 'Pending') {
            return res.status(400).json({ success: false, message: 'This item cannot be returned' });
        }
        // Mark item as return requested and save the reason
        item.status = 'Return Requested';
        item.returnReason = reason || '';
        await order.save();
        return res.json({ success: true, message: 'Return request for item submitted. Awaiting admin confirmation.' });
    } catch (error) {
        console.error('Error processing return request for item:', error);
        return res.status(500).json({ success: false, message: 'Error processing item return request' });
    }
};

module.exports = {
    viewOrderDetails,
    cancelOrder,
    submitReview,
    // requestReturnOrder,
    createOnlineOrder,
    onlinePaymentSuccess,
    walletPaymentOrder,
    cancelOrderItem,      // new endpoint for individual cancellation
    returnOrderItem       // new endpoint for individual return
};