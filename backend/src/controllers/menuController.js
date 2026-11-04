const menuService = require('../services/menuService');
const { Product, ProductOption, ProductOptionGroup, Category } = require('../models');
const { cleanIcon, cleanPhoto } = require('../utils/menuMedia');

const ownProduct = (id, companyId) => Product.findOne({ where: { id, company_id: companyId } });

exports.getAvailability = async (req, res) => {
    try {
        if (!req.user.branch_id) return res.status(403).json({ message: 'Bu işlem için bir şube seçmelisiniz.' });
        const availability = await menuService.getAvailability(req.user.company_id, req.user.branch_id);
        res.status(200).json(availability);
    } catch (error) {
        console.error('Stok durumu alınamadı:', error);
        res.status(500).json({ message: 'Stok durumu alınamadı.' });
    }
};

exports.getMenu = async (req, res) => {
    try {
        const menu = await menuService.getFullMenu(req.user.company_id);
        res.status(200).json(menu);
    } catch (error) {
        console.error('Menü yüklenemedi:', error);
        res.status(500).json({ message: 'Menü yüklenemedi.' });
    }
};

exports.addCategory = async (req, res) => {
    try {
        const name = String(req.body.name || '').trim();
        if (!name) return res.status(400).json({ message: 'Kategori adı zorunludur.' });
        const icon = cleanIcon(req.body.icon);
        if (icon === false) return res.status(400).json({ message: 'İkon bulunamadı.' });
        const category = await menuService.createCategory({
            name,
            icon,
            company_id: req.user.company_id
        });
        res.status(201).json(category);
    } catch (error) {
        console.error('Kategori eklenemedi:', error);
        res.status(400).json({ message: 'Kategori eklenemedi.' });
    }
};

exports.updateCategory = async (req, res) => {
    try {
        const category = await Category.findOne({
            where: { id: req.params.id, company_id: req.user.company_id }
        });
        if (!category) return res.status(404).json({ message: 'Kategori bulunamadı.' });

        const patch = {};
        if (req.body.name !== undefined) {
            const name = String(req.body.name || '').trim();
            if (!name) return res.status(400).json({ message: 'Kategori adı zorunludur.' });
            patch.name = name;
        }
        if (req.body.icon !== undefined) {
            const icon = cleanIcon(req.body.icon);
            if (icon === false) return res.status(400).json({ message: 'İkon bulunamadı.' });
            patch.icon = icon;
        }
        if (!Object.keys(patch).length) {
            return res.status(400).json({ message: 'Güncellenecek alan yok.' });
        }
        await category.update(patch);
        res.status(200).json({ message: 'Kategori güncellendi.', category });
    } catch (error) {
        console.error('Kategori güncellenemedi:', error);
        res.status(400).json({ message: 'Kategori güncellenemedi.' });
    }
};

exports.deleteCategory = async (req, res) => {
    try {
        await menuService.deleteCategory(req.params.id, req.user.company_id);
        res.status(200).json({ message: 'Kategori başarıyla silindi.' });
    } catch (error) {
        // Servisten fırlattığımız "içinde ürün var" hatasını burada yakalayıp 400 dönüyoruz
        res.status(400).json({ message: error.message });
    }
};

exports.addProduct = async (req, res) => {
    try {
        const name = String(req.body.name || '').trim();
        if (!name) return res.status(400).json({ message: 'Ürün adı zorunludur.' });
        const data = {
            name,
            price: req.body.price,
            instructions: req.body.instructions || null,
            category_id: req.body.category_id,
            company_id: req.user.company_id,
            is_active: true
        };
        if (req.body.photo !== undefined) {
            const photo = cleanPhoto(req.body.photo);
            if (photo === false) return res.status(400).json({ message: 'Fotoğraf JPEG olmalı ve 180 KB sınırını aşmamalı.' });
            data.photo = photo;
        }
        const product = await menuService.createProduct(data);
        res.status(201).json(product);
    } catch (error) {
        console.error('Ürün eklenemedi:', error);
        res.status(400).json({ message: 'Ürün eklenemedi.' });
    }
};

