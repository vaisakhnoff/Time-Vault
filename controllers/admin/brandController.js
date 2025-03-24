const Brand = require('../../models/brandSchema');
const Product = require('../../models/productSchema');


    
const getBrands = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const perPage = 10; // Adjust this number as needed
        const totalBrands = await Brand.countDocuments();
        const totalPages = Math.ceil(totalBrands / perPage);
        
        const brands = await Brand.find()
            .sort({ createdAt: -1 })
            .skip((page - 1) * perPage)
            .limit(perPage);
            
        res.render('brands', { brands, currentPage: page, totalPages });
    } catch (error) {
        console.error(error);
        res.redirect('/admin/pageError');
    }
};

  
const getAddBrandPage = async (req, res) => {
    try {
        console.log("add brand page")
        res.render('add-brand');
    } catch (error) {
        console.error(error);
        res.redirect('/admin/pageError');
    }
};

   
const addBrand = async (req, res) => {
    try {
        const { brandName } = req.body;
        const brandImage = req.file ? req.file.filename : null;

        const newBrand = new Brand({
            brandName,
            brandImage: [brandImage]
        });

        await newBrand.save();
        res.redirect('/admin/brands');
    } catch (error) {
        console.error(error);
        res.redirect('/admin/pageError');
    }
};

const getEditBrandPage = async (req, res) => {
    try {
        const brand = await Brand.findById(req.params.id);
        if (!brand) {
            return res.redirect('/admin/brands');
        }
        res.render('edit-brand', { brand });
    } catch (error) {
        console.error(error);
        res.redirect('/admin/pageError');
    }
};

    
const editBrand = async (req, res) => {
    try {
        const { brandName } = req.body;
        const updateData = { brandName };

        if (req.file) {
            updateData.brandImage = [req.file.filename];
        }

        await Brand.findByIdAndUpdate(req.params.id, updateData);
        res.redirect('/admin/brands');
    } catch (error) {
        console.error(error);
        res.redirect('/admin/pageError');
    }
};

   
const deleteBrand = async (req, res) => {
    try {
        await Brand.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.json({ success: false });
    }
};


const toggleBrandStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { isBlocked } = req.body;
        
        await Brand.findByIdAndUpdate(id, { isBlocked });
        
        res.json({
            success: true,
            message: `Brand ${isBlocked ? 'unlisted' : 'listed'} successfully`
        });
    } catch (error) {
        console.error(error);
        res.json({
            success: false,
            message: 'Failed to update brand status'
        });
    }
};

const addBrandOffer = async (req, res) => {
    try {
        const { brandId, offerPercentage } = req.body;
        if (!brandId || !offerPercentage || offerPercentage <= 0 || offerPercentage > 99) {
            return res.json({ success: false, message: 'Missing or invalid offer percentage' });
        }
        
        const brand = await Brand.findById(brandId);
        if (!brand) {
            return res.json({ success: false, message: 'Brand not found' });
        }
        
        // Update brand offer
        brand.brandOffer = parseInt(offerPercentage);
        await brand.save();
        
        // Update salePrice for all products associated with this brand
        const affectedProducts = await Product.find({ brand: brandId })
            .populate('category')
            .populate('brand');
        
        for (const product of affectedProducts) {
            // Calculate discount factors
            const productOfferDiscount = product.productOffer ? (1 - product.productOffer / 100) : 1;
            const categoryOfferDiscount = product.category?.categoryOffer ? (1 - product.category.categoryOffer / 100) : 1;
            // Use the new brand offer from the brand document
            const brandOfferDiscount = brand.brandOffer ? (1 - brand.brandOffer / 100) : 1;
            
            // Choose the best discount (lowest factor)
            const finalDiscountFactor = Math.min(productOfferDiscount, categoryOfferDiscount, brandOfferDiscount);
            
            // Update salePrice (always calculate from regularPrice)
            product.salePrice = product.regularPrice * finalDiscountFactor;
            await product.save();
        }
        
        res.json({
            success: true,
            message: 'Brand offer applied successfully and product prices updated',
            newOffer: brand.brandOffer
        });
    } catch (error) {
        console.error('Error adding brand offer:', error);
        res.json({ success: false, message: 'Failed to add brand offer' });
    }
};

const removeBrandOffer = async (req, res) => {
    try {
        const { brandId } = req.body;
        if (!brandId) {
            return res.json({ success: false, message: 'Brand ID is required' });
        }
        
        const brand = await Brand.findById(brandId);
        if (!brand) {
            return res.json({ success: false, message: 'Brand not found' });
        }
        
        // Remove the brand offer
        brand.brandOffer = 0;
        await brand.save();
        
        // Update salePrice for all products associated with this brand
        const affectedProducts = await Product.find({ brand: brandId })
            .populate('category')
            .populate('brand');
        
        for (const product of affectedProducts) {
            const productOfferDiscount = product.productOffer ? (1 - product.productOffer / 100) : 1;
            const categoryOfferDiscount = product.category?.categoryOffer ? (1 - product.category.categoryOffer / 100) : 1;
            // Now brandOfferDiscount is 1 since no offer
            const brandOfferDiscount = 1;
            
            const finalDiscountFactor = Math.min(productOfferDiscount, categoryOfferDiscount, brandOfferDiscount);
            product.salePrice = product.regularPrice * finalDiscountFactor;
            await product.save();
        }
        
        res.json({
            success: true,
            message: 'Brand offer removed and product prices updated'
        });
        
    } catch (error) {
        console.error('Error removing brand offer:', error);
        res.json({ success: false, message: 'Failed to remove brand offer' });
    }
};


module.exports = {
    getBrands,
    getAddBrandPage,
    addBrand,
    getEditBrandPage,
    editBrand,
    deleteBrand,
    toggleBrandStatus,
    addBrandOffer,
    removeBrandOffer
};