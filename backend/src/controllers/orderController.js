const orderService = require('../services/orderService');
const { SystemLog, Table } = require('../models');
const { emitBranch } = require('../utils/realtime');
const { rememberCancels, listCancels } = require('../utils/kitchenNotices');

// GÜVENLİK DUVARI: Token'dan isim gelmezse sistemi patlatmasın diye güvenli isim çekici
const getPersonnelName = (user) => {
    if (!user) return 'Sistem';
    const name = user.name || user.username || 'Personel';
    const role = user.role || 'Yetkisiz';
    return `${name} (${role})`;
};

exports.getActiveOrder = async (req, res) => {
    try {
        const order = await orderService.getActiveOrder(req.params.tableId, req.user.branch_id);
        res.status(200).json(order || null);
    } catch (error) {
        console.error('Aktif adisyon alınamadı:', error);
        res.status(500).json({ message: 'Adisyon alınamadı.' });
    }
};

const sendOrderError = (res, error) => {
    if (error.code === 'STOCK_SHORT') {
        return res.status(409).json({ code: 'STOCK_SHORT', message: error.message, shortages: error.shortages || [] });
    }
    return res.status(400).json({ message: error.message });
};

exports.addItem = async (req, res) => {
    try {
        const { productId, quantity, selectedOptions, optionIds, confirmShortage } = req.body;

        const orderItem = await orderService.addItemToOrder(
            req.params.tableId,
            req.user.id,
            productId,
            quantity,
            selectedOptions || optionIds,
            req.user.branch_id,
            req.user.company_id,
            confirmShortage === true
        );

        const table = await Table.findOne({ where: { id: req.params.tableId, branch_id: req.user.branch_id } });
        if (table) {
            await SystemLog.create({
                branch_id: req.user.branch_id,
                table_name: table.name,
                personnel: getPersonnelName(req.user),
                message: `${quantity}x ürün siparişi girildi.`,
                status: 'Siparişte'
            });
        }
        emitBranch(req, 'updateTables');
        emitBranch(req, 'updateDashboard');
        emitBranch(req, 'updateKitchen');

        res.status(200).json({ message: 'Sipariş eklendi.', orderItem });
    } catch (error) { sendOrderError(res, error); }
};

exports.addItems = async (req, res) => {
    try {
        const { items, confirmShortage } = req.body;
        const result = await orderService.addItemsToOrder(
            req.params.tableId,
            req.user.id,
            items,
            req.user.branch_id,
            req.user.company_id,
            confirmShortage === true
        );
        const table = await Table.findOne({ where: { id: req.params.tableId, branch_id: req.user.branch_id } });
        if (table) {
            await SystemLog.create({
                branch_id: req.user.branch_id,
                table_name: table.name,
                personnel: getPersonnelName(req.user),
                message: `${Array.isArray(items) ? items.length : 0} kalem sipariş girildi.`,
                status: 'Siparişte'
            });
        }
        emitBranch(req, 'updateTables');
        emitBranch(req, 'updateDashboard');
        emitBranch(req, 'updateKitchen');
        res.status(200).json(result);
    } catch (error) { sendOrderError(res, error); }
};

exports.cancelItems = async (req, res) => {
    try {
        const result = await orderService.cancelOrderItems(req.body.itemIds, req.user.branch_id);
        const lines = result.cancelled || [];
        if (lines.length) {
            await SystemLog.create({
                branch_id: req.user.branch_id,
                table_name: lines[0].tableName,
                personnel: getPersonnelName(req.user),
                message: lines.map(line => `✕ ${line.quantity}x ${line.name} — ${Number(line.amount).toFixed(2)} ₺`).join(', '),
                status: 'İptal'
            });
        }
        emitBranch(req, 'updateTables');
        emitBranch(req, 'updateDashboard');
        if (lines.length) {
            rememberCancels(req.user.branch_id, lines);
            emitBranch(req, 'updateKitchen');
        }
        res.status(200).json(result);
    } catch (error) { res.status(400).json({ message: error.message }); }
};

