const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Table = sequelize.define('Table', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(50), allowNull: false },
    canvas_x: { type: DataTypes.INTEGER, defaultValue: 50 }, // Haritadaki X konumu
    canvas_y: { type: DataTypes.INTEGER, defaultValue: 50 }, // Haritadaki Y konumu
    status: { type: DataTypes.ENUM('Boş', 'Dolu', 'Rezerve'), defaultValue: 'Boş' }
}, {
    tableName: 'tables',
    timestamps: false // Masalar için oluşturulma tarihine pek gerek yok
});

module.exports = Table;