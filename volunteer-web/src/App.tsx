import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import {Box, Button, CssBaseline, Typography} from '@mui/material';

// --- AZONNAL BETÖLTŐDŐ KOMPONENSEK ---
// Ezekre azonnal szükség van az alkalmazás indulásakor, így maradnak normál importok.
import ThemeContextProvider from './theme/ThemeContextProvider';
import LoadingScreen from './components/LoadingScreen';

// --- LUSTA BETÖLTÉS (LAZY LOADING) ---
// Ezek a fájlok csak akkor töltődnek le a felhasználó gépére, amikor rájuk kattint!
const Login = lazy(() => import('./components/Login'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const CreateEvent = lazy(() => import('./components/CreateEvent'));
const Register = lazy(() => import('./components/Register'));
const EventDetails = lazy(() => import('./components/EventDetails.tsx'));
const MyShifts = lazy(() => import('./components/MyShifts.tsx'));
const MyTeam = lazy(() => import('./components/MyTeam.tsx'));
const ManageApplications = lazy(() => import('./components/ManageApplications.tsx'));
const Layout = lazy(() => import('./components/Layout'));
const Profile = lazy(() => import('./components/Profile.tsx'));
const SystemLogs = lazy(() => import('./components/SystemLogs.tsx'));
const ShiftManager = lazy(() => import('./components/ShiftManager.tsx'));
const EventTeamManager = lazy(() => import('./components/EventTeamManager.tsx'));
const PublicEventWall = lazy(() => import('./components/PublicEventWall.tsx'));
const MyApplications = lazy(() => import('./components/MyApplications'));
const Statistics = lazy(() => import('./components/Statistics.tsx'));
const OrganizationDetails = lazy(() => import('./components/OrganizationDetails.tsx'));

function App() {
    // Globális inicializációs állapot
    const [isInitializing, setIsInitializing] = useState(true);

    useEffect(() => {
        // Alkalmazás kezdeti betöltése és hitelesítés ellenőrzése
        const initApp = async () => {
            try {
                // JÖVŐBELI FEJLESZTÉS HELYE:
                // Ha van érvényes token a localStorage-ben, itt érdemes egy '/users/me'
                // hívással ellenőrizni, hogy a token nem járt-e le.
                // const token = localStorage.getItem('token');
                // if (token) await api.get('/users/me');

            } catch {
                console.warn("A munkamenet lejárt, vagy hiba történt az inicializáláskor.");
                // localStorage.clear();
            } finally {
                // Hagyunk időt a prémium betöltő animációnak (1.2 másodperc)
                setTimeout(() => {
                    setIsInitializing(false);
                }, 1200);
            }
        };

        initApp();
    }, []);

    return (
        <ThemeContextProvider>
            <CssBaseline />
            {/* 1. FÁZIS: Az app elindulásakor mutatjuk a LoadingScreent */}
            {isInitializing ? (
                <Box sx={{ display: 'flex', flexGrow: 1, height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
                    <LoadingScreen />
                </Box>
            ) : (
                /* 2. FÁZIS: Ha betöltött az alap, indul az útválasztás. */
                /* A Suspense gondoskodik róla, hogy amíg egy új, lusta oldal letöltődik (pl. átmész a profilra), a LoadingScreent mutassa! */
                <Suspense
                    fallback={
                        <Box sx={{ display: 'flex', flexGrow: 1, height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
                            <LoadingScreen />
                        </Box>
                    }
                >
                    <Routes>
                        <Route path="/" element={<PublicEventWall />} />
                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Register />} />

                        <Route element={<Layout />}>
                            <Route path="/dashboard" element={<Dashboard />} />
                            <Route path="/my-applications" element={<MyApplications />} />
                            <Route path="/create-event" element={<CreateEvent />} />
                            <Route path="/edit-event/:id" element={<CreateEvent />} />
                            <Route path="/events/:id" element={<EventDetails />} />
                            <Route path="/my-shifts" element={<MyShifts />} />
                            <Route path="/team" element={<MyTeam />} />
                            <Route path="/events/:id/applications" element={<ManageApplications />} />
                            <Route path="/profile" element={<Profile />} />
                            <Route path="/logs" element={<SystemLogs />} />
                            <Route path="/events/:id/shifts" element={<ShiftManager />} />
                            <Route path="/events/:id/team" element={<EventTeamManager />} />
                            <Route path="/statistics" element={<Statistics />} />
                            <Route path="/organization/:id" element={<OrganizationDetails />} />
                        </Route>

                        <Route path="*" element={
                            <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1} height="100vh">
                                <Typography variant="h1" fontWeight="900" color="primary">404</Typography>
                                <Typography variant="h5" color="text.secondary" mb={4}>A keresett oldal nem található</Typography>
                                <Button variant="contained" size="large" onClick={() => window.location.href = '/dashboard'} sx={{ borderRadius: 3, px: 4, fontWeight: 'bold' }}>
                                    Vissza a főoldalra
                                </Button>
                            </Box>
                        } />
                    </Routes>
                </Suspense>
            )}
        </ThemeContextProvider>
    );
}

export default App;