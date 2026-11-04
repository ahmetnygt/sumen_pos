import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './Dashboard.css';

function clock(value) {
    return new Date(value).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function money(value) {
    return `₺${Number(value || 0).toFixed(2)}`;
}

const WaiterHistory = () => {
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/orders/mine/today')
            .then(response => {
                setItems(Array.isArray(response.data?.items) ? response.data.items : []);
                setPayments(Array.isArray(response.data?.payments) ? response.data.payments : []);
            })
            .catch(error => console.error('Geçmiş alınamadı:', error))
            .finally(() => setLoading(false));
    }, []);

    const empty = !loading && items.length === 0 && payments.length === 0;

    return (
        <div className="mine-page">
            <header className="mine-header">
                <button type="button" className="mine-back" onClick={() => navigate('/waiter-dashboard')}>Geri</button>
                <h2>Geçmiş</h2>
            </header>
            <main className="mine-body">
                {loading && <p className="mine-empty">Yükleniyor...</p>}
                {empty && <p className="mine-empty">Bugün işlem yok.</p>}
                {!loading && !empty && (
                    <>
                        <section className="mine-section">
                            <h3>ÜRÜNLER</h3>
                            {items.length === 0 && <p className="mine-empty">Bugün ürün yok.</p>}
                            {items.map(row => (
                                <div key={row.id} className="mine-row">
                                    <strong>{clock(row.at)} · {row.table_name}</strong>
                                    <span>{row.quantity}x {row.name}</span>
                                    {row.options && <span className="mine-meta">↳ + {row.options}</span>}
                                    <span className="mine-status">{row.status}</span>
                                </div>
                            ))}
                        </section>
                        <section className="mine-section">
                            <h3>TAHSİLATLAR</h3>
                            {payments.length === 0 && <p className="mine-empty">Bugün tahsilat yok.</p>}
                            {payments.map(row => (
                                <div key={row.id} className="mine-row">
                                    <strong>{clock(row.at)} · {row.table_name}</strong>
                                    <span>{row.method}</span>
                                    <span className="mine-status">{money(row.amount)}</span>
                                </div>
                            ))}
                        </section>
                    </>
                )}
            </main>
        </div>
    );
};

export default WaiterHistory;
