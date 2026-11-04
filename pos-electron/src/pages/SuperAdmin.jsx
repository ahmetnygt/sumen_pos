import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './AdminPanel.css';

const emptyForm = {
    name: '',
    code: '',
    branch_name: '',
    branch_code: '',
    admin_name: '',
    admin_surname: '',
    admin_pin: '',
    admin_password: '',
    accent_color: '#d4af37',
    logo_svg: ''
};

const SuperAdmin = () => {
    const navigate = useNavigate();
    const [companies, setCompanies] = useState([]);
    const [form, setForm] = useState(emptyForm);
    const [error, setError] = useState('');

    const load = async () => {
        const res = await api.get('/companies');
        setCompanies(res.data);
    };

    useEffect(() => {
        const stored = localStorage.getItem('user');
        const user = stored ? JSON.parse(stored) : null;
        if (user?.role !== 'SuperAdmin') {
            navigate('/');
            return;
        }
        load().catch(() => setError('Firmalar alınamadı.'));
    }, [navigate]);

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/');
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            await api.post('/companies', form);
            setForm(emptyForm);
            await load();
        } catch (err) {
            setError(err.response?.data?.message || 'Firma eklenemedi.');
        }
    };

    const setField = (key) => (e) => setForm({ ...form, [key]: e.target.value });

    const onLogo = (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (file.size > 100 * 1024) {
            setError('Logo 100 KB sınırını aşıyor.');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const text = String(reader.result || '').trim();
            if (!/^<svg[\s>]/i.test(text)) {
                setError('Logo bir SVG olmalıdır.');
                return;
            }
            setError('');
            setForm(prev => ({ ...prev, logo_svg: text }));
        };
        reader.readAsText(file);
    };

    return (
        <div className="admin-layout">
            <header className="admin-header">
                <div className="admin-logo">
                    <h2>SÜMEN <span>SİSTEM</span></h2>
                    <p>Firma yönetimi</p>
                </div>
                <div className="admin-actions">
                    <button onClick={logout} className="back-kasa-btn">Çıkış</button>
                </div>
            </header>
            <div className="admin-content" style={{ overflowY: 'auto', padding: 24 }}>
                <form onSubmit={onSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 720, marginBottom: 28 }}>
                    <input placeholder="Firma adı" value={form.name} onChange={setField('name')} required />
                    <input placeholder="Firma kodu (4 hane)" value={form.code} onChange={setField('code')} maxLength={4} required />
                    <input placeholder="İlk şube adı" value={form.branch_name} onChange={setField('branch_name')} required />
                    <input placeholder="Şube kodu (4 hane)" value={form.branch_code} onChange={setField('branch_code')} maxLength={4} required />
                    <input placeholder="Yönetici adı" value={form.admin_name} onChange={setField('admin_name')} required />
                    <input placeholder="Yönetici soyadı" value={form.admin_surname} onChange={setField('admin_surname')} required />
                    <input placeholder="Yönetici PIN" value={form.admin_pin} onChange={setField('admin_pin')} maxLength={4} required />
                    <input placeholder="Yönetici şifre PIN" value={form.admin_password} onChange={setField('admin_password')} maxLength={4} required />
                    <label className="brand-field">
                        Vurgu rengi
                        <input type="color" value={form.accent_color} onChange={setField('accent_color')} />
                    </label>
                    <label className="brand-field">
                        Logo SVG
                        <input type="file" accept="image/svg+xml,.svg" onChange={onLogo} />
                        {form.logo_svg ? <span>Logo seçildi</span> : null}
                    </label>
                    <button type="submit" style={{ gridColumn: '1 / -1', background: '#d4af37', color: '#111', border: 'none', padding: 12, fontWeight: 'bold', cursor: 'pointer' }}>Firma oluştur</button>
                </form>
                {error && <p style={{ color: '#e63946' }}>{error}</p>}
                <table className="luxury-table" style={{ width: '100%' }}>
                    <thead>
                        <tr><th>Firma</th><th>Kod</th><th>Renk</th><th>Şubeler</th></tr>
                    </thead>
                    <tbody>
                        {companies.map(company => (
                            <tr key={company.id}>
                                <td>{company.name}</td>
                                <td>{company.code}</td>
                                <td><span className="brand-swatch" style={{ background: company.accent_color || '#d4af37' }} /></td>
                                <td>{(company.Branches || []).map(branch => `${branch.name} (${branch.code})`).join(', ') || '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default SuperAdmin;
