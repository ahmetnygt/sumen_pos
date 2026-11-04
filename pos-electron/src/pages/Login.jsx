import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import BrandMark from '../components/BrandMark';
import { applyBrand, clearBrand, readBrand, refreshBrand, writeBrand } from '../utils/brand';
import './Login.css';

const Login = () => {
  const [brand, setBrand] = useState(() => readBrand());
  const [companyCode, setCompanyCode] = useState('');
  const [userPin, setUserPin] = useState('');
  const [passPin, setPassPin] = useState('');
  const [activeInput, setActiveInput] = useState(() => (readBrand() ? 'user' : 'company'));
  const [systemMode, setSystemMode] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [branches, setBranches] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const staffMode = Boolean(brand) && !systemMode;

  useEffect(() => {
    let gone = false;
    refreshBrand(api).then(next => {
      if (gone) return;
      setBrand(next);
      setActiveInput(next ? 'user' : 'company');
    });
    return () => { gone = true; };
  }, []);

  const handleExitApp = () => {
    if (window.electronAPI && window.electronAPI.quitApp) {
      window.electronAPI.quitApp();
    }
  };

  const enterApp = (user) => {
    if (user.role === 'Garson' || user.role === 'Mutfak') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setError('Garson ve mutfak girişi telefon uygulamasından yapılır.');
      setPassPin('');
      setActiveInput('pass');
      return;
    }
    localStorage.setItem('user', JSON.stringify(user));
    if (user.role === 'SuperAdmin') {
      applyBrand(null);
      navigate('/super-admin');
    } else navigate('/dashboard');
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
    if (!staffMode && !systemMode) {
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
    if (!staffMode && !systemMode) setCompanyCode('');
    else if (activeInput === 'user') setUserPin('');
    else setPassPin('');
  };

  const handleBackspace = () => {
    if (!staffMode && !systemMode) setCompanyCode(prev => prev.slice(0, -1));
    else if (activeInput === 'user') setUserPin(prev => prev.slice(0, -1));
    else setPassPin(prev => prev.slice(0, -1));
  };

  const toggleSystemMode = () => {
    setSystemMode(prev => {
      const next = !prev;
      applyBrand(next ? null : readBrand());
      return next;
    });
    setError('');
    setCompanyCode('');
    setUserPin('');
    setPassPin('');
    setActiveInput('user');
  };

  const dropBrand = () => {
    clearBrand();
    setBrand(null);
    setConfirmLeave(false);
    setSystemMode(false);
    setCompanyCode('');
    setUserPin('');
    setPassPin('');
    setBranches(null);
    setActiveInput('company');
    setError('');
  };

  const handleLogin = async () => {
    if (userPin.length < 4 || passPin.length < 4) {
      setError('Lütfen PIN kodlarını eksiksiz girin.');
      return;
    }
    if (!systemMode && !brand?.code) {
      setError('Önce firma kodunu girin.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/login', {
        company_code: systemMode ? undefined : brand.code,
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

  const subtitle = branches
    ? 'Şube Seçimi'
    : systemMode
      ? 'Sistem Girişi'
      : staffMode
        ? 'Personel Girişi'
        : 'Firma Kodu';

  return (
    <div className="login-container">
      <button
        onClick={handleExitApp}
        style={{
          position: 'absolute', top: '20px', right: '20px', backgroundColor: '#ef4444', color: 'white',
          border: 'none', borderRadius: '50%', width: '40px', height: '40px', fontSize: '20px',
          fontWeight: 'bold', cursor: 'pointer'
        }}
        title="Uygulamayı Kapat"
      >
        ✕
      </button>
      <div className="login-box">
        <div className="login-header">
          {staffMode || (brand && branches) ? <BrandMark brand={brand} /> : <h1>SÜMEN <span>POS</span></h1>}
          <p>{subtitle}</p>
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
            <div className={`input-group ${staffMode || systemMode ? '' : 'stacked'}`}>
              {!staffMode && !systemMode && (
                <div className="pin-input active">
                  <label>Firma Kodu</label>
                  <div className="pin-display">{companyCode.padEnd(4, '•')}</div>
                </div>
              )}
              {(staffMode || systemMode) && (
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

            {(staffMode || systemMode) && (
              <button className="login-btn" onClick={handleLogin} disabled={loading}>
                {loading ? 'GİRİŞ YAPILIYOR...' : 'GİRİŞ YAP'}
              </button>
            )}
            {!staffMode && !systemMode && loading && <p className="login-wait">Firma aranıyor...</p>}

            {staffMode ? (
              confirmLeave ? (
                <div className="brand-leave">
                  <p>Bu cihazdaki firma kaydı silinsin mi?</p>
                  <button type="button" onClick={() => setConfirmLeave(false)}>Vazgeç</button>
                  <button type="button" onClick={dropBrand}>Kodu sil</button>
                </div>
              ) : (
                <button className="system-toggle" type="button" onClick={() => setConfirmLeave(true)}>Firma değiştir</button>
              )
            ) : (
              <button className="system-toggle" type="button" onClick={toggleSystemMode}>
                {systemMode ? 'Firma girişi' : 'Sistem girişi'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Login;
