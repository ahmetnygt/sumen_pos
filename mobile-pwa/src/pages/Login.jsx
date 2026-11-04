import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import BrandMark from '../components/BrandMark';
import { clearBrand, readBrand, refreshBrand, writeBrand } from '../utils/brand';
import './Login.css';

const Login = () => {
  const [brand, setBrand] = useState(() => readBrand());
  const [companyCode, setCompanyCode] = useState('');
  const [userPin, setUserPin] = useState('');
  const [passPin, setPassPin] = useState('');
  const [activeInput, setActiveInput] = useState(() => (readBrand() ? 'user' : 'company'));
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [branches, setBranches] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const staffMode = Boolean(brand);

  useEffect(() => {
    let gone = false;
    refreshBrand(api).then(next => {
      if (gone) return;
      setBrand(next);
      setActiveInput(next ? 'user' : 'company');
    });
    return () => { gone = true; };
  }, []);

  const enterApp = (user) => {
    localStorage.setItem('user', JSON.stringify(user));
    if (user.role === 'Mutfak') navigate('/kitchen-dashboard');
    else if (user.role === 'Garson') navigate('/waiter-dashboard');
    else if (user.role === 'SuperAdmin') setError('Sistem yönetimi kasa uygulamasından yapılır.');
    else navigate('/waiter-dashboard');
  };

  const lookupCompany = async (code) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get(`/brand/${code}`);
      const saved = writeBrand(response.data);
      setBrand(saved);
      setUserPin('');
      setPassPin('');
      setActiveInput('user');
      setCompanyCode('');
    } catch (err) {
      setCompanyCode('');
      setError(err.response?.data?.message || 'Sunucuya bağlanılamadı.');
    } finally {
      setLoading(false);
    }
  };

  const handleNumpad = (num) => {
    setError('');
    if (!staffMode) {
      if (companyCode.length >= 4 || loading) return;
      const next = companyCode + num;
      setCompanyCode(next);
      if (next.length === 4) lookupCompany(next);
      return;
    }
    if (activeInput === 'user' && userPin.length < 4) {
      setUserPin(prev => prev + num);
      if (userPin.length === 3) setActiveInput('pass');
    } else if (activeInput === 'pass' && passPin.length < 4) {
      setPassPin(prev => prev + num);
    }
  };

  const handleClear = () => {
    if (!staffMode) setCompanyCode('');
    else if (activeInput === 'user') setUserPin('');
    else setPassPin('');
  };

  const handleBackspace = () => {
    if (!staffMode) setCompanyCode(prev => prev.slice(0, -1));
    else if (activeInput === 'user') setUserPin(prev => prev.slice(0, -1));
    else setPassPin(prev => prev.slice(0, -1));
  };

  const dropBrand = () => {
    clearBrand();
    setBrand(null);
    setConfirmLeave(false);
    setCompanyCode('');
    setUserPin('');
    setPassPin('');
    setBranches(null);
    setActiveInput('company');
    setError('');
  };

  const handleLogin = async () => {
    if (!brand?.code || userPin.length < 4 || passPin.length < 4) {
      setError('Lütfen PIN kodlarını eksiksiz girin.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/login', {
        company_code: brand.code,
        user_pin: userPin,
        pass_pin: passPin
      });

      localStorage.setItem('token', response.data.token);
      if (response.data.needsBranchSelect) {
        setBranches(response.data.branches);
        setSelectedBranch(String(response.data.branches[0].id));
        return;
      }
      enterApp(response.data.user);
    } catch (err) {
      setError(err.response?.data?.message || 'Sunucuya bağlanılamadı.');
      setPassPin('');
      setActiveInput('pass');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBranch = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/auth/select-branch', { branch_id: selectedBranch });
      localStorage.setItem('token', response.data.token);
      enterApp(response.data.user);
    } catch (err) {
      setError(err.response?.data?.message || 'Şube seçilemedi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          {brand ? <BrandMark brand={brand} /> : <h1>SÜMEN <span>POS</span></h1>}
          <p>{branches ? 'Şube Seçimi' : staffMode ? 'Personel Girişi' : 'Firma Kodu'}</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        {branches ? (
          <>
            <select className="branch-select" value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}>
              {branches.map(branch => (
                <option key={branch.id} value={branch.id}>{branch.name} ({branch.code})</option>
              ))}
            </select>
            <button className="login-btn" onClick={handleSelectBranch} disabled={loading}>
              {loading ? 'GİRİŞ YAPILIYOR...' : 'ŞUBEYE GİR'}
            </button>
          </>
        ) : (
          <>
            <div className="input-group stacked">
              {!staffMode && (
                <div className="pin-input active">
                  <label>Firma Kodu</label>
                  <div className="pin-display">{companyCode.padEnd(4, '•')}</div>
                </div>
              )}
              {staffMode && (
                <>
                  <div className={`pin-input ${activeInput === 'user' ? 'active' : ''}`} onClick={() => setActiveInput('user')}>
                    <label>Kullanıcı PIN</label>
                    <div className="pin-display">{userPin.padEnd(4, '•')}</div>
                  </div>
                  <div className={`pin-input ${activeInput === 'pass' ? 'active' : ''}`} onClick={() => setActiveInput('pass')}>
                    <label>Şifre PIN</label>
                    <div className="pin-display">{passPin.replace(/./g, '*').padEnd(4, '•')}</div>
                  </div>
                </>
              )}
            </div>

            <div className="numpad">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button key={num} onClick={() => handleNumpad(num.toString())}>{num}</button>
              ))}
              <button className="action-btn" onClick={handleClear}>C</button>
              <button onClick={() => handleNumpad('0')}>0</button>
              <button className="action-btn" onClick={handleBackspace}>⌫</button>
            </div>

            {staffMode && (
              <button className="login-btn" onClick={handleLogin} disabled={loading}>
                {loading ? 'GİRİŞ YAPILIYOR...' : 'GİRİŞ YAP'}
              </button>
            )}
            {!staffMode && loading && <p className="login-wait">Firma aranıyor...</p>}

            {staffMode && (
              confirmLeave ? (
                <div className="brand-leave">
                  <p>Bu cihazdaki firma kaydı silinsin mi?</p>
                  <button type="button" onClick={() => setConfirmLeave(false)}>Vazgeç</button>
                  <button type="button" onClick={dropBrand}>Kodu sil</button>
                </div>
              ) : (
                <button className="system-toggle" type="button" onClick={() => setConfirmLeave(true)}>Firma değiştir</button>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Login;
