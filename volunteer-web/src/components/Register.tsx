import { useState } from 'react';
import { TextField, Button, Container, Paper, Typography, Box, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

export default function Register() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        inviteCode: ''
    });
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            // 1. Elküldjük a regisztrációt
            const response = await api.post('/auth/register', formData);

            // 2. A backend visszaküldi a tokent. Ezt kimentjük!
            const { token } = response.data;

            if (token) {
                localStorage.setItem('token', token);
                // Beállítjuk az Axios-nak is, hogy a következő kérésnél már használja
                api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

                alert("Sikeres regisztráció! Üdv a csapatban! 🎉");

                // 3. Irány a Dashboard! (Nem a Login)
                navigate('/events');
                window.location.reload(); // Egy gyors frissítés, hogy biztosan betöltődjön a User state
            } else {
                // Ha valamiért nincs token, akkor irány a login
                navigate('/login');
            }

        } catch (err: any) {
            console.error(err);
            if (err.response && err.response.data) {
                const msg = typeof err.response.data === 'string'
                    ? err.response.data
                    : (err.response.data.message || 'Hiba történt');
                setError(msg);
            } else {
                setError('A regisztráció sikertelen. Próbáld újra!');
            }
        }
    };

    return (
        <Container component="main" maxWidth="xs">
            <Box sx={{ marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Paper elevation={3} sx={{ padding: 4, width: '100%' }}>
                    <Typography component="h1" variant="h5" align="center" gutterBottom>
                        Önkéntes Regisztráció
                    </Typography>

                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                    <form onSubmit={handleSubmit}>
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            label="Teljes Név"
                            name="name"
                            autoFocus
                            onChange={handleChange}
                        />
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            label="Email cím"
                            name="email"
                            type="email"
                            onChange={handleChange}
                        />
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            label="Jelszó"
                            name="password"
                            type="password"
                            onChange={handleChange}
                        />

                        <Box sx={{ mt: 2, mb: 1, p: 2, bgcolor: '#f0f7ff', borderRadius: 1, border: '1px dashed #1976d2' }}>
                            <Typography variant="caption" color="primary" sx={{fontWeight: 'bold'}}>
                                Rendelkezel meghívóval?
                            </Typography>
                            <TextField
                                margin="dense"
                                required
                                fullWidth
                                label="Meghívókód (pl. SZIGET2026)"
                                name="inviteCode"
                                placeholder="Írd be a kapott kódot"
                                onChange={handleChange}
                                variant="outlined"
                                size="small"
                                sx={{ bgcolor: 'white' }}
                            />
                        </Box>

                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            sx={{ mt: 3, mb: 2 }}
                        >
                            Regisztráció
                        </Button>
                        <Button
                            fullWidth
                            variant="text"
                            onClick={() => navigate('/login')}
                        >
                            Már van fiókom? Belépés
                        </Button>
                    </form>
                </Paper>
            </Box>
        </Container>
    );
}