import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Container, Typography, Box, Paper, Button, CircularProgress,
    Alert, Divider, Dialog, DialogTitle, DialogContent,
    DialogActions, FormControlLabel, Checkbox, TextField,
    FormControl, InputLabel, Select, MenuItem, FormGroup,
    useTheme, Chip, IconButton, Tooltip, Fade, alpha,
    Tabs, Tab, Avatar, Snackbar
} from '@mui/material';
import Grid from '@mui/material/Grid';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import DeleteIcon from '@mui/icons-material/Delete';
import RestoreIcon from '@mui/icons-material/Restore';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import EditIcon from "@mui/icons-material/Edit";
import EventBusyIcon from '@mui/icons-material/EventBusy';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import BusinessIcon from '@mui/icons-material/Business';
import AddIcon from '@mui/icons-material/Add';
import PhoneIcon from '@mui/icons-material/Phone';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EmailIcon from '@mui/icons-material/Email';

import api from '../api/axios';
import axios from 'axios';
import LoadingScreen from "./LoadingScreen.tsx";
import { useThemeToggle } from '../theme/ThemeContextProvider';

// --- INTERFÉSZEK ---
interface EventQuestion {
    id: number;
    questionText: string;
    questionType: 'TEXT' | 'DROPDOWN' | 'CHECKBOX';
    options: string;
    isRequired: boolean;
}

interface WorkArea {
    id: number;
    name: string;
    description: string;
    capacity: number;
}

interface EventData {
    id: number;
    title: string;
    description: string;
    location: string;
    startTime: string;
    endTime: string;
    applicationDeadline?: string;
    isRegistrationOpen?: boolean;
    bannerUrl?: string;
    workAreas: WorkArea[];
    questions: EventQuestion[];
    organization: { name: string };
}

interface UserApplication {
    id: number;
    eventId?: number;
    orgName: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
    workAreaName: string;
    rejectionMessage?: string;
}

interface EventPermissions {
    globalAdmin: boolean;
    eventRole: string | null;
    permissions: string[];
    coordinatedWorkAreas: number[];
}

interface Membership {
    orgId?: number;
    organization?: { id: number; name: string };
    status: string;
}

interface EventContact {
    name: string;
    role: string;
    workAreaName: string;
    phone: string;
    email: string;
    avatar: string | null;
}

const stringToColor = (string: string) => {
    let hash = 0;
    for (let i = 0; i < string.length; i += 1) {
        hash = string.charCodeAt(i) + ((hash << 5) - hash);
    }
    let color = '#';
    for (let i = 0; i < 3; i += 1) {
        const value = (hash >> (i * 8)) & 0xff;
        color += `00${value.toString(16)}`.slice(-2);
    }
    return color;
};

