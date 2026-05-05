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

    // Frontend'in kolay okuyabilmesi için veriyi jilet gibi düzeltiyoruz
    return recipes.map(r => ({
        recipe_id: r.id, // BÜYÜ BURADA: Silme işlemi için artık bu eşsiz ID'yi kullanacağız!
        ingredient_id: r.Ingredient?.id,
        name: r.Ingredient?.name,
        unit: r.Ingredient?.unit,
        amount_used: r.amount_used,
        option_id: r.option_id,
        option_name: r.ProductOption ? r.ProductOption.name : null
    }));
};

exports.addIngredientToRecipe = async (data) => {
    // Undefined veya boş string gelirse zorla null yap (400 hatasının kesin çözümü)
    const optionId = data.option_id ? parseInt(data.option_id) : null;

    const existing = await Recipe.findOne({
        where: {
            product_id: data.product_id,
            ingredient_id: data.ingredient_id,
            option_id: optionId
        }
    });

    if (existing) throw new Error('Bu hammadde bu reçeteye zaten eklenmiş!');

    return await Recipe.create({
        product_id: data.product_id,
        ingredient_id: data.ingredient_id,
        option_id: optionId,
        amount_used: data.amount_used
    });
};

exports.removeIngredientFromRecipe = async (recipeId) => {
    // Artık ürün+hammadde'ye göre değil, doğrudan o satırın Eşsiz ID'sine göre siliyoruz
    return await Recipe.destroy({ where: { id: recipeId } });
};