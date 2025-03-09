const { get } = require('mongoose');
const  Category = require('../../models/categorySchema');
const Product = require("../../models/productSchema");
const category = require('../../models/categorySchema');
const { ReturnDocument } = require('mongodb');

const categoryInfo = async(req,res)=>{
    try {
        const page = parseInt(req.query.page) || 0;
        const perPage = 4; // items per page
        const searchQuery = req.query.search || '';

        // Create search filter
        const filter = searchQuery ? {
            name: { $regex: searchQuery, $options: 'i' }
        } : {};

        // Get total count for pagination
        const totalCategories = await Category.countDocuments(filter);
        const totalPages = Math.ceil(totalCategories / perPage);

        // Get categories with pagination and search
        const categories = await Category.find(filter)
            .sort({ createdAt: -1 })
            .skip(page * perPage)
            .limit(perPage)
            .lean();

        res.render("category", {
            cat: categories,
            currentPage: page,
            totalPages: totalPages,
            searchQuery: searchQuery,
            perPage: perPage,
            total: totalCategories
        });
    } catch (error) {
        console.error('Error in categoryInfo:', error);
        res.redirect('/pageError');
    }
}

const addCategory = async(req,res)=>{
    try {
        const { name, description } = req.body;
        
     
        if (!name || !description) {
            return res.status(400).json({error: "Name and description are required"});
        }

       
        const normalizedName = name.trim().toLowerCase();
        
        const existingCategory = await Category.findOne({
            name: { $regex: new RegExp(`^${normalizedName}$`, 'i') }
        });
        
        if(existingCategory){
            return res.status(400).json({error: "Category already exists"});
        }

        const newCategory = new Category({
            name: name.trim(),
            description: description.trim()
        });
        
        await newCategory.save();
        return res.status(200).json({message: "Category added successfully"});
    } catch (error) {
        console.error("Add category error:", error);
        return res.status(500).json({error: error.message || "Internal server error"});
    }
}
   

const addCategoryOffer = async (req, res) => {
  try {
    const percentage = parseInt(req.body.percentage);
    const categoryId = req.body.categoryId;

    if (!percentage || percentage <= 0 || percentage > 99) {
      return res.json({
        status: false,
        message: "Please enter a valid offer percentage between 1 and 99"
      });
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        status: false,
        message: "Category not found"
      });
    }

    const products = await Product.find({ category: categoryId });
    const productsWithOffers = products.filter(product => product.productOffer > 0);
    if (productsWithOffers.length > 0) {
      const names = productsWithOffers.map(p => p.productName).join(', ');
      return res.json({
        status: false,
        message: `Cannot add category offer as products have individual offers: ${names}`
      });
    }

    // Update category offer
    category.categoryOffer = percentage;
    await category.save();

    // Update each product's sale price
    for (const product of products) {
      product.salePrice = product.salePrice * (1 - percentage / 100);
      await product.save();
    }

    return res.json({
      status: true,
      message: "Category offer added successfully"
    });
  } catch (error) {
    console.error('Error adding category offer:', error);
    return res.status(500).json({
      status: false,
      message: "Internal server error"
    });
  }
};

const removeCategoryoffer = async (req, res) => {
  try {
    const { categoryId } = req.body;
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ status: false, message:"Category not found" });
    }

    // Get category offer percentage before resetting
    const categoryOffer = category.categoryOffer;
    category.categoryOffer = 0;
    await category.save();

    // Update products in this category
    const products = await Product.find({ category: categoryId });
    for (const product of products) {
      // Reverse the category offer calculation
      product.salePrice = product.salePrice / (1 - categoryOffer / 100);
      await product.save();
    }
    
    return res.json({
      status: true,
      message: "Category offer removed successfully"
    });
  } catch (error) {
    console.error('Error removing category offer:', error);
    return res.status(500).json({ status: false, message:"Internal server error" });
  }
};


const getListCategory = async (req, res) => { 
    try {
        let id = req.query.id;
        await Category.updateOne({ _id: id }, { $set: { isListed: false } });
        res.json({ status: true, message: "Category unlisted successfully" });
    } catch (error) {    
        console.error(error);
        res.status(500).json({ status: false, message: "Internal server error" });
    }
};

const getUnlistCategory = async (req, res) => {
    try {
        let id = req.query.id;
        await Category.updateOne({ _id: id }, { $set: { isListed: true } });
        res.json({ status: true, message: "Category listed successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: false, message: "Internal server error" });
    }
};

const getEditCategory = async(req,res)=>{
    try {
        const id = req.query.id;
        const category = await Category.findOne({_id:id});
        res.render('edit-category',{category:category})
    } catch (error) {
        res.redirect('/pageError')
    }
}

const editCategory = async (req, res) => {
    try {
        const id = req.params.id; 
        const { categoryName, description } = req.body;
        const currentCategory = await Category.findById(id);
        if (!currentCategory) {
            return res.status(400).json({ error: "Category not found" });
        }
        if (currentCategory.name === categoryName && currentCategory.description === description) {
            return res.status(200).json({ message: "No changes made" });
        }
        const existingCategory = await Category.findOne({ name: categoryName, _id: { $ne: id } });
        if (existingCategory) {
            return res.status(400).json({ error: "Category exists, please choose another name" });
        }
        const updatedCategory = await Category.findByIdAndUpdate(
            id,
            { name: categoryName, description: description },
            { new: true }
        );
        if (updatedCategory) {
            return res.status(200).json({ message: "Category updated successfully" });
        } else {
            return res.status(400).json({ error: "Category not found" });
        }
    } catch (error) {
        console.error("Edit category error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

module.exports ={
    categoryInfo,
    addCategory,
    addCategoryOffer,
    removeCategoryoffer,
    getListCategory,
    getUnlistCategory,
    getEditCategory,
    editCategory
}
