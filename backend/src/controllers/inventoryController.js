const inventoryService = require('../services/inventoryService');
const { Ingredient, Product } = require('../models');

exports.getAll = async (req, res) => {
    try {
        const ingredients = await inventoryService.getAllIngredients(req.user.company_id, req.user.branch_id);
        res.status(200).json(ingredients);
    } catch (error) {
        console.error('Hammaddeler alınamadı:', error);
        res.status(500).json({ message: 'Hammaddeler alınamadı.' });
    }
};

exports.create = async (req, res) => {
    try {
        const ingredient = await inventoryService.createIngredient(
            { ...req.body, company_id: req.user.company_id },
            req.user.branch_id
        );
        res.status(201).json(ingredient);
    } catch (error) { res.status(400).json({ message: error.message }); }
};

exports.update = async (req, res) => {
    try {
        const ingredient = await inventoryService.updateIngredient(req.params.id, req.body, req.user.company_id, req.user.branch_id);
        res.status(200).json(ingredient);
    } catch (error) { res.status(400).json({ message: error.message }); }
};

exports.delete = async (req, res) => {
    try {
        await inventoryService.deleteIngredient(req.params.id, req.user.company_id);
        res.status(200).json({ message: 'Hammadde silindi.' });
    } catch (error) { res.status(400).json({ message: error.message }); }
};

// --- REÇETE MOTORU (Seçenek/Opsiyon Uyumlu) ---

exports.getProductRecipe = async (req, res) => {
    try {
        const recipes = await inventoryService.getRecipeByProduct(req.params.productId, req.user.company_id);
        res.status(200).json(recipes);
    } catch (error) {
        console.error('Reçete alınamadı:', error);
        res.status(500).json({ message: 'Reçete alınamadı.' });
    }
};

exports.addIngredientToRecipe = async (req, res) => {
    try {
        await inventoryService.addIngredientToRecipe(req.body, req.user.company_id);
        res.status(200).json({ message: 'Reçete güncellendi.' });
    } catch (error) { 
        // BÜYÜ BURADA: Hatayı terminale kırmızı kırmızı yazdıracak!
        console.error("\n❌❌ REÇETE EKLEME HATASI:", error.message, "\n");
        res.status(400).json({ message: error.message }); 
    }
};

exports.removeIngredientFromRecipe = async (req, res) => {
    try {
        // Artık benzersiz recipeId ile siliyoruz
        await inventoryService.removeIngredientFromRecipe(req.params.recipeId, req.user.company_id);
        res.status(200).json({ message: 'Hammadde reçeteden çıkarıldı.' });
    } catch (error) { res.status(400).json({ message: error.message }); }
};