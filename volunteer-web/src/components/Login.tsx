import { useState } from 'react';
import { Box, Button, TextField, Typography, Paper, Container } from '@mui/material';
import api from '../api/axios'; // Az előbb létrehozott postásunk
import { useNavigate } from 'react-router-dom'; // <--- ÚJ

export default function Login() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault(); // Ne töltse újra az oldalt
        setError('');

        try {
            // Elküldjük az adatokat a Backendnek
            const response = await api.post('/auth/login', { email, password });

            // Ha sikerült, megkapjuk a tokent
            console.log("Sikeres belépés:", response.data);

            // Elmentjük a böngészőbe a tokent
            localStorage.setItem('token', response.data.token);

            //alert('Sikeres bejelentkezés! Token elmentve.');
            navigate('/events');
        } catch (err) {
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

                        {error && (
                            <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                                {error}
                            </Typography>
                        )}

                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            sx={{ mt: 3, mb: 2 }}
                        >
                            Belépés
                        </Button>
                    </Box>
                </Paper>
            </Box>
        </Container>
    );
}