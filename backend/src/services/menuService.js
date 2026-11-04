const { Op } = require('sequelize');
const { Category, Product, ProductOption, ProductOptionGroup, Recipe, Ingredient, BranchStock, OrderItem } = require('../models');

// Tüm kategorileri ve içindeki aktif ürünleri getirir
exports.getFullMenu = async (companyId) => {
    return await Category.findAll({
        where: { company_id: companyId },
        include: [{
            model: Product,
            where: { is_active: true, company_id: companyId },
            required: false,
            include: [
                {
                    model: ProductOptionGroup,
                    required: false,
                    include: [{
                        model: ProductOption,
                        required: false
                    }]
                }
            ]
        }],
        order: [['id', 'ASC']]
    });
};
function shortageFor(recipes, stockByIngredient) {
    const shortages = [];
    for (const recipe of recipes) {
        const need = Number(recipe.amount_used);
        const have = stockByIngredient.get(recipe.ingredient_id) ?? 0;
        if (need > have + 0.001) {
            shortages.push({
                name: recipe.Ingredient?.name || 'Hammadde',
                unit: recipe.Ingredient?.unit || '',
                need,
                have
            });
        }
    }
    return shortages;
}

exports.getAvailability = async (companyId, branchId) => {
    const [recipes, stocks] = await Promise.all([
        Recipe.findAll({ include: [{ model: Ingredient, attributes: ['id', 'name', 'unit'] }] }),
        BranchStock.findAll({ where: { branch_id: branchId } })
    ]);
    const stockByIngredient = new Map(stocks.map(row => [row.ingredient_id, Number(row.stock_amount)]));
    const products = {};
    const options = {};

    const productRecipes = new Map();
    for (const recipe of recipes) {
        if (recipe.option_id) {
            const list = options[recipe.option_id] || [];
            list.push(recipe);
            options[recipe.option_id] = list;
        } else if (recipe.product_id) {
            const list = productRecipes.get(recipe.product_id) || [];
            list.push(recipe);
            productRecipes.set(recipe.product_id, list);
        }
    }

    const catalog = await Product.findAll({
        where: { company_id: companyId, is_active: true },
        attributes: ['id']
    });
    const visible = {};
    for (const product of catalog) {
        const shortages = shortageFor(productRecipes.get(product.id) || [], stockByIngredient);
        if (shortages.length) visible[product.id] = shortages;
    }
    const visibleOptions = {};
    for (const [optionId, optionRecipes] of Object.entries(options)) {
        const shortages = shortageFor(optionRecipes, stockByIngredient);
        if (shortages.length) visibleOptions[optionId] = shortages;
    }
    return { products: visible, options: visibleOptions };
};

exports.createCategory = async (data) => {
    return await Category.create(data);
};

exports.deleteCategory = async (id, companyId) => {
    const category = await Category.findOne({ where: { id, company_id: companyId } });
    if (!category) throw new Error('Kategori bulunamadı.');
    const productCount = await Product.count({ where: { category_id: id, company_id: companyId } });
    if (productCount > 0) {
        throw new Error('Bu kategoride ürünler var! Önce ürünleri silmelisiniz.');
    }
    return await category.destroy();
};

exports.createProduct = async (data) => {
    return await Product.create(data);
};

exports.updateProduct = async (id, data, companyId) => {
    return await Product.update(data, { where: { id, company_id: companyId } });
};

exports.deleteProduct = async (id, companyId) => {
    const product = await Product.findOne({ where: { id, company_id: companyId } });
    if (!product) throw new Error('Ürün bulunamadı.');

    const openCount = await OrderItem.count({
        where: { product_id: id, status: { [Op.in]: ['Siparişte', 'Hazır'] } }
    });
    if (openCount > 0) throw new Error('Açık satışı olan ürün silinemez.');

    const saleCount = await OrderItem.count({ where: { product_id: id } });
    if (saleCount > 0) {
        await product.update({ is_active: false });
        return { deactivated: true };
    }

    await Recipe.destroy({ where: { product_id: id } });
    const groups = await ProductOptionGroup.findAll({ where: { product_id: id } });
    const groupIds = groups.map(group => group.id);
    if (groupIds.length) {
        const options = await ProductOption.findAll({ where: { option_group_id: groupIds } });
        const optionIds = options.map(option => option.id);
        if (optionIds.length) await Recipe.destroy({ where: { option_id: optionIds } });
        await ProductOption.destroy({ where: { option_group_id: groupIds } });
        await ProductOptionGroup.destroy({ where: { id: groupIds } });
    }
    await product.destroy();
    return { deleted: true };
};