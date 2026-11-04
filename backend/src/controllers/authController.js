const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Company, Branch } = require('../models');
require('dotenv').config();

const PIN = /^\d{4}$/;

const signToken = (user, extra = {}) => jwt.sign({
    id: user.id,
    role: user.role,
    name: user.name,
    surname: user.surname,
    company_id: extra.company_id ?? user.company_id ?? null,
    branch_id: extra.branch_id ?? user.branch_id ?? null,
    pending: extra.pending || false
}, process.env.JWT_SECRET, { expiresIn: extra.pending ? '15m' : '12h' });

const publicUser = (user, company, branch) => ({
    id: user.id,
    name: user.name,
    surname: user.surname,
    role: user.role,
    company_id: company?.id || user.company_id || null,
    branch_id: branch?.id || null,
    company_name: company?.name || null,
    branch_name: branch?.name || null
});

exports.login = async (req, res) => {
    try {
        const { user_pin, pass_pin, company_code } = req.body;

        if (!user_pin || !pass_pin) {
            return res.status(400).json({ message: 'Lütfen kullanıcı PIN ve şifre PIN kodlarını girin.' });
        }
        if (!PIN.test(String(user_pin)) || !PIN.test(String(pass_pin))) {
            return res.status(400).json({ message: 'PIN kodları 4 haneli olmalıdır.' });
        }

        if (!company_code) {
            const superAdmin = await User.findOne({ where: { user_pin, role: 'SuperAdmin', company_id: null } });
            if (!superAdmin) {
                return res.status(401).json({ message: 'Firma kodu gerekli.' });
            }
            const ok = await bcrypt.compare(String(pass_pin), superAdmin.pass_pin);
            if (!ok) return res.status(401).json({ message: 'Hatalı PIN.' });

            const token = signToken(superAdmin, { company_id: null, branch_id: null });
            return res.status(200).json({
                message: 'Sistem yöneticisi girişi başarılı.',
                token,
                needsBranchSelect: false,
                user: publicUser(superAdmin, null, null)
            });
        }

        if (!PIN.test(String(company_code))) {
            return res.status(400).json({ message: 'Firma kodu 4 haneli olmalıdır.' });
        }

        const company = await Company.findOne({ where: { code: String(company_code), is_active: true } });
        if (!company) return res.status(401).json({ message: 'Hatalı firma kodu.' });

        const user = await User.findOne({ where: { company_id: company.id, user_pin: String(user_pin) } });
        if (!user) return res.status(401).json({ message: 'Hatalı PIN.' });

        const isMatch = await bcrypt.compare(String(pass_pin), user.pass_pin);
        if (!isMatch) return res.status(401).json({ message: 'Hatalı PIN.' });

        const branches = await Branch.findAll({
            where: { company_id: company.id, is_active: true },
            attributes: ['id', 'name', 'code'],
            order: [['id', 'ASC']]
        });

        if (user.role === 'Admin') {
            if (branches.length === 0) {
                return res.status(403).json({ message: 'Firmada aktif şube yok. Önce şube oluşturun.' });
            }
            if (branches.length === 1) {
                const branch = branches[0];
                const token = signToken(user, { company_id: company.id, branch_id: branch.id });
                return res.status(200).json({
                    message: 'Giriş başarılı.',
                    token,
                    needsBranchSelect: false,
                    user: publicUser(user, company, branch)
                });
            }
            const token = signToken(user, { company_id: company.id, branch_id: null, pending: true });
            return res.status(200).json({
                message: 'Şube seçin.',
                token,
                needsBranchSelect: true,
                branches,
                user: publicUser(user, company, null)
            });
        }

        if (!user.branch_id) {
            return res.status(403).json({ message: 'Bu personel bir şubeye bağlı değil.' });
        }

        const branch = branches.find(b => b.id === user.branch_id);
        if (!branch) return res.status(403).json({ message: 'Personelin şubesi aktif değil.' });

        const token = signToken(user, { company_id: company.id, branch_id: branch.id });
        return res.status(200).json({
            message: 'Giriş başarılı.',
            token,
            needsBranchSelect: false,
            user: publicUser(user, company, branch)
        });
    } catch (error) {
        console.error('Sistem Hatası (Login):', error);
        res.status(500).json({ message: 'Sunucu tarafında kritik bir hata oluştu.' });
    }
};

exports.selectBranch = async (req, res) => {
    try {
        if (req.user.role !== 'Admin' || !req.user.pending) {
            return res.status(403).json({ message: 'Şube seçimi yalnızca firma yöneticisi için geçerlidir.' });
        }

        const branchId = parseInt(req.body.branch_id, 10);
        const branch = await Branch.findOne({
            where: { id: branchId, company_id: req.user.company_id, is_active: true }
        });
        if (!branch) return res.status(400).json({ message: 'Şube bulunamadı.' });

        const user = await User.findByPk(req.user.id);
        const company = await Company.findByPk(req.user.company_id);
        const token = signToken(user, { company_id: company.id, branch_id: branch.id, pending: false });

        res.status(200).json({
            message: 'Şube seçildi.',
            token,
            needsBranchSelect: false,
            user: publicUser(user, company, branch)
        });
    } catch (error) {
        console.error('Şube seçilemedi:', error);
        res.status(500).json({ message: 'Şube seçilemedi.' });
    }
};
