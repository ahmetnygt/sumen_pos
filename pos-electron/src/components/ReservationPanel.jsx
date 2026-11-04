import React, { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import DateTimeField from './DateTimeField';
import { formatPhone, todayKey } from '../utils/reservationWindow';
import './ReservationPanel.css';

const emptyForm = { guest_name: '', phone: '', party_size: '2', time: '', table_id: '', note: '' };

function clock(value) {
    return new Date(value).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

const ReservationSide = ({ tables, onChanged, onArrive }) => {
    const [day, setDay] = useState(todayKey);
    const [rows, setRows] = useState([]);
    const [adding, setAdding] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [error, setError] = useState('');
    const phoneRef = useRef(null);

    const load = async (date) => {
        setError('');
        try {
            const response = await api.get('/reservations', { params: { date } });
            setRows(Array.isArray(response.data) ? response.data : []);
        } catch (err) {
            setError(err.response?.data?.message || 'Rezervasyonlar alınamadı.');
        }
    };

    useEffect(() => {
        if (!day) return undefined;
        load(day);
        return undefined;
    }, [day]);

    const setField = (key, value) => setForm(current => ({ ...current, [key]: value }));

    const onPhone = (event) => {
        const next = formatPhone(event.target.value);
        setField('phone', next);
        requestAnimationFrame(() => {
            const field = phoneRef.current;
            if (!field) return;
            field.setSelectionRange(next.length, next.length);
        });
    };

    const closeForm = () => {
        setAdding(false);
        setForm(emptyForm);
        setError('');
    };

    const save = async (event) => {
        event.preventDefault();
        setError('');
        try {
            await api.post('/reservations', {
                guest_name: form.guest_name,
                phone: formatPhone(form.phone),
                party_size: Number(form.party_size),
                table_id: Number(form.table_id),
                starts_at: `${day}T${form.time}`,
                note: form.note
            });
            closeForm();
            await load(day);
            if (onChanged) onChanged();
        } catch (err) {
            setError(err.response?.data?.message || 'Rezervasyon eklenemedi.');
        }
    };

    const mark = async (row, status) => {
        setError('');
        try {
            await api.patch(`/reservations/${row.id}`, { status });
            await load(day);
            if (onChanged) onChanged();
            if (status === 'Geldi' && onArrive) onArrive(row);
        } catch (err) {
            setError(err.response?.data?.message || 'Rezervasyon güncellenemedi.');
        }
    };

    return (
        <div className="res-side">
            <div className="res-side-bar">
                <DateTimeField dateOnly value={day} onChange={setDay} />
            </div>
            {error && !adding && <p className="res-error">{error}</p>}
            <div className="res-side-scroll">
                {rows.length === 0 && <p className="res-empty">Bu günde rezervasyon yok.</p>}
                <div className="res-list">
                    {rows.map(row => (
                        <article className={`res-item ${row.status}`} key={row.id}>
                            <div className="res-item-top">
                                <time>{clock(row.starts_at)}</time>
                                <span className={`res-status ${row.status}`}>{row.status}</span>
                            </div>
                            <div className="res-guest-line">
                                <strong>{row.guest_name}</strong>
                                <span>{row.party_size} kişi</span>
                            </div>
                            <div className="res-meta">
                                <span><em>Masa</em>{row.table_name || '—'}</span>
                                {row.phone ? <span><em>Tel</em>{formatPhone(row.phone)}</span> : null}
                            </div>
                            {row.note ? <p className="res-note">{row.note}</p> : null}
                            {row.status === 'Bekliyor' && (
                                <div className="res-actions">
                                    <button type="button" className="res-arrive" onClick={() => mark(row, 'Geldi')}>Geldi</button>
                                    <button type="button" onClick={() => mark(row, 'Gelmedi')}>Gelmedi</button>
                                    <button type="button" onClick={() => mark(row, 'İptal')}>İptal</button>
                                </div>
                            )}
                        </article>
                    ))}
                </div>
            </div>
            <button type="button" className="res-add res-side-add" onClick={() => { setError(''); setAdding(true); }}>Rezervasyon ekle</button>
            {adding && (
                <div className="res-modal" onClick={closeForm}>
                    <form className="res-card res-form-card" onClick={(event) => event.stopPropagation()} onSubmit={save}>
                        <h3>Rezervasyon ekle</h3>
                        {error && <p className="res-error">{error}</p>}
                        <div className="res-form">
                            <label className="res-span">Misafir<input value={form.guest_name} onChange={(event) => setField('guest_name', event.target.value)} required /></label>
                            <label>Telefon<input ref={phoneRef} inputMode="tel" value={form.phone} onChange={onPhone} placeholder="05XX XXX XX XX" /></label>
                            <label>Kişi<input type="number" min="1" value={form.party_size} onChange={(event) => setField('party_size', event.target.value)} /></label>
                            <label className="res-span">Saat<input type="time" value={form.time} onChange={(event) => setField('time', event.target.value)} required /></label>
                            <label className="res-span">Masa
                                <select value={form.table_id} onChange={(event) => setField('table_id', event.target.value)} required>
                                    <option value="">Seçin</option>
                                    {tables.map(table => (
                                        <option key={table.id} value={table.id}>{table.name}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="res-span">Not<input value={form.note} onChange={(event) => setField('note', event.target.value)} /></label>
                        </div>
                        <div className="res-form-actions">
                            <button type="button" className="res-ghost" onClick={closeForm}>Vazgeç</button>
                            <button type="submit" className="res-add">Kaydet</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default ReservationSide;
