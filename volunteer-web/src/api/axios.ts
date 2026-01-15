import axios from 'axios';

// Itt mondjuk meg, hol lakik a Java Backend
// FONTOS: Ha a backend nálad a 8080-on fut, írd át a számot!
// De legutóbb a 8081-re állítottuk át.
const api = axios.create({
    baseURL: 'http://localhost:8081/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Ez egy kis "varázslat": Minden kéréshez automatikusan hozzácsapja a tokent, ha be vagyunk lépve
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;