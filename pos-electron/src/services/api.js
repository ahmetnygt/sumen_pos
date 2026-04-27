import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:5000/api', // Az önce kurduğumuz Backend'in adresi
});

// Badigard: Her istekte otomatik olarak LocalStorage'daki Token'ı kapıya gösterir
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;