const User = require('../../models/userschema')





const checkSession = (req, res, next) => {
    if (req.session.user) {
      User.findById(req.session.user)
        .then(data => {
          if (data && !data.isBlocked) {
            console.log("Data", data);
            next();
          } else {
           
            req.session.destroy(err => {
              if (err) {
                console.error("Session destruction error:", err);
              }
              return res.redirect('/login');
            });
          }
        })
        .catch(error => {
          console.log("Error in user auth middleware:", error);
          res.status(500).send("Internal server error");
        });
    } else {
      res.redirect('/login');
    }
  };
  



module.exports={
    
    checkSession
}