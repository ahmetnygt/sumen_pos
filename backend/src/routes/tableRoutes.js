const express = require('express');
const router = express.Router();
const tableController = require('../controllers/tableController');
const { verifyToken, authorizeRoles, requireBranch, requireCompany } = require('../middlewares/authMiddleware');

router.get('/salons/company', verifyToken, authorizeRoles('Admin'), requireCompany, tableController.listCompanySalons);
router.get('/salons', verifyToken, authorizeRoles('Admin', 'Kasa', 'Garson'), requireBranch, tableController.listSalons);
router.post('/salons', verifyToken, authorizeRoles('Admin'), requireCompany, tableController.createSalon);
router.put('/salons/:id', verifyToken, authorizeRoles('Admin'), requireCompany, tableController.renameSalon);
router.delete('/salons/:id', verifyToken, authorizeRoles('Admin'), requireCompany, tableController.deleteSalon);
router.get('/', verifyToken, authorizeRoles('Admin', 'Kasa', 'Garson'), requireBranch, tableController.getAllTables);
router.get('/decorations/company', verifyToken, authorizeRoles('Admin'), requireCompany, tableController.listCompanyDecorations);
router.get('/decorations', verifyToken, authorizeRoles('Admin', 'Kasa', 'Garson'), requireBranch, tableController.listDecorations);
router.get('/company', verifyToken, authorizeRoles('Admin'), requireCompany, tableController.listCompanyTables);
router.post('/', verifyToken, authorizeRoles('Admin'), requireCompany, tableController.createTable);
router.put('/layout', verifyToken, authorizeRoles('Admin'), requireCompany, tableController.saveLayout);
router.put('/:id', verifyToken, authorizeRoles('Admin'), requireCompany, tableController.renameTable);
router.delete('/:id', verifyToken, authorizeRoles('Admin'), requireCompany, tableController.deleteTable);

module.exports = router;
