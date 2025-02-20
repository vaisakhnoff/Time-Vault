const  Category = require('../../models/categorySchema');
const Product = require("../../models/productSchema")

const categoryInfo = async(req,res)=>{
    try {
        const  page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page-1)*limit;


        const categoryData = await Category.find({})
            .sort({createdAt:-1})
            .skip(skip)
            .limit(limit)

            const totalCategories = Category.countDocuments();
            const totalPages = Math.ceil(totalCategories/limit);
            res.render("category",{
                cat:categoryData,
                currentPage:page,
                totalPages:totalPages,
                totalCategories:totalCategories
            });

    
    } catch (error) {
        console.error(error);
        res.redirect('/pageError')
    }
}

const addCategory = async(req,res)=>{
    try {
        const { name, description } = req.body;
        
        // Validate input
        if (!name || !description) {
            return res.status(400).json({error: "Name and description are required"});
        }

        // Clean and normalize the category name
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

const addCategoryOffer = async(req,res)=>{
    try {
        const percentage = parseInt(req.body.percentage);
        const categoryId = req.body.categoryId;
        const category = await Category.findById(categoryId);
if(!category){
    return res.status(404).json({status:false ,message:"Category not found" })
}
const products = await Product.find({category:category._id});
const hasProductOffer =  products.some((product)=>product.productOffer>percentage);
if(hasProductOffer){
    return res.json({status:false,message:"Products within the category already have product offer "})
}
await Category.updateOne({_id:categoryId},{$set:{categoryOffer:percentage}});
for(const product of products){
    product.ProductOffer =0;
    product.salePrice =product.regularPrice;
    await product.save()
}
res.json({status:true});

    } catch (error) {
        res.status(500).json({status:false,message:"Internal server error"})
    }
};


const  removeCategoryoffer = async(req,res)=>{
    try {
      const categoryId = req.body.categoryId;
      const category = await Category.findById(categoryId);
      if(!category){
        return res.status(404).json({status:false, message:"Category not found"})
      }  
      const percentage = category.categoryOffer;
      const products = await Product.find({category:category._id})

      if(products.length > 0 ){
        for(const product of products){
            product.salesPrice += Math.floor(product.regularPrice +(percentage/100) );
            product.ProductOffer =0;
            await  product.save();
        }

      }
      category.categoryOffer =0;
      await category.save()
      res.json({status:true})
    } catch (error) {
        res.status(500).json({status:false,message:"Internal server error"})
    }
}


module.exports ={
    categoryInfo,
   addCategory,
   addCategoryOffer,
   removeCategoryoffer
    } 
