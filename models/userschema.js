const { name } = require('ejs');
const mongoose = require('mongoose');
const {Schema} = mongoose;

const userschema =  new Schema({
    name: {
        type : String,
        required : true
    },
    email:{
        type : String,
        required : true,
        unique : true
    },
    phone_no:{
        type : Number,
        required : false,
        unique :    false,
        sparse : true
      },
      googleId:{
        type : String,
        required : false,
        unique : true
      },
      password:{
        type : String,
        required : false
      },
      isBlocked:{
        type : Boolean,
        default:false
      },
      isAdmin:{
        type:Boolean,
        required:false
      },
      cart:[{
        type:Schema.Types.ObjectId,
        ref:'cart'
      }],
      wallet:{
        type:Number,
        default:0
      },
      wishlist:[{
        type:Schema.Types.ObjectId,
        ref:'wishlist'
      }],
      orderHistory:{
        type:Schema.Types.ObjectId,
        ref:'order'

      },
      createdOn:{
        type:Date,
        default:Date.now
      },
      referalCode:{
        type:String,
        
      },
      redeemed:{
        type:Boolean,
        
      },
      redeemedUsers:[{
        type:Schema.Types.ObjectId,
        ref:'users'
      }],
      searchHistory:[{
        category:{
            type:Schema.Types.ObjectId,
            ref:'category'
        }
      }],
      brand:{
        type:String
      },
      searchOn:{
        type:Date.now
      }


})

const user = mongoose.model('user',userschema);

module.exports = user;