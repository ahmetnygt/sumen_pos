const inventoryService = require('../services/inventoryService');

// --- HAMMADDE UÇLARI ---
exports.getIngredients = async (req, res) => {
    try {
        const ingredients = await inventoryService.getAllIngredients();
        res.status(200).json(ingredients);
    } catch (error) {
        res.status(500).json({ message: 'Stoklar getirilemedi.', error: error.message });
    }
};

exports.addIngredient = async (req, res) => {
    try {
        const ingredient = await inventoryService.createIngredient(req.body);
        res.status(201).json(ingredient);
    } catch (error) {
        res.status(400).json({ message: 'Hammadde eklenemedi.', error: error.message });
    }
};

exports.updateIngredient = async (req, res) => {
    try {
        await inventoryService.updateIngredient(req.params.id, req.body);
        res.status(200).json({ message: 'Hammadde güncellendi.' });
    } catch (error) {
        res.status(400).json({ message: 'Güncelleme başarısız.', error: error.message });
    }
};

exports.deleteIngredient = async (req, res) => {
    try {
        await inventoryService.deleteIngredient(req.params.id);
        res.status(200).json({ message: 'Hammadde silindi.' });
    } catch (error) {
        res.status(400).json({ message: error.message }); // "Formülde kullanılıyor" hatası buraya düşecek
    }
};

// --- REÇETE UÇLARI ---
exports.getProductRecipe = async (req, res) => {
    try {
        const recipe = await inventoryService.getRecipeByProduct(req.params.productId);
        res.status(200).json(recipe);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
};

exports.addRecipeItem = async (req, res) => {
    try {
        const recipeItem = await inventoryService.addIngredientToRecipe(req.body);
        res.status(201).json(recipeItem);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.deleteRecipeItem = async (req, res) => {
    try {
        await inventoryService.removeIngredientFromRecipe(req.params.productId, req.params.ingredientId);
        res.status(200).json({ message: 'Hammadde formülden çıkarıldı.' });
    } catch (error) {
        res.status(400).json({ message: 'Silme başarısız.', error: error.message });
    }
};