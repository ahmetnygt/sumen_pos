require('dotenv').config(); // BÜYÜ BURADA: .env dosyasını sisteme tanıtır
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
    process.env.DB_NAME, 
    process.env.DB_USER, 
    process.env.DB_PASS, 
    {
        host: process.env.DB_HOST,
        dialect: 'mysql',
        logging: false
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