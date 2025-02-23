const { request } = require('../../app');
const User = require('../../models/userschema');
const nodemailer = require('nodemailer')
const env = require('dotenv').config()
const bcrypt = require('bcrypt');
const passport = require("passport");

const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');



const loadHomepage = async (req, res) => {
    try {
        const userId = req.session.user;
        const categories = await Category.find({ isListed: true });
        let productData = await Product.find({
            isBlocked: false,
            category: { $in: categories.map(category => category._id) },
            quantity: { $gt: 0 }
        }).populate('category').lean(); // Add .lean() for better performance

        // Map the products to include the correct image path
        productData = productData.map(product => ({
            ...product,
            productImage: product.productImage.map(img => `/uploads/product-images/${img}`)
        }));

        productData.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));
        productData = productData.slice(0, 4);

        if (userId) {
            const userData = await User.findOne({ _id: userId });
            if (userData && userData.isBlocked) {
                return res.redirect('/login');
            }
            res.render('home', { user: userData, products: productData });
        } else {
            res.render('home', { products: productData });
        }
    } catch (error) {
        console.error("Error loading homepage:", error);
        res.status(500).send("Internal Server Error");
    }
};
  

const pageNotFound = async(req,res)=>{  
    try{
         res.render('page-404');
}
catch(error){
    res.redirect('/pageNotFound');
}
}

const loadLoginPage = async(req,res)=>{
    try{
        if(!req.session.user){
           return  res.render('login');
        }
        else{
            res.redirect('/')
        }
        
    }
    catch(error){
        res.redirect('/pageNotFound')
       
    }
}

const loadSignupPage = async(req,res)=>{
    try{
        res.render('signup');
    }
    catch(error){
        console.log("Signup page not found");
        res.status(500).send("Internal Server Error");
    }
}

const googleAuthCallback = (req, res) => {
    // Set req.session.user using the authenticated user from Passport
    req.session.user = req.user._id;
    res.redirect('/');
  };
 

function generateOTP(){
    return Math.floor(100000 + Math.random()*900000).toString();
}

 async function sendverificationEmail(email,otp){
    try{
const transporter  = nodemailer.createTransport({
    service:'gmail',
    port:587,
    secure:false,
    requireTLS:true,
    auth:{
        user:process.env.NODEMAILER_EMAIL,
        pass:process.env.NODEMAILER_PASSWORD

    }
})



const info = await transporter.sendMail({
    from:process.env.NODEMAILER_EMAIL,
    to:email,
    subject:"Verify your account ",
    text:`Your OTP is ${otp} `,
    html:`<b>Your OTP : ${otp}</b>`
})
return info.accepted.length > 0
    }
    catch(error){
console.error("Error sending email",error);
return false

    }
 }




const signUp = async(req,res)=>{
    try {
        
        const {firstName,lastName,phoneNumber,email,password,confirmPassword}=req.body;

        if(password!==confirmPassword){
            return res.render('signup',{message:"Passwords do not match"});
        }
        const findUser = await User.findOne({email});
        if(findUser){
            return res.render('signup',{message:"User with this email already exists"});
        }

        const otp = generateOTP();
        const emailSend = await  sendverificationEmail(email,otp);
        

        if(!emailSend){
            return res.json("Email-Error")
        }

        req.session.userOtp = otp
        req.session.userData = {firstName,lastName,phoneNumber,email,password};


        res.render("verify-otp");
        console.log("OTP sent",otp);
        
    } catch (error) {
        console.error("signup error",error);
        res.redirect('/pageNotFound')
    }
}

const securePassword = async(password)=>{
    try {
        return await bcrypt.hash(password,10);
    } catch (error) {
        throw error;
    }
}

const verifyOtp = async (req, res) => {
    try {
      const { otp } = req.body;
      console.log("Received OTP:", otp);
      if (otp === req.session.userOtp) {
        // Rename the session variable to avoid conflict
        const userData = req.session.userData;
        const passwordHash = await securePassword(userData.password);
        // Use the model (now imported as User)
        const saveUserData = new User({
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: userData.email,
          phoneNumber: userData.phoneNumber,
          password: passwordHash,
        });
        await saveUserData.save();
        // req.session.user = saveUserData._id;
        res.json({ success: true, redirectUrl: "/login" });
      } else {
        res.status(400).json({ success: false, message: "Invalid OTP, Please try again." });
      }
    } catch (error) {
      console.error("Error verifying OTP", error);
      res.status(500).json({ success: false, message: "An error occurred" });
    }
  };
  
  const resendOtp = async (req,res)=>{
try {
  const {email} = req.session.userData;
  if(!email){
    return res.status(400).json({success:false,message:"Email not found in session "});

    const otp = generateOtp();
    req.session.userOtp=otp;
    const email = await sendverificationEmail(email,otp);
    if(emailSend){
        console.log("Resend OTP",otp);
        res.status(200).json({success:true,message:"OTP resend successfully"})
    }
        else{
res.status(500).json({success:false,message:"Failed to resend OTP.Please try again"})
        }
        
  }
    
} catch (error) {
    console.error("Error sending OTP",error);
    res.status(500).json({success:false,message:"Internal server error . Please try again later "})
}
  }

  const login = async(req,res)=>{
    try {
        const {email,password} = req.body;
        const findUser = await User.findOne({isAdmin:0,email:email});
        if(!findUser){
            return res.render('login',{message:"User not found"})
        }
        if(findUser.isBlocked){
            return res.render('login',{message:"User is blocked by admin"})
        }

const passwordMatch = await bcrypt.compare(password,findUser.password);

if(!passwordMatch){
    return res.render('login',{message:"Incorrect password"});

}
req.session.user = findUser._id ;
res.redirect('/')
    } catch (error) {
        console.error("login error",error);
        res.render('login',{message:"Login failed, Please try again later"})
    }
  }

  const logout = async(req,res)=>{
    try {
        req.session.destroy((error)=>{
            if(error){
                console.log("session destruction error",error.message);
                return  res.redirect('/pageNotFound')
            }
            return res.redirect('login')
        })


    } catch (error) {
        console.log("Logout error",error);
        res.redirect('/pageNotFound')
        
    }
  }

  const loadShopPage = async(req,res)=>{

    try {
        console.log("1");
        
        const page = parseInt(req.query.page) || 1;
        const limit = 9;
        const skip = (page - 1) * limit;

        // Get all categories
        const categories = await Category.find({ isListed: true });
        console.log("2");
        
        
        let query = { isBlocked: false };
        
        if (req.query.category) {
            query.category = req.query.category;
        }
        
        if (req.query.search) {
            query.productName = { $regex: req.query.search, $options: 'i' };
        }
console.log("3");

        // Get products and format image paths
        let products = await Product.find(query)
            .populate('category')
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 })
            .lean();

        // Format image paths
        products = products.map(product => ({
            ...product,
            productImage: product.productImage.map(img => `/uploads/product-images/${img}`)
        }));

        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);
console.log("hi");

        res.render('shop', {
            products,
            currentPage: page,
            totalPages,
            categories,
            selectedCategory: req.query.category || '',
            searchQuery: req.query.search || ''
        });

    } catch (error) {
        console.error("Error loading shop page:", error);
        res.redirect('/pageNotFound');
    }
}

module.exports ={
    loadHomepage,
    pageNotFound,
    loadLoginPage,
    loadSignupPage,
    signUp,
    verifyOtp,
    resendOtp,
    login,
    logout,
    googleAuthCallback,
    loadShopPage
}