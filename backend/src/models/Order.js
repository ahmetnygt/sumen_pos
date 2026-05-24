const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Order = sequelize.define('Order', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    status: { type: DataTypes.ENUM('Açık', 'Ödendi', 'İptal'), defaultValue: 'Açık' },
    total_amount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0.00 },
    paid_amount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0.00 },
    discount_amount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0.00 },
    is_fast_sale: { type: DataTypes.BOOLEAN, defaultValue: false }
}, {
    tableName: 'orders',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Order;