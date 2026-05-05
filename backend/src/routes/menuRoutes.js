const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

// Menüyü herkes (Garson, Kasa, Admin) görebilir. Sadece token yeterli.
router.get('/', verifyToken, menuController.getMenu);

// DİKKAT: Kategori ve Ürün EKLEME/SİLME işlemlerini SADECE 'Admin' yapabilir!
router.post('/category', verifyToken, authorizeRoles('Admin'), menuController.addCategory);
router.delete('/category/:id', verifyToken, authorizeRoles('Admin'), menuController.deleteCategory);

router.post('/product', verifyToken, authorizeRoles('Admin'), menuController.addProduct);
router.put('/product/:id', verifyToken, authorizeRoles('Admin'), menuController.updateProduct);
router.delete('/product/:id', verifyToken, authorizeRoles('Admin'), menuController.deleteProduct);

router.post('/product/:productId/option', verifyToken, authorizeRoles('Admin'), menuController.addProductOption);
router.delete('/option/:optionId', verifyToken, authorizeRoles('Admin'), menuController.deleteProductOption);

module.exports = router;