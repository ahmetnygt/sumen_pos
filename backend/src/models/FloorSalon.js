const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FloorSalon = sequelize.define('FloorSalon', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    branch_id: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING(40), allowNull: false },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
}, {
    tableName: 'floor_salons',
    timestamps: false
});

module.exports = FloorSalon;
