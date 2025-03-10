const Order = require('../../models/orderSchema');
const User = require('../../models/userschema');
const Coupon = require('../../models/couponSchema');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const getDashboardStats = async (req, res) => {
    try {
        // Get overall stats
        const totalOrders = await Order.countDocuments();
        const totalSales = await Order.aggregate([
            {
                $unwind: "$items" // First unwind the items array
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$totalAmount" },
                    originalTotal: {
                        $sum: {
                            $multiply: [
                                { $toDouble: "$items.price" }, // Ensure numeric conversion
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

        // Get today's stats
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
                    dateFilter = { createdAt: { $gte: yearAgo } };
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
            // Filter orders based on date and exclude certain statuses.
            {
                $match: {
                    ...dateFilter,
                    orderStatus: { $nin: ['Cancelled', 'Return Requested', 'Returned'] }
                }
            },
            // Compute originalTotal for each order using $reduce on the items array.
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
            // Lookup user details
            {
                $lookup: {
                    from: "users",
                    localField: "user",
                    foreignField: "_id",
                    as: "userDetails"
                }
            },
            { $unwind: "$userDetails" },
            // Group orders by date (formatted as "YYYY-MM-DD")
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

        // Calculate overall totals.
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
        
        // Reuse the same logic from generateSalesReport to get the data
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
            // Filter orders based on date and exclude certain statuses.
            {
                $match: {
                    ...dateFilter,
                    orderStatus: { $nin: ['Cancelled', 'Return Requested', 'Returned'] }
                }
            },
            // Compute originalTotal for each order using $reduce on the items array.
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
            // Lookup user details
            {
                $lookup: {
                    from: "users",
                    localField: "user",
                    foreignField: "_id",
                    as: "userDetails"
                }
            },
            { $unwind: "$userDetails" },
            // Group orders by date (formatted as "YYYY-MM-DD")
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

            // Add content to PDF
            doc.fontSize(20).text('Sales Report', { align: 'center' });
            doc.moveDown();

            // Add table headers
            doc.fontSize(12).text('Date', 50, 150);
            doc.text('Orders', 200, 150);
            doc.text('Total Amount', 300, 150);
            doc.text('Discount', 400, 150);

            // Add table rows
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
    generateSalesReport,
    downloadSalesReport
};