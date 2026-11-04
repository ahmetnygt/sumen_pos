import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { holdingReservation, todayKey } from '../utils/reservationWindow';
import BrandMark from '../components/BrandMark';
import { readBrand } from '../utils/brand';
import './Dashboard.css'; // Kasa ile aynı masa tasarımını kullanıyoruz

function clock(value) {
    return new Date(value).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function statusClass(status) {
    if (status === 'Geldi') return 'arrived';
    if (status === 'Gelmedi') return 'missed';
    if (status === 'İptal') return 'cancelled';
    return 'waiting';
}

function MenuIcon({ name }) {
    const common = {
        width: 20,
        height: 20,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.8,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true
    };
    if (name === 'calendar') {
        return (
            <svg {...common}>
                <rect x="4" y="5" width="16" height="15" rx="2" />
                <path d="M8 3v4M16 3v4M4 10h16" />
            </svg>
        );
    }
    if (name === 'clock') {
        return (
            <svg {...common}>
                <circle cx="12" cy="12" r="8" />
                <path d="M12 8v5l3 2" />
            </svg>
        );
    }
    if (name === 'history') {
        return (
            <svg {...common}>
                <path d="M4 12a8 8 0 1 0 2.2-5.5" />
                <path d="M4 4v4h4M12 8v5l3 2" />
            </svg>
        );
    }
    return (
        <svg {...common}>
            <path d="M10 7V5a2 2 0 0 1 2-2h7v18h-7a2 2 0 0 1-2-2v-2" />
            <path d="M14 12H4m0 0 3-3m-3 3 3 3" />
        </svg>
    );
}

const WaiterDashboard = () => {
    const brand = readBrand();
    const [tables, setTables] = useState([]);
    const [reservations, setReservations] = useState([]);
    const [listOpen, setListOpen] = useState(false);
    const [menuMounted, setMenuMounted] = useState(false);
    const [menuShown, setMenuShown] = useState(false);
    const [tableWarn, setTableWarn] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem('user'));

    useEffect(() => {
        const user = JSON.parse(localStorage.getItem('user'));
        if (user?.role === 'Mutfak') {
            navigate('/kitchen-dashboard'); // Eğer mutfakçıysa zorla mutfağa geri at
        }
    }, []);

    useEffect(() => {
        fetchTables();
        const interval = setInterval(fetchTables, 5000); // Garson ekranı her 5 saniyede bir güncellenir
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (menuShown || !menuMounted) return undefined;
        const timer = setTimeout(() => setMenuMounted(false), 280);
        return () => clearTimeout(timer);
    }, [menuShown, menuMounted]);

    const openMenu = () => {
        setMenuMounted(true);
        requestAnimationFrame(() => requestAnimationFrame(() => setMenuShown(true)));
    };

    const closeMenu = () => setMenuShown(false);

    const fetchTables = async () => {
        try {
            const [tableRes, reservationRes] = await Promise.all([
                api.get('/tables'),
                api.get('/reservations', { params: { date: todayKey() } }).catch(() => ({ data: [] }))
            ]);
            setTables(tableRes.data);
            setReservations(Array.isArray(reservationRes.data) ? reservationRes.data : []);
        } catch (error) {
            console.error('Masalar çekilemedi:', error);
        } finally {
            setLoading(false);
        }
    };

    const openTable = (table) => {
        const hold = holdingReservation(reservations, table);
        if (hold) {
            setTableWarn({ table, reservation: hold });
            return;
        }
        navigate(`/waiter-order/${table.id}`);
    };

    const mark = async (row, status) => {
        await api.patch(`/reservations/${row.id}`, { status });
        await fetchTables();
        if (status === 'Geldi') {
            setListOpen(false);
            navigate(`/waiter-order/${row.table_id}`);
        }
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
                <div className="header-row">
                    <div className="header-left">
                        {brand ? <BrandMark brand={brand} /> : <h2>SÜMEN <span>POS</span></h2>}
                        <span className="waiter-badge">🚶 {user?.name} {user?.surname} · {user?.branch_name || 'Şube'}</span>
                    </div>
                    <button type="button" className="menu-btn" aria-label="Menü" onClick={openMenu}>
                        <span /><span /><span />
                    </button>
                </div>
            </header>
            <main className="dashboard-content">
                <div className="table-grid">

                    <div
                        className="table-card fast-sale-card"
                        onClick={() => navigate('/waiter-order/fast')}
                    >
                        <div className="table-number">HIZLI SATIŞ</div>
                        <div className="table-status">Gel-Al Sipariş Gir</div>
                    </div>

                    {/* Aşağısı mevcut masa listeleme (tables.map) kodu olarak devam edecek... */}
                    {tables.map(table => {
                        const hold = holdingReservation(reservations, table);
                        const tone = table.status !== 'Boş' ? 'occupied' : hold ? 'reserved' : 'empty';
                        return (
                            <div
                                key={table.id}
                                className={`table-card ${tone}`}
                                onClick={() => openTable(table)}
                            >
                                <div className="table-number">{table.name}</div>
                                <div className="table-status">
                                    {hold ? (
                                        <>
                                            <span className="table-hold-guest">{hold.guest_name}</span>
                                            <span className="table-hold-time">{clock(hold.starts_at)} · {hold.party_size} kişi</span>
                                        </>
                                    ) : (table.status === 'Boş' ? 'Boş' : 'Dolu')}
                                </div>
                                {table.status !== 'Boş' && table.total_amount > 0 && (
                                    <div className="table-amount">₺{parseFloat(table.total_amount).toFixed(2)}</div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </main>
            {menuMounted && (
                <div className={`waiter-menu${menuShown ? ' open' : ''}`} onClick={closeMenu}>
                    <div className="waiter-menu-panel" onClick={(event) => event.stopPropagation()}>
                        <button type="button" className="menu-item" onClick={() => { closeMenu(); setListOpen(true); }}>
                            <MenuIcon name="calendar" />
                            <span>Rezervasyonlar</span>
                        </button>
                        <button type="button" className="menu-item" onClick={() => navigate('/waiter-pending')}>
                            <MenuIcon name="clock" />
                            <span>Bekleyen siparişler</span>
                        </button>
                        <button type="button" className="menu-item" onClick={() => navigate('/waiter-history')}>
                            <MenuIcon name="history" />
                            <span>Geçmiş</span>
                        </button>
                        <button type="button" className="menu-item menu-logout" onClick={handleLogout}>
                            <MenuIcon name="logout" />
                            <span>Çıkış</span>
                        </button>
                    </div>
                </div>
            )}
            {listOpen && (
                <div className="reserve-modal" onClick={() => setListOpen(false)}>
                    <div className="reserve-card reserve-sheet" onClick={(event) => event.stopPropagation()}>
                        <div className="reserve-head">
                            <div>
                                <h3>Rezervasyonlar</h3>
                                <p>{reservations.length} kayıt</p>
                            </div>
                            <button type="button" className="reserve-close" onClick={() => setListOpen(false)}>Kapat</button>
                        </div>
                        {reservations.length === 0 && <p className="reserve-empty">Bu günde rezervasyon yok.</p>}
                        {reservations.map(row => (
                            <article className="reserve-ticket" key={row.id}>
                                <div className="reserve-ticket-main">
                                    <strong>{clock(row.starts_at)}</strong>
                                    <span className="reserve-guest">{row.guest_name}</span>
                                    <span className="reserve-meta">
                                        {row.table_name} · {row.party_size} kişi{row.phone ? ` · ${row.phone}` : ''}
                                    </span>
                                    {row.note && <span className="reserve-note">{row.note}</span>}
                                </div>
                                <span className={`reserve-status ${statusClass(row.status)}`}>{row.status}</span>
                                {row.status === 'Bekliyor' && (
                                    <div className="reserve-actions">
                                        <button type="button" className="reserve-arrive" onClick={() => mark(row, 'Geldi')}>Geldi</button>
                                        <button type="button" className="reserve-miss" onClick={() => mark(row, 'Gelmedi')}>Gelmedi</button>
                                    </div>
                                )}
                            </article>
                        ))}
                    </div>
                </div>
            )}
            {tableWarn && (
                <div className="table-warn" onClick={() => setTableWarn(null)}>
                    <div className="table-warn-card" onClick={(event) => event.stopPropagation()}>
                        <h3>{tableWarn.reservation.guest_name}</h3>
                        <p>{clock(tableWarn.reservation.starts_at)} · {tableWarn.reservation.party_size} kişi · {tableWarn.table.name}</p>
                        <p className="table-warn-ask">Masa yine de açılsın mı?</p>
                        <div className="table-warn-actions">
                            <button type="button" className="warn-ghost" onClick={() => setTableWarn(null)}>Vazgeç</button>
                            <button type="button" className="warn-open" onClick={() => { const id = tableWarn.table.id; setTableWarn(null); navigate(`/waiter-order/${id}`); }}>Aç</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WaiterDashboard;