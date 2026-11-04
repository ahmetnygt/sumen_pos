import React, { useEffect, useRef } from 'react';
import { HashRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import { io } from 'socket.io-client';
import api from './services/api';
import { applyBrand, readBrand, refreshBrand } from './utils/brand';

// Sayfalarımızı içe aktarıyoruz (Bunları pos-electron'dan kopyalayıp pages klasörüne atacaksın)
import Login from './pages/Login';
import WaiterDashboard from './pages/WaiterDashboard';
import WaiterOrder from './pages/WaiterOrder';
import WaiterPending from './pages/WaiterPending';
import WaiterHistory from './pages/WaiterHistory';
import KitchenDashboard from './pages/KitchenDashboard';

function SocketBridge() {
  const location = useLocation();
  const socketRef = useRef(null);
  const tokenRef = useRef(null);

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }

    const token = localStorage.getItem('token');
    if (!token) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      tokenRef.current = null;
      return;
    }
    if (socketRef.current && tokenRef.current === token) return;

    socketRef.current?.disconnect();
    tokenRef.current = token;
    const backendUrl = api.defaults.baseURL.replace(/\/api\/?$/, '');
    const socket = io(backendUrl, { auth: { token } });
    socketRef.current = socket;

    socket.on('orderReadyToServe', (data) => {
      toast.success(
        <div>
          <strong style={{ fontSize: '16px' }}>{data.title}</strong><br />
          <span style={{ fontSize: '13px' }}>{data.message}</span>
        </div>,
        {
          duration: 6000,
          position: 'top-center',
          style: { background: '#111', color: '#fff', border: '1px solid var(--accent)' },
          iconTheme: { primary: 'var(--accent)', secondary: 'var(--accent-ink)' }
        }
      );

      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(data.title || 'Sipariş hazır', {
          body: data.message || data.itemName || '',
          icon: '/favicon.svg'
        });
      }
    });
  }, [location.pathname]);

  return null;
}

function App() {
  useEffect(() => {
    applyBrand(readBrand());
    refreshBrand(api).then(brand => {
      document.title = brand?.name ? `${brand.name} POS` : 'Sümen POS';
    });
  }, []);

  return (
    <>
      <Toaster />
      <Router>
        <SocketBridge />
        <Routes>
          {/* Garson önce Login ekranına düşer */}
          <Route path="/" element={<Login />} />

          {/* Başarılı girişte Masalar ekranına gider */}
          <Route path="/waiter-dashboard" element={<WaiterDashboard />} />
          <Route path="/waiter-pending" element={<WaiterPending />} />
          <Route path="/waiter-history" element={<WaiterHistory />} />

          {/* Masaya tıklayınca Sipariş ekranına gider */}
          <Route path="/waiter-order/:tableId" element={<WaiterOrder />} />

          <Route path="/kitchen-dashboard" element={<KitchenDashboard />} />
        </Routes>
      </Router>
    </>
  );
}

export default App