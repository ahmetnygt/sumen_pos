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
    const [showCheckout, setShowCheckout] = useState(false);
    const [payAmount, setPayAmount] = useState('');
    const [selectedQuantities, setSelectedQuantities] = useState({});
    const [modalError, setModalError] = useState('');

    useEffect(() => {
        if (showCheckout) {
            setModalError('');
        }
    }, [showCheckout]);

    // Ürün Seçerek (Parçalı) Ödeme Hesaplayıcısı
    const handleQtyChange = (item, delta) => {
        const currentQty = selectedQuantities[item.id] || 0;
        let newQty = currentQty + delta;
        if (newQty < 0) newQty = 0;
        if (newQty > item.quantity) newQty = item.quantity;

        const updated = { ...selectedQuantities, [item.id]: newQty };
        setSelectedQuantities(updated);

        let total = 0;
        order.OrderItems.forEach(i => { total += (updated[i.id] || 0) * parseFloat(i.price); });
        setPayAmount(total > 0 ? Math.min(total, remaining).toFixed(2) : '');
    };

    // Akıllı Mobil Numpad
    const handleNumpad = (val) => {
        setModalError('');
        setPayAmount(prev => {
            const newVal = prev + val;
            if (parseFloat(newVal) > remaining + 0.01) {
                setModalError('Kalan hesaptan fazla tahsilat yapılamaz!'); return prev;
            }
            return newVal;
        });
        setSelectedQuantities({}); // Elle tutar girilirse parça ürün seçimini sıfırla
    };

    const handleNumpadBackspace = () => { setModalError(''); setPayAmount(prev => prev.slice(0, -1)); };
    const handleNumpadClear = () => { setModalError(''); setPayAmount(''); };

    // Ödeme API İsteği
    const handlePayment = async (method) => {
        setModalError('');
        const amount = parseFloat(payAmount || remaining);
        if (amount <= 0 || isNaN(amount) || amount > remaining + 0.01) {
            setModalError('Geçerli bir tutar giriniz!'); return;
        }

        const paidItemsArray = Object.entries(selectedQuantities)
            .filter(([id, qty]) => qty > 0)
            .map(([id, qty]) => ({ id: parseInt(id), qty }));

        try {
            const res = await api.post(`/orders/table/${tableId}/pay`, {
                pay_amount: amount, payment_method: method, paidItems: paidItemsArray
            });

            if (res.data.isFullyPaid) {
                setShowCheckout(false); navigate('/waiter-dashboard');
            } else {
                setPayAmount(''); setSelectedQuantities({}); fetchData();
            }
        } catch (error) { setModalError('Ödeme başarısız!'); }
    };

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
        // BÜYÜ BURADA: Artık ProductOptionGroups dizisine bakıyoruz
        if (product.ProductOptionGroups && product.ProductOptionGroups.length > 0) {
            setSelectedProductForModal(product);
            setActiveOptions([]); // Önceki seçimleri temizle
            setShowModal(true);
        } else {
            // Hiçbir grubu yoksa mermi gibi direkt sepete at!
            handleStageItem(product, []);
        }
    };

    // YENİ: Akıllı Seçenek İşaretleme Motoru (Zorunlu vs Ekstra)
    const handleOptionSelect = (group, opt) => {
        if (group.type === 'secim') {
            // Zorunlu (Radio) mantığı: Aynı gruptan başka seçili varsa onu sil, yenisini ekle
            const groupOptionIds = group.ProductOptions.map(o => o.id);
            const filtered = activeOptions.filter(o => !groupOptionIds.includes(o.id));
            setActiveOptions([...filtered, opt]);
        } else {
            // Ekstra (Checkbox) mantığı: Varsa çıkar, yoksa ekle
            const exists = activeOptions.find(o => o.id === opt.id);
            if (exists) {
                setActiveOptions(activeOptions.filter(o => o.id !== opt.id));
            } else {
                setActiveOptions([...activeOptions, opt]);
            }
        }
    };

    // YENİ: Siparişe Ekleme Kilidi (Tüm zorunlu seçimler yapıldı mı?)
    const isSelectionValid = () => {
        if (!selectedProductForModal) return false;
        // Sadece "secim" (Zorunlu) olan grupları bul
        const mandatoryGroups = selectedProductForModal.ProductOptionGroups.filter(g => g.type === 'secim');

        // Her zorunlu gruptan en az 1 tane seçilmiş mi kontrol et
        for (const group of mandatoryGroups) {
            const hasSelection = group.ProductOptions.some(opt => activeOptions.some(a => a.id === opt.id));
            if (!hasSelection) return false; // Zorunlu bir gruptan seçim yapılmamış! (Butonu kilitle)
        }
        return true; // Her şey tamamsa kilidi aç
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
        // 1. AŞAMA (GÜVENLİK DUVARI): Veritabanından gelen veriyi zorla Array'e (Diziye) çevir!
        let parsedOptions = [];
        try {
            if (typeof item.selected_options === 'string') {
                parsedOptions = JSON.parse(item.selected_options);
            } else if (Array.isArray(item.selected_options)) {
                parsedOptions = item.selected_options;
            }
        } catch (e) {
            parsedOptions = []; // Bozuksa bile boş dizi yap, sistemi çökertmesin
        }
        item.selected_options = parsedOptions; // Temizlenmiş diziyi item'ın içine geri koy

        // 2. AŞAMA: Gruplama anahtarını oluştur
        const optsKey = item.selected_options.length > 0 ? JSON.stringify(item.selected_options) : '';
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
                                            {Array.isArray(gItem.selected_options) && gItem.selected_options.length > 0 && (
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
                            order && remaining > 0 && orderItemsSafe.length > 0 && (
                                <button className="mobile-checkout-btn" onClick={() => { setShowCheckout(true); setPayAmount(remaining.toFixed(2)); }}>💳 ÖDEME AL</button>
                            )
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

            {/* YENİ NESİL GRUPLU SEÇENEKLER POP-UP EKRANI */}
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

                                    {/* Grup Başlığı (Zorunlu ise Kırmızı, Ekstra ise Mavi) */}
                                    <h4 style={{ color: group.type === 'secim' ? '#ff4444' : '#00ffcc', margin: '0 0 15px 0', fontSize: '14px', borderBottom: '1px solid #222', paddingBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                                        <span>{group.name.toUpperCase()}</span>
                                        <span style={{ fontSize: '11px', opacity: 0.8 }}>{group.type === 'secim' ? 'ZORUNLU (1 Seçim)' : 'İSTEĞE BAĞLI'}</span>
                                    </h4>

                                    <div className="options-grid">
                                        {group.ProductOptions.map(opt => {
                                            const isSelected = activeOptions.some(o => o.id === opt.id);
                                            return (
                                                <button
                                                    key={opt.id}
                                                    className={`option-btn ${isSelected ? 'selected' : ''}`}
                                                    onClick={() => handleOptionSelect(group, opt)}
                                                    style={{
                                                        borderColor: isSelected ? (group.type === 'secim' ? '#ff4444' : '#00ffcc') : '#333',
                                                        background: isSelected ? (group.type === 'secim' ? 'rgba(255, 68, 68, 0.1)' : 'rgba(0, 255, 204, 0.1)') : '#1a1a1a',
                                                        color: isSelected ? '#fff' : '#aaa',
                                                        transition: '0.2s'
                                                    }}
                                                >
                                                    <span>{opt.name}</span>
                                                    <span className="option-price">
                                                        {parseFloat(opt.price_diff) > 0 ? `+₺${opt.price_diff}` : '₺0.00'}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>

                                </div>
                            ))}
                        </div>

                        <div className="modal-actions" style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #333' }}>
                            <button className="cancel-btn" onClick={() => setShowModal(false)}>İptal</button>

                            {/* BÜYÜ BURADA: Seçimler geçerli değilse buton silik (disabled) olur! */}
                            <button
                                className="confirm-btn"
                                onClick={confirmOptionsAndAdd}
                                disabled={!isSelectionValid()}
                                style={{
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
            {/* MOBİL ÖDEME (CHECKOUT) EKRANI */}
            {showCheckout && (
                <div className="mobile-checkout-overlay">
                    <div className="mobile-checkout-content">
                        <div className="mc-header">
                            <h2>💳 TAHSİLAT (Masa {tableId})</h2>
                            <button onClick={() => setShowCheckout(false)}>✕</button>
                        </div>

                        <div className="mc-remaining-display">
                            <span>KALAN HESAP</span>
                            <strong>₺{remaining.toFixed(2)}</strong>
                        </div>

                        <div className="mc-products-scroll">
                            <p className="mc-subtitle">ÜRÜN SEÇEREK ÖDE (İsteğe Bağlı)</p>
                            {order?.OrderItems?.map(item => {
                                if (item.status === 'Ödendi') return null; // Zaten ödenenleri gizle kalabalık yapmasın
                                const selQty = selectedQuantities[item.id] || 0;
                                return (
                                    <div key={item.id} className={`mc-item-row ${selQty > 0 ? 'selected' : ''}`}>
                                        <div className="mc-item-info">
                                            <span>{item.quantity}x {item.Product?.name}</span>
                                            <small>Birim: ₺{parseFloat(item.price).toFixed(2)}</small>
                                        </div>
                                        <div className="mc-qty-controls">
                                            <button onClick={() => handleQtyChange(item, -1)} disabled={selQty === 0}>-</button>
                                            <span>{selQty}</span>
                                            <button onClick={() => handleQtyChange(item, 1)} disabled={selQty === item.quantity}>+</button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        <div className="mc-payment-section">
                            {modalError && <div className="mc-error">{modalError}</div>}

                            <div className="mc-amount-input-wrapper">
                                <span>ALINACAK TUTAR (₺)</span>
                                <div className="mc-amount-display">{payAmount || '0.00'}</div>
                            </div>

                            <div className="mc-numpad-grid">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                                    <button key={num} onClick={() => handleNumpad(num.toString())}>{num}</button>
                                ))}
                                <button className="mc-action-btn" onClick={handleNumpadClear}>C</button>
                                <button onClick={() => handleNumpad('0')}>0</button>
                                <button className="mc-action-btn" onClick={handleNumpadBackspace}>⌫</button>
                            </div>

                            <div className="mc-pay-buttons">
                                <button className="mc-card-btn" onClick={() => handlePayment('Kredi Kartı')}>💳 KART</button>
                                <button className="mc-cash-btn" onClick={() => handlePayment('Nakit')}>💵 NAKİT</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WaiterOrder;