function emitBranch(req, event, payload) {
    const io = req.app.get('io');
    const branchId = req.user?.branch_id;
    if (!io || !branchId) return;
    io.to(`branch-${branchId}`).emit(event, payload);
}

module.exports = { emitBranch };
