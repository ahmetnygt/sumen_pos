const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Ingredient = sequelize.define('Ingredient', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    unit: { type: DataTypes.ENUM('cl', 'adet', 'kg', 'gr', 'lt'), allowNull: false },
    stock_amount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0.00 },
    critical_level: { type: DataTypes.DECIMAL(10, 2), defaultValue: 10.00 }
}, {
    tableName: 'ingredients',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Ingredient;