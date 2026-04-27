import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './Personnel.css';

const Personnel = () => {
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ role: 'Garson' });

    useEffect(() => { fetchUsers(); }, []);

    const fetchUsers = async () => {
        try {
            const res = await api.get('/users');
            setUsers(res.data);
        } catch (error) {
            console.error('Personel çekilemedi:', error);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Bu personeli sistemden silmek istediğine emin misin? Dönüşü yok!')) return;
        try {
            await api.delete(`/users/${id}`);
            fetchUsers();
        } catch (error) {
            alert('Silinemedi: ' + (error.response?.data?.message || error.message));
        }
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/users', formData);
            setShowModal(false);
            setFormData({ role: 'Garson' });
            fetchUsers();
        } catch (error) {
            alert('Hata: ' + (error.response?.data?.message || error.message));
        }
    };

    const getRoleBadge = (role) => {
        switch (role) {
            case 'Admin': return <span className="badge badge-admin">👑 PATRON</span>;
            case 'Kasa': return <span className="badge badge-kasa">💳 KASA</span>;
            case 'Garson': return <span className="badge badge-garson">🚶 GARSON</span>;
            default: return <span className="badge">{role}</span>;
        }
    };

    return (
        <div className="personnel-layout">
            <header className="personnel-header">
                <div className="header-left">
                    <button onClick={() => navigate('/admin')} className="back-btn">⬅ Geri</button>
                    <h2>İNSAN KAYNAKLARI & YETKİLENDİRME</h2>
                </div>
                <button className="add-btn" onClick={() => { setFormData({ role: 'Garson' }); setShowModal(true); }}>+ Yeni Personel</button>
            </header>

            <main className="personnel-content">
                <div className="table-container">
                    <table className="luxury-table">
                        <thead>
                            <tr>
                                <th>Ad Soyad</th>
                                <th>Giriş PIN</th>
                                <th>Şifre (PIN)</th>
                                <th>Yetki Seviyesi</th>
                                <th>İşlem</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => (
                                <tr key={user.id}>
                                    <td style={{ fontWeight: 'bold' }}>{user.name} {user.surname}</td>

                                    {/* BÜYÜ BURADA: user.pin değil, user.user_pin okuyacağız */}
                                    <td style={{ letterSpacing: '2px', color: '#d4af37', fontWeight: 'bold' }}>
                                        {user.user_pin}
                                    </td>

                                    {/* Şifre (pass_pin) backend'de kriptolandığı için buraya karmaşık bir hash gelir, 
                                    o yüzden ekranda *** veya Gizli göstermek daha profesyoneldir */}
                                    <td style={{ letterSpacing: '2px', color: '#888' }}>
                                        {user.pass_pin ? '••••••••' : 'Yok'}
                                    </td>

                                    <td>{getRoleBadge(user.role)}</td>
                                    <td>
                                        {user.role !== 'Admin' && (
                                            <button className="delete-icon" onClick={() => handleDelete(user.id)}>KOV ✕</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {users.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>Sistemde kimse yok.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </main>

            {showModal && (
                <div className="hr-modal-overlay">
                    <div className="hr-modal-box">
                        <button className="close-modal" onClick={() => setShowModal(false)}>✖</button>
                        <form onSubmit={handleFormSubmit}>
                            <h3>Sisteme Personel Ekle</h3>

                            {/* İSİM SOYİSİM YAN YANA */}
                            <div className="form-group-row">
                                <input type="text" placeholder="İsim" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                                <input type="text" placeholder="Soyisim" value={formData.surname || ''} onChange={e => setFormData({ ...formData, surname: e.target.value })} required />
                            </div>

                            {/* PIN VE ŞİFRE YAN YANA */}
                            <div className="form-group-row">
                                <input type="text" placeholder="Giriş PIN (Sistem)" value={formData.pin || ''} onChange={e => setFormData({ ...formData, pin: e.target.value })} required />
                                <input type="text" placeholder="Şifre PIN" value={formData.password || ''} onChange={e => setFormData({ ...formData, password: e.target.value })} required />
                            </div>

                            <select value={formData.role || 'Garson'} onChange={e => setFormData({ ...formData, role: e.target.value })} required>
                                <option value="Garson">Garson (Sadece sipariş girer)</option>
                                <option value="Kasa">Kasa (Ödeme alır, iptal yapar)</option>
                                <option value="Admin">Admin (Tam Yetki)</option>
                            </select>

                            <button type="submit" className="submit-btn">Kaydet</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Personnel;