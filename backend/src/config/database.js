const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        dialect: 'mysql',
        timezone: '+03:00', // Türkiye saat dilimi
        logging: false, // Konsolu SQL sorgularıyla boğmamak için kapattık
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    }
);

// Veritabanı Bağlantı Testi
const testConnection = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Veritabanı bağlantısı başarıyla sağlandı.');
    } catch (error) {
        console.error('❌ Veritabanı bağlantı hatası:', error.message);
    }
};

testConnection();

module.exports = sequelize;