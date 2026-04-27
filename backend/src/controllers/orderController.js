const orderService = require('../services/orderService');
const { SystemLog, Table, Order } = require('../models');

// GÜVENLİK DUVARI: Token'dan isim gelmezse sistemi patlatmasın diye güvenli isim çekici
const getPersonnelName = (user) => {
    if (!user) return 'Sistem';
    const name = user.name || user.username || 'Personel';
    const role = user.role || 'Yetkisiz';
    return `${name} (${role})`;
};

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

        const table = await Table.findByPk(req.params.tableId);
        if (table) {
            await SystemLog.create({
                table_name: table.name,
                personnel: getPersonnelName(req.user),
                message: `📝 ${quantity}x ürün siparişi girildi.`,
                status: 'Siparişte'
            });
        }
        req.app.get('io').emit('updateTables');
        req.app.get('io').emit('updateDashboard');

        res.status(200).json({ message: 'Sipariş eklendi.', orderItem });
    } catch (error) { res.status(400).json({ message: error.message }); }
};

exports.cancelItem = async (req, res) => {
    try {
        const result = await orderService.cancelOrderItem(req.params.itemId);
        await SystemLog.create({
            table_name: 'İPTAL İŞLEMİ',
            personnel: getPersonnelName(req.user),
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
        if (table) {
            await SystemLog.create({
                table_name: table.name,
                personnel: getPersonnelName(req.user),
                message: `✂️ ₺${result.discount_amount} İskonto uygulandı.`,
                status: 'İskonto'
            });
        }
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

        if (table) {
            await SystemLog.create({
                table_name: table.name,
                personnel: getPersonnelName(req.user),
                message: result.isFullyPaid ? `✅ ${tag} HESAP KAPATILDI.` : `💰 ${tag} ₺${pay_amount} kısmi tahsilat.`,
                status: result.isFullyPaid ? 'Kapatıldı' : 'Ödendi'
            });
        }

        req.app.get('io').emit('updateTables');
        req.app.get('io').emit('updateDashboard');

        res.status(200).json(result);
    } catch (error) { res.status(400).json({ message: error.message }); }
};

// RADAR MOTORU: Tarih hatası (created_at) çözüldü, ID ile sıralanıyor.
exports.getLiveSummary = async (req, res) => {
    try {
        const recentLogs = await SystemLog.findAll({
            limit: 25,
            order: [['id', 'DESC']] // BÜYÜ BURADA: Sequelize'ın tarih bug'ını atlatmak için ID'ye göre tersten diziyoruz!
        });

        const logs = recentLogs.map(log => ({
            id: `log-${log.id}`,
            time: log.created_at || log.createdAt || new Date(),
            table: log.table_name,
            personnel: log.personnel,
            message: log.message,
            status: log.status
        }));

        res.status(200).json({ logs });
    } catch (error) { 
        console.error("Radar Verisi Çekilemedi:", error);
        res.status(500).json({ message: 'Özet alınamadı' }); 
    }
};