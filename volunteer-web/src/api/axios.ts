import axios from 'axios';

// Itt mondjuk meg, hol lakik a Java Backend
const api = axios.create({
    baseURL: 'http://localhost:8081/api', // Megtartottuk a 8081-es portodat!
    headers: {
        'Content-Type': 'application/json',
    },
});

// 1. KÉRÉSEK ELKAPÁSA: Minden kéréshez automatikusan hozzácsapja a tokent
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// 2. VÁLASZOK ELKAPÁSA: Ha lejárt a token (401-es hiba érkezik), kidob a loginra
api.interceptors.response.use(
    (response) => response, // Ha minden jó, az adat megy tovább a komponensnek
    (error) => {
        // Ha a Java backendünk "Unauthorized" (401) hibát dobott a lejárt token miatt
        if (error.response && error.response.status === 401) {
            console.warn("A munkamenet lejárt. Kijelentkezés...");

            // Kitöröljük a lejárt szemetet a böngészőből
            localStorage.removeItem('token');
            localStorage.removeItem('user');

            // Visszairányítjuk a felhasználót a bejelentkezési oldalra
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error); // Továbbdobjuk a hibát, hogy a try-catch is érzékelje
    }
);

export default api;