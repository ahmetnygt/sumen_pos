const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

// Tüm işlemlerde giriş yapılmış (Token) olmalı
router.use(verifyToken);

// Kasa Canlı Radar
router.get('/summary/live', orderController.getLiveSummary);

// --- Mutfak ---
// orderRoutes.js dosyanı şu hale getir (Yazım hatası yok, sadece 'Mutfak'):
router.get('/kitchen', authorizeRoles('Admin', 'Kasa', 'Garson', 'Mutfak'), orderController.getKitchenOrders);
router.get('/kitchen/history', authorizeRoles('Admin', 'Kasa', 'Garson', 'Mutfak'), orderController.getKitchenHistory);
router.post('/kitchen/:itemId/ready', authorizeRoles('Admin', 'Kasa', 'Garson', 'Mutfak'), orderController.markItemReady);
router.post('/kitchen/bulk-ready', authorizeRoles('Admin', 'Kasa', 'Garson', 'Mutfak'), orderController.markBulkReady);

// Masalar ve Siparişler
router.get('/table/:tableId', orderController.getActiveOrder);
router.post('/table/:tableId/add-item', orderController.addItem);

// İptal ve Ödeme
router.delete('/item/:itemId', authorizeRoles('Admin', 'Kasa', 'Garson', "Mutfak"), orderController.cancelItem);
router.post('/table/:tableId/discount', authorizeRoles('Admin', 'Kasa', 'Garson', "Mutfak"), orderController.applyDiscount);
router.post('/table/:tableId/pay', authorizeRoles('Admin', 'Kasa', 'Garson', "Mutfak"), orderController.payOrder);

router.post('/fast-sale', authorizeRoles('Admin', 'Kasa', 'Garson', "Mutfak"), orderController.handleFastSale);

module.exports = router;