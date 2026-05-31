const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

// Sadece Admin ve Kasa rapor görebilir
router.get('/sales', verifyToken, authorizeRoles('Admin', 'Kasa'), reportController.getSalesReport);

module.exports = router;