import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { io } from 'socket.io-client';
import BrandMark from '../components/BrandMark';
import { readBrand } from '../utils/brand';
import './KitchenDashboard.css';

const FRESH_MS = 30 * 1000;
const WARN_MS = 10 * 60 * 1000;
const LATE_MS = 20 * 60 * 1000;

let audioCtx = null;
let pendingBeep = false;

function unlockAudio() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!audioCtx) audioCtx = new AudioCtx();
    const start = () => {
        if (pendingBeep) {
            pendingBeep = false;
            playBeep();
        }
    };
    if (audioCtx.state === 'suspended') audioCtx.resume().then(start);
    else start();
}

function playBeep() {
    if (!audioCtx || audioCtx.state !== 'running') return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(740, now);
    osc.frequency.setValueAtTime(988, now + 0.09);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.07, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.24);
}

function playTicketSound() {
    if (!audioCtx || audioCtx.state !== 'running') {
        pendingBeep = true;
        return;
    }
    pendingBeep = false;
    playBeep();
}

function parseOptions(value) {
    let current = value;
    for (let i = 0; i < 2 && typeof current === 'string'; i += 1) {
        try { current = JSON.parse(current); } catch (error) { return []; }
    }
    if (!Array.isArray(current)) return [];
    return current.map(opt => opt && opt.name).filter(Boolean);
}

function groupKeyOf(item) {
    const order = item.Order || {};
    if (order.is_fast_sale) return `fast-${order.id}`;
    return String(order.table_id);
}

function placeOf(item) {
    const order = item.Order || {};
    if (order.is_fast_sale) return 'Hızlı satış';
    return order.Table?.name || 'Masa';
}

function historyPlace(row) {
    const order = row.Order || {};
    if (order.is_fast_sale || !order.Table?.name) return 'Hızlı satış';
    return order.Table.name;
}

function personName(user) {
    if (!user) return 'Personel';
    return [user.name, user.surname].filter(Boolean).join(' ') || 'Personel';
}

