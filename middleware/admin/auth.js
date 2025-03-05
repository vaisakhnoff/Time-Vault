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





const adminIsLogin = async (req, res, next) => {
    try {
        if (req.session.admin) {
            res.redirect('/admin'); 
        } else {
            next(); 
        }
    } catch (error) {
        console.log(error.message);
        res.redirect('/admin/pageError');
    }
}
  
 

module.exports={
    admincheckSession,
    adminIsLogin
}