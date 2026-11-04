const shiftService = require('../services/shiftService');

function fail(res, error, fallback) {
    console.error(fallback, error);
    res.status(error.status || 400).json({ message: error.message || fallback });
}

exports.current = async (req, res) => {
    try {
        const body = await shiftService.currentShift(req.user.branch_id);
        res.status(200).json(body);
    } catch (error) {
        fail(res, error, 'Vardiya alınamadı.');
    }
};

exports.open = async (req, res) => {
    try {
        const body = await shiftService.openShift(req.user.branch_id, req.user.id, req.body.starting_cash);
        res.status(201).json(body);
    } catch (error) {
        fail(res, error, 'Vardiya açılamadı.');
    }
};

exports.close = async (req, res) => {
    try {
        const body = await shiftService.closeShift(req.user.branch_id, req.body.ending_cash);
        res.status(200).json(body);
    } catch (error) {
        fail(res, error, 'Vardiya kapatılamadı.');
    }
};
