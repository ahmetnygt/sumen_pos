const { Ingredient, Recipe, Product, ProductOption, BranchStock } = require('../models');

exports.getAllIngredients = async (companyId, branchId) => {
    const ingredients = await Ingredient.findAll({
        where: { company_id: companyId },
        order: [['name', 'ASC']]
    });
    const stocks = await BranchStock.findAll({ where: { branch_id: branchId } });
    const byIngredient = new Map(stocks.map(s => [s.ingredient_id, parseFloat(s.stock_amount)]));
    return ingredients.map(ing => {
        const json = ing.toJSON();
        json.stock_amount = byIngredient.has(ing.id) ? byIngredient.get(ing.id) : 0;
        return json;
    });
};

exports.createIngredient = async (data, branchId) => {
    const { stock_amount, ...catalog } = data;
    delete catalog.stock_amount;
    const ingredient = await Ingredient.create(catalog);
    await BranchStock.create({
        branch_id: branchId,
        ingredient_id: ingredient.id,
        stock_amount: stock_amount || 0
    });
    return { ...ingredient.toJSON(), stock_amount: parseFloat(stock_amount || 0) };
};

exports.updateIngredient = async (id, data, companyId, branchId) => {
    const ingredient = await Ingredient.findOne({ where: { id, company_id: companyId } });
    if (!ingredient) throw new Error('Hammadde bulunamadı.');

    const { stock_amount, ...catalog } = data;
    delete catalog.stock_amount;
    await ingredient.update(catalog);
    if (stock_amount !== undefined) {
        const [row] = await BranchStock.findOrCreate({
            where: { branch_id: branchId, ingredient_id: ingredient.id },
            defaults: { stock_amount: 0 }
        });
        await row.update({ stock_amount });
    }
    const row = await BranchStock.findOne({ where: { branch_id: branchId, ingredient_id: ingredient.id } });
    return { ...ingredient.toJSON(), stock_amount: row ? parseFloat(row.stock_amount) : 0 };
};

exports.deleteIngredient = async (id, companyId) => {
    const ingredient = await Ingredient.findOne({ where: { id, company_id: companyId } });
    if (!ingredient) throw new Error('Hammadde bulunamadı.');
    const recipeCount = await Recipe.count({ where: { ingredient_id: id } });
    if (recipeCount > 0) {
        throw new Error('Bu hammadde bazı ürünlerin formülünde kullanılıyor! Önce formüllerden çıkarın.');
    }
    await BranchStock.destroy({ where: { ingredient_id: id } });
    return await ingredient.destroy();
};

exports.getRecipeByProduct = async (productId, companyId) => {
    const product = await Product.findOne({ where: { id: productId, company_id: companyId } });
    if (!product) throw new Error('Ürün bulunamadı.');

    const recipes = await Recipe.findAll({
        where: { product_id: productId },
        include: [
            { model: Ingredient, attributes: ['id', 'name', 'unit'] },
            { model: ProductOption, attributes: ['id', 'name'] }
        ]
    });

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

exports.addIngredientToRecipe = async (data, companyId) => {
    const product = await Product.findOne({ where: { id: data.product_id, company_id: companyId } });
    const ingredient = await Ingredient.findOne({ where: { id: data.ingredient_id, company_id: companyId } });
    if (!product || !ingredient) throw new Error('Ürün veya hammadde bu firmaya ait değil.');

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

exports.removeIngredientFromRecipe = async (recipeId, companyId) => {
    const recipe = await Recipe.findByPk(recipeId, { include: [Product] });
    if (!recipe || recipe.Product?.company_id !== companyId) throw new Error('Reçete bulunamadı.');
    return await recipe.destroy();
};
