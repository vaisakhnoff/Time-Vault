const mongoose = require('mongoose');
const {Schema} = mongoose;

const cartSchema = new Schema({
    userId:{
        type:Schema.Types.ObjectId,
        ref:'user',
        required:true
    },
    items:[{
        productId:{
            type:Schema.Types.ObjectId,
            ref:'product',
            required:true
        },
        quantity:{
            type:Number,
            required:true,
            default:1
        },
        totalPrice:{
            type:Number,
            required:true
        },
        status:{
            type:string,
            default:'placed'
        },
        cancellationReason:   {
            type:string,
            default:'none'
        }
    }],
   
})
const cart = mongoose.model('cart',cartSchema);
module.exports = cart;