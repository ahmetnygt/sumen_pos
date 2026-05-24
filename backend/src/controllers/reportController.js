const { Order, OrderItem, Product, sequelize } = require('../models');
const { Op } = require('sequelize');

exports.getGeneralStats = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 1. Günlük Ciro ve İskonto
        const dailyOrders = await Order.findAll({
            where: { created_at: { [Op.gte]: today }, status: 'Ödendi' }
        });

        const dailyRevenue = dailyOrders.reduce((acc, o) => acc + parseFloat(o.paid_amount || 0), 0);
        const dailyDiscount = dailyOrders.reduce((acc, o) => acc + parseFloat(o.discount_amount || 0), 0);

        // 2. En Çok Satan Ürünler (Top 5)
        const topProducts = await OrderItem.findAll({
            attributes: [
                'product_id',
                [sequelize.fn('SUM', sequelize.col('quantity')), 'total_sold'],
                [sequelize.fn('SUM', sequelize.literal('quantity * price')), 'total_revenue']
            ],
            where: { status: 'Ödendi' },
            include: [{ model: Product, attributes: ['name'] }],
            group: ['product_id', 'Product.name'],
            order: [[sequelize.literal('total_sold'), 'DESC']],
            limit: 5
        });

        res.status(200).json({
            dailyRevenue,
            dailyDiscount,
            totalOrders: dailyOrders.length,
            topProducts: topProducts.map(p => ({
                name: p.Product?.name,
                sold: parseInt(p.getDataValue('total_sold')),
                revenue: parseFloat(p.getDataValue('total_revenue'))
            }))
        });

    } catch (error) {
        console.error('Sistem Hatası: Raporlar çekilemedi.', error);
        res.status(500).json({ message: 'Rapor verisi alınamadı.' });
    }
};