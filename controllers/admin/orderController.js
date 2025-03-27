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

    let orders = await Order.find(query)
      .populate('user')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    
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

    const validTransitions = {
      'Pending': ['Shipped'],
      'Shipped': ['Out for Delivery'],
      'Out for Delivery': ['Delivered'],
      'Delivered': [],
      'Cancelled': [],
      'Returned': []
    };

    if (!validTransitions[order.orderStatus]?.includes(newStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot change status from ${order.orderStatus} to ${newStatus}`,
        icon: 'error'
      });
    }

    // Update both global order status and individual item statuses
    order.orderStatus = newStatus;
    
    // Update all items that aren't in a final state
    order.items.forEach(item => {
      // Don't update items that are already cancelled or returned
      if (!['Cancelled', 'Returned', 'Return Requested', 'Return Declined'].includes(item.status)) {
        item.status = newStatus;
      }
    });

    // Handle special cases
    if (newStatus === 'Cancelled') {
      // Restore product stock for non-cancelled items
      for (const item of order.items) {
        if (item.status !== 'Cancelled') {
          const product = await Product.findById(item.productId);
          if (product) {
            product.quantity += item.quantity;
            await product.save();
          }
          item.status = 'Cancelled';
        }
      }

      // Process refund if payment was completed
      if (order.paymentStatus === 'Completed') {
        const customer = await User.findById(order.user);
        if (customer) {
          customer.wallet = (customer.wallet || 0) + order.totalAmount;
          await customer.save();

          await new WalletTransaction({
            userId: customer._id,
            amount: order.totalAmount,
            type: 'Credit',
            description: `Refund for cancelled order ${order._id}`
          }).save();
        }
      }
    }

    // Update status timestamps
    order.statusUpdates = order.statusUpdates || {};
    const now = new Date();
    order.statusUpdates[newStatus] = now;
    
    // Also update timestamps for individual items
    order.items.forEach(item => {
      if (item.status === newStatus) {
        order.statusUpdates[`item-${item._id}-${newStatus}`] = now;
      }
    });

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

   
    if (!order.items.some(i => i.status === 'Return Requested')) {
      
      const allApprovedOrProcessed = order.items.every(i => 
        i.status === 'Returned' || i.status === 'Cancelled' || i.status === 'Return Declined'
      );
      if (allApprovedOrProcessed) {
      
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