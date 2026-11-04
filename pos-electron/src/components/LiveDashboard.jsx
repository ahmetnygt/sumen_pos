import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import api from '../services/api';
import './LiveDashboard.css';

const LiveDashboard = ({ view = 'flow', onView, children }) => {
  const [time, setTime] = useState(new Date());
  const [logs, setLogs] = useState([]);

  // Dijital Saat Motoru
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Backend'den logları çekme fonksiyonu
  const fetchLogs = async () => {
    try {
      const res = await api.get('/orders/summary/live');
      setLogs(res.data.logs);
    } catch (err) {
      console.error('Loglar çekilemedi:', err);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    const socket = io(api.defaults.baseURL.replace(/\/api\/?$/, ''), { auth: { token } });
    fetchLogs();
    socket.on('updateDashboard', fetchLogs);
    return () => socket.disconnect();
  }, []);

  const getLogStyle = (status) => {
    switch (status) {
      case 'Siparişte': return 'log-pending';
      case 'Ödendi': return 'log-paid';
      case 'İptal': return 'log-danger';
      case 'Kapatıldı': return 'log-closed';
      case 'İskonto': return 'log-discount';
      default: return '';
    }
  };

  return (
    <div className="live-radar-container">
      <div className="clock-section">
        <div className="time-display">
          {time.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
        <div className="date-display">
          {time.toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      <div className="logs-container">
        <div className="logs-header">
          <button type="button" className={view === 'flow' ? 'active' : ''} onClick={() => onView?.('flow')}>
            İŞLEMLER
          </button>
          <button type="button" className={view === 'reservations' ? 'active' : ''} onClick={() => onView?.('reservations')}>
            REZERVASYONLAR
          </button>
        </div>

        <div className={view === 'reservations' ? 'side-pane' : 'side-pane hidden'}>{children}</div>
        {view === 'flow' && <ul className="logs-list">
          {logs.length === 0 ? (
            <li className="empty-log">Henüz hareket yok...</li>
          ) : (
            logs.map(log => (
              <li key={log.id} className="log-item">
                <span className="log-time">
                  {new Date(log.time).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <div className="log-content">
                  <div className="log-header-row">
                    <strong className="log-table">{log.table}</strong>
                    <span className="log-personnel">- {log.personnel}</span>
                  </div>
                  <span className={`log-message ${getLogStyle(log.status)}`}>
                    {String(log.message || '').replace(/\p{Extended_Pictographic}/gu, '').replace(/\s{2,}/g, ' ').trim()}
                  </span>
                </div>
              </li>
            ))
          )}
        </ul>}
      </div>
    </div>
  );
};

export default LiveDashboard;