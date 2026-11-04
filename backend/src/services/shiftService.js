const { Op, where, col } = require('sequelize');
const { Shift, OrderPayment } = require('../models');

function roundMoney(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return NaN;
    return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function reject(message) {
    const error = new Error(message);
    error.status = 400;
    return error;
}

async function totalsSince(branchId, start) {
    const payments = await OrderPayment.findAll({
        where: {
            branch_id: branchId,
            [Op.and]: where(col('created_at'), { [Op.gte]: start })
        }
    });
    let nakit = 0;
    let kart = 0;
    for (const payment of payments) {
        const amount = roundMoney(payment.amount);
        if (!Number.isFinite(amount)) continue;
        if (payment.method === 'Nakit') nakit = roundMoney(nakit + amount);
        else if (payment.method === 'Kredi Kartı') kart = roundMoney(kart + amount);
    }
    return { nakit, kart, revenue: roundMoney(nakit + kart) };
}

function payload(shift, totals) {
    const starting = roundMoney(shift.starting_cash || 0);
    return {
        shift,
        nakit: totals.nakit,
        kart: totals.kart,
        revenue: totals.revenue,
        expected_cash: roundMoney(starting + totals.nakit)
    };
}

exports.openShift = async (branchId, userId, startingCash) => {
    const cash = roundMoney(startingCash);
    if (!Number.isFinite(cash) || cash < 0) throw reject('Açılış tutarı 0 veya daha büyük olmalı.');
    const existing = await Shift.findOne({ where: { branch_id: branchId, status: 'Açık' } });
    if (existing) throw reject('Bu şubede açık vardiya var.');
    const shift = await Shift.create({
        user_id: userId,
        branch_id: branchId,
        starting_cash: cash,
        status: 'Açık',
        start_time: new Date()
    });
    return payload(shift, { nakit: 0, kart: 0, revenue: 0 });
};

exports.currentShift = async (branchId) => {
    const shift = await Shift.findOne({ where: { branch_id: branchId, status: 'Açık' } });
    if (!shift) return { shift: null, nakit: 0, kart: 0, revenue: 0, expected_cash: 0 };
    return payload(shift, await totalsSince(branchId, shift.start_time));
};

exports.closeShift = async (branchId, endingCash) => {
    const shift = await Shift.findOne({ where: { branch_id: branchId, status: 'Açık' } });
    if (!shift) throw reject('Açık vardiya yok.');
    const counted = roundMoney(endingCash);
    if (!Number.isFinite(counted) || counted < 0) throw reject('Sayılan kasa 0 veya daha büyük olmalı.');
    const totals = await totalsSince(branchId, shift.start_time);
    const body = payload(shift, totals);
    const difference = roundMoney(counted - body.expected_cash);
    await shift.update({
        ending_cash: counted,
        end_time: new Date(),
        status: 'Kapalı'
    });
    return { ...body, shift, difference };
};
