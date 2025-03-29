const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const Address = require('../../models/addressSchema');
const User = require('../../models/userschema');
const Razorpay = require('razorpay');
const Cart = require('../../models/cartSchema');
const crypto = require('crypto');
const WalletTransaction = require('../../models/walletSchema');  // add this line
const { v4: uuidv4 } = require('uuid'); // Add this line

const instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,         
    key_secret: process.env.RAZORPAY_KEY_SECRET   
});

// Add this helper function at the top
function calculateOrderStatus(items) {
    const statusCounts = items.reduce((acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
    }, {});

    const totalItems = items.length;

    // If all items have the same status, use that status
    if (Object.keys(statusCounts).length === 1) {
        return items[0].status;
    }

    // For mixed statuses, use the most significant status
    if (statusCounts['Delivered']) return 'Delivered';
    if (statusCounts['Out for Delivery']) return 'Out for Delivery';
    if (statusCounts['Shipped']) return 'Shipped';
    if (statusCounts['Cancelled'] === totalItems) return 'Cancelled';
    if (statusCounts['Return Requested']) return 'Return Requested';
    if (statusCounts['Returned']) return 'Returned';
    
    // Default to 'Pending' if no other status applies
    return 'Pending';
}

// Add this helper function near the top
function calculateDisplayStatus(items) {
    const statuses = items.map(item => item.status);
    const uniqueStatuses = new Set(statuses);
    if (uniqueStatuses.size === 1) {
        return statuses[0];
    }
    return 'Mixed Status';
}

// Add this helper function
function getTimelineSteps(status) {
    // Base timeline steps
    const baseSteps = ['Pending', 'Shipped', 'Out for Delivery', 'Delivered'];
    
    // Special case statuses
    const specialStatuses = {
        'Cancelled': ['Pending', 'Cancelled'],
        'Return Requested': ['Pending', 'Shipped', 'Out for Delivery', 'Delivered', 'Return Requested'],
        'Returned': ['Pending', 'Shipped', 'Out for Delivery', 'Delivered', 'Return Requested', 'Returned'],
        'Return Declined': ['Pending', 'Shipped', 'Out for Delivery', 'Delivered', 'Return Requested', 'Return Declined']
    };

    // If status is special, use its specific timeline
    return specialStatuses[status] || baseSteps;
}

const viewOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.id;
        const userId = req.session.user;

        const order = await Order.findOne({ 
            orderId: orderId,  // Changed from _id to orderId
            user: userId 
        }).populate('items.productId').lean();

        if (!order) {
            return res.redirect('/orders');
        }
        order.statusUpdates = order.statusUpdates || {};
       
        if (order.orderStatus === 'Delivered') {
        
            const pendingItems = order.items.filter(item => !item.status || item.status === 'Pending');

            order.showGlobalReturn = order.items.length > 1 && pendingItems.length === order.items.length;

         
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

        order.computedDisplayStatus = calculateDisplayStatus(order.items);

        res.render('orderDetails', {
            user: req.session.user,
            order: order,
            address: selectedAddress,
            getTimelineSteps: getTimelineSteps // Pass the function to the view
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

        const order = new Order({
            orderId: `ORD${uuidv4().substring(0, 8).toUpperCase()}`, // Generate UUID-based order ID
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
            totalAmount: cart.items.reduce((total, item) => {
                return total + item.productId.salePrice * item.quantity;
            }, 0) - (req.session.coupon ? req.session.coupon.offerPrice : 0),
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
      orderId: `ORD${uuidv4().substring(0, 8).toUpperCase()}`,
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

const cancelOrderItem = async (req, res) => {
    try {
        const { orderId, itemId, reason } = req.body;
        const userId = req.session.user;
        const order = await Order.findOne({ _id: orderId, user: userId });
        
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const item = order.items.find(i => i._id.toString() === itemId);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Order item not found' });
        }

        // Update individual item status
        item.status = 'Cancelled';
        item.cancelReason = reason || '';

        // Calculate the DB status (must be a valid enum value)
        const newOrderStatus = calculateOrderStatus(order.items);
        order.orderStatus = newOrderStatus;

        // Store additional status info for display purposes
        if (!order.statusUpdates) {
            order.statusUpdates = {};
        }
        const now = new Date();
        order.statusUpdates[`item-${itemId}-cancelled`] = now;
        
        // Count cancelled items for display
        const cancelledCount = order.items.filter(item => item.status === 'Cancelled').length;
        const totalItems = order.items.length;
        const displayStatus = cancelledCount === totalItems ? 'Cancelled' : 
                            `${cancelledCount}/${totalItems} Items Cancelled`;

        // Process refund if needed
        if ((order.paymentMethod === 'Online' || order.paymentMethod === 'Wallet') 
            && order.paymentStatus === 'Completed') {
            const refundAmount = item.price * item.quantity;
            const user = await User.findById(userId);
            if (user) {
                user.wallet = (Number(user.wallet) || 0) + refundAmount;
                await user.save();
                
                await new WalletTransaction({
                    userId: userId,
                    amount: refundAmount,
                    type: 'Credit',
                    description: `Refund for cancelled item in order ${orderId}`
                }).save();
            }
        }

        await order.save();
        
        return res.json({ 
            success: true, 
            message: 'Order item successfully cancelled',
            orderStatus: newOrderStatus,
            displayStatus: displayStatus
        });
    } catch (error) {
        console.error('Error cancelling order item:', error);
        return res.status(500).json({ success: false, message: 'Error cancelling order item' });
    }
};

const returnOrderItem = async (req, res) => {
    try {
        const { orderId, itemId, reason } = req.body;
        const userId = req.session.user;

        // Find order using _id since that's what we're passing from the client
        const order = await Order.findOne({ 
            _id: orderId,  // Changed from orderId to _id
            user: userId 
        });

        if (!order) {
            return res.status(404).json({ 
                success: false, 
                message: 'Order not found' 
            });
        }

        // Find the specific item
        const item = order.items.find(i => i._id.toString() === itemId);
        
        if (!item) {
            return res.status(404).json({ 
                success: false, 
                message: 'Order item not found' 
            });
        }

        if (item.status !== 'Delivered') {
            return res.status(400).json({ 
                success: false, 
                message: 'Only delivered items can be returned' 
            });
        }

        // Update item status
        item.status = 'Return Requested';
        item.returnReason = reason;
        
        // Update order status if needed
        order.orderStatus = calculateOrderStatus(order.items);

        // Add timestamp
        if (!order.statusUpdates) {
            order.statusUpdates = {};
        }
        order.statusUpdates[`item-${itemId}-Return Requested`] = new Date();

        await order.save();

        return res.json({ 
            success: true, 
            message: 'Return request submitted successfully' 
        });

    } catch (error) {
        console.error('Error processing return request:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Error processing return request' 
        });
    }
};

const loadReviewPage = async (req, res) => {
    try {
        const { orderId, productId } = req.query;
        const userId = req.session.user;

        // Fetch order details
        const order = await Order.findOne({
            _id: orderId,
            user: userId
        });

        if (!order) {
            return res.redirect('/orders');
        }

        // Fetch product details
        const product = await Product.findById(productId);
        if (!product) {
            return res.redirect(`/order/${orderId}`);
        }

        // Verify if the product is in the order and eligible for review
        const orderItem = order.items.find(item => 
            item.productId.toString() === productId && 
            !item.reviewed && 
            order.orderStatus === 'Delivered'
        );

        if (!orderItem) {
            return res.redirect(`/order/${orderId}`);
        }

        res.render('writeReview', {
            user: req.session.user,
            order: order,
            product: product
        });

    } catch (error) {
        console.error('Error loading review page:', error);
        res.redirect('/pageNotFound');
    }
};

module.exports = {
    viewOrderDetails,
    cancelOrder,
    submitReview,
    loadReviewPage,   
    createOnlineOrder,
    onlinePaymentSuccess,
    walletPaymentOrder,
    cancelOrderItem,
    returnOrderItem
};