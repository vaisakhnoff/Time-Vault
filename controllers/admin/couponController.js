const Coupon = require('../../models/couponSchema');

const couponInfo = async (req, res) => {
    try {
        const coupons = await Coupon.find().sort({ createdOn: -1 });
        console.log('Coupons fetched:', coupons);
        res.render('coupon', { coupons });
    } catch (error) {
        console.error('Error fetching coupons:', error);
        res.redirect('/pageError');
    }
};

const addCoupon = async (req, res) => {
    try {
        const { couponName, couponCode, startDate, endDate, offerPrice, minimumPrice, maxPrice } = req.body;

        // Validate that coupon code and name are different
        if (couponName.toUpperCase() === couponCode) {
            return res.status(400).json({
                success: false,
                message: 'Coupon code must be different from coupon name'
            });
        }

        // Validate dates
        const startDateObj = new Date(startDate);
        const endDateObj = new Date(endDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (startDateObj < today) {
            return res.status(400).json({
                success: false,
                message: 'Start date cannot be in the past'
            });
        }

        // Validate prices
        const offerPriceNum = parseInt(offerPrice);
        const minimumPriceNum = parseInt(minimumPrice);
        const maxPriceNum = parseInt(maxPrice);

        if (offerPriceNum >= minimumPriceNum || minimumPriceNum >= maxPriceNum) {
            return res.status(400).json({
                success: false,
                message: 'Invalid price range: Offer Price < Minimum Price < Maximum Price'
            });
        }

        // Check if coupon name or code exists
        const existingCoupon = await Coupon.findOne({
            $or: [
                { name: couponName },
                { couponCode: couponCode }
            ],
            expireOn: { $gt: new Date() }
        });

        if (existingCoupon) {
            return res.status(400).json({
                success: false,
                message: 'Active coupon with this name or code already exists'
            });
        }

        const newCoupon = new Coupon({
            name: couponName,
            couponCode: couponCode,
            createdOn: new Date(),
            expireOn: endDateObj,
            offerPrice: offerPriceNum,
            minimumPrice: minimumPriceNum,
            maxPrice: maxPriceNum,
            isList: true
        });

        await newCoupon.save();
        
        return res.status(200).json({
            success: true,
            message: 'Coupon added successfully'
        });
    } catch (error) {
        console.error('Error adding coupon:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const getEditCoupon = async (req, res) => {
    try {
        const couponId = req.query.id;
        const findCoupon = await Coupon.findById(couponId);
        
        if (!findCoupon) {
            return res.redirect('/admin/coupon');
        }

        res.render('editCoupon', { findCoupon });
    } catch (error) {
        console.error('Error fetching coupon:', error);
        res.redirect('/pageError');
    }
};

const editCoupon = async (req, res) => {
    try {
        const { 
            couponId, 
            couponName, 
            couponCode, 
            startDate, 
            endDate, 
            offerPrice, 
            minimumPrice, 
            maxPrice 
        } = req.body;

        // Validate that coupon code and name are different
        if (couponName.toUpperCase() === couponCode) {
            return res.status(400).json({
                success: false,
                message: 'Coupon code must be different from coupon name'
            });
        }

        // Validate dates
        const endDateObj = new Date(endDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (endDateObj <= today) {
            return res.status(400).json({
                success: false,
                message: 'End date must be in the future'
            });
        }

        // Validate prices
        const offerPriceNum = parseInt(offerPrice);
        const minimumPriceNum = parseInt(minimumPrice);
        const maxPriceNum = parseInt(maxPrice);

        if (offerPriceNum >= minimumPriceNum || minimumPriceNum >= maxPriceNum) {
            return res.status(400).json({
                success: false,
                message: 'Invalid price range: Offer Price < Minimum Price < Maximum Price'
            });
        }

        // Check if name or code exists (excluding current coupon)
        const existingCoupon = await Coupon.findOne({
            $or: [
                { name: couponName },
                { couponCode: couponCode }
            ],
            _id: { $ne: couponId },
            expireOn: { $gt: new Date() }
        });

        if (existingCoupon) {
            return res.status(400).json({
                success: false,
                message: 'Another active coupon with this name or code exists'
            });
        }

        const updatedCoupon = await Coupon.findByIdAndUpdate(
            couponId,
            {
                name: couponName,
                couponCode: couponCode,
                expireOn: endDateObj,
                offerPrice: offerPriceNum,
                minimumPrice: minimumPriceNum,
                maxPrice: maxPriceNum
            },
            { new: true }
        );

        if (!updatedCoupon) {
            return res.status(404).json({
                success: false,
                message: 'Coupon not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Coupon updated successfully'
        });
    } catch (error) {
        console.error('Error updating coupon:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const deleteCoupon = async (req, res) => {
    try {
        const couponId = req.query.id;
        const deletedCoupon = await Coupon.findByIdAndDelete(couponId);
        
        if (!deletedCoupon) {
            return res.status(404).json({
                success: false,
                message: 'Coupon not found'
            });
        }

        return res.redirect('/admin/coupon');
    } catch (error) {
        console.error('Error deleting coupon:', error);
        return res.redirect('/pageError');
    }
};

module.exports = {
    couponInfo,
    addCoupon,
    getEditCoupon,
    editCoupon,
    deleteCoupon
};