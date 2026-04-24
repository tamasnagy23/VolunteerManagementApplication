import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Box, Button, Container, Step, StepLabel, Stepper, TextField,
    Typography, Radio, RadioGroup, FormControlLabel, FormControl,
    Paper, Alert, MenuItem, Checkbox, AppBar, Toolbar, Fade,
    useTheme, alpha, IconButton, InputAdornment, Tooltip, CircularProgress
} from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { hu } from 'date-fns/locale';
import api from '../api/axios';
import axios from 'axios';

// Ikonok
import LoginIcon from '@mui/icons-material/Login';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import PersonIcon from '@mui/icons-material/Person';
import BusinessIcon from '@mui/icons-material/Business';
import AppRegistrationIcon from '@mui/icons-material/AppRegistration';

// Téma Hook
import { useThemeToggle } from '../theme/ThemeContextProvider';

export default function Register() {
    const navigate = useNavigate();
    const location = useLocation();
    const theme = useTheme();
    const { isDarkMode, toggleTheme } = useThemeToggle();
    const from = location.state?.from || '/dashboard';

    const [activeStep, setActiveStep] = useState(0);
    const [userType, setUserType] = useState('volunteer');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [datePickerOpen, setDatePickerOpen] = useState(false);

    // Jelszó láthatósága
    const [showPassword, setShowPassword] = useState(false);

    const [formData, setFormData] = useState({
        name: '', email: '', password: '', phoneNumber: '', gender: '', dateOfBirth: '',
        acceptGdpr: false, acceptTerms: false,
        orgName: '', orgAddress: '', orgCui: '',
        orgDescription: '',
        orgEmail: '',
        orgPhone: '',
    });

    const steps = userType === 'volunteer'
        ? ['Fióktípus', 'Személyes Adatok', 'Feltételek']
        : ['Fióktípus', 'Szervezet Adatai', 'Vezető adatai'];

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleClickShowPassword = () => setShowPassword((show) => !show);
    const handleMouseDownPassword = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
    };

    const isNextDisabled = () => {
        if (loading) return true;

        if (userType === 'volunteer') {
            if (activeStep === 1) {
                return !formData.name || !formData.email || !formData.password ||
                    !formData.phoneNumber || !formData.gender || !formData.dateOfBirth;
            }
            if (activeStep === 2) {
                return !formData.acceptGdpr || !formData.acceptTerms;
            }
        } else {
            if (activeStep === 1) {
                return !formData.orgName || !formData.orgAddress || !formData.orgCui ||
                    !formData.orgDescription || !formData.orgEmail;
            }
            if (activeStep === 2) {
                return !formData.name || !formData.email || !formData.password ||
                    !formData.phoneNumber || !formData.gender || !formData.dateOfBirth ||
                    !formData.acceptGdpr || !formData.acceptTerms;
            }
        }
        return false;
    };

    const handleNext = async () => {
        if (activeStep === steps.length - 1) {
            await submitRegistration();
        } else {
            setActiveStep((prev) => prev + 1);
        }
    };

    // JAVÍTÁS: Intelligens Vissza gomb
    const handleBack = () => {
        if (activeStep === 0) {
            navigate(-1); // Visszadobja az előző oldalra (pl. Kirakat vagy Login)
        } else {
            setActiveStep((prev) => prev - 1);
            setError('');
        }
    };

    const submitRegistration = async () => {
        try {
            setLoading(true);
            setError('');
            const endpoint = userType === 'volunteer' ? '/auth/register' : '/auth/register-org';

            const payload = userType === 'volunteer'
                ? {
                    name: formData.name, email: formData.email, password: formData.password,
                    phoneNumber: formData.phoneNumber, gender: formData.gender, dateOfBirth: formData.dateOfBirth,
                    acceptGdpr: formData.acceptGdpr, acceptTerms: formData.acceptTerms
                }
                : {
                    orgName: formData.orgName, orgAddress: formData.orgAddress, orgCui: formData.orgCui,
                    description: formData.orgDescription, email: formData.orgEmail, phone: formData.orgPhone,
                    adminName: formData.name, adminEmail: formData.email, adminPassword: formData.password,
                    adminPhoneNumber: formData.phoneNumber, adminGender: formData.gender, adminDateOfBirth: formData.dateOfBirth,
                    acceptGdpr: formData.acceptGdpr, acceptTerms: formData.acceptTerms
                };

            const response = await api.post(endpoint, payload);

            const token = response.data.token;
            localStorage.setItem('token', token);
            if (response.data.role) localStorage.setItem('role', response.data.role);
            api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

            try {
                const userResponse = await api.get('/users/me', { headers: { Authorization: `Bearer ${token}` } });
                localStorage.setItem('user', JSON.stringify(userResponse.data));
            } catch (userErr) {
                console.warn("User adatokat nem sikerült lekérni a regisztrációnál.", userErr);
            }

            setTimeout(() => {
                navigate(from, { replace: true });
                window.location.reload();
            }, 100);

        } catch (err: unknown) {
            if (axios.isAxiosError(err) && err.response?.data) {
                const msg = typeof err.response.data === 'string'
                    ? err.response.data
                    : err.response.data.message || 'Hiba történt a regisztráció során.';
                setError(msg);
            } else {
                setError('Váratlan hiba történt a szerverrel való kommunikáció során.');
            }
            setLoading(false);
        }
    };

    const inputBgColor = isDarkMode ? 'rgba(0,0,0,0.2)' : '#f8fafc';

    // Kiszámoljuk az életkort a figyelmeztetéshez
    const calculateAge = () => {
        if (!formData.dateOfBirth) return null;
        const dob = new Date(formData.dateOfBirth).getTime();
        const now = new Date().getTime();
        return (now - dob) / (1000 * 60 * 60 * 24 * 365.25);
    };
    const age = calculateAge();
    const isUnder16 = age !== null && age < 16;

    // Közös személyes adatok blokk
    const renderPersonalDataFields = () => (
        <Box display="flex" flexDirection="column" gap={2}>
            <TextField
                fullWidth label="Teljes név" name="name" value={formData.name} onChange={handleChange} required
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3, bgcolor: inputBgColor } }}
            />
            <TextField
                fullWidth label="Email cím" name="email" type="email" value={formData.email} onChange={handleChange} required
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3, bgcolor: inputBgColor } }}
            />
            <TextField
                fullWidth label="Jelszó (min. 6 karakter)" name="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password} onChange={handleChange} required
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3, bgcolor: inputBgColor } }}
                InputProps={{
                    endAdornment: (
                        <InputAdornment position="end">
                            <IconButton onClick={handleClickShowPassword} onMouseDown={handleMouseDownPassword} edge="end" sx={{ color: 'text.secondary' }}>
                                {showPassword ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                        </InputAdornment>
                    )
                }}
            />
            <TextField
                fullWidth label="Telefonszám" name="phoneNumber" placeholder="+36 30 123 4567" value={formData.phoneNumber} onChange={handleChange} required
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3, bgcolor: inputBgColor } }}
            />
            <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                <TextField
                    fullWidth select label="Nem" name="gender" value={formData.gender} onChange={handleChange} required
                    sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: 3, bgcolor: inputBgColor } }}
                >
                    <MenuItem value="MALE">Férfi</MenuItem>
                    <MenuItem value="FEMALE">Nő</MenuItem>
                    <MenuItem value="OTHER">Egyéb</MenuItem>
                    <MenuItem value="PREFER_NOT_TO_SAY">Inkább nem mondom meg</MenuItem>
                </TextField>

                <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={hu}>
                    <DatePicker
                        label="Születési dátum"
                        value={formData.dateOfBirth ? new Date(formData.dateOfBirth) : null}
                        open={datePickerOpen}
                        onOpen={() => setDatePickerOpen(true)}
                        onClose={() => setDatePickerOpen(false)}
                        onChange={(newValue) => {
                            if (newValue) {
                                const formattedDate = newValue.toLocaleDateString('en-CA').split('T')[0];
                                setFormData(prev => ({ ...prev, dateOfBirth: formattedDate }));
                            } else {
                                setFormData(prev => ({ ...prev, dateOfBirth: '' }));
                            }
                        }}
                        slotProps={{
                            textField: {
                                fullWidth: true, required: true,
                                sx: { flex: 1, '& .MuiOutlinedInput-root': { borderRadius: 3, bgcolor: inputBgColor } },
                                onClick: () => setDatePickerOpen(true),
                            }
                        }}
                        disableFuture
                    />
                </LocalizationProvider>
            </Box>

            {/* JAVÍTÁS: GDPR 16 éven aluliak figyelmeztetés */}
            {isUnder16 && (
                <Alert severity="warning" sx={{ mt: 1, borderRadius: 2 }}>
                    <Typography variant="body2" fontWeight="600">
                        A GDPR szabályozás értelmében 16 éven aluliak regisztrációja csak szülői/gondviselői beleegyezéssel lehetséges. A regisztráció folytatásával kijelented, hogy rendelkezel ezzel az engedéllyel.
                    </Typography>
                </Alert>
            )}
        </Box>
    );

    const getStepContent = (step: number) => {
        if (step === 0) {
            return (
                <FormControl component="fieldset" sx={{ mt: 2, width: '100%' }}>
                    <RadioGroup value={userType} onChange={(e) => setUserType(e.target.value)} sx={{ gap: 2 }}>

                        <Paper
                            variant="outlined"
                            onClick={() => setUserType('volunteer')}
                            sx={{
                                p: 3, cursor: 'pointer', transition: '0.2s', borderRadius: 4,
                                borderColor: userType === 'volunteer' ? 'primary.main' : (isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider'),
                                bgcolor: userType === 'volunteer' ? alpha(theme.palette.primary.main, 0.1) : (isDarkMode ? 'rgba(0,0,0,0.2)' : 'transparent'),
                                display: 'flex', alignItems: 'center', gap: 3,
                                '&:hover': { borderColor: 'primary.light' }
                            }}
                        >
                            <Box sx={{ p: 1.5, borderRadius: '50%', bgcolor: 'primary.main', color: 'white', display: 'flex' }}>
                                <PersonIcon fontSize="medium" />
                            </Box>
                            <FormControlLabel value="volunteer" control={<Radio sx={{ display: 'none' }} />} label={
                                <Box>
                                    <Typography variant="h6" fontWeight="900" color="text.primary">Önkéntes vagyok</Typography>
                                    <Typography variant="body2" color="text.secondary">Önkéntes munkákat keresek és szeretnék csatlakozni szervezetekhez.</Typography>
                                </Box>
                            } sx={{ m: 0, width: '100%' }} />
                        </Paper>

                        <Paper
                            variant="outlined"
                            onClick={() => setUserType('organization')}
                            sx={{
                                p: 3, cursor: 'pointer', transition: '0.2s', borderRadius: 4,
                                borderColor: userType === 'organization' ? 'secondary.main' : (isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider'),
                                bgcolor: userType === 'organization' ? alpha(theme.palette.secondary.main, 0.1) : (isDarkMode ? 'rgba(0,0,0,0.2)' : 'transparent'),
                                display: 'flex', alignItems: 'center', gap: 3,
                                '&:hover': { borderColor: 'secondary.light' }
                            }}
                        >
                            <Box sx={{ p: 1.5, borderRadius: '50%', bgcolor: 'secondary.main', color: 'white', display: 'flex' }}>
                                <BusinessIcon fontSize="medium" />
                            </Box>
                            <FormControlLabel value="organization" control={<Radio sx={{ display: 'none' }} />} label={
                                <Box>
                                    <Typography variant="h6" fontWeight="900" color="text.primary">Szervezetet regisztrálok</Typography>
                                    <Typography variant="body2" color="text.secondary">Új céget, fesztivált vagy alapítványt szeretnék felvinni a rendszerbe.</Typography>
                                </Box>
                            } sx={{ m: 0, width: '100%' }} />
                        </Paper>
                    </RadioGroup>
                </FormControl>
            );
        }

        if (userType === 'volunteer') {
            if (step === 1) return <Box sx={{ mt: 3 }}>{renderPersonalDataFields()}</Box>;

            if (step === 2) {
                return (
                    <Box sx={{ mt: 3, p: 3, bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : '#f8fafc', borderRadius: 4, border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'divider' }}>
                        <Typography variant="subtitle1" fontWeight="900" mb={2} color="primary">Jogi Nyilatkozatok</Typography>
                        <FormControlLabel control={<Checkbox name="acceptGdpr" checked={formData.acceptGdpr} onChange={handleChange} color="primary" />} label={<Typography fontWeight="500">Elfogadom az Adatvédelmi Tájékoztatót (GDPR) <span style={{ color: theme.palette.error.main }}>*</span></Typography>} />
                        <FormControlLabel control={<Checkbox name="acceptTerms" checked={formData.acceptTerms} onChange={handleChange} color="primary" />} label={<Typography fontWeight="500" mt={1}>Elfogadom az Általános Szerződési Feltételeket (ÁSZF) <span style={{ color: theme.palette.error.main }}>*</span></Typography>} />
                    </Box>
                );
            }
        } else {
            if (step === 1) {
                return (
                    <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField fullWidth label="Szervezet / Cég neve" name="orgName" value={formData.orgName} onChange={handleChange} required sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3, bgcolor: inputBgColor } }} />
                        <TextField fullWidth label="Székhely címe" name="orgAddress" value={formData.orgAddress} onChange={handleChange} required sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3, bgcolor: inputBgColor } }} />
                        <TextField fullWidth label="Adószám / CUI" name="orgCui" value={formData.orgCui} onChange={handleChange} required sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3, bgcolor: inputBgColor } }} />
                        <TextField fullWidth label="Szervezet bemutatkozása / Leírás" name="orgDescription" value={formData.orgDescription} onChange={handleChange} multiline rows={3} placeholder="Rövid leírás a szervezet céljairól..." required sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3, bgcolor: inputBgColor } }} />
                        <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                            <TextField fullWidth label="Kapcsolattartó Email" name="orgEmail" type="email" value={formData.orgEmail} onChange={handleChange} required sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3, bgcolor: inputBgColor } }} />
                            <TextField fullWidth label="Telefonszám" name="orgPhone" type="tel" value={formData.orgPhone} onChange={handleChange} placeholder="+36 30 123 4567" sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3, bgcolor: inputBgColor } }} />
                        </Box>
                    </Box>
                );
            }
            if (step === 2) {
                return (
                    <Box sx={{ mt: 3 }}>
                        <Typography variant="subtitle1" fontWeight="900" color="primary" gutterBottom mb={2}>Add meg a Főadminisztrátor belépési adatait:</Typography>
                        {renderPersonalDataFields()}
                        <Box sx={{ mt: 4, p: 3, bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : '#f8fafc', borderRadius: 4, border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'divider' }}>
                            <Typography variant="subtitle1" fontWeight="900" mb={2} color="primary">Jogi Nyilatkozatok</Typography>
                            <FormControlLabel control={<Checkbox name="acceptGdpr" checked={formData.acceptGdpr} onChange={handleChange} color="primary" />} label={<Typography fontWeight="500">Elfogadom az Adatvédelmi Tájékoztatót (GDPR) <span style={{ color: theme.palette.error.main }}>*</span></Typography>} />
                            <FormControlLabel control={<Checkbox name="acceptTerms" checked={formData.acceptTerms} onChange={handleChange} color="primary" />} label={<Typography fontWeight="500" mt={1}>Elfogadom az Általános Szerződési Feltételeket (ÁSZF) <span style={{ color: theme.palette.error.main }}>*</span></Typography>} />
                        </Box>
                    </Box>
                );
            }
        }
        return null;
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
                    borderColor: 'divider',
                    zIndex: 1201
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

                        <Box display="flex" alignItems="center" gap={1.5}>
                            <Tooltip title={isDarkMode ? "Világos módra váltás" : "Sötét módra váltás"}>
                                <IconButton onClick={toggleTheme} color="inherit" sx={{ transition: 'transform 0.4s', '&:hover': { transform: 'rotate(180deg)' } }}>
                                    <Brightness4Icon />
                                </IconButton>
                            </Tooltip>
                            <Button
                                color="primary"
                                variant="outlined"
                                startIcon={<LoginIcon />}
                                onClick={() => navigate('/login', { state: { from } })}
                                sx={{ borderRadius: 2, fontWeight: 'bold' }}
                            >
                                Bejelentkezés
                            </Button>
                        </Box>
                    </Toolbar>
                </AppBar>

                {/* --- REGISZTRÁCIÓS ŰRLAP --- */}
                <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, py: { xs: 4, md: 6 } }}>
                    <Container maxWidth="sm" disableGutters>
                        <Paper elevation={0} sx={{
                            p: { xs: 3, sm: 5 },
                            width: '100%',
                            borderRadius: 5,
                            bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.85)' : 'rgba(255, 255, 255, 0.95)',
                            backdropFilter: 'blur(20px)',
                            border: '1px solid',
                            borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.5)',
                            boxShadow: isDarkMode ? '0 25px 50px rgba(0,0,0,0.5)' : '0 20px 40px rgba(0,0,0,0.05)',
                        }}>

                            <Box display="flex" flexDirection="column" alignItems="center" mb={2}>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: '50%', bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', mb: 2 }}>
                                    <AppRegistrationIcon sx={{ fontSize: 32 }} />
                                </Box>
                                <Typography variant="h4" fontWeight="900" textAlign="center" color="text.primary" sx={{ letterSpacing: '-0.5px' }}>
                                    Regisztráció
                                </Typography>
                            </Box>

                            <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4, mt: 3, '& .MuiStepLabel-label': { fontWeight: '600' } }}>
                                {steps.map((label) => (
                                    <Step key={label}><StepLabel>{label}</StepLabel></Step>
                                ))}
                            </Stepper>

                            {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

                            <form onSubmit={(e) => { e.preventDefault(); handleNext(); }}>
                                {getStepContent(activeStep)}

                                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mt: 5 }}>
                                    <Button
                                        disabled={loading} // JAVÍTÁS: Levettük az activeStep === 0 ellenőrzést, így mindig kattintható!
                                        onClick={handleBack}
                                        variant="outlined"
                                        size="large"
                                        sx={{ borderRadius: 3, px: 3, fontWeight: 'bold', borderWidth: 2, '&:hover': { borderWidth: 2 } }}
                                    >
                                        Vissza
                                    </Button>
                                    <Button
                                        type="submit"
                                        variant="contained"
                                        color="primary"
                                        size="large"
                                        disabled={isNextDisabled()}
                                        sx={{
                                            borderRadius: 3, px: 4, fontWeight: '900', flexGrow: 1,
                                            background: isNextDisabled() ? undefined : (isDarkMode ? 'linear-gradient(135deg, #818cf8 0%, #4f46e5 100%)' : 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)'),
                                            boxShadow: isNextDisabled() ? 'none' : (isDarkMode ? '0 10px 20px rgba(129, 140, 248, 0.4)' : '0 10px 20px rgba(25, 118, 210, 0.3)'),
                                        }}
                                        disableElevation
                                    >
                                        {loading ? <CircularProgress size={24} color="inherit" /> : (activeStep === steps.length - 1 ? 'Regisztráció befejezése' : 'Tovább')}
                                    </Button>
                                </Box>
                            </form>

                            <Box sx={{ mt: 5, textAlign: 'center', pt: 3, borderTop: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider' }}>
                                <Typography variant="body2" color="text.secondary" fontWeight="500">
                                    Már van fiókod?{' '}
                                    <Button color="primary" onClick={() => navigate('/login', { state: { from } })} sx={{ textTransform: 'none', fontWeight: '900', p: 0, minWidth: 'auto', verticalAlign: 'baseline', letterSpacing: '0.5px' }}>
                                        Jelentkezz be itt!
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