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

    // Get orders and transform them
    let orders = await Order.find(query)
      .populate('user')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Add isEditable field to each order after getting lean objects
    orders = orders.map(order => ({
      ...order,
      isEditable: !['Cancelled', 'Returned'].includes(order.orderStatus)
    }));

    const totalOrders = await Order.countDocuments(query);

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
     
    
      const userId = order.user._id;
      

       
          const userData = await user.findById(userId).lean();

      
      const addressDoc = await Address.findOne({ userId: userId }).lean();
      
      
          let selectedAddress = null;
      
      
          if (addressDoc && addressDoc.address && order.address) {
            console.log("Order address value:", order.address.toString());
            console.log("User Addresses:", addressDoc.address.map(addr => addr._id.toString()));
            selectedAddress = addressDoc.address.find(addr =>
              addr._id.toString() === order.address.toString()
            );
          }
      
       





    if (!order) return res.redirect('/admin/orders');

    res.render('orderDetail', { order,
        address:selectedAddress,
        user:userData

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
    
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found',
        icon: 'error'
      });
    }

    // Define valid status transitions
    const validTransitions = {
      'Pending': ['Shipped'],
      'Shipped': ['Out for Delivery'],
      'Out for Delivery': ['Delivered'],
      'Delivered': [],
      'Cancelled': [],
      'Returned': []
    };

    // Check if the status transition is valid
    if (!validTransitions[order.orderStatus]?.includes(newStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot change status from ${order.orderStatus} to ${newStatus}`,
        icon: 'error'
      });
    }

    // Handle order cancellation logic
    if (newStatus === 'Cancelled') {
      // Restore product stock
      for (const item of order.items) {
        const product = await Product.findById(item.productId);
        if (product) {
          product.quantity += item.quantity;
          await product.save();
        }
      }

      // Handle refund if payment was made
      if (order.paymentStatus === 'Completed') {
        const user = await user.findById(order.user);
        if (user) {
          user.wallet = (user.wallet || 0) + order.totalAmount;
          await user.save();

          // Create wallet transaction
          await new WalletTransaction({
            userId: user._id,
            amount: order.totalAmount,
            type: 'Credit',
            description: `Refund for cancelled order ${order._id}`
          }).save();
        }
      }
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
      
      for (const item of order.items) {
        const product = item.productId;
        if (product) {
          product.quantity += item.quantity;
          await product.save();
        }
      }

      
      const refundAmount = order.totalAmount;
      order.user.wallet = (order.user.wallet || 0) + refundAmount;
      await order.user.save();

      
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

// Add these new functions to the controller
const listReturnRequests = async (req, res) => {
  try {
    const returnRequests = await Order.find({
      orderStatus: 'Return Requested',
      'returnRequest.status': 'Requested'
    })
    .populate('user', 'firstName lastName')
    .sort({ 'returnRequest.requestedAt': -1 })
    .lean();

    res.render('returnRequests', { returnRequests });
  } catch (error) {
    console.error('Error fetching return requests:', error);
    res.redirect('/pageNotFound');
  }
};

const processReturnRequest = async (req, res) => {
  try {
    const { orderId, approve } = req.body;
    const order = await Order.findById(orderId)
      .populate('user')
      .populate('items.productId');
      
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found'
      });
    }

    if (approve) {
      // Restore product stock
      for (const item of order.items) {
        const product = await Product.findById(item.productId);
        if (product) {
          product.quantity += item.quantity;
          await product.save();
        }
      }

      // Process refund
      const refundAmount = order.totalAmount;
      order.user.wallet = (order.user.wallet || 0) + refundAmount;
      await order.user.save();

      // Create wallet transaction
      await new WalletTransaction({
        userId: order.user._id,
        amount: refundAmount,
        type: 'Credit',
        description: `Refund for returned order ${order._id}`
      }).save();

      order.orderStatus = 'Returned';
      order.returnRequest.status = 'Approved';
    } else {
      order.orderStatus = 'Return Declined';
      order.returnRequest.status = 'Declined';
    }

    order.returnRequest.processedAt = new Date();
    await order.save();

    res.json({
      success: true,
      message: approve ? 'Return request approved and refund processed' : 'Return request declined'
    });
  } catch (error) {
    console.error('Error processing return request:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing return request'
    });
  }
};

// Update the exports
module.exports = {
  listOrders,
  viewOrderDetails,
  updateOrderStatus,
  verifyReturnRequest,
  listReturnRequests,
  processReturnRequest
};