const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Category = sequelize.define('Category', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(100), allowNull: false },
    color_code: { type: DataTypes.STRING(20), defaultValue: '#F3D431' },
    icon: { type: DataTypes.STRING(40), allowNull: true },
    company_id: { type: DataTypes.INTEGER, allowNull: true }
}, {
    tableName: 'categories',
    timestamps: false
});

module.exports = Category;