const { Op } = require('sequelize');
const { Table, Branch, Order, FloorDecoration, FloorSalon, sequelize } = require('../models');

const CANVAS_W = 1200;
const CANVAS_H = 800;
const MIN_W = 80;
const MIN_H = 60;
const DEF_W = 140;
const DEF_H = 90;
const MIN_DECOR_W = 40;
const MIN_DECOR_H = 16;
const DECOR = {
    wall: { label: 'Duvar', w: 480, h: 28 },
    bar: { label: 'Bar', w: 320, h: 90 },
    label: { w: 180, h: 48 }
};

function httpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function clampLayout(item) {
    let width = Number(item.canvas_w);
    let height = Number(item.canvas_h);
    if (!Number.isFinite(width)) width = DEF_W;
    if (!Number.isFinite(height)) height = DEF_H;
    width = Math.min(CANVAS_W, Math.max(MIN_W, Math.round(width)));
    height = Math.min(CANVAS_H, Math.max(MIN_H, Math.round(height)));
    let x = Number(item.canvas_x);
    let y = Number(item.canvas_y);
    if (!Number.isFinite(x)) x = 0;
    if (!Number.isFinite(y)) y = 0;
    x = Math.min(CANVAS_W - width, Math.max(0, Math.round(x)));
    y = Math.min(CANVAS_H - height, Math.max(0, Math.round(y)));
    return { canvas_x: x, canvas_y: y, canvas_w: width, canvas_h: height };
}

function clampDecor(item, kind) {
    const defaults = DECOR[kind];
    let width = Number(item.canvas_w);
    let height = Number(item.canvas_h);
    if (!Number.isFinite(width)) width = defaults.w;
    if (!Number.isFinite(height)) height = defaults.h;
    width = Math.min(CANVAS_W, Math.max(MIN_DECOR_W, Math.round(width)));
    height = Math.min(CANVAS_H, Math.max(MIN_DECOR_H, Math.round(height)));
    let x = Number(item.canvas_x);
    let y = Number(item.canvas_y);
    if (!Number.isFinite(x)) x = 0;
    if (!Number.isFinite(y)) y = 0;
    x = Math.min(CANVAS_W - width, Math.max(0, Math.round(x)));
    y = Math.min(CANVAS_H - height, Math.max(0, Math.round(y)));
    return { canvas_x: x, canvas_y: y, canvas_w: width, canvas_h: height };
}

function decorLabel(kind, raw) {
    if (kind === 'wall' || kind === 'bar') return DECOR[kind].label;
    return String(raw || '').trim().slice(0, 24);
}

async function replaceDecorations(branch, salon, items, transaction) {
    const kept = [];
    for (const item of items) {
        if (!DECOR[item.kind]) throw httpError(400, 'Süs türü geçersiz.');
        const label = decorLabel(item.kind, item.label);
        const layout = clampDecor(item, item.kind);
        const id = parseInt(item.id, 10);
        const row = Number.isInteger(id)
            ? await FloorDecoration.findByPk(id, { transaction })
            : null;
        if (row && (row.branch_id !== branch.id || row.salon_id !== salon.id)) {
            throw httpError(404, 'Süs bulunamadı.');
        }
        if (row) {
            await row.update({ kind: item.kind, label, salon_id: salon.id, ...layout }, { transaction });
            kept.push(row);
        } else {
            kept.push(await FloorDecoration.create({
                branch_id: branch.id,
                salon_id: salon.id,
                kind: item.kind,
                label,
                ...layout
            }, { transaction }));
        }
    }
    await FloorDecoration.destroy({
        where: kept.length
            ? { branch_id: branch.id, salon_id: salon.id, id: { [Op.notIn]: kept.map(row => row.id) } }
            : { branch_id: branch.id, salon_id: salon.id },
        transaction
    });
    return kept;
}

async function ensureBranchSalon(branchId, transaction) {
    let salon = await FloorSalon.findOne({
        where: { branch_id: branchId },
        order: [['sort_order', 'ASC'], ['id', 'ASC']],
        transaction
    });
    if (!salon) {
        salon = await FloorSalon.create({ branch_id: branchId, name: 'Salon', sort_order: 0 }, { transaction });
    }
    return salon;
}

function salonName(raw) {
    const name = String(raw || '').trim().slice(0, 40);
    if (!name) throw httpError(400, 'Salon adı zorunludur.');
    return name;
}

async function ownBranch(branchId, companyId) {
    return Branch.findOne({ where: { id: branchId, company_id: companyId } });
}

async function ownTable(tableId, companyId) {
    const table = await Table.findByPk(tableId);
    if (!table) return null;
    const branch = await ownBranch(table.branch_id, companyId);
    if (!branch) return null;
    return table;
}

