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


const listReturnRequests = async (req, res) => {
  try {
    let orders = await Order.find({
      $or: [
        { orderStatus: 'Return Requested' },
        { 'items.status': 'Return Requested' }
      ]
    })
    .populate('user', 'firstName lastName')
    .populate('items.productId', 'productName productImage price')
    .lean();

    const returnRequests = [];
    
    orders.forEach(order => {
      if (order.orderStatus === 'Return Requested') {
        // Push only the global request and ignore individual items
        returnRequests.push({
          orderId: order._id,
          orderDate: order.createdAt,
          customer: order.user,
          isGlobalReturn: true,
          totalAmount: order.totalAmount,
          reason: order.returnRequest?.reason || 'N/A',
          items: order.items
        });
      } else {
        // Only process individual returns if a global return was not set
        order.items.forEach(item => {
          if (item.status === 'Return Requested') {
            returnRequests.push({
              orderId: order._id,
              orderDate: order.createdAt,
              customer: order.user,
              isGlobalReturn: false,
              product: item.productId,
              quantity: item.quantity,
              amount: item.price * item.quantity,
              reason: item.returnReason || 'N/A'
            });
          }
        });
      }
    });

    returnRequests.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));
    
    res.render('returnRequests', { returnRequests });
  } catch (error) {
    console.error('Error fetching return requests:', error);
    res.redirect('/pageNotFound');
  }
};

const processReturnRequest = async (req, res) => {
  try {
    const { orderId, approve, productId } = req.body;
    const order = await Order.findById(orderId)
      .populate('user')
      .populate('items.productId');
    
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found'
      });
    }

    
    const item = order.items.find(item => item.productId &&
      item.productId._id.toString() === productId);
    if (!item || item.status !== 'Return Requested') {
      return res.status(400).json({
        success: false,
        message: 'Return request for this product has already been processed'
      });
    }

    if (approve === true || approve === 'true') {
      // Restore stock for this product item
      const product = await Product.findById(productId);
      if (product) {
        product.quantity += item.quantity;
        await product.save();
      }
      // Process refund for this product item
      const refundAmount = item.price * item.quantity;
      order.user.wallet = (order.user.wallet || 0) + refundAmount;
      await order.user.save();

      await new WalletTransaction({
        userId: order.user._id,
        amount: refundAmount,
        type: 'Credit',
        description: `Refund for product return in order ${order._id} for product ${product.productName}`
      }).save();

      item.status = 'Returned';
    } else {
      item.status = 'Return Declined';
    }

    // Only update the overall order status if no items are pending a return decision.
    // You can choose to leave the overall order status unchanged if some items are still pending,
    // or update it to "Partial Return" if desired.
    if (!order.items.some(i => i.status === 'Return Requested')) {
      // For example, if at least one item was approved for return,
      // you might mark the order as "Partial Return" if not all items are returned.
      const allApprovedOrProcessed = order.items.every(i => 
        i.status === 'Returned' || i.status === 'Cancelled' || i.status === 'Return Declined'
      );
      if (allApprovedOrProcessed) {
        // If every item was approved (or processed) then update overall status.
        // Business logic here: if all items are returned, mark as Returned;
        // otherwise, if some items are still delivered, you can leave it as Delivered or mark as Partial Return.
        const allReturned = order.items.every(i => i.status === 'Returned' || i.status === 'Cancelled');
        order.orderStatus = allReturned ? 'Returned' : 'Delivered';
      }
    }

    order.returnRequest.processedAt = new Date();
    await order.save();

    return res.json({
      success: true,
      message: approve === true || approve === 'true'
        ? 'Return request approved for product and refund processed'
        : 'Return request declined for product'
    });
  } catch (error) {
    console.error('Error processing return request:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing return request'
    });
  }
};


module.exports = {
  listOrders,
  viewOrderDetails,
  updateOrderStatus,
  listReturnRequests,
  processReturnRequest
};