const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Recipe = sequelize.define('Recipe', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    amount_used: { type: DataTypes.DECIMAL(10, 2), allowNull: false }
}, {
    tableName: 'recipes',
    timestamps: false
});

module.exports = Recipe;