exports.getAllTables = async (req, res) => {
    try {
        const tables = await Table.findAll({
            where: { branch_id: req.user.branch_id },
            order: [['id', 'ASC']]
        });
        res.status(200).json(tables);
    } catch (error) {
        console.error('Masalar getirilemedi:', error);
        res.status(500).json({ message: 'Masalar getirilemedi.' });
    }
};

exports.listCompanyTables = async (req, res) => {
    try {
        const branches = await Branch.findAll({
            where: { company_id: req.user.company_id },
            attributes: ['id']
        });
        const tables = await Table.findAll({
            where: { branch_id: branches.map(branch => branch.id) },
            order: [['id', 'ASC']]
        });
        res.status(200).json(tables);
    } catch (error) {
        console.error('Masalar getirilemedi:', error);
        res.status(500).json({ message: 'Masalar getirilemedi.' });
    }
};

exports.createTable = async (req, res) => {
    try {
        const name = String(req.body.name || '').trim();
        const branchId = parseInt(req.body.branch_id || req.user.branch_id, 10);
        if (!name) return res.status(400).json({ message: 'Masa adı zorunludur.' });
        const branch = await ownBranch(branchId, req.user.company_id);
        if (!branch) return res.status(404).json({ message: 'Şube bulunamadı.' });
        let salon = null;
        const salonId = parseInt(req.body.salon_id, 10);
        if (Number.isInteger(salonId)) {
            salon = await FloorSalon.findOne({ where: { id: salonId, branch_id: branch.id } });
            if (!salon) return res.status(404).json({ message: 'Salon bulunamadı.' });
        } else {
            salon = await ensureBranchSalon(branch.id);
        }
        const table = await Table.create({ name, branch_id: branch.id, salon_id: salon.id, status: 'Boş' });
        res.status(201).json(table);
    } catch (error) {
        console.error('Masa eklenemedi:', error);
        res.status(400).json({ message: 'Masa eklenemedi.' });
    }
};

exports.listDecorations = async (req, res) => {
    try {
        const rows = await FloorDecoration.findAll({
            where: { branch_id: req.user.branch_id },
            order: [['id', 'ASC']]
        });
        res.status(200).json(rows);
    } catch (error) {
        console.error('Süsler getirilemedi:', error);
        res.status(500).json({ message: 'Süsler getirilemedi.' });
    }
};

exports.listCompanyDecorations = async (req, res) => {
    try {
        const branches = await Branch.findAll({
            where: { company_id: req.user.company_id },
            attributes: ['id']
        });
        const rows = await FloorDecoration.findAll({
            where: { branch_id: branches.map(branch => branch.id) },
            order: [['id', 'ASC']]
        });
        res.status(200).json(rows);
    } catch (error) {
        console.error('Süsler getirilemedi:', error);
        res.status(500).json({ message: 'Süsler getirilemedi.' });
    }
};

exports.saveLayout = async (req, res) => {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const hasDecorations = Array.isArray(req.body.decorations);
    if (!items.length && !hasDecorations) {
        return res.status(400).json({ message: 'Kaydedilecek masa yok.' });
    }
    try {
        const result = await sequelize.transaction(async (transaction) => {
            let branch = null;
            if (hasDecorations) {
                branch = await ownBranch(parseInt(req.body.branch_id, 10), req.user.company_id);
                if (!branch) throw httpError(404, 'Şube bulunamadı.');
            }
            let salon = null;
            if (hasDecorations) {
                salon = await FloorSalon.findOne({
                    where: { id: parseInt(req.body.salon_id, 10), branch_id: branch.id },
                    transaction
                });
                if (!salon) throw httpError(404, 'Salon bulunamadı.');
            }
            const saved = [];
            for (const item of items) {
                const table = await ownTable(item.id, req.user.company_id);
                if (!table || (branch && table.branch_id !== branch.id) || (salon && table.salon_id !== salon.id)) {
                    throw httpError(404, 'Masa bulunamadı.');
                }
                const layout = clampLayout(item);
                await table.update(layout, { transaction });
                saved.push(table);
            }
            const decorations = hasDecorations
                ? await replaceDecorations(branch, salon, req.body.decorations, transaction)
                : null;
            return { saved, decorations };
        });
        if (!hasDecorations) return res.status(200).json(result.saved);
        res.status(200).json({ tables: result.saved, decorations: result.decorations });
    } catch (error) {
        if (!error.status) console.error('Masa planı kaydedilemedi:', error);
        res.status(error.status || 400).json({
            message: error.status ? error.message : 'Masa planı kaydedilemedi.'
        });
    }
};

