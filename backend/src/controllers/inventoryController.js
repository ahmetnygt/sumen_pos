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

// REÇETE MOTORU (Product - Ingredient Bağı)
exports.getProductRecipe = async (req, res) => {
    try {
        const product = await Product.findByPk(req.params.productId, {
            include: [{ model: Ingredient, through: { attributes: ['amount_used'] } }]
        });
        res.status(200).json(product?.Ingredients || []);
    } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.addIngredientToRecipe = async (req, res) => {
    try {
        const { product_id, ingredient_id, amount_used } = req.body;
        const product = await Product.findByPk(product_id);
        if (!product) throw new Error('Ürün bulunamadı.');

        await product.addIngredient(ingredient_id, { through: { amount_used } });
        res.status(200).json({ message: 'Reçete güncellendi.' });
    } catch (error) { res.status(400).json({ message: error.message }); }
};

exports.removeIngredientFromRecipe = async (req, res) => {
    try {
        const product = await Product.findByPk(req.params.productId);
        await product.removeIngredient(req.params.ingredientId);
        res.status(200).json({ message: 'Hammadde reçeteden çıkarıldı.' });
    } catch (error) { res.status(400).json({ message: error.message }); }
};