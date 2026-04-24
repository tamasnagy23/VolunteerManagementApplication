import { useEffect, useState, useMemo } from 'react';
import {
    Container, Typography, Box, Button,
    AppBar, Toolbar, Dialog, DialogTitle, DialogContent,
    DialogActions, IconButton, TextField, InputAdornment,
    FormControl, Select, MenuItem, Tabs, Tab, Chip, Paper, Fade, useTheme, alpha, Tooltip
} from '@mui/material';
import Grid from '@mui/material/Grid';
import CloseIcon from '@mui/icons-material/Close';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import AppRegistrationIcon from '@mui/icons-material/AppRegistration';
import LoginIcon from '@mui/icons-material/Login';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import LoadingScreen from "./LoadingScreen.tsx";

import api from '../api/axios';
import EventCard from './EventCard';
import { useNavigate } from 'react-router-dom';

// JAVÍTÁS: Behozzuk a központi Theme Context-et
import { useThemeToggle } from '../theme/ThemeContextProvider';

// --- BŐVÍTETT INTERFÉSZEK ---
interface Shift { id: number; startTime: string; endTime: string; maxVolunteers: number; currentVolunteers?: number; }
interface Event {
    id: number;
    title: string;
    description: string;
    location: string;
    startTime: string;
    endTime: string;
    applicationDeadline?: string;
    isRegistrationOpen: boolean;
    shifts: Shift[];
    organization?: { id: number; name: string; tenantId?: string; };
}

