const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const { sequelize } = require('./src/models'); 

const app = express();

// Middleware'ler
app.use(cors());
app.use(express.json());

const apiRoutes = require('./src/routes'); // Rota merkezini içeri al
app.use('/api', apiRoutes); // Tüm yolların başına '/api' ekle

// Sunucu ve Socket.io Kurulumu
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Şimdilik her yere açık, PWA ve Electron'dan erişeceğiz
        methods: ["GET", "POST", "PUT", "DELETE"]
    }
});

// Socket.io nesnesini Controller'larda kullanabilmek için app içine gömüyoruz
app.set('io', io);

io.on('connection', (socket) => {
    console.log(`🔌 Yeni cihaz bağlandı: ${socket.id}`);
    
    socket.on('disconnect', () => {
        console.log(`❌ Cihaz bağlantısı koptu: ${socket.id}`);
    });
});

// Sistem Durum Kontrolü (API Test)
app.get('/', (req, res) => {
    res.json({ message: '🚀 Sümen POS Backend Servisi Aktif' });
});

const PORT = process.env.PORT || 5000;

// Veritabanı tablolarını senkronize et ve sunucuyu başlat
sequelize.sync({ alter: true })
    .then(() => {
        server.listen(PORT, () => {
            console.log(`🚀 Sümen POS Backend ${PORT} portunda çalışıyor...`);
        });
    })
    .catch((error) => {
        console.error('❌ Veritabanı senkronizasyon hatası:', error);
    });