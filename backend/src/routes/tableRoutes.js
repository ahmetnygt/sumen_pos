const express = require('express');
const router = express.Router();
const tableController = require('../controllers/tableController');
const { verifyToken } = require('../middlewares/authMiddleware');

router.get('/', verifyToken, tableController.getAllTables);

module.exports = router;