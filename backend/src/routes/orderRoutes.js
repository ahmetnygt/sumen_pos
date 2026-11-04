const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { verifyToken, authorizeRoles, requireBranch } = require('../middlewares/authMiddleware');

router.use(verifyToken, requireBranch);

const floor = authorizeRoles('Admin', 'Kasa', 'Garson');
const kitchen = authorizeRoles('Admin', 'Kasa', 'Mutfak');

router.get('/summary/live', authorizeRoles('Admin', 'Kasa'), orderController.getLiveSummary);
router.get('/mine/pending', floor, orderController.listMyPending);
router.get('/mine/today', floor, orderController.listMyToday);

router.get('/kitchen', kitchen, orderController.getKitchenOrders);
router.get('/kitchen/history', kitchen, orderController.getKitchenHistory);
router.post('/kitchen/:itemId/recall', kitchen, orderController.recallItem);
router.post('/kitchen/:itemId/ready', kitchen, orderController.markItemReady);
router.post('/kitchen/bulk-ready', kitchen, orderController.markBulkReady);

router.get('/table/:tableId', floor, orderController.getActiveOrder);
router.post('/table/:tableId/items', floor, orderController.addItems);
router.post('/table/:tableId/add-item', floor, orderController.addItem);

router.post('/items/:itemId/served', floor, orderController.markItemServed);
router.post('/items/cancel', floor, orderController.cancelItems);
router.delete('/item/:itemId', floor, orderController.cancelItem);
router.post('/table/:tableId/discount', floor, orderController.applyDiscount);
router.post('/table/:tableId/pay', floor, orderController.payOrder);

router.post('/fast-sale', floor, orderController.handleFastSale);

module.exports = router;
