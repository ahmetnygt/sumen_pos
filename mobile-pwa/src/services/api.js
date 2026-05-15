import axios from 'axios';

// KENDİ BİLGİSAYARININ (KASANIN) YEREL IP ADRESİNİ BURAYA YAZ
const API_URL = 'http://10.52.19.168:5000/api';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;