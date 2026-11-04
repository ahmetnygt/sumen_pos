const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const menuRoutes = require('./menuRoutes');
const inventoryRoutes = require('./inventoryRoutes');
const orderRoutes = require('./orderRoutes');
const tableRoutes = require('./tableRoutes'); // Yeni ekledik
const reportRoutes = require('./reportRoutes'); // Yeni ekledik
const userRoutes = require('./userRoutes');
const companyRoutes = require('./companyRoutes');
const brandRoutes = require('./brandRoutes');
const branchRoutes = require('./branchRoutes');
const shiftRoutes = require('./shiftRoutes');
const reservationRoutes = require('./reservationRoutes');

router.use('/auth', authRoutes);
router.use('/menu', menuRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/orders', orderRoutes);
router.use('/tables', tableRoutes);
router.use('/reports', reportRoutes);
router.use('/users', userRoutes);
router.use('/brand', brandRoutes);
router.use('/companies', companyRoutes);
router.use('/branches', branchRoutes);
router.use('/shifts', shiftRoutes);
router.use('/reservations', reservationRoutes);

module.exports = router;