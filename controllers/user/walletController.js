const User = require('../../models/userschema');
const WalletTransaction = require('../../models/walletSchema');

const wallet = async (req, res) => {
  try {

   
    const userId = req.session.user;

    const page = parseInt(req.query.page) || 1;
    const limit = 10;

    // Retrieve the user document which holds the wallet balance.
    const userData = await User.findById(userId)
      .populate('redeemedUsers', 'firstName lastName')
      .lean();

    if (!userData) {
      throw new Error('User not found');
    }

    // Wallet balance is stored directly on the user.
    const walletBalance = userData.wallet;

    // Calculate referral earnings (e.g., ₹100 per redeemed user).
    const referralEarnings = (userData.redeemedUsers?.length || 0) * 100;

    // Retrieve paginated wallet transactions from the WalletTransaction model.
    const transactions = await WalletTransaction.find({ userId: userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Count the total number of transactions for pagination.
    const totalTransactions = await WalletTransaction.countDocuments({ userId: userId });

    // Render the wallet view, passing the wallet balance, referral earnings, and transaction history.
    res.render('wallet', {
        user: userData,
      wallet: {
        balance: walletBalance,
        referralEarnings: referralEarnings
      },
      transactions: transactions,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalTransactions / limit)
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

module.exports = {
  wallet
};
