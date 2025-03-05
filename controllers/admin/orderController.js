const Order = require('../../models/orderSchema');
const user = require('../../models/userschema'); // 
const Address = require('../../models/addressSchema');

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

// Update order status
const updateOrderStatus = async (req, res) => {
  try {
    const { orderId, newStatus } = req.body;
    const validStatuses = ['Pending', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'];
    
    if (!validStatuses.includes(newStatus)) {
      return res.json({ success: false, message: 'Invalid status' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.json({ success: false, message: 'Order not found' });
    }

 
    const finalStatuses = ['Delivered', 'Cancelled', 'Returned', 'Return Declined'];
    if (finalStatuses.includes(order.orderStatus)) {
      return res.json({ success: false, message: 'Final order status reached. No further updates are allowed.' });
    }

  
    const currentStatusIndex = validStatuses.indexOf(order.orderStatus);
    const newStatusIndex = validStatuses.indexOf(newStatus);

    if (newStatusIndex < currentStatusIndex) {
      return res.json({ 
        success: false, 
        message: 'Order status cannot be reversed to a previous state.' 
      });
    } else if (newStatusIndex === currentStatusIndex) {
      return res.json({ 
        success: false, 
        message: 'Order is already in the selected status.' 
      });
    }

    order.orderStatus = newStatus;
    order.statusUpdates = order.statusUpdates || {};
    order.statusUpdates[newStatus] = new Date();
    await order.save();

    res.json({ success: true, message: 'Order status updated successfully' });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.json({ success: false, message: 'Error updating order status' });
  }
};


const verifyReturnRequest = async (req, res) => {
  try {
    const { orderId, approve } = req.body;
    const order = await Order.findById(orderId).populate('user');
    if (!order) return res.json({ success: false, message: 'Order not found' });

    if (approve === 'true' || approve === true) {
      order.user.wallet = (order.user.wallet || 0) + order.totalAmount;
      await order.user.save();
      order.orderStatus = 'Returned';
      order.statusUpdates = order.statusUpdates || {};
      order.statusUpdates['Returned'] = new Date();
      await order.save();
      return res.json({ success: true, message: 'Return approved & amount refunded to wallet' });
    } else {
      order.orderStatus = 'Return Declined';
      order.statusUpdates = order.statusUpdates || {};
      order.statusUpdates['Return Declined'] = new Date();
      await order.save();
      return res.json({ success: true, message: 'Return request declined' });
    }
  } catch (error) {
    console.error('Error verifying return request:', error);
    res.json({ success: false, message: 'Error verifying return request' });
  }
};

module.exports = {
  listOrders,
  viewOrderDetails,
  updateOrderStatus,
  verifyReturnRequest
};