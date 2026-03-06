import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Container, Typography, Box, Paper, CircularProgress, Alert,
    Button, Dialog, DialogTitle, DialogContent, DialogActions,
    Divider, Avatar, useTheme, useMediaQuery
} from '@mui/material';
import Grid from '@mui/material/Grid'; // Szabványos Grid2

// Ikonok
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import CorporateFareIcon from '@mui/icons-material/CorporateFare';

import api from '../api/axios';
import axios from 'axios';

// --- BŐVÍTETT INTERFÉSZ A STATISZTIKÁKKAL ---
interface UserStats {
    totalHours: number;
    completedEvents: number;
    activeOrganizations: number;
}

interface UserProfile {
    name: string;
    email: string;
    phoneNumber?: string;
    role: string;
    stats?: UserStats; // A backendből érkező statisztikák
}

export default function Profile() {
    const navigate = useNavigate();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const response = await api.get('/users/me');

            // Ha a backend esetleg még nem küldené a statisztikákat,
            // generálunk egy "üres" (0) alapértelmezett objektumot, hogy ne törjön el az oldal.
            const userData = response.data;
            if (!userData.stats) {
                userData.stats = { totalHours: 0, completedEvents: 0, activeOrganizations: 0 };
            }

            setUser(userData);
        } catch {
            setError('Nem sikerült betölteni a profil adatait.');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAccount = async () => {
        setDeleting(true);
        try {
            await api.delete('/users/me');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            navigate('/');
        } catch (err: unknown) {
            if (axios.isAxiosError(err)) alert(err.response?.data || "Hiba történt a törlés során.");
            else alert("Váratlan hiba történt.");
            setDeleteModalOpen(false);
            setDeleting(false);
        }
    };

    if (loading) return <Box display="flex" justifyContent="center" mt={10}><CircularProgress size={60} /></Box>;

    return (
        <Container maxWidth="md" sx={{ mt: { xs: 2, sm: 5 }, mb: 10 }}>
            <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/dashboard')} sx={{ mb: 3 }}>
                Vissza a Dashboardra
            </Button>

            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

            <Paper elevation={3} sx={{ borderRadius: 3, overflow: 'hidden' }}>
                {/* FEJLÉC */}
                <Box sx={{ bgcolor: 'primary.main', color: 'white', p: { xs: 3, sm: 5 }, textAlign: 'center', position: 'relative' }}>
                    <Avatar sx={{ width: 100, height: 100, margin: '0 auto', mb: 2, bgcolor: 'white', color: 'primary.main', fontSize: '3.5rem', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}>
                        {user?.name?.charAt(0) || 'U'}
                    </Avatar>
                    <Typography variant="h4" fontWeight="900" sx={{ fontSize: { xs: '1.8rem', sm: '2.2rem' } }}>
                        {user?.name}
                    </Typography>
                    <Typography variant="subtitle1" sx={{ opacity: 0.9, fontWeight: 500 }}>
                        {user?.role === 'SYS_ADMIN' ? 'Rendszergazda' : 'Önkéntes'}
                    </Typography>
                </Box>

                {/* --- ÚJ: STATISZTIKÁK SÁVJA --- */}
                <Box sx={{ px: { xs: 2, sm: 4 }, py: 3, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <Typography variant="subtitle2" color="text.secondary" fontWeight="bold" textTransform="uppercase" mb={2} textAlign={isMobile ? 'center' : 'left'}>
                        Önkéntes Mérlegem
                    </Typography>
                    <Grid container spacing={2}>
                        {/* 1. Munkaórák */}
                        <Grid size={{ xs: 12, sm: 4 }}>
                            <Paper elevation={0} sx={{ p: 2, textAlign: 'center', borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: 'white' }}>
                                <AccessTimeIcon color="primary" sx={{ fontSize: 32, mb: 1 }} />
                                <Typography variant="h4" fontWeight="900" color="primary.main">
                                    {user?.stats?.totalHours || 0}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" fontWeight="bold" textTransform="uppercase">
                                    Munkaóra
                                </Typography>
                            </Paper>
                        </Grid>

                        {/* 2. Események */}
                        <Grid size={{ xs: 6, sm: 4 }}>
                            <Paper elevation={0} sx={{ p: 2, textAlign: 'center', borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: 'white' }}>
                                <EmojiEventsIcon color="secondary" sx={{ fontSize: 32, mb: 1 }} />
                                <Typography variant="h4" fontWeight="900" color="secondary.main">
                                    {user?.stats?.completedEvents || 0}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" fontWeight="bold" textTransform="uppercase">
                                    Esemény
                                </Typography>
                            </Paper>
                        </Grid>

                        {/* 3. Szervezetek */}
                        <Grid size={{ xs: 6, sm: 4 }}>
                            <Paper elevation={0} sx={{ p: 2, textAlign: 'center', borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: 'white' }}>
                                <CorporateFareIcon color="info" sx={{ fontSize: 32, mb: 1 }} />
                                <Typography variant="h4" fontWeight="900" color="info.main">
                                    {user?.stats?.activeOrganizations || 0}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" fontWeight="bold" textTransform="uppercase">
                                    Szervezet
                                </Typography>
                            </Paper>
                        </Grid>
                    </Grid>
                </Box>

                {/* ADATOK RÉSZE */}
                <Box sx={{ p: { xs: 2, sm: 4 } }}>
                    <Typography variant="subtitle2" fontWeight="bold" gutterBottom color="text.secondary" textTransform="uppercase" mb={2}>
                        Személyes Adatok
                    </Typography>

                    <Box display="flex" alignItems="center" gap={2} mb={2.5}>
                        <Avatar sx={{ bgcolor: '#e3f2fd', color: 'primary.main', width: 40, height: 40 }}>
                            <EmailIcon />
                        </Avatar>
                        <Box>
                            <Typography variant="caption" color="text.secondary" display="block">Email cím</Typography>
                            <Typography variant="body1" fontWeight="500" sx={{ wordBreak: 'break-all' }}>{user?.email}</Typography>
                        </Box>
                    </Box>

                    <Box display="flex" alignItems="center" gap={2} mb={4}>
                        <Avatar sx={{ bgcolor: '#e3f2fd', color: 'primary.main', width: 40, height: 40 }}>
                            <PhoneIcon />
                        </Avatar>
                        <Box>
                            <Typography variant="caption" color="text.secondary" display="block">Telefonszám</Typography>
                            <Typography variant="body1" fontWeight="500">{user?.phoneNumber || 'Nincs megadva'}</Typography>
                        </Box>
                    </Box>

                    <Divider sx={{ mb: 4 }} />

                    {/* VESZÉLYZÓNA */}
                    <Box sx={{ p: 2, bgcolor: '#fff5f5', borderRadius: 2, border: '1px solid #ffcdd2' }}>
                        <Typography variant="subtitle1" color="error" fontWeight="bold" gutterBottom display="flex" alignItems="center" gap={1}>
                            <WarningAmberIcon /> Veszélyzóna
                        </Typography>
                        <Typography variant="body2" color="text.secondary" mb={2}>
                            A fiókod törlése visszavonhatatlan. Minden személyes adatod anonimizálásra kerül. A leigazolt munkaóráid továbbra is a rendszert gazdagítják, de a neved lekerül róluk.
                        </Typography>
                        <Button
                            variant="outlined" color="error" startIcon={<DeleteForeverIcon />} fullWidth
                            onClick={() => setDeleteModalOpen(true)} sx={{ fontWeight: 'bold' }}
                        >
                            Fiók végleges törlése
                        </Button>
                    </Box>
                </Box>
            </Paper>

            {/* MEGERŐSÍTŐ MODAL */}
            <Dialog open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { m: 2, borderRadius: 3 } }}>
                <DialogTitle sx={{ fontWeight: 'bold', color: 'error.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <WarningAmberIcon /> Biztosan törlöd a fiókod?
                </DialogTitle>
                <DialogContent>
                    <Typography mb={2}>
                        Ez a művelet <strong>visszavonhatatlan</strong>. A tagságaid és önkéntes óráid véglegesen leválasztásra kerülnek a nevedről.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ p: 2, pt: 0 }}>
                    <Button onClick={() => setDeleteModalOpen(false)} color="inherit" disabled={deleting}>Mégse</Button>
                    <Button onClick={handleDeleteAccount} variant="contained" color="error" disabled={deleting} sx={{ borderRadius: 2 }}>
                        {deleting ? 'Törlés...' : 'Végleges törlés'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
}