import { useState } from 'react';
import { Box, Button, TextField, Typography, Paper, Container, Alert } from '@mui/material';
import api from '../api/axios';
import { useNavigate } from 'react-router-dom';

export default function Login() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            // FONTOS: A backend endpoint neve '/authenticate' volt a Controllerben!
            const response = await api.post('/auth/authenticate', { email, password });

            // Itt vesszük ki a tokent ÉS a szerepkört (role)
            const { token, role } = response.data;

            console.log("Sikeres belépés:", role); // Debug: lássuk a konzolon ki lépett be

            // Elmentjük mindkettőt a böngészőbe
            localStorage.setItem('token', token);
            localStorage.setItem('role', role); // <--- EZ AZ ÚJ RÉSZ

            // Beállítjuk az Axiosnak a tokent a további kérésekhez
            api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

            navigate('/dashboard');

            // Egy apró trükk: frissítjük az oldalt, hogy az App.tsx és a menü
            // biztosan érzékelje az új jogosultságokat.
            window.location.reload();

        } catch (err: any) {
            console.error(err);
            setError('Hibás email vagy jelszó!');
        }
    };

    return (
        <Container component="main" maxWidth="xs">
            <Box
                sx={{
                    marginTop: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                }}
            >
                <Paper elevation={3} sx={{ padding: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                    <Typography component="h1" variant="h5">
                        Bejelentkezés
                    </Typography>

                    {/* Hibaüzenet szebben megjelenítve */}
                    {error && <Alert severity="error" sx={{ mt: 2, width: '100%' }}>{error}</Alert>}

                    <Box component="form" onSubmit={handleLogin} sx={{ mt: 1, width: '100%' }}>
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            label="Email cím"
                            autoFocus
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            label="Jelszó"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />

                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            sx={{ mt: 3, mb: 2 }}
                        >
                            Belépés
                        </Button>
                        <Button fullWidth color="secondary" onClick={() => navigate('/register')}>
                            Nincs fiókod? Regisztráció
                        </Button>
                    </Box>
                </Paper>
            </Box>
        </Container>
    );
}