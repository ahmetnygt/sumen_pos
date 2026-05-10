const { Category, Product, ProductOption,ProductOptionGroup } = require('../models');

// Tüm kategorileri ve içindeki aktif ürünleri getirir
exports.getFullMenu = async () => {
    return await Category.findAll({
        include: [{
            model: Product,
            where: { is_active: true },
            required: false,
            include: [
                {
                    model: ProductOptionGroup, // Artık seçenekleri değil, grupları çekiyoruz
                    required: false,
                    include: [{ 
                        model: ProductOption, // Grupların içindeki seçenekleri de içine gömüyoruz
                        required: false 
                    }]
                }
            ]
        }],
        order: [['id', 'ASC']]
    });
};
exports.createCategory = async (data) => {
    return await Category.create(data);
};

exports.deleteCategory = async (id) => {
    // Kategoriye ait ürün var mı kontrol et (Hata fırlat ki Controller yakalasın)
    const productCount = await Product.count({ where: { category_id: id } });
    if (productCount > 0) {
        throw new Error('Bu kategoride ürünler var! Önce ürünleri silmelisiniz.');
    }
    return await Category.destroy({ where: { id } });
};

exports.createProduct = async (data) => {
    return await Product.create(data);
};

exports.updateProduct = async (id, data) => {
    return await Product.update(data, { where: { id } });
};

exports.deleteProduct = async (id) => {
    return await Product.destroy({ where: { id } });
};