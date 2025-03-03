const mongoose = require('mongoose');
const { Schema } = mongoose;

const productSchema = new Schema({
  productName: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: Schema.Types.ObjectId,
    ref: 'category', // Or 'Category' if your model is named "Category"
    required: true
  },
  regularPrice: {
    type: Number,
    required: true
  },
  salePrice: {
    type: Number,
    required: true
  },
  productOffer: {
    type: Number,
    default: 0
  },
  quantity: {
    type: Number,
    default: 0
  },
  productImage: [
    {
      type: String,
      required: true
    }
  ],
  isBlocked: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['Available', 'Out of stock', 'discontinued'],
    default: 'Available'
  }
}, 
{ timestamps: true });

module.exports = mongoose.model('Product', productSchema);
