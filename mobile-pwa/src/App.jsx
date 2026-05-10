import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Sayfalarımızı içe aktarıyoruz (Bunları pos-electron'dan kopyalayıp pages klasörüne atacaksın)
import Login from './pages/Login';
import WaiterDashboard from './pages/WaiterDashboard';
import WaiterOrder from './pages/WaiterOrder';
import KitchenDashboard from './pages/KitchenDashboard';

function App() {
  return (
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
  );
}

export default App;