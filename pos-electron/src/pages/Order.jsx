import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import './Order.css';
import { MenuGlyph, ProductMark } from '../components/menuIcons';
import StockWarn, { shortagesFor, stockShortages } from '../components/StockWarn';

function shortageText(rows) {
  return (rows || []).map(row => row.name).filter(Boolean).join(', ');
}

function parseOptionList(value) {
  let current = value;
  for (let i = 0; i < 2 && typeof current === 'string'; i += 1) {
    try { current = JSON.parse(current); } catch (error) { return []; }
  }
  return Array.isArray(current) ? current : [];
}

const Order = () => {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const orderListRef = useRef(null);

  const [menu, setMenu] = useState([]);
  const [availability, setAvailability] = useState({ products: {}, options: {} });
  const busy = useRef(false);
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
  const [stockWarn, setStockWarn] = useState(null);

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
      const [menuRes, availRes] = await Promise.all([
        api.get('/menu'),
        api.get('/menu/availability').catch(() => ({ data: { products: {}, options: {} } }))
      ]);
      setMenu(menuRes.data);
      setAvailability(availRes.data || { products: {}, options: {} });
      if (menuRes.data.length > 0 && !activeCategoryId) setActiveCategoryId(menuRes.data[0].id);

      if (tableId === 'fast') {
        // Hızlı satışta geçmiş sipariş olmaz, boş bir sanal hesap aç.
        setOrder({ OrderItems: [], total_amount: 0, paid_amount: 0, discount_amount: 0 });
      } else {
        const orderRes = await api.get(`/orders/table/${tableId}`);
        setOrder(orderRes.data);
      }
    } catch (error) {
      console.error('Veriler çekilirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFastSaleCheckout = async (method, forceShort = false) => {
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
      navigate('/dashboard');
    } catch (error) {
      const shortages = stockShortages(error);
      if (shortages) {
        setStockWarn({ rows: shortages, sale: () => handleFastSaleCheckout(method, true) });
        return;
      }
      alert('Hata: ' + (error.response?.data?.message || error.message));
    }
    finally { busy.current = false; }
  };

  const handleStageItem = (product, selectedOptions = [], allowShort = false) => {
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
            ? { ...item, quantity: item.quantity + 1, lineTotal: item.lineTotal + finalUnitPrice, allowShort: item.allowShort || allowShort }
            : item
        );
      }
      return [...prev, {
        ...product,
        uniqueId, // Benzersiz ayırıcı
        quantity: 1,
        lineTotal: finalUnitPrice,
        basePrice: basePrice, // Asıl ürünü yollarken lazım
        selectedOptions, // BÜYÜ BURADA: Backend'e yollayacağımız ekstralar
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

  // Menüden bir ürüne tıklandığında çalışır
  const handleProductClick = (product) => {
    // BÜYÜ BURADA: Artık ProductOptionGroups dizisine bakıyoruz
    if (product.ProductOptionGroups && product.ProductOptionGroups.length > 0) {
      setSelectedProductForModal(product);
      setActiveOptions([]); // Önceki seçimleri temizle
      setShowModal(true);
    } else {
      // Hiçbir grubu yoksa mermi gibi direkt sepete at!
      stageOrWarn(product, []);
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
        return prev.map(item =>
          item.uniqueId === uniqueId
            ? { ...item, quantity: item.quantity - 1, lineTotal: item.lineTotal - (item.lineTotal / item.quantity) }
            : item
        );
      }
      return prev.filter(item => item.uniqueId !== uniqueId);
    });
  };

  const handleSendPendingOrders = async (forceShort = false) => {
    if (pendingItems.length === 0 || busy.current) return;
    busy.current = true;
    try {
      const items = pendingItems.map(item => ({
        productId: item.id,
        quantity: item.quantity,
        optionIds: (item.selectedOptions || []).map(opt => opt.id)
      }));
      await api.post(`/orders/table/${tableId}/items`, {
        items,
        confirmShortage: forceShort || pendingItems.some(item => item.allowShort)
      });
      setPendingItems([]);
      fetchData();
    } catch (error) {
      const shortages = stockShortages(error);
      if (shortages) {
        setStockWarn({ rows: shortages, sale: () => handleSendPendingOrders(true) });
        return;
      }
      alert('Siparişler gönderilemedi! Hata: ' + (error.response?.data?.message || error.message));
    } finally { busy.current = false; }
  };

  const handleCancelItem = async (itemIds) => {
    const ids = (Array.isArray(itemIds) ? itemIds : [itemIds]).filter(Boolean);
    if (!ids.length || !window.confirm('Bu siparişi adisyondan silmek istediğine emin misin?')) return;
    try {
      await api.post('/orders/items/cancel', { itemIds: ids });
      fetchData();
    } catch (error) { alert(error.response?.data?.message || 'İptal başarısız!'); }
  };

  const handleApplyDiscount = async () => {
    setModalError('');
    const unpaidBase = totalAmount - paidAmount;
    const val = parseFloat(discountValue);
    if (!val || val <= 0) { setModalError('Geçerli bir iskonto değeri girin!'); return; }

    let calculatedDiscount = val;
    if (discountType === 'percent') {
      if (val > 100) { setModalError('İskonto yüzdesi 100’den büyük olamaz!'); return; }
      calculatedDiscount = unpaidBase * (val / 100);
    }

    if (calculatedDiscount <= 0 || calculatedDiscount > unpaidBase + 0.01) {
      setModalError('İskonto tutarı ödenmemiş tutardan büyük olamaz!'); return;
    }

    try {
      await api.post(`/orders/table/${tableId}/discount`, { type: discountType, value: discountValue });
      setDiscountValue('');
      const nextRemaining = unpaidBase - calculatedDiscount;
      fetchData();
      setPayAmount(nextRemaining > 0.01 ? nextRemaining.toFixed(2) : '0.00');
    } catch (error) { setModalError(error.response?.data?.message || 'İskonto uygulanamadı!'); }
  };

  const handleRemoveDiscount = async () => {
    try {
      await api.post(`/orders/table/${tableId}/discount`, { type: 'amount', value: 0 });
      fetchData();
      setPayAmount(Math.max(0, totalAmount - paidAmount).toFixed(2));
    } catch (error) { alert(error.response?.data?.message || 'İskonto silinemedi!'); }
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
    const closingZero = remaining <= 0.01;
    const amount = closingZero ? 0 : parseFloat(payAmount || remaining);
    if (!closingZero && (Number.isNaN(amount) || amount <= 0 || amount > remaining + 0.01)) {
      setModalError('Geçerli bir tutar giriniz!'); return;
    }
    if (busy.current) return;
    busy.current = true;

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
    } catch (error) { setModalError(error.response?.data?.message || 'Ödeme başarısız!'); }
    finally { busy.current = false; }
  };

  const handlePrintReceipt = async () => {
    if (!order) return;

    // Fişe basılacak veriyi o anki siparişten (dinamik olarak) toparla
    const receiptData = {
      subTotal: totalAmount.toFixed(2),
      discount: discountAmount.toFixed(2),
      total: remaining.toFixed(2),
      items: Object.values(groupedOrderItems).map(item => ({
        name: item.Product?.name || item.name, // BÜYÜ BURADA: İsim sorunu çözüldü
        quantity: item.totalQty,
        lineTotal: item.sumPrice.toFixed(2),
        // Varsa ekstraları (Örn: "Duble, Enerji") aralarına virgül koyarak yazıcıya yolla
        options: item.selected_options && item.selected_options.length > 0
          ? item.selected_options.map(o => o.name).join(', ')
          : null
      }))
    };

    // Electron köprüsünden yazıcıya gönder
    if (window.electronAPI) {
      const response = await window.electronAPI.printReceipt(receiptData);
      if (response.success) {
        console.log("Fiş makineden çıktı usta!");
      } else {
        alert("Yazıcı Hatası: " + response.message);
      }
    } else {
      console.warn("Burası tarayıcı ortamı, yazıcı sadece Electron (Kasa) .exe dosyasından çalışır.");
      alert("Yazdırma işlemi sadece kasanın ana bilgisayarında çalışır!");
    }
  };

  const getActiveProducts = () => {
    const category = menu.find(c => c.id === activeCategoryId);
    return category ? (category.Products || category.products || []) : [];
  };

  const pendingTotal = pendingItems.reduce((acc, item) => acc + item.lineTotal, 0);
  const totalAmount = order ? parseFloat(order.total_amount) : 0;
  const paidAmount = order ? parseFloat(order.paid_amount || 0) : 0;
  const discountAmount = order ? parseFloat(order.discount_amount || 0) : 0;
  const unpaidBase = totalAmount - paidAmount;
  const remaining = unpaidBase - discountAmount;

  const groupedOrderItems = order?.OrderItems?.reduce((acc, item) => {
    // 1. AŞAMA (GÜVENLİK DUVARI): Veritabanından string (metin) geldiyse onu gerçek Array'e çevir
    const parsedOptions = parseOptionList(item.selected_options);
    item.selected_options = parsedOptions;

    const optsKey = parsedOptions.map(opt => opt.id).filter(id => id != null).sort((a, b) => a - b).join(',');
    const key = `${item.product_id}-${item.status}-${optsKey}`;

    if (!acc[key]) acc[key] = { ...item, totalQty: 0, sumPrice: 0, itemIds: [] };
    acc[key].itemIds.push(item.id);
    acc[key].totalQty += item.quantity || 1;
    acc[key].sumPrice += parseFloat(item.price || 0) * (item.quantity || 1);

    return acc;
  }, {}) || {};

  if (loading) return <div className="loading-screen">Yükleniyor...</div>;

  return (
    <div className="order-layout">
      {/* SOL PANEL (ADİSYON) - Dokunmadım, aynı */}
      <div className="receipt-panel">
        <div className="receipt-header">
          <h2 style={{ margin: 0, color: 'var(--primary-color)', fontSize: '20px' }}>
            {tableId === 'fast' ? '⚡ HIZLI KASA (GEL-AL)' : (order?.table_name || 'Masa')}
          </h2>
          <button className="close-panel-btn" onClick={() => navigate('/dashboard')}>KAPAT</button>
        </div>

        <div className="receipt-body">
          <div ref={orderListRef} style={{ flex: 1, overflowY: 'auto', paddingRight: '5px' }}>
            <h3 className="section-title">İŞLENEN SİPARİŞLER</h3>
            {Object.keys(groupedOrderItems).length === 0 ? (
              <p style={{ color: '#444', fontSize: '12px', fontStyle: 'italic' }}>Kayıtlı sipariş yok.</p>
            ) : (
              <ul className="order-list">
                {Object.values(groupedOrderItems).map((gItem) => (
                  <div
                    key={`${gItem.product_id}-${gItem.status}-${gItem.uniqueId}`}
                    className={`order-item-row ${gItem.status === 'Ödendi' ? 'paid-item' : ''}`}
                  >
                    <div className="item-details">
                      <span className={`item-name-text ${gItem.status === 'Ödendi' ? 'text-decoration-line-through text-muted' : ''}`}>
                        <span className="item-qty-badge">{gItem.totalQty}x</span>
                        {gItem.Product?.name}
                      </span>

                      {gItem.selected_options && gItem.selected_options.length > 0 && (
                        <span className="item-options-text">
                          ↳ + {gItem.selected_options.map(o => o.name).join(', ')}
                        </span>
                      )}
                    </div>

                    <div className="item-price-action">
                      {gItem.status === 'Ödendi' ? (
                        <span className="badge-paid">ÖDENDİ</span>
                      ) : (
                        <>
                          <span className="item-price-val">{gItem.sumPrice.toFixed(2)} ₺</span>

                          {/* İPTAL BUTONU BURAYA EKLENDİ (Gruplanmış ürünün ilk id'sini baz alır) */}
                          <button
                            className="delete-item-btn"
                            title="Siparişi Sil"
                            onClick={() => handleCancelItem(gItem.itemIds || [gItem.id])}
                          >
                            ✖
                          </button>
                        </>
                      )}
                    </div>
                  </div>
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
                          <div style={{ fontSize: '11px', color: 'var(--accent)', paddingLeft: '10px' }}>
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
            <div className="summary-row"><span>Adisyon Toplamı:</span><span>₺{totalAmount.toFixed(2)}</span></div>
            {discountAmount > 0 && <div className="summary-row discount-row"><span>İskonto:</span><span>- ₺{discountAmount.toFixed(2)}</span></div>}
            {paidAmount > 0 && <div className="summary-row paid-row"><span>Ödenen:</span><span>- ₺{paidAmount.toFixed(2)}</span></div>}
            <div className="summary-row total-row">
              <span>KALAN:</span><span style={{ color: 'var(--primary-color)' }}>₺{(remaining + pendingTotal).toFixed(2)}</span>
            </div>

            {pendingItems.length > 0 ? (
              tableId === 'fast' ? (
                <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                  <button className="send-order-btn pulse-anim" onClick={() => handleFastSaleCheckout('Nakit')} style={{ background: '#2ecc71', flex: 1, padding: '15px' }}>💵 NAKİT AL</button>
                  <button className="send-order-btn pulse-anim" onClick={() => handleFastSaleCheckout('Kredi Kartı')} style={{ background: '#3498db', flex: 1, padding: '15px' }}>💳 KART ÇEK</button>
                </div>
              ) : (
                <button className="send-order-btn pulse-anim" onClick={handleSendPendingOrders}>🚀 GÖNDER</button>
              )
            ) : (
              order && remaining > 0 && order.OrderItems.length > 0 && (
                <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                  <button className="print-btn" onClick={handlePrintReceipt}>🖨️ YAZDIR</button>
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
            <button key={cat.id} className={`cat-btn ${activeCategoryId === cat.id ? 'active' : ''}`} onClick={() => setActiveCategoryId(cat.id)}>
              <MenuGlyph name={cat.icon} />
              {cat.name}
            </button>
          ))}
        </div>
        <div className="product-grid">
          {getActiveProducts().map(prod => (
            < button key={prod.id} className="prod-btn" onClick={() => handleProductClick(prod)}>
              <span className="prod-visual">
                <ProductMark photo={prod.photo} icon={menu.find(cat => cat.id === activeCategoryId)?.icon} />
              </span>
              <span className="prod-name">{prod.name}</span>
              <span className="prod-price">₺{parseFloat(prod.price).toFixed(2)}</span>
              {shortageText(availability.products?.[prod.id]) && (
                <span style={{ color: '#ff6b6b', fontSize: '11px' }}>Stok yok: {shortageText(availability.products[prod.id])}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* --- KASA MODALI (3 SÜTUNLU YENİ MİMARİ) --- */}
      {
        showCheckout && (
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
        )
      }
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
                          <span>{opt.name}{shortageText(availability.options?.[opt.id]) ? ` · Stok yok: ${shortageText(availability.options[opt.id])}` : ''}</span>
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
                  background: isSelectionValid() ? 'var(--accent)' : '#555',
                  color: isSelectionValid() ? 'var(--accent-ink)' : '#888'
                }}
              >
                {isSelectionValid() ? 'Siparişe Ekle' : 'Seçimleri Tamamlayın'}
              </button>
            </div>

          </div>
        </div>
      )}
      <StockWarn warn={stockWarn} onCancel={() => setStockWarn(null)} onConfirm={acceptStockWarn} />
    </div >
  );
};

export default Order;