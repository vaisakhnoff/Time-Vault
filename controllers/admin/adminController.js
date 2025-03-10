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
            req.session.admin = admin._id; // Store admin ID in session
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



module.exports = {
    loadLogin,
    login,
    loadDashboard,
    pageError,
    logout,
}