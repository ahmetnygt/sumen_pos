const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

// Tüm stok ve reçete işlemlerini sadece Admin yapabilir
router.use(verifyToken, authorizeRoles('Admin'));

// Hammadde (Stok) Rotaları
router.get('/ingredients', inventoryController.getIngredients);
router.post('/ingredients', inventoryController.addIngredient);
router.put('/ingredients/:id', inventoryController.updateIngredient);
router.delete('/ingredients/:id', inventoryController.deleteIngredient);

// Reçete (Formül) Rotaları
router.get('/recipes/:productId', inventoryController.getProductRecipe);
router.post('/recipes', inventoryController.addRecipeItem);
router.delete('/recipes/:productId/:ingredientId', inventoryController.deleteRecipeItem);

module.exports = router;