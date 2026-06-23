import axios from 'axios';

const api = axios.create({
    // Varsa .env'den oku, yoksa çökmemesi için localhost'a bağlan
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
    // baseURL: "http://161.35.216.9:5000/api"
});

// Interceptor kodların aynen kalacak...
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

export default api;