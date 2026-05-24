const { User } = require('../models');

exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.findAll();
        res.status(200).json(users);
    } catch (error) {
        console.error("Personel Çekme Hatası:", error);
        res.status(500).json({ message: 'Personel listesi çekilemedi.', error: error.message });
    }
};

exports.createUser = async (req, res) => {
    try {
        const { name, surname, pin, password, role } = req.body;

        if (pin) {
            // DÜZELTME 1: DB'de ararken user_pin olarak ara!
            const existingPin = await User.findOne({ where: { user_pin: pin } });
            if (existingPin) return res.status(400).json({ message: 'Bu Giriş PIN kodu başka bir personele ait!' });
        }

        // DÜZELTME 2: DB'ye kaydederken sütun isimlerini eşleştir!
        const user = await User.create({
            name,
            surname,
            user_pin: pin,
            pass_pin: password,
            role
        });

        res.status(201).json({ message: 'Personel eklendi.', user });
    } catch (error) {
        console.error("VERİTABANI KAYIT HATASI:", error);
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