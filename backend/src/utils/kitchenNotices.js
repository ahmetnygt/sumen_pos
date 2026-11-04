const TTL_MS = 30 * 1000;
const byBranch = new Map();

function prune(branchId, now) {
    const rows = (byBranch.get(branchId) || []).filter(row => row.until > now);
    byBranch.set(branchId, rows);
    return rows;
}

function rememberCancels(branchId, lines) {
    const now = Date.now();
    const rows = prune(branchId, now);
    for (const line of lines || []) {
        if (!line || line.id == null) continue;
        if (rows.some(row => row.id === line.id)) continue;
        rows.push({
            id: line.id,
            name: line.name,
            quantity: line.quantity,
            options: Array.isArray(line.options) ? line.options : [],
            place: line.place || line.tableName || 'Masa',
            groupKey: line.groupKey,
            created_at: line.created_at ? new Date(line.created_at).toISOString() : null,
            until: now + TTL_MS
        });
    }
    byBranch.set(branchId, rows);
}

function listCancels(branchId) {
    return prune(branchId, Date.now()).map(row => ({ ...row }));
}

module.exports = { rememberCancels, listCancels };
