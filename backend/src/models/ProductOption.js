const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProductOption = sequelize.define('ProductOption', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    option_group_id: { type: DataTypes.INTEGER, allowNull: false }, // Gruba bağladık!
    name: { type: DataTypes.STRING, allowNull: false },
    price_diff: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 }
}, {
    tableName: 'product_options',
    timestamps: false
});

module.exports = ProductOption;