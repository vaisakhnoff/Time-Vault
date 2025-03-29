const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const fs = require('fs');
const path = require('path');
const User = require('../../models/userschema');
const sharp =require('sharp');
const { getRandomValues } = require('crypto');
const Brand = require('../../models/brandSchema');




const getProductInfo = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 0;
        const perPage = 8; 
        const searchQuery = req.query.search || '';

        
        let query = {};
        if (searchQuery) {
            query.productName = { $regex: searchQuery, $options: 'i' };
        }

      
        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / perPage);

        const products = await Product.find(query)
            .populate('category')
            .populate('brand') 
            .select('productName brand category regularPrice salePrice productOffer quantity isBlocked productImage') 
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
        const category = await Category.find({isListed:true});
        const brands = await Brand.find({isBlocked: false});
        
        res.render('product-add', {
            cat: category,
            brands: brands
        });
    } catch (error) {   
        console.error("Error:", error);
        res.redirect('/pageError')
    }
}

const addProducts = async(req,res)=>{
    try {
        const products = req.body;
        console.log('Product data received:', req.body);

        const productExists = await Product.findOne({
            productName: products.productName,
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
            const brandId = await Brand.findOne({brandName: products.brand}); 
            
            if(!categoryId){
                return res.status(400).send('Invalid category name');
            }

            if(!brandId){ // Add this validation
                return res.status(400).send('Invalid brand name');
            }

            const newProduct = new Product({
                productName: products.productName,
                description: products.description,
                brand: brandId._id, // Add this
                category: categoryId._id,
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
        } else {
            return res.status(400).json("Product already exists, Please try with another name")
        }
    } catch (error) {
        console.error('Error saving product', error);
        return res.redirect('/pageError')
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
        const product = await Product.findById(productId)
            .populate('category')
            .populate('brand');
            
        if (!product) {
            return res.redirect('/admin/products');
        }
        
        const categories = await Category.find({ isListed: true });
        const brands = await Brand.find({ isBlocked: false });
        
        res.render('edit-product', { 
            product, 
            categories,
            brands 
        });
    } catch (error) {
        console.error("Error fetching product:", error);
        res.redirect('/pageError');
    }
};
  

const editProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        const updatedData = req.body;
        
        
        const existingProduct = await Product.findById(productId);
        if (!existingProduct) {
            return res.status(404).json({ 
                success: false, 
                message: "Product not found" 
            });
        }

      
        if (updatedData.productName && 
            updatedData.productName !== existingProduct.productName) {
            const duplicate = await Product.findOne({ 
                productName: updatedData.productName 
            });
            if (duplicate) {
                return res.status(400).json({
                    success: false,
                    message: "Product already exists, please try with another name"
                });
            }
        }

        
        let images = existingProduct.productImage;
        if (req.files && req.files.length > 0) {
           
        }
        updatedData.productImage = images;

        
        const categoryDoc = await Category.findOne({ name: updatedData.category });
        const brandDoc = await Brand.findOne({ brandName: updatedData.brand });

        if (!categoryDoc) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid category name' 
            });
        }

        if (!brandDoc) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid brand name' 
            });
        }

       
        updatedData.category = categoryDoc._id;
        updatedData.brand = brandDoc._id;
        updatedData.updatedOn = new Date();

        const updatedProduct = await Product.findByIdAndUpdate(
            productId, 
            updatedData, 
            { new: true }
        );

        return res.json({ 
            success: true, 
            product: updatedProduct 
        });
    } catch (error) {
        console.error('Error updating product:', error);
        return res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};
  
const addProductOffer = async (req, res) => {
  try {
    const { productId, percentage } = req.body;
    if (!percentage || percentage <= 0 || percentage > 99) {
      return res.status(400).json({
        success: false,
        message: 'Invalid offer percentage'
      });
    }

    const product = await Product.findById(productId)
      .populate('category')
      .populate('brand');
      
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Store baseline sale price from the current salePrice if not already stored
    if (product.oldSalePrice === undefined) {
      product.oldSalePrice = product.salePrice;
    }

    // Update the product's offer percentage
    product.productOffer = percentage;
    
    // Calculate discount multipliers based on each offer:
    // For product: 1 - (productOffer/100)
    // For category: if available, 1 - (categoryOffer/100), else 1
    // For brand: if available, 1 - (brandOffer/100), else 1
    const productFactor = product.productOffer > 0 ? (1 - product.productOffer / 100) : 1;
    const categoryFactor = (product.category && product.category.categoryOffer > 0)
      ? (1 - product.category.categoryOffer / 100) : 1;
    const brandFactor = (product.brand && product.brand.brandOffer > 0)
      ? (1 - product.brand.brandOffer / 100) : 1;
      
    // Choose the best discount multiplier (lowest number gives the highest discount)
    const finalFactor = Math.min(productFactor, categoryFactor, brandFactor);
    
    // Apply the discount on the stored baseline sale price (oldSalePrice)
    product.salePrice = product.oldSalePrice * finalFactor;

    await product.save();

    return res.json({
      success: true,
      message: 'Offer applied successfully',
      newPrice: product.salePrice,
      productOffer: product.productOffer,
      categoryOffer: product.category?.categoryOffer,
      brandOffer: product.brand?.brandOffer
    });
  } catch (error) {
    console.error('Error adding product offer:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

const removeProductOffer = async (req, res) => {
  try {
    const { productId } = req.body;
    
    const product = await Product.findById(productId)
      .populate('category')
      .populate('brand');
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // Remove the product offer
    product.productOffer = 0;

    // Calculate discount multipliers from category and brand only:
    const categoryFactor = (product.category && product.category.categoryOffer > 0)
      ? (1 - product.category.categoryOffer / 100) : 1;
    const brandFactor = (product.brand && product.brand.brandOffer > 0)
      ? (1 - product.brand.brandOffer / 100) : 1;
      
    // The best discount multiplier among category and brand offers
    const finalFactor = Math.min(categoryFactor, brandFactor);
    
    // Revert salePrice to the stored baseline with remaining offers applied.
    // If oldSalePrice is not set/valid, fallback to regularPrice.
    const baseline = (typeof product.oldSalePrice !== 'undefined' && !isNaN(product.oldSalePrice))
                      ? product.oldSalePrice 
                      : product.regularPrice;
    product.salePrice = baseline * finalFactor;

    await product.save();
    
    return res.json({
      success: true,
      message: 'Product offer removed successfully',
      newPrice: product.salePrice,
      productOffer: product.productOffer,
      categoryOffer: product.category?.categoryOffer,
      brandOffer: product.brand?.brandOffer
    });
  } catch (error) {
    console.error('Error removing product offer:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getProductAddPage,
  getProductInfo,
  addProducts,
  blockProduct,
  unblockProduct,
  getEditProduct,
  editProduct,
  addProductOffer,
  removeProductOffer
};