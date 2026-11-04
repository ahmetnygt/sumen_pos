const { sequelize, Branch, Table, FloorDecoration, FloorSalon } = require('../models');

async function addColumn(tableName, column, type) {
    const [rows] = await sequelize.query(`PRAGMA table_info('${tableName}')`);
    const names = new Set(rows.map(row => row.name));
    if (!names.has(column)) {
        await sequelize.query(`ALTER TABLE ${tableName} ADD COLUMN ${column} ${type}`);
    }
}

async function ensureTableColumns() {
    if (sequelize.getDialect() !== 'sqlite') return;
    await addColumn('tables', 'canvas_w', 'INTEGER');
    await addColumn('tables', 'canvas_h', 'INTEGER');
    await addColumn('tables', 'salon_id', 'INTEGER');
    await addColumn('floor_decorations', 'salon_id', 'INTEGER');

    const branches = await Branch.findAll();
    for (const branch of branches) {
        let salon = await FloorSalon.findOne({
            where: { branch_id: branch.id },
            order: [['sort_order', 'ASC'], ['id', 'ASC']]
        });
        if (!salon) {
            salon = await FloorSalon.create({ branch_id: branch.id, name: 'Salon', sort_order: 0 });
        }
        await Table.update({ salon_id: salon.id }, { where: { branch_id: branch.id, salon_id: null } });
        await FloorDecoration.update({ salon_id: salon.id }, { where: { branch_id: branch.id, salon_id: null } });
    }
}

module.exports = { ensureTableColumns };
