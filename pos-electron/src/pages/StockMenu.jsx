import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './StockMenu.css';

const StockMenu = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('inventory');
    const [ingredients, setIngredients] = useState([]);
    const [categories, setCategories] = useState([]);
    const [products, setProducts] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [currentRecipe, setCurrentRecipe] = useState([]);

    const [showModal, setShowModal] = useState(null);
    const [formData, setFormData] = useState({});

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const [ingRes, menuRes] = await Promise.all([
                api.get('/inventory/ingredients'),
                api.get('/menu')
            ]);

            setIngredients(ingRes.data || []);
            setCategories(menuRes.data || []);

            let allProducts = [];
            menuRes.data.forEach(cat => {
                const catProducts = cat.Products || cat.products || [];
                catProducts.forEach(p => {
                    allProducts.push({
                        ...p,
                        Category: { id: cat.id, name: cat.name }
                    });
                });
            });
            setProducts(allProducts);

            // BÜYÜ BURADA: Açık olan Pop-up'ları ve Reçete ekranını Mermi gibi tazeler!
            setFormData(prev => {
                if (!prev || !prev.id) return prev;
                return allProducts.find(p => p.id === prev.id) || prev;
            });

            setSelectedProduct(prev => {
                if (!prev || !prev.id) return prev;
                return allProducts.find(p => p.id === prev.id) || prev;
            });

        } catch (error) { console.error('Veri çekme hatası:', error); }
    };

    const handleRecipeSelect = async (product) => {
        setSelectedProduct(product);
        setCurrentRecipe([]);
        try {
            const res = await api.get(`/inventory/recipes/${product.id}`);
            setCurrentRecipe(res.data || []);
        } catch (error) {
            console.error("Reçete çekilemedi:", error);
            setCurrentRecipe([]);
        }
    };

    const handleDelete = async (url, id) => {
        if (!window.confirm('Bu veriyi silmek istediğinize emin misiniz? Geri dönüşü yok!')) return;
        try {
            await api.delete(`${url}/${id}`);
            fetchData();
            if (activeTab === 'recipes') setSelectedProduct(null);
        } catch (error) { alert('Silme başarısız: ' + (error.response?.data?.message || error.message)); }
    };

    const handleFormSubmit = async (e, url) => {
        e.preventDefault();
        try {
            if (formData.id) {
                await api.put(`${url}/${formData.id}`, formData);
            } else {
                await api.post(url, formData);
            }
            setShowModal(null);
            setFormData({});
            fetchData();
        } catch (error) { alert('Hata: ' + (error.response?.data?.message || error.message)); }
    };

    const handleRecipeSubmit = async (e) => {
        e.preventDefault();
        try {
            // Seçenek (Opsiyon) reçetesi mi yoksa Ana ürün reçetesi mi olduğunu formData ile yolluyoruz
            await api.post('/inventory/recipes', {
                product_id: selectedProduct.id,
                ...formData
            });
            setShowModal(null);
            handleRecipeSelect(selectedProduct); // Reçete listesini ekranda anında yenile
        } catch (err) {
            alert("Hata: " + (err.response?.data?.message || err.message));
        }
    };

    return (
        <div className="stock-menu-layout">
            <header className="stock-header">
                <div className="header-left">
                    <button onClick={() => navigate('/admin')} className="back-btn">⬅ Geri</button>
                    <h2>STOK & MENÜ YÖNETİMİ</h2>
                </div>
                <div className="tab-bar">
                    <button className={activeTab === 'inventory' ? 'active' : ''} onClick={() => setActiveTab('inventory')}>📦 Stok</button>
                    <button className={activeTab === 'menu' ? 'active' : ''} onClick={() => setActiveTab('menu')}>🍹 Menü</button>
                    <button className={activeTab === 'recipes' ? 'active' : ''} onClick={() => setActiveTab('recipes')}>🔬 Reçeteler</button>
                </div>
            </header>

            <main className="stock-content">
                {activeTab === 'inventory' && (
                    <div className="table-container">
                        <div className="table-actions">
                            <button className="add-btn" onClick={() => { setFormData({ unit: 'cl' }); setShowModal('ingredient'); }}>+ Yeni Hammadde</button>
                        </div>
                        <table className="luxury-table">
                            <thead><tr><th>Ad</th><th>Güncel Stok</th><th>Birim</th><th>Kritik</th><th>İşlem</th></tr></thead>
                            <tbody>
                                {ingredients.map(ing => (
                                    <tr key={ing.id} className={ing.stock_amount <= ing.critical_level ? 'warning' : ''}>
                                        <td>{ing.name}</td>
                                        <td>{ing.stock_amount}</td>
                                        <td>{ing.unit}</td>
                                        <td>{ing.critical_level}</td>
                                        <td>
                                            <button className="edit-icon" onClick={() => { setFormData(ing); setShowModal('ingredient'); }}>✎</button>
                                            <button className="delete-icon" onClick={() => handleDelete('/inventory/ingredients', ing.id)}>✕</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'menu' && (
                    <div className="menu-split">
                        <div className="categories-side">
                            <h3>Kategoriler</h3>
                            <button className="add-btn-small" onClick={() => { setFormData({}); setShowModal('category'); }}>+ Ekle</button>
                            <div className="cat-list">
                                {categories.map(cat => (
                                    <div key={cat.id} className="cat-item">
                                        <span>{cat.name}</span>
                                        <button onClick={() => handleDelete('/menu/category', cat.id)}>✕</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="products-side">
                            <h3>Ürünler</h3>
                            <button className="add-btn" onClick={() => { setFormData({ category_id: categories[0]?.id || '' }); setShowModal('product'); }}>+ Yeni Ürün</button>
                            <table className="luxury-table">
                                <thead><tr><th>Ürün</th><th>Fiyat</th><th>Kategori</th><th>İşlem</th></tr></thead>
                                <tbody>
                                    {products.map(prod => (
                                        <tr key={prod.id}>
                                            <td>{prod.name}</td>
                                            <td>₺{parseFloat(prod.price).toFixed(2)}</td>
                                            <td>{prod.Category?.name || 'Kategorisiz'}</td>
                                            <td>
                                                <button className="edit-icon" onClick={() => { setFormData(prod); setShowModal('product'); }}>✎</button>
                                                <button className="option-manage-btn" onClick={() => { setFormData(prod); setShowModal('manage_options'); }}>⚙️</button>
                                                <button className="delete-icon" onClick={() => handleDelete('/menu/product', prod.id)}>✕</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'recipes' && (
                    <div className="recipe-layout">
                        <div className="recipe-products">
                            <h3>Ürünler</h3>
                            <div className="prod-scroll-list">
                                {products.map(p => (
                                    <button key={p.id} className={selectedProduct?.id === p.id ? 'active' : ''} onClick={() => handleRecipeSelect(p)}>{p.name}</button>
                                ))}
                            </div>
                        </div>
                        <div className="recipe-details">
                            {selectedProduct ? (
                                <div className="recipes-container" style={{ padding: '10px' }}>

                                    {/* --- 1. ANA REÇETE KISMI --- */}
                                    <div className="recipe-section" style={{ background: '#111', padding: '20px', borderRadius: '12px', border: '1px solid var(--primary-color)', marginBottom: '30px' }}>
                                        <div className="recipe-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                            <h3 style={{ color: 'var(--primary-color)', margin: 0 }}>🌟 {selectedProduct.name} (Ana Reçete)</h3>
                                            <button className="add-btn-small" onClick={() => {
                                                setFormData({ product_id: selectedProduct.id, option_id: null });
                                                setShowModal('recipe');
                                            }}>+ Ana Reçeteye Ekle</button>
                                        </div>

                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                            {currentRecipe.filter(r => r.option_id === null).length > 0 ? (
                                                currentRecipe.filter(r => r.option_id === null).map(ing => (
                                                    <div key={ing.recipe_id} style={{ background: 'rgba(212, 175, 55, 0.1)', border: '1px solid #d4af37', padding: '8px 12px', borderRadius: '20px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ color: '#fff' }}>{ing.name}</span>
                                                        <span style={{ color: '#d4af37', fontWeight: 'bold' }}>{ing.amount_used}{ing.unit}</span>
                                                        <button style={{ background: 'transparent', border: 'none', color: '#e63946', cursor: 'pointer', fontSize: '14px', marginLeft: '5px' }} onClick={async () => {
                                                            await api.delete(`/inventory/recipes/${ing.recipe_id}`);
                                                            handleRecipeSelect(selectedProduct);
                                                        }}>✕</button>
                                                    </div>
                                                ))
                                            ) : (
                                                <div style={{ color: '#666', fontStyle: 'italic', fontSize: '13px' }}>Ana reçete henüz oluşturulmadı.</div>
                                            )}
                                        </div>
                                    </div>

                                    {/* --- 2. SEÇENEKLERİN REÇETELERİ (GRID & CHIP TASARIMI) --- */}
                                    {selectedProduct.ProductOptionGroups?.length > 0 && (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                                            {selectedProduct.ProductOptionGroups.map(group => (
                                                <div key={group.id} className="recipe-group-card" style={{ background: '#111', padding: '15px', borderRadius: '12px', border: '1px solid #333' }}>
                                                    <h3 style={{ color: group.type === 'secim' ? '#ff4444' : '#00ffcc', margin: '0 0 15px 0', fontSize: '15px', borderBottom: '1px solid #222', paddingBottom: '10px' }}>
                                                        {group.type === 'secim' ? '🔘' : '☑️'} {group.name.toUpperCase()} GRUBU
                                                    </h3>

                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                        {group.ProductOptions?.length > 0 ? group.ProductOptions.map(opt => {
                                                            const optRecipes = currentRecipe.filter(r => r.option_id === opt.id);
                                                            return (
                                                                <div key={opt.id} style={{ background: '#1a1a1a', border: '1px solid #222', borderRadius: '8px', padding: '12px' }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                                                        <h4 style={{ color: '#fff', margin: 0, fontSize: '14px' }}>{opt.name} <span style={{ color: '#666', fontSize: '11px' }}>(+₺{opt.price_diff})</span></h4>
                                                                        <button className="add-btn-small" style={{ fontSize: '10px', padding: '5px 10px', background: '#222', color: '#fff', border: '1px solid #444' }} onClick={() => {
                                                                            setFormData({ product_id: selectedProduct.id, option_id: opt.id });
                                                                            setShowModal('recipe');
                                                                        }}>+ Ekle</button>
                                                                    </div>

                                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                                        {optRecipes.length > 0 ? (
                                                                            optRecipes.map(ing => (
                                                                                <div key={ing.recipe_id} style={{ background: '#222', border: '1px solid #444', padding: '4px 10px', borderRadius: '15px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                                    <span style={{ color: '#ccc' }}>{ing.name}:</span>
                                                                                    <span style={{ color: '#00ffcc', fontWeight: 'bold' }}>+{ing.amount_used}{ing.unit}</span>
                                                                                    <button style={{ background: 'none', border: 'none', color: '#e63946', cursor: 'pointer', marginLeft: '4px' }} onClick={async () => {
                                                                                        await api.delete(`/inventory/recipes/${ing.recipe_id}`);
                                                                                        handleRecipeSelect(selectedProduct);
                                                                                    }}>✕</button>
                                                                                </div>
                                                                            ))
                                                                        ) : (
                                                                            <div style={{ fontSize: '11px', color: '#555', fontStyle: 'italic' }}>Bu seçeneğe ekstra reçete atanmamış.</div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        }) : <div style={{ color: '#555', fontSize: '12px' }}>Bu grupta seçenek yok.</div>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : <div className="empty-state">Düzenlemek için ürün seçin.</div>}
                        </div>
                    </div>
                )}
            </main>

            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-box">
                        <button className="close-modal" onClick={() => setShowModal(null)}>✖</button>

                        {showModal === 'ingredient' && (
                            <form onSubmit={(e) => handleFormSubmit(e, '/inventory/ingredients')}>
                                <h3>{formData.id ? 'Düzenle' : 'Yeni Hammadde'}</h3>
                                <input type="text" placeholder="Ad" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                                <input type="number" step="0.01" placeholder="Stok" value={formData.stock_amount || ''} onChange={e => setFormData({ ...formData, stock_amount: e.target.value })} required />
                                <select value={formData.unit || 'cl'} onChange={e => setFormData({ ...formData, unit: e.target.value })}>
                                    <option value="cl">cl</option><option value="adet">adet</option><option value="gr">gr</option><option value="kg">kg</option>
                                </select>
                                <input type="number" step="0.01" placeholder="Kritik" value={formData.critical_level || ''} onChange={e => setFormData({ ...formData, critical_level: e.target.value })} required />
                                <button type="submit">Kaydet</button>
                            </form>
                        )}

                        {showModal === 'category' && (
                            <form onSubmit={(e) => handleFormSubmit(e, '/menu/category')}>
                                <h3>{formData.id ? 'Düzenle' : 'Yeni Kategori'}</h3>
                                <input type="text" placeholder="Kategori Adı" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                                <button type="submit">Kaydet</button>
                            </form>
                        )}

                        {showModal === 'product' && (
                            <form onSubmit={(e) => handleFormSubmit(e, '/menu/product')}>
                                <h3>{formData.id ? 'Düzenle' : 'Yeni Ürün'}</h3>
                                <input type="text" placeholder="Ürün Adı" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                                <input type="number" step="0.01" placeholder="Fiyat" value={formData.price || ''} onChange={e => setFormData({ ...formData, price: e.target.value })} required />
                                <select value={formData.category_id || ''} onChange={e => setFormData({ ...formData, category_id: e.target.value })} required>
                                    <option value="">Kategori Seçin...</option>
                                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                </select>
                                
                                <textarea 
                                    placeholder="Tarif / Yapılış Açıklaması (Opsiyonel - Sadece Mutfağa Gider)" 
                                    value={formData.instructions || ''} 
                                    onChange={e => setFormData({ ...formData, instructions: e.target.value })} 
                                    rows="3" 
                                    style={{width: '100%', padding: '10px', background: '#111', color: '#fff', border: '1px solid #333', borderRadius: '6px', marginBottom: '10px'}}
                                />

                                <button type="submit">Kaydet</button>
                            </form>
                        )}{showModal === 'product' && (
                            <form onSubmit={(e) => handleFormSubmit(e, '/menu/product')}>
                                <h3>{formData.id ? 'Düzenle' : 'Yeni Ürün'}</h3>
                                <input type="text" placeholder="Ürün Adı" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                                <input type="number" step="0.01" placeholder="Fiyat" value={formData.price || ''} onChange={e => setFormData({ ...formData, price: e.target.value })} required />
                                <select value={formData.category_id || ''} onChange={e => setFormData({ ...formData, category_id: e.target.value })} required>
                                    <option value="">Kategori Seçin...</option>
                                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                </select>
                                <button type="submit">Kaydet</button>
                            </form>
                        )}{showModal === 'product' && (
                            <form onSubmit={(e) => handleFormSubmit(e, '/menu/product')}>
                                <h3>{formData.id ? 'Düzenle' : 'Yeni Ürün'}</h3>
                                <input type="text" placeholder="Ürün Adı" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                                <input type="number" step="0.01" placeholder="Fiyat" value={formData.price || ''} onChange={e => setFormData({ ...formData, price: e.target.value })} required />
                                <select value={formData.category_id || ''} onChange={e => setFormData({ ...formData, category_id: e.target.value })} required>
                                    <option value="">Kategori Seçin...</option>
                                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                </select>
                                
                                {/* BÜYÜ BURADA: Mutfak için Tarif / Yapılış Alanı */}
                                <textarea 
                                    placeholder="Tarif / Yapılış Açıklaması (Opsiyonel - Sadece Mutfağa Gider)" 
                                    value={formData.instructions || ''} 
                                    onChange={e => setFormData({ ...formData, instructions: e.target.value })} 
                                    rows="3" 
                                    style={{width: '100%', padding: '10px', background: '#111', color: '#fff', border: '1px solid #333', borderRadius: '6px', marginBottom: '10px'}}
                                />

                                <button type="submit">Kaydet</button>
                            </form>
                        )}

                        {showModal === 'recipe' && (
                            <form onSubmit={handleRecipeSubmit}>
                                <h3>{selectedProduct.name} Reçetesi</h3>
                                <p style={{ color: '#aaa', marginBottom: '15px' }}>
                                    Hedef: {formData.option_id
                                        ? <span style={{ color: '#00ffcc' }}>
                                            Seçenek ({
                                                // BÜYÜ BURADA: Grupların içindeki seçenekleri birleştirip ismini buluyoruz
                                                selectedProduct.ProductOptionGroups?.flatMap(g => g.ProductOptions || []).find(o => o.id === formData.option_id)?.name || 'Bilinmeyen'
                                            })
                                        </span>
                                        : <span style={{ color: 'var(--primary-color)' }}>Ana Reçete</span>}
                                </p>

                                <select value={formData.ingredient_id || ''} onChange={e => setFormData({ ...formData, ingredient_id: e.target.value })} required>
                                    <option value="">Hammadde Seçiniz...</option>
                                    {ingredients.map(ing => <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>)}
                                </select>

                                <input type="number" step="0.01" placeholder="Miktar" value={formData.amount_used || ''} onChange={e => setFormData({ ...formData, amount_used: e.target.value })} required />
                                <button type="submit">Ekle</button>
                            </form>
                        )}

                        {showModal === 'manage_options' && (
                            <div className="modal-overlay">
                                <div className="modal-box luxury-modal" style={{ maxWidth: '700px', width: '90%' }}>
                                    <button className="close-modal" onClick={() => setShowModal(null)}>✕</button>
                                    <h2 style={{ color: 'var(--primary-color)', marginBottom: '20px' }}>{formData.name} - Seçenek Yapılandırıcı</h2>

                                    {/* YENİ GRUP EKLEME (Kullanıcı Dostu Giriş) */}
                                    <div className="group-add-section" style={{ background: '#111', padding: '15px', borderRadius: '8px', border: '1px solid #333', marginBottom: '20px' }}>
                                        <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#888' }}>+ Yeni Seçenek Grubu Oluştur (Örn: Boyut Seçimi, Soslar)</h4>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <input type="text" placeholder="Grup Adı..." id="new_group_name" style={{ flex: 1 }} />
                                            <select id="new_group_type" style={{ width: '150px' }}>
                                                <option value="secim">🔘 Tekli Seçim</option>
                                                <option value="ekstra">☑️ Çoklu Ekstra</option>
                                            </select>
                                            <button className="add-btn-small" onClick={async () => {
                                                const nameInput = document.getElementById('new_group_name');
                                                const typeInput = document.getElementById('new_group_type');

                                                if (!nameInput || !nameInput.value) return alert('Lütfen bir grup adı girin!');

                                                await api.post(`/menu/product/${formData.id}/group`, { name: nameInput.value, type: typeInput.value });
                                                nameInput.value = '';
                                                fetchData(); // Ekranı anında günceller
                                            }}>Grup Aç</button>
                                        </div>
                                    </div>

                                    {/* MEVCUT GRUPLAR VE SEÇENEKLER LİSTESİ */}
                                    <div className="groups-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                        {formData.ProductOptionGroups?.length === 0 && <p style={{ textAlign: 'center', color: '#444' }}>Henüz seçenek grubu eklenmemiş.</p>}

                                        {formData.ProductOptionGroups?.map(group => (
                                            <div key={group.id} className="admin-group-card" style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', marginBottom: '15px', overflow: 'hidden' }}>
                                                {/* Grup Başlığı */}
                                                <div style={{ background: '#222', padding: '10px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333' }}>
                                                    <span style={{ fontWeight: '800', color: group.type === 'secim' ? '#ff4444' : '#00ffcc' }}>
                                                        {group.type === 'secim' ? '🔘' : '☑️'} {group.name?.toUpperCase()}
                                                    </span>
                                                    <button className="del-btn-small" onClick={async () => {
                                                        if (window.confirm('Tüm grubu silmek istediğine emin misin?')) {
                                                            await api.delete(`/menu/group/${group.id}`);
                                                            fetchData();
                                                        }
                                                    }}>✕</button>
                                                </div>

                                                {/* Seçenek Listesi */}
                                                <div style={{ padding: '10px' }}>
                                                    <div className="opt-items-list">
                                                        {group.ProductOptions?.map(opt => (
                                                            <div key={opt.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', borderBottom: '1px solid #222', fontSize: '13px' }}>
                                                                <span>{opt.name} <strong style={{ color: 'var(--primary-color)' }}>(+₺{opt.price_diff})</strong></span>
                                                                <button className="del-btn-small" onClick={async () => {
                                                                    await api.delete(`/menu/option/${opt.id}`);
                                                                    fetchData();
                                                                }}>✕</button>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* SEÇENEK EKLEME BUTONU (Grup İçinde) */}
                                                    <div style={{ display: 'flex', gap: '5px', marginTop: '10px' }}>
                                                        <input type="text" placeholder="Seçenek (Örn: Orta Boy)" id={`opt_name_${group.id}`} style={{ flex: 1, padding: '5px', fontSize: '12px' }} />
                                                        <input type="number" placeholder="+ Fiyat" id={`opt_price_${group.id}`} style={{ width: '70px', padding: '5px', fontSize: '12px' }} />
                                                        <button className="add-btn-small" style={{ fontSize: '11px' }} onClick={async () => {
                                                            // BÜYÜ BURADA: Korumalı Element Çağrısı
                                                            const nameInput = document.getElementById(`opt_name_${group.id}`);
                                                            const priceInput = document.getElementById(`opt_price_${group.id}`);

                                                            if (!nameInput || !nameInput.value) {
                                                                alert("Lütfen seçenek adı girin!");
                                                                return;
                                                            }

                                                            await api.post(`/menu/group/${group.id}/option`, {
                                                                name: nameInput.value,
                                                                price_diff: priceInput ? (priceInput.value || 0) : 0
                                                            });

                                                            // Başarılı olursa içlerini temizle
                                                            if (nameInput) nameInput.value = '';
                                                            if (priceInput) priceInput.value = '';
                                                            fetchData();
                                                        }}>Ekle</button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )
            }
        </div >
    );
};

export default StockMenu;