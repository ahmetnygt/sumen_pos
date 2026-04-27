import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Order from './pages/Order';
import AdminPanel from './pages/AdminPanel';
import StockMenu from './pages/StockMenu'; // BÜYÜ BURADA 1: Dosyayı içeri al

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/order/:tableId" element={<Order />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/stock-menu" element={<StockMenu />} /> {/* BÜYÜ BURADA 2: Rotayı tanımla */}
      </Routes>
    </Router>
  );
}

export default App;