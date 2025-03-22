const mongoose = require('mongoose');
const {Schema} = mongoose;
const {v4:uuidv4} = require('uuid');
const address = require('./addressSchema');




const orderSchema = new mongoose.Schema({
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'user',
      required: true
    },
   items: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      quantity: Number,
      price: Number,
      status: { 
        type: String, 
        enum: ['Pending', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Returned', 'Return Requested','Return Declined'],
        default: 'Pending'
      },
      cancellationReason: String,
      returnReason: String,
      reviewed: Boolean
    }
  ],
    // address: {
    //   name: String,
    //   city: String,
    //   landMark: String,
    //   state: String,
    //   pincode: String,
    //   phone_no: String,
    //   altPhone_no: String
    // }
    address: {
      type: Schema.Types.ObjectId,
      ref: 'address',
      required: true
    },
    paymentMethod: {
      type: String,
      enum: ['COD', 'Online', 'Wallet'],
      required: true
    },
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Completed', 'Failed'],
      default: 'Pending'
    },
    orderStatus: {
      type: String,
      enum: [
        'Pending', 
        'Processing', 
        'Shipped', 
        'Out for Delivery',  // Added this status
        'Delivered', 
        'Cancelled', 
        'Return Requested', 
        'Returned', 
        'Return Declined'
      ],
      default: 'Pending'
    },
    returnRequest: {
      reason: { type: String, default: '' },
      status: { type: String, enum: ['Requested', 'Approved', 'Declined'], default: 'Requested' },
      requestedAt: { type: Date, default: Date.now }
    },   
    totalAmount: {
      type: Number,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  });
  
  const order = mongoose.model('Order', orderSchema);
  
  module.exports = order;
