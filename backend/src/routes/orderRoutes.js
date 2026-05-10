const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

// Tüm işlemlerde giriş yapılmış (Token) olmalı
router.use(verifyToken);

// Kasa Canlı Radar
router.get('/summary/live', orderController.getLiveSummary);

// --- Mutfak ---
router.get('/kitchen', authorizeRoles('Admin', 'Kasa', 'Garson'), orderController.getKitchenOrders);
router.get('/kitchen/history', authorizeRoles('Admin', 'Kasa', 'Garson'), orderController.getKitchenHistory);
router.post('/kitchen/:itemId/ready', authorizeRoles('Admin', 'Kasa', 'Garson'), orderController.markItemReady);

// Masalar ve Siparişler
router.get('/table/:tableId', orderController.getActiveOrder);
router.post('/table/:tableId/add-item', orderController.addItem);

// İptal ve Ödeme
router.delete('/item/:itemId', authorizeRoles('Admin', 'Kasa', 'Garson'), orderController.cancelItem);
router.post('/table/:tableId/discount', authorizeRoles('Admin', 'Kasa', 'Garson'), orderController.applyDiscount);
router.post('/table/:tableId/pay', authorizeRoles('Admin', 'Kasa','Garson'), orderController.payOrder);

module.exports = router;