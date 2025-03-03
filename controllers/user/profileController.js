const User = require('../../models/userschema');
const {sendverificationEmail}  = require('../user/userController')
const multer = require('multer');
const path = require('path');
const Address = require('../../models/addressSchema');
const Order = require('../../models/orderSchema');

function generateOTP(){
    return Math.floor(100000 + Math.random()*900000).toString();
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/profile');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

const  userProfile = async(req,res)=>{
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId)
        res.render('profile',{
            user:userData,

        })
    } catch (error) {
        console.error('Error for retrive profile data ',error);
        res.redirect('/pageNotFound');
    }
}

const changeEmail = async (req,res)=>{
    try {
        
        const userId = req.session.user;
        const userData = await User.findById(userId).lean();
        
        if (!userData) {
            return res.redirect('/login');
        }

        res.render("change-email", {
            user: userData,
            message: req.query.message || ''
        });
    } catch (error) {
        console.error('Error loading change email page:', error);
        res.redirect('/pageNotFound');
    }
}


const changeEmailValid = async(req,res)=>{
    try {

        
        
        const {email} = req.body;
        const userExists = await User.findOne({email});
    
        
        if(userExists){
            const otp = generateOTP();
            console.log(otp);
           
            const emailSent = await sendverificationEmail(email,otp);
          
            if(emailSent){
               
    req.session.userOtp = otp;
    req.session.userData = req.body;
    req.session.email = email;
    res.render('verifyEmail-otp')
    console.log("email sent",otp);
            }
    else{
     
        res.json("email-error")
    }
}
else{
    
    
    res.render('change-email');
    message:"user with this email not exist"
}
            
    } catch (error) {
        
       res.redirect('/pageNotFound')
    }
  }


  const verifyEmail = async(req,res)=>{
    try {
        const enteredOtp = req.body.otp;
        if(enteredOtp===req.session.userOtp){
            req.session.userData = req.body.userData;
          
            
            res.render("new-email",
                {
                    userData : req.session.userData,

                }
            )
        }
        else{
            console.log("ho");
            
            res.render('change-email',
                {
                    message:"OTP not matching",
                    userData : req.session.userData
                }
            )
        }
    } catch (error) {
        res.redirect('/pageNotFound')
    }
  }

const updateEmail = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.redirect('/login'); // or send an error message
        }
        const newEmail = req.body.newEmail;
        const userId = req.session.user;
        await User.findByIdAndUpdate(userId, { email: newEmail });
        res.redirect('/userProfile');
    } catch (error) {
        console.log(error);
        res.redirect('/pageNotFound');
    }
};

const changePassword = async (req,res)=>{
    try {

        const userId = req.session.user;
        const userData = await User.findById(userId).lean();
    
       

        res.render("change-password", {
            user: userData,
            message: req.query.message || ''
        });

    } catch (error) {
        res.redirect('/pageNotFound')
    }
}

const changePasswordValid = async(req,res)=>{
    try {
       const {email} = req.body;
       const userExists = await User.findOne({email});
       if(userExists){
        const otp = generateOTP();
        const emailsent = await sendverificationEmail(email,otp)
        if(emailsent){
            req.session.userOtp = otp;
            req.session.userData = req.body;
            req.session.email = email;
            res.render('change-password-otp')
            console.log("OTP :",otp);
            
        }else{
            res.json({
                success:false,
                message:"Failed to send otp . Please try again"
            })
        }
       }else{
        res.render('change-password',{
            message: "User with this email does not exist"
        })

       }
    } catch (error) {
        console.log("error in change password validation",error);
        res.redirect('/pageNotFound')
    }
}

const verifyChangePassword = async(req,res)=>{
    try {
        const enteredOtp = req.body.otp;
        if(enteredOtp===req.session.userOtp){
res.json({success:true,redirectUrl:"/resetPassword"})

        }
    } catch (error) {
        res.status(500).json({success:false,message:"An error occured , please try again later" })
    }
}

const editProfile = async(req,res)=>{
    try {

        const userId = req.session.user;
        const userData = await User.findById(userId).lean();
    
       
        res.render("editProfile", {
            user: userData,
            message: req.query.message || ''
        });

       
    } catch (error) {
        console.log("error in edit profile ",error);
        res.redirect('/pageNotFound')
    }
}

