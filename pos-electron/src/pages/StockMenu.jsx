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
                                <div className="recipes-container">
                                    {/* --- 1. ANA REÇETE KISMI --- */}
                                    <div className="recipe-section">
                                        <div className="recipe-header-row">
                                            <h3 style={{ color: 'var(--primary-color)' }}>{selectedProduct.name} (Ana Reçete)</h3>
                                            <button className="add-btn-small" onClick={() => {
                                                setFormData({ product_id: selectedProduct.id, option_id: null });
                                                setShowModal('recipe');
                                            }}>+ Ana Reçeteye Ekle</button>
                                        </div>
                                        <table className="luxury-table">
                                            <thead><tr><th>Hammadde</th><th>Miktar</th><th>Birim</th><th>İşlem</th></tr></thead>
                                            <tbody>
                                                {currentRecipe.filter(r => r.option_id === null).length > 0 ? (
                                                    currentRecipe.filter(r => r.option_id === null).map(ing => (
                                                        <tr key={ing.recipe_id}>
                                                            <td>{ing.name}</td>
                                                            <td>{ing.amount_used}</td>
                                                            <td>{ing.unit}</td>
                                                            <td>
                                                                <button className="delete-icon" onClick={async () => {
                                                                    await api.delete(`/inventory/recipes/${ing.recipe_id}`);
                                                                    handleRecipeSelect(selectedProduct);
                                                                }}>✕</button>
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr><td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: '#666' }}>Ana reçete boş.</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* --- 2. SEÇENEKLERİN (OPSİYON) REÇETELERİ --- */}
                                    {selectedProduct.ProductOptions?.map(opt => {
                                        const optRecipes = currentRecipe.filter(r => r.option_id === opt.id);
                                        return (
                                            <div key={opt.id} className="recipe-section" style={{ marginTop: '30px', borderTop: '1px solid #333', paddingTop: '15px' }}>
                                                <div className="recipe-header-row">
                                                    <h4 style={{ color: '#00ffcc', margin: 0 }}>Seçenek: {opt.name} <span style={{ fontSize: '12px', color: '#aaa' }}>(+₺{opt.price_diff})</span></h4>
                                                    <button className="add-btn-small" onClick={() => {
                                                        setFormData({ product_id: selectedProduct.id, option_id: opt.id });
                                                        setShowModal('recipe');
                                                    }}>+ Bu Seçeneğe Ekle</button>
                                                </div>
                                                <table className="luxury-table">
                                                    <thead><tr><th>Hammadde</th><th>Ekstra Miktar</th><th>Birim</th><th>İşlem</th></tr></thead>
                                                    <tbody>
                                                        {optRecipes.length > 0 ? (
                                                            optRecipes.map(ing => (
                                                                <tr key={ing.recipe_id}>
                                                                    <td>{ing.name}</td>
                                                                    <td><span style={{ color: '#d4af37' }}>+{ing.amount_used}</span></td>
                                                                    <td>{ing.unit}</td>
                                                                    <td>
                                                                        <button className="delete-icon" onClick={async () => {
                                                                            await api.delete(`/inventory/recipes/${ing.recipe_id}`);
                                                                            handleRecipeSelect(selectedProduct);
                                                                        }}>✕</button>
                                                                    </td>
                                                                </tr>
                                                            ))
                                                        ) : (
                                                            <tr><td colSpan="4" style={{ textAlign: 'center', padding: '15px', color: '#555', fontStyle: 'italic' }}>Bu seçeneğe ekstra reçete atanmamış.</td></tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        );
                                    })}
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
                                <button type="submit">Kaydet</button>
                            </form>
                        )}

                        {showModal === 'recipe' && (
                            <form onSubmit={handleRecipeSubmit}>
                                <h3>{selectedProduct.name} Reçetesi</h3>
                                <p style={{ color: '#aaa', marginBottom: '15px' }}>
                                    Hedef: {formData.option_id
                                        ? <span style={{ color: '#00ffcc' }}>Seçenek ({selectedProduct.ProductOptions.find(o => o.id === formData.option_id)?.name})</span>
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
                                <div className="modal-box luxury-modal">
                                    <button className="close-modal" onClick={() => setShowModal(null)}>✕</button>
                                    <h3>{formData.name} - Seçenek Yönetimi</h3>

                                    {/* Yeni Seçenek Ekleme Formu */}
                                    <div className="add-option-inline">
                                        <input type="text" placeholder="Örn: Duble" id="new_opt_name" />
                                        <input type="number" placeholder="+ Fiyat" id="new_opt_price" />
                                        <button onClick={async () => {
                                            const name = document.getElementById('new_opt_name').value;
                                            const price = document.getElementById('new_opt_price').value;
                                            await api.post(`/menu/product/${formData.id}/option`, { name, price_diff: price });
                                            fetchData(); // Listeyi yenile
                                        }}>Ekle</button>
                                    </div>

                                    {/* Mevcut Seçenekler Listesi */}
                                    <div className="options-list-admin">
                                        {formData.ProductOptions?.map(opt => (
                                            <div key={opt.id} className="admin-opt-item">
                                                <span>{opt.name} (+₺{opt.price_diff})</span>
                                                <button className="del-btn-small" onClick={async () => {
                                                    await api.delete(`/menu/option/${opt.id}`);
                                                    fetchData();
                                                }}>✕</button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StockMenu;