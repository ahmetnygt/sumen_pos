const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { verifyToken, authorizeRoles, requireCompany, requireBranch } = require('../middlewares/authMiddleware');

router.use(verifyToken, authorizeRoles('Admin'), requireCompany, requireBranch);

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