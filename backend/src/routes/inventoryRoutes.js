const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

// Tüm stok ve reçete işlemlerini sadece Admin yapabilir
router.use(verifyToken, authorizeRoles('Admin'));

// Hammadde (Stok) Rotaları
router.get('/ingredients', inventoryController.getAll);
router.post('/ingredients', inventoryController.create);
router.put('/ingredients/:id', inventoryController.update);
router.delete('/ingredients/:id', inventoryController.delete);

// Reçete (Formül) Rotaları
router.get('/recipes/:productId', inventoryController.getProductRecipe);
router.post('/recipes', inventoryController.addIngredientToRecipe);
router.delete('/recipes/:recipeId', inventoryController.removeIngredientFromRecipe);

module.exports = router;