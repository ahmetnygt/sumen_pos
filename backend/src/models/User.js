const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const sequelize = require('../config/database'); // Veritabanı motorumuzu çağırıyoruz

const User = sequelize.define('User', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    surname: { type: DataTypes.STRING, allowNull: false },
    user_pin: { type: DataTypes.STRING(4), allowNull: false },
    pass_pin: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.ENUM('SuperAdmin', 'Admin', 'Kasa', 'Garson', 'Mutfak'), defaultValue: 'Garson' },
    company_id: { type: DataTypes.INTEGER, allowNull: true },
    branch_id: { type: DataTypes.INTEGER, allowNull: true }
}, {
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { unique: true, fields: ['company_id', 'user_pin'] }
    ],
    hooks: {
        // BÜTÜN BÜYÜ BURADA: Veritabanına kaydetmeden hemen önce şifreyi kriptola!
        beforeCreate: async (user) => {
            if (user.pass_pin) {
                user.pass_pin = await bcrypt.hash(user.pass_pin, 10);
            }
        },
        beforeUpdate: async (user) => {
            if (user.changed('pass_pin')) {
                user.pass_pin = await bcrypt.hash(user.pass_pin, 10);
            }
        }
    }
});

module.exports = User;