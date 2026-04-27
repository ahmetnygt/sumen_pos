const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

router.use(verifyToken);

router.get('/summary/live', orderController.getLiveSummary);

router.get('/table/:tableId', orderController.getActiveOrder);
router.post('/table/:tableId/add-item', orderController.addItem);

// YENİ ROTALAR:
router.delete('/item/:itemId', authorizeRoles('Admin', 'Kasa'), orderController.cancelItem); // İptali sadece yetkililer yapar
router.post('/table/:tableId/discount', authorizeRoles('Admin', 'Kasa'), orderController.applyDiscount); // İndirim patron/kasa işi

router.post('/table/:tableId/pay', authorizeRoles('Admin', 'Kasa'), orderController.payOrder);

module.exports = router;