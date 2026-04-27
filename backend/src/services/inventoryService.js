const { Ingredient, Recipe, Product } = require('../models');

// --- HAMMADDE (STOK) YÖNETİMİ ---
exports.getAllIngredients = async () => {
    return await Ingredient.findAll({ order: [['name', 'ASC']] });
};

exports.createIngredient = async (data) => {
    return await Ingredient.create(data);
};

exports.updateIngredient = async (id, data) => {
    return await Ingredient.update(data, { where: { id } });
};

exports.deleteIngredient = async (id) => {
    // Reçetelerde kullanılıyorsa silinmesini engelle
    const recipeCount = await Recipe.count({ where: { ingredient_id: id } });
    if (recipeCount > 0) {
        throw new Error('Bu hammadde bazı ürünlerin formülünde kullanılıyor! Önce formüllerden çıkarın.');
    }
    return await Ingredient.destroy({ where: { id } });
};

// --- REÇETE (FORMÜL) YÖNETİMİ ---
exports.getRecipeByProduct = async (productId) => {
    const product = await Product.findByPk(productId, {
        include: [{
            model: Ingredient,
            through: { attributes: ['amount_used'] } // Sadece kullanılan miktarı getir
        }]
    });
    if (!product) throw new Error('Ürün bulunamadı.');
    return product;
};

exports.addIngredientToRecipe = async (data) => {
    // Aynı hammadde zaten formülde varsa hata fırlat
    const existing = await Recipe.findOne({
        where: { product_id: data.product_id, ingredient_id: data.ingredient_id }
    });
    if (existing) throw new Error('Bu hammadde zaten formülde var!');
    
    return await Recipe.create(data);
};

exports.removeIngredientFromRecipe = async (productId, ingredientId) => {
    return await Recipe.destroy({
        where: { product_id: productId, ingredient_id: ingredientId }
    });
};