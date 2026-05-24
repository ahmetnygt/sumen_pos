import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import LiveDashboard from '../components/LiveDashboard';
import './Dashboard.css';

const Dashboard = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('tables'); // 'tables' veya 'fast-sale'

    // --- HIZLI SATIŞ İÇİN GEREKLİ STATELER ---
    const [menu, setMenu] = useState([]);
    const [activeCategoryId, setActiveCategoryId] = useState(null);
    const [pendingItems, setPendingItems] = useState([]);
    const [liveStats, setLiveStats] = useState({ dailyRevenue: 0, activeTables: 0 });

    // --- SEÇENEKLER POP-UP STATELERİ ---
    const [showModal, setShowModal] = useState(false);
    const [selectedProductForModal, setSelectedProductForModal] = useState(null);
    const [activeOptions, setActiveOptions] = useState([]);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (!storedUser) { navigate('/'); return; }
        setUser(JSON.parse(storedUser));
        fetchData();
    }, [navigate]);

    const fetchData = async () => {
        try {
            const [tableRes, menuRes] = await Promise.all([
                api.get('/tables'),
                api.get('/menu')
            ]);
            setTables(tableRes.data);
            setMenu(menuRes.data);
            if (menuRes.data.length > 0 && !activeCategoryId) setActiveCategoryId(menuRes.data[0].id);

            const active = tableRes.data.filter(t => t.status === 'Dolu').length;
            setLiveStats(prev => ({ ...prev, activeTables: active }));
        } catch (error) {
            console.error('Veriler çekilirken hata:', error);
        } finally {
            setLoading(false);
        }
    };

    // --- AKILLI SEPETE EKLEME MOTORU ---
    const handleStageItem = (product, selectedOptions = []) => {
        const extraPrice = selectedOptions.reduce((sum, opt) => sum + parseFloat(opt.price_diff || 0), 0);
        const basePrice = parseFloat(product.price || 0);
        const finalUnitPrice = basePrice + extraPrice;

        const optionsKey = selectedOptions.map(o => o.name).sort().join(',');
        const uniqueId = `${product.id}-${optionsKey}`;

        setPendingItems(prev => {
            const existing = prev.find(item => item.uniqueId === uniqueId);
            if (existing) {
                return prev.map(item =>
                    item.uniqueId === uniqueId
                        ? { ...item, quantity: item.quantity + 1, lineTotal: item.lineTotal + finalUnitPrice }
                        : item
                );
            }
            return [...prev, {
                ...product,
                uniqueId,
                quantity: 1,
                lineTotal: finalUnitPrice,
                basePrice: basePrice,
                selectedOptions
            }];
        });
    };

    // ÜRÜNE TIKLANINCA POP-UP'A YÖNLENDİR
    const handleProductClick = (product) => {
        if (product.ProductOptionGroups && product.ProductOptionGroups.length > 0) {
            setSelectedProductForModal(product);
            setActiveOptions([]);
            setShowModal(true);
        } else {
            handleStageItem(product, []);
        }
    };

    // ZORUNLU / EKSTRA SEÇİM MANTIĞI
    const handleOptionSelect = (group, opt) => {
        if (group.type === 'secim') {
            const groupOptionIds = group.ProductOptions.map(o => o.id);
            const filtered = activeOptions.filter(o => !groupOptionIds.includes(o.id));
            setActiveOptions([...filtered, opt]);
        } else {
            const exists = activeOptions.find(o => o.id === opt.id);
            if (exists) {
                setActiveOptions(activeOptions.filter(o => o.id !== opt.id));
            } else {
                setActiveOptions([...activeOptions, opt]);
            }
        }
    };

    // KİLİT MOTORU
    const isSelectionValid = () => {
        if (!selectedProductForModal) return false;
        const mandatoryGroups = selectedProductForModal.ProductOptionGroups.filter(g => g.type === 'secim');
        for (const group of mandatoryGroups) {
            const hasSelection = group.ProductOptions.some(opt => activeOptions.some(a => a.id === opt.id));
            if (!hasSelection) return false;
        }
        return true;
    };

    const confirmOptionsAndAdd = () => {
        handleStageItem(selectedProductForModal, activeOptions);
        setShowModal(false);
        setSelectedProductForModal(null);
    };

    const handleFastPay = async (method) => {
        if (pendingItems.length === 0) return;
        try {
            await api.post('/orders/fast-sale', { items: pendingItems, isPaid: true, paymentMethod: method });
            setPendingItems([]);
            alert(`Tahsilat (${method}) Tamamlandı!`);
            fetchData();
        } catch (error) { alert('Hata oluştu!'); }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/');
    };

    const getActiveProducts = () => {
        const category = menu.find(c => c.id === activeCategoryId);
        return category ? (category.Products || []) : [];
    };

    return (
        <div className="dashboard-layout">
            <header className="dashboard-header">
                <div className="logo-area">SÜMEN <span>POS</span></div>

                <div className="tab-container">
                    <button className={`tab-btn ${activeTab === 'tables' ? 'active' : ''}`} onClick={() => setActiveTab('tables')}>
                        🪑 MASALAR
                    </button>
                    <button className={`tab-btn ${activeTab === 'fast-sale' ? 'active' : ''}`} onClick={() => setActiveTab('fast-sale')}>
                        ⚡ HIZLI SATIŞ / SELF
                    </button>
                </div>

                <div className="user-area">
                    {user?.role === 'Admin' && <button onClick={() => navigate('/admin')} className="admin-btn">⚙️ YÖNETİM</button>}
                    <button onClick={handleLogout} className="logout-btn">Çıkış</button>
                </div>
            </header>

            <div className="dashboard-body-container">
                {activeTab === 'tables' ? (
                    <>
                        <main className="dashboard-main">
                            <div className="table-grid">
                                {tables.map(table => (
                                    <div key={table.id} className={`table-card ${table.status === 'Boş' ? 'table-success' : 'table-danger'}`} onClick={() => navigate(`/order/${table.id}`)}>
                                        <h3>{table.name}</h3>
                                        <p>{table.status}</p>
                                    </div>
                                ))}
                            </div>
                        </main>
                        <aside className="dashboard-sidebar">
                            <LiveDashboard />
                        </aside>
                    </>
                ) : (
                    <div className="fast-sale-tab-content">
                        <div className="fast-sale-menu">
                            <div className="category-tabs">
                                {menu.map(cat => (
                                    <button key={cat.id} className={activeCategoryId === cat.id ? 'active' : ''} onClick={() => setActiveCategoryId(cat.id)}>{cat.name}</button>
                                ))}
                            </div>
                            <div className="fast-product-grid">
                                {getActiveProducts().map(prod => (
                                    <button key={prod.id} className="fast-prod-card" onClick={() => handleProductClick(prod)}>
                                        <span>{prod.name}</span>
                                        <strong>₺{parseFloat(prod.price).toFixed(2)}</strong>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="fast-sale-sidebar">
                            <h3>🛒 SEPET</h3>
                            <div className="fast-order-list">
                                {pendingItems.map(item => (
                                    <div key={item.uniqueId} className="fast-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span>{item.quantity}x {item.name}</span>
                                            {item.selectedOptions && item.selectedOptions.length > 0 && (
                                                <span style={{ fontSize: '11px', color: '#d4af37' }}>↳ + {item.selectedOptions.map(o => o.name).join(', ')}</span>
                                            )}
                                        </div>
                                        <strong>₺{item.lineTotal.toFixed(2)}</strong>
                                    </div>
                                ))}
                            </div>
                            <div className="fast-checkout">
                                <div className="fast-total">TOPLAM: ₺{pendingItems.reduce((acc, i) => acc + (i.lineTotal || 0), 0).toFixed(2)}</div>
                                <div className="fast-actions">
                                    <button className="cash" onClick={() => handleFastPay('Nakit')}>💵 NAKİT</button>
                                    <button className="card" onClick={() => handleFastPay('Kredi Kartı')}>💳 KART</button>
                                </div>
                                <button className="clear" onClick={() => setPendingItems([])}>TEMİZLE</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* SEÇENEKLER POP-UP MİMARİSİ */}
            {showModal && selectedProductForModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
                        <div className="modal-header">
                            <h3>{selectedProductForModal.name}</h3>
                            <p>Lütfen tercihlerinizi belirleyin</p>
                        </div>
                        <div className="options-groups-container" style={{ overflowY: 'auto', padding: '10px 0', flex: 1 }}>
                            {selectedProductForModal.ProductOptionGroups.map(group => (
                                <div key={group.id} className="option-group-section" style={{ marginBottom: '20px', background: '#111', padding: '15px', borderRadius: '10px', border: '1px solid #333' }}>
                                    <h4 style={{ color: group.type === 'secim' ? '#ff4444' : '#00ffcc', margin: '0 0 15px 0', fontSize: '14px', borderBottom: '1px solid #222', paddingBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                                        <span>{group.name.toUpperCase()}</span>
                                        <span style={{ fontSize: '11px', opacity: 0.8 }}>{group.type === 'secim' ? 'ZORUNLU (1 Seçim)' : 'İSTEĞE BAĞLI'}</span>
                                    </h4>
                                    <div className="options-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        {group.ProductOptions.map(opt => {
                                            const isSelected = activeOptions.some(o => o.id === opt.id);
                                            return (
                                                <button
                                                    key={opt.id}
                                                    onClick={() => handleOptionSelect(group, opt)}
                                                    style={{
                                                        padding: '10px', borderRadius: '6px', border: '1px solid',
                                                        borderColor: isSelected ? (group.type === 'secim' ? '#ff4444' : '#00ffcc') : '#333',
                                                        background: isSelected ? (group.type === 'secim' ? 'rgba(255, 68, 68, 0.1)' : 'rgba(0, 255, 204, 0.1)') : '#1a1a1a',
                                                        color: isSelected ? '#fff' : '#aaa', cursor: 'pointer', display: 'flex', justifyContent: 'space-between'
                                                    }}
                                                >
                                                    <span>{opt.name}</span>
                                                    <span>{parseFloat(opt.price_diff) > 0 ? `+₺${opt.price_diff}` : ''}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="modal-actions" style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #333', display: 'flex', gap: '10px' }}>
                            <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: '12px', background: '#333', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>İptal</button>
                            <button
                                onClick={confirmOptionsAndAdd}
                                disabled={!isSelectionValid()}
                                style={{
                                    flex: 2, padding: '12px', border: 'none', borderRadius: '6px', fontWeight: 'bold',
                                    opacity: isSelectionValid() ? 1 : 0.4,
                                    cursor: isSelectionValid() ? 'pointer' : 'not-allowed',
                                    background: isSelectionValid() ? '#d4af37' : '#555',
                                    color: isSelectionValid() ? '#000' : '#888'
                                }}
                            >
                                {isSelectionValid() ? 'Siparişe Ekle' : 'Seçimleri Tamamlayın'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .tab-container { display: flex; gap: 10px; margin-left: 50px; }
                .tab-btn { padding: 10px 25px; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; background: #222; color: #888; transition: 0.3s; }
                .tab-btn.active { background: #d4af37; color: #000; box-shadow: 0 0 15px rgba(212, 175, 55, 0.3); }
                
                .fast-sale-tab-content { display: flex; width: 100%; height: 100%; background: #050505; }
                .fast-sale-menu { flex: 1; padding: 20px; display: flex; flex-direction: column; gap: 20px; }
                .category-tabs { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 10px; }
                .category-tabs button { padding: 10px 20px; background: #111; border: 1px solid #333; color: #fff; border-radius: 8px; cursor: pointer; white-space: nowrap; }
                .category-tabs button.active { border-color: #d4af37; color: #d4af37; }
                
                .fast-product-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; overflow-y: auto; }
                .fast-prod-card { background: #111; border: 1px solid #222; padding: 15px; border-radius: 10px; color: #fff; display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; }
                .fast-prod-card:hover { border-color: #d4af37; background: #151515; }
                
                .fast-sale-sidebar { width: 350px; background: #0a0a0a; border-left: 1px solid #222; padding: 20px; display: flex; flex-direction: column; }
                .fast-order-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; margin: 20px 0; }
                .fast-item { padding: 10px; background: #111; border-radius: 6px; font-size: 14px; }
                
                .fast-checkout { border-top: 2px dashed #333; padding-top: 20px; }
                .fast-total { font-size: 24px; font-weight: bold; color: #d4af37; text-align: center; margin-bottom: 20px; }
                .fast-actions { display: flex; gap: 10px; margin-bottom: 10px; }
                .fast-actions button { flex: 1; padding: 15px; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; color: #000; }
                .fast-actions .cash { background: #2ecc71; }
                .fast-actions .card { background: #3498db; }
                .clear { width: 100%; padding: 10px; background: transparent; color: #ff4444; border: 1px solid #ff4444; border-radius: 8px; cursor: pointer; }

                /* Modal Overlay */
                .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; justify-content: center; align-items: center; z-index: 1000; }
                .modal-content { background: #000; padding: 20px; border-radius: 12px; border: 1px solid #333; width: 450px; color: #fff; }
                .modal-header h3 { margin: 0; color: #d4af37; }
                .modal-header p { margin: 5px 0 0 0; font-size: 13px; color: #888; }
            `}</style>
        </div>
    );
};

export default Dashboard;