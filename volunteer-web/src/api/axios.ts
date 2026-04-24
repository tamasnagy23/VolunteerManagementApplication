import axios from 'axios';

const api = axios.create({
    baseURL: 'http://192.168.0.176:8081/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token && config.headers && !config.url?.includes('/public')) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        const tenantId = localStorage.getItem('tenantId');

        // --- A VARÁZSLAT ITT VAN ---
        // Ezekhez a végpontokhoz SOHA nem küldünk Sziget ID-t, mert a Mesterből jönnek!
        // Így nézzen ki ez a sor az api/axios.ts fájlodban:
        const globalEndpoints = ['/public', '/users/me', '/applications/my', '/auth/', '/organizations'];
        const isGlobalEndpoint = globalEndpoints.some(ep => config.url?.includes(ep));

        if (tenantId && config.headers && !isGlobalEndpoint) {
            config.headers['X-Tenant-ID'] = tenantId;
        }

        return config;
    },
    (error) => Promise.reject(error)
);

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            console.warn("A munkamenet lejárt. Kijelentkezés...");
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('tenantId');
            localStorage.removeItem('activeOrgId');

            if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;