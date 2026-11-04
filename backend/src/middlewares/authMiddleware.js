const jwt = require('jsonwebtoken');
require('dotenv').config();

exports.verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Erişim reddedildi. Sisteme giriş yapmadınız (Token yok).' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Oturum süresi doldu. Tekrar giriş yapın.' });
    }
};

exports.authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: `Erişim reddedildi. Bu işlem için ${allowedRoles.join(' veya ')} yetkisine sahip olmalısınız.` });
        }
        next();
    };
};

exports.requireBranch = (req, res, next) => {
    if (!req.user || !req.user.branch_id || req.user.pending) {
        return res.status(403).json({ message: 'Bu işlem için bir şube seçmelisiniz.' });
    }
    next();
};

exports.requireCompany = (req, res, next) => {
    if (!req.user || !req.user.company_id || req.user.pending) {
        return res.status(403).json({ message: 'Bu işlem için firma bağlamı gerekli.' });
    }
    next();
};
