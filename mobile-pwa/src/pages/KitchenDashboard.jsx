import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { io } from 'socket.io-client';

const KitchenDashboard = () => {
    const [orders, setOrders] = useState([]);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showHistory, setShowHistory] = useState(false);
    const [showRecipeModal, setShowRecipeModal] = useState(null);

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

    // Tek bir ürünü hazır işaretle
    const handleMarkReady = async (itemId, itemName) => {
        try {
            await api.post(`/orders/kitchen/${itemId}/ready`, { itemName });
        } catch (error) { alert('Hata oluştu!'); }
    };

    // Masadaki TÜM ürünleri tek tuşla hazır işaretle (Mermili gönderim)
    const handleMarkAllReady = async (items) => {
        try {
            const itemIds = items.map(i => i.id);
            await api.post(`/orders/kitchen/bulk-ready`, { itemIds });
        } catch (error) { alert('Masayı kapatırken hata oluştu!'); }
    };

    // BÜYÜ BURADA: Gelen dağınık ürünleri MASALARA GÖRE gruplayan motor
    const groupedOrders = orders.reduce((acc, item) => {
        const tableId = item.Order?.table_id;
        const tableName = item.Order?.Table?.name || `Masa ${tableId}`;

        if (!acc[tableId]) {
            acc[tableId] = {
                tableId,
                tableName,
                // İlk ürünün zamanını masanın açılış zamanı sayıyoruz
                time: item.created_at || item.createdAt,
                waiter: item.User?.name || 'Sistem',
                items: []
            };
        }
        acc[tableId].items.push(item);
        return acc;
    }, {});

    const ticketList = Object.values(groupedOrders);

    if (loading) return <div style={{ color: '#fff', textAlign: 'center', marginTop: '50px' }}>Şefim Mutfak Hazırlanıyor...</div>;

    return (
        <div className="kds-container">
            {/* SOL TARAF: AKTİF ADİSYONLAR */}
            <div className="kds-main">
                <header className="kds-header">
                    <div className="header-title">
                        <span className="live-dot"></span>
                        <h1>MUTFAK RADARI</h1>
                        <span className="badge">{ticketList.length} Masa Bekliyor</span>
                    </div>
                    <button className="mobile-history-trigger" onClick={() => setShowHistory(true)}>
                        🕒 Geçmiş
                    </button>
                </header>

                <div className="kds-grid">
                    {ticketList.map(ticket => {
                        const timeStr = ticket.time
                            ? new Date(ticket.time).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
                            : 'Bilinmiyor';

                        return (
                            <div key={ticket.tableId} className="ticket-card">
                                {/* ADİSYON BAŞLIĞI */}
                                <div className="ticket-header">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span className="t-name">{ticket.tableName}</span>
                                        <span className="t-time">⏰ {timeStr}</span>
                                    </div>
                                    <div className="t-waiter">👤 Garson: {ticket.waiter}</div>
                                </div>

                                {/* ADİSYON İÇERİĞİ (ÜRÜNLER) */}
                                <div className="ticket-body">
                                    {ticket.items.map(item => {
                                        let options = [];
                                        try {
                                            let parsed = item.selected_options;
                                            if (typeof parsed === 'string') parsed = JSON.parse(parsed);
                                            if (typeof parsed === 'string') parsed = JSON.parse(parsed);
                                            if (Array.isArray(parsed)) options = parsed;
                                        } catch (e) { options = []; }

                                        return (
                                            <div key={item.id} className="ticket-item-row">
                                                <div className="item-details">
                                                    <div className="item-title">
                                                        <span className="qty">{item.quantity}x</span> {item.Product?.name}
                                                    </div>

                                                    {/* SEÇENEKLER */}
                                                    {Array.isArray(options) && options.length > 0 && (
                                                        <div className="item-options">
                                                            {options.map((o, i) => <span key={i}>+{o.name} </span>)}
                                                        </div>
                                                    )}

                                                    {/* TARİF NOTU / BUTONU */}
                                                    {item.Product?.instructions && (
                                                        <div className="item-recipe" onClick={() => setShowRecipeModal(item)}>
                                                            📖 Tarife Bak
                                                        </div>
                                                    )}
                                                </div>

                                                {/* TEK ÜRÜNÜ GÖNDERME BUTONU */}
                                                <button className="check-btn" onClick={() => handleMarkReady(item.id, item.Product?.name)}>
                                                    ✓
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* ADİSYON ALTI: TÜMÜNÜ GÖNDER */}
                                <div className="ticket-footer">
                                    <button className="send-all-btn" onClick={() => handleMarkAllReady(ticket.items)}>
                                        🚀 TÜMÜNÜ GÖNDER
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                    {ticketList.length === 0 && (
                        <div style={{ color: '#555', fontSize: '18px', gridColumn: '1 / -1', textAlign: 'center', marginTop: '50px' }}>
                            Bekleyen adisyon yok, şefim rahat! ☕
                        </div>
                    )}
                </div>
            </div>

            {/* SAĞ TARAF / MOBİL ÇEKMECE: GEÇMİŞ PANELİ */}
            <div className={`kds-sidebar ${showHistory ? 'mobile-open' : ''}`}>
                <div className="sidebar-header">
                    <h3>SON TAMAMLANANLAR</h3>
                    <button className="mobile-close" onClick={() => setShowHistory(false)}>✕ Kapat</button>
                </div>
                <div className="history-scroll">
                    {history.map(h => {
                        const doneTime = new Date(h.updated_at || h.updatedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                        return (
                            <div key={h.id} className="history-item">
                                <div className="history-info">
                                    <span className="h-product">{h.Product?.name}</span>
                                    <span className="h-table">{h.Order?.Table?.name}</span>
                                </div>
                                <div className="history-meta">
                                    <span className="h-time">{doneTime}</span>
                                    <span className="h-user">{h.User?.name || 'Pers.'}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* TARİF MODAL (POP-UP) */}
            {showRecipeModal && (
                <div className="recipe-modal-overlay" onClick={() => setShowRecipeModal(null)}>
                    <div className="recipe-modal" onClick={e => e.stopPropagation()}>
                        <h2>{showRecipeModal.Product?.name} Hazırlanışı</h2>
                        <div className="recipe-text">
                            {showRecipeModal.Product?.instructions}
                        </div>
                        <button className="modal-close-btn" onClick={() => setShowRecipeModal(null)}>Anladım</button>
                    </div>
                </div>
            )}

            <style>{`
                .kds-container { display: flex; height: 100vh; background: #050505; color: #fff; overflow: hidden; font-family: 'Montserrat', sans-serif; }
                .kds-main { flex: 1; display: flex; flex-direction: column; padding: 20px; overflow-y: auto; }
                
                .kds-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; border-bottom: 1px solid #222; padding-bottom: 15px; }
                .header-title { display: flex; align-items: center; gap: 15px; }
                .header-title h1 { color: #e63946; margin: 0; font-weight: 900; letter-spacing: 1px; }
                .live-dot { width: 12px; height: 12px; background: #ff4444; border-radius: 50%; box-shadow: 0 0 12px #ff4444; animation: blink 1.5s infinite; }
                .badge { background: #222; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: bold; color: #d4af37; border: 1px solid #333; }
                
                .kds-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; align-items: start; }
                
                /* TICKET (ADİSYON) KART TASARIMI */
                .ticket-card { background: #111; border: 1px solid #333; border-radius: 12px; display: flex; flex-direction: column; box-shadow: 0 8px 25px rgba(0,0,0,0.6); overflow: hidden; }
                
                .ticket-header { background: #1a1a1a; padding: 15px; border-bottom: 2px dashed #333; }
                .t-name { font-weight: 900; font-size: 20px; color: #d4af37; }
                .t-time { font-size: 13px; color: #aaa; background: #222; padding: 4px 8px; border-radius: 6px; }
                .t-waiter { font-size: 12px; color: #666; margin-top: 8px; font-weight: 600; }
                
                .ticket-body { padding: 10px; display: flex; flex-direction: column; gap: 8px; }
                
                .ticket-item-row { background: #0a0a0a; border: 1px solid #222; border-radius: 8px; padding: 12px; display: flex; justify-content: space-between; align-items: center; transition: 0.2s; }
                .ticket-item-row:hover { border-color: #444; }
                
                .item-details { flex: 1; padding-right: 15px; }
                .item-title { font-size: 16px; font-weight: bold; color: #fff; }
                .qty { color: #00ffcc; font-weight: 900; margin-right: 5px; }
                
                .item-options { margin-top: 6px; font-size: 12px; color: #d4af37; font-weight: 600; }
                .item-recipe { margin-top: 8px; display: inline-block; font-size: 11px; background: rgba(230,57,70,0.1); color: #ff7b7b; padding: 4px 8px; border-radius: 4px; cursor: pointer; border: 1px solid #442222; }
                .item-recipe:hover { background: #e63946; color: #fff; }

                .check-btn { width: 45px; height: 45px; border-radius: 10px; border: 2px solid #333; background: #111; color: #555; font-size: 20px; font-weight: bold; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; }
                .check-btn:hover { background: #2ecc71; border-color: #2ecc71; color: #000; }

                .ticket-footer { padding: 15px; background: #151515; border-top: 1px solid #222; }
                .send-all-btn { width: 100%; padding: 14px; background: #e63946; color: #fff; border: none; border-radius: 8px; font-weight: 900; font-size: 15px; cursor: pointer; letter-spacing: 1px; transition: 0.2s; }
                .send-all-btn:hover { background: #ff4a5a; box-shadow: 0 0 15px rgba(230,57,70,0.4); }

                /* SİDEBAR (GEÇMİŞ) */
                .kds-sidebar { width: 320px; background: #0a0a0a; border-left: 1px solid #222; display: flex; flex-direction: column; transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
                .sidebar-header { padding: 20px; border-bottom: 1px solid #222; display: flex; justify-content: space-between; align-items: center; }
                .history-scroll { flex: 1; overflow-y: auto; padding: 10px; }
                .history-item { background: #111; padding: 12px; border-radius: 10px; margin-bottom: 10px; border-left: 3px solid #2ecc71; }
                .h-product { display: block; font-weight: bold; font-size: 14px; color: #ddd; }
                .h-table { font-size: 11px; color: #666; margin-top: 4px; display: block; }
                .history-meta { display: flex; justify-content: space-between; margin-top: 8px; font-size: 11px; color: #555; font-weight: 600; }

                /* MODAL */
                .recipe-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(5px); display: flex; align-items: center; justify-content: center; z-index: 1000; }
                .recipe-modal { background: #111; padding: 30px; border-radius: 16px; width: 90%; max-width: 500px; border: 1px solid #333; box-shadow: 0 20px 50px rgba(0,0,0,0.8); }
                .recipe-modal h2 { margin: 0 0 15px 0; color: #00ffcc; border-bottom: 1px solid #222; padding-bottom: 15px; }
                .recipe-text { background: #000; padding: 20px; border-radius: 8px; margin: 0 0 20px 0; line-height: 1.6; color: #eee; font-size: 15px; border: 1px dashed #333; }
                .modal-close-btn { width: 100%; padding: 14px; background: #e63946; border: none; color: #fff; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 16px; }

                .mobile-history-trigger, .mobile-close { display: none; }

                @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }

                /* RESPONSIVE DOKUNUŞLAR */
                @media (max-width: 1024px) {
                    .kds-sidebar { width: 280px; }
                    .kds-grid { grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
                }

                @media (max-width: 768px) {
                    .kds-sidebar { position: fixed; right: -100%; top: 0; bottom: 0; width: 100%; z-index: 2000; background: #050505; }
                    .kds-sidebar.mobile-open { right: 0; }
                    .mobile-history-trigger { display: block; background: #222; border: 1px solid #444; color: #fff; padding: 8px 15px; border-radius: 8px; font-weight: bold; cursor: pointer; margin:.5rem; }
                    .mobile-close { display: block; padding: 8px 12px; background: transparent; border: 1px solid #ff4444; color: #ff4444; border-radius: 6px; font-weight: bold; cursor: pointer; }
                    .kds-main { width: 100%; }
                }
            `}</style>
        </div>
    );
};

export default KitchenDashboard;