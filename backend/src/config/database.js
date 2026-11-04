require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { Sequelize } = require('sequelize');

const dialect = process.env.DB_DIALECT || 'mysql';

let sequelize;

if (dialect === 'sqlite') {
    const storage = path.resolve(__dirname, '../../', process.env.DB_STORAGE || './data/sumen_local.sqlite');
    fs.mkdirSync(path.dirname(storage), { recursive: true });

    sequelize = new Sequelize({
        dialect: 'sqlite',
        storage,
        logging: false
    });
} else {
    sequelize = new Sequelize(
        process.env.DB_NAME,
        process.env.DB_USER,
        process.env.DB_PASS,
        {
            host: process.env.DB_HOST,
            dialect: 'mysql',
            logging: false
        }
    );
}

const testConnection = async () => {
    try {
        await sequelize.authenticate();
        console.log(`✅ Veritabanı bağlantısı başarıyla sağlandı. (${dialect})`);
    } catch (error) {
        console.error('❌ Veritabanı bağlantı hatası:', error.message);
    }
};

testConnection();

module.exports = sequelize;
