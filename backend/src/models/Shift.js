const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const Shift = sequelize.define('Shift', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    user_id: { 
        type: DataTypes.INTEGER, 
        references: { model: User, key: 'id' },
        allowNull: false
    },
    start_time: { 
        type: DataTypes.DATE, 
        allowNull: false, 
        defaultValue: DataTypes.NOW 
    },
    end_time: { 
        type: DataTypes.DATE, 
        allowNull: true 
    },
    starting_cash: { 
        type: DataTypes.DECIMAL(10, 2), 
        defaultValue: 0.00 
    },
    ending_cash: { 
        type: DataTypes.DECIMAL(10, 2), 
        allowNull: true 
    },
    status: { 
        type: DataTypes.ENUM('Açık', 'Kapalı'), 
        defaultValue: 'Açık' 
    }
}, {
    tableName: 'shifts',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

User.hasMany(Shift, { foreignKey: 'user_id' });
Shift.belongsTo(User, { foreignKey: 'user_id' });

module.exports = Shift;