const jwt = require('jsonwebtoken');
require('dotenv').config();

// Token Doğrulama Fedaisi
exports.verifyToken = (req, res, next) => {
    // İstek başlığında (Header) Authorization var mı?
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Erişim reddedildi. Sisteme giriş yapmadınız (Token yok).' });
    }

    const token = authHeader.split(' ')[1];

    try {
        // Token'ı gizli anahtarımızla açıp içindeki kimliği okuyoruz
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Kimliği isteğin (req) içine yapıştırıyoruz ki diğer dosyalar bilsin
        next(); // Geçebilirsin
    } catch (err) {
        return res.status(403).json({ message: 'Güvenlik ihlali: Geçersiz veya süresi dolmuş token.' });
    }
};

// Rol Doğrulama Fedaisi (Sadece belli yetkileri içeri alır)
exports.authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: `Erişim reddedildi. Bu işlem için ${allowedRoles.join(' veya ')} yetkisine sahip olmalısınız.` });
        }
        next();
    };
};