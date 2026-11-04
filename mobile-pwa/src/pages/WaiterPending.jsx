import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './Dashboard.css';

function clock(value) {
    return new Date(value).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

const WaiterPending = () => {
    const navigate = useNavigate();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        try {
            const response = await api.get('/orders/mine/pending');
            setRows(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Bekleyen siparişler alınamadı:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        const timer = setInterval(load, 5000);
        return () => clearInterval(timer);
    }, []);

    const serve = async (id) => {
        try {
            await api.post(`/orders/items/${id}/served`);
            setRows(current => current.filter(row => row.id !== id));
        } catch (error) {
            console.error('Sipariş götürülemedi:', error);
        }
    };

    return (
        <div className="mine-page">
            <header className="mine-header">
                <button type="button" className="mine-back" onClick={() => navigate('/waiter-dashboard')}>Geri</button>
                <h2>Bekleyen siparişler</h2>
            </header>
            <main className="mine-body">
                {loading && <p className="mine-empty">Yükleniyor...</p>}
                {!loading && rows.length === 0 && <p className="mine-empty">Bekleyen sipariş yok.</p>}
                {rows.map(row => (
                    <article key={row.id} className={`mine-row${row.status === 'Hazır' ? ' ready' : ''}`}>
                        <button
                            type="button"
                            className="mine-open"
                            onClick={() => { if (row.table_id) navigate(`/waiter-order/${row.table_id}`); }}
                        >
                            <strong>{clock(row.at)} · {row.table_name}</strong>
                            <span>{row.quantity}x {row.name}</span>
                            {row.options && <span className="mine-meta">↳ + {row.options}</span>}
                            <span className="mine-status">{row.status === 'Hazır' ? 'Servise hazır' : 'Mutfakta'}</span>
                        </button>
                        {row.status === 'Hazır' && (
                            <button type="button" className="mine-serve" onClick={() => serve(row.id)}>Servis ettim</button>
                        )}
                    </article>
                ))}
            </main>
        </div>
    );
};

export default WaiterPending;
