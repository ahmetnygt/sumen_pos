import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import './Order.css';

const Order = () => {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const orderListRef = useRef(null);

  const [menu, setMenu] = useState([]);
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  // YENİ EKLENENLER (Sepet) State'i
  const [pendingItems, setPendingItems] = useState([]);

  // --- KASA MODALI STATE'LERİ ---
  const [showCheckout, setShowCheckout] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [discountType, setDiscountType] = useState('amount');
  const [discountValue, setDiscountValue] = useState('');
  const [selectedQuantities, setSelectedQuantities] = useState({});
  const [modalError, setModalError] = useState('');

  // MODAL İÇİN YENİ STATELER
  const [showModal, setShowModal] = useState(false);
  const [selectedProductForModal, setSelectedProductForModal] = useState(null);
  const [activeOptions, setActiveOptions] = useState([]);

  // BÜYÜ BURADA: Numpad'in nereye yazacağını bilen State
  const [activeInput, setActiveInput] = useState('payAmount'); // Varsayılan olarak tutar kutusu seçili başlar

  useEffect(() => {
    fetchData();
  }, [tableId]);

  useEffect(() => {
    if (orderListRef.current) {
      orderListRef.current.scrollTo({ top: orderListRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [order, pendingItems]);

  useEffect(() => {
    // Modal açıldığında otomatik olarak Tutar kutusuna odaklansın
    if (showCheckout) {
      setActiveInput('payAmount');
      setModalError('');
    }
  }, [showCheckout]);

  const fetchData = async () => {
    try {
      const menuRes = await api.get('/menu');
      setMenu(menuRes.data);
      if (menuRes.data.length > 0 && !activeCategoryId) setActiveCategoryId(menuRes.data[0].id);

      const orderRes = await api.get(`/orders/table/${tableId}`);
      setOrder(orderRes.data);
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

  const handleRemovePending = (productId) => {
    setPendingItems(prev => {
      const existing = prev.find(item => item.id === productId);
      if (existing.quantity > 1) {
        return prev.map(item =>
          item.id === productId ? { ...item, quantity: item.quantity - 1, lineTotal: item.lineTotal - parseFloat(item.price) } : item
        );
      }
      return prev.filter(item => item.id !== productId);
    });
  };

  const handleSendPendingOrders = async () => {
    if (pendingItems.length === 0) return;
    try {
      const promises = pendingItems.map(item =>
        api.post(`/orders/table/${tableId}/add-item`, {
          productId: item.id,
          price: item.basePrice, // Ürünün ham fiyatını yolla (Backend üstüne ekler)
          quantity: item.quantity,
          selectedOptions: item.selectedOptions // YENİ: Seçenekleri yolla
        })
      );
      await Promise.all(promises);
      setPendingItems([]);
      fetchData();
    } catch (error) { alert('Siparişler gönderilemedi!'); }
  };

  const handleCancelItem = async (itemId) => {
    if (!window.confirm('Bu siparişi adisyondan silmek istediğine emin misin?')) return;
    try {
      await api.delete(`/orders/item/${itemId}`);
      fetchData();
    } catch (error) { alert('İptal başarısız!'); }
  };

  const handleApplyDiscount = async () => {
    setModalError('');
    const val = parseFloat(discountValue);
    if (!val || val <= 0) { setModalError('Geçerli bir iskonto değeri girin!'); return; }

    let calculatedDiscount = val;
    if (discountType === 'percent') calculatedDiscount = remaining * (val / 100);

    if (calculatedDiscount <= 0 || calculatedDiscount > remaining + 0.01) {
      setModalError('İskonto tutarı kalan hesaptan büyük olamaz!'); return;
    }

    try {
      const res = await api.post(`/orders/table/${tableId}/discount`, { type: discountType, value: discountValue });
      setDiscountValue('');
      if (res.data.isFullyPaid) {
        setShowCheckout(false); navigate('/dashboard');
      } else {
        fetchData(); setPayAmount((remaining - calculatedDiscount).toFixed(2));
      }
    } catch (error) { setModalError('İskonto uygulanamadı!'); }
  };

  const handleRemoveDiscount = async () => {
    try {
      await api.post(`/orders/table/${tableId}/discount`, { type: 'amount', value: -order.discount_amount });
      fetchData();
    } catch (error) { alert('İskonto silinemedi!'); }
  };

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
    setActiveInput('payAmount'); // Ürün seçince numpad tutara odaklansın
  };

  // --- AKILLI NUMPAD MOTORU ---
  const handleNumpad = (val) => {
    setModalError('');
    if (!activeInput) return;

    if (activeInput === 'discount') {
      setDiscountValue(prev => prev + val);
    } else if (activeInput === 'payAmount') {
      setPayAmount(prev => {
        const newVal = prev + val;
        if (parseFloat(newVal) > remaining + 0.01) {
          setModalError('Hata: Kalan hesaptan fazla tahsilat yapamazsınız!'); return prev;
        }
        return newVal;
      });
      setSelectedQuantities({}); // Elle tutar girilirse ürün seçimlerini sıfırla
    }
  };

  const handleNumpadBackspace = () => {
    setModalError('');
    if (!activeInput) return;
    if (activeInput === 'discount') setDiscountValue(prev => prev.slice(0, -1));
    else setPayAmount(prev => prev.slice(0, -1));
  };

  const handleNumpadClear = () => {
    setModalError('');
    if (!activeInput) return;
    if (activeInput === 'discount') setDiscountValue('');
    else setPayAmount('');
  };

  const handleAmountChange = (e) => {
    setModalError('');
    setActiveInput('payAmount');
    const val = e.target.value;
    if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
      if (parseFloat(val) > remaining + 0.01) {
        setModalError(`Hata: Kalan hesaptan fazla tahsilat yapamazsınız!`); return;
      }
      setPayAmount(val);
      setSelectedQuantities({});
    }
  };

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
        setShowCheckout(false); navigate('/dashboard');
      } else {
        setPayAmount(''); setSelectedQuantities({}); fetchData();
      }
    } catch (error) { setModalError('Ödeme başarısız!'); }
  };

  const getActiveProducts = () => {
    const category = menu.find(c => c.id === activeCategoryId);
    return category ? (category.Products || category.products || []) : [];
  };

  const pendingTotal = pendingItems.reduce((acc, item) => acc + item.lineTotal, 0);
  const totalAmount = order ? parseFloat(order.total_amount) : 0;
  const paidAmount = order ? parseFloat(order.paid_amount || 0) : 0;
  const discountAmount = order ? parseFloat(order.discount_amount || 0) : 0;
  const remaining = totalAmount - paidAmount - discountAmount;

  const groupedOrderItems = order?.OrderItems?.reduce((acc, item) => {
    const key = `${item.product_id}-${item.status}`;
    if (!acc[key]) acc[key] = { ...item, totalQty: 0, sumPrice: 0 };
    acc[key].totalQty += item.quantity;
    acc[key].sumPrice += parseFloat(item.price) * item.quantity;
    return acc;
  }, {}) || {};

  if (loading) return <div className="loading-screen">Yükleniyor...</div>;

  return (
    <div className="order-layout">
      {/* SOL PANEL (ADİSYON) - Dokunmadım, aynı */}
      <div className="receipt-panel">
        <div className="receipt-header">
          <h2 style={{ margin: 0, color: 'var(--primary-color)', fontSize: '20px' }}>Masa {tableId}</h2>
          <button className="close-panel-btn" onClick={() => navigate('/dashboard')}>KAPAT</button>
        </div>

        <div className="receipt-body">
          <div ref={orderListRef} style={{ flex: 1, overflowY: 'auto', paddingRight: '5px' }}>
            <h3 className="section-title">İŞLENEN SİPARİŞLER</h3>
            {Object.keys(groupedOrderItems).length === 0 ? (
              <p style={{ color: '#444', fontSize: '12px', fontStyle: 'italic' }}>Kayıtlı sipariş yok.</p>
            ) : (
              <ul className="order-list">
                {Object.values(groupedOrderItems).map(gItem => (
                  <li key={`${gItem.product_id}-${gItem.status}`} className="order-list-item">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ color: gItem.status === 'Ödendi' ? '#555' : 'var(--text-color)', fontWeight: 'bold', fontSize: '13px', textDecoration: gItem.status === 'Ödendi' ? 'line-through' : 'none' }}>
                        {gItem.totalQty}x {gItem.Product?.name}
                      </span>
                      {/* Hem pendingItems hem de veritabanından gelen groupedOrderItems için */}
                      {item.selectedOptions && item.selectedOptions.length > 0 && (
                        <div style={{ fontSize: '11px', color: '#d4af37', marginLeft: '20px' }}>
                          ↳ + {item.selectedOptions.map(o => o.name).join(', ')}
                        </div>
                      )}
                      {/* (Eski veritabanı kayıtları için selected_options da kullanılıyor olabilir, kontrol edersin) */}
                      {item.selected_options && item.selected_options.length > 0 && (
                        <div style={{ fontSize: '11px', color: '#d4af37', marginLeft: '20px' }}>
                          ↳ + {item.selected_options.map(o => o.name).join(', ')}
                        </div>
                      )}
                      {gItem.status === 'Ödendi' && <span className="paid-badge-small">ÖDENDİ</span>}
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
                    <li key={item.id} className="order-list-item pending-item-row">
                      <span style={{ color: '#fff', fontSize: '13px', fontWeight: 'bold' }}>{item.quantity}x {item.name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <strong style={{ color: 'var(--primary-color)' }}>₺{item.lineTotal.toFixed(2)}</strong>
                        <button className="minus-btn" onClick={() => handleRemovePending(item.id)}>-</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <div className="receipt-footer">
            <div className="summary-row"><span>Adisyon Toplamı:</span><span>₺{totalAmount.toFixed(2)}</span></div>
            {discountAmount > 0 && <div className="summary-row discount-row"><span>İskonto:</span><span>- ₺{discountAmount.toFixed(2)}</span></div>}
            {paidAmount > 0 && <div className="summary-row paid-row"><span>Ödenen:</span><span>- ₺{paidAmount.toFixed(2)}</span></div>}
            <div className="summary-row total-row">
              <span>KALAN:</span><span style={{ color: 'var(--primary-color)' }}>₺{(remaining + pendingTotal).toFixed(2)}</span>
            </div>

            {pendingItems.length > 0 ? (
              <button className="send-order-btn pulse-anim" onClick={handleSendPendingOrders}>🚀 GÖNDER</button>
            ) : (
              order && remaining > 0 && order.OrderItems.length > 0 && (
                <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                  <button className="print-btn">🖨️ YAZDIR</button>
                  <button className="checkout-btn" onClick={() => { setShowCheckout(true); setPayAmount(remaining.toFixed(2)); setActiveInput('payAmount'); }}>💳 ÖDEME AL</button>
                </div>
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
            <button key={prod.id} className="prod-btn" onClick={() => handleStageItem(prod)}>
              <span className="prod-name">{prod.name}</span>
              <span className="prod-price">₺{parseFloat(prod.price).toFixed(2)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* --- KASA MODALI (3 SÜTUNLU YENİ MİMARİ) --- */}
      {showCheckout && (
        <div className="checkout-modal-overlay">
          <div className="checkout-modal-box">

            <div className="modal-header">
              <h2>TAHSİLAT VE İSKONTO - MASA {tableId}</h2>
              <button className="close-icon" onClick={() => setShowCheckout(false)}>✖</button>
            </div>

            <div className="modal-body">

              {/* SÜTUN 1: ÜRÜN SEÇİMİ (Kendi İçinde Scroll) */}
              <div className="modal-col modal-products">
                <h3 className="modal-subtitle">ÜRÜN SEÇEREK ÖDE</h3>
                <div className="modal-products-list">
                  {order.OrderItems.length === 0 && <p style={{ color: '#555' }}>Ödenecek ürün kalmadı.</p>}

                  {/* BÜTÜN BÜYÜ BURADA: Ödenenler de listede gözükür! */}
                  {order.OrderItems.map(item => {
                    if (item.status === 'Ödendi') {
                      return (
                        <div key={item.id} className="modal-item-row paid-modal-row">
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ textDecoration: 'line-through', color: '#555', fontWeight: 'bold', fontSize: '13px' }}>
                              {item.quantity}x {item.Product?.name}
                            </span>
                          </div>
                          <span className="paid-stamp-modal">ÖDENDİ</span>
                        </div>
                      );
                    }

                    // Ödenmemiş ürünler (+ / -)
                    const selQty = selectedQuantities[item.id] || 0;
                    const isSelected = selQty > 0;
                    return (
                      <div key={item.id} className={`modal-item-row ${isSelected ? 'selected' : ''}`}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ color: isSelected ? '#00ffcc' : 'var(--text-color)', fontWeight: 'bold', fontSize: '13px' }}>
                            {item.quantity}x {item.Product?.name}
                          </span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '4px' }}>Birim: ₺{parseFloat(item.price).toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button className={`qty-action-btn ${selQty === 0 ? 'disabled' : 'minus'}`} onClick={() => handleQtyChange(item, -1)} disabled={selQty === 0}>-</button>
                          <span className={`qty-display ${isSelected ? 'active' : ''}`}>{selQty}</span>
                          <button className={`qty-action-btn ${selQty === item.quantity ? 'disabled' : 'plus'}`} onClick={() => handleQtyChange(item, 1)} disabled={selQty === item.quantity}>+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SÜTUN 2: MATEMATİK VE ÖDEME BUTONLARI (Kendi İçinde Scroll) */}
              <div className="modal-col modal-payment">

                {/* İskonto Alanı */}
                <div className="discount-area">
                  <div className="discount-toggle">
                    <button className={discountType === 'amount' ? 'active' : ''} onClick={() => setDiscountType('amount')}>₺</button>
                    <button className={discountType === 'percent' ? 'active' : ''} onClick={() => setDiscountType('percent')}>%</button>
                  </div>
                  <input
                    type="number"
                    placeholder="İndirim..."
                    value={discountValue}
                    onChange={(e) => { setDiscountValue(e.target.value); setActiveInput('discount'); }}
                    onFocus={() => setActiveInput('discount')}
                    className={`discount-input ${activeInput === 'discount' ? 'input-active' : ''}`}
                  />
                  <button className="discount-apply-btn" onClick={handleApplyDiscount}>DÜŞ</button>
                </div>

                {/* Hata Mesajı */}
                {modalError && <div className="modal-error">{modalError}</div>}

                {/* Hesap Özeti */}
                <div className="summary-block">
                  <div className="modal-summary-row">
                    <span className="label">Adisyon Toplamı:</span><span>₺{totalAmount.toFixed(2)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="modal-summary-row discount-row">
                      <span className="label">Yapılan İskonto:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#ffc107', fontWeight: 'bold' }}>- ₺{discountAmount.toFixed(2)}</span>
                        <button onClick={handleRemoveDiscount} title="İskontoyu Sıfırla" className="remove-discount-icon">✖</button>
                      </div>
                    </div>
                  )}
                  <div className="modal-summary-row">
                    <span className="label">Ödenen:</span><span style={{ color: '#00ffcc' }}>- ₺{paidAmount.toFixed(2)}</span>
                  </div>
                  <div className="modal-summary-row final-total">
                    <span>KALAN:</span><span style={{ color: '#ff4444' }}>₺{remaining.toFixed(2)}</span>
                  </div>
                </div>

                {/* Alınacak Tutar */}
                <div style={{ marginTop: 'auto' }}>
                  <label className="pay-label">ALINACAK TUTAR (₺)</label>
                  <input
                    type="text"
                    className={`pay-input ${activeInput === 'payAmount' ? 'input-active' : ''}`}
                    value={payAmount}
                    onChange={handleAmountChange}
                    onFocus={() => setActiveInput('payAmount')}
                  />

                  <div className="payment-methods">
                    <button className="card-btn" onClick={() => handlePayment('Kredi Kartı')}>💳 KART</button>
                    <button className="cash-btn" onClick={() => handlePayment('Nakit')}>💵 NAKİT</button>
                  </div>
                </div>

              </div>

              {/* SÜTUN 3: AKILLI NUMPAD (Sabit) */}
              <div className="modal-col modal-numpad">
                <div className={`numpad-wrapper ${!activeInput ? 'disabled-numpad' : ''}`}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <button key={num} className="numpad-btn" onClick={() => handleNumpad(num.toString())}>{num}</button>
                  ))}
                  <button className="numpad-btn action-btn" onClick={handleNumpadClear}>C</button>
                  <button className="numpad-btn" onClick={() => handleNumpad('0')}>0</button>
                  <button className="numpad-btn" onClick={() => handleNumpad('.')}>.</button>
                  <button className="numpad-btn backspace-btn" onClick={handleNumpadBackspace}>⌫ SİL</button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
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

export default Order;