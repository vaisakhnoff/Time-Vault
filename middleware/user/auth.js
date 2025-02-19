const User = require('../../models/userschema')

// const checkSession = ((req,res,next)=>{
    
//     if(req.session.user){
//         User.findById(req.session.user)
//         .then(data=>{
//             if(data && !data.isBlocked){
//                 console.log("Data",data);
                
//                 next();
//             }
//             else{
//                 console.log("home");
                
//                 rs.redirect('/login')
//             }
//         })
//         .catch(error=>{
//             console.log("Error in user auth middleware");
//             res.status(500).send("Internal server error")
            
//         })
//     }
//     else{
//         res.redirect('/login')
//     }
// })




const isLogin=((req,res,next)=>{
    if(req.session.user){
        res.redirect('/')
    }else{
        next()
    }
})




module.exports={
    isLogin
}