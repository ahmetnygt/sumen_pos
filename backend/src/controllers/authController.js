const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
require('dotenv').config();

exports.login = async (req, res) => {
    try {
        const { user_pin, pass_pin } = req.body;

        if (!user_pin || !pass_pin) {
            return res.status(400).json({ message: 'Lütfen Kullanıcı PIN ve Şifre PIN kodlarını eksiksiz girin.' });
        }

        // 1. Adamı user_pin ile bul
        const user = await User.findOne({ where: { user_pin } });
        if (!user) {
            return res.status(401).json({ message: 'Güvenlik Uyarısı: Hatalı Kullanıcı PIN kodu.' });
        }

        // 2. Girilen pass_pin ile veritabanındaki kriptolu şifreyi (bcrypt) karşılaştır
        const isMatch = await bcrypt.compare(pass_pin, user.pass_pin);
        if (!isMatch) {
            return res.status(401).json({ message: 'Güvenlik Uyarısı: Hatalı Şifre PIN kodu.' });
        }

        // 3. Her şey doğruysa 12 saatlik, kırılmaz bir JWT bileti kes
        const token = jwt.sign(
            { id: user.id, role: user.role, name: user.name, surname: user.surname },
            process.env.JWT_SECRET,
            { expiresIn: '12h' }
        );

        res.status(200).json({
            message: 'Sümen POS Sistemine Giriş Başarılı.',
            token,
            user: {
                id: user.id,
                name: user.name,
                surname: user.surname,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Sistem Hatası (Login):', error);
        res.status(500).json({ message: 'Sunucu tarafında kritik bir hata oluştu.' });
    }
};