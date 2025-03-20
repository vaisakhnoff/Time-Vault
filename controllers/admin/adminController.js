const User = require('../../models/userschema');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');




const loadLogin = async (req, res) => {
    try {
        if (req.session.admin) {
            res.redirect('/admin');
        } else {
            res.render('admin-login',{message:null}); 
        }
    } catch (error) {
        console.log("Error loading admin login page:", error);
        res.redirect('/admin/pageError');
    }
}

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const admin = await User.findOne({ email, isAdmin: true });

        if (!admin) {
            return res.redirect('/admin/login');
        }

        const passwordMatch = await bcrypt.compare(password, admin.password);
        
        if (passwordMatch) {
            req.session.admin = admin._id; 
            // return res.render('dashboard');
            return res.redirect('/admin/dashboard');
        } else {
            return res.redirect('/admin/login');
        }
    } catch (error) {
        console.log("Login error", error);
        return res.redirect('/admin/pageError');
    }
}

const loadDashboard = async(req,res)=>{
   if(req.session.admin){
   
    try {
        res.redirect('/admin/dashboard');
        // res.render('dashboard')
    } catch (error) {
        res.redirect('/login')
    }
   }
}

const pageError = async(req,res)=>{
    res.render('admin-error')
}

const logout = async(req,res)=>{

    try {
        req.session.destroy(error=>{
            if(error){
                console.log("Error destroying error ",error);return res.redirect('/pageError')
                
            }
            res.redirect('/admin/login')
        });

    } catch (error) {
        console.log("unexpected error during logging",error);
        res.redirect('/admin/dashboard')
        
    }
}



  const handleItemReturn = async (req, res) => {
    try {
      const { orderId, productId, action } = req.body;
      const order = await Order.findById(orderId).populate('user').populate('items.productId');
      
      if (!order) {
        return res.status(404).json({ success: false, message: "Order not found" });
      }
  
      const orderItem = order.items.find(item => 
        item.productId._id.toString() === productId
      );
  
      if (!orderItem) {
        return res.status(404).json({ success: false, message: "Item not found" });
      }
  
      if (action === 'approve') {
        // Restore stock
        await Product.findByIdAndUpdate(productId, {
          $inc: { quantity: orderItem.quantity }
        });
  
        // Process refund
        const refundAmount = orderItem.refundAmount || orderItem.totalPrice;
        order.user.wallet = (order.user.wallet || 0) + refundAmount;
        await order.user.save();
  
        // Record transaction
        await new WalletTransaction({
          userId: order.user._id,
          amount: refundAmount,
          type: "Credit",
          description: `Refund for returned item in order ${orderId}`
        }).save();
  
        orderItem.status = 'Returned';
      } else {
        orderItem.status = 'Return Rejected';
      }
  
      orderItem.returnRequest.status = action === 'approve' ? 'Approved' : 'Rejected';
      orderItem.returnRequest.processedAt = new Date();
  
      await order.save();
  
      return res.json({ 
        success: true, 
        message: `Return ${action === 'approve' ? 'approved' : 'rejected'} successfully` 
      });
    } catch (error) {
      console.error('Error handling return:', error);
      return res.status(500).json({ success: false, message: "Error processing return" });
    }
  };

module.exports = {
    loadLogin,
    login,
    loadDashboard,
    pageError,
    logout,
    handleItemReturn
}