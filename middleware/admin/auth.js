const User = require('../../models/userschema')




const admincheckSession = (req,res,next)=>{
    User.findOne({isAdmin:true})
    .then(data=>{
        if(data){
            next()
        }
        else{
            res.redirect("/admin/login");
        }
    })
    .catch(error=>{
        console.log("Error in adminAuth middleware",error);
        res.status(500).send("Internal server error")
    })
}

const adminAlreadyLoggedIn = (req, res, next) => {
    if (req.session.admin) {
      // If admin is already logged in, redirect to the dashboard
      return res.redirect('/admin/dashboard');
    }
    next();
  };
  



const adminIsLogin = async (req, res, next) => {
    if (req.session.admin) {
        next() 
    } else {
        res.redirect('/admin/login');
    }  
}


module.exports={
    admincheckSession,
    adminIsLogin,
    adminAlreadyLoggedIn
    
}