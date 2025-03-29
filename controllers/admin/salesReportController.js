const Order = require('../../models/orderSchema');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit-table');
const fs = require('fs');
const rupee = "\u20B9";

const getSalesReport = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10; // Items per page
        const skip = (page - 1) * limit;

       
        const totalOrders = await Order.countDocuments({
            orderStatus: 'Delivered'
        });

        const orders = await Order.find({
            orderStatus: 'Delivered'
        })
        .populate('user', 'firstName lastName email')
        .populate('items.productId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

        const salesData = calculateSalesData(orders);
        const totalPages = Math.ceil(totalOrders / limit);

        res.render('sales-report', { 
            orders,
            salesData,
            startDate: '',
            endDate: '',
            filterType: 'all',
            currentPage: page,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
            nextPage: page + 1,
            previousPage: page - 1,
            lastPage: totalPages
        });
    } catch (error) {
        console.error('Error fetching sales report:', error);
        res.redirect('/admin/pageError');
    }
};

const filterSalesReport = async (req, res) => {
    try {
        const { startDate, endDate, filterType } = req.body;
        const page = parseInt(req.body.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;
        const dateFilter = getDateFilter(filterType, startDate, endDate);

        
        const totalOrders = await Order.countDocuments({
            ...dateFilter,
            orderStatus: 'Delivered'
        });

        const orders = await Order.find({
            ...dateFilter,
            orderStatus: 'Delivered'
        })
        .populate('user', 'firstName lastName email')
        .populate('items.productId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

        const salesData = calculateSalesData(orders);
        const totalPages = Math.ceil(totalOrders / limit);

        res.json({
            success: true,
            orders,
            salesData,
            startDate,
            endDate,
            filterType,
            pagination: {
                currentPage: page,
                totalPages,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1,
                nextPage: page + 1,
                previousPage: page - 1,
                lastPage: totalPages
            }
        });
    } catch (error) {
        console.error('Error filtering sales report:', error);
        res.json({ success: false, message: 'Error filtering sales report' });
    }
};

const downloadSalesReport = async (req, res) => {
    try {
        const { format, startDate, endDate, filterType } = req.query;
        const dateFilter = getDateFilter(filterType, startDate, endDate);

        // Use orderStatus filter instead of 'items.status'
        const orders = await Order.find({
            ...dateFilter,
            orderStatus: 'Delivered'
        })
        .populate('user', 'firstName lastName email')
        .populate('items.productId')
        .sort({ createdAt: -1 });

        if (format === 'excel') {
            await generateExcelReport(orders, res);
        } else if (format === 'pdf') {
            await generatePDFReport(orders, res);
        } else {
            res.status(400).json({ success: false, message: 'Invalid format' });
        }
    } catch (error) {
        console.error('Error downloading sales report:', error);
        res.status(500).json({ success: false, message: 'Error generating report' });
    }
};


function calculateSalesData(orders) {
    let totalOrders = orders.length;
    let totalAmount = 0;
    let totalCouponDiscount = 0;

    orders.forEach(order => {
        // Calculate original amount (sum of all items)
        const originalAmount = order.items.reduce((sum, item) => 
            sum + (item.price * item.quantity), 0);
        
        totalAmount += order.totalAmount;
        
        const orderCouponDiscount = originalAmount - order.totalAmount;
        totalCouponDiscount += orderCouponDiscount;
    });

    return {
        totalOrders,
        totalAmount,
        totalCouponDiscount
    };
}

function getDateFilter(filterType, startDate, endDate) {
    const now = new Date();
    let dateFilter = {};

    switch (filterType) {
        case 'custom':
            if (startDate && endDate) {
                dateFilter = {
                    createdAt: {
                        $gte: new Date(startDate),
                        $lte: new Date(endDate)
                    }
                };
            }
            break;
        case 'daily':
            dateFilter = {
                createdAt: {
                    $gte: new Date(now.setHours(0, 0, 0, 0)),
                    $lte: new Date(now.setHours(23, 59, 59, 999))
                }
            };
            break;
        case 'weekly':
            const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
            dateFilter = {
                createdAt: {
                    $gte: new Date(weekStart.setHours(0, 0, 0, 0)),
                    $lte: new Date()
                }
            };
            break;
        case 'monthly':
            dateFilter = {
                createdAt: {
                    $gte: new Date(now.getFullYear(), now.getMonth(), 1),
                    $lte: new Date()
                }
            };
            break;
    }
    return dateFilter;
}

async function generateExcelReport(orders, res) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');

    worksheet.columns = [
        { header: 'Order ID', key: 'orderId', width: 20 },
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Customer', key: 'customer', width: 25 },
        { header: 'Items', key: 'items', width: 40 },
        { header: `Original Amount (${rupee})`, key: 'originalAmount', width: 15 },
        { header: `Coupon (${rupee})`, key: 'coupon', width: 15 },
        { header: `Final Amount (${rupee})`, key: 'finalAmount', width: 15 }
    ];

    orders.forEach(order => {
        const originalAmount = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const actualCouponDiscount = originalAmount - order.totalAmount;
        worksheet.addRow({
            orderId: order.orderId,
            date: order.createdAt.toLocaleDateString(),
            customer: `${order.user.firstName} ${order.user.lastName}`,
            items: order.items.map(item =>
                `${item.productId.productName}(${rupee}${item.price} × ${item.quantity})`
            ).join(', '),
            originalAmount: originalAmount,
            coupon: actualCouponDiscount,
            finalAmount: order.totalAmount
        });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=sales-report.xlsx');

    await workbook.xlsx.write(res);
}

async function generatePDFReport(orders, res) {
    const doc = new PDFDocument({ 
        margin: 30, 
        size: 'A4',
        font: 'Helvetica' // Use built-in font
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=sales-report.pdf');
    doc.pipe(res);

  
    doc.fontSize(20).text('Sales Report', { align: 'center' });
    doc.moveDown();

   
    const salesData = calculateSalesData(orders);
    doc.fontSize(12)
        .text(`Total Orders: ${salesData.totalOrders}`)
        .text(`Total Revenue: Rs. ${salesData.totalAmount.toFixed(2)}`)
        .text(`Total Coupon Savings: Rs. ${salesData.totalCouponDiscount.toFixed(2)}`);
    doc.moveDown();

    const table = {
        headers: ['Order ID', 'Date', 'Customer', 'Amount (Rs.)', 'Coupon (Rs.)', 'Final (Rs.)'],
        rows: orders.map(order => {
            const originalAmount = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const actualCouponDiscount = originalAmount - order.totalAmount;
            return [
                order._id.toString().slice(-6),
                order.createdAt.toLocaleDateString(),
                `${order.user.firstName} ${order.user.lastName}`,
                `${originalAmount.toFixed(2)}`,
                `${actualCouponDiscount.toFixed(2)}`,
                `${order.totalAmount.toFixed(2)}`
            ];
        })
    };

    await doc.table(table, { 
        width: 500,
        prepareHeader: () => doc.font('Helvetica-Bold').fontSize(10),
        prepareRow: () => doc.font('Helvetica').fontSize(10)
    });

    doc.end();
}

module.exports = {
    getSalesReport,
    filterSalesReport,
    downloadSalesReport
};