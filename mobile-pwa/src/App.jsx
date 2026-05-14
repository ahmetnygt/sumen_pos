import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import { useEffect } from 'react';
import { io } from 'socket.io-client';
import api from './services/api';

// Sayfalarımızı içe aktarıyoruz (Bunları pos-electron'dan kopyalayıp pages klasörüne atacaksın)
import Login from './pages/Login';
import WaiterDashboard from './pages/WaiterDashboard';
import WaiterOrder from './pages/WaiterOrder';
import KitchenDashboard from './pages/KitchenDashboard';

function App() {
  // GARSON BİLDİRİM RADARI VE İZİN MOTORU
  useEffect(() => {
    // 1. Uygulama açılır açılmaz garsondan sistem bildirimi izni iste
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }

    const backendUrl = api.defaults.baseURL.replace('/api', '');
    const socket = io(backendUrl);

    socket.on('orderReadyToServe', (data) => {
      // 2. HEM UYGULAMA İÇİ ŞIK BİLDİRİM (Toast) GÖSTER
      toast.success(
        <div>
          <strong style={{ fontSize: '16px' }}>{data.title}</strong><br />
          <span style={{ fontSize: '13px' }}>{data.message}</span>
        </div>,
        {
          duration: 6000,
          position: 'top-center',
          style: { background: '#111', color: '#fff', border: '1px solid #d4af37' },
          iconTheme: { primary: '#d4af37', secondary: '#000' }
        }
      );

      // 3. EĞER TABLET CEPTEYSE SİSTEM BİLDİRİMİ AT (Kendi sesiyle öter ve titrer)
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(data.title, {
          body: data.message,
          icon: '/favicon.svg', // Kilit ekranında senin logon görünür
          vibrate: [200, 100, 200, 100, 200] // Telefonu dırrr-dırrr-dırrr diye titretir
        });
      }
    });

    return () => socket.disconnect();
  }, []);

  return (
    <>
      <Toaster /> {/* Bildirimlerin ekrana basılacağı yer */}
      <Router>
        <Routes>
          {/* Garson önce Login ekranına düşer */}
          <Route path="/" element={<Login />} />

          {/* Başarılı girişte Masalar ekranına gider */}
          <Route path="/waiter-dashboard" element={<WaiterDashboard />} />

          {/* Masaya tıklayınca Sipariş ekranına gider */}
          <Route path="/waiter-order/:tableId" element={<WaiterOrder />} />

          <Route path="/kitchen" element={<KitchenDashboard />} />
        </Routes>
      </Router>
    </>
  );
}

export default App