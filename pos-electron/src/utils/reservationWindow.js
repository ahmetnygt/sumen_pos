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

export function formatPhone(value) {
    let digits = String(value || '').replace(/\D/g, '');
    if (digits.startsWith('90') && digits.length > 11) digits = digits.slice(2);
    if (digits.startsWith('5')) digits = `0${digits}`;
    digits = digits.slice(0, 11);
    return [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7, 9), digits.slice(9, 11)]
        .filter(Boolean)
        .join(' ');
}
