const { Branch, Order, User } = require('../models');

const PIN = /^\d{4}$/;

exports.listBranches = async (req, res) => {
    try {
        const branches = await Branch.findAll({
            where: { company_id: req.user.company_id },
            order: [['id', 'ASC']]
        });
        res.status(200).json(branches);
    } catch (error) {
        console.error('Şubeler alınamadı:', error);
        res.status(500).json({ message: 'Şubeler alınamadı.' });
    }
};

exports.createBranch = async (req, res) => {
    try {
        const { name, code } = req.body;
        if (!name || !PIN.test(String(code || ''))) {
            return res.status(400).json({ message: 'Şube adı ve 4 haneli kod zorunludur.' });
        }

        const exists = await Branch.findOne({ where: { company_id: req.user.company_id, code: String(code) } });
        if (exists) return res.status(400).json({ message: 'Bu şube kodu firmada kullanılıyor.' });

        const branch = await Branch.create({
            company_id: req.user.company_id,
            name,
            code: String(code),
            is_active: true
        });
        res.status(201).json(branch);
    } catch (error) {
        console.error('Şube eklenemedi:', error);
        res.status(400).json({ message: 'Şube eklenemedi.' });
    }
};

exports.updateBranch = async (req, res) => {
    try {
        const branch = await Branch.findOne({ where: { id: req.params.id, company_id: req.user.company_id } });
        if (!branch) return res.status(404).json({ message: 'Şube bulunamadı.' });

        const { name, code, is_active } = req.body;
        if (code && !PIN.test(String(code))) return res.status(400).json({ message: 'Şube kodu 4 haneli olmalıdır.' });
        if (code && code !== branch.code) {
            const exists = await Branch.findOne({ where: { company_id: req.user.company_id, code: String(code) } });
            if (exists) return res.status(400).json({ message: 'Bu şube kodu firmada kullanılıyor.' });
        }

        await branch.update({
            name: name ?? branch.name,
            code: code ? String(code) : branch.code,
            is_active: typeof is_active === 'boolean' ? is_active : branch.is_active
        });
        res.status(200).json(branch);
    } catch (error) {
        res.status(400).json({ message: 'Şube güncellenemedi.' });
    }
};

exports.deleteBranch = async (req, res) => {
    try {
        const branch = await Branch.findOne({ where: { id: req.params.id, company_id: req.user.company_id } });
        if (!branch) return res.status(404).json({ message: 'Şube bulunamadı.' });

        const activeCount = await Branch.count({ where: { company_id: req.user.company_id, is_active: true } });
        if (branch.is_active && activeCount <= 1) {
            return res.status(400).json({ message: 'Firmanın son aktif şubesi kapatılamaz.' });
        }

        const staffCount = await User.count({ where: { branch_id: branch.id } });
        const openOrders = await Order.count({ where: { branch_id: branch.id, status: 'Açık' } });
        if (staffCount > 0 || openOrders > 0) {
            return res.status(400).json({ message: 'Personeli veya açık adisyonu olan şube kapatılamaz.' });
        }

        const orderCount = await Order.count({ where: { branch_id: branch.id } });
        if (orderCount > 0) {
            await branch.update({ is_active: false });
            return res.status(200).json({ message: 'Şubede geçmiş sipariş olduğu için pasife alındı.' });
        }

        await branch.destroy();
        res.status(200).json({ message: 'Şube silindi.' });
    } catch (error) {
        res.status(400).json({ message: 'Şube silinemedi.' });
    }
};
