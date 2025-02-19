const  Category = require('../../models/categorySchema');

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


module.exports ={
    categoryInfo,
   addCategory,     
}