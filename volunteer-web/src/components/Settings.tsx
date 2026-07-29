import { useState } from 'react';
import {
    Container, Typography, Box, Paper, Switch, FormControlLabel,
    Divider, Select, MenuItem, FormControl, InputLabel,
    Radio, RadioGroup, Button, Fade
} from '@mui/material';

// Ikonok
import DarkModeIcon from '@mui/icons-material/DarkMode';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import LanguageIcon from '@mui/icons-material/Language';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import SaveIcon from '@mui/icons-material/Save';

// Téma kontextus importálása
import { useThemeToggle } from '../theme/ThemeContextProvider';

export default function Settings() {
    // Innen vesszük a globális sötét mód állapotát és a váltó függvényt
    const { isDarkMode, toggleTheme } = useThemeToggle();

    // --- LOKÁLIS ÁLLAPOTOK (Később ezeket a backendről kapjuk) ---
    const [language, setLanguage] = useState<string>('hu');
    const [emailNotif, setEmailNotif] = useState<boolean>(true);
    const [pushNotif, setPushNotif] = useState<boolean>(false);
    const [scanMethod, setScanMethod] = useState<string>('qr');

    const handleSave = () => {
        // Ide jön majd a backend hívás
        console.log("Mentett beállítások:", { isDarkMode, language, emailNotif, pushNotif, scanMethod });
    };

    return (
        <Fade in={true} timeout={500}>
            <Container maxWidth="md" sx={{ mt: { xs: 2, md: 5 }, mb: 10 }}>
                <Box mb={4}>
                    <Typography variant="h4" fontWeight="900" sx={{ color: isDarkMode ? 'primary.light' : 'primary.main', letterSpacing: '-0.5px' }}>
                        Beállítások ⚙️
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Szabd testre az alkalmazás megjelenését, a nyelvet és az értesítéseket.
                    </Typography>
                </Box>

                <Paper elevation={0} sx={{
                    borderRadius: 4,
                    border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider',
                    bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.4)' : 'white',
                    overflow: 'hidden'
                }}>

                    {/* --- MEGJELENÉS ÉS NYELV --- */}
                    <Box p={3}>
                        <Typography variant="h6" fontWeight="bold" mb={3} display="flex" alignItems="center" gap={1}>
                            <DarkModeIcon color="primary" /> Megjelenés és Nyelv
                        </Typography>

                        <Box display="flex" flexDirection="column" gap={3}>
                            <Box display="flex" justifyContent="space-between" alignItems="center">
                                <Box>
                                    <Typography variant="subtitle1" fontWeight="bold">Sötét mód</Typography>
                                    <Typography variant="body2" color="text.secondary">Válts a szemkímélő sötét felületre</Typography>
                                </Box>
                                <Switch
                                    checked={isDarkMode}
                                    onChange={toggleTheme}
                                    color="primary"
                                />
                            </Box>

                            <FormControl fullWidth size="small">
                                <InputLabel>Alkalmazás nyelve</InputLabel>
                                <Select
                                    value={language}
                                    label="Alkalmazás nyelve"
                                    onChange={(e) => setLanguage(e.target.value as string)}
                                    startAdornment={<LanguageIcon sx={{ mr: 1, color: 'text.secondary' }} fontSize="small" />}
                                    sx={{ borderRadius: 2 }}
                                >
                                    <MenuItem value="hu">Magyar</MenuItem>
                                    <MenuItem value="en">English</MenuItem>
                                    <MenuItem value="ro">Română</MenuItem>
                                </Select>
                            </FormControl>
                        </Box>
                    </Box>

                    <Divider sx={{ borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'divider' }} />

                    {/* --- ÉRTESÍTÉSEK --- */}
                    <Box p={3}>
                        <Typography variant="h6" fontWeight="bold" mb={3} display="flex" alignItems="center" gap={1}>
                            <NotificationsActiveIcon color="primary" /> Értesítések
                        </Typography>

                        <Box display="flex" flexDirection="column" gap={2}>
                            <FormControlLabel
                                control={<Switch checked={emailNotif} onChange={(e) => setEmailNotif(e.target.checked)} color="primary" />}
                                label={
                                    <Box>
                                        <Typography variant="subtitle2" fontWeight="bold">Email értesítések</Typography>
                                        <Typography variant="caption" color="text.secondary">Beosztások, változások és fontos üzenetek</Typography>
                                    </Box>
                                }
                                sx={{ m: 0, justifyContent: 'space-between', width: '100%', flexDirection: 'row-reverse' }}
                            />
                            <FormControlLabel
                                control={<Switch checked={pushNotif} onChange={(e) => setPushNotif(e.target.checked)} color="primary" />}
                                label={
                                    <Box>
                                        <Typography variant="subtitle2" fontWeight="bold">Push (Böngésző) értesítések</Typography>
                                        <Typography variant="caption" color="text.secondary">Azonnali riasztások a képernyőn</Typography>
                                    </Box>
                                }
                                sx={{ m: 0, justifyContent: 'space-between', width: '100%', flexDirection: 'row-reverse' }}
                            />
                        </Box>
                    </Box>

                    <Divider sx={{ borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'divider' }} />

                    {/* --- RENDSZER BEÁLLÍTÁSOK (Szervezőknek) --- */}
                    <Box p={3}>
                        <Typography variant="h6" fontWeight="bold" mb={3} display="flex" alignItems="center" gap={1}>
                            <QrCodeScannerIcon color="primary" /> Csekkolási módszer (Eseményeken)
                        </Typography>
                        <Typography variant="body2" color="text.secondary" mb={2}>
                            Alapértelmezett módszer a műszakok megkezdéséhez és az étkezés érvényesítéséhez.
                        </Typography>

                        <RadioGroup value={scanMethod} onChange={(e) => setScanMethod(e.target.value)}>
                            <FormControlLabel value="qr" control={<Radio color="primary" />} label="QR Kód (Kamerás beolvasás - Minden eszközön működik)" />
                            <FormControlLabel value="nfc" control={<Radio color="primary" />} label="NFC Csippantás (Csak kompatibilis telefonokkal)" />
                        </RadioGroup>
                    </Box>

                    {/* --- MENTÉS GOMB --- */}
                    <Box p={3} bgcolor={isDarkMode ? 'rgba(0,0,0,0.2)' : '#f8fafc'} display="flex" justifyContent="flex-end">
                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={<SaveIcon />}
                            onClick={handleSave}
                            disableElevation
                            sx={{ borderRadius: 2, fontWeight: 'bold', px: 4 }}
                        >
                            Beállítások Mentése
                        </Button>
                    </Box>

                </Paper>
            </Container>
        </Fade>
    );
}