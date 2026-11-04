const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BranchStock = sequelize.define('BranchStock', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    branch_id: { type: DataTypes.INTEGER, allowNull: false },
    ingredient_id: { type: DataTypes.INTEGER, allowNull: false },
    stock_amount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0.00 }
}, {
    tableName: 'branch_stocks',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { unique: true, fields: ['branch_id', 'ingredient_id'] }
    ]
});

module.exports = BranchStock;
