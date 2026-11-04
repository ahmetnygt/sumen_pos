const express = require('express');
const router = express.Router();
const shiftController = require('../controllers/shiftController');
const { verifyToken, authorizeRoles, requireBranch } = require('../middlewares/authMiddleware');

router.use(verifyToken, authorizeRoles('Admin', 'Kasa'), requireBranch);
router.get('/current', shiftController.current);
router.post('/open', shiftController.open);
router.post('/close', shiftController.close);

module.exports = router;
