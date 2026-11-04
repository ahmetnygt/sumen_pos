const { User, Branch, Order } = require('../models');

const ROLES = ['Admin', 'Kasa', 'Garson', 'Mutfak'];
const PIN = /^\d{4}$/;

const safeUser = {
    attributes: { exclude: ['pass_pin'] }
};

exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.findAll({
            where: { company_id: req.user.company_id },
            ...safeUser,
            include: [{ model: Branch, attributes: ['id', 'name', 'code'] }],
            order: [['id', 'ASC']]
        });
        res.status(200).json(users);
    } catch (error) {
        console.error("Personel Çekme Hatası:", error);
        res.status(500).json({ message: 'Personel listesi çekilemedi.' });
    }
};

exports.createUser = async (req, res) => {
    try {
        const { name, surname, pin, password, role, branch_id } = req.body;
        if (!/^\d{4}$/.test(String(pin || '')) || !/^\d{4}$/.test(String(password || ''))) {
            return res.status(400).json({ message: 'PIN kodları 4 haneli olmalıdır.' });
        }
        if (!['Admin', 'Kasa', 'Garson', 'Mutfak'].includes(role)) {
            return res.status(400).json({ message: 'Geçersiz yetki.' });
        }

        const existingPin = await User.findOne({ where: { company_id: req.user.company_id, user_pin: String(pin) } });
        if (existingPin) return res.status(400).json({ message: 'Bu giriş PIN kodu firmada başka bir personele ait.' });

        let assignedBranch = null;
        if (role !== 'Admin') {
            assignedBranch = await Branch.findOne({
                where: { id: branch_id, company_id: req.user.company_id, is_active: true }
            });
            if (!assignedBranch) return res.status(400).json({ message: 'Personel için şube seçin.' });
        }

        const user = await User.create({
            name,
            surname,
            user_pin: String(pin),
            pass_pin: String(password),
            role,
            company_id: req.user.company_id,
            branch_id: assignedBranch ? assignedBranch.id : null
        });

        res.status(201).json({
            message: 'Personel eklendi.',
            user: {
                id: user.id,
                name: user.name,
                surname: user.surname,
                user_pin: user.user_pin,
                role: user.role,
                branch_id: user.branch_id
            }
        });
    } catch (error) {
        console.error("VERİTABANI KAYIT HATASI:", error);
        console.error('Personel eklenemedi:', error);
        res.status(400).json({ message: 'Ekleme başarısız!' });
    }
};

exports.updateUser = async (req, res) => {
    try {
        const user = await User.findOne({ where: { id: req.params.id, company_id: req.user.company_id } });
        if (!user) return res.status(404).json({ message: 'Personel bulunamadı.' });

        const { name, surname, pin, password, role, branch_id } = req.body;
        if (pin !== undefined && pin !== '' && !PIN.test(String(pin))) {
            return res.status(400).json({ message: 'PIN kodları 4 haneli olmalıdır.' });
        }
        if (password !== undefined && password !== '' && !PIN.test(String(password))) {
            return res.status(400).json({ message: 'PIN kodları 4 haneli olmalıdır.' });
        }
        const nextRole = role || user.role;
        if (!ROLES.includes(nextRole)) return res.status(400).json({ message: 'Geçersiz yetki.' });

        const nextPin = pin ? String(pin) : user.user_pin;
        if (nextPin !== user.user_pin) {
            const existingPin = await User.findOne({ where: { company_id: req.user.company_id, user_pin: nextPin } });
            if (existingPin) return res.status(400).json({ message: 'Bu giriş PIN kodu firmada başka bir personele ait.' });
        }

        let branchId = null;
        if (nextRole !== 'Admin') {
            branchId = branch_id || user.branch_id;
            const assignedBranch = await Branch.findOne({
                where: { id: branchId, company_id: req.user.company_id, is_active: true }
            });
            if (!assignedBranch) return res.status(400).json({ message: 'Personel için şube seçin.' });
            branchId = assignedBranch.id;
        }

        const patch = {
            name: name || user.name,
            surname: surname || user.surname,
            user_pin: nextPin,
            role: nextRole,
            branch_id: branchId
        };
        if (password) patch.pass_pin = String(password);
        await user.update(patch);

        res.status(200).json({
            message: 'Personel güncellendi.',
            user: {
                id: user.id,
                name: user.name,
                surname: user.surname,
                user_pin: user.user_pin,
                role: user.role,
                branch_id: user.branch_id
            }
        });
    } catch (error) {
        console.error('Personel güncellenemedi:', error);
        res.status(400).json({ message: 'Güncelleme başarısız.' });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findOne({ where: { id: req.params.id, company_id: req.user.company_id } });
        if (!user) return res.status(404).json({ message: 'Personel bulunamadı.' });
        if (user.role === 'Admin') {
            return res.status(400).json({ message: 'Firma yöneticisini silemezsiniz.' });
        }

        const orderCount = await Order.count({ where: { user_id: user.id } });
        if (orderCount > 0) {
            return res.status(400).json({ message: 'Bu personelin sipariş kaydı var, silinemez. PIN’ini değiştirin.' });
        }

        await user.destroy();
        res.status(200).json({ message: 'Personel silindi.' });
    } catch (error) {
        console.error('Personel silinemedi:', error);
        res.status(400).json({ message: 'Silme başarısız.' });
    }
};
