const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');
const { verifyToken, authorizeRoles, requireCompany } = require('../middlewares/authMiddleware');

router.use(verifyToken, requireCompany);

router.get('/', menuController.getMenu);
router.get('/availability', menuController.getAvailability);

// DİKKAT: Kategori ve Ürün EKLEME/SİLME işlemlerini SADECE 'Admin' yapabilir!
router.post('/category', authorizeRoles('Admin'), menuController.addCategory);
router.put('/category/:id', authorizeRoles('Admin'), menuController.updateCategory);
router.delete('/category/:id', authorizeRoles('Admin'), menuController.deleteCategory);

router.post('/product', authorizeRoles('Admin'), menuController.addProduct);
router.put('/product/:id', authorizeRoles('Admin'), menuController.updateProduct);
router.delete('/product/:id', authorizeRoles('Admin'), menuController.deleteProduct);

router.post('/product/:productId/option', authorizeRoles('Admin'), menuController.addProductOption);
router.delete('/option/:optionId', authorizeRoles('Admin'), menuController.deleteProductOption);

router.post('/product/:productId/group', authorizeRoles('Admin'), menuController.addProductGroup);
router.delete('/group/:groupId', authorizeRoles('Admin'), menuController.deleteProductGroup);
router.post('/group/:groupId/option', authorizeRoles('Admin'), menuController.addOptionToGroup);

module.exports = router;