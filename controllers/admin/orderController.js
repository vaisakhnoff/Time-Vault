const Order = require('../../models/orderSchema');
const user = require('../../models/userschema'); // 
const Address = require('../../models/addressSchema');
const WalletTransaction = require('../../models/walletSchema');
const Product = require('../../models/productSchema');




const listOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const search = req.query.search || '';
    const filterStatus = req.query.status || '';

    let query = {};
    if (search) {
      query._id = { $regex: search, $options: 'i' };
    }
    if (filterStatus) {
      query.orderStatus = filterStatus;
    }

    const totalOrders = await Order.countDocuments(query);
    const orders = await Order.find(query)
      .populate('user')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    console.log("orders",orders);

    res.render('orderManagement', {
      orders,
      currentPage: page,
      totalPages: Math.ceil(totalOrders / limit),
      search,
      filterStatus
    });
  } catch (error) {
    console.error('Error listing orders:', error);
    res.redirect('/pageNotFound');
  }
};


const viewOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findById(orderId)
    
      .populate('user', 'firstName lastName email phone')
      .populate('items.productId', 'productName productImage salePrice')
      .lean();
      const userId = req.session.user;
      const address = await Address.findOne({ userId: userId }).lean();

    if (!order) return res.redirect('/admin/orders');

    res.render('orderDetail', { order,
        address:address,

     });
  } catch (error) {
    console.error('Error viewing order details:', error);
    res.redirect('/pageNotFound');
  }
};


const updateOrderStatus = async (req, res) => {
  try {
    const { orderId, newStatus } = req.body;
    const validStatuses = ['Pending', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'];
    
    if (!validStatuses.includes(newStatus)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid status',
        icon: 'error'
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found',
        icon: 'error'
      });
    }

    // Update payment status to Completed when order is delivered for COD orders
    if (newStatus === 'Delivered' && order.paymentMethod === 'COD') {
      order.paymentStatus = 'Completed';
    }

    order.orderStatus = newStatus;
    order.statusUpdates = order.statusUpdates || {};
    order.statusUpdates[newStatus] = new Date();
    await order.save();

    res.json({ 
      success: true, 
      message: `Order status successfully updated to ${newStatus}`,
      icon: 'success'
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating order status',
      icon: 'error'
    });
  }
};


const verifyReturnRequest = async (req, res) => {
  try {
    const { orderId, approve } = req.body;
    const order = await Order.findById(orderId)
      .populate('user')
      .populate('items.productId');
      
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found',
        icon: 'error'
      });
    }

    if (approve === 'true' || approve === true) {
      // Process return approval
      for (const item of order.items) {
        const product = item.productId;
        if (product) {
          product.quantity += item.quantity;
          await product.save();
        }
      }

      // Update user's wallet (refund)
      const refundAmount = order.totalAmount;
      order.user.wallet = (order.user.wallet || 0) + refundAmount;
      await order.user.save();

      // Create a wallet transaction record for the refund
      const walletTransaction = new WalletTransaction({
        userId: order.user._id,
        amount: refundAmount,
        type: 'Credit',
        description: `Refund for Order ${order._id}`
      });
      await walletTransaction.save();

      order.orderStatus = 'Returned';
      order.statusUpdates = order.statusUpdates || {};
      order.statusUpdates['Returned'] = new Date();
      order.returnRequest.status = 'Approved';
      order.returnRequest.processedAt = new Date();

      await order.save();
      
      return res.json({ 
        success: true, 
        message: 'Return request approved. Amount refunded to wallet and stock restored.',
        icon: 'success'
      });
    } else {
      // Process return decline
      order.orderStatus = 'Return Declined';
      order.statusUpdates = order.statusUpdates || {};
      order.statusUpdates['Return Declined'] = new Date();
      order.returnRequest.status = 'Declined';
      order.returnRequest.processedAt = new Date();

      await order.save();
      
      return res.json({ 
        success: true, 
        message: 'Return request has been declined',
        icon: 'info'
      });
    }
  } catch (error) {
    console.error('Error verifying return request:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error processing return request',
      icon: 'error'
    });
  }
};


module.exports = {
  listOrders,
  viewOrderDetails,
  updateOrderStatus,
  verifyReturnRequest
};