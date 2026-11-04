const { Op } = require('sequelize');
const { Reservation, Table } = require('../models');
const { emitBranch } = require('../utils/realtime');

const WAITER_STATUSES = ['Geldi', 'Gelmedi'];
const STAFF_STATUSES = ['Geldi', 'İptal', 'Gelmedi'];

function present(row) {
    const json = row.toJSON();
    return {
        id: json.id,
        branch_id: json.branch_id,
        table_id: json.table_id,
        table_name: json.Table?.name || '',
        guest_name: json.guest_name,
        phone: json.phone || '',
        party_size: json.party_size,
        starts_at: json.starts_at,
        duration_minutes: json.duration_minutes,
        note: json.note || '',
        status: json.status
    };
}

function dayBounds(date) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ''));
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const start = new Date(year, month - 1, day, 0, 0, 0, 0);
    const end = new Date(year, month - 1, day, 23, 59, 59, 999);
    if (start.getFullYear() !== year || start.getMonth() !== month - 1 || start.getDate() !== day) return null;
    return { start, end };
}

function parseStart(value) {
    const text = String(value || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text)) return null;
    const start = new Date(text);
    if (Number.isNaN(start.getTime())) return null;
    return start;
}

async function clashes(branchId, tableId, startsAt, durationMinutes) {
    const rows = await Reservation.findAll({
        where: { branch_id: branchId, table_id: tableId, status: 'Bekliyor' }
    });
    const start = startsAt.getTime();
    const end = start + durationMinutes * 60000;
    return rows.some((row) => {
        const otherStart = new Date(row.starts_at).getTime();
        const otherEnd = otherStart + Number(row.duration_minutes) * 60000;
        return start < otherEnd && otherStart < end;
    });
}

exports.listReservations = async (req, res) => {
    try {
        const bounds = dayBounds(req.query.date);
        if (!bounds) return res.status(400).json({ message: 'Gün YYYY-MM-DD olmalı.' });
        const rows = await Reservation.findAll({
            where: {
                branch_id: req.user.branch_id,
                starts_at: { [Op.between]: [bounds.start, bounds.end] }
            },
            include: [{ model: Table, attributes: ['name'], required: false }],
            order: [['starts_at', 'ASC']]
        });
        res.status(200).json(rows.map(present));
    } catch (error) {
        console.error('Rezervasyonlar alınamadı:', error);
        res.status(500).json({ message: 'Rezervasyonlar alınamadı.' });
    }
};

exports.createReservation = async (req, res) => {
    try {
        const guestName = String(req.body.guest_name || '').trim();
        const startsAt = parseStart(req.body.starts_at);
        const tableId = parseInt(req.body.table_id, 10);
        const partySize = parseInt(req.body.party_size, 10);
        if (!guestName || !startsAt || !Number.isInteger(tableId) || !Number.isInteger(partySize) || partySize < 1) {
            return res.status(400).json({ message: 'Misafir adı, saat, masa ve kişi sayısı zorunludur.' });
        }
        const table = await Table.findOne({ where: { id: tableId, branch_id: req.user.branch_id } });
        if (!table) return res.status(404).json({ message: 'Masa bulunamadı.' });
        let duration = parseInt(req.body.duration_minutes, 10);
        if (!Number.isInteger(duration)) duration = 120;
        if (duration < 15 || duration > 720) {
            return res.status(400).json({ message: 'Süre 15 ile 720 dakika arasında olmalı.' });
        }
        if (await clashes(req.user.branch_id, table.id, startsAt, duration)) {
            return res.status(400).json({ message: 'Bu masada bu saatte rezervasyon var.' });
        }
        const created = await Reservation.create({
            branch_id: req.user.branch_id,
            table_id: table.id,
            guest_name: guestName.slice(0, 80),
            phone: String(req.body.phone || '').trim().slice(0, 30),
            party_size: partySize,
            starts_at: startsAt,
            duration_minutes: duration,
            note: String(req.body.note || '').trim().slice(0, 200),
            status: 'Bekliyor'
        });
        const row = await Reservation.findByPk(created.id, {
            include: [{ model: Table, attributes: ['name'], required: false }]
        });
        emitBranch(req, 'updateTables');
        res.status(201).json(present(row));
    } catch (error) {
        console.error('Rezervasyon eklenemedi:', error);
        res.status(400).json({ message: 'Rezervasyon eklenemedi.' });
    }
};

exports.updateReservationStatus = async (req, res) => {
    try {
        const status = String(req.body.status || '');
        const allowed = req.user.role === 'Garson' ? WAITER_STATUSES : STAFF_STATUSES;
        if (!allowed.includes(status)) {
            return res.status(403).json({ message: 'Bu durum güncellenemez.' });
        }
        const row = await Reservation.findOne({
            where: { id: parseInt(req.params.id, 10), branch_id: req.user.branch_id },
            include: [{ model: Table, attributes: ['name'], required: false }]
        });
        if (!row) return res.status(404).json({ message: 'Rezervasyon bulunamadı.' });
        await row.update({ status });
        emitBranch(req, 'updateTables');
        res.status(200).json(present(row));
    } catch (error) {
        console.error('Rezervasyon güncellenemedi:', error);
        res.status(400).json({ message: 'Rezervasyon güncellenemedi.' });
    }
};
