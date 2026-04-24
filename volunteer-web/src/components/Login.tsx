import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api/axios';
import {
    Container, Box, Typography, TextField, Button,
    Paper, AppBar, Toolbar, CircularProgress, Alert,
    useTheme, alpha, Fade, InputAdornment, IconButton,
    FormControlLabel, Checkbox
} from '@mui/material';

// Ikonok
import LoginIcon from '@mui/icons-material/Login';
import AppRegistrationIcon from '@mui/icons-material/AppRegistration';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';

export default function Login() {
    const navigate = useNavigate();
    const location = useLocation();
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);

    const from = location.state?.from || '/dashboard';

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await api.post('/auth/authenticate', { email, password });
            const { token, role } = response.data;

            // Alapvető adatok mentése a memóriába
            localStorage.setItem('token', token);
            localStorage.setItem('role', role);

            if (rememberMe) {
                localStorage.setItem('rememberEmail', email);
            } else {
                localStorage.removeItem('rememberEmail');
            }

            // Opcionális: lekérjük a user adatait
            try {
                const userResponse = await api.get('/users/me', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                localStorage.setItem('user', JSON.stringify(userResponse.data));
            } catch (err) {
                console.warn("User adatokat nem sikerült lekérni a belépésnél.", err);
            }

            // Késleltetjük picit, hogy a React Context és a LocalStorage biztosan beálljon
            setTimeout(() => {
                navigate(from, { replace: true });
                window.location.reload();
            }, 100);

        } catch (err: unknown) {
            console.error(err);
            setError('Hibás email vagy jelszó!');
            setLoading(false);
        }
    };

    React.useEffect(() => {
        const savedEmail = localStorage.getItem('rememberEmail');
        if (savedEmail) {
            setEmail(savedEmail);
            setRememberMe(true);
        }
    }, []);

    const handleClickShowPassword = () => setShowPassword((show) => !show);
    const handleMouseDownPassword = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
    };

    return (
        <Fade in timeout={800}>
            <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                minHeight: '100vh',
                bgcolor: isDarkMode ? '#0f172a' : '#e3f2fd',
                backgroundImage: isDarkMode
                    ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
                    : 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
            }}>

                {/* --- FELSŐ NAVBAR --- */}
                <AppBar position="sticky" elevation={0} sx={{
                    bgcolor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                    backdropFilter: 'blur(12px)',
                    color: 'text.primary',
                    borderBottom: '1px solid',
                    borderColor: 'divider'
                }}>
                    <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 2, md: 4 } }}>
                        <Typography
                            variant="h6"
                            fontWeight="900"
                            color="primary"
                            sx={{ cursor: 'pointer', letterSpacing: '-1px' }}
                            onClick={() => navigate('/')}
                        >
                            VOLUNTEER<Box component="span" sx={{ color: isDarkMode ? 'white' : 'text.primary' }}>APP</Box>
                        </Typography>
                        <Button
                            color="primary"
                            variant="outlined"
                            startIcon={<AppRegistrationIcon />}
                            onClick={() => navigate('/register', { state: { from } })}
                            sx={{ borderRadius: 2, fontWeight: 'bold' }}
                        >
                            Regisztráció
                        </Button>
                    </Toolbar>
                </AppBar>

                {/* --- BELÉPÉSI ŰRLAP --- */}
                <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
                    <Container maxWidth="xs" disableGutters>
                        <Paper elevation={0} sx={{
                            p: { xs: 4, sm: 5 },
                            width: '100%',
                            borderRadius: 5,
                            bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.85)' : 'rgba(255, 255, 255, 0.95)',
                            backdropFilter: 'blur(20px)',
                            border: '1px solid',
                            borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.5)',
                            boxShadow: isDarkMode ? '0 25px 50px rgba(0,0,0,0.5)' : '0 20px 40px rgba(0,0,0,0.05)',
                        }}>

                            <Box display="flex" flexDirection="column" alignItems="center" mb={3}>
                                <Box sx={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    width: 64, height: 64,
                                    borderRadius: '50%',
                                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                                    color: 'primary.main',
                                    mb: 2
                                }}>
                                    <LoginIcon sx={{ fontSize: 32, ml: 0.5 }} />
                                </Box>
                                <Typography variant="h5" fontWeight="900" textAlign="center" color="text.primary" sx={{ letterSpacing: '-0.5px' }}>
                                    Üdv újra itt! 👋
                                </Typography>
                                <Typography variant="body2" color="text.secondary" textAlign="center" mt={0.5}>
                                    Jelentkezz be a folytatáshoz
                                </Typography>
                            </Box>

                            {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

                            <form onSubmit={handleLogin}>
                                <Box display="flex" flexDirection="column" gap={2.5}>
                                    <TextField
                                        label="E-mail cím"
                                        variant="outlined"
                                        fullWidth
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        autoFocus
                                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3, bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : '#f8fafc' } }}
                                    />

                                    <TextField
                                        label="Jelszó"
                                        type={showPassword ? 'text' : 'password'}
                                        variant="outlined"
                                        fullWidth
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3, bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : '#f8fafc' } }}
                                        InputProps={{
                                            endAdornment: (
                                                <InputAdornment position="end">
                                                    <IconButton
                                                        aria-label="toggle password visibility"
                                                        onClick={handleClickShowPassword}
                                                        onMouseDown={handleMouseDownPassword}
                                                        edge="end"
                                                        sx={{ color: 'text.secondary' }}
                                                    >
                                                        {showPassword ? <VisibilityOff /> : <Visibility />}
                                                    </IconButton>
                                                </InputAdornment>
                                            )
                                        }}
                                    />
                                </Box>

                                <Box sx={{ display: 'flex', alignItems: 'center', mt: 1.5, mb: 1 }}>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={rememberMe}
                                                onChange={(e) => setRememberMe(e.target.checked)}
                                                color="primary"
                                                size="small"
                                            />
                                        }
                                        label={<Typography variant="body2" color="text.secondary" fontWeight="500">Maradjak bejelentkezve</Typography>}
                                    />
                                </Box>

                                {/* --- JAVÍTÁS: EGYSÉGESÍTETT GOMBOK --- */}
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mt: 3 }}>
                                    <Button
                                        onClick={() => navigate(-1)}
                                        variant="outlined"
                                        size="large"
                                        sx={{ borderRadius: 3, px: 3, fontWeight: 'bold', borderWidth: 2, '&:hover': { borderWidth: 2 } }}
                                    >
                                        Vissza
                                    </Button>
                                    <Button
                                        type="submit"
                                        variant="contained"
                                        size="large"
                                        disabled={loading}
                                        sx={{
                                            borderRadius: 3, px: 4, fontWeight: '900', flexGrow: 1,
                                            background: loading ? undefined : (isDarkMode ? 'linear-gradient(135deg, #818cf8 0%, #4f46e5 100%)' : 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)'),
                                            boxShadow: loading ? 'none' : (isDarkMode ? '0 10px 20px rgba(129, 140, 248, 0.4)' : '0 10px 20px rgba(25, 118, 210, 0.3)'),
                                            transition: 'transform 0.2s',
                                            '&:hover': loading ? {} : { transform: 'translateY(-2px)' }
                                        }}
                                        disableElevation
                                    >
                                        {loading ? <CircularProgress size={24} color="inherit" /> : 'Bejelentkezés'}
                                    </Button>
                                </Box>
                            </form>

                            {/* --- JAVÍTÁS: EGYSÉGESÍTETT ALSÓ SÁV --- */}
                            <Box sx={{ mt: 4, textAlign: 'center', pt: 3, borderTop: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider' }}>
                                <Typography variant="body2" color="text.secondary" fontWeight="500">
                                    Nincs még fiókod?{' '}
                                    <Button color="primary" onClick={() => navigate('/register', { state: { from } })} sx={{ textTransform: 'none', fontWeight: '900', p: 0, minWidth: 'auto', verticalAlign: 'baseline', letterSpacing: '0.5px' }}>
                                        Regisztrálj itt!
                                    </Button>
                                </Typography>
                            </Box>

                        </Paper>
                    </Container>
                </Box>
            </Box>
        </Fade>
    );
}