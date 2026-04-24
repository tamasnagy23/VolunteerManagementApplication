import { useEffect, useState } from 'react';
import {
    Container, Typography, Box, Paper, Grid, Chip,
    Button, CircularProgress, Alert, Card, CardContent,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField,
    Fade, Stack, Avatar
} from '@mui/material';
import api from '../api/axios';
import { useNavigate } from 'react-router-dom';

// Ikonok importálása
import EventIcon from '@mui/icons-material/Event';
import BusinessIcon from '@mui/icons-material/Business';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import BlockIcon from '@mui/icons-material/Block';
import UndoIcon from '@mui/icons-material/Undo';
import SearchOffIcon from '@mui/icons-material/SearchOff';

// A saját ThemeContext-ed! (Állítsd be a pontos útvonalat, ha máshol van)
import { useThemeToggle } from '../theme/ThemeContextProvider';

interface ApplicationDTO {
    id: number;
    userName: string;
    orgName: string;
    workAreaName: string;
    status: string;
    eventTitle: string;
    eventId: number;
    withdrawalReason?: string;
    rejectionMessage?: string;
}
// Ezt tedd be az interface alá!
type MuiColor = 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';

export default function MyApplications() {
    const { isDarkMode } = useThemeToggle();
    const navigate = useNavigate();

    const [applications, setApplications] = useState<ApplicationDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [cancelModalOpen, setCancelModalOpen] = useState(false);
    const [selectedAppId, setSelectedAppId] = useState<number | null>(null);
    const [cancelReason, setCancelReason] = useState('');
    const [cancelling, setCancelling] = useState(false);

    const fetchMyApps = async () => {
        try {
            setLoading(true);
            const response = await api.get('/applications/my');
            setApplications(response.data);
        } catch {
            setError('Nem sikerült betölteni a jelentkezéseidet.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMyApps();
    }, []);

    const handleOpenCancel = (id: number) => {
        setSelectedAppId(id);
        setCancelReason('');
        setCancelModalOpen(true);
    };

    const handleConfirmCancel = async () => {
        if (!selectedAppId) return;
        setCancelling(true);
        try {
            await api.delete(`/applications/${selectedAppId}`, {
                params: { reason: cancelReason }
            });
            setCancelModalOpen(false);
            fetchMyApps();
        } catch {
            alert("Hiba történt a visszavonás során.");
        } finally {
            setCancelling(false);
        }
    };

// --- DIZÁJN SEGÉDFÜGGVÉNYEK ---
    const getStatusConfig = (status: string): { color: MuiColor, label: string, icon: React.ReactElement } => {
        switch (status) {
            case 'APPROVED': return { color: 'success', label: 'Elfogadva', icon: <CheckCircleIcon fontSize="small" /> };
            case 'PENDING': return { color: 'warning', label: 'Elbírálás alatt', icon: <PendingActionsIcon fontSize="small" /> };
            case 'REJECTED': return { color: 'error', label: 'Elutasítva', icon: <BlockIcon fontSize="small" /> };
            case 'WITHDRAWN': return { color: 'default', label: 'Visszavonva', icon: <UndoIcon fontSize="small" /> };
            default: return { color: 'primary', label: status, icon: <PendingActionsIcon fontSize="small" /> };
        }
    };

    if (loading) return (
        <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="60vh" gap={2}>
            <CircularProgress size={48} thickness={4} />
            <Typography variant="body1" color="text.secondary" fontWeight="500" sx={{ animation: 'pulse 1.5s infinite' }}>
                Jelentkezések betöltése...
            </Typography>
        </Box>
    );

    return (
        <Fade in={true} timeout={500}>
            <Container maxWidth="md" sx={{ mt: { xs: 2, sm: 4 }, mb: 10 }}>
                {/* --- FEJLÉC --- */}

                <Box mb={5}>
                    <Typography variant="h3" fontWeight="900" gutterBottom sx={{
                        background: isDarkMode ? 'linear-gradient(90deg, #818cf8, #c084fc)' : 'linear-gradient(90deg, #4f46e5, #9333ea)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        display: 'inline-block'
                    }}>
                        Saját Jelentkezéseim
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ fontSize: '1.1rem' }}>
                        Kövesd nyomon az eseményeket, amelyekre önkéntesnek jelentkeztél.
                    </Typography>
                </Box>

                {error && (
                    <Alert severity="error" sx={{ mb: 4, borderRadius: 3 }}>
                        {error}
                    </Alert>
                )}

                {/* --- ÜRES ÁLLAPOT (EMPTY STATE) --- */}
                {applications.length === 0 ? (
                    <Paper sx={{
                        p: { xs: 4, md: 8 },
                        textAlign: 'center',
                        bgcolor: isDarkMode ? 'rgba(30,41,59,0.4)' : 'rgba(255,255,255,0.6)',
                        backdropFilter: 'blur(20px)',
                        borderRadius: 4,
                        border: '2px dashed',
                        borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                    }}>
                        <Avatar sx={{ width: 80, height: 80, bgcolor: 'transparent', color: 'text.secondary', mx: 'auto', mb: 2 }}>
                            <SearchOffIcon sx={{ fontSize: 60 }} />
                        </Avatar>
                        <Typography variant="h5" fontWeight="800" color="text.primary" gutterBottom>
                            Még nincsenek jelentkezéseid
                        </Typography>
                        <Typography variant="body1" color="text.secondary" mb={4} maxWidth="400px" mx="auto">
                            Fedezz fel új lehetőségeket, csatlakozz eseményekhez és építs kapcsolatokat az önkéntes közösségben!
                        </Typography>
                        <Button
                            variant="contained"
                            size="large"
                            onClick={() => navigate('/dashboard')}
                            sx={{ borderRadius: 3, px: 4, py: 1.5, fontWeight: 'bold' }}
                        >
                            Események keresése
                        </Button>
                    </Paper>
                ) : (
                    /* --- JELENTKEZÉSEK LISTÁJA --- */
                    <Stack spacing={3}>
                        {applications.map((app) => {
                            const statusConf = getStatusConfig(app.status);

                            return (
                                <Card
                                    key={app.id}
                                    elevation={0}
                                    sx={{
                                        borderRadius: 4,
                                        position: 'relative',
                                        overflow: 'hidden',
                                        bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.5)' : 'rgba(255, 255, 255, 0.8)',
                                        backdropFilter: 'blur(20px)',
                                        border: '1px solid',
                                        borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        '&:hover': {
                                            transform: 'translateY(-4px)',
                                            boxShadow: isDarkMode ? '0 12px 40px rgba(0,0,0,0.4)' : '0 12px 40px rgba(149, 157, 165, 0.2)',
                                            borderColor: isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'
                                        }
                                    }}
                                >
                                    {/* Színes csík a kártya bal szélén a státusz alapján */}
                                    <Box sx={{
                                        position: 'absolute', left: 0, top: 0, bottom: 0, width: '6px',
                                        bgcolor: `${statusConf.color}.main`
                                    }} />

                                    <CardContent sx={{ p: { xs: 3, sm: 4 }, pl: { xs: 4, sm: 5 } }}>
                                        <Grid container spacing={2} alignItems="flex-start">
                                            <Grid size={{xs: 12, sm: 8}}>
                                                <Typography variant="h5" fontWeight="800" color="text.primary" gutterBottom>
                                                    {app.eventTitle}
                                                </Typography>

                                                <Stack direction="row" alignItems="center" spacing={1} mb={2} flexWrap="wrap" useFlexGap>
                                                    <Chip
                                                        icon={<BusinessIcon fontSize="small" />}
                                                        label={app.orgName}
                                                        size="small"
                                                        variant="outlined"
                                                        sx={{ fontWeight: 600, borderRadius: 2 }}
                                                    />
                                                    <Chip
                                                        label={`Terület: ${app.workAreaName}`}
                                                        size="small"
                                                        sx={{
                                                            bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                                                            fontWeight: 600, borderRadius: 2
                                                        }}
                                                    />
                                                </Stack>
                                            </Grid>

                                            <Grid size={{xs: 12, sm: 4}} sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
                                                <Chip
                                                    icon={statusConf.icon}
                                                    label={statusConf.label}
                                                    color={statusConf.color}
                                                    sx={{ fontWeight: '800', px: 1, py: 2.5, borderRadius: 3, mb: 1 }}
                                                />
                                                <Typography variant="caption" display="block" color="text.secondary" fontWeight="600">
                                                    Jelentkezés ID: #{app.id}
                                                </Typography>
                                            </Grid>
                                        </Grid>

                                        {app.status === 'REJECTED' && app.rejectionMessage && (
                                            <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>
                                                <strong>Szervező üzenete:</strong> {app.rejectionMessage}
                                            </Alert>
                                        )}

                                        {app.status === 'WITHDRAWN' && (
                                            <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>
                                                Ezt a jelentkezést te magad vontad vissza.
                                            </Alert>
                                        )}

                                        <Box display="flex" flexWrap="wrap" gap={2} mt={4}>
                                            <Button
                                                variant={isDarkMode ? 'contained' : 'outlined'}
                                                color={isDarkMode ? 'secondary' : 'primary'}
                                                size="medium"
                                                startIcon={<EventIcon />}
                                                onClick={() => navigate(`/events/${app.eventId}`)}
                                                sx={{ borderRadius: 2, fontWeight: 700 }}
                                            >
                                                Esemény részletei
                                            </Button>

                                            {app.status === 'PENDING' && (
                                                <Button
                                                    variant="text"
                                                    color="error"
                                                    size="medium"
                                                    startIcon={<CancelIcon />}
                                                    onClick={() => handleOpenCancel(app.id)}
                                                    sx={{ borderRadius: 2, fontWeight: 700, '&:hover': { bgcolor: 'error.light', color: 'white' } }}
                                                >
                                                    Visszavonás
                                                </Button>
                                            )}
                                        </Box>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </Stack>
                )}

                {/* --- VISSZAVONÁS MODAL (Üveghatású) --- */}
                <Dialog
                    open={cancelModalOpen}
                    onClose={() => setCancelModalOpen(false)}
                    maxWidth="xs"
                    fullWidth
                    PaperProps={{
                        sx: {
                            borderRadius: 4,
                            bgcolor: isDarkMode ? 'rgba(30,41,59,0.9)' : 'rgba(255,255,255,0.9)',
                            backdropFilter: 'blur(24px)',
                            border: '1px solid',
                            borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                        }
                    }}
                >
                    <DialogTitle sx={{ fontWeight: 800, textAlign: 'center', pt: 4 }}>
                        Biztosan visszavonod?
                    </DialogTitle>
                    <DialogContent sx={{ px: {xs: 2, sm: 4} }}>
                        <Typography variant="body2" mb={3} color="text.secondary" textAlign="center">
                            A jelentkezésed törlésre kerül ebből a munkakörből. Ez a művelet nem vonható vissza.
                        </Typography>
                        <TextField
                            fullWidth
                            label="Indoklás (opcionális)"
                            multiline
                            rows={3}
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            placeholder="Pl. Egyéb elfoglaltság miatt mégsem tudok jönni..."
                            variant="outlined"
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                        />
                    </DialogContent>
                    <DialogActions sx={{ p: 3, pt: 0, justifyContent: 'center', gap: 2 }}>
                        <Button
                            onClick={() => setCancelModalOpen(false)}
                            sx={{ fontWeight: 'bold', color: 'text.secondary' }}
                        >
                            Mégse
                        </Button>
                        <Button
                            onClick={handleConfirmCancel}
                            color="error"
                            variant="contained"
                            disabled={cancelling}
                            disableElevation
                            sx={{ borderRadius: 3, fontWeight: 'bold', px: 3 }}
                        >
                            {cancelling ? 'Feldolgozás...' : 'Visszavonom'}
                        </Button>
                    </DialogActions>
                </Dialog>
            </Container>
        </Fade>
    );
}