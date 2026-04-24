import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Container, Typography, Box, CircularProgress, Alert,
    Button, Avatar, Tabs, Tab, Divider, Paper, IconButton, useTheme, alpha, Tooltip
} from '@mui/material';
import Grid from '@mui/material/Grid';
import axios from 'axios'; // JAVÍTÁS: axios importálása a típusellenőrzéshez

// Ikonok
import EditIcon from '@mui/icons-material/Edit';
import BusinessIcon from '@mui/icons-material/Business';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import GroupIcon from '@mui/icons-material/Group';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import DeleteIcon from '@mui/icons-material/Delete';

import api from '../api/axios';
import EventCard from './EventCard';
import OrganizationSettingsModal from './OrganizationSettingsModal';

// --- TÍPUS DEFINÍCIÓK ---
interface OrganizationData {
    id: number;
    name: string;
    address: string;
    description?: string;
    logoUrl?: string;
    bannerUrl?: string;
    email?: string;
    phone?: string;
    tenantId?: string;
}

interface Shift {
    id: number;
    startTime: string;
    endTime: string;
    maxVolunteers: number;
    currentVolunteers?: number;
}

interface EventData {
    id: number;
    title: string;
    description: string;
    location: string;
    bannerUrl?: string;
    startTime: string;
    endTime: string;
    shifts: Shift[];
    organization?: {
        name: string;
    };
}

interface Membership {
    orgId?: number;
    status: string;
    role?: string;
    orgRole?: string;
}