export default function PublicEventWall() {
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);

    // Téma hook használata
    const theme = useTheme();
    const { isDarkMode, toggleTheme } = useThemeToggle();

    // --- SZŰRŐK ÉS TABOK ---
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedOrg, setSelectedOrg] = useState<string | number>('all');
    const [tabValue, setTabValue] = useState(0);

    // MODAL ÁLLAPOTOK
    const [loginModalOpen, setLoginModalOpen] = useState(false);
    const [selectedEventId, setSelectedEventId] = useState<number | null>(null);

    const navigate = useNavigate();

    useEffect(() => {
        api.get('/events/public')
            .then(res => setEvents(res.data.content || []))
            .catch(err => console.error("Hiba a kirakat betöltésekor", err))
            .finally(() => setLoading(false));
    }, []);

    const uniqueOrganizations = useMemo(() => {
        const orgs = events.map(e => e.organization).filter(org => org !== undefined) as { id: number; name: string }[];
        const unique = new Map();
        orgs.forEach(org => unique.set(org.id, org));
        return Array.from(unique.values());
    }, [events]);

    const filteredEvents = useMemo(() => {
        return events.filter(e => {
            const matchesSearch = e.title.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesOrg = selectedOrg === 'all' || e.organization?.id === selectedOrg;
            return matchesSearch && matchesOrg;
        });
    }, [events, searchTerm, selectedOrg]);

    const upcomingEvents = useMemo(() => {
        const now = new Date().getTime();
        return filteredEvents.filter(e => new Date(e.startTime).getTime() > now);
    }, [filteredEvents]);

    const pastEvents = useMemo(() => {
        const now = new Date().getTime();
        return filteredEvents.filter(e => new Date(e.startTime).getTime() <= now);
    }, [filteredEvents]);

    const displayEvents = tabValue === 0 ? upcomingEvents : pastEvents;

    const isRegistrationClosed = (event: Event) => {
        if (!event.isRegistrationOpen) return true;
        if (event.applicationDeadline) {
            const deadline = new Date(event.applicationDeadline).getTime();
            const now = new Date().getTime();
            if (now > deadline) return true;
        }
        return false;
    };

    if (loading) return <LoadingScreen />;

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

                {/* --- FELSŐ NAVBAR (Glassmorphism) --- */}
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
                            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                        >
                            VOLUNTEER<Box component="span" sx={{ color: isDarkMode ? 'white' : 'text.primary' }}>APP</Box>
                        </Typography>

                        <Box display="flex" alignItems="center" gap={1.5}>
                            {/* JAVÍTÁS: Téma-váltó Gomb + Tooltip */}
                            <Tooltip title={isDarkMode ? "Világos módra váltás" : "Sötét módra váltás"}>
                                <IconButton
                                    onClick={toggleTheme}
                                    color="inherit"
                                    sx={{ transition: 'transform 0.4s', '&:hover': { transform: 'rotate(180deg)' } }}
                                >
                                    <Brightness4Icon />
                                </IconButton>
                            </Tooltip>

                            <Button
                                color="inherit"
                                sx={{ fontWeight: 'bold', display: { xs: 'none', sm: 'flex' }, opacity: 0.8, '&:hover': { opacity: 1 } }}
                                onClick={() => navigate('/register')}
                            >
                                Regisztráció
                            </Button>
                            <Button
                                variant="contained"
                                color="primary"
                                disableElevation
                                onClick={() => navigate('/login')}
                                sx={{
                                    borderRadius: 2.5,
                                    fontWeight: 'bold',
                                    px: 3,
                                    background: isDarkMode ? 'linear-gradient(135deg, #818cf8 0%, #4f46e5 100%)' : 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                                    boxShadow: isDarkMode ? '0 4px 15px rgba(129, 140, 248, 0.3)' : '0 4px 15px rgba(25, 118, 210, 0.3)',
                                }}
                            >
                                Bejelentkezés
                            </Button>
                        </Box>
                    </Toolbar>
                </AppBar>

                <Container maxWidth="lg" sx={{ mt: { xs: 4, md: 8 }, mb: 10, flexGrow: 1 }}>
                    {/* --- CÍMSOR RÉSZ --- */}
                    <Box textAlign="center" mb={6}>
                        <Typography variant="h3" fontWeight="900" color="text.primary" sx={{ fontSize: { xs: '2.4rem', md: '3.8rem' }, letterSpacing: '-1px', mb: 2 }}>
                            Fedezz fel új lehetőségeket!
                        </Typography>
                        <Typography variant="h6" color="text.secondary" sx={{ maxWidth: '600px', mx: 'auto', fontWeight: 500, lineHeight: 1.6 }}>
                            Böngéssz a közelgő események között, és csatlakozz a legjobb önkéntes csapatokhoz.
                        </Typography>
                    </Box>

                    {/* --- KERESŐ ÉS SZŰRŐ SÁV (Üveghatású panel) --- */}
                    {events.length > 0 && (
                        <Paper elevation={0} sx={{
                            p: 2,
                            borderRadius: 4,
                            mb: 5,
                            display: 'flex',
                            flexDirection: { xs: 'column', sm: 'row' },
                            gap: 2,
                            bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.8)',
                            backdropFilter: 'blur(20px)',
                            border: '1px solid',
                            borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.6)',
                            boxShadow: isDarkMode ? '0 10px 30px rgba(0,0,0,0.4)' : '0 10px 30px rgba(0,0,0,0.05)'
                        }}>
                            <TextField
                                fullWidth
                                placeholder="Keresés esemény nevére..."
                                variant="outlined"
                                size="small"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                InputProps={{
                                    startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment>,
                                    sx: { bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : '#f8fafc', borderRadius: 3 }
                                }}
                            />
                            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: '280px' } }}>
                                <Select
                                    value={selectedOrg}
                                    onChange={(e) => setSelectedOrg(e.target.value)}
                                    displayEmpty
                                    sx={{ bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : '#f8fafc', borderRadius: 3 }}
                                    startAdornment={<InputAdornment position="start"><FilterListIcon color="action" sx={{ ml: 1 }} /></InputAdornment>}
                                >
                                    <MenuItem value="all"><em>Minden Szervezet</em></MenuItem>
                                    {uniqueOrganizations.map(org => (
                                        <MenuItem key={org.id} value={org.id}>{org.name}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Paper>
                    )}

                    {/* --- FÜLEK (TABOK) --- */}
                    {events.length > 0 && (
                        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 5 }}>
                            <Tabs
                                value={tabValue}
                                onChange={(_, newValue) => setTabValue(newValue)}
                                textColor="primary"
                                indicatorColor="primary"
                                variant="fullWidth"
                                TabIndicatorProps={{ sx: { height: 3, borderTopLeftRadius: 3, borderTopRightRadius: 3 } }}
                            >
                                <Tab label={`Közelgő Események (${upcomingEvents.length})`} sx={{ fontWeight: '900', fontSize: '1.05rem', textTransform: 'none' }} />
                                <Tab label={`Zajló / Lezárult (${pastEvents.length})`} sx={{ fontWeight: '900', fontSize: '1.05rem', textTransform: 'none' }} />
                            </Tabs>
                        </Box>
                    )}

                    {/* --- ESEMÉNYEK LISTÁZÁSA --- */}
                    {events.length === 0 ? (
                        <Paper elevation={0} sx={{ textAlign: 'center', py: 10, borderRadius: 5, bgcolor: isDarkMode ? 'rgba(30,41,59,0.5)' : 'rgba(255,255,255,0.5)', border: '1px dashed', borderColor: 'divider' }}>
                            <EventBusyIcon sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
                            <Typography variant="h6" color="text.secondary" fontWeight="bold">Jelenleg nincs egyetlen publikus esemény sem a rendszerben.</Typography>
                        </Paper>
                    ) : displayEvents.length === 0 ? (
                        <Box textAlign="center" py={8}>
                            <Typography variant="h6" color="text.secondary" fontWeight="500">Nincs a szűrésnek megfelelő esemény ebben a kategóriában.</Typography>
                        </Box>
                    ) : (
                        <Grid container spacing={4}>
                            {displayEvents.map((event: Event) => {
                                const closed = isRegistrationClosed(event);
                                return (
                                    <Grid size={{ xs: 12, sm: 6, md: 4 }} key={event.id} sx={{ position: 'relative' }}>

                                        {/* VIZUÁLIS JELZÉS, HA LE VAN ZÁRVA A JELENTKEZÉS */}
                                        {closed && (
                                            <Chip
                                                icon={<EventBusyIcon fontSize="small" />}
                                                label="Jelentkezés Lezárva"
                                                color="error"
                                                sx={{
                                                    position: 'absolute', top: 20, right: 10, zIndex: 2,
                                                    fontWeight: '900', boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                                                    border: '2px solid white'
                                                }}
                                            />
                                        )}

                                        <Box sx={{ opacity: closed ? 0.75 : 1, transition: '0.3s', '&:hover': { opacity: 1 } }}>
                                            <EventCard
                                                event={event}
                                                isLeader={false}
                                                onClick={() => {
                                                    if (event.organization?.tenantId) {
                                                        localStorage.setItem('tenantId', event.organization.tenantId);
                                                        localStorage.setItem('activeOrgId', event.organization.id.toString());
                                                    }
                                                    const token = localStorage.getItem('token');
                                                    if (token) navigate(`/events/${event.id}`);
                                                    else {
                                                        setSelectedEventId(event.id);
                                                        setLoginModalOpen(true);
                                                    }
                                                }}
                                            />
                                        </Box>
                                    </Grid>
                                );
                            })}
                        </Grid>
                    )}
                </Container>

                {/* --- BEJELENTKEZÉS / REGISZTRÁCIÓ MODAL (Glassmorphism) --- */}
                <Dialog
                    open={loginModalOpen}
                    onClose={() => setLoginModalOpen(false)}
                    maxWidth="xs"
                    fullWidth
                    PaperProps={{ sx: {
                            borderRadius: 5, p: 1,
                            bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.95)' : 'white',
                            backdropFilter: 'blur(20px)',
                            border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider'
                        } }}
                >
                    <DialogTitle sx={{ display: 'flex', justifyContent: 'flex-end', pb: 0 }}>
                        <IconButton size="small" onClick={() => setLoginModalOpen(false)} sx={{ bgcolor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'action.hover' }}><CloseIcon /></IconButton>
                    </DialogTitle>
                    <DialogContent sx={{ textAlign: 'center', px: { xs: 3, sm: 4 }, pb: 2 }}>
                        {/* JAVÍTÁS: A kis háttér a lakat alatt fix 80x80-as kör lett */}
                        <Box display="flex" justifyContent="center" mb={2}>
                            <Box sx={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: 80, height: 80,
                                bgcolor: alpha(theme.palette.warning.main, 0.15),
                                borderRadius: '50%'
                            }}>
                                <LockOutlinedIcon sx={{ fontSize: 45, color: 'warning.main' }} />
                            </Box>
                        </Box>
                        <Typography variant="h5" fontWeight="900" gutterBottom color="text.primary">Lépj be a folytatáshoz</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, lineHeight: 1.6 }}>
                            Az esemény megtekintéséhez és a jelentkezéshez kérlek jelentkezz be, vagy hozz létre egy új fiókot!
                        </Typography>
                    </DialogContent>
                    <DialogActions sx={{ flexDirection: 'column', gap: 1.5, px: { xs: 3, sm: 4 }, pb: 4 }}>
                        <Button
                            variant="contained"
                            color="primary"
                            fullWidth
                            size="large"
                            startIcon={<LoginIcon />}
                            sx={{ borderRadius: 3, py: 1.5, fontWeight: '900', m: '0 !important', background: isDarkMode ? 'linear-gradient(135deg, #818cf8 0%, #4f46e5 100%)' : 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)' }}
                            disableElevation
                            onClick={() => navigate('/login', { state: { from: `/events/${selectedEventId}` } })}
                        >
                            Bejelentkezés
                        </Button>
                        <Button
                            variant="outlined"
                            color="primary"
                            fullWidth
                            size="large"
                            startIcon={<AppRegistrationIcon />}
                            sx={{ borderRadius: 3, py: 1.5, fontWeight: '900', m: '0 !important', borderWidth: 2, '&:hover': { borderWidth: 2 } }}
                            onClick={() => navigate('/register', { state: { from: `/events/${selectedEventId}` } })}
                        >
                            Új fiók létrehozása
                        </Button>
                    </DialogActions>
                </Dialog>
            </Box>
        </Fade>
    );
}