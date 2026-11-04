import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './Shift.css';

const money = (value) => `${Number(value || 0).toFixed(2)} ₺`;

const Shift = () => {
    const navigate = useNavigate();
    const [current, setCurrent] = useState(null);
    const [startingCash, setStartingCash] = useState('0');
    const [endingCash, setEndingCash] = useState('');
    const [closed, setClosed] = useState(null);
    const [error, setError] = useState('');

    const load = async () => {
        const response = await api.get('/shifts/current');
        setCurrent(response.data);
    };

    useEffect(() => {
        const stored = localStorage.getItem('user');
        const user = stored ? JSON.parse(stored) : null;
        if (!user || (user.role !== 'Admin' && user.role !== 'Kasa')) {
            navigate('/dashboard');
            return;
        }
        load().catch((err) => setError(err.response?.data?.message || 'Vardiya alınamadı.'));
    }, [navigate]);

    const openShift = async (event) => {
        event.preventDefault();
        setError('');
        setClosed(null);
        try {
            await api.post('/shifts/open', { starting_cash: startingCash });
            await load();
        } catch (err) {
            setError(err.response?.data?.message || 'Vardiya açılamadı.');
        }
    };

    const closeShift = async (event) => {
        event.preventDefault();
        setError('');
        try {
            const response = await api.post('/shifts/close', { ending_cash: endingCash });
            setClosed(response.data);
            setEndingCash('');
            await load();
        } catch (err) {
            setError(err.response?.data?.message || 'Vardiya kapatılamadı.');
        }
    };

    const goBack = () => {
        const stored = localStorage.getItem('user');
        const user = stored ? JSON.parse(stored) : null;
        navigate(user?.role === 'Admin' ? '/admin' : '/dashboard');
    };

    const shift = current?.shift;

    return (
        <div className="shift-layout">
            <header className="shift-header">
                <button onClick={goBack} className="shift-back">Geri</button>
                <h2>VARDİYA</h2>
            </header>
            <main className="shift-content">
                {error && <p className="shift-error">{error}</p>}
                {!shift && (
                    <form className="shift-card" onSubmit={openShift}>
                        <h3>Kasa açılışı</h3>
                        <label>
                            <span>Açılış tutarı</span>
                            <input value={startingCash} onChange={(e) => setStartingCash(e.target.value)} inputMode="decimal" />
                        </label>
                        <button type="submit">Vardiyayı aç</button>
                    </form>
                )}
                {shift && (
                    <>
                        <div className="shift-grid">
                            <div><span>Açılış</span><strong>{money(shift.starting_cash)}</strong></div>
                            <div><span>Nakit</span><strong>{money(current.nakit)}</strong></div>
                            <div><span>Kart</span><strong>{money(current.kart)}</strong></div>
                            <div><span>Ciro</span><strong>{money(current.revenue)}</strong></div>
                            <div><span>Beklenen kasa</span><strong>{money(current.expected_cash)}</strong></div>
                        </div>
                        <form className="shift-card" onSubmit={closeShift}>
                            <h3>Kasa kapanışı</h3>
                            <label>
                                <span>Sayılan kasa</span>
                                <input value={endingCash} onChange={(e) => setEndingCash(e.target.value)} inputMode="decimal" required />
                            </label>
                            <button type="submit">Vardiyayı kapat</button>
                        </form>
                    </>
                )}
                {closed && (
                    <p className="shift-note">
                        Kapanış farkı: {money(closed.difference)}. Beklenen kasa {money(closed.expected_cash)}.
                    </p>
                )}
            </main>
        </div>
    );
};

export default Shift;
