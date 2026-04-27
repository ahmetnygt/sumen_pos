const { User } = require('../models');

exports.getAllUsers = async (req, res) => {
    try {
        // BÜYÜ BURADA: Sütun kısıtlamasını siktir ettik. DB'de ne varsa çekecek, patlama riski SIFIR.
        const users = await User.findAll();
        res.status(200).json(users);
    } catch (error) {
        console.error("Personel Çekme Hatası:", error);
        res.status(500).json({ message: 'Personel listesi çekilemedi.', error: error.message });
    }
};

exports.createUser = async (req, res) => {
    try {
        // Senin istediğin 5'li çete: İsim, Soyisim, Giriş PIN, Şifre PIN (password), Rol
        const { name, surname, pin, password, role } = req.body;

        if (pin) {
            const existingPin = await User.findOne({ where: { pin } });
            if (existingPin) return res.status(400).json({ message: 'Bu Giriş PIN kodu başka bir personele ait!' });
        }

        const user = await User.create({ name, surname, pin, password, role });
        res.status(201).json({ message: 'Personel eklendi.', user });
    } catch (error) {
        res.status(400).json({ message: 'Ekleme başarısız!', error: error.message });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (user && user.role === 'Admin') {
            return res.status(400).json({ message: 'Sistem yöneticisini silemezsiniz!' });
        }

        await User.destroy({ where: { id: req.params.id } });
        res.status(200).json({ message: 'Personel sistemden şutlandı.' });
    } catch (error) {
        res.status(400).json({ message: 'Silme başarısız.', error: error.message });
    }
};