function clockOf(iso) {
    const stamp = new Date(iso);
    if (Number.isNaN(stamp.getTime())) return '';
    return stamp.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

const KitchenDashboard = () => {
    const [orders, setOrders] = useState([]);
    const [cancelled, setCancelled] = useState([]);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showHistory, setShowHistory] = useState(false);
    const [recipe, setRecipe] = useState(null);
    const [notice, setNotice] = useState('');
    const [now, setNow] = useState(() => Date.now());
    const seenKeys = useRef(null);
    const noticeTimer = useRef(null);

    const fetchData = async () => {
        try {
            const [ordersRes, historyRes] = await Promise.all([
                api.get('/orders/kitchen'),
                api.get('/orders/kitchen/history')
            ]);
            const payload = ordersRes.data || {};
            const items = Array.isArray(payload) ? payload : (payload.items || []);
            const notices = Array.isArray(payload) ? [] : (payload.cancelled || []);
            const keys = new Set(items.map(groupKeyOf));
            if (seenKeys.current === null) seenKeys.current = keys;
            else {
                let freshTicket = false;
                keys.forEach(key => {
                    if (!seenKeys.current.has(key)) freshTicket = true;
                });
                seenKeys.current = keys;
                if (freshTicket) playTicketSound();
            }
            setOrders(items);
            setCancelled(notices);
            setHistory(historyRes.data || []);
        } catch (error) {
            console.error('Veri çekilemedi');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const backendUrl = api.defaults.baseURL.replace('/api', '');
        const socket = io(backendUrl, { auth: { token: localStorage.getItem('token') } });
        socket.on('updateKitchen', fetchData);
        return () => socket.disconnect();
    }, []);

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => () => clearTimeout(noticeTimer.current), []);

    const openItem = (item) => {
        const text = item.Product?.instructions;
        if (text && String(text).trim()) {
            setRecipe(item);
            return;
        }
        setNotice('Bu üründe tarif yok.');
        clearTimeout(noticeTimer.current);
        noticeTimer.current = setTimeout(() => setNotice(''), 2200);
    };

    const handleMarkReady = async (item) => {
        try {
            await api.post(`/orders/kitchen/${item.id}/ready`, { itemName: item.Product?.name });
            fetchData();
        } catch (error) {
            toast.error('Satır hazır işaretlenemedi.');
        }
    };

    const handleMarkAllReady = async (items) => {
        try {
            await api.post('/orders/kitchen/bulk-ready', { itemIds: items.map(item => item.id) });
            fetchData();
        } catch (error) {
            toast.error('Fiş hazır işaretlenemedi.');
        }
    };

    const handleRecall = async (itemId) => {
        try {
            await api.post(`/orders/kitchen/${itemId}/recall`);
            fetchData();
        } catch (error) {
            toast.error('Satır geri alınamadı.');
        }
    };

    const tickets = [];
    const ticketIndex = new Map();
    const ensureTicket = (key, seed) => {
        if (!ticketIndex.has(key)) {
            const ticket = {
                key,
                place: seed.place,
                time: seed.time,
                waiter: seed.waiter || '',
                items: [],
                ghosts: []
            };
            ticketIndex.set(key, ticket);
            tickets.push(ticket);
        }
        return ticketIndex.get(key);
    };

    orders.forEach(item => {
        const ticket = ensureTicket(groupKeyOf(item), {
            place: placeOf(item),
            time: item.created_at || item.createdAt,
            waiter: item.User?.name || 'Kasa'
        });
        ticket.items.push(item);
    });

    const clock = Math.max(now, Date.now());

    cancelled.forEach(ghost => {
        if (!(Number(ghost.until) > clock)) return;
        ensureTicket(String(ghost.groupKey), {
            place: ghost.place || 'Masa',
            time: ghost.created_at,
            waiter: ''
        }).ghosts.push(ghost);
    });

    const cook = JSON.parse(localStorage.getItem('user') || '{}');
    const cookName = [cook.name, cook.surname].filter(Boolean).join(' ');

    const timeLabel = (iso) => {
        const label = clockOf(iso);
        const stamp = new Date(iso).getTime();
        if (!label || !Number.isFinite(stamp)) return '';
        const mins = Math.floor((clock - stamp) / 60000);
        return mins > 0 ? `${label} · ${mins} dk` : label;
    };

    const ticketTone = (ticket) => {
        if (!ticket.items.length || !ticket.time) return '';
        const age = clock - new Date(ticket.time).getTime();
        if (!Number.isFinite(age)) return '';
        if (age < FRESH_MS) return 'ticket-glow';
        if (age >= LATE_MS) return 'ticket-late';
        if (age >= WARN_MS) return 'ticket-warn';
        return '';
    };

    const lineFresh = (item) => {
        const age = clock - new Date(item.created_at || item.createdAt).getTime();
        return Number.isFinite(age) && age < FRESH_MS;
    };

    if (loading) return <div className="kds-loading">Mutfak hazırlanıyor</div>;

    return (
        <div className="kds-container" onPointerDown={unlockAudio}>
            <div className="kds-main">
                <header className="kds-header">
                    <div className="kds-header-row">
                        <div className="kds-header-left">
                            <BrandMark brand={readBrand()} />
                            <div>
                                <h1>Mutfak</h1>
                                {cookName ? <span className="kds-cook">{cookName}</span> : null}
                            </div>
                        </div>
                        <button type="button" className="history-trigger" aria-label="Geçmiş" onClick={() => setShowHistory(true)}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M4 12a8 8 0 1 0 2.2-5.5" />
                                <path d="M4 4v4h4M12 8v5l3 2" />
                            </svg>
                        </button>
                    </div>
                </header>

                <div className="kds-grid">
                    {tickets.map(ticket => (
                        <article key={ticket.key} className={`ticket-card ${ticketTone(ticket)}`.trim()}>
                            <div className="ticket-header">
                                <div className="ticket-heading">
                                    <span className="t-name">{ticket.place}</span>
                                    <span className="t-time">{timeLabel(ticket.time)}</span>
                                </div>
                                {ticket.waiter ? <div className="t-waiter">Garson · {ticket.waiter}</div> : null}
                            </div>
                            <div className="ticket-body">
                                {ticket.items.map(item => {
                                    const options = parseOptions(item.selected_options);
                                    return (
                                        <div
                                            key={item.id}
                                            className={`ticket-item-row${lineFresh(item) ? ' line-glow' : ''}`}
                                            onClick={() => openItem(item)}
                                        >
                                            <div className="item-details">
                                                <div className="item-title">
                                                    <span className="qty">{item.quantity}x</span>
                                                    {item.Product?.name}
                                                </div>
                                                {options.length > 0 && (
                                                    <div className="item-options">
                                                        {options.map((name, index) => <span key={`${item.id}-${index}`}>+{name} </span>)}
                                                    </div>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                className="check-btn"
                                                onClick={(event) => { event.stopPropagation(); handleMarkReady(item); }}
                                                aria-label="Hazır"
                                            >
                                                ✓
                                            </button>
                                        </div>
                                    );
                                })}
                                {ticket.ghosts.map(ghost => (
                                    <div key={`cancel-${ghost.id}`} className="ticket-item-row cancelled">
                                        <div className="item-details">
                                            <div className="item-title">
                                                <span className="qty">{ghost.quantity}x</span>
                                                {ghost.name}
                                            </div>
                                            {Array.isArray(ghost.options) && ghost.options.length > 0 && (
                                                <div className="item-options">
                                                    {ghost.options.map((name, index) => <span key={`${ghost.id}-${index}`}>+{name} </span>)}
                                                </div>
                                            )}
                                            <div className="cancel-tag">İptal</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {ticket.items.length > 0 && (
                                <div className="ticket-footer">
                                    <button type="button" className="send-all-btn" onClick={() => handleMarkAllReady(ticket.items)}>
                                        Tümünü hazırla
                                    </button>
                                </div>
                            )}
                        </article>
                    ))}
                    {tickets.length === 0 && <div className="kds-empty">Bekleyen sipariş yok</div>}
                </div>
            </div>

            <aside className={`kds-sidebar${showHistory ? ' mobile-open' : ''}`}>
                <div className="sidebar-header">
                    <h3>Son tamamlananlar</h3>
                    <button type="button" className="history-close" onClick={() => setShowHistory(false)}>Kapat</button>
                </div>
                <div className="history-scroll">
                    {history.length === 0 && <div className="history-empty">Tamamlanan sipariş yok</div>}
                    {history.map(row => (
                        <article key={row.id} className="history-item">
                            <span className="h-product">{row.quantity}x {row.Product?.name}</span>
                            <span className="h-table">{historyPlace(row)}</span>
                            <div className="history-meta">
                                <span>{clockOf(row.updated_at || row.updatedAt)}</span>
                                <span>{personName(row.User)}</span>
                            </div>
                            <button type="button" className="recall-btn" onClick={() => handleRecall(row.id)}>Geri al</button>
                        </article>
                    ))}
                </div>
            </aside>

            {notice && <div className="kds-notice">{notice}</div>}

            {recipe && (
                <div className="recipe-modal-overlay" onClick={() => setRecipe(null)}>
                    <div className="recipe-modal" onClick={event => event.stopPropagation()}>
                        <h2>{recipe.Product?.name}</h2>
                        <div className="recipe-text">{recipe.Product?.instructions}</div>
                        <button type="button" className="modal-close-btn" onClick={() => setRecipe(null)}>Anladım</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default KitchenDashboard;
