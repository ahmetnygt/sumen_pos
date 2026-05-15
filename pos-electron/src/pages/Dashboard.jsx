import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import LiveDashboard from '../components/LiveDashboard';
import './Dashboard.css';

const Dashboard = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);

    // YENİ: Anlık Kasa Durumu
    const [liveStats, setLiveStats] = useState({ dailyRevenue: 0, activeTables: 0 });

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (!storedUser) { navigate('/'); return; }
        setUser(JSON.parse(storedUser));
        fetchData();
    }, [navigate]);

    const fetchData = async () => {
        try {
            const tableRes = await api.get('/tables');
            setTables(tableRes.data);

            // Anlık kasa cirosunu ve dolu masa sayısını hesapla (Şimdilik front-end'de topluyoruz, sonra backend'e bağlarız)
            // (Backend'de rapor rotasını yazana kadar UI hazır dursun)
            const active = tableRes.data.filter(t => t.status === 'Dolu' || t.status === 'Rezerve').length;
            setLiveStats({ dailyRevenue: 0, activeTables: active }); // Ciro şimdilik 0, backend yazılınca güncelleyeceğiz

        } catch (error) {
            console.error('Veriler çekilirken hata:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/');
    };

    const getTableColor = (status) => {
        switch (status) {
            case 'Dolu': return 'table-danger';
            case 'Rezerve': return 'table-warning';
            default: return 'table-success';
        }
    };

    return (
        <div className="dashboard-layout">
            {/* ÜST BİLGİ BARI */}
            <header className="dashboard-header">
                <div className="logo-area">SÜMEN <span>POS</span></div>

                {/* YENİ: Anlık Kasa Özeti */}
                <div className="live-stats-area">
                    <div className="stat-box">
                        <span>Açık Masalar</span>
                        <strong>{liveStats.activeTables} / {tables.length}</strong>
                    </div>
                    <div className="stat-box highlight">
                        <span>Günlük Ciro</span>
                        <strong>₺{liveStats.dailyRevenue.toFixed(2)}</strong>
                    </div>
                </div>

                <div className="user-area">
                    <div className="user-info">
                        <span className="user-name">{user?.name} {user?.surname}</span>
                        <span className="user-role">{user?.role}</span>
                    </div>

                    {/* BÜYÜ BURADA: Sadece Admin ise Yönetim Paneli butonu çıkar */}
                    {user?.role === 'Admin' && (
                        <button onClick={() => navigate('/admin')} className="admin-btn">⚙️ YÖNETİM</button>
                    )}
                    <button onClick={handleLogout} className="logout-btn">Çıkış</button>
                </div>
            </header>

            <div className="dashboard-body-container">
                {/* SOL TARAF: MASALAR */}
                <main className="dashboard-main">
                    <div style={{ marginBottom: '20px', display: 'flex' }}>
                        <button
                            onClick={() => navigate(user?.role === 'Garson' ? '/waiter-order/fast' : '/order/fast')}
                            style={{ width: '100%', padding: '15px', backgroundColor: '#d4af37', color: '#000', fontSize: '18px', fontWeight: 'bold', border: 'none', borderRadius: '10px', cursor: 'pointer', boxShadow: '0 4px 15px rgba(212, 175, 55, 0.4)' }}
                        >
                            ⚡ HIZLI KASA / GEL-AL
                        </button>
                    </div>
                    {loading ? (
                        <div className="loading-text">Mekan Durumu Yükleniyor...</div>
                    ) : (
                        <div className="table-grid">
                            {tables.map(table => (
                                <div
                                    key={table.id}
                                    className={`table-card ${getTableColor(table.status)}`}
                                    onClick={() => navigate(`/order/${table.id}`)}
                                >
                                    <h3>{table.name}</h3>
                                    <p>{table.status}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </main>

                {/* SAĞ TARAF: CANLI RADAR */}
                <aside className="dashboard-sidebar">
                    <LiveDashboard />
                </aside>

            </div>
        </div>
    );
};

export default Dashboard;