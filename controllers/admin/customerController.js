const User = require('../../models/userschema');

const customerInfo = async (req, res) => {
  try {
    
    let search = "";
    if (req.query.search) {
      search = req.query.search;
    }

    
    let page = 1;
    if (req.query.page) {
      page = parseInt(req.query.page, 10) || 1;
    }

    const limit = 3; 

   
    const query = {
      isAdmin: false,
      $or: [
        { firstName: { $regex: ".*" + search + ".*", $options: "i" } },
        { lastName: { $regex: ".*" + search + ".*", $options: "i" } },
        { email: { $regex: ".*" + search + ".*", $options: "i" } }
      ]
    };

    
    const userData = await User.find(query)
      .limit(limit)
      .skip((page - 1) * limit)
      .exec();

    
    const count = await User.countDocuments(query);
    const totalPages = Math.ceil(count / limit);

    // Pass data to the EJS template
    res.render('customers', { 
      data: userData, 
      totalPages, 
      currentPage: page,
      searchTerm: search 
    });
  } catch (error) {
    console.error("Error fetching customer info:", error);
    res.status(500).send("Internal Server Error");
  }
};


const blockCustomer = async (req, res) => {
    try {
      const id = req.query.id;
      await User.findByIdAndUpdate(id, { isBlocked: true });
      res.json({ success: true, message: "Customer blocked successfully" });
    } catch (error) {
      console.error("Error blocking customer:", error);
      res.status(500).json({ success: false, message: "Error blocking customer" });
    }
  };
  
  const unblockCustomer = async (req, res) => {
    try {
      const id = req.query.id;
      await User.findByIdAndUpdate(id, { isBlocked: false });
      res.json({ success: true, message: "Customer unblocked successfully" });
    } catch (error) {
      console.error("Error unblocking customer:", error);
      res.status(500).json({ success: false, message: "Error unblocking customer" });
    }
  }

  
  
  
module.exports = {
  customerInfo,
  blockCustomer,
    unblockCustomer,
};
