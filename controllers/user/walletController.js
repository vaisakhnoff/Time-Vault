const User = require('../../models/userschema');
const WalletTransaction = require('../../models/walletSchema');
const Razorpay = require("razorpay");
const crypto = require("crypto");

const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});




const wallet = async (req, res) => {
  try {
    const userId = req.session.user;
    const page = parseInt(req.query.page) || 1;
    const limit = 5; 

   
    const userData = await User.findById(userId)
      .populate('redeemedUsers', 'firstName lastName')
      .lean();
    
    if (!userData) {
      throw new Error('User not found');
    }

    
    const walletBalance = userData.wallet;
    const referralEarnings = (userData.redeemedUsers?.length || 0) * 100;

   
    const transactions = await WalletTransaction.find({ userId: userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const totalTransactions = await WalletTransaction.countDocuments({ userId: userId });
    const totalPages = Math.ceil(totalTransactions / limit);

    res.render('wallet', {
      user: userData,
      wallet: {
        balance: walletBalance,
        referralEarnings: referralEarnings
      },
      transactions: transactions,
      pagination: {
        currentPage: page,
        totalPages: totalPages
      }
    });
  } catch (error) {
    console.error('Error retrieving wallet data:', error);
    res.status(500).render('page-404', {
      message: 'Error retrieving wallet data',
      error: { status: 500 }
    });
  }
};



const createOrder = async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid amount" });
    }
    // Convert rupees to paise
    const amountInPaise = amount * 100;
    const options = {
      amount: amountInPaise,
      currency: "INR"
    };
    const order = await razorpayInstance.orders.create(options);
    return res.json({ success: true, order });
  } catch (error) {
    console.error("Error creating Razorpay order", error);
    return res.status(500).json({ success: false, message: "Error creating order" });
  }
};


const paymentSuccess = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;
   
    const generated_signature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest('hex');
    
    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Payment verification failed" });
    }
    
    const userId = req.session.user;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    user.wallet = (user.wallet || 0) + amount; // add amount (in rupees)
    await user.save();
    
    const walletTx = new WalletTransaction({
      userId: user._id,
      amount: amount,
      type: "Credit",
      description: "Added money to wallet"
    });
    await walletTx.save();
    
    return res.json({ success: true, message: "Wallet updated successfully" });
  } catch (error) {
    console.error("Error in wallet payment success", error);
    return res.status(500).json({ success: false, message: "Error processing payment" });
  }
};


module.exports = {
  wallet,
  createOrder,
  paymentSuccess
 
};
