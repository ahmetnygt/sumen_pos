const { sequelize } = require('../models');

async function ensureCompanyColumns() {
    if (sequelize.getDialect() !== 'sqlite') return;
    const [rows] = await sequelize.query("PRAGMA table_info('companies')");
    const names = new Set(rows.map(row => row.name));
    if (!names.has('accent_color')) {
        await sequelize.query("ALTER TABLE companies ADD COLUMN accent_color VARCHAR(7) NOT NULL DEFAULT '#d4af37'");
    }
    if (!names.has('logo_svg')) {
        await sequelize.query('ALTER TABLE companies ADD COLUMN logo_svg TEXT');
    }
}

module.exports = { ensureCompanyColumns };
