const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProductOptionGroup = sequelize.define('ProductOptionGroup', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    product_id: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false }, // Örn: "Boyut Seçimi"
    type: {
        type: DataTypes.ENUM('secim', 'ekstra'),
        defaultValue: 'secim',
        allowNull: false
    } // 'secim' (Radio/Zorunlu), 'ekstra' (Checkbox/Opsiyonel)
}, {
    tableName: 'product_option_groups',
    timestamps: false
});

module.exports = ProductOptionGroup;