exports.cancelItem = async (req, res) => {
    try {
        const result = await orderService.cancelOrderItem(req.params.itemId, req.user.branch_id);
        const line = result.cancelled;
        if (line) {
            await SystemLog.create({
                branch_id: req.user.branch_id,
                table_name: line.tableName,
                personnel: getPersonnelName(req.user),
                message: `✕ ${line.quantity}x ${line.name} — ${Number(line.amount).toFixed(2)} ₺`,
                status: 'İptal'
            });
        }
        emitBranch(req, 'updateTables');
        emitBranch(req, 'updateDashboard');
        if (line) {
            rememberCancels(req.user.branch_id, [line]);
            emitBranch(req, 'updateKitchen');
        }
        res.status(200).json(result);
    } catch (error) { res.status(400).json({ message: error.message }); }
};

exports.applyDiscount = async (req, res) => {
    try {
        const { type, value } = req.body;
        const result = await orderService.applyDiscount(req.params.tableId, type, value, req.user.branch_id);

        const table = await Table.findOne({ where: { id: req.params.tableId, branch_id: req.user.branch_id } });
        if (table) {
            await SystemLog.create({
                branch_id: req.user.branch_id,
                table_name: table.name,
                personnel: getPersonnelName(req.user),
                message: `₺${result.discount_amount} İskonto uygulandı.`,
                status: 'İskonto'
            });
        }
        emitBranch(req, 'updateDashboard');

        res.status(200).json(result);
    } catch (error) { res.status(400).json({ message: error.message }); }
};

exports.payOrder = async (req, res) => {
    try {
        const { pay_amount, payment_method, paidItems } = req.body;
        const result = await orderService.processPayment(req.params.tableId, pay_amount, payment_method, paidItems, req.user.branch_id, req.user.id);

        const table = await Table.findOne({ where: { id: req.params.tableId, branch_id: req.user.branch_id } });
        if (table) {
            await SystemLog.create({
                branch_id: req.user.branch_id,
                table_name: table.name,
                personnel: getPersonnelName(req.user),
                message: result.isFullyPaid ? 'HESAP KAPATILDI.' : `₺${pay_amount} kısmi tahsilat.`,
                status: result.isFullyPaid ? 'Kapatıldı' : 'Ödendi'
            });
        }

        emitBranch(req, 'updateTables');
        emitBranch(req, 'updateDashboard');

        res.status(200).json(result);
    } catch (error) { res.status(400).json({ message: error.message }); }
};

