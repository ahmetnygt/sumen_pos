const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const menuRoutes = require('./menuRoutes');
const inventoryRoutes = require('./inventoryRoutes');
const orderRoutes = require('./orderRoutes');
const tableRoutes = require('./tableRoutes'); // Yeni ekledik
const reportRoutes = require('./reportRoutes'); // Yeni ekledik

router.use('/auth', authRoutes);
router.use('/menu', menuRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/orders', orderRoutes);
router.use('/tables', tableRoutes); // Yeni ekledik
router.use('/reports', reportRoutes); // Yeni ekledik

module.exports = router;