exports.renameTable = async (req, res) => {
    try {
        const table = await ownTable(req.params.id, req.user.company_id);
        if (!table) return res.status(404).json({ message: 'Masa bulunamadı.' });
        const updates = {};
        if (req.body.name != null) {
            const name = String(req.body.name).trim();
            if (!name) return res.status(400).json({ message: 'Masa adı zorunludur.' });
            updates.name = name;
        }
        if (req.body.salon_id != null) {
            const salon = await FloorSalon.findOne({
                where: { id: parseInt(req.body.salon_id, 10), branch_id: table.branch_id }
            });
            if (!salon) return res.status(404).json({ message: 'Salon bulunamadı.' });
            updates.salon_id = salon.id;
        }
        if (!Object.keys(updates).length) return res.status(400).json({ message: 'Masa adı zorunludur.' });
        await table.update(updates);
        res.status(200).json(table);
    } catch (error) {
        console.error('Masa adlandırılamadı:', error);
        res.status(400).json({ message: 'Masa adlandırılamadı.' });
    }
};

exports.deleteTable = async (req, res) => {
    try {
        const table = await ownTable(req.params.id, req.user.company_id);
        if (!table) return res.status(404).json({ message: 'Masa bulunamadı.' });
        const openOrders = await Order.count({ where: { table_id: table.id, status: 'Açık' } });
        if (openOrders > 0) return res.status(400).json({ message: 'Açık adisyonu olan masa silinemez.' });
        await table.destroy();
        res.status(200).json({ message: 'Masa silindi.' });
    } catch (error) {
        console.error('Masa silinemedi:', error);
        res.status(400).json({ message: 'Masa silinemedi.' });
    }
};

exports.listSalons = async (req, res) => {
    try {
        await ensureBranchSalon(req.user.branch_id);
        const rows = await FloorSalon.findAll({
            where: { branch_id: req.user.branch_id },
            order: [['sort_order', 'ASC'], ['id', 'ASC']]
        });
        res.status(200).json(rows);
    } catch (error) {
        console.error('Salonlar getirilemedi:', error);
        res.status(500).json({ message: 'Salonlar getirilemedi.' });
    }
};

exports.listCompanySalons = async (req, res) => {
    try {
        const branches = await Branch.findAll({
            where: { company_id: req.user.company_id },
            attributes: ['id']
        });
        for (const branch of branches) await ensureBranchSalon(branch.id);
        const rows = await FloorSalon.findAll({
            where: { branch_id: branches.map(branch => branch.id) },
            order: [['sort_order', 'ASC'], ['id', 'ASC']]
        });
        res.status(200).json(rows);
    } catch (error) {
        console.error('Salonlar getirilemedi:', error);
        res.status(500).json({ message: 'Salonlar getirilemedi.' });
    }
};

exports.createSalon = async (req, res) => {
    try {
        const branch = await ownBranch(parseInt(req.body.branch_id, 10), req.user.company_id);
        if (!branch) return res.status(404).json({ message: 'Şube bulunamadı.' });
        const name = salonName(req.body.name);
        const max = await FloorSalon.max('sort_order', { where: { branch_id: branch.id } });
        const salon = await FloorSalon.create({
            branch_id: branch.id,
            name,
            sort_order: (Number.isFinite(max) ? max : -1) + 1
        });
        res.status(201).json(salon);
    } catch (error) {
        if (!error.status) console.error('Salon eklenemedi:', error);
        res.status(error.status || 400).json({ message: error.status ? error.message : 'Salon eklenemedi.' });
    }
};

exports.renameSalon = async (req, res) => {
    try {
        const salon = await FloorSalon.findByPk(req.params.id);
        if (!salon) return res.status(404).json({ message: 'Salon bulunamadı.' });
        const branch = await ownBranch(salon.branch_id, req.user.company_id);
        if (!branch) return res.status(404).json({ message: 'Salon bulunamadı.' });
        await salon.update({ name: salonName(req.body.name) });
        res.status(200).json(salon);
    } catch (error) {
        if (!error.status) console.error('Salon adlandırılamadı:', error);
        res.status(error.status || 400).json({ message: error.status ? error.message : 'Salon adlandırılamadı.' });
    }
};

exports.deleteSalon = async (req, res) => {
    try {
        const salon = await FloorSalon.findByPk(req.params.id);
        if (!salon) return res.status(404).json({ message: 'Salon bulunamadı.' });
        const branch = await ownBranch(salon.branch_id, req.user.company_id);
        if (!branch) return res.status(404).json({ message: 'Salon bulunamadı.' });
        const total = await FloorSalon.count({ where: { branch_id: salon.branch_id } });
        if (total <= 1) return res.status(400).json({ message: 'Son salon silinemez.' });
        const tables = await Table.count({ where: { salon_id: salon.id } });
        if (tables > 0) {
            return res.status(400).json({ message: 'Bu salonda masa var. Önce masaları taşıyın veya silin.' });
        }
        await FloorDecoration.destroy({ where: { salon_id: salon.id } });
        await salon.destroy();
        res.status(200).json({ message: 'Salon silindi.' });
    } catch (error) {
        console.error('Salon silinemedi:', error);
        res.status(400).json({ message: 'Salon silinemedi.' });
    }
};
