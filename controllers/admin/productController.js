const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const fs = require('fs');
const path = require('path');
const User = require('../../models/userschema');
const sharp =require('sharp');
const { getRandomValues } = require('crypto');


const getProductInfo = async(req,res)=>{
    try {
        const products = await Product.find({}).populate('category');
        
        res.render('products', { products });
      } catch (error) {
        console.error("Error fetching products:", error);
        res.redirect('/pageError');
      }
}

const getProductAddPage = async(req,res)=>{
    try {
        const category =  await Category.find({isListed:true});
        console.log("enter");
        
        res.render('product-add',{
            cat:category,
            
        })
    } catch (error) {
        console.log("enteru");
        res.redirect('/pageError')
    }
}

const addProducts = async(req,res)=>{
    try {
        const products =req.body;
        console.log('Product data received:', req.body);

        const productExists =await Product.findOne({
            productName:products.productName,

        });
        if(!productExists){
            const images =[];

            if(req.files && req.files.length>0){
                for(let i=0;i<req.files.length;i++){
                    const originalImagePath = req.files[i].path;

                    const resizedFileName = 'resized-' + req.files[i].filename;
const resizedImagePath = path.join('public', 'uploads', 'product-images', resizedFileName);
await sharp(originalImagePath)
  .resize({ width: 450, height: 440 })
  .toFile(resizedImagePath);
images.push(resizedFileName);

                }
            }
            const categoryId = await Category.findOne({name:products.category});
            
            if(!categoryId){
                return res.status(400).send('Invalid category name');

            }
            const newProduct = new Product({
                productName: products.productName,
                description: products.description,
                // If you add brand back in, then:
                // brand: products.brand,
                category: categoryId._id, // Use the found category's _id
                regularPrice: products.regularPrice,
                salePrice: products.salePrice,
                createdOn: new Date(), // (Consider fixing the typo: "craetedOn")
                quantity: products.quantity,
                size: products.size,
                // color: products.color, // Uncomment if needed and update your schema accordingly
                productImage: images,
                status: 'Available',
            });
            
            await newProduct.save();
           return res.redirect('/admin/products');

           

           
        }else{
            return res.status(400).json("Product already exits , Please try with another name ")
           }

    } catch (error) {
        console.error('Error saving product',error);
        return res.redirect('/pageError')
        console.log("enter");
        }
}

module.exports ={
    getProductAddPage,
    getProductInfo,
    addProducts
}