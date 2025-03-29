const mongoose = require('mongoose');
const {Schema} = mongoose;
const {v4:uuidv4} = require('uuid');
const address = require('./addressSchema');


const orderSchema = new mongoose.Schema({
    orderId: {
        type: String,
        default: () => `ORD-${uuidv4().substring(0, 8).toUpperCase()}`,
        unique: true
    },
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
      originalPrice: Number, // Price before any discounts
      discountedPrice: Number, // Price after coupon discount
      couponShare: Number, // This item's share of the coupon discount
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
        'Out for Delivery', 
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
    couponApplied: {
      type: Boolean,
      default: false
    },
    couponCode: {
      type: String
    },
    couponDiscount: {
      type: Number,
      default: 0
    },
    originalTotalAmount: {
      type: Number,
      required: true
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
