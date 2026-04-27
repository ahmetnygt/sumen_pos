import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './AdminPanel.css';

const AdminPanel = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      navigate('/'); return;
    }
    const parsedUser = JSON.parse(storedUser);
    
    // Güvenlik Duvarı: Kasa veya Garson buraya sızmaya çalışırsa siktiri çek
    if (parsedUser.role !== 'Admin') {
      alert('Güvenlik İhlali: Bu alana girmeye yetkiniz yok!');
      navigate('/dashboard');
      return;
    }
    setUser(parsedUser);
  }, [navigate]);

  return (
    <div className="admin-layout">
      {/* HEADER */}
      <header className="admin-header">
        <div className="admin-logo">
          <h2>LUX <span>MERKEZ KOMUTA</span></h2>
          <p>Yönetim ve Raporlama Paneli</p>
        </div>
        <div className="admin-actions">
          <span className="admin-badge">Yetki: PATRON</span>
          <button onClick={() => navigate('/dashboard')} className="back-kasa-btn">⬅ Kasa Ekranına Dön</button>
        </div>
      </header>

      {/* ANA MENÜ MODÜLLERİ */}
      <div className="admin-content">
        <h3 className="module-title">SİSTEM MODÜLLERİ</h3>
        
        <div className="admin-grid">
          
          <div className="admin-card" onClick={() => alert('Stok & Menü modülü yazılacak')}>
            <div className="card-icon">📋</div>
            <h4>Stok & Menü</h4>
            <p>Ürün fiyatları, kategoriler, hammadde ve reçete yönetimi.</p>
          </div>

          <div className="admin-card" onClick={() => alert('Finans Raporları yazılacak')}>
            <div className="card-icon">📈</div>
            <h4>Finans & Raporlar</h4>
            <p>Günlük/Aylık ciro, en çok satanlar, iskonto analizleri.</p>
          </div>

          <div className="admin-card" onClick={() => alert('Vardiya Sistemi yazılacak')}>
            <div className="card-icon">🕒</div>
            <h4>Vardiya (Shift)</h4>
            <p>Kasa açılış/kapanış, personel mesai ve açık/fazla takibi.</p>
          </div>

          <div className="admin-card" onClick={() => alert('İnsan Kaynakları yazılacak')}>
            <div className="card-icon">👥</div>
            <h4>İnsan Kaynakları</h4>
            <p>Yeni personel işe alımı, yetkilendirme ve PIN kodu yönetimi.</p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AdminPanel;