const updateProfile = async (req, res) => {
    try {
        const userId = req.session.user;
        
        // Get the base64 image from the form
        const base64Image = req.body.croppedImage;
        
        if (!base64Image) {
            return res.status(400).json({ 
                success: false, 
                message: 'No image provided' 
            });
        }

        // Convert base64 to buffer
        const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');

        // Generate unique filename
        const filename = `profile-${userId}-${Date.now()}.png`;
        const filepath = path.join('public/uploads/profile', filename);

        // Save the file
        require('fs').writeFileSync(filepath, imageBuffer);

        // Update user profile in database
        await User.findByIdAndUpdate(userId, {
            profileImage: `/uploads/profile/${filename}` // Store the relative path
        });

        res.json({
            success: true,
            message: 'Profile updated successfully',
            redirectUrl: '/userProfile'
        });

    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating profile'
        });
    }
};

const userAddress = async(req,res)=>{
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId).lean();
        
       
        const addresses = await Address.find({ userId: userId });
        
        // Render the userAddress page with the fetched addresses
        res.render('userAddress', {
            user: userData,
            addresses: addresses,
            message: req.query.message || ''
        });

    } catch (error) {
        console.error('Error fetching addresses:', error);
        res.redirect('/pageNotFound');
    }
}

const addAddressPage = async(req,res)=>{
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId).lean();

        res.render('addAddress',{
            user:userData
        })
        
    } catch (error) {
        
    }
}

const addAddress = async (req, res) => {
  try {
    const userId = req.session.user;
   
    const { name, city, landMark, state, pincode, phone_no, altPhone_no } = req.body;
    
    const addressType = req.body.address ? req.body.address.addressType : null;

    const newAddress = new Address({
      userId,
      address: { addressType },
      name,
      city,
      landMark,
      state,
      pincode,
      phone_no,
      altPhone_no
    });

    await newAddress.save();

    res.redirect('/userAddress?message=Address added successfully');
  } catch (error) {
    console.error('Error adding address:', error);
    res.redirect('/pageNotFound');
  }
};


const editAddressPage = async (req, res) => {
  try {
    // Get the address id from the posted form data
    const addressId = req.body.addressId;
    const addressData = await Address.findById(addressId).lean();
    
    if (!addressData) {
      return res.redirect('/userAddress?message=Address not found');
    }
    
    res.render('editAddress', {
      address: addressData
    });
  } catch (error) {
    console.error('Error fetching address for edit:', error);
    res.redirect('/pageNotFound');
  }
};

const updateAddress = async (req, res) => {
    try {
      const { addressId, name, city, landMark, state, pincode, phone_no, altPhone_no } = req.body;
      const addressType = req.body.address ? req.body.address.addressType : null;
  
      await Address.findByIdAndUpdate(addressId, {
        name,
        city,
        landMark,
        state,
        pincode,
        phone_no,
        altPhone_no,
        address: { addressType }
      });
  
      res.redirect('/userAddress?message=Address updated successfully');
    } catch (error) {
      console.error('Error updating address:', error);
      res.redirect('/pageNotFound');
    }
  };

const deleteAddress = async (req, res) => {
  try {
    const addressId = req.body.addressId;
    if (!addressId) {
      return res.redirect('/userAddress?message=Address not found');
    }
    await Address.findByIdAndDelete(addressId);
    res.redirect('/userAddress?message=Address deleted successfully');
  } catch (error) {
    console.error('Error deleting address:', error);
    res.redirect('/pageNotFound');
  }
};

const userOrders = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findById(userId).lean();
    const orders = await Order.find({ user: userId })
  .populate({
    path: 'items.productId',
    model: 'Product', 
  })
  .sort({ createdAt: -1 })
  .lean();

     

    res.render('userOrders', {
      user: userData,
      orders: orders
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.redirect('/pageNotFound');
  }
};

module.exports ={
    userProfile,
    changeEmail,
    changeEmailValid,
    verifyEmail,
    updateEmail,
    changePassword,
    changePasswordValid,
    verifyChangePassword,
    editProfile,
    updateProfile,
    userAddress,
    addAddressPage,
    addAddress,
    editAddressPage,
    updateAddress,
    deleteAddress,
    userOrders
}