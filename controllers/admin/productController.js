const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const fs = require('fs');
const path = require('path');
const User = require('../../models/userschema');
const sharp =require('sharp');
const { getRandomValues } = require('crypto');




const getProductInfo = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 0;
        const perPage = 8; // items per page
        const searchQuery = req.query.search || '';

        // Create search filter
        let query = {};
        if (searchQuery) {
            query.productName = { $regex: searchQuery, $options: 'i' };
        }

        // Get total count for pagination
        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / perPage);

        // Get products with pagination and search
        const products = await Product.find(query)
            .populate('category')
            .sort({ createdAt: -1 })
            .skip(page * perPage)
            .limit(perPage)
            .lean();

        res.render('products', {
            products,
            currentPage: page,
            totalPages: totalPages,
            searchQuery: searchQuery,
            perPage: perPage,
            total: totalProducts
        });
    } catch (error) {
        console.error("Error fetching products:", error);
        res.redirect('/pageError');
    }
};
  

const getProductAddPage = async(req,res)=>{
    try {
        const category =  await Category.find({isListed:true});
        console.log("enter get addproduct");
        
        res.render('product-add',{
            cat:category,
            
        })
    } catch (error) {   
      
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
                
               
                category: categoryId._id, // 
                regularPrice: products.regularPrice,
                salePrice: products.salePrice,
                createdOn: new Date(),
                quantity: products.quantity,
                size: products.size,
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

const blockProduct = async (req, res) => {
    try {
      const { id } = req.body;
      const product = await Product.findByIdAndUpdate(
        id, 
        { isBlocked: true }, 
        { new: true }
      );
      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }
      res.json({ success: true, product });
    } catch (error) {
      console.error("Error blocking product:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  };
  
  const unblockProduct = async (req, res) => {
    try {
      const { id } = req.body;
      const product = await Product.findByIdAndUpdate(
        id, 
        { isBlocked: false }, 
        { new: true }
      );
      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }
      res.json({ success: true, product });
    } catch (error) {
      console.error("Error unblocking product:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  const getEditProduct = async (req, res) => {
    try {
      const productId = req.params.id;
      const product = await Product.findById(productId).populate('category');
      if (!product) {
        return res.redirect('/admin/products');
      }
      const categories = await Category.find({ isListed: true });
      res.render('edit-product', { product, categories });
    } catch (error) {
      console.error("Error fetching product:", error);
      res.redirect('/pageError');
    }
  };
  

  const editProduct = async (req, res) => {
    try {
      
      const productId = req.params.id;
      const updatedData = req.body; 
      console.log('Edit product data received:', updatedData);
  
      // Find the existing product first
      const existingProduct = await Product.findById(productId);
      if (!existingProduct) {
        return res.status(404).json({ success: false, message: "Product not found" });
      }
  
   
      if (
        updatedData.productName &&
        updatedData.productName !== existingProduct.productName
      ) {
        const duplicate = await Product.findOne({ productName: updatedData.productName });
        if (duplicate) {
          return res.status(400).json({
            success: false,
            message: "Product already exists, please try with another name"
          });
        }
      }
  
let images = existingProduct.productImage;

if (req.files && req.files.length > 0) {

  for (let i = 0; i < req.files.length; i++) {
    const file = req.files[i];
    const originalImagePath = file.path;
    const resizedFileName = 'resized-' + file.filename;
    const resizedImagePath = path.join('public', 'uploads', 'product-images', resizedFileName);
    
    await sharp(originalImagePath)
      .resize({ width: 450, height: 440 })
      .toFile(resizedImagePath);

   
    if (images[i]) {
      images[i] = resizedFileName;
    } else {
      images.push(resizedFileName);
    }
  }
}
  
      updatedData.productImage = images;
  
      const categoryDoc = await Category.findOne({ name: updatedData.category });
      
      if (!categoryDoc) {
        return res.status(400).json({ success: false, message: 'Invalid category name' });
      }
      updatedData.category = categoryDoc._id;
  
      updatedData.updatedOn = new Date();
  
      const updatedProduct = await Product.findByIdAndUpdate(productId, updatedData, { new: true });
  
      
      return res.json({ success: true, product: updatedProduct });
    } catch (error) {
      console.error('Error updating product:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  };
  
  


module.exports ={
    getProductAddPage,
    getProductInfo,
    addProducts,
    blockProduct,
    unblockProduct,
    getEditProduct,
    editProduct
}