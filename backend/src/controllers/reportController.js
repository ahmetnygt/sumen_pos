const { Op } = require('sequelize');
const { Order, OrderItem, Product } = require('../models');

exports.getSalesReport = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const whereClause = { status: 'Ödendi' };

        // Eğer tarih ve saat aralığı seçildiyse filtreye ekle
        if (startDate && endDate) {
            whereClause.updatedAt = {
                [Op.between]: [new Date(startDate), new Date(endDate)]
            };
        }

        // Fişlerdeki her bir ürünü, içindeki Sipariş (Order) ve Ürün (Product) detayıyla çekiyoruz
        const sales = await OrderItem.findAll({
            where: { status: 'Ödendi' },
            include: [
                {
                    model: Order,
                    where: whereClause,
                    attributes: ['id', 'updatedAt', 'payment_method', 'table_id']
                },
                {
                    model: Product,
                    attributes: ['name']
                }
            ],
            order: [[Order, 'updatedAt', 'DESC']] // En yeni satış en üstte
        });

        res.status(200).json(sales);
    } catch (error) {
        res.status(500).json({ message: 'Rapor çekilemedi', error: error.message });
    }
};