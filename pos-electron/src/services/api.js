import axios from 'axios';

const api = axios.create({
    // Varsa .env'den oku, yoksa çökmemesi için localhost'a bağlan
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5500/api'
    // baseURL: "http://161.35.216.9:5000/api"
});

// Interceptor kodların aynen kalacak...
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        const url = error.config?.url || '';
        if (error.response?.status === 401 && !url.includes('/auth/login')) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            if (window.location.hash !== '#/' && window.location.hash !== '#' && window.location.hash !== '') {
                window.location.hash = '#/';
            }
        }
        return Promise.reject(error);
    }
);

export default api;