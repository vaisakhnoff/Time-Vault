const express = require('express');
const app = express();
const path =require('path');
const userRouter = require('./routes/userRouter');
const adminRouter = require('./routes/adminRouter') 
const env = require('dotenv').config();
const passport = require('./config/passport')
const session = require('express-session');
const db  = require('./config/db');
const nocache=require('nocache')
db();

app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(session({
    secret:process.env.SESSION_SECRET,
    resave:false,
    saveUninitialized:true,
    cookie:{
        secure:false,
        httpOnly:true,
        maxAge:1000*60*60*24
    }
}));




// app.use('/uploads', express.static('uploads'))

app.use(nocache())
app.use(passport.initialize());
app.use(passport.session());

app.set("view engine","ejs");
app.set("views",[path.join(__dirname,'views/user'),path.join(__dirname,'views/admin')]);
app.use(express.static(path.join(__dirname,'public')));


app.listen(process.env.PORT,()=>{
    console.log("server is running");   
    
});

app.use('/',userRouter)
app.use('/admin',adminRouter)

module.exports = app;