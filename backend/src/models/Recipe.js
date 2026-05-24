const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Recipe = sequelize.define('Recipe', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    product_id: { type: DataTypes.INTEGER, allowNull: true }, // Opsiyon reçetesi ise null olabilir
    option_id: { type: DataTypes.INTEGER, allowNull: true },  // BÜYÜ BURADA: Seçenek Reçetesi
    ingredient_id: { type: DataTypes.INTEGER, allowNull: false },
    amount_used: { type: DataTypes.DECIMAL(10, 2), allowNull: false }
}, {
    tableName: 'recipes',
    timestamps: false
});

module.exports = Recipe;