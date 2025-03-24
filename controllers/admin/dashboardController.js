const Order = require('../../models/orderSchema');
const User = require('../../models/userschema');
const Product = require('../../models/productSchema');
const Coupon = require('../../models/couponSchema');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const Category = require('../../models/categorySchema');


function getDateRange(filter) {
    const endDate = new Date();
    let startDate = new Date();
    
    switch (filter) {
        case 'daily':
            // Set start date to beginning of today
            startDate.setHours(0, 0, 0, 0);
            // Set end date to end of today
            endDate.setHours(23, 59, 59, 999);
            break;
        case 'monthly':
            startDate.setMonth(startDate.getMonth() - 1);
            break;
        case 'yearly':
            startDate.setFullYear(startDate.getFullYear() - 1);
            break;
        case 'weekly':
        default:
            startDate.setDate(startDate.getDate() - 7);
    }
    return { startDate, endDate };
}


const getDashboardData = async (req, res) => {
    try {
        const filter = req.query.filter || 'weekly';
        const { startDate, endDate } = getDateRange(filter);

        // Aggregate orders and revenue
        const stats = await Order.aggregate([
            { 
                $match: { 
                    createdAt: { $gte: startDate, $lte: endDate },
                    orderStatus: { $nin: ['Cancelled', 'Returned'] }
                }
            },
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    totalRevenue: { $sum: "$totalAmount" }
                }
            }
        ]);

        // Get counts
        const [totalUsers, totalProducts, categories] = await Promise.all([
            User.countDocuments(),
            Product.countDocuments(),
            Category.find({ isListed: true })
        ]);

        // Modify the time series aggregation for daily view
        const timeSeriesData = await Order.aggregate([
            { 
                $match: { 
                    createdAt: { $gte: startDate, $lte: endDate },
                    orderStatus: { $nin: ['Cancelled', 'Returned'] }
                }
            },
            {
                $group: {
                    _id: filter === 'daily' 
                        ? { 
                            $dateToString: { 
                                format: "%Y-%m-%d %H:00:00", 
                                date: "$createdAt" 
                            }
                        }
                        : { 
                            $dateToString: { 
                                format: "%Y-%m-%d", 
                                date: "$createdAt" 
                            }
                        },
                    revenue: { $sum: "$totalAmount" },
                    orders: { $sum: 1 }
                }
            },
            { $sort: { "_id": 1 } }
        ]);

        // Category performance
        const categoryPerformance = await Order.aggregate([
            { 
                $match: { 
                    createdAt: { $gte: startDate, $lte: endDate },
                    orderStatus: { $nin: ['Cancelled', 'Returned'] }
                }
            },
            { $unwind: "$items" },
            {
                $lookup: {
                    from: "products",
                    localField: "items.productId",
                    foreignField: "_id",
                    as: "product"
                }
            },
            { $unwind: "$product" },
            {
                $lookup: {
                    from: "categories",
                    localField: "product.category",
                    foreignField: "_id",
                    as: "category"
                }
            },
            { $unwind: "$category" },
            {
                $group: {
                    _id: "$category._id",
                    category: { $first: "$category.name" },
                    totalSales: { 
                        $sum: { 
                            $multiply: ["$items.price", "$items.quantity"] 
                        }
                    }
                }
            },
            {
                $project: {
                    category: 1,
                    totalSales: 1,
                    _id: 0
                }
            }
        ]);

        // Product performance by brand (since your schema doesn't have brand, we'll group by product)
        const brandPerformance = await Order.aggregate([
            { 
                $match: { 
                    createdAt: { $gte: startDate, $lte: endDate },
                    orderStatus: { $nin: ['Cancelled', 'Returned'] }
                }
            },
            { $unwind: "$items" },
            {
                $lookup: {
                    from: "products",
                    localField: "items.productId",
                    foreignField: "_id",
                    as: "product"
                }
            },
            { $unwind: "$product" },
            {
                $group: {
                    _id: "$product._id",
                    productName: { $first: "$product.productName" },
                    totalSales: { 
                        $sum: { 
                            $multiply: ["$items.price", "$items.quantity"] 
                        }
                    }
                }
            },
            { $sort: { totalSales: -1 } },
            { $limit: 5 },
            {
                $project: {
                    brand: "$productName", // Using product name instead of brand
                    totalSales: 1,
                    _id: 0
                }
            }
        ]);

        res.json({
            revenue: stats[0]?.totalRevenue || 0,
            totalOrders: stats[0]?.totalOrders || 0,
            totalUsers,
            totalProducts,
            totalCategories: categories.length,
            timeSeriesData: {
                labels: timeSeriesData.map(item => item._id),
                revenueData: timeSeriesData.map(item => item.revenue),
                orderData: timeSeriesData.map(item => item.orders)
            },
            categoryPerformance,
            brandPerformance
        });

    } catch (error) {
        console.error('Error in getDashboardData:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Best Selling Data endpoint
const getBestSellingData = async (req, res) => {
    try {
        const filter = req.query.filter || 'weekly';
        const { startDate, endDate } = getDateRange(filter);

        // Best selling products with category information
        const bestSellingProducts = await Order.aggregate([
            { 
                $match: { 
                    createdAt: { $gte: startDate, $lte: endDate },
                    orderStatus: { $nin: ['Cancelled', 'Returned'] }
                }
            },
            { $unwind: "$items" },
            {
                $lookup: {
                    from: "products",
                    localField: "items.productId",
                    foreignField: "_id",
                    as: "product"
                }
            },
            { $unwind: "$product" },
            {
                $lookup: {
                    from: "categories",
                    localField: "product.category",
                    foreignField: "_id",
                    as: "category"
                }
            },
            { $unwind: "$category" },
            {
                $group: {
                    _id: "$items.productId",
                    productName: { $first: "$product.productName" },
                    category: { $first: "$category.name" },
                    totalSales: { $sum: "$items.quantity" },
                    revenue: { 
                        $sum: { 
                            $multiply: ["$items.price", "$items.quantity"] 
                        }
                    }
                }
            },
            { $sort: { totalSales: -1 } },
            { $limit: 5 }
        ]);

        // Best selling categories
        const bestSellingCategories = await Order.aggregate([
            { 
                $match: { 
                    createdAt: { $gte: startDate, $lte: endDate },
                    orderStatus: { $nin: ['Cancelled', 'Returned'] }
                }
            },
            { $unwind: "$items" },
            {
                $lookup: {
                    from: "products",
                    localField: "items.productId",
                    foreignField: "_id",
                    as: "product"
                }
            },
            { $unwind: "$product" },
            {
                $lookup: {
                    from: "categories",
                    localField: "product.category",
                    foreignField: "_id",
                    as: "category"
                }
            },
            { $unwind: "$category" },
            {
                $group: {
                    _id: "$category._id",
                    category: { $first: "$category.name" },
                    totalSales: { $sum: "$items.quantity" },
                    revenue: { 
                        $sum: { 
                            $multiply: ["$items.price", "$items.quantity"] 
                        }
                    }
                }
            },
            { $sort: { totalSales: -1 } },
            { $limit: 5 }
        ]);

        res.json({
            bestSellingProducts,
            bestSellingCategories,
            bestSellingBrands: bestSellingProducts.map(product => ({
                brand: product.productName,
                totalSales: product.totalSales
            }))
        });

    } catch (error) {
        console.error('Error in getBestSellingData:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getDashboardStats = async (req, res) => {
    try {
        // Get overall stats
        const totalOrders = await Order.countDocuments();
        const totalSales = await Order.aggregate([
            {
                $unwind: "$items"  
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$totalAmount" },
                    originalTotal: {
                        $sum: {
                            $multiply: [
                                { $toDouble: "$items.price" }, 
                                { $toDouble: "$items.quantity" }
                            ]
                        }
                    }
                }
            },
            {
                $project: {
                    total: 1,
                    discountTotal: { $subtract: ["$originalTotal", "$total"] }
                }
            }
        ]);

     
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayStats = await Order.aggregate([
            { $match: { createdAt: { $gte: today } } },
            {
                $unwind: "$items"
            },
            {
                $group: {
                    _id: null,
                    orders: { $sum: 1 },
                    revenue: { $sum: "$totalAmount" },
                    originalTotal: {
                        $sum: {
                            $multiply: [
                                { $toDouble: "$items.price" },
                                { $toDouble: "$items.quantity" }
                            ]
                        }
                    }
                }
            },
            {
                $project: {
                    orders: 1,
                    revenue: 1,
                    discount: { $subtract: ["$originalTotal", "$revenue"] }
                }
            }
        ]);

        res.render('dashboard', {
            stats: {
                total: {
                    orders: totalOrders,
                    sales: totalSales[0]?.total || 0,
                    discount: totalSales[0]?.discountTotal || 0
                },
                today: {
                    orders: todayStats[0]?.orders || 0,
                    sales: todayStats[0]?.revenue || 0,
                    discount: todayStats[0]?.discount || 0
                }
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const generateSalesReport = async (req, res) => {
    try {
        const { startDate, endDate, reportType } = req.query;
        let dateFilter = {};
        if (reportType) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            switch (reportType) {
                case 'daily':
                    dateFilter = { createdAt: { $gte: today } };
                    break;
                case 'weekly':
                    const weekAgo = new Date(today);
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    dateFilter = { createdAt: { $gte: weekAgo } };
                    break;
                case 'monthly':
                    const monthAgo = new Date(today);
                    monthAgo.setMonth(monthAgo.getMonth() - 1);
                    dateFilter = { createdAt: { $gte: monthAgo } };
                    break;
                case 'yearly':
                    const yearAgo = new Date(today);
                    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
                    dateFilter = { $gte: yearAgo };
                    break;
                default:
                    break;
            }
        } else if (startDate && endDate) {
            dateFilter = {
                createdAt: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            };
        }

        const salesReport = await Order.aggregate([
           
            {
                $match: {
                    ...dateFilter,
                    orderStatus: { $nin: ['Cancelled', 'Return Requested', 'Returned'] }
                }
            },
            
            {
                $addFields: {
                    originalTotal: {
                        $reduce: {
                            input: "$items",
                            initialValue: 0,
                            in: { $add: ["$$value", { $multiply: ["$$this.price", "$$this.quantity"] }] }
                        }
                    }
                }
            },
          
            {
                $lookup: {
                    from: "users",
                    localField: "user",
                    foreignField: "_id",
                    as: "userDetails"
                }
            },
            { $unwind: "$userDetails" },
            
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }
                    },
                    orderCount: { $sum: 1 },
                    totalAmount: { $sum: "$totalAmount" },
                    discount: { $sum: { $subtract: ["$originalTotal", "$totalAmount"] } },
                    orders: {
                        $push: {
                            orderId: "$_id",
                            userName: { $concat: ["$userDetails.firstName", " ", "$userDetails.lastName"] },
                            amount: "$totalAmount",
                            paymentMethod: "$paymentMethod",
                            status: "$orderStatus",
                            date: "$createdAt"
                        }
                    }
                }
            },
            { $sort: { "_id.date": -1 } }
        ]);

        // Modify the category performance aggregation
        const categoryPerformance = await Order.aggregate([
            { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
            { $unwind: "$items" },
            {
                $lookup: {
                    from: "categories", // Add lookup to get category name
                    localField: "items.category",
                    foreignField: "_id",
                    as: "categoryDetails"
                }
            },
            { $unwind: "$categoryDetails" },
            {
                $group: {
                    _id: "$categoryDetails._id",
                    category: { $first: "$categoryDetails.name" }, // Get category name
                    totalSales: { $sum: { $multiply: ["$items.price", "$items.quantity"] } }
                }
            },
            { $project: { 
                category: 1,
                totalSales: 1,
                _id: 0 
            }}
        ]);

        // Modify time series aggregation to include proper date formatting
        const timeSeriesAgg = await Order.aggregate([
            { $match: { 
                createdAt: { $gte: startDate, $lte: endDate },
                orderStatus: { $nin: ['Cancelled', 'Returned'] } 
            }},
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    revenue: { $sum: "$totalAmount" },
                    orders: { $sum: 1 }
                }
            },
            { $sort: { "_id": 1 } }
        ]);
        
        const totals = salesReport.reduce(
            (acc, day) => ({
                orderCount: acc.orderCount + day.orderCount,
                totalAmount: acc.totalAmount + day.totalAmount,
                discount: acc.discount + day.discount
            }),
            { orderCount: 0, totalAmount: 0, discount: 0 }
        );

        res.json({
            success: true,
            salesReport,
            totals
        });
    } catch (error) {
        console.error('Error generating sales report:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

const downloadSalesReport = async (req, res) => {
    try {
        const { reportType, format } = req.query;
        
        
        let dateFilter = {};
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        switch (reportType) {
            case 'daily':
                dateFilter = { createdAt: { $gte: today } };
                break;
            case 'weekly':
                const weekAgo = new Date(today);
                weekAgo.setDate(weekAgo.getDate() - 7);
                dateFilter = { createdAt: { $gte: weekAgo } };
                break;
            case 'monthly':
                const monthAgo = new Date(today);
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                dateFilter = { createdAt: { $gte: monthAgo } };
                break;
            case 'yearly':
                const yearAgo = new Date(today);
                yearAgo.setFullYear(yearAgo.getFullYear() - 1);
                dateFilter = { createdAt: { $gte: yearAgo } };
                break;
            default:
                throw new Error('Invalid report type');
        }

        const salesReport = await Order.aggregate([
        
            {
                $match: {
                    ...dateFilter,
                    orderStatus: { $nin: ['Cancelled', 'Return Requested', 'Returned'] }
                }
            },
          
            {
                $addFields: {
                    originalTotal: {
                        $reduce: {
                            input: "$items",
                            initialValue: 0,
                            in: { $add: ["$$value", { $multiply: ["$$this.price", "$$this.quantity"] }] }
                        }
                    }
                }
            },
    
            {
                $lookup: {
                    from: "users",
                    localField: "user",
                    foreignField: "_id",
                    as: "userDetails"
                }
            },
            { $unwind: "$userDetails" },
           
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }
                    },
                    orderCount: { $sum: 1 },
                    totalAmount: { $sum: "$totalAmount" },
                    discount: { $sum: { $subtract: ["$originalTotal", "$totalAmount"] } },
                    orders: {
                        $push: {
                            orderId: "$_id",
                            userName: { $concat: ["$userDetails.firstName", " ", "$userDetails.lastName"] },
                            amount: "$totalAmount",
                            paymentMethod: "$paymentMethod",
                            status: "$orderStatus",
                            date: "$createdAt"
                        }
                    }
                }
            },
            { $sort: { "_id.date": -1 } }
        ]);

        if (format === 'excel') {
            // Generate Excel file
            const workbook = XLSX.utils.book_new();
            
            // Convert data to worksheet format
            const worksheetData = salesReport.map(day => ({
                Date: day._id.date,
                'Order Count': day.orderCount,
                'Total Amount': day.totalAmount,
                'Discount': day.discount
            }));

            const worksheet = XLSX.utils.json_to_sheet(worksheetData);
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Sales Report');

            // Create buffer
            const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=sales-report-${reportType}.xlsx`);
            return res.send(buffer);

        } else if (format === 'pdf') {
            // Generate PDF file
            const doc = new PDFDocument();
            const buffers = [];

            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfBuffer = Buffer.concat(buffers);
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=sales-report-${reportType}.pdf`);
                res.send(pdfBuffer);
            });

            
            doc.fontSize(20).text('Sales Report', { align: 'center' });
            doc.moveDown();

           
            doc.fontSize(12).text('Date', 50, 150);
            doc.text('Orders', 200, 150);
            doc.text('Total Amount', 300, 150);
            doc.text('Discount', 400, 150);

          
            let yPosition = 170;
            salesReport.forEach(day => {
                doc.text(day._id.date, 50, yPosition);
                doc.text(day.orderCount.toString(), 200, yPosition);
                doc.text(`₹${day.totalAmount.toFixed(2)}`, 300, yPosition);
                doc.text(`₹${day.discount.toFixed(2)}`, 400, yPosition);
                yPosition += 20;
            });

            doc.end();
        } else {
            throw new Error('Invalid format specified');
        }
    } catch (error) {
        console.error('Error downloading sales report:', error);
        res.status(500).json({ error: 'Failed to download report' });
    }
};

module.exports = {
    getDashboardStats,
    getDashboardData,    // Add new function
    getBestSellingData,  // Add new function
    generateSalesReport,
    downloadSalesReport
};