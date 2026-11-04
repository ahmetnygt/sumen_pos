const express = require('express');
const router = express.Router();
const reservationController = require('../controllers/reservationController');
const { verifyToken, authorizeRoles, requireBranch } = require('../middlewares/authMiddleware');

router.get('/', verifyToken, authorizeRoles('Admin', 'Kasa', 'Garson'), requireBranch, reservationController.listReservations);
router.post('/', verifyToken, authorizeRoles('Admin', 'Kasa'), requireBranch, reservationController.createReservation);
router.patch('/:id', verifyToken, authorizeRoles('Admin', 'Kasa', 'Garson'), requireBranch, reservationController.updateReservationStatus);

module.exports = router;
