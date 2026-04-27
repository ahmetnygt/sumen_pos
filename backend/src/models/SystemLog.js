const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SystemLog = sequelize.define('SystemLog', {
    table_name: { type: DataTypes.STRING },
    personnel: { type: DataTypes.STRING, defaultValue: 'Sistem' }, // BÜYÜ BURADA: Personel Sütunu
    message: { type: DataTypes.STRING },
    status: { type: DataTypes.STRING }
}, {
    tableName: 'system_logs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

module.exports = SystemLog;