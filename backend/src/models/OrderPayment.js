const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OrderPayment = sequelize.define('OrderPayment', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    order_id: { type: DataTypes.INTEGER, allowNull: false },
    branch_id: { type: DataTypes.INTEGER, allowNull: true },
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    method: { type: DataTypes.STRING(40), allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: true }
}, {
    tableName: 'order_payments',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = OrderPayment;