exports.updateProduct = async (req, res) => {
    try {
        const allowed = ['name', 'price', 'is_active', 'instructions', 'category_id'];
        const data = {};
        for (const key of allowed) {
            if (req.body[key] !== undefined) data[key] = req.body[key];
        }
        if (req.body.photo !== undefined) {
            const photo = cleanPhoto(req.body.photo);
            if (photo === false) return res.status(400).json({ message: 'Fotoğraf JPEG olmalı ve 180 KB sınırını aşmamalı.' });
            data.photo = photo;
        }
        await menuService.updateProduct(req.params.id, data, req.user.company_id);
        res.status(200).json({ message: 'Ürün güncellendi.' });
    } catch (error) {
        console.error('Ürün güncellenemedi:', error);
        res.status(400).json({ message: 'Ürün güncellenemedi.' });
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        await menuService.deleteProduct(req.params.id, req.user.company_id);
        res.status(200).json({ message: 'Ürün silindi.' });
    } catch (error) {
        console.error('Ürün silinemedi:', error);
        res.status(400).json({ message: 'Ürün silinemedi.' });
    }
};

// Gruba yeni seçenek ekleme (UX odaklı yeni ucumuz)
exports.addOptionToGroup = async (req, res) => {
    try {
        const group = await ProductOptionGroup.findByPk(req.params.groupId, { include: [Product] });
        if (!group || group.Product?.company_id !== req.user.company_id) {
            return res.status(404).json({ message: 'Grup bulunamadı.' });
        }
        const { name, price_diff } = req.body;
        const option = await ProductOption.create({ option_group_id: group.id, name, price_diff });
        res.status(201).json(option);
    } catch (error) { res.status(400).json({ message: 'Seçenek eklenemedi.' }); }
};

exports.deleteProductGroup = async (req, res) => {
    try {
        const group = await ProductOptionGroup.findByPk(req.params.groupId, { include: [Product] });
        if (!group || group.Product?.company_id !== req.user.company_id) {
            return res.status(404).json({ message: 'Grup bulunamadı.' });
        }
        await group.destroy();
        res.status(200).json({ message: 'Grup ve içindeki seçenekler silindi.' });
    } catch (error) {
        res.status(400).json({ message: 'Grup silinemedi.' });
    }
};

exports.deleteProductOption = async (req, res) => {
    try {
        const option = await ProductOption.findByPk(req.params.optionId, {
            include: [{ model: ProductOptionGroup, include: [Product] }]
        });
        const companyId = option?.ProductOptionGroup?.Product?.company_id;
        if (!option || companyId !== req.user.company_id) {
            return res.status(404).json({ message: 'Opsiyon bulunamadı.' });
        }
        await option.destroy();
        res.status(200).json({ message: 'Opsiyon silindi.' });
    } catch (error) {
        res.status(400).json({ message: 'Opsiyon silinemedi.' });
    }
};

exports.addProductGroup = async (req, res) => {
    try {
        const product = await ownProduct(req.params.productId, req.user.company_id);
        if (!product) return res.status(404).json({ message: 'Ürün bulunamadı.' });
        const { name, type } = req.body;
        const group = await ProductOptionGroup.create({ product_id: product.id, name, type });
        res.status(201).json(group);
    } catch (error) { res.status(400).json({ message: 'Grup oluşturulamadı.' }); }
};

exports.addProductOption = async (req, res) => {
    try {
        const product = await ownProduct(req.params.productId, req.user.company_id);
        if (!product) return res.status(404).json({ message: 'Ürün bulunamadı.' });
        const { name, price_diff, option_group_id } = req.body;
        const groupId = parseInt(option_group_id, 10);
        if (!Number.isInteger(groupId)) {
            return res.status(400).json({ message: 'Seçenek bu ürünün bir grubuna bağlanmalı.' });
        }
        const group = await ProductOptionGroup.findOne({
            where: { id: groupId, product_id: product.id }
        });
        if (!group) return res.status(400).json({ message: 'Seçenek bu ürünün bir grubuna bağlanmalı.' });
        const option = await ProductOption.create({
            option_group_id: group.id,
            name,
            price_diff: price_diff || 0
        });
        res.status(201).json(option);
    } catch (error) {
        console.error('Opsiyon eklenemedi:', error);
        res.status(400).json({ message: 'Opsiyon eklenemedi.' });
    }
};
