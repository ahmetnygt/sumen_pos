import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import api from '../services/api';
import './LiveDashboard.css';

const socket = io('http://localhost:5000'); // Telsiz frekansımız

const LiveDashboard = () => {
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
    fetchLogs(); // Ekran açıldığında ilk veriyi çek

    // BÜYÜ BURADA: Backend'den "updateDashboard" sinyali geldiği salise veriyi tazele!
    socket.on('updateDashboard', () => {
      fetchLogs();
    });

    return () => {
      socket.off('updateDashboard');
    };
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
          <span className="radar-icon">⚡</span> CANLI İŞLEM AKIŞI
        </div>

        <ul className="logs-list">
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
                    {log.message}
                  </span>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
};

export default LiveDashboard;