const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Table = sequelize.define('Table', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(50), allowNull: false },
    canvas_x: { type: DataTypes.INTEGER, defaultValue: 50 },
    canvas_y: { type: DataTypes.INTEGER, defaultValue: 50 },
    canvas_w: { type: DataTypes.INTEGER, allowNull: true },
    canvas_h: { type: DataTypes.INTEGER, allowNull: true },
    status: { type: DataTypes.ENUM('Boş', 'Dolu', 'Rezerve'), defaultValue: 'Boş' },
    branch_id: { type: DataTypes.INTEGER, allowNull: true },
    salon_id: { type: DataTypes.INTEGER, allowNull: true }
}, {
    tableName: 'tables',
    timestamps: false // Masalar için oluşturulma tarihine pek gerek yok
});

module.exports = Table;