export default function EventDetails() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const theme = useTheme();
    const { isDarkMode } = useThemeToggle();

    const [event, setEvent] = useState<EventData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [myApplications, setMyApplications] = useState<UserApplication[]>([]);
    const [permissions, setPermissions] = useState<EventPermissions | null>(null);
    const [contacts, setContacts] = useState<EventContact[]>([]);
    const [tabIndex, setTabIndex] = useState(0);

    const [membershipStatus, setMembershipStatus] = useState<string | null>('NONE');
    const [joining, setJoining] = useState(false);

    const [openModal, setOpenModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [selectedWorkAreas, setSelectedWorkAreas] = useState<number[]>([]);
    const [answers, setAnswers] = useState<Record<number, string | string[]>>({});

    const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
    const [withdrawAppId, setWithdrawAppId] = useState<number | null>(null);
    const [withdrawReason, setWithdrawReason] = useState('');
    const [withdrawing, setWithdrawing] = useState(false);

    const bannerFileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingBanner, setUploadingBanner] = useState(false);

    const [toastOpen, setToastOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState('');

    const [callDialogOpen, setCallDialogOpen] = useState(false);
    const [contactToCall, setContactToCall] = useState<EventContact | null>(null);

    useEffect(() => {
        if (id) {
            const fetchData = async () => {
                try {
                    const [evRes, appRes, permRes, userRes, contactsRes] = await Promise.all([
                        api.get(`/events/${id}`),
                        api.get('/applications/my'),
                        api.get(`/events/${id}/my-permissions`).catch(() => ({ data: null })),
                        api.get('/users/me'),
                        api.get(`/events/${id}/contacts`).catch(() => ({ data: [] }))
                    ]);

                    setEvent(evRes.data);
                    setMyApplications(appRes.data.filter((a: UserApplication) => a.eventId === Number(id)));
                    setPermissions(permRes.data);
                    setContacts(contactsRes.data);

                    const activeOrgId = localStorage.getItem('activeOrgId');
                    const membership = userRes.data.memberships?.find((m: Membership) => m.orgId === Number(activeOrgId));
                    if (membership) setMembershipStatus(membership.status);
                    if (userRes.data.role === 'SYS_ADMIN') setMembershipStatus('APPROVED');

                    const initialAns: Record<number, string | string[]> = {};
                    evRes.data.questions?.forEach((q: EventQuestion) => {
                        initialAns[q.id] = q.questionType === 'CHECKBOX' ? [] : '';
                    });
                    setAnswers(initialAns);
                } catch {
                    setError("Hiba történt az adatok betöltésekor.");
                } finally {
                    setLoading(false);
                }
            };
            fetchData();
        }
    }, [id]);

    const getBannerUrl = () => {
        if (!event?.bannerUrl) return undefined;
        const backendBaseUrl = 'http://localhost:8081';
        return event.bannerUrl.startsWith('http') ? event.bannerUrl : `${backendBaseUrl}${event.bannerUrl}`;
    };

    const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingBanner(true);
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await api.post(`/events/${id}/banner`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            setEvent(prev => prev ? { ...prev, bannerUrl: `${res.data.imageUrl}?t=${new Date().getTime()}` } : null);
        } catch {
            setError("Sikertelen képfeltöltés.");
        } finally {
            setUploadingBanner(false);
        }
    };

    const handleDeleteBanner = async () => {
        if (!window.confirm("Borítókép törlése?")) return;
        try {
            await api.delete(`/events/${id}/banner`);
            setEvent(prev => prev ? { ...prev, bannerUrl: undefined } : null);
        } catch {
            setError("Hiba a borítókép törlésekor.");
        }
    };

    const handleDeleteEvent = async () => {
        if (window.confirm('Biztosan törlöd a teljes eseményt? Ez a művelet nem vonható vissza!')) {
            try {
                await api.delete(`/events/${id}`);
                navigate('/dashboard');
            } catch {
                setError("Hiba az esemény törlésekor.");
            }
        }
    };

    const handleJoinOrg = async () => {
        const activeOrgId = localStorage.getItem('activeOrgId');
        if (!activeOrgId) return;
        setJoining(true);
        try {
            await api.post(`/organizations/${activeOrgId}/join`);
            setMembershipStatus('PENDING');
            setToastMessage("A csatlakozási kérelmet elküldtük!");
            setToastOpen(true);
        } catch {
            setError("Hiba a csatlakozás során.");
        } finally {
            setJoining(false);
        }
    };

    const handleWithdrawClick = (applicationId: number) => {
        setWithdrawAppId(applicationId);
        setWithdrawReason('');
        setWithdrawModalOpen(true);
    };

    const confirmWithdraw = async () => {
        if (!withdrawAppId) return;
        setWithdrawing(true);
        try {
            await api.delete(`/applications/${withdrawAppId}`, { params: { reason: withdrawReason } });
            setWithdrawModalOpen(false);
            const res = await api.get('/applications/my');
            setMyApplications(res.data.filter((a: UserApplication) => a.eventId === Number(id)));
        } catch {
            setError("Hiba a visszavonáskor.");
        } finally {
            setWithdrawing(false);
        }
    };

    const handleReApply = async (applicationId: number) => {
        try {
            await api.put(`/applications/${applicationId}/status`, null, { params: { status: 'PENDING' } });
            const res = await api.get('/applications/my');
            setMyApplications(res.data.filter((a: UserApplication) => a.eventId === Number(id)));
        } catch {
            setError("Hiba a visszajelentkezéskor.");
        }
    };

    const handleWorkAreaToggle = (areaId: number) => {
        setSelectedWorkAreas(prev => prev.includes(areaId) ? prev.filter(aId => aId !== areaId) : [...prev, areaId]);
    };

    const handleAnswerChange = (questionId: number, value: string | string[]) => {
        setAnswers(prev => ({ ...prev, [questionId]: value }));
    };

    const handleCheckboxAnswerToggle = (questionId: number, option: string) => {
        setAnswers(prev => {
            const current = (prev[questionId] as string[]) || [];
            const updated = current.includes(option) ? current.filter(i => i !== option) : [...current, option];
            return { ...prev, [questionId]: updated };
        });
    };

    const handleSubmitApplication = async () => {
        if (selectedWorkAreas.length === 0) {
            setToastMessage("Válassz legalább egy ÚJ területet!");
            setToastOpen(true);
            return;
        }

        for (const q of event?.questions || []) {
            if (q.isRequired) {
                const answer = answers[q.id];
                if (!answer || (Array.isArray(answer) && answer.length === 0)) {
                    setToastMessage(`A(z) "${q.questionText}" kérdés megválaszolása kötelező!`);
                    setToastOpen(true);
                    return;
                }
            }
        }

        setSubmitting(true);
        try {
            const formattedAnswers: Record<number, string> = {};
            Object.keys(answers).forEach(key => {
                const numKey = Number(key);
                formattedAnswers[numKey] = Array.isArray(answers[numKey])
                    ? (answers[numKey] as string[]).join(', ')
                    : (answers[numKey] as string);
            });
            await api.post('/applications', { eventId: Number(id), preferredWorkAreaIds: selectedWorkAreas, answers: formattedAnswers });

            setSelectedWorkAreas([]);
            setOpenModal(false);

            const res = await api.get('/applications/my');
            setMyApplications(res.data.filter((a: UserApplication) => a.eventId === Number(id)));

            setToastMessage("Sikeres jelentkezés leadva! 🎉");
            setToastOpen(true);
        } catch (err: unknown) {
            if (axios.isAxiosError(err)) {
                setError(err.response?.data || "Hiba a jelentkezéskor.");
            } else {
                setError("Ismeretlen hiba történt a jelentkezés során.");
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleCopyPhone = (phone: string) => {
        navigator.clipboard.writeText(phone);
        setToastMessage('Telefonszám sikeresen a vágólapra másolva! 📋');
        setToastOpen(true);
    };

    const handleCallClick = (contact: EventContact) => {
        setContactToCall(contact);
        setCallDialogOpen(true);
    };

    const executeCall = () => {
        if (contactToCall) {
            window.location.href = `tel:${contactToCall.phone}`;
        }
        setCallDialogOpen(false);
    };

    const sortedWorkAreas = useMemo(() => event?.workAreas ? [...event.workAreas].sort((a, b) => a.name.localeCompare(b.name, 'hu')) : [], [event]);

    const isClosed = useMemo(() => {
        if (!event) return false;
        if (event.isRegistrationOpen === false) return true;
        if (event.applicationDeadline) return new Date().getTime() > new Date(event.applicationDeadline).getTime();
        return false;
    }, [event]);

    const alreadyAppliedAreaIds = useMemo(() => {
        if (!event || !myApplications) return [];
        const activeApps = myApplications.filter(a => a.status !== 'WITHDRAWN' && a.status !== 'REJECTED');
        const appliedNames = activeApps.map(a => a.workAreaName);
        return event.workAreas.filter(wa => appliedNames.includes(wa.name)).map(wa => wa.id);
    }, [myApplications, event]);

    const renderActionZone = () => {
        const isOrganizerOrAdmin = permissions?.globalAdmin || permissions?.eventRole === 'ORGANIZER';
        const isCoordinator = permissions?.eventRole === 'COORDINATOR';

        const hasActiveApp = myApplications.some(app => app.status !== 'WITHDRAWN' && app.status !== 'REJECTED');
        const canApply = membershipStatus === 'APPROVED' || permissions?.globalAdmin;

        // JAVÍTÁS: 1. Először ellenőrizzük, hogy szervező/koordinátor-e az illető!
        if (isOrganizerOrAdmin || isCoordinator) {
            const btnLabel = isOrganizerOrAdmin ? 'Csapat Menedzselése' : 'Beosztások Kezelése';
            const btnPath = isOrganizerOrAdmin ? `/events/${id}/team` : `/events/${id}/shifts`;
            const purpleColor = isDarkMode ? '#c084fc' : '#9333ea';

            return (
                <Button
                    size="large" startIcon={<ManageAccountsIcon />} onClick={() => navigate(btnPath)}
                    sx={{
                        py: 1.8, fontWeight: '900', borderRadius: 3, width: '100%',
                        bgcolor: alpha(purpleColor, 0.08),
                        border: '1px solid', borderColor: alpha(purpleColor, 0.3),
                        color: purpleColor,
                        boxShadow: 'none',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        '&:hover': {
                            bgcolor: alpha(purpleColor, 0.15),
                            borderColor: purpleColor,
                            transform: 'translateY(-2px)',
                            boxShadow: `0 8px 20px ${alpha(purpleColor, 0.15)}`
                        }
                    }}
                >
                    {btnLabel}
                </Button>
            );
        }

        // JAVÍTÁS: 2. Csak a fenti szervezői ellenőrzés után nézzük meg, hogy le van-e zárva (ez már csak az önkéntesekre hat)
        if (isClosed) {
            return <Button variant="contained" color="error" size="large" startIcon={<EventBusyIcon />} disabled sx={{ py: 1.8, fontWeight: '900', borderRadius: 3, width: '100%' }}>Lezárva</Button>;
        }

        // 3. Ha nincs lezárva, és sima önkéntes
        if (canApply) {
            if (hasActiveApp) {
                return (
                    <Button
                        variant="outlined" size="large" startIcon={<AddIcon />} onClick={() => setOpenModal(true)}
                        sx={{
                            py: 1.8, fontWeight: '900', borderRadius: 3, width: '100%', borderWidth: 2,
                            transition: 'transform 0.2s', '&:hover': { transform: 'scale(1.02)', borderWidth: 2 }
                        }}
                    >
                        Új terület megjelölése
                    </Button>
                );
            } else {
                return (
                    <Button
                        variant="contained" size="large" startIcon={<HowToRegIcon />} onClick={() => setOpenModal(true)}
                        sx={{
                            py: 1.8, fontWeight: '900', borderRadius: 3, width: '100%',
                            background: isDarkMode ? 'linear-gradient(135deg, #818cf8 0%, #4f46e5 100%)' : 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                            boxShadow: isDarkMode ? '0 10px 30px rgba(129, 140, 248, 0.4)' : '0 10px 30px rgba(25, 118, 210, 0.3)',
                            transition: 'transform 0.2s', '&:hover': { transform: 'scale(1.02)' }
                        }}
                    >
                        Jelentkezem!
                    </Button>
                );
            }
        }

        // 4. Ha még nem tagja a szervezetnek
        return (
            <Box sx={{ width: '100%' }}>
                {membershipStatus === 'PENDING' ? (
                    <Button variant="contained" disabled sx={{ py: 1.8, fontWeight: '900', borderRadius: 3, bgcolor: '#ffe0b2', color: '#e65100', width: '100%' }}>
                        Kérelem elbírálás alatt...
                    </Button>
                ) : membershipStatus === 'REJECTED' ? (
                    <Button variant="outlined" color="error" disabled sx={{ py: 1.8, fontWeight: '900', borderRadius: 3, width: '100%' }}>
                        Elutasítva
                    </Button>
                ) : (
                    <Button variant="contained" color="warning" onClick={handleJoinOrg} disabled={joining} sx={{ py: 1.8, fontWeight: '900', borderRadius: 3, width: '100%', boxShadow: '0 8px 20px rgba(245, 158, 11, 0.4)' }}>
                        {joining ? 'Csatlakozás...' : 'Előbb Csatlakozz a Szervezethez!'}
                    </Button>
                )}
            </Box>
        );
    };

    if (loading) return <LoadingScreen />;
    if (!event) return <Container><Alert severity="error">Esemény nem található.</Alert></Container>;

    const canManageApps = permissions?.globalAdmin || permissions?.eventRole === 'ORGANIZER' || permissions?.permissions?.includes('MANAGE_APPLICATIONS');
    const canManageShifts = permissions?.globalAdmin || permissions?.eventRole === 'ORGANIZER' || permissions?.permissions?.includes('MANAGE_SHIFTS') || (permissions?.coordinatedWorkAreas && permissions.coordinatedWorkAreas.length > 0);
    const hasAnyAdmin = permissions?.globalAdmin || permissions?.eventRole === 'ORGANIZER' || canManageApps || canManageShifts;

    const sidebarTools = [
        { label: 'Jelentkezők', icon: <FormatListBulletedIcon />, path: `/events/${id}/applications`, color: theme.palette.secondary.main, show: canManageApps },
        { label: 'Naptár & Beosztás', icon: <CalendarMonthIcon />, path: `/events/${id}/shifts`, color: theme.palette.info.main, show: canManageShifts && permissions?.eventRole !== 'COORDINATOR' }
    ].filter(tool => tool.show);

    return (
        <>
            <Fade in timeout={600}>
                <Box sx={{ pb: 10 }}>
                    {/* --- 1. FULL WIDTH BANNER --- */}
                    <Box sx={{
                        width: '100vw', position: 'relative', left: '50%', right: '50%', marginLeft: '-50vw', marginRight: '-50vw',
                        height: { xs: 280, md: 420 }, backgroundColor: isDarkMode ? '#0f172a' : '#e3f2fd',
                        backgroundImage: event.bannerUrl ? `url(${getBannerUrl()})` : (isDarkMode ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' : 'linear-gradient(135deg, #1976d2 10%, #1565c0 100%)'),
                        backgroundSize: 'cover', backgroundPosition: 'center'
                    }}>

                        {hasAnyAdmin && (
                            <Box sx={{ position: 'absolute', top: 20, right: { xs: 20, md: 'calc(50vw - 580px)' }, display: 'flex', gap: 1 }}>
                                <Tooltip title={event.bannerUrl ? 'Borítókép cseréje' : 'Borítókép feltöltése'}>
                                    <IconButton onClick={() => bannerFileInputRef.current?.click()} sx={{ bgcolor: 'rgba(0,0,0,0.5)', color: 'white', backdropFilter: 'blur(10px)', width: 44, height: 44 }}>
                                        {uploadingBanner ? <CircularProgress size={20} color="inherit" /> : <PhotoCameraIcon />}
                                        <input type="file" ref={bannerFileInputRef} hidden onChange={handleBannerUpload} />
                                    </IconButton>
                                </Tooltip>
                                {event.bannerUrl && (
                                    <Tooltip title="Borítókép törlése">
                                        <IconButton color="error" onClick={handleDeleteBanner} sx={{ bgcolor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', width: 44, height: 44 }}><DeleteIcon /></IconButton>
                                    </Tooltip>
                                )}
                            </Box>
                        )}
                    </Box>

                    {/* --- 2. HERO CARD WITH ALIGNED BUTTONS --- */}
                    <Container maxWidth="lg" sx={{ mt: -8, position: 'relative', zIndex: 10 }}>
                        <Paper sx={{
                            p: { xs: 3, md: 5 }, borderRadius: 6, backdropFilter: 'blur(25px)', border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.5)',
                            bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                            display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: 'center', gap: 4
                        }}>
                            <Box sx={{ flex: 1, width: '100%' }}>
                                <Chip icon={<BusinessIcon sx={{ fontSize: 16 }} />} label={event.organization.name} size="small" sx={{ mb: 2, fontWeight: 'bold', bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', border: 'none' }} />
                                <Typography variant="h3" fontWeight="900" letterSpacing="-1.5px" sx={{ fontSize: { xs: '2.2rem', md: '3.2rem' }, color: 'text.primary' }}>{event.title}</Typography>
                                <Box display="flex" flexWrap="wrap" gap={3} mt={2.5}>
                                    <Box display="flex" alignItems="center" gap={0.8} sx={{ color: 'text.secondary' }}><LocationOnIcon fontSize="small" color="primary" /><Typography variant="body2" fontWeight="700">{event.location}</Typography></Box>
                                    <Box display="flex" alignItems="center" gap={0.8} sx={{ color: 'text.secondary' }}><AccessTimeIcon fontSize="small" color="primary" /><Typography variant="body2" fontWeight="700">{new Date(event.startTime).toLocaleDateString('hu-HU')}</Typography></Box>
                                </Box>
                            </Box>

                            <Box sx={{ width: { xs: '100%', md: 340 }, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                {renderActionZone()}
                                {(permissions?.globalAdmin || permissions?.eventRole === 'ORGANIZER') && (
                                    <Box sx={{ display: 'flex', gap: 1.5, width: '100%' }}>
                                        <Button sx={{ flex: 1, borderRadius: 2, py: 1, fontWeight: 'bold', bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'white' }} size="small" variant="outlined" color="primary" onClick={() => navigate(`/edit-event/${id}`)} startIcon={<EditIcon />}>Szerkesztés</Button>
                                        <Button sx={{ flex: 1, borderRadius: 2, py: 1, fontWeight: 'bold', bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'white' }} size="small" variant="outlined" color="error" onClick={handleDeleteEvent} startIcon={<DeleteIcon />}>Törlés</Button>
                                    </Box>
                                )}
                            </Box>
                        </Paper>

                        {error && <Alert severity="error" sx={{ mt: 3, borderRadius: 3 }}>{error}</Alert>}

                        {/* --- KÉT OSZLOPOS ELRENDEZÉS --- */}
                        <Grid container spacing={4} mt={3}>

                            {/* BAL OSZLOP: Információk és Kapcsolatok (TABS) */}
                            <Grid size={{ xs: 12, md: 7, lg: 8 }}>
                                <Box sx={{ borderBottom: 1, borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider', mb: 3 }}>
                                    <Tabs value={tabIndex} onChange={(_, v) => setTabIndex(v)} textColor="primary" indicatorColor="primary">
                                        <Tab label="Információk" sx={{ fontWeight: 'bold', fontSize: '1.05rem' }} />
                                        <Tab label="Elérhetőségek" sx={{ fontWeight: 'bold', fontSize: '1.05rem' }} />
                                    </Tabs>
                                </Box>

                                {/* 1. FÜL: LEÍRÁS ÉS MUNKATERÜLETEK */}
                                {tabIndex === 0 && (
                                    <Box>
                                        <Box mb={6}>
                                            <Typography variant="h5" fontWeight="900" sx={{ mb: 3, color: 'text.primary' }}>Az eseményről</Typography>
                                            <Paper sx={{ p: { xs: 3, md: 4 }, borderRadius: 5, bgcolor: isDarkMode ? 'rgba(255,255,255,0.01)' : '#fcfcfc', border: '1px solid', borderColor: 'divider' }}>
                                                <Typography sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.9, color: 'text.secondary', fontSize: '1.1rem' }}>{event.description}</Typography>
                                            </Paper>
                                        </Box>

                                        <Box>
                                            <Typography variant="h5" fontWeight="900" sx={{ mb: 3, color: 'text.primary' }}>Elérhető munkaterületek</Typography>
                                            <Grid container spacing={3}>
                                                {sortedWorkAreas.map((area) => (
                                                    <Grid size={{ xs: 12, sm: 6 }} key={area.id}>
                                                        <Paper sx={{
                                                            p: 4, height: '100%', borderRadius: 5, border: '1.5px solid', borderColor: 'divider', transition: '0.3s ease',
                                                            '&:hover': { transform: 'translateY(-6px)', borderColor: 'primary.main', boxShadow: '0 15px 30px rgba(0,0,0,0.05)' }
                                                        }}>
                                                            <Typography variant="h6" fontWeight="900" color="primary.main" mb={1}>{area.name}</Typography>
                                                            <Typography variant="body2" color="text.secondary" mb={3} sx={{ lineHeight: 1.6 }}>{area.description || "Nincs megadva leírás."}</Typography>
                                                            <Chip label={`Kapacitás: ${area.capacity} fő`} size="small" color="primary" variant="outlined" sx={{ fontWeight: '800', borderRadius: 1.5 }} />
                                                        </Paper>
                                                    </Grid>
                                                ))}
                                            </Grid>
                                        </Box>
                                    </Box>
                                )}

                                {/* 2. FÜL: ELÉRHETŐSÉGEK (FRISSÍTETT GOMBOK) */}
                                {tabIndex === 1 && (
                                    <Box>
                                        <Typography variant="h5" fontWeight="900" sx={{ mb: 3, color: 'text.primary' }}>Szervezők és Koordinátorok</Typography>
                                        {contacts.length === 0 ? (
                                            <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 5, border: '1px dashed', borderColor: 'divider', bgcolor: 'transparent' }}>
                                                <Typography color="text.secondary">Jelenleg nincsenek megadva kapcsolattartók ehhez az eseményhez.</Typography>
                                            </Paper>
                                        ) : (
                                            <Grid container spacing={3}>
                                                {contacts.map((contact, idx) => {
                                                    const backendUrl = "http://localhost:8081";
                                                    const fullAvatarUrl = contact.avatar ? (contact.avatar.startsWith('http') ? contact.avatar : `${backendUrl}${contact.avatar}`) : undefined;

                                                    return (
                                                        <Grid size={{ xs: 12, sm: 6 }} key={idx}>
                                                            <Paper sx={{
                                                                p: 3, borderRadius: 5, display: 'flex', flexDirection: 'column', gap: 2,
                                                                border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider',
                                                                bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc',
                                                                transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)', borderColor: 'primary.main' }
                                                            }}>
                                                                <Box display="flex" alignItems="center" gap={2}>
                                                                    <Avatar src={fullAvatarUrl} sx={{ width: 56, height: 56, bgcolor: fullAvatarUrl ? 'transparent' : stringToColor(contact.name), fontWeight: 'bold' }}>
                                                                        {contact.name.charAt(0).toUpperCase()}
                                                                    </Avatar>
                                                                    <Box>
                                                                        <Typography variant="h6" fontWeight="900" color="text.primary" lineHeight={1.2}>{contact.name}</Typography>
                                                                        <Chip label={contact.role} color={contact.role === 'Főszervező' ? 'secondary' : 'info'} size="small" sx={{ fontWeight: '800', mt: 0.8, borderRadius: 1.5 }} />
                                                                    </Box>
                                                                </Box>

                                                                <Box sx={{ mt: 1, p: 1.5, bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'white', borderRadius: 3, border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#e2e8f0' }}>
                                                                    <Typography variant="caption" color="text.secondary" fontWeight="bold">Irányított terület:</Typography>
                                                                    <Typography variant="body2" fontWeight="800" color="primary.main">{contact.workAreaName}</Typography>
                                                                </Box>

                                                                <Box display="flex" gap={1} mt={1}>
                                                                    <Button
                                                                        startIcon={<PhoneIcon />} variant="contained" color="success"
                                                                        sx={{ borderRadius: 2.5, flex: 1, fontWeight: 'bold', boxShadow: 'none' }}
                                                                        onClick={() => handleCallClick(contact)}
                                                                        disabled={contact.phone === 'Nincs megadva'}
                                                                    >
                                                                        Hívás
                                                                    </Button>
                                                                    <Tooltip title="Telefonszám másolása">
                                                                        <Button
                                                                            startIcon={<ContentCopyIcon />} variant="outlined"
                                                                            sx={{ borderRadius: 2.5, fontWeight: 'bold', px: 2 }}
                                                                            onClick={() => handleCopyPhone(contact.phone)}
                                                                            disabled={contact.phone === 'Nincs megadva'}
                                                                        >
                                                                            Másolás
                                                                        </Button>
                                                                    </Tooltip>
                                                                </Box>

                                                                <Button
                                                                    startIcon={<EmailIcon />} variant="text" size="small"
                                                                    sx={{ borderRadius: 2, fontWeight: 'bold', mt: -0.5, color: 'text.secondary' }}
                                                                    href={`mailto:${contact.email}`}
                                                                >
                                                                    E-mail küldése
                                                                </Button>
                                                            </Paper>
                                                        </Grid>
                                                    );
                                                })}
                                            </Grid>
                                        )}
                                    </Box>
                                )}
                            </Grid>

                            {/* JOBB OSZLOP: Oldalsáv */}
                            <Grid size={{ xs: 12, md: 5, lg: 4 }}>
                                <Box sx={{ position: 'sticky', top: 100, display: 'flex', flexDirection: 'column', gap: 4 }}>

                                    {/* 4. MY APPLICATIONS */}
                                    {myApplications.length > 0 && permissions?.eventRole !== 'COORDINATOR' && permissions?.eventRole !== 'ORGANIZER' && (
                                        <Box>
                                            <Typography variant="subtitle2" fontWeight="900" color="info.main" sx={{ textTransform: 'uppercase', mb: 2, ml: 1, letterSpacing: 1 }}>Jelentkezéseid</Typography>
                                            <Paper sx={{ p: 2, borderRadius: 4, bgcolor: isDarkMode ? alpha(theme.palette.info.main, 0.05) : '#f8fbff', border: '1px solid', borderColor: isDarkMode ? alpha(theme.palette.info.main, 0.15) : 'info.light' }}>
                                                <Box display="flex" flexDirection="column" gap={1.5}>
                                                    {myApplications.map((app) => (
                                                        <Paper key={app.id} elevation={0} sx={{
                                                            p: 2, borderRadius: 3, display: 'flex', flexDirection: 'column', gap: 1.5,
                                                            bgcolor: isDarkMode ? 'rgba(0,0,0,0.3)' : 'white', border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'divider'
                                                        }}>
                                                            <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                                                                <Box>
                                                                    <Typography fontWeight="900" sx={{ fontSize: '1.05rem', color: 'text.primary' }}>{app.workAreaName}</Typography>
                                                                    <Typography variant="caption" fontWeight="800" sx={{ mt: 0.5, color: app.status === 'PENDING' ? (isDarkMode ? '#93c5fd' : 'info.main') : app.status === 'APPROVED' ? (isDarkMode ? '#4ade80' : 'success.main') : app.status === 'WITHDRAWN' ? 'text.disabled' : (isDarkMode ? '#f87171' : 'error.main') }}>
                                                                        {app.status === 'PENDING' ? '⏳ Elbírálás alatt' : app.status === 'APPROVED' ? '✅ Elfogadva' : app.status === 'WITHDRAWN' ? '🏳️ Visszavonva' : '❌ Elutasítva'}
                                                                    </Typography>
                                                                </Box>
                                                            </Box>

                                                            <Box display="flex" gap={1}>
                                                                {(app.status === 'PENDING' || app.status === 'APPROVED') && (
                                                                    <Button fullWidth size="small" color="error" variant="outlined" onClick={() => handleWithdrawClick(app.id)} sx={{ borderRadius: 2, fontWeight: '800', border: '1.5px solid' }}>Visszavonás</Button>
                                                                )}
                                                                {app.status === 'WITHDRAWN' && !isClosed && (
                                                                    <Button fullWidth size="small" color="primary" variant="contained" startIcon={<RestoreIcon />} onClick={() => handleReApply(app.id)} sx={{ borderRadius: 2, fontWeight: '800', boxShadow: 'none' }}>Újra jelentkezem</Button>
                                                                )}
                                                            </Box>

                                                            {app.status === 'REJECTED' && app.rejectionMessage && (
                                                                <Box sx={{ mt: 1, p: 1.5, bgcolor: isDarkMode ? 'rgba(239, 68, 68, 0.1)' : '#ffebee', borderRadius: 2, borderLeft: '4px solid', borderColor: isDarkMode ? '#ef4444' : '#d32f2f' }}>
                                                                    <Typography variant="caption" color={isDarkMode ? '#fca5a5' : 'error.dark'}><strong>Szervező üzenete:</strong> {app.rejectionMessage}</Typography>
                                                                </Box>
                                                            )}
                                                        </Paper>
                                                    ))}
                                                </Box>
                                            </Paper>
                                        </Box>
                                    )}

                                    {/* 3. PRO QUICK TOOLS */}
                                    {sidebarTools.length > 0 && (
                                        <Box>
                                            <Typography variant="subtitle2" fontWeight="900" color="primary" sx={{ textTransform: 'uppercase', mb: 2, ml: 1, letterSpacing: 1.5 }}>⚙️ Szervezői Eszközök</Typography>
                                            <Paper sx={{ p: 2, borderRadius: 4, bgcolor: isDarkMode ? 'rgba(30,41,59,0.5)' : '#fcfcfc', border: '1px solid', borderColor: 'divider' }}>
                                                <Box display="flex" flexDirection="column" gap={1.5}>
                                                    {sidebarTools.map((tool, i) => (
                                                        <Paper
                                                            key={i}
                                                            onClick={() => navigate(tool.path)}
                                                            sx={{
                                                                p: 1.5, borderRadius: 3, cursor: 'pointer', transition: 'all 0.2s',
                                                                bgcolor: alpha(tool.color, 0.05), border: '1px solid', borderColor: alpha(tool.color, 0.15),
                                                                display: 'flex', alignItems: 'center', gap: 2,
                                                                '&:hover': { bgcolor: alpha(tool.color, 0.1), transform: 'translateX(4px)', borderColor: tool.color }
                                                            }}
                                                        >
                                                            <Box sx={{ color: tool.color, display: 'flex', alignItems: 'center' }}>{tool.icon}</Box>
                                                            <Typography sx={{ color: tool.color, fontWeight: '800' }}>{tool.label}</Typography>
                                                        </Paper>
                                                    ))}
                                                </Box>
                                            </Paper>
                                        </Box>
                                    )}
                                </Box>
                            </Grid>
                        </Grid>
                    </Container>
                </Box>
            </Fade>

            {/* --- JELENTKEZÉSI MODAL --- */}
            <Dialog open={openModal} onClose={() => setOpenModal(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 5, bgcolor: isDarkMode ? 'rgba(30,41,59,0.98)' : 'white', backdropFilter: 'blur(15px)' } }}>
                <DialogTitle sx={{ fontWeight: '900', bgcolor: isDarkMode ? '#1e293b' : 'primary.main', color: 'white', py: 3 }}>Esemény Jelentkezés</DialogTitle>
                <DialogContent sx={{ p: 4 }}>
                    <Typography variant="subtitle2" fontWeight="900" sx={{ mb: 2, mt: 3, color: 'primary.main' }}>VÁLASSZ MUNKATERÜLETET:</Typography>

                    <FormGroup sx={{ bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : '#f8fafc', p: 2, borderRadius: 3 }}>
                        {sortedWorkAreas.map(area => {
                            const isAlreadyApplied = alreadyAppliedAreaIds.includes(area.id);

                            return (
                                <FormControlLabel
                                    key={area.id}
                                    control={
                                        <Checkbox
                                            checked={isAlreadyApplied || selectedWorkAreas.includes(area.id)}
                                            onChange={() => !isAlreadyApplied && handleWorkAreaToggle(area.id)}
                                            disabled={isAlreadyApplied}
                                        />
                                    }
                                    label={
                                        <Typography fontWeight="600" color={isAlreadyApplied ? 'text.secondary' : 'text.primary'}>
                                            {area.name} {isAlreadyApplied && <Typography component="span" variant="caption" color="success.main" fontWeight="bold">(Már jelentkeztél)</Typography>}
                                        </Typography>
                                    }
                                />
                            );
                        })}
                    </FormGroup>

                    {event.questions && event.questions.length > 0 && (
                        <>
                            <Divider sx={{ my: 4, borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider' }} />
                            <Typography variant="subtitle2" fontWeight="900" color={isDarkMode ? '#818cf8' : 'primary'} textTransform="uppercase" mb={3} letterSpacing="1px">2. További információk</Typography>
                            {event.questions.map(q => (
                                <Box key={q.id} mb={3}>
                                    {q.questionType === 'TEXT' && (
                                        <TextField fullWidth size="medium" label={q.questionText} required={q.isRequired} value={answers[q.id] || ''} onChange={(e) => handleAnswerChange(q.id, e.target.value)} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'white' } }} />
                                    )}
                                    {q.questionType === 'DROPDOWN' && (
                                        <FormControl fullWidth size="medium" required={q.isRequired} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'white' } }}>
                                            <InputLabel>{q.questionText}</InputLabel>
                                            <Select label={q.questionText} value={answers[q.id] || ''} onChange={(e) => handleAnswerChange(q.id, e.target.value)}>
                                                {q.options.split(',').map((opt, i) => (<MenuItem key={i} value={opt.trim()}>{opt.trim()}</MenuItem>))}
                                            </Select>
                                        </FormControl>
                                    )}
                                    {q.questionType === 'CHECKBOX' && (
                                        <FormControl component="fieldset" required={q.isRequired} sx={{ width: '100%', p: 2, bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'white', borderRadius: 3, border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'divider' }}>
                                            <Typography variant="body2" fontWeight="900" mb={1}>{q.questionText} {q.isRequired && <Typography component="span" color="error">*</Typography>}</Typography>
                                            <FormGroup>
                                                {q.options.split(',').map((opt, i) => {
                                                    const optionTrimmed = opt.trim();
                                                    return (<FormControlLabel key={i} control={<Checkbox size="small" checked={((answers[q.id] as string[]) || []).includes(optionTrimmed)} onChange={() => handleCheckboxAnswerToggle(q.id, optionTrimmed)}/>} label={<Typography variant="body2" fontWeight="500">{optionTrimmed}</Typography>} />);
                                                })}
                                            </FormGroup>
                                        </FormControl>
                                    )}
                                </Box>
                            ))}
                        </>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 3, borderTop: '1px solid', borderColor: 'divider' }}>
                    <Button onClick={() => setOpenModal(false)} sx={{ fontWeight: '800' }}>Mégse</Button>
                    <Button variant="contained" onClick={handleSubmitApplication} disabled={submitting || selectedWorkAreas.length === 0} sx={{ borderRadius: 2, fontWeight: '800', px: 4 }}>{submitting ? 'Küldés...' : 'Jelentkezés beküldése'}</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={withdrawModalOpen} onClose={() => setWithdrawModalOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
                <DialogTitle sx={{ fontWeight: '900' }}>Visszavonás</DialogTitle>
                <DialogContent><TextField fullWidth multiline rows={3} label="Indoklás (opcionális)" value={withdrawReason} onChange={(e) => setWithdrawReason(e.target.value)} sx={{ mt: 2 }} /></DialogContent>
                <DialogActions sx={{ p: 2.5 }}><Button onClick={() => setWithdrawModalOpen(false)}>Mégse</Button><Button variant="contained" color="error" onClick={confirmWithdraw} disabled={withdrawing}>Visszavonás</Button></DialogActions>
            </Dialog>

            {/* --- ÚJ: HÍVÁS MEGERŐSÍTŐ MODAL --- */}
            <Dialog open={callDialogOpen} onClose={() => setCallDialogOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 5, bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.95)' : 'white', backdropFilter: 'blur(20px)' } }}>
                <DialogTitle sx={{ fontWeight: '900', color: 'success.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PhoneIcon /> Hívás indítása
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body1" mb={2}>
                        Szeretnéd megnyitni a készüléked tárcsázóját a következő számhoz?
                    </Typography>
                    <Paper elevation={0} sx={{ p: 2, bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : '#f8fafc', borderRadius: 4, border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider', textAlign: 'center' }}>
                        <Typography variant="h6" fontWeight="bold" color="text.primary">{contactToCall?.name}</Typography>
                        <Typography variant="body1" color="success.main" fontWeight="900" sx={{ fontSize: '1.2rem', letterSpacing: 1, mt: 0.5 }}>{contactToCall?.phone}</Typography>
                    </Paper>
                </DialogContent>
                <DialogActions sx={{ p: 2, px: 3 }}>
                    <Button onClick={() => setCallDialogOpen(false)} color="inherit" sx={{ fontWeight: 'bold' }}>Mégse</Button>
                    <Button onClick={executeCall} variant="contained" color="success" sx={{ borderRadius: 2, fontWeight: 'bold', px: 3 }} disableElevation>Tárcsázás</Button>
                </DialogActions>
            </Dialog>

            {/* --- ÚJ: SNACKBAR (TOAST) MÁSOLÁSHOZ --- */}
            <Snackbar
                open={toastOpen}
                autoHideDuration={5000}
                onClose={() => setToastOpen(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={() => setToastOpen(false)} severity="success" sx={{ width: '100%', borderRadius: 3, fontWeight: 'bold', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
                    {toastMessage}
                </Alert>
            </Snackbar>

        </>
    );
}