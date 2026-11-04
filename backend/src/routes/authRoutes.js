const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Çok fazla giriş denemesi. Bir süre sonra tekrar deneyin.' }
});

router.post('/login', loginLimiter, authController.login);
router.post('/select-branch', verifyToken, authorizeRoles('Admin'), authController.selectBranch);

module.exports = router;
