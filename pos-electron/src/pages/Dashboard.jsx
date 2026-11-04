import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../services/api';
import LiveDashboard from '../components/LiveDashboard';
import FloorPlan from '../components/FloorPlan';
import ReservationSide from '../components/ReservationPanel';
import { placeTables } from '../utils/tableLayout';
import { holdingReservation, reservationLabel, todayKey } from '../utils/reservationWindow';
import { MenuGlyph, ProductMark } from '../components/menuIcons';
import StockWarn, { shortagesFor, stockShortages } from '../components/StockWarn';
import BrandMark from '../components/BrandMark';
import { readBrand } from '../utils/brand';
import './Dashboard.css';

function shortageText(rows) {
    return (rows || []).map(row => row.name).filter(Boolean).join(', ');
}

const Dashboard = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const brand = readBrand();
    const [tables, setTables] = useState([]);
    const [decorations, setDecorations] = useState([]);
    const [salons, setSalons] = useState([]);
    const [salonId, setSalonId] = useState(() => {
        const stored = parseInt(localStorage.getItem('sumen-salon-id'), 10);
        return Number.isInteger(stored) ? stored : null;
    });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('tables'); // 'tables' veya 'fast-sale'

    // --- HIZLI SATIŞ İÇİN GEREKLİ STATELER ---
    const [menu, setMenu] = useState([]);
    const [availability, setAvailability] = useState({ products: {}, options: {} });
    const busy = useRef(false);
    const [activeCategoryId, setActiveCategoryId] = useState(null);
    const [pendingItems, setPendingItems] = useState([]);
    const [liveStats, setLiveStats] = useState({ dailyRevenue: 0, activeTables: 0 });
    const [tableView, setTableView] = useState(() => localStorage.getItem('sumen-table-view') === 'plan' ? 'plan' : 'list');
    const [reservations, setReservations] = useState([]);
    const [sideView, setSideView] = useState('flow');
    const [tableWarn, setTableWarn] = useState(null);

    // --- SEÇENEKLER POP-UP STATELERİ ---
    const [showModal, setShowModal] = useState(false);
    const [selectedProductForModal, setSelectedProductForModal] = useState(null);
    const [activeOptions, setActiveOptions] = useState([]);
    const [stockWarn, setStockWarn] = useState(null);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (!storedUser) { navigate('/'); return; }
        setUser(JSON.parse(storedUser));
        fetchData();
    }, [navigate]);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return undefined;
        const socket = io(api.defaults.baseURL.replace(/\/api\/?$/, ''), { auth: { token } });
        socket.on('updateTables', fetchData);
        return () => socket.disconnect();
    }, []);

    const fetchData = async () => {
        try {
            const [tableRes, decorRes, salonRes, menuRes, availRes, shiftRes, reservationRes] = await Promise.all([
                api.get('/tables'),
                api.get('/tables/decorations').catch(() => ({ data: [] })),
                api.get('/tables/salons').catch(() => ({ data: [] })),
                api.get('/menu'),
                api.get('/menu/availability').catch(() => ({ data: { products: {}, options: {} } })),
                api.get('/shifts/current').catch(() => ({ data: { revenue: 0 } })),
                api.get('/reservations', { params: { date: todayKey() } }).catch(() => ({ data: [] }))
            ]);
            setTables(tableRes.data);
            setReservations(Array.isArray(reservationRes.data) ? reservationRes.data : []);
            setDecorations(Array.isArray(decorRes.data) ? decorRes.data : []);
            setSalons(Array.isArray(salonRes.data) ? salonRes.data : []);
            setMenu(menuRes.data);
            setAvailability(availRes.data || { products: {}, options: {} });
            if (menuRes.data.length > 0 && !activeCategoryId) setActiveCategoryId(menuRes.data[0].id);

            const active = tableRes.data.filter(t => t.status === 'Dolu').length;
            setLiveStats({ activeTables: active, dailyRevenue: Number(shiftRes.data.revenue) || 0 });
        } catch (error) {
            console.error('Veriler çekilirken hata:', error);
        } finally {
            setLoading(false);
        }
    };

    // --- AKILLI SEPETE EKLEME MOTORU ---
    const handleStageItem = (product, selectedOptions = [], allowShort = false) => {
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
                        ? { ...item, quantity: item.quantity + 1, lineTotal: item.lineTotal + finalUnitPrice, allowShort: item.allowShort || allowShort }
                        : item
                );
            }
            return [...prev, {
                ...product,
                uniqueId,
                quantity: 1,
                lineTotal: finalUnitPrice,
                basePrice: basePrice,
                selectedOptions,
                allowShort
            }];
        });
    };

    const stageOrWarn = (product, selectedOptions = []) => {
        const rows = shortagesFor(availability, product, selectedOptions);
        if (rows.length) {
            setStockWarn({ product, selectedOptions, rows });
            return;
        }
        handleStageItem(product, selectedOptions, false);
    };

    const acceptStockWarn = () => {
        const warn = stockWarn;
        setStockWarn(null);
        if (!warn) return;
        if (warn.sale) warn.sale();
        else handleStageItem(warn.product, warn.selectedOptions, true);
    };

    // ÜRÜNE TIKLANINCA POP-UP'A YÖNLENDİR
    const handleProductClick = (product) => {
        if (product.ProductOptionGroups && product.ProductOptionGroups.length > 0) {
            setSelectedProductForModal(product);
            setActiveOptions([]);
            setShowModal(true);
        } else {
            stageOrWarn(product, []);
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
        const product = selectedProductForModal;
        const options = activeOptions;
        setShowModal(false);
        setSelectedProductForModal(null);
        stageOrWarn(product, options);
    };

    const handleRemovePending = (uniqueId) => {
        setPendingItems(prev => {
            const existing = prev.find(item => item.uniqueId === uniqueId);
            if (!existing) return prev;
            if (existing.quantity > 1) {
                const unit = existing.lineTotal / existing.quantity;
                return prev.map(item =>
                    item.uniqueId === uniqueId
                        ? { ...item, quantity: item.quantity - 1, lineTotal: item.lineTotal - unit }
                        : item
                );
            }
            return prev.filter(item => item.uniqueId !== uniqueId);
        });
    };

    const handleFastPay = async (method, forceShort = false) => {
        if (pendingItems.length === 0 || busy.current) return;
        busy.current = true;
        try {
            const items = pendingItems.map(item => ({
                productId: item.id,
                quantity: item.quantity,
                optionIds: (item.selectedOptions || []).map(opt => opt.id)
            }));
            await api.post('/orders/fast-sale', {
                items, isPaid: true, paymentMethod: method,
                confirmShortage: forceShort || pendingItems.some(item => item.allowShort)
            });
            setPendingItems([]);
            alert(`Tahsilat (${method}) Tamamlandı!`);
            fetchData();
        } catch (error) {
            const shortages = stockShortages(error);
            if (shortages) {
                setStockWarn({ rows: shortages, sale: () => handleFastPay(method, true) });
                return;
            }
            alert(error.response?.data?.message || 'Hata oluştu!');
        }
        finally { busy.current = false; }
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

    const activeSalonId = salons.some(salon => salon.id === salonId) ? salonId : salons[0]?.id;
    const chooseSalon = (id) => {
        setSalonId(id);
        localStorage.setItem('sumen-salon-id', String(id));
    };
    const pendingTotal = pendingItems.reduce((acc, item) => acc + (item.lineTotal || 0), 0);
    const salonTables = tables.filter(table => table.salon_id === activeSalonId);
    const salonDecor = decorations.filter(item => item.salon_id === activeSalonId);
    const openTable = (table) => {
        const hold = holdingReservation(reservations, table);
        if (hold) {
            setTableWarn({ table, reservation: hold });
            return;
        }
        navigate(`/order/${table.id}`);
    };

    return (
        <div className="dashboard-layout">
            <header className="dashboard-header">
                <div className="logo-area">{brand ? <BrandMark brand={brand} /> : 'SÜMEN POS'}</div>

                <div className="tab-container">
                    <button className={`tab-btn ${activeTab === 'tables' ? 'active' : ''}`} onClick={() => setActiveTab('tables')}>
                        MASALAR
                    </button>
                    <button className={`tab-btn ${activeTab === 'fast-sale' ? 'active' : ''}`} onClick={() => setActiveTab('fast-sale')}>
                        HIZLI SATIŞ / SELF
                    </button>
                </div>

                <div className="user-area">
                    <button className="shift-chip" onClick={() => navigate('/shift')}>
                        Vardiya {Number(liveStats.dailyRevenue || 0).toFixed(2)} ₺
                    </button>
                    {user?.company_name && (
                        <span className="admin-badge" style={{ marginRight: 12 }}>
                            {user.company_name}{user.branch_name ? ` · ${user.branch_name}` : ''}
                        </span>
                    )}
                    {user?.role === 'Admin' && <button onClick={() => navigate('/admin')} className="admin-btn">⚙️ YÖNETİM</button>}
                    <button onClick={handleLogout} className="logout-btn">Çıkış</button>
                </div>
            </header>

            <div className="dashboard-body-container">
                {activeTab === 'tables' ? (
                    <>
                        <main className={`dashboard-main ${tableView === 'plan' ? 'dashboard-main-plan' : ''}`}>
                            {salons.length > 0 && (
                                <div className="salon-tabs">
                                    {salons.map(salon => (
                                        <button
                                            type="button"
                                            key={salon.id}
                                            className={salon.id === activeSalonId ? 'active' : ''}
                                            onClick={() => chooseSalon(salon.id)}
                                        >{salon.name}</button>
                                    ))}
                                </div>
                            )}
                            <div className="table-view-switch">
                                <button type="button" className={tableView === 'list' ? 'active' : ''} onClick={() => { setTableView('list'); localStorage.setItem('sumen-table-view', 'list'); }}>Liste</button>
                                <button type="button" className={tableView === 'plan' ? 'active' : ''} onClick={() => { setTableView('plan'); localStorage.setItem('sumen-table-view', 'plan'); }}>Plan</button>
                            </div>
                            <div className="dashboard-main-scroll">
                                {tableView === 'list' ? (
                                    <div className="table-grid">
                                        {salonTables.map(table => {
                                            const hold = holdingReservation(reservations, table);
                                            const tone = table.status !== 'Boş' ? 'table-danger' : hold ? 'table-reserved' : 'table-success';
                                            return (
                                                <div key={table.id} className={`table-card ${tone}`} onClick={() => openTable(table)}>
                                                    <h3>{table.name}</h3>
                                                    <p className={hold ? 'table-hold' : ''}>{hold ? reservationLabel(hold) : table.status}</p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <FloorPlan
                                        tables={placeTables(salonTables).map(table => ({
                                            ...table,
                                            hold: holdingReservation(reservations, table)
                                        }))}
                                        decorations={salonDecor}
                                        onOpen={openTable}
                                    />
                                )}
                            </div>
                        </main>
                        <aside className="dashboard-sidebar">
                            <LiveDashboard view={sideView} onView={setSideView}>
                                <ReservationSide
                                    tables={tables}
                                    onChanged={fetchData}
                                    onArrive={(row) => navigate(`/order/${row.table_id}`)}
                                />
                            </LiveDashboard>
                        </aside>
                    </>
                ) : (
                    <div className="fast-sale-tab-content">
                        <div className="menu-panel">
                            <div className="category-slider">
                                {menu.map(cat => (
                                    <button key={cat.id} type="button" className={`cat-btn ${activeCategoryId === cat.id ? 'active' : ''}`} onClick={() => setActiveCategoryId(cat.id)}>
                                        <MenuGlyph name={cat.icon} />
                                        {cat.name}
                                    </button>
                                ))}
                            </div>
                            <div className="product-grid">
                                {getActiveProducts().map(prod => (
                                    <button key={prod.id} type="button" className="prod-btn" onClick={() => handleProductClick(prod)}>
                                        <span className="prod-visual">
                                            <ProductMark photo={prod.photo} icon={menu.find(cat => cat.id === activeCategoryId)?.icon} />
                                        </span>
                                        <span className="prod-name">{prod.name}</span>
                                        <span className="prod-price">₺{parseFloat(prod.price).toFixed(2)}</span>
                                        {shortageText(availability.products?.[prod.id]) && (
                                            <span className="prod-stock">Stok yok: {shortageText(availability.products[prod.id])}</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="receipt-panel">
                            <div className="receipt-header">
                                <h2>HIZLI SATIŞ</h2>
                            </div>
                            <div className="receipt-body">
                                <div className="receipt-scroll">
                                    {pendingItems.length === 0 ? (
                                        <p className="fast-empty">Sepet boş.</p>
                                    ) : (
                                        <>
                                            <h3 className="section-title new-items-title">YENİ EKLENENLER</h3>
                                            <ul className="order-list">
                                                {pendingItems.map(item => (
                                                    <li key={item.uniqueId} className="order-item-row pending-item-row">
                                                        <div className="item-details">
                                                            <span className="item-name-text">
                                                                <span className="item-qty-badge">{item.quantity}x</span>
                                                                {item.name}
                                                            </span>
                                                            {item.selectedOptions && item.selectedOptions.length > 0 && (
                                                                <span className="item-options-text">↳ + {item.selectedOptions.map(o => o.name).join(', ')}</span>
                                                            )}
                                                        </div>
                                                        <div className="item-price-action">
                                                            <span className="item-price-val">₺{item.lineTotal.toFixed(2)}</span>
                                                            <button type="button" className="minus-btn" onClick={() => handleRemovePending(item.uniqueId)}>-</button>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        </>
                                    )}
                                </div>
                                <div className="receipt-footer">
                                    <div className="summary-row total-row">
                                        <span>KALAN:</span>
                                        <span className="fast-remain">₺{pendingTotal.toFixed(2)}</span>
                                    </div>
                                    {pendingItems.length > 0 && (
                                        <div className="fast-pay-row">
                                            <button type="button" className="cash" onClick={() => handleFastPay('Nakit')}>NAKİT</button>
                                            <button type="button" className="card" onClick={() => handleFastPay('Kredi Kartı')}>KART</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* SEÇENEKLER POP-UP MİMARİSİ */}
            {showModal && selectedProductForModal && (
                <div className="fast-modal-overlay">
                    <div className="fast-modal-content">
                        <div className="fast-modal-header">
                            <h3>{selectedProductForModal.name}</h3>
                            <p>Lütfen tercihlerinizi belirleyin</p>
                        </div>
                        <div className="fast-options-scroll">
                            {selectedProductForModal.ProductOptionGroups.map(group => (
                                <div key={group.id} className="option-group-section">
                                    <h4 className={group.type === 'secim' ? 'required' : 'optional'}>
                                        <span>{group.name.toUpperCase()}</span>
                                        <span>{group.type === 'secim' ? 'ZORUNLU (1 Seçim)' : 'İSTEĞE BAĞLI'}</span>
                                    </h4>
                                    <div className="options-grid">
                                        {group.ProductOptions.map(opt => {
                                            const isSelected = activeOptions.some(o => o.id === opt.id);
                                            const tone = group.type === 'secim' ? 'required' : 'optional';
                                            return (
                                                <button
                                                    key={opt.id}
                                                    type="button"
                                                    className={`option-btn ${isSelected ? `selected ${tone}` : ''}`}
                                                    onClick={() => handleOptionSelect(group, opt)}
                                                >
                                                    <span>{opt.name}{shortageText(availability.options?.[opt.id]) ? ` · Stok yok: ${shortageText(availability.options[opt.id])}` : ''}</span>
                                                    <span className="option-price">{parseFloat(opt.price_diff) > 0 ? `+₺${opt.price_diff}` : '₺0.00'}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="fast-modal-actions">
                            <button type="button" className="cancel-btn" onClick={() => setShowModal(false)}>İptal</button>
                            <button
                                type="button"
                                className="confirm-btn"
                                onClick={confirmOptionsAndAdd}
                                disabled={!isSelectionValid()}
                            >
                                {isSelectionValid() ? 'Siparişe Ekle' : 'Seçimleri Tamamlayın'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <StockWarn warn={stockWarn} onCancel={() => setStockWarn(null)} onConfirm={acceptStockWarn} />
            {tableWarn && (
                <div className="res-modal" onClick={() => setTableWarn(null)}>
                    <div className="res-card res-warn" onClick={(event) => event.stopPropagation()}>
                        <h3>{reservationLabel(tableWarn.reservation)} için ayrılmış.</h3>
                        <p>Masa yine de açılsın mı?</p>
                        <div className="res-form-actions">
                            <button type="button" className="res-ghost" onClick={() => setTableWarn(null)}>Vazgeç</button>
                            <button type="button" className="res-add" onClick={() => { const id = tableWarn.table.id; setTableWarn(null); navigate(`/order/${id}`); }}>Aç</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;