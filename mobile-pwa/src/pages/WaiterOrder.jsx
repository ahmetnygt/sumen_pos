import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import './Order.css';

const WaiterOrder = () => {
    const { tableId } = useParams();
    const navigate = useNavigate();
    const orderListRef = useRef(null);

    const [menu, setMenu] = useState([]);
    const [activeCategoryId, setActiveCategoryId] = useState(null);
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);

    // MODAL İÇİN YENİ STATELER
    const [showModal, setShowModal] = useState(false);
    const [selectedProductForModal, setSelectedProductForModal] = useState(null);
    const [activeOptions, setActiveOptions] = useState([]);

    const [pendingItems, setPendingItems] = useState([]);

    useEffect(() => {
        fetchData();
    }, [tableId]);

    useEffect(() => {
        if (orderListRef.current) {
            orderListRef.current.scrollTo({ top: orderListRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, [order, pendingItems]);

    const fetchData = async () => {
        try {
            const menuRes = await api.get('/menu');
            setMenu(menuRes.data || []);
            if (menuRes.data && menuRes.data.length > 0 && !activeCategoryId) {
                setActiveCategoryId(menuRes.data[0].id);
            }

            const orderRes = await api.get(`/orders/table/${tableId}`);
            setOrder(orderRes.data || null);
        } catch (error) {
            console.error('Veriler çekilirken hata:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleStageItem = (product, selectedOptions = []) => {
        // 1. Ekstra fiyatları hesapla
        const extraPrice = selectedOptions.reduce((sum, opt) => sum + parseFloat(opt.price_diff || 0), 0);
        const basePrice = parseFloat(product.price || 0);
        const finalUnitPrice = basePrice + extraPrice;

        // 2. Benzersiz ID oluştur (12-Duble,Buzlu)
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
                uniqueId, // Benzersiz ayırıcı
                quantity: 1,
                lineTotal: finalUnitPrice,
                basePrice: basePrice, // Asıl ürünü yollarken lazım
                selectedOptions // BÜYÜ BURADA: Backend'e yollayacağımız ekstralar
            }];
        });
    };

    // Menüden bir ürüne tıklandığında çalışır
    const handleProductClick = (product) => {
        // Eğer ürünün seçenekleri varsa Pop-up'ı aç
        if (product.ProductOptions && product.ProductOptions.length > 0) {
            setSelectedProductForModal(product);
            setActiveOptions([]); // Önceki seçimleri temizle
            setShowModal(true);
        } else {
            // Seçeneği yoksa (Örn: Çay, Su), mermi gibi direkt ekle!
            handleStageItem(product, []);
        }
    };

    // Pop-up içindeki seçeneklere tıklama
    const toggleOption = (opt) => {
        const exists = activeOptions.find(o => o.id === opt.id);
        if (exists) {
            setActiveOptions(activeOptions.filter(o => o.id !== opt.id)); // Zaten seçiliyse çıkar
        } else {
            setActiveOptions([...activeOptions, opt]); // Seçili değilse ekle
        }
    };

    // Pop-up'ta "Sepete Ekle" butonuna basınca
    const confirmOptionsAndAdd = () => {
        handleStageItem(selectedProductForModal, activeOptions);
        setShowModal(false);
        setSelectedProductForModal(null);
    };

    const handleRemovePending = (uniqueId) => {
        setPendingItems(prev => {
            const existing = prev.find(item => item.uniqueId === uniqueId);
            if (!existing) return prev;
            if (existing.quantity > 1) {
                return prev.map(item =>
                    item.uniqueId === uniqueId
                        ? { ...item, quantity: item.quantity - 1, lineTotal: item.lineTotal - (item.lineTotal / item.quantity) }
                        : item
                );
            }
            return prev.filter(item => item.uniqueId !== uniqueId);
        });
    };

    const handleSendPendingOrders = async () => {
        if (pendingItems.length === 0) return;
        try {
            // BÜYÜ BURADA: Promise.all YERİNE for...of KULLANIYORUZ (Sırayla ve Güvenle)
            for (const item of pendingItems) {
                await api.post(`/orders/table/${tableId}/add-item`, {
                    productId: item.id,
                    price: item.basePrice, // Ürünün ham fiyatını yolla
                    quantity: item.quantity,
                    selectedOptions: item.selectedOptions // Seçenekleri yolla
                });
            }
            setPendingItems([]);
            fetchData();
        } catch (error) {
            alert('Siparişler gönderilemedi! Hata: ' + (error.response?.data?.message || error.message));
        }
    };

    const getActiveProducts = () => {
        const category = menu.find(c => c.id === activeCategoryId);
        return category ? (category.Products || category.products || []) : [];
    };

    const pendingTotal = pendingItems.reduce((acc, item) => acc + (item.lineTotal || 0), 0);
    const totalAmount = parseFloat(order?.total_amount || 0);
    const remaining = Math.max(0, totalAmount - parseFloat(order?.paid_amount || 0) - parseFloat(order?.discount_amount || 0));

    const orderItemsSafe = order?.OrderItems || [];
    const groupedOrderItems = order?.OrderItems?.reduce((acc, item) => {
        // 1. AŞAMA (GÜVENLİK DUVARI): Veritabanından string (metin) geldiyse onu gerçek Array'e çevir
        let parsedOptions = item.selected_options;
        if (typeof parsedOptions === 'string') {
            try {
                parsedOptions = JSON.parse(parsedOptions);
            } catch (e) {
                parsedOptions = [];
            }
        }
        // Düzeltilmiş diziyi item'ın içine geri koy ki aşağıda HTML çizerken .map() çökmesin!
        item.selected_options = parsedOptions;

        // 2. AŞAMA: Gruplama anahtarını oluştur
        const optsKey = item.selected_options && item.selected_options.length > 0
            ? JSON.stringify(item.selected_options)
            : '';
        const key = `${item.product_id}-${item.status}-${optsKey}`;

        // 3. AŞAMA: Adisyondaki miktarları ve fiyatları topla
        if (!acc[key]) acc[key] = { ...item, totalQty: 0, sumPrice: 0 };
        acc[key].totalQty += item.quantity || 1;
        acc[key].sumPrice += parseFloat(item.price || 0) * (item.quantity || 1);

        return acc;
    }, {}) || {};

    if (loading) return <div className="loading-screen">Yükleniyor...</div>;

    return (
        <div className="order-layout">
            {/* SOL PANEL (ADİSYON) - Kasa Ekranından Farklı! */}
            <div className="receipt-panel">
                <div className="receipt-header">
                    <h2 style={{ margin: 0, color: '#00ffcc', fontSize: '20px' }}>Masa {tableId}</h2>
                    <button className="close-panel-btn" onClick={() => navigate('/waiter-dashboard')}>GERİ DÖN</button>
                </div>

                <div className="receipt-body">
                    <div ref={orderListRef} style={{ flex: 1, overflowY: 'auto', paddingRight: '5px' }}>
                        <h3 className="section-title">İŞLENEN SİPARİŞLER</h3>
                        {Object.keys(groupedOrderItems).length === 0 ? (
                            <p style={{ color: '#444', fontSize: '12px', fontStyle: 'italic' }}>Kayıtlı sipariş yok.</p>
                        ) : (
                            <ul className="order-list">
                                {Object.values(groupedOrderItems).map(gItem => (
                                    <li key={`${gItem.product_id}-${gItem.status}-${Math.random()}`} className="order-list-item">
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <span style={{ color: gItem.status === 'Ödendi' ? '#555' : 'var(--text-color)', fontWeight: 'bold', fontSize: '13px', textDecoration: gItem.status === 'Ödendi' ? 'line-through' : 'none' }}>
                                                    {gItem.totalQty}x {gItem.Product?.name}
                                                </span>
                                                {gItem.status === 'Ödendi' && <span className="paid-badge-small">ÖDENDİ</span>}
                                            </div>
                                            {/* BÜYÜ BURADA: Seçenekleri adisyona yazdırıyoruz (gItem kullanarak) */}
                                            {gItem.selected_options && gItem.selected_options.length > 0 && (
                                                <div style={{ fontSize: '11px', color: gItem.status === 'Ödendi' ? '#555' : '#d4af37', paddingLeft: '10px' }}>
                                                    ↳ + {gItem.selected_options.map(o => o.name).join(', ')}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <strong style={{ color: gItem.status === 'Ödendi' ? '#555' : 'var(--text-muted)', textDecoration: gItem.status === 'Ödendi' ? 'line-through' : 'none' }}>
                                                ₺{gItem.sumPrice.toFixed(2)}
                                            </strong>
                                            {gItem.status !== 'Ödendi' && <button className="cancel-btn-small" onClick={() => handleCancelItem(gItem.id)}>✕</button>}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}

                        {pendingItems.length > 0 && (
                            <>
                                <h3 className="section-title new-items-title">YENİ EKLENENLER</h3>
                                <ul className="order-list">
                                    {pendingItems.map(item => (
                                        <li key={item.uniqueId} className="order-list-item pending-item-row">
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <span style={{ color: '#fff', fontSize: '13px', fontWeight: 'bold' }}>{item.quantity}x {item.name}</span>
                                                {/* Sepete (Yeni Eklenenlere) eklenen seçenekler */}
                                                {item.selectedOptions && item.selectedOptions.length > 0 && (
                                                    <div style={{ fontSize: '11px', color: '#d4af37', paddingLeft: '10px' }}>
                                                        ↳ + {item.selectedOptions.map(o => o.name).join(', ')}
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                <strong style={{ color: 'var(--primary-color)' }}>₺{item.lineTotal.toFixed(2)}</strong>
                                                {/* Eksi butonuna artık uniqueId gönderiyoruz */}
                                                <button className="minus-btn" onClick={() => handleRemovePending(item.uniqueId)}>-</button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </div>

                    <div className="receipt-footer">
                        <div className="summary-row total-row">
                            <span>MASA HESABI:</span><span style={{ color: '#fff' }}>₺{(remaining + pendingTotal).toFixed(2)}</span>
                        </div>

                        {pendingItems.length > 0 ? (
                            <button className="send-order-btn pulse-anim" onClick={handleSendPendingOrders}>MUTFAĞA GÖNDER</button>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '10px', color: '#666', fontSize: '12px', marginTop: '10px' }}>
                                Ödeme ve iptal işlemleri Kasa'dan yapılmaktadır.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* SAĞ PANEL (MENÜ) */}
            <div className="menu-panel">
                <div className="category-slider">
                    {menu.map(cat => (
                        <button key={cat.id} className={`cat-btn ${activeCategoryId === cat.id ? 'active' : ''}`} onClick={() => setActiveCategoryId(cat.id)}>{cat.name}</button>
                    ))}
                </div>
                <div className="product-grid">
                    {getActiveProducts().map(prod => (
                        <button key={prod.id} className="prod-btn" onClick={() => handleProductClick(prod)}>
                            <span className="prod-name">{prod.name}</span>
                            <span className="prod-price">₺{parseFloat(prod.price).toFixed(2)}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* SEÇENEKLER POP-UP EKRANI */}
            {showModal && selectedProductForModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3>{selectedProductForModal.name}</h3>
                            <p>Ekstra özellik veya porsiyon seçin</p>
                        </div>

                        <div className="options-grid">
                            {selectedProductForModal.ProductOptions.map(opt => {
                                const isSelected = activeOptions.some(o => o.id === opt.id);
                                return (
                                    <button
                                        key={opt.id}
                                        className={`option-btn ${isSelected ? 'selected' : ''}`}
                                        onClick={() => toggleOption(opt)}
                                    >
                                        <span>{opt.name}</span>
                                        <span className="option-price">
                                            {parseFloat(opt.price_diff) > 0 ? `+₺${opt.price_diff}` : '₺0.00'}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="modal-actions">
                            <button className="cancel-btn" onClick={() => setShowModal(false)}>İptal</button>
                            <button className="confirm-btn" onClick={confirmOptionsAndAdd}>Siparişe Ekle</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WaiterOrder;