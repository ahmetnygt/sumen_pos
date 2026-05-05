const inventoryService = require('../services/inventoryService');
const { Ingredient, Product } = require('../models');

exports.getAll = async (req, res) => {
    try {
        const ingredients = await inventoryService.getAllIngredients();
        res.status(200).json(ingredients);
    } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.create = async (req, res) => {
    try {
        const ingredient = await inventoryService.createIngredient(req.body);
        res.status(201).json(ingredient);
    } catch (error) { res.status(400).json({ message: error.message }); }
};

exports.update = async (req, res) => {
    try {
        const ingredient = await inventoryService.updateIngredient(req.params.id, req.body);
        res.status(200).json(ingredient);
    } catch (error) { res.status(400).json({ message: error.message }); }
};

exports.delete = async (req, res) => {
    try {
        await inventoryService.deleteIngredient(req.params.id);
        res.status(200).json({ message: 'Hammadde silindi.' });
    } catch (error) { res.status(400).json({ message: error.message }); }
};

// --- REÇETE MOTORU (Seçenek/Opsiyon Uyumlu) ---

exports.getProductRecipe = async (req, res) => {
    try {
        const recipes = await inventoryService.getRecipeByProduct(req.params.productId);
        res.status(200).json(recipes);
    } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.addIngredientToRecipe = async (req, res) => {
    try {
        await inventoryService.addIngredientToRecipe(req.body);
        res.status(200).json({ message: 'Reçete güncellendi.' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.removeIngredientFromRecipe = async (req, res) => {
    try {
        // Artık reçetenin benzersiz ID'sini yolluyoruz
        await inventoryService.removeIngredientFromRecipe(req.params.recipeId);
        res.status(200).json({ message: 'Hammadde reçeteden çıkarıldı.' });
    } catch (error) { res.status(400).json({ message: error.message }); }
};