import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box, Button, Container, Step, StepLabel, Stepper, TextField,
    Typography, Radio, RadioGroup, FormControlLabel, FormControl,
    Paper, Alert, MenuItem, Checkbox
} from '@mui/material';
import api from '../api/axios';
import axios from 'axios';

export default function Register() {
    const navigate = useNavigate();

    const [activeStep, setActiveStep] = useState(0);
    const [userType, setUserType] = useState('volunteer');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // --- 1. STATE BŐVÍTÉSE AZ ÚJ MEZŐKKEL ---
    const [formData, setFormData] = useState({
        name: '', email: '', password: '', phoneNumber: '', gender: '', dateOfBirth: '',
        acceptGdpr: false, acceptTerms: false,

        orgName: '', orgAddress: '', orgCui: '',
        orgDescription: '', // Új
        orgEmail: '',       // Új
        orgPhone: '',       // Új
    });

    // --- 2. LÉPÉSEK ÁTNEVEZÉSE ---
    const steps = userType === 'volunteer'
        ? ['Fióktípus', 'Személyes Adatok', 'Feltételek & Befejezés']
        : ['Fióktípus', 'Szervezet Adatai', 'Vezető & Feltételek'];

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    // --- 3. GOMB LETILTÁSA (FELOKOSÍTVA) ---
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
            // Szervezet 1. lépés (Kibővítve a leírással és az emailel)
            if (activeStep === 1) {
                return !formData.orgName || !formData.orgAddress || !formData.orgCui ||
                    !formData.orgDescription || !formData.orgEmail;
            }
            // Szervezet 2. lépés (Vezetői adatok + Pिपák)
            if (activeStep === 2) {
                return !formData.name || !formData.email || !formData.password ||
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

    const handleBack = () => {
        setActiveStep((prev) => prev - 1);
        setError('');
    };

    const submitRegistration = async () => {
        try {
            setLoading(true);
            setError('');
            const endpoint = userType === 'volunteer' ? '/auth/register' : '/auth/register-org';

            // --- 4. BACKEND PAYLOAD BŐVÍTÉSE ---
            const payload = userType === 'volunteer'
                ? {
                    name: formData.name, email: formData.email, password: formData.password,
                    phoneNumber: formData.phoneNumber, gender: formData.gender, dateOfBirth: formData.dateOfBirth,
                    acceptGdpr: formData.acceptGdpr, acceptTerms: formData.acceptTerms
                }
                : {
                    orgName: formData.orgName,
                    orgAddress: formData.orgAddress,
                    orgCui: formData.orgCui,
                    description: formData.orgDescription, // BEKÜLDJÜK AZ ÚJ ADATOKAT IS
                    email: formData.orgEmail,
                    phone: formData.orgPhone,
                    adminName: formData.name,
                    adminEmail: formData.email,
                    adminPassword: formData.password,
                    acceptGdpr: formData.acceptGdpr,   // <-- EZT ADD HOZZÁ
                    acceptTerms: formData.acceptTerms
                };

            const response = await api.post(endpoint, payload);
            localStorage.setItem('token', response.data.token);
            navigate('/dashboard');

        } catch (err: unknown) {
            if (axios.isAxiosError(err) && err.response?.data) {
                const msg = typeof err.response.data === 'string'
                    ? err.response.data
                    : err.response.data.message || 'Hiba történt a regisztráció során.';
                setError(msg);
            } else {
                setError('Váratlan hiba történt a szerverrel való kommunikáció során.');
            }
        } finally {
            setLoading(false);
        }
    };

    const getStepContent = (step: number) => {
        if (step === 0) {
            return (
                <FormControl component="fieldset" sx={{ mt: 2, width: '100%' }}>
                    <RadioGroup value={userType} onChange={(e) => setUserType(e.target.value)}>
                        <Paper variant="outlined" sx={{ p: 2, mb: 2, cursor: 'pointer' }} onClick={() => setUserType('volunteer')}>
                            <FormControlLabel value="volunteer" control={<Radio />} label={
                                <Box>
                                    <Typography variant="h6">Önkéntes vagyok</Typography>
                                    <Typography variant="body2" color="textSecondary">Önkéntes munkákat keresek és szeretnék csatlakozni szervezetekhez.</Typography>
                                </Box>
                            } />
                        </Paper>
                        <Paper variant="outlined" sx={{ p: 2, cursor: 'pointer' }} onClick={() => setUserType('organization')}>
                            <FormControlLabel value="organization" control={<Radio />} label={
                                <Box>
                                    <Typography variant="h6">Szervezetet regisztrálok</Typography>
                                    <Typography variant="body2" color="textSecondary">Új céget, fesztivált vagy alapítványt szeretnék felvinni a rendszerbe.</Typography>
                                </Box>
                            } />
                        </Paper>
                    </RadioGroup>
                </FormControl>
            );
        }

        if (userType === 'volunteer') {
            if (step === 1) {
                return (
                    <Box sx={{ mt: 2 }}>
                        <TextField fullWidth margin="normal" label="Teljes név" name="name" value={formData.name} onChange={handleChange} required />
                        <TextField fullWidth margin="normal" label="Email cím" name="email" type="email" value={formData.email} onChange={handleChange} required />
                        <TextField fullWidth margin="normal" label="Jelszó (min. 6 karakter)" name="password" type="password" value={formData.password} onChange={handleChange} required />
                        <TextField fullWidth margin="normal" label="Telefonszám" name="phoneNumber" placeholder="+36 30 123 4567" value={formData.phoneNumber} onChange={handleChange} required />
                        <Box sx={{ display: 'flex', gap: 2, mt: 1, flexDirection: { xs: 'column', sm: 'row' } }}>
                            <TextField fullWidth select label="Nem" name="gender" value={formData.gender} onChange={handleChange} required sx={{ flex: 1 }}>
                                <MenuItem value="MALE">Férfi</MenuItem>
                                <MenuItem value="FEMALE">Nő</MenuItem>
                                <MenuItem value="OTHER">Egyéb</MenuItem>
                                <MenuItem value="PREFER_NOT_TO_SAY">Inkább nem mondom meg</MenuItem>
                            </TextField>
                            <TextField fullWidth label="Születési dátum" name="dateOfBirth" type="date" InputLabelProps={{ shrink: true }} value={formData.dateOfBirth} onChange={handleChange} required sx={{ flex: 1 }} />
                        </Box>
                    </Box>
                );
            }
            if (step === 2) {
                return (
                    <Box sx={{ mt: 3, p: 2, bgcolor: '#f9f9f9', borderRadius: 2 }}>
                        <Typography variant="subtitle1" fontWeight="bold" mb={2}>Jogi Nyilatkozatok</Typography>
                        <FormControlLabel control={<Checkbox name="acceptGdpr" checked={formData.acceptGdpr} onChange={handleChange} color="primary" />} label={<Typography>Elfogadom az Adatvédelmi Tájékoztatót (GDPR) <span style={{ color: 'red' }}>*</span></Typography>} />
                        <FormControlLabel control={<Checkbox name="acceptTerms" checked={formData.acceptTerms} onChange={handleChange} color="primary" />} label={<Typography>Elfogadom az Általános Szerződési Feltételeket (ÁSZF) <span style={{ color: 'red' }}>*</span></Typography>} />
                    </Box>
                );
            }
        } else {
            // --- 5. SZERVEZETI ŰRLAP KIBŐVÍTÉSE ---
            if (step === 1) {
                return (
                    <Box sx={{ mt: 2 }}>
                        <TextField fullWidth margin="normal" label="Szervezet / Cég neve" name="orgName" value={formData.orgName} onChange={handleChange} required />
                        <TextField fullWidth margin="normal" label="Székhely címe" name="orgAddress" value={formData.orgAddress} onChange={handleChange} required />
                        <TextField fullWidth margin="normal" label="Adószám / CUI" name="orgCui" value={formData.orgCui} onChange={handleChange} required />

                        <TextField fullWidth margin="normal" label="Szervezet bemutatkozása / Leírás" name="orgDescription" value={formData.orgDescription} onChange={handleChange} multiline rows={3} placeholder="Rövid leírás a szervezet céljairól..." required />
                        <Box sx={{ display: 'flex', gap: 2, mt: 1, flexDirection: { xs: 'column', sm: 'row' } }}>
                            <TextField fullWidth label="Kapcsolattartó Email" name="orgEmail" type="email" value={formData.orgEmail} onChange={handleChange} required />
                            <TextField fullWidth label="Telefonszám" name="orgPhone" type="tel" value={formData.orgPhone} onChange={handleChange} placeholder="+36 30 123 4567" />
                        </Box>
                    </Box>
                );
            }
            if (step === 2) {
                return (
                    <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle1" gutterBottom>Add meg a Főadminisztrátor belépési adatait:</Typography>
                        <TextField fullWidth margin="normal" label="Vezető neve" name="name" value={formData.name} onChange={handleChange} required />
                        <TextField fullWidth margin="normal" label="Vezető email címe" name="email" type="email" value={formData.email} onChange={handleChange} required />
                        <TextField fullWidth margin="normal" label="Belépési Jelszó (min. 6 karakter)" name="password" type="password" value={formData.password} onChange={handleChange} required />

                        <Box sx={{ mt: 3, p: 2, bgcolor: '#f9f9f9', borderRadius: 2 }}>
                            <Typography variant="subtitle1" fontWeight="bold" mb={2}>Jogi Nyilatkozatok</Typography>
                            <FormControlLabel control={<Checkbox name="acceptGdpr" checked={formData.acceptGdpr} onChange={handleChange} color="primary" />} label={<Typography>Elfogadom az Adatvédelmi Tájékoztatót (GDPR) <span style={{ color: 'red' }}>*</span></Typography>} />
                            <FormControlLabel control={<Checkbox name="acceptTerms" checked={formData.acceptTerms} onChange={handleChange} color="primary" />} label={<Typography>Elfogadom az Általános Szerződési Feltételeket (ÁSZF) <span style={{ color: 'red' }}>*</span></Typography>} />
                        </Box>
                    </Box>
                );
            }
        }
        return 'Ismeretlen lépés';
    };

    return (
        <Container maxWidth="sm">
            <Paper elevation={3} sx={{ p: 4, mt: 8 }}>
                <Typography variant="h4" align="center" gutterBottom color="primary" fontWeight="bold">
                    Regisztráció
                </Typography>

                <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4, mt: 3 }}>
                    {steps.map((label) => (
                        <Step key={label}>
                            <StepLabel>{label}</StepLabel>
                        </Step>
                    ))}
                </Stepper>

                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                <form onSubmit={(e) => { e.preventDefault(); handleNext(); }}>
                    {getStepContent(activeStep)}

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
                        <Button disabled={activeStep === 0 || loading} onClick={handleBack} variant="outlined">
                            Vissza
                        </Button>
                        <Button type="submit" variant="contained" color="primary" disabled={isNextDisabled()}>
                            {loading ? 'Kérlek várj...' : (activeStep === steps.length - 1 ? 'Regisztráció befejezése' : 'Tovább')}
                        </Button>
                    </Box>
                </form>

                <Box sx={{ mt: 4, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                        Már van fiókod?{' '}
                        <Button color="primary" onClick={() => navigate('/')} sx={{ textTransform: 'none', fontWeight: 'bold', p: 0, minWidth: 'auto', verticalAlign: 'baseline' }}>
                            Jelentkezz be itt!
                        </Button>
                    </Typography>
                </Box>
            </Paper>
        </Container>
    );
}