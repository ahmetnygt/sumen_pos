const orderService = require('../services/orderService');
const { SystemLog, Table, Order } = require('../models');
const { Op } = require('sequelize');

exports.getActiveOrder = async (req, res) => {
    try {
        const order = await orderService.getActiveOrder(req.params.tableId);
        res.status(200).json(order || null);
    } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.addItem = async (req, res) => {
    try {
        const { productId, price, quantity } = req.body;
        const orderItem = await orderService.addItemToOrder(req.params.tableId, req.user.id, productId, price, quantity);

        // KİM GİRDİ LOGLA VE RADYODAN (SOCKET) SİNYAL ÇAK
        const table = await Table.findByPk(req.params.tableId);
        await SystemLog.create({
            table_name: table.name,
            personnel: `${req.user.name} (${req.user.role})`,
            message: `📝 ${quantity}x ürün siparişi girildi.`,
            status: 'Siparişte'
        });
        req.app.get('io').emit('updateTables');
        req.app.get('io').emit('updateDashboard');

        res.status(200).json({ message: 'Sipariş eklendi.', orderItem });
    } catch (error) { res.status(400).json({ message: error.message }); }
};

exports.cancelItem = async (req, res) => {
    try {
        const result = await orderService.cancelOrderItem(req.params.itemId);
        await SystemLog.create({
            table_name: 'İPTAL',
            personnel: `${req.user.name} (${req.user.role})`,
            message: `✕ Bir ürün iptal edildi.`,
            status: 'İptal'
        });
        req.app.get('io').emit('updateTables');
        req.app.get('io').emit('updateDashboard');
        res.status(200).json(result);
    } catch (error) { res.status(400).json({ message: error.message }); }
};

exports.applyDiscount = async (req, res) => {
    try {
        const { type, value } = req.body;
        const result = await orderService.applyDiscount(req.params.tableId, type, value);

        const table = await Table.findByPk(req.params.tableId);
        await SystemLog.create({
            table_name: table.name,
            personnel: `${req.user.name} (${req.user.role})`,
            message: `✂️ ₺${result.discount_amount} İskonto uygulandı.`,
            status: 'İskonto'
        });
        req.app.get('io').emit('updateDashboard');

        res.status(200).json(result);
    } catch (error) { res.status(400).json({ message: error.message }); }
};

exports.payOrder = async (req, res) => {
    try {
        const { pay_amount, payment_method, paidItems } = req.body;
        const result = await orderService.processPayment(req.params.tableId, pay_amount, payment_method, paidItems);

        const table = await Table.findByPk(req.params.tableId);
        const tag = payment_method === 'Nakit' ? '💵' : '💳';

        await SystemLog.create({
            table_name: table.name,
            personnel: `${req.user.name} (${req.user.role})`,
            message: result.isFullyPaid ? `✅ ${tag} HESAP KAPATILDI.` : `💰 ${tag} ₺${pay_amount} kısmi tahsilat.`,
            status: result.isFullyPaid ? 'Kapatıldı' : 'Ödendi'
        });

        req.app.get('io').emit('updateTables');
        req.app.get('io').emit('updateDashboard');

        res.status(200).json(result);
    } catch (error) { res.status(400).json({ message: error.message }); }
};

// SİSTEM BİLGİSİ: Radarı besleyen canlı istihbarat motoru
exports.getLiveSummary = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const recentLogs = await SystemLog.findAll({
            limit: 20,
            order: [['created_at', 'DESC']]
        });

        const logs = recentLogs.map(log => ({
            id: `log-${log.id}`,
            time: log.created_at || log.createdAt,
            table: log.table_name,
            personnel: log.personnel,
            message: log.message,
            status: log.status
        }));

        res.status(200).json({ logs });
    } catch (error) { res.status(500).json({ message: 'Özet alınamadı' }); }
};