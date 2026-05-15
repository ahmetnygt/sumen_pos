import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './Dashboard.css'; // Kasa ile aynı masa tasarımını kullanıyoruz

const WaiterDashboard = () => {
    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem('user'));

    useEffect(() => {
        fetchTables();
        const interval = setInterval(fetchTables, 5000); // Garson ekranı her 5 saniyede bir güncellenir
        return () => clearInterval(interval);
    }, []);

    const fetchTables = async () => {
        try {
            const response = await api.get('/tables');
            setTables(response.data);
        } catch (error) {
            console.error('Masalar çekilemedi:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleTableClick = (tableId, currentStatus) => {
        // Backend zaten ilk ürün eklendiğinde masayı otomatik "Dolu" yapacak.
        // Bu yüzden boşuna API isteği atmıyoruz, garsonu mermi gibi masaya sokuyoruz!
        navigate(`/waiter-order/${tableId}`);
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/');
    };

    if (loading) return <div className="loading-screen">Yükleniyor...</div>;

    return (
        <div className="dashboard-layout">
            <header className="dashboard-header">
                <div className="header-left">
                    <h2>SÜMEN <span>POS</span></h2>
                    <span className="waiter-badge">🚶 {user?.name} {user?.surname} (Garson)</span>
                </div>
                <button className="logout-btn" onClick={handleLogout}>Çıkış Yap</button>
            </header>
            <main className="dashboard-content">
                <div style={{ marginBottom: '15px', display: 'flex' }}>
                    <button
                        onClick={() => navigate(user?.role === 'Garson' ? '/waiter-order/fast' : '/order/fast')}
                        style={{ width: '100%', padding: '15px', backgroundColor: '#d4af37', color: '#000', fontSize: '18px', fontWeight: 'bold', border: 'none', borderRadius: '10px', cursor: 'pointer', boxShadow: '0 4px 15px rgba(212, 175, 55, 0.4)' }}
                    >
                        ⚡ HIZLI KASA / GEL-AL
                    </button>
                </div>
                <div className="table-grid">
                    {tables.map(table => (
                        <div
                            key={table.id}
                            className={`table-card ${table.status === 'Boş' ? 'empty' : 'occupied'}`}
                            onClick={() => handleTableClick(table.id, table.status)}
                        >
                            <div className="table-number">{table.id}</div>
                            <div className="table-status">{table.status === 'Boş' ? 'Boş' : 'Dolu'}</div>
                            {table.status !== 'Boş' && table.total_amount > 0 && (
                                <div className="table-amount">₺{parseFloat(table.total_amount).toFixed(2)}</div>
                            )}
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
};

export default WaiterDashboard;