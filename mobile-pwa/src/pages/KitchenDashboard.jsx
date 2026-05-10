import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { io } from 'socket.io-client';

const KitchenDashboard = () => {
    const [orders, setOrders] = useState([]);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
        const backendUrl = api.defaults.baseURL.replace('/api', '');
        const socket = io(backendUrl);
        socket.on('updateKitchen', fetchData);
        return () => socket.disconnect();
    }, []);

    const fetchData = async () => {
        try {
            const [ordersRes, historyRes] = await Promise.all([
                api.get('/orders/kitchen'),
                api.get('/orders/kitchen/history')
            ]);
            setOrders(ordersRes.data || []);
            setHistory(historyRes.data || []);
        } catch (error) { console.error('Veri çekilemedi'); }
        finally { setLoading(false); }
    };

    const handleMarkReady = async (itemId, itemName) => {
        try {
            await api.post(`/orders/kitchen/${itemId}/ready`, { itemName });
        } catch (error) { alert('Hata oluştu!'); }
    };

    if (loading) return <div className="loading">Mutfak Hazırlanıyor...</div>;

    return (
        <div className="kitchen-layout" style={{ display: 'flex', height: '100vh', background: '#0a0a0a', fontFamily: 'Montserrat, sans-serif' }}>

            {/* ANA PANEL: AKTİF SİPARİŞLER (Flex: 3) */}
            <div className="active-orders-panel" style={{ flex: 3, padding: '20px', overflowY: 'auto', borderRight: '2px solid #222' }}>
                <header style={{ marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h1 style={{ color: '#e63946', margin: 0, fontWeight: '900' }}>🔥 AKTİF SİPARİŞLER ({orders.length})</h1>
                </header>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                    {orders.map(item => {
                        const options = typeof item.selected_options === 'string' ? JSON.parse(item.selected_options) : (item.selected_options || []);
                        const time = new Date(item.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

                        return (
                            <div key={item.id} className="order-card" style={{ background: '#111', borderRadius: '15px', border: '1px solid #333', padding: '15px', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', borderBottom: '1px solid #222', paddingBottom: '8px' }}>
                                    <span style={{ color: '#fff', fontSize: '22px', fontWeight: '900' }}>{item.Order?.Table?.name || `Masa ${item.Order?.table_id}`}</span>
                                    <span style={{ color: '#888', fontSize: '14px' }}>⏰ {time}</span>
                                </div>

                                <div style={{ marginBottom: '15px' }}>
                                    <h2 style={{ color: '#00ffcc', margin: '0 0 5px 0' }}>{item.quantity}x {item.Product?.name}</h2>
                                    {options.map((o, i) => <div key={i} style={{ color: '#d4af37', fontSize: '13px', fontWeight: 'bold' }}>↳ + {o.name}</div>)}
                                </div>

                                {item.Product?.instructions && (
                                    <div style={{ background: 'rgba(230,57,70,0.1)', padding: '10px', borderRadius: '8px', fontSize: '12px', color: '#ff7b7b', marginBottom: '15px' }}>
                                        <strong>NOT:</strong> {item.Product.instructions}
                                    </div>
                                )}

                                <div style={{ marginTop: 'auto', borderTop: '1px solid #222', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: '#666', fontSize: '11px' }}>🚶 {item.User?.name} {item.User?.surname}</span>
                                    <button onClick={() => handleMarkReady(item.id, item.Product?.name)} style={{ background: '#e63946', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>HAZIR</button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* YAN PANEL: GEÇMİŞ (Flex: 1) - Desktopta Görünür */}
            <div className="history-panel" style={{ flex: 1, background: '#070707', padding: '20px', overflowY: 'auto' }}>
                <h3 style={{ color: '#555', borderBottom: '1px solid #222', paddingBottom: '10px', fontSize: '16px' }}>🕒 SON TAMAMLANANLAR</h3>
                {history.map(h => (
                    <div key={h.id} style={{ padding: '10px', borderBottom: '1px solid #111', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <div style={{ color: '#aaa', fontSize: '13px', fontWeight: 'bold' }}>{h.Product?.name}</div>
                            <div style={{ color: '#444', fontSize: '11px' }}>{h.Order?.Table?.name}</div>
                        </div>
                        <span style={{ color: '#2ecc71', fontSize: '12px' }}>✅</span>
                    </div>
                ))}
            </div>

            {/* MOBİL CSS: Yan paneli telefonda gizleyebilir veya alta alabilirsin */}
            <style>{`
                @media (max-width: 768px) {
                    .kitchen-layout { flex-direction: column !important; }
                    .history-panel { display: none; }
                }
            `}</style>
        </div>
    );
};

export default KitchenDashboard;