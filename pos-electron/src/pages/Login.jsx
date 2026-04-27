import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './Login.css';

const Login = () => {
  const [userPin, setUserPin] = useState('');
  const [passPin, setPassPin] = useState('');
  const [activeInput, setActiveInput] = useState('user'); // Hangi kutuya yazıyoruz?
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();

  // Numpad tuşlarına basıldığında çalışacak fonksiyon
  const handleNumpad = (num) => {
    setError('');
    if (activeInput === 'user' && userPin.length < 4) {
      setUserPin(prev => prev + num);
      if (userPin.length === 3) setActiveInput('pass'); // 4. haneyi girince otomatik şifreye geç
    } else if (activeInput === 'pass' && passPin.length < 4) {
      setPassPin(prev => prev + num);
    }
  };

  const handleClear = () => {
    if (activeInput === 'user') setUserPin('');
    else setPassPin('');
  };

  const handleBackspace = () => {
    if (activeInput === 'user') setUserPin(prev => prev.slice(0, -1));
    else setPassPin(prev => prev.slice(0, -1));
  };

  const handleLogin = async () => {
    if (userPin.length < 4 || passPin.length < 4) {
      setError('Lütfen PIN kodlarını eksiksiz girin.');
      return;
    }

    setLoading(true);
    try {
      // Backend'e bilet (Token) almak için istek atıyoruz
      const response = await api.post('/auth/login', {
        user_pin: userPin,
        pass_pin: passPin
      });

      // Gelen bileti cebimize (LocalStorage) koyuyoruz
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      
      // Kapı açıldı, Ana Ekrana yürü!
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Sunucuya bağlanılamadı.');
      setPassPin(''); // Hata varsa şifreyi temizle
      setActiveInput('pass');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <h1>SÜMEN <span>POS</span></h1>
          <p>Personel Girişi</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="input-group">
          <div 
            className={`pin-input ${activeInput === 'user' ? 'active' : ''}`}
            onClick={() => setActiveInput('user')}
          >
            <label>Kullanıcı PIN</label>
            <div className="pin-display">{userPin.padEnd(4, '•')}</div>
          </div>

          <div 
            className={`pin-input ${activeInput === 'pass' ? 'active' : ''}`}
            onClick={() => setActiveInput('pass')}
          >
            <label>Şifre PIN</label>
            <div className="pin-display">{passPin.replace(/./g, '*').padEnd(4, '•')}</div>
          </div>
        </div>

        <div className="numpad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button key={num} onClick={() => handleNumpad(num.toString())}>
              {num}
            </button>
          ))}
          <button className="action-btn" onClick={handleClear}>C</button>
          <button onClick={() => handleNumpad('0')}>0</button>
          <button className="action-btn" onClick={handleBackspace}>⌫</button>
        </div>

        <button 
          className="login-btn" 
          onClick={handleLogin} 
          disabled={loading}
        >
          {loading ? 'GİRİŞ YAPILIYOR...' : 'GİRİŞ YAP'}
        </button>
      </div>
    </div>
  );
};

export default Login;