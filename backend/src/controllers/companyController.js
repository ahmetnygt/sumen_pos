const { Company, Branch, User, sequelize } = require('../models');
const { cleanAccent, cleanLogo } = require('../utils/brandInput');

const PIN = /^\d{4}$/;

exports.listCompanies = async (req, res) => {
    try {
        const companies = await Company.findAll({
            include: [{ model: Branch, attributes: ['id', 'name', 'code', 'is_active'] }],
            order: [['id', 'ASC']]
        });
        res.status(200).json(companies);
    } catch (error) {
        console.error('Firmalar alınamadı:', error);
        res.status(500).json({ message: 'Firmalar alınamadı.' });
    }
};

exports.createCompany = async (req, res) => {
    try {
        const { name, code, branch_name, branch_code, admin_name, admin_surname, admin_pin, admin_password } = req.body;

        if (!name || !branch_name || !admin_name || !admin_surname) {
            return res.status(400).json({ message: 'Firma, şube ve yönetici adı zorunludur.' });
        }
        if (!PIN.test(String(code || '')) || !PIN.test(String(branch_code || '')) || !PIN.test(String(admin_pin || '')) || !PIN.test(String(admin_password || ''))) {
            return res.status(400).json({ message: 'Firma, şube ve PIN kodları 4 haneli olmalıdır.' });
        }
        const accent = cleanAccent(req.body.accent_color, { fallback: true });
        const logo = cleanLogo(req.body.logo_svg);
        if (accent === false) return res.status(400).json({ message: 'Vurgu rengi #RRGGBB formatında olmalıdır.' });
        if (logo === false) return res.status(400).json({ message: 'Logo bir SVG olmalıdır.' });

        const existing = await Company.findOne({ where: { code: String(code) } });
        if (existing) return res.status(400).json({ message: 'Bu firma kodu kullanılıyor.' });

        const t = await sequelize.transaction();
        try {
            const company = await Company.create({
                name,
                code: String(code),
                is_active: true,
                accent_color: accent,
                logo_svg: logo
            }, { transaction: t });
            const branch = await Branch.create({
                company_id: company.id,
                name: branch_name,
                code: String(branch_code),
                is_active: true
            }, { transaction: t });
            const admin = await User.create({
                name: admin_name,
                surname: admin_surname,
                user_pin: String(admin_pin),
                pass_pin: String(admin_password),
                role: 'Admin',
                company_id: company.id,
                branch_id: null
            }, { transaction: t });
            await t.commit();

            res.status(201).json({
                message: 'Firma oluşturuldu.',
                company,
                branch: { id: branch.id, name: branch.name, code: branch.code },
                admin: { id: admin.id, name: admin.name, surname: admin.surname, user_pin: admin.user_pin }
            });
        } catch (error) {
            await t.rollback();
            throw error;
        }
    } catch (error) {
        console.error(error);
        console.error('Firma oluşturulamadı:', error);
        res.status(400).json({ message: 'Firma oluşturulamadı.' });
    }
};

exports.updateBrand = async (req, res) => {
    try {
        const company = await Company.findByPk(req.params.id);
        if (!company) return res.status(404).json({ message: 'Firma bulunamadı.' });

        const patch = {};
        if (req.body.accent_color !== undefined) {
            const accent = cleanAccent(req.body.accent_color);
            if (accent === false) return res.status(400).json({ message: 'Vurgu rengi #RRGGBB formatında olmalıdır.' });
            patch.accent_color = accent;
        }
        if (req.body.logo_svg !== undefined) {
            const logo = cleanLogo(req.body.logo_svg);
            if (logo === false) return res.status(400).json({ message: 'Logo bir SVG olmalıdır.' });
            patch.logo_svg = logo;
        }
        if (!Object.keys(patch).length) {
            return res.status(400).json({ message: 'Güncellenecek marka alanı yok.' });
        }

        await company.update(patch);
        res.status(200).json({
            message: 'Marka güncellendi.',
            company: {
                id: company.id,
                name: company.name,
                code: company.code,
                accent_color: company.accent_color,
                logo_svg: company.logo_svg || null
            }
        });
    } catch (error) {
        console.error('Marka güncellenemedi:', error);
        res.status(400).json({ message: 'Marka güncellenemedi.' });
    }
};
