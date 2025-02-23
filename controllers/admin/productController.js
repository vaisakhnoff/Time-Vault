const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const fs = require('fs');
const path = require('path');
const User = require('../../models/userschema');
const sharp =require('sharp');
const { getRandomValues } = require('crypto');




const getProductInfo = async (req, res) => {
    try {
      // Build an empty query object
      let query = {};
  
      // If a search term is provided, update the query to filter products
      if (req.query.search) {
        // Example: Search by productName using a case-insensitive regex
        query.productName = { $regex: req.query.search, $options: 'i' };
        // If you also want to search in the brand field, you could use $or:
        // query = {
        //   $or: [
        //     { productName: { $regex: req.query.search, $options: 'i' } },
        //     { brand: { $regex: req.query.search, $options: 'i' } }
        //   ]
        // };
      }
  
      // Fetch products matching the query, with category populated
      const products = await Product.find(query).populate('category');
  
      // Render the products page with the fetched products
      res.render('products', { products });
    } catch (error) {
      console.error("Error fetching products:", error);
      res.redirect('/pageError');
    }
  };
  

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
      // Assume productId comes as a route parameter
      const productId = req.params.id;
      const updatedData = req.body; // Updated fields from the form
      console.log('Edit product data received:', updatedData);
  
      // Find the existing product first
      const existingProduct = await Product.findById(productId);
      if (!existingProduct) {
        return res.status(404).json({ success: false, message: "Product not found" });
      }
  
      // Optional: Check if the product name is being changed and if it conflicts with another product
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
  
      // Process new images if provided, else keep existing images.
      // (This example replaces existing images if new ones are uploaded.)
      // Process images: keep existing unless new ones are uploaded
let images = existingProduct.productImage;

if (req.files && req.files.length > 0) {
  // Replace only the images corresponding to the uploaded files' positions
  for (let i = 0; i < req.files.length; i++) {
    const file = req.files[i];
    const originalImagePath = file.path;
    const resizedFileName = 'resized-' + file.filename;
    const resizedImagePath = path.join('public', 'uploads', 'product-images', resizedFileName);
    
    await sharp(originalImagePath)
      .resize({ width: 450, height: 440 })
      .toFile(resizedImagePath);

    // Replace the image at the same index as the input
    if (images[i]) {
      images[i] = resizedFileName;
    } else {
      images.push(resizedFileName);
    }
  }
}
      // Attach the final images array to the update data
      updatedData.productImage = images;
  
      // Process category: find the category document by name
      const categoryDoc = await Category.findOne({ name: updatedData.category });
      
      if (!categoryDoc) {
        return res.status(400).json({ success: false, message: 'Invalid category name' });
      }
      updatedData.category = categoryDoc._id;
  
      // Optionally, set an updatedOn timestamp
      updatedData.updatedOn = new Date();
  
      // Update the product document in the database
      const updatedProduct = await Product.findByIdAndUpdate(productId, updatedData, { new: true });
  
      // Redirect or send a success response
      //  return res.redirect('/admin/products');
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