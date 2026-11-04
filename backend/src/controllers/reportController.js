const { Op, where, col } = require('sequelize');
const { Order, OrderItem, OrderPayment, Product, Table } = require('../models');

function roundMoney(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return 0;
    return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function dateRange(startDate, endDate) {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    return { [Op.between]: [start, end] };
}

function pageParams(query) {
    let page = parseInt(query.page, 10);
    let limit = parseInt(query.limit, 10);
    if (!Number.isInteger(page) || page < 1) page = 1;
    if (!Number.isInteger(limit) || limit < 1) limit = 50;
    if (limit > 100) limit = 100;
    return { page, limit };
}

function stamp(row) {
    return new Date(row.created_at || row.createdAt || row.updated_at || row.updatedAt || 0);
}

function inRange(date, range) {
    if (!range) return true;
    const [start, end] = range[Op.between];
    const time = new Date(date).getTime();
    return time >= start.getTime() && time <= end.getTime();
}

function describe(order) {
    if (order.is_fast_sale) return 'Hızlı satış';
    if (order.Table?.name) return order.Table.name;
    return 'Masasız';
}

function addMethod(bucket, method, amount) {
    if (method === 'Nakit') bucket.nakit = roundMoney(bucket.nakit + amount);
    else if (method === 'Kredi Kartı') bucket.kart = roundMoney(bucket.kart + amount);
    else bucket.unsplit = roundMoney(bucket.unsplit + amount);
}

exports.getSalesReport = async (req, res) => {
    try {
        const branchId = req.user.branch_id;
        const range = dateRange(req.query.startDate, req.query.endDate);
        const { page, limit } = pageParams(req.query);

        const paymentWhere = { branch_id: branchId };
        if (range) paymentWhere[Op.and] = where(col('created_at'), range);
        const rangePayments = await OrderPayment.findAll({ where: paymentWhere });

        const summary = { nakit: 0, kart: 0, unsplit: 0 };
        const paidIds = new Set();
        for (const payment of rangePayments) {
            paidIds.add(payment.order_id);
            addMethod(summary, payment.method, roundMoney(payment.amount));
        }

        const closedWhere = { branch_id: branchId, status: 'Ödendi' };
        if (range) closedWhere[Op.and] = where(col('updated_at'), range);
        const closed = await Order.findAll({ where: closedWhere, attributes: ['id'] });
        const ids = new Set([...paidIds, ...closed.map(order => order.id)]);

        const orders = ids.size
            ? await Order.findAll({
                where: { id: [...ids], branch_id: branchId },
                include: [
                    { model: Table, attributes: ['name'], required: false },
                    { model: OrderPayment, required: false },
                    { model: OrderItem, required: false, include: [{ model: Product, attributes: ['name'], required: false }] }
                ]
            })
            : [];

        let indirim = 0;
        const records = orders.map(order => {
            const payments = (order.OrderPayments || []).slice().sort((a, b) => stamp(a) - stamp(b));
            const counted = payments.filter(payment => inRange(stamp(payment), range));
            const row = { nakit: 0, kart: 0, unsplit: 0 };
            if (payments.length === 0) {
                addMethod(summary, order.payment_method, roundMoney(order.paid_amount || 0));
                addMethod(row, order.payment_method, roundMoney(order.paid_amount || 0));
            } else {
                for (const payment of counted) addMethod(row, payment.method, roundMoney(payment.amount));
            }
            const discount = roundMoney(order.discount_amount || 0);
            indirim = roundMoney(indirim + discount);
            const dated = counted.length ? counted : payments;
            const at = dated.length ? stamp(dated[dated.length - 1]) : stamp(order);
            return {
                id: order.id,
                at,
                description: describe(order),
                total_amount: roundMoney(order.total_amount || 0),
                discount,
                nakit: row.nakit,
                kart: row.kart,
                payments: payments.map(payment => ({
                    id: payment.id,
                    at: stamp(payment),
                    method: payment.method,
                    amount: roundMoney(payment.amount)
                })),
                items: (order.OrderItems || []).map(item => ({
                    id: item.id,
                    name: item.Product?.name || 'Silinmiş Ürün',
                    options: item.selected_options,
                    quantity: item.quantity,
                    line_total: roundMoney(Number(item.price) * item.quantity),
                    status: item.status
                }))
            };
        });

        records.sort((a, b) => new Date(b.at) - new Date(a.at));
        const start = (page - 1) * limit;

        res.status(200).json({
            records: records.slice(start, start + limit),
            page,
            limit,
            total: records.length,
            summary: {
                total: roundMoney(summary.nakit + summary.kart + summary.unsplit),
                nakit: summary.nakit,
                kart: summary.kart,
                unsplit: summary.unsplit,
                indirim
            }
        });
    } catch (error) {
        console.error('Rapor çekilemedi:', error);
        res.status(500).json({ message: 'Rapor çekilemedi.' });
    }
};
