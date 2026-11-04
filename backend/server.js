const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { sequelize } = require('./src/models');
const { seedLocalDummy } = require('./src/seed/localDummy');
const { ensureOrderColumns } = require('./src/utils/ensureOrderColumns');
const { ensureTableColumns } = require('./src/utils/ensureTableColumns');
const { ensureCompanyColumns } = require('./src/utils/ensureCompanyColumns');
const { ensureMenuColumns } = require('./src/utils/ensureMenuColumns');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use('/api', rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Çok fazla istek. Biraz sonra tekrar deneyin.' }
}));

const apiRoutes = require('./src/routes');
app.use('/api', apiRoutes);

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

io.use((socket, next) => {
    try {
        const token = socket.handshake.auth?.token;
        if (!token) return next(new Error('Token yok'));
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.pending || !decoded.branch_id) return next(new Error('Şube seçilmedi'));
        socket.user = decoded;
        next();
    } catch (err) {
        next(new Error('Geçersiz token'));
    }
});

io.on('connection', (socket) => {
    console.log(`🔌 Yeni cihaz bağlandı: ${socket.id}`);
    if (socket.user?.branch_id) socket.join(`branch-${socket.user.branch_id}`);
    if (socket.user?.company_id) socket.join(`company-${socket.user.company_id}`);

    socket.on('disconnect', () => {
        console.log(`❌ Cihaz bağlantısı koptu: ${socket.id}`);
    });
});

// Sistem Durum Kontrolü (API Test)
app.get('/', (req, res) => {
    res.json({ message: '🚀 Sümen POS Backend Servisi Aktif' });
});

const PORT = process.env.PORT || 5500;

// Veritabanı tablolarını senkronize et ve sunucuyu başlat
sequelize.sync()
    .then(async () => {
        await ensureOrderColumns();
        await ensureTableColumns();
        await ensureCompanyColumns();
        await ensureMenuColumns();
        await seedLocalDummy();
        server.listen(PORT, () => {
            console.log(`🚀 Sümen POS Backend ${PORT} portunda çalışıyor...`);
        });
    })
    .catch((error) => {
        console.error('❌ Veritabanı senkronizasyon hatası:', error);
    });