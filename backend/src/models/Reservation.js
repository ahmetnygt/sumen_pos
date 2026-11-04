const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Reservation = sequelize.define('Reservation', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    branch_id: { type: DataTypes.INTEGER, allowNull: false },
    table_id: { type: DataTypes.INTEGER, allowNull: false },
    guest_name: { type: DataTypes.STRING(80), allowNull: false },
    phone: { type: DataTypes.STRING(30), allowNull: true, defaultValue: '' },
    party_size: { type: DataTypes.INTEGER, allowNull: false },
    starts_at: { type: DataTypes.DATE, allowNull: false },
    duration_minutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 120 },
    note: { type: DataTypes.STRING(200), allowNull: true, defaultValue: '' },
    status: {
        type: DataTypes.ENUM('Bekliyor', 'Geldi', 'İptal', 'Gelmedi'),
        allowNull: false,
        defaultValue: 'Bekliyor'
    }
}, {
    tableName: 'reservations',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Reservation;
