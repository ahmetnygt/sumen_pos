const BEFORE_MS = 30 * 60 * 1000;
const AFTER_MS = 15 * 60 * 1000;

export function todayKey(now = new Date()) {
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
}

export function holdingReservation(reservations, table, now = new Date()) {
    if (!table || table.status !== 'Boş') return null;
    const time = now.getTime();
    return (reservations || []).find((row) => {
        if (Number(row.table_id) !== Number(table.id) || row.status !== 'Bekliyor') return false;
        const start = new Date(row.starts_at).getTime();
        return time >= start - BEFORE_MS && time <= start + AFTER_MS;
    }) || null;
}

export function reservationLabel(row) {
    const time = new Date(row.starts_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    return `${row.guest_name} · ${time} · ${row.party_size} kişi`;
}
