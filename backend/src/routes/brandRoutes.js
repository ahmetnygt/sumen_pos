const express = require('express');
const rateLimit = require('express-rate-limit');
const brandController = require('../controllers/brandController');

const router = express.Router();

const brandLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Çok fazla istek. Biraz sonra tekrar deneyin.' }
});

router.get('/:code', brandLimiter, brandController.getBrand);

module.exports = router;
