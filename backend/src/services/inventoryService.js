const { Ingredient, Recipe, Product, ProductOption } = require('../models');

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
    const recipes = await Recipe.findAll({
        where: { product_id: productId },
        include: [
            { model: Ingredient, attributes: ['id', 'name', 'unit'] },
            { model: ProductOption, attributes: ['id', 'name'] }
        ]
    });
    
    // Frontend için jilet gibi listeye çeviriyoruz
    return recipes.map(r => ({
        recipe_id: r.id, 
        ingredient_id: r.Ingredient?.id,
        name: r.Ingredient?.name,
        unit: r.Ingredient?.unit,
        amount_used: r.amount_used,
        option_id: r.option_id,
        option_name: r.ProductOption ? r.ProductOption.name : null
    }));
};

exports.addIngredientToRecipe = async (data) => {
    // Opsiyon yoksa undefined yerine zorla null yapıyoruz ki SQL patlamasın
    const optionId = data.option_id ? parseInt(data.option_id) : null;

    const existing = await Recipe.findOne({
        where: { 
            product_id: data.product_id, 
            ingredient_id: data.ingredient_id,
            option_id: optionId
        }
    });
    
    if (existing) throw new Error('Bu hammadde bu seçenekte zaten var!');
    
    return await Recipe.create({
        product_id: data.product_id,
        ingredient_id: data.ingredient_id,
        option_id: optionId,
        amount_used: data.amount_used
    });
};

exports.removeIngredientFromRecipe = async (recipeId) => {
    return await Recipe.destroy({ where: { id: recipeId } });
};