export default function OrganizationDetails() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const theme = useTheme();

    const [org, setOrg] = useState<OrganizationData | null>(null);
    const [events, setEvents] = useState<EventData[]>([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [currentTab, setCurrentTab] = useState(0);

    const [isLeader, setIsLeader] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);

    // --- BANNER ÁLLAPOTOK ---
    const bannerFileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingBanner, setUploadingBanner] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        setError('');

        console.log(`[DEBUG] 1. Indul a letöltés a(z) ${id}. szervezethez...`);
        console.log(`[DEBUG] Aktuális Tenant a LocalStorage-ben:`, localStorage.getItem('tenantId'));

        try {
            // 1. Szervezet adatainak lekérése (Mester végpont, az axios.ts globalEndpoints miatt nem küld Tenantot)
            console.log(`[DEBUG] 2. /organizations/${id} lekérése...`);
            const orgRes = await api.get(`/organizations/${id}`);
            const currentOrg = orgRes.data;

            if (currentOrg) {
                setOrg(currentOrg);
                console.log(`[DEBUG] 3. Szervezet megtalálva:`, currentOrg.name);

                // Tenant beállítása a következő (esemény) lekérdezésekhez
                const tenantToSet = currentOrg.tenantId || String(currentOrg.id);
                console.log(`[DEBUG] 4. Ezt a Tenant ID-t állítjuk be az eseményekhez:`, tenantToSet);

                localStorage.setItem('tenantId', tenantToSet);
                localStorage.setItem('activeOrgId', String(currentOrg.id));
            } else {
                throw new Error("A backend nem adott vissza adatot a szervezetre.");
            }

            // 2. Események és Felhasználó lekérése párhuzamosan
            console.log(`[DEBUG] 5. /events lekérése (Tenant fejléc már elvileg rajta van)...`);
            const [eventsRes, userRes] = await Promise.all([
                api.get('/events', { params: { orgId: id } }),
                api.get('/users/me')
            ]);

            console.log(`[DEBUG] 6. Események sikeresen letöltve:`, eventsRes.data);
            setEvents(eventsRes.data.content || eventsRes.data || []);

            const user = userRes.data;
            if (user.role === 'SYS_ADMIN') {
                setIsLeader(true);
            } else {
                const membership = user.memberships?.find((m: Membership) => m.orgId === Number(id) && m.status === 'APPROVED');
                if (membership && ['OWNER', 'ORGANIZER'].includes(membership.orgRole || membership.role || '')) {
                    setIsLeader(true);
                }
            }
        } catch (err: unknown) {
            console.error("[DEBUG] 🔥 BUMM! Hiba történt:", err);

            if (axios.isAxiosError(err)) {
                console.error("[DEBUG] 🔥 Hálózati (Axios) hiba. Endpoint:", err.config?.url);
                console.error("[DEBUG] 🔥 Küldött Tenant ID volt:", err.config?.headers?.['X-Tenant-ID']);
                console.error("[DEBUG] 🔥 Backend válasza:", err.response?.data);

                if (err.response?.status === 404) {
                    setError(`A kért adat nem található a backend szerint (404). URL: ${err.config?.url}`);
                } else {
                    setError(err.message || 'Hiba történt a szervezet adatainak betöltésekor.');
                }
            } else if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('Ismeretlen hiba történt az adatok betöltésekor.');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (id) fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const getImageUrl = (url?: string) => {
        if (!url) return undefined;
        return url.startsWith('http') ? url : `http://localhost:8081${url}`;
    };

    // --- BANNER FELTÖLTÉS & TÖRLÉS ---
    const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingBanner(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await api.post(`/organizations/${id}/banner`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setOrg(prev => prev ? { ...prev, bannerUrl: `${response.data.imageUrl}?t=${new Date().getTime()}` } : null);
        } catch (err: unknown) { // JAVÍTÁS
            console.error("Banner upload error:", err);
            alert("Hiba történt a borítókép feltöltésekor.");
        } finally {
            setUploadingBanner(false);
            if (bannerFileInputRef.current) bannerFileInputRef.current.value = '';
        }
    };

    const handleDeleteBanner = async () => {
        if (!window.confirm("Biztosan törölni szeretnéd a szervezeti borítóképet?")) return;
        setUploadingBanner(true);
        try {
            await api.delete(`/organizations/${id}/banner`);
            setOrg(prev => prev ? { ...prev, bannerUrl: undefined } : null);
        } catch (err: unknown) { // JAVÍTÁS
            console.error("Banner delete error:", err);
            alert("Nem sikerült törölni a borítóképet.");
        } finally {
            setUploadingBanner(false);
        }
    };

    const handleCreateEvent = () => {
        navigate('/create-event', { state: { selectedOrgId: org?.id } });
    };

    const handleManageTeam = () => {
        navigate('/team');
    };

    if (loading) return <Box display="flex" justifyContent="center" mt={10}><CircularProgress size={60} /></Box>;
    if (error || !org) return <Container><Alert severity="error" sx={{ mt: 5 }}>{error || "Ismeretlen hiba történt."}</Alert></Container>;

    const activeEvents = events.filter(e => new Date(e.endTime).getTime() >= new Date().getTime());
    const pastEvents = events.filter(e => new Date(e.endTime).getTime() < new Date().getTime());

    return (
        <Container maxWidth="lg" sx={{ mt: { xs: 2, md: 4 }, mb: 10 }}>

            {/* --- PROFIL FEJLÉC --- */}
            <Paper elevation={0} sx={{
                borderRadius: 4,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                overflow: 'hidden',
                mb: 4,
                boxShadow: theme.palette.mode === 'dark' ? '0 10px 30px rgba(0,0,0,0.5)' : '0 10px 30px rgba(0,0,0,0.05)'
            }}>

                {/* BANNER RÉSZ */}
                <Box sx={{
                    height: { xs: 200, md: 300 },
                    width: '100%',
                    backgroundImage: org.bannerUrl
                        ? `url(${getImageUrl(org.bannerUrl)})`
                        : `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.3)} 100%)`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    position: 'relative'
                }}>
                    {isLeader && (
                        <Box sx={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 1 }}>
                            <input type="file" hidden ref={bannerFileInputRef} onChange={handleBannerUpload} accept="image/*" />
                            <Tooltip title={org.bannerUrl ? "Borítókép cseréje" : "Borítókép feltöltése"}>
                                <IconButton
                                    sx={{ bgcolor: 'rgba(0,0,0,0.5)', color: 'white', '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' }, backdropFilter: 'blur(4px)', width: 40, height: 40 }}
                                    onClick={() => bannerFileInputRef.current?.click()}
                                    disabled={uploadingBanner}
                                >
                                    {uploadingBanner ? <CircularProgress size={20} color="inherit" /> : <PhotoCameraIcon fontSize="small" />}
                                </IconButton>
                            </Tooltip>
                            {org.bannerUrl && (
                                <Tooltip title="Borítókép törlése">
                                    <IconButton
                                        sx={{ bgcolor: 'rgba(0,0,0,0.5)', color: 'error.light', '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' }, backdropFilter: 'blur(4px)', width: 40, height: 40 }}
                                        onClick={handleDeleteBanner}
                                        disabled={uploadingBanner}
                                    >
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            )}
                        </Box>
                    )}
                </Box>

                {/* ADATOK SÁVJA */}
                <Box sx={{ px: { xs: 3, md: 5 }, pb: 4, pt: 2, position: 'relative' }}>
                    <Box sx={{
                        display: 'flex',
                        flexDirection: { xs: 'column', md: 'row' },
                        alignItems: { xs: 'center', md: 'flex-end' },
                        gap: { xs: 2, md: 4 },
                        mt: { xs: -8, md: -10 },
                        mb: 2
                    }}>
                        <Avatar
                            src={getImageUrl(org.logoUrl)}
                            sx={{
                                width: { xs: 120, md: 160 },
                                height: { xs: 120, md: 160 },
                                bgcolor: 'background.paper',
                                color: 'primary.main',
                                border: '6px solid',
                                borderColor: 'background.paper',
                                boxShadow: theme.palette.mode === 'dark' ? '0 10px 30px rgba(0,0,0,0.8)' : '0 10px 30px rgba(0,0,0,0.15)',
                                zIndex: 2
                            }}
                        >
                            {!org.logoUrl && <BusinessIcon sx={{ fontSize: 70 }} />}
                        </Avatar>

                        <Box sx={{
                            display: 'flex',
                            flexDirection: { xs: 'column', md: 'row' },
                            flexGrow: 1,
                            width: '100%',
                            gap: 3,
                            alignItems: { xs: 'center', md: 'center' },
                            justifyContent: 'space-between',
                            zIndex: 2,
                            pt: { xs: 0, md: 4 }
                        }}>
                            <Box sx={{ textAlign: { xs: 'center', md: 'left' } }}>
                                <Typography variant="h3" fontWeight="900" color="text.primary" sx={{ letterSpacing: '-1px', mb: 1 }}>
                                    {org.name}
                                </Typography>
                                <Typography variant="body1" color="text.secondary" display="flex" alignItems="center" justifyContent={{ xs: 'center', md: 'flex-start' }} fontWeight="500">
                                    <LocationOnIcon sx={{ fontSize: 20, mr: 0.5, color: 'primary.main' }} />
                                    {org.address || 'Cím nincs megadva'}
                                </Typography>
                            </Box>

                            {isLeader && (
                                <Box sx={{
                                    display: 'flex',
                                    gap: 1.5,
                                    flexWrap: 'wrap',
                                    justifyContent: { xs: 'center', md: 'flex-end' },
                                    flexShrink: 0
                                }}>
                                    <Button
                                        variant="contained"
                                        startIcon={<AddCircleOutlineIcon />}
                                        onClick={handleCreateEvent}
                                        sx={{ borderRadius: 2.5, fontWeight: '800', px: 3, py: 1 }}
                                        disableElevation
                                    >
                                        Új Esemény
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        startIcon={<GroupIcon />}
                                        onClick={handleManageTeam}
                                        sx={{ borderRadius: 2.5, fontWeight: '800', px: 3, py: 1 }}
                                    >
                                        Csapat
                                    </Button>
                                    <Tooltip title="Szervezet adatainak módosítása">
                                        <IconButton
                                            color="primary"
                                            sx={{ border: '1px solid', borderColor: 'primary.main', borderRadius: 2.5, bgcolor: alpha(theme.palette.primary.main, 0.05) }}
                                            onClick={() => setSettingsOpen(true)}
                                        >
                                            <EditIcon />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                            )}
                        </Box>
                    </Box>
                </Box>
            </Paper>

            {/* --- TABS --- */}
            <Tabs
                value={currentTab}
                onChange={(_e, v) => setCurrentTab(v)}
                textColor="primary"
                indicatorColor="primary"
                sx={{ mb: 3, '& .MuiTab-root': { fontWeight: '900', fontSize: '1rem', textTransform: 'none' } }}
            >
                <Tab label={`Aktív Események (${activeEvents.length})`} />
                <Tab label="Rólunk" />
                <Tab label={`Lezárult Események (${pastEvents.length})`} />
            </Tabs>
            <Divider sx={{ mb: 4 }} />

            {/* --- TAB TARTALMAK --- */}
            {currentTab === 0 && (
                <Grid container spacing={3}>
                    {activeEvents.length === 0 ? (
                        <Box width="100%" textAlign="center" py={8}>
                            <Typography color="text.secondary" variant="h6" fontWeight="bold">Jelenleg nincsenek aktív események.</Typography>
                        </Box>
                    ) : (
                        activeEvents.map(event => (
                            <Grid size={{xs: 12, sm: 6, md: 4}} key={event.id}>
                                <EventCard event={event} isLeader={isLeader} />
                            </Grid>
                        ))
                    )}
                </Grid>
            )}

            {currentTab === 1 && (
                <Paper elevation={0} sx={{ p: 5, borderRadius: 4, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="h5" fontWeight="900" color="primary" mb={3}>A Szervezetről</Typography>
                    <Typography variant="body1" color="text.primary" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.9, fontSize: '1.1rem' }}>
                        {org.description || 'A szervezet még nem adott meg bemutatkozó szöveget.'}
                    </Typography>
                </Paper>
            )}

            {currentTab === 2 && (
                <Grid container spacing={3}>
                    {pastEvents.length === 0 ? (
                        <Box width="100%" textAlign="center" py={8}>
                            <Typography color="text.secondary" variant="h6" fontWeight="bold">Nincsenek még lezárult események.</Typography>
                        </Box>
                    ) : (
                        pastEvents.map(event => (
                            <Grid size={{xs: 12, sm: 6, md: 4}} key={event.id} sx={{ opacity: 0.75, transition: '0.3s', '&:hover': { opacity: 1 } }}>
                                <EventCard event={event} isLeader={isLeader} />
                            </Grid>
                        ))
                    )}
                </Grid>
            )}

            {/* MODAL */}
            {settingsOpen && (
                <OrganizationSettingsModal
                    open={settingsOpen}
                    onClose={() => setSettingsOpen(false)}
                    organization={org}
                    onUpdateSuccess={fetchData}
                />
            )}
        </Container>
    );
}