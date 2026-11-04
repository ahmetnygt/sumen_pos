const { sequelize, Category } = require('../models');
const { iconForName } = require('./menuMedia');

async function addColumn(tableName, column, type) {
    const [rows] = await sequelize.query(`PRAGMA table_info('${tableName}')`);
    const names = new Set(rows.map(row => row.name));
    if (!names.has(column)) {
        await sequelize.query(`ALTER TABLE ${tableName} ADD COLUMN ${column} ${type}`);
    }
}

async function fillEmptyIcons() {
    const categories = await Category.findAll();
    for (const category of categories) {
        if (category.icon) continue;
        const icon = iconForName(category.name);
        if (icon) await category.update({ icon });
    }
}

async function ensureMenuColumns() {
    if (sequelize.getDialect() !== 'sqlite') return;
    await addColumn('categories', 'icon', 'VARCHAR(40)');
    await addColumn('products', 'photo', 'TEXT');
    await fillEmptyIcons();
}

module.exports = { ensureMenuColumns };
