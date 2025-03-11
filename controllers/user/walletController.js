const User = require('../../models/userschema');
const WalletTransaction = require('../../models/walletSchema');

const wallet = async (req, res) => {
  try {
    const userId = req.session.user;
    const page = parseInt(req.query.page) || 1;
    const limit = 5; // maximum 5 transactions per page

    // Fetch user data and populate redeemedUsers
    const userData = await User.findById(userId)
      .populate('redeemedUsers', 'firstName lastName')
      .lean();
    
    if (!userData) {
      throw new Error('User not found');
    }

    // Set wallet values
    const walletBalance = userData.wallet;
    const referralEarnings = (userData.redeemedUsers?.length || 0) * 100;

    // Fetch paginated wallet transactions
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

module.exports = {
  wallet
};
