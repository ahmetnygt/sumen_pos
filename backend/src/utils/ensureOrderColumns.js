const { sequelize } = require('../models');

async function ensureOrderColumns() {
    if (sequelize.getDialect() !== 'sqlite') return;
    const [rows] = await sequelize.query("PRAGMA table_info('orders')");
    const names = new Set(rows.map(row => row.name));
    if (!names.has('table_id')) {
        await sequelize.query('ALTER TABLE orders ADD COLUMN table_id INTEGER');
    }
    if (!names.has('user_id')) {
        await sequelize.query('ALTER TABLE orders ADD COLUMN user_id INTEGER');
    }
    const [payments] = await sequelize.query("PRAGMA table_info('order_payments')");
    const paymentNames = new Set(payments.map(row => row.name));
    if (!paymentNames.has('user_id')) {
        await sequelize.query('ALTER TABLE order_payments ADD COLUMN user_id INTEGER');
    }
    const [items] = await sequelize.query("PRAGMA table_info('order_items')");
    const itemNames = new Set(items.map(row => row.name));
    if (!itemNames.has('served_at')) {
        await sequelize.query('ALTER TABLE order_items ADD COLUMN served_at DATETIME');
    }
}

module.exports = { ensureOrderColumns };
