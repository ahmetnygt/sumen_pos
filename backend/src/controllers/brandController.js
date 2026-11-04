const { Company } = require('../models');

const PIN = /^\d{4}$/;

exports.getBrand = async (req, res) => {
    try {
        const code = String(req.params.code || '');
        if (!PIN.test(code)) return res.status(404).json({ message: 'Firma bulunamadı.' });

        const company = await Company.findOne({
            where: { code, is_active: true },
            attributes: ['name', 'code', 'accent_color', 'logo_svg']
        });
        if (!company) return res.status(404).json({ message: 'Firma bulunamadı.' });

        res.status(200).json({
            name: company.name,
            code: company.code,
            accent_color: company.accent_color || '#d4af37',
            logo_svg: company.logo_svg || null
        });
    } catch (error) {
        console.error('Marka alınamadı:', error);
        res.status(500).json({ message: 'Marka alınamadı.' });
    }
};
