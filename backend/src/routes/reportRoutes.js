const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { verifyToken, authorizeRoles, requireBranch } = require('../middlewares/authMiddleware');

router.get('/sales', verifyToken, authorizeRoles('Admin', 'Kasa'), requireBranch, reportController.getSalesReport);

module.exports = router;