exports.getLiveSummary = async (req, res) => {
    try {
        const recentLogs = await SystemLog.findAll({
            where: { branch_id: req.user.branch_id },
            limit: 25,
            order: [['id', 'DESC']]
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

// --- MUTFAK (KDS) MOTORU ---

// Bekleyen tüm siparişleri mutfağa çek
exports.getKitchenOrders = async (req, res) => {
    try {
        const { OrderItem, Order, Product, User, Table } = require('../models');
        const items = await OrderItem.findAll({
            where: { status: 'Siparişte', branch_id: req.user.branch_id },
            include: [
                { model: Product, attributes: ['id', 'name', 'instructions'] },
                { model: User, attributes: ['name', 'surname'] }, // Garson bilgisi
                { model: Order, include: [{ model: Table, attributes: ['name'] }] } // Masa ismi
            ],
            order: [['id', 'ASC']]
        });
        res.status(200).json({ items, cancelled: listCancels(req.user.branch_id) });
    } catch (error) {
        console.error('Mutfak siparişleri alınamadı:', error);
        res.status(500).json({ message: 'Mutfak siparişleri alınamadı.' });
    }
};

// Aşçı "Hazır" butonuna bastığında
exports.markItemReady = async (req, res) => {
    try {
        const { OrderItem, Order } = require('../models');
        const item = await OrderItem.findOne({
            where: { id: req.params.itemId, branch_id: req.user.branch_id },
            include: [{ model: Order }]
        });

        if (!item) return res.status(404).json({ message: 'Sipariş bulunamadı' });

        await item.update({ status: 'Hazır' });

        const itemName = (req.body && req.body.itemName) || 'Bir sipariş';
        emitBranch(req, 'updateKitchen');
        emitBranch(req, 'updateTables');
        emitBranch(req, 'orderReadyToServe', {
            tableId: item.Order ? item.Order.table_id : null,
            itemName,
            title: 'Sipariş hazır',
            message: `${itemName} hazır.`
        });

        res.status(200).json({ message: 'Sipariş hazır olarak işaretlendi.' });
    } catch (error) {
        console.error('Sipariş hazır işaretlenemedi:', error);
        res.status(400).json({ message: error.message });
    }
};

// --- MUTFAK: TOPLU HAZIRLAMA MOTORU ---
exports.markBulkReady = async (req, res) => {
    try {
        const { OrderItem, Order, Table } = require('../models');
        const { itemIds } = req.body;

        if (!itemIds || itemIds.length === 0) return res.status(400).json({ message: 'Ürün seçilmedi' });

        const owned = await OrderItem.findAll({ where: { id: itemIds, branch_id: req.user.branch_id } });
        if (owned.length !== itemIds.length) return res.status(403).json({ message: 'Seçilen ürünler bu şubeye ait değil.' });

        await OrderItem.update({ status: 'Hazır' }, { where: { id: itemIds, branch_id: req.user.branch_id } });

        const firstItem = await OrderItem.findByPk(itemIds[0], {
            include: [{ model: Order, include: [{ model: Table, attributes: ['name'] }] }]
        });

        const tableName = firstItem.Order?.Table?.name || `Masa ${firstItem.Order?.table_id}`;

        emitBranch(req, 'updateKitchen');
        emitBranch(req, 'updateTables');
        emitBranch(req, 'orderReadyToServe', {
            title: 'Masa hazır',
            message: `${tableName} için ${itemIds.length} parça sipariş mutfaktan çıktı.`,
            type: 'bulk'
        });

        res.status(200).json({ message: 'Tümü hazır' });
    } catch (error) {
        console.error('Toplu hazır hatası:', error);
        res.status(500).json({ message: 'Siparişler hazır işaretlenemedi.' });
    }
};

exports.recallItem = async (req, res) => {
    try {
        const { OrderItem } = require('../models');
        const item = await OrderItem.findOne({
            where: { id: req.params.itemId, branch_id: req.user.branch_id }
        });
        if (!item) return res.status(404).json({ message: 'Sipariş bulunamadı.' });
        if (item.status !== 'Hazır') return res.status(400).json({ message: 'Bu satır geri alınamaz.' });

        await item.update({ status: 'Siparişte', served_at: null });
        emitBranch(req, 'updateKitchen');
        emitBranch(req, 'updateTables');
        res.status(200).json({ message: 'Satır fişe alındı.' });
    } catch (error) {
        console.error('Satır geri alınamadı:', error);
        res.status(400).json({ message: 'Satır geri alınamadı.' });
    }
};

// Mutfak Geçmişi (Radar)
exports.getKitchenHistory = async (req, res) => {
    try {
        const { OrderItem, Product, Order, Table, User } = require('../models'); // User eklendi
        const history = await OrderItem.findAll({
            where: { status: 'Hazır', branch_id: req.user.branch_id },
            limit: 20, // Biraz daha fazla görelim
            order: [['updated_at', 'DESC']], // Son tamamlanan en üstte
            include: [
                { model: Product, attributes: ['name'] },
                { model: User, attributes: ['name', 'surname'] }, // Garson/Personel bilgisi
                { model: Order, include: [{ model: Table, attributes: ['name'] }] }
            ]
        });
        res.status(200).json(history);
    } catch (error) {
        console.error('Mutfak geçmişi alınamadı:', error);
        res.status(500).json({ message: 'Mutfak geçmişi alınamadı.' });
    }
};

exports.handleFastSale = async (req, res) => {
    try {
        const { items, isPaid, paymentMethod, confirmShortage } = req.body;
        const order = await orderService.processFastSale(
            req.user.id,
            items,
            isPaid,
            paymentMethod,
            req.user.branch_id,
            req.user.company_id,
            confirmShortage === true
        );

        await SystemLog.create({
            branch_id: req.user.branch_id,
            table_name: 'GEL-AL (Masasız)',
            personnel: getPersonnelName(req.user),
            message: isPaid ? `${paymentMethod} Tahsil: ₺${order.total_amount}` : 'Gel-Al sipariş mutfağa atıldı.',
            status: isPaid ? 'Kapatıldı' : 'Siparişte'
        });

        emitBranch(req, 'updateTables');
        emitBranch(req, 'updateDashboard');
        if (!isPaid) emitBranch(req, 'updateKitchen');

        res.status(200).json({ message: 'Hızlı satış fişek gibi işlendi', order });
    } catch (error) { sendOrderError(res, error); }
};

function optionText(value) {
    let current = value;
    for (let i = 0; i < 2 && typeof current === 'string'; i += 1) {
        try { current = JSON.parse(current); } catch (error) { return ''; }
    }
    if (!Array.isArray(current)) return '';
    return current.map(opt => opt && opt.name).filter(Boolean).join(', ');
}

function placeName(order) {
    if (order?.Table?.name) return order.Table.name;
    return 'Hızlı satış';
}

function presentMineItem(row) {
    const order = row.Order;
    return {
        id: row.id,
        at: row.createdAt || row.created_at,
        table_id: order ? order.table_id : null,
        table_name: placeName(order),
        name: row.Product ? row.Product.name : '',
        quantity: row.quantity,
        options: optionText(row.selected_options),
        status: row.status
    };
}

function todayBounds() {
    const now = new Date();
    return {
        start: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0),
        end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    };
}

function mineInclude() {
    const { Product, Order, Table } = require('../models');
    return [
        { model: Product, attributes: ['name'] },
        { model: Order, include: [{ model: Table, attributes: ['name'] }] }
    ];
}

exports.markItemServed = async (req, res) => {
    try {
        const { OrderItem } = require('../models');
        const item = await OrderItem.findOne({
            where: {
                id: req.params.itemId,
                branch_id: req.user.branch_id,
                user_id: req.user.id
            }
        });
        if (!item) return res.status(404).json({ message: 'Sipariş bulunamadı.' });
        if (item.status !== 'Hazır') return res.status(400).json({ message: 'Henüz hazır değil.' });
        if (!item.served_at) await item.update({ served_at: new Date() });
        res.status(200).json({ message: 'Servis edildi.' });
    } catch (error) {
        console.error('Sipariş götürülemedi:', error);
        res.status(400).json({ message: 'Sipariş götürülemedi.' });
    }
};

exports.listMyPending = async (req, res) => {
    try {
        const { Op } = require('sequelize');
        const { OrderItem } = require('../models');
        const rows = await OrderItem.findAll({
            where: {
                user_id: req.user.id,
                branch_id: req.user.branch_id,
                served_at: null,
                status: { [Op.in]: ['Siparişte', 'Hazır'] }
            },
            include: mineInclude(),
            order: [['created_at', 'ASC']]
        });
        res.status(200).json(rows.map(presentMineItem));
    } catch (error) {
        console.error('Bekleyen siparişler alınamadı:', error);
        res.status(500).json({ message: 'Bekleyen siparişler alınamadı.' });
    }
};

exports.listMyToday = async (req, res) => {
    try {
        const { Op } = require('sequelize');
        const { OrderItem, OrderPayment, Order, Table } = require('../models');
        const { start, end } = todayBounds();
        const span = { [Op.between]: [start, end] };
        const items = await OrderItem.findAll({
            where: { user_id: req.user.id, branch_id: req.user.branch_id, created_at: span },
            include: mineInclude(),
            order: [['created_at', 'DESC']]
        });
        const payments = await OrderPayment.findAll({
            where: { user_id: req.user.id, branch_id: req.user.branch_id, created_at: span },
            include: [{ model: Order, include: [{ model: Table, attributes: ['name'] }] }],
            order: [['created_at', 'DESC']]
        });
        res.status(200).json({
            items: items.map(presentMineItem),
            payments: payments.map(row => ({
                id: row.id,
                at: row.createdAt || row.created_at,
                table_name: placeName(row.Order),
                method: row.method,
                amount: Number(row.amount)
            }))
        });
    } catch (error) {
        console.error('Günlük geçmiş alınamadı:', error);
        res.status(500).json({ message: 'Günlük geçmiş alınamadı.' });
    }
};