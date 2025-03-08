const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const Address = require('../../models/addressSchema');
const User = require('../../models/userschema');

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


// const verifyReturnRequest = async (req, res) => {
//   try {
//     const { orderId, approve } = req.body;
//     const order = await Order.findById(orderId).populate('user');
//     if (!order)
//       return res.json({ success: false, message: 'Order not found' });

//     // Refund is processed only if admin has approved the return request.
//     if (approve === 'true' || approve === true) {
//       order.user.wallet = (order.user.wallet || 0) + order.totalAmount;
//       await order.user.save();
//       order.orderStatus = 'Returned';
//       order.statusUpdates = order.statusUpdates || {};
//       order.statusUpdates['Returned'] = new Date();
//       await order.save();
//       return res.json({ success: true, message: 'Return approved & amount refunded to wallet' });
//     } else {
//       order.orderStatus = 'Return Declined';
//       order.statusUpdates = order.statusUpdates || {};
//       order.statusUpdates['Return Declined'] = new Date();
//       await order.save();
//       return res.json({ success: true, message: 'Return request declined' });
//     }
//   } catch (error) {
//     console.error('Error verifying return request:', error);
//     res.json({ success: false, message: 'Error verifying return request' });
//   }
// };

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

module.exports = {

  viewOrderDetails,
  cancelOrder,
  submitReview,
  // verifyReturnRequest,
  requestReturnOrder  // new function
};