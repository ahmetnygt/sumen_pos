const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FloorDecoration = sequelize.define('FloorDecoration', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    branch_id: { type: DataTypes.INTEGER, allowNull: false },
    salon_id: { type: DataTypes.INTEGER, allowNull: true },
    kind: { type: DataTypes.ENUM('wall', 'bar', 'label'), allowNull: false },
    label: { type: DataTypes.STRING(24), allowNull: false },
    canvas_x: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    canvas_y: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    canvas_w: { type: DataTypes.INTEGER, allowNull: false },
    canvas_h: { type: DataTypes.INTEGER, allowNull: false }
}, {
    tableName: 'floor_decorations',
    timestamps: false
});

module.exports = FloorDecoration;
