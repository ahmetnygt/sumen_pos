import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import api from './services/api';
import { applyBrand, readBrand, refreshBrand } from './utils/brand';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Order from './pages/Order';
import AdminPanel from './pages/AdminPanel';
import StockMenu from './pages/StockMenu';
import Personnel from './pages/Personnel';
import Reports from './pages/Reports';
import SuperAdmin from './pages/SuperAdmin';
import Branches from './pages/Branches';
import Shift from './pages/Shift';

function CashierGate() {
  useEffect(() => {
    applyBrand(readBrand());
    let gone = false;
    refreshBrand(api).then(brand => {
      if (gone) return;
      const onSystem = window.location.hash.includes('/super-admin');
      if (onSystem) applyBrand(null);
      document.title = !onSystem && brand?.name ? `${brand.name} POS` : 'Sümen POS';
    });
    return () => { gone = true; };
  }, []);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname === '/super-admin') {
      applyBrand(null);
      document.title = 'Sümen POS';
    } else {
      const brand = readBrand();
      applyBrand(brand);
      document.title = brand?.name ? `${brand.name} POS` : 'Sümen POS';
    }
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname === '/') return;
    let user = null;
    try { user = JSON.parse(localStorage.getItem('user') || 'null'); } catch (error) { user = null; }
    const role = user?.role;
    if (role === 'SuperAdmin') {
      if (location.pathname !== '/super-admin') navigate('/super-admin');
      return;
    }
    if (role !== 'Admin' && role !== 'Kasa') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/');
    }
  }, [location.pathname, navigate]);

  return (
      <Routes>
        <Route path="/" element={<Login />} />

        {/* KASA VE ADMİN ROTALARI */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/order/:tableId" element={<Order />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/stock-menu" element={<StockMenu />} />
        <Route path="/personnel" element={<Personnel />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/super-admin" element={<SuperAdmin />} />
        <Route path="/branches" element={<Branches />} />
        <Route path="/shift" element={<Shift />} />
      </Routes>
  );
}

function App() {
  return (
    <Router>
      <CashierGate />
    </Router>
  );
}

export default App;