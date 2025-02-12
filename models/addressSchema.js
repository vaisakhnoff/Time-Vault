const mongoose = require('mongoose');
const {Schema} = mongoose;  

const addressSchema = new Schema({
    userId:{
        type:Schema.Types.ObjectId,
        ref:'user',
        required:true
    },
    address:{
        addressType:{
            type:String,
            required:true
        }
    },
    name:{
        type:String,
        required:true
    },
    city:{
        type:String,
        required:true
    },
    landMark:{
        type:String,
        required:true
    },
    state:{
        type:String,
        required:true
    },
    pincode:{
        type:Number,
        required:true
    },
    phone_no:{
        type:Number,
        required:true
    },
    altPhone_no:{
        type:Number,
        required:true
    },
})

const address = mongoose.model('address',addressSchema); 
module.exports = address; 