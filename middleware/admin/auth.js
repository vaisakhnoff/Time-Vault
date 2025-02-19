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


const adminIsLogin = (req, res, next) => {
    if (req.session.admin) {
      // If admin is logged in, redirect them to the admin dashboard/home
      res.redirect('/admin');
    } else {
      next();
    }
  };
  
 

module.exports={
    admincheckSession,
    adminIsLogin
}