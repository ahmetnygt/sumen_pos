const menuService = require('../services/menuService');

exports.getMenu = async (req, res) => {
    try {
        const menu = await menuService.getFullMenu();
        res.status(200).json(menu);
    } catch (error) {
        res.status(500).json({ message: 'Menü yüklenemedi.', error: error.message });
    }
};

exports.addCategory = async (req, res) => {
    try {
        const category = await menuService.createCategory(req.body);
        res.status(201).json(category);
    } catch (error) {
        res.status(400).json({ message: 'Kategori eklenemedi.', error: error.message });
    }
};

exports.deleteCategory = async (req, res) => {
    try {
        await menuService.deleteCategory(req.params.id);
        res.status(200).json({ message: 'Kategori başarıyla silindi.' });
    } catch (error) {
        // Servisten fırlattığımız "içinde ürün var" hatasını burada yakalayıp 400 dönüyoruz
        res.status(400).json({ message: error.message });
    }
};

exports.addProduct = async (req, res) => {
    try {
        const product = await menuService.createProduct(req.body);
        res.status(201).json(product);
    } catch (error) {
        res.status(400).json({ message: 'Ürün eklenemedi.', error: error.message });
    }
};

exports.updateProduct = async (req, res) => {
    try {
        await menuService.updateProduct(req.params.id, req.body);
        res.status(200).json({ message: 'Ürün güncellendi.' });
    } catch (error) {
        res.status(400).json({ message: 'Ürün güncellenemedi.', error: error.message });
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        await menuService.deleteProduct(req.params.id);
        res.status(200).json({ message: 'Ürün silindi.' });
    } catch (error) {
        res.status(400).json({ message: 'Ürün silinemedi.', error: error.message });
    }
};

// Ürüne yeni seçenek (Duble, Enerji vs) ekleme
exports.addProductOption = async (req, res) => {
    try {
        const { productId } = req.params;
        const { name, price_diff } = req.body;
        const option = await ProductOption.create({ product_id: productId, name, price_diff });
        res.status(201).json(option);
    } catch (error) {
        res.status(400).json({ message: 'Opsiyon eklenemedi.', error: error.message });
    }
};

// Seçenek silme
exports.deleteProductOption = async (req, res) => {
    try {
        await ProductOption.destroy({ where: { id: req.params.optionId } });
        res.status(200).json({ message: 'Opsiyon silindi.' });
    } catch (error) {
        res.status(400).json({ message: 'Opsiyon silinemedi.' });
    }
};