const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

router.use(verifyToken, authorizeRoles('SuperAdmin'));
router.get('/', companyController.listCompanies);
router.post('/', companyController.createCompany);
router.patch('/:id', companyController.updateBrand);

module.exports = router;
