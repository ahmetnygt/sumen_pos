const menuService = require('../services/menuService');
const { ProductOption,ProductOptionGroup } = require('../models');

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

// Gruba yeni seçenek ekleme (UX odaklı yeni ucumuz)
exports.addOptionToGroup = async (req, res) => {
    try {
        const { groupId } = req.params;
        const { name, price_diff } = req.body;
        const option = await ProductOption.create({ option_group_id: groupId, name, price_diff });
        res.status(201).json(option);
    } catch (error) { res.status(400).json({ message: 'Seçenek eklenemedi.' }); }
};

// Grubu Komple Silme
exports.deleteProductGroup = async (req, res) => {
    try {
        const { ProductOptionGroup } = require('../models');
        await ProductOptionGroup.destroy({ where: { id: req.params.groupId } });
        res.status(200).json({ message: 'Grup ve içindeki seçenekler silindi.' });
    } catch (error) {
        res.status(400).json({ message: 'Grup silinemedi.' });
    }
};

// Sadece tek bir seçeneği silme (Eskisini buna güncelleyelim garanti olsun)
exports.deleteProductOption = async (req, res) => {
    try {
        const { ProductOption } = require('../models');
        await ProductOption.destroy({ where: { id: req.params.optionId } });
        res.status(200).json({ message: 'Opsiyon silindi.' });
    } catch (error) {
        res.status(400).json({ message: 'Opsiyon silinemedi.' });
    }
};

// Ürüne grup ekleme
exports.addProductGroup = async (req, res) => {
    try {
        const { productId } = req.params;
        const { name, type } = req.body;
        const group = await ProductOptionGroup.create({ product_id: productId, name, type });
        res.status(201).json(group);
    } catch (error) { res.status(400).json({ message: 'Grup oluşturulamadı.' }); }
};

// Ürüne yeni seçenek (Duble, Enerji vs) ekleme
exports.addProductOption = async (req, res) => {
    try {
        const { productId } = req.params;
        // option_type'ı frontend'den alıyoruz
        const { name, price_diff, option_type } = req.body;

        const option = await ProductOption.create({
            product_id: productId,
            name,
            price_diff,
            option_type: option_type || 'ekstra' // Varsayılan ekstra olsun
        });
        res.status(201).json(option);
    } catch (error) {
        res.status(400).json({ message: 'Opsiyon eklenemedi.', error: error.message });
    }
};
