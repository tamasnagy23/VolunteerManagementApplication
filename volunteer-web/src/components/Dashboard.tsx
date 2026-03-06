import { useEffect, useState, useMemo } from 'react';
import {
    Container, Typography, Button, Box,
    CircularProgress, Divider, Paper, Alert,
    Accordion, AccordionSummary, AccordionDetails, Chip,
    TextField, InputAdornment, Pagination,
    Card, CardContent, CardActions, Dialog, DialogTitle,
    DialogContent, DialogActions, Avatar, FormControl, Select, MenuItem
} from '@mui/material';
import Grid from '@mui/material/Grid';
import api from '../api/axios';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

// Ikonok
import AddIcon from '@mui/icons-material/Add';
import GroupIcon from '@mui/icons-material/Group';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import BusinessIcon from '@mui/icons-material/Business';
import SearchIcon from '@mui/icons-material/Search';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import InfoIcon from '@mui/icons-material/Info';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import SecurityIcon from '@mui/icons-material/Security';

import EventCard from "./EventCard";

// --- INTERFÉSZEK ---
interface Shift { id: number; startTime: string; endTime: string; maxVolunteers: number; }
interface Organization { id: number; name: string; address: string; description?: string; email?: string; phone?: string; }
interface Event { id: number; title: string; description: string; location: string; shifts: Shift[]; organization?: Organization; }
interface UserMembership { orgId?: number; orgName?: string; orgRole?: string; organization?: Organization; role?: string; status: string; rejectionMessage?: string; }
interface UserProfile { name: string; role: string; memberships: UserMembership[]; }

export default function Dashboard() {
    const navigate = useNavigate();

    // Globális adatok
    const [events, setEvents] = useState<Event[]>([]);
    const [allOrganizations, setAllOrganizations] = useState<Organization[]>([]);
    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState('');

    // UI Állapotok
    const [currentTab, setCurrentTab] = useState(0);
    const [expandedOrg, setExpandedOrg] = useState<string | false>(false);
    const [selectedOrgModal, setSelectedOrgModal] = useState<Organization | null>(null);
    const [joiningId, setJoiningId] = useState<number | null>(null);

    // Saját Csapatok - Szűrés és Lapozás
    const [mySearch, setMySearch] = useState('');
    const [mySort, setMySort] = useState<'asc' | 'desc'>('asc');
    const [myPage, setMyPage] = useState(1);
    const MY_ORGS_PER_PAGE = 5;

    // Felfedezés - Szűrés és Lapozás
    const [discoverSearch, setDiscoverSearch] = useState('');
    const [discoverPage, setDiscoverPage] = useState(1);
    const DISCOVER_PER_PAGE = 6;

    // Kilépés Állapotok
    const [leaveOrgModal, setLeaveOrgModal] = useState<{ id: number, name: string } | null>(null);
    const [leaving, setLeaving] = useState(false);

    // Belső eseményfülek és keresők állapotai szervezetenként
    const [orgEventTabs, setOrgEventTabs] = useState<Record<string, number>>({});
    const [orgEventSearches, setOrgEventSearches] = useState<Record<string, string>>({});

    useEffect(() => { setMyPage(1); }, [mySearch, mySort]);
    useEffect(() => { setDiscoverPage(1); }, [discoverSearch]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const ts = new Date().getTime();
            const [eventsRes, orgsRes, userRes] = await Promise.all([
                api.get('/events', { params: { t: ts } }),
                api.get('/organizations', { params: { t: ts } }),
                api.get('/users/me', { params: { t: ts } })
            ]);
            setEvents(eventsRes.data.content || eventsRes.data || []);
            setAllOrganizations(orgsRes.data);
            setUser(userRes.data);

            const evData = eventsRes.data.content || eventsRes.data || [];
            if (evData.length > 0 && !expandedOrg) setExpandedOrg(evData[0].organization?.name || 'Egyéb');
        } catch (err) {
            console.error(err);
            setError('Hiba történt az adatok betöltésekor.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const canSeeAuditLog = useMemo(() => {
        if (!user) return false;
        if (user.role === 'SYS_ADMIN') return true;
        return user.memberships?.some(m =>
            m.status === 'APPROVED' &&
            (m.orgRole === 'OWNER' || m.orgRole === 'ORGANIZER' || m.role === 'OWNER' || m.role === 'ORGANIZER')
        );
    }, [user]);

    const groupedEvents = useMemo(() => {
        return events.reduce((acc, event) => {
            const orgName = event.organization?.name || 'Egyéb';
            if (!acc[orgName]) acc[orgName] = [];
            acc[orgName].push(event);
            return acc;
        }, {} as Record<string, Event[]>);
    }, [events]);

    const allMyOrgNames = useMemo(() => {
        if (user?.role === 'SYS_ADMIN') {
            return Array.from(new Set(allOrganizations.map(o => o.name)));
        }
        return Array.from(new Set(
            user?.memberships
                ?.filter(m => m.status === 'APPROVED')
                .map(m => m.organization?.name || m.orgName || 'Ismeretlen') || []
        ));
    }, [user, allOrganizations]);

    const paginatedMyOrgs = useMemo(() => {
        const filtered = allMyOrgNames.filter(name => name.toLowerCase().includes(mySearch.toLowerCase()));
        filtered.sort((a, b) => mySort === 'asc' ? a.localeCompare(b, 'hu') : b.localeCompare(a, 'hu'));
        return {
            total: filtered.length,
            items: filtered.slice((myPage - 1) * MY_ORGS_PER_PAGE, myPage * MY_ORGS_PER_PAGE)
        };
    }, [allMyOrgNames, mySearch, mySort, myPage]);

    const getEventCategory = (event: Event) => {
        // Biztonsági ellenőrzés, ha valamiért hiányozna a dátum
        if (!event.startTime || !event.endTime) return 'UPCOMING';

        const now = new Date().getTime();
        const start = new Date(event.startTime).getTime();
        const end = new Date(event.endTime).getTime();

        if (now >= start && now <= end) {
            return 'ACTIVE';   // Épp most zajlik
        } else if (now < start) {
            return 'UPCOMING'; // Még nem kezdődött el
        } else {
            return 'PAST';     // Már véget ért
        }
    };

    const getMembershipInfo = (orgId: number) => {
        const membership = user?.memberships?.find(m => m.orgId === orgId || m.organization?.id === orgId);
        return { status: membership ? membership.status : 'NONE', rejectionMessage: membership?.rejectionMessage };
    };

    const handleJoin = async (orgId: number) => {
        try {
            setJoiningId(orgId);
            await api.post(`/organizations/${orgId}/join`);
            await fetchData();
        } catch { alert("Nem sikerült csatlakozni a szervezethez."); } finally { setJoiningId(null); }
    };

    const handleLeaveOrganization = async () => {
        if (!leaveOrgModal) return;
        setLeaving(true);
        try {
            await api.delete(`/organizations/${leaveOrgModal.id}/leave`);
            setUser(prev => prev ? {
                ...prev,
                memberships: prev.memberships.map(m =>
                    (m.orgId === leaveOrgModal.id || m.organization?.id === leaveOrgModal.id) ? { ...m, status: 'LEFT' } : m
                )
            } : prev);
            setLeaveOrgModal(null);
            await fetchData();
        } catch (err: unknown) {
            if (axios.isAxiosError(err)) alert(err.response?.data || "Hiba történt a kilépés során.");
            else alert("Váratlan hiba történt.");
        } finally { setLeaving(false); }
    };

    const paginatedDiscoverOrgs = useMemo(() => {
        const filtered = allOrganizations.filter(org => org.name.toLowerCase().includes(discoverSearch.toLowerCase()));
        return {
            total: filtered.length,
            items: filtered.slice((discoverPage - 1) * DISCOVER_PER_PAGE, discoverPage * DISCOVER_PER_PAGE)
        };
    }, [allOrganizations, discoverSearch, discoverPage]);


    if (loading) return <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh"><CircularProgress size={60} thickness={4} /></Box>;

    return (
        <Container maxWidth="lg" sx={{ mt: { xs: 3, md: 5 }, mb: 10 }}>
            {/* FEJLÉC */}
            <Box mb={4} display="flex" flexDirection={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} gap={2}>
                <Box>
                    <Typography variant="h3" fontSize={{ xs: '2rem', md: '3rem' }} fontWeight="900" gutterBottom sx={{ color: '#1a237e', letterSpacing: '-1px' }}>
                        Szia, {user?.name}! 👋
                    </Typography>
                    <Typography variant="h6" fontSize={{ xs: '1rem', md: '1.25rem' }} color="text.secondary" fontWeight="400">
                        Kezeld a saját eseményeidet, vagy fedezz fel új lehetőségeket.
                    </Typography>
                </Box>

                {canSeeAuditLog && (
                    <Button
                        variant="contained" color="secondary" startIcon={<SecurityIcon />}
                        onClick={() => navigate('/logs')}
                        sx={{ borderRadius: 2, fontWeight: 'bold', boxShadow: 3, px: 3, py: 1.5, width: { xs: '100%', md: 'auto' } }}
                    >
                        {user?.role === 'SYS_ADMIN' ? 'Rendszernapló (Audit)' : 'Eseménynapló'}
                    </Button>
                )}
            </Box>

            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

            {/* FŐ KATEGÓRIAVÁLASZTÓ */}
            <Paper elevation={0} sx={{ display: 'flex', p: 0.5, bgcolor: '#edf2f7', borderRadius: 3, mb: 4 }}>
                <Button
                    fullWidth
                    disableElevation
                    onClick={() => setCurrentTab(0)}
                    variant={currentTab === 0 ? 'contained' : 'text'}
                    color={currentTab === 0 ? 'primary' : 'inherit'}
                    startIcon={<BusinessIcon />}
                    sx={{ borderRadius: 2.5, py: 1.5, fontWeight: 'bold', transition: 'all 0.2s', color: currentTab === 0 ? 'white' : 'text.secondary' }}
                >
                    Csapataim
                </Button>
                <Button
                    fullWidth
                    disableElevation
                    onClick={() => setCurrentTab(1)}
                    variant={currentTab === 1 ? 'contained' : 'text'}
                    color={currentTab === 1 ? 'primary' : 'inherit'}
                    startIcon={<SearchIcon />}
                    sx={{ borderRadius: 2.5, py: 1.5, fontWeight: 'bold', transition: 'all 0.2s', color: currentTab === 1 ? 'white' : 'text.secondary' }}
                >
                    Felfedezés
                </Button>
            </Paper>

            {/* --- 1. FÜL: SAJÁT CSAPATAIM --- */}
            {currentTab === 0 && (
                <Box>
                    {allMyOrgNames.length === 0 ? (
                        <Paper sx={{ p: { xs: 3, md: 6 }, textAlign: 'center', bgcolor: '#f8fafd', borderRadius: 4, border: '1px dashed #e0e0e0' }}>
                            <BusinessIcon sx={{ fontSize: 60, color: '#bdbdbd', mb: 2 }} />
                            <Typography variant="h5" color="text.secondary" fontWeight="bold" gutterBottom>Még nem tartozol egy csapathoz sem.</Typography>
                            <Button variant="contained" onClick={() => setCurrentTab(1)} sx={{ mt: 2 }}>Katalógus megnyitása</Button>
                        </Paper>
                    ) : (
                        <Box>
                            <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} gap={2} mb={3}>
                                <TextField
                                    fullWidth size="small" placeholder="Keresés a csapataim között..."
                                    value={mySearch} onChange={(e) => setMySearch(e.target.value)}
                                    InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
                                />
                                <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 200 } }}>
                                    <Select value={mySort} onChange={(e) => setMySort(e.target.value as 'asc'|'desc')}>
                                        <MenuItem value="asc">Rendezés: A - Z</MenuItem>
                                        <MenuItem value="desc">Rendezés: Z - A</MenuItem>
                                    </Select>
                                </FormControl>
                            </Box>

                            {paginatedMyOrgs.items.length === 0 ? (
                                <Typography color="text.secondary" textAlign="center" py={4}>Nincs találat a keresésre.</Typography>
                            ) : (
                                paginatedMyOrgs.items.map((orgName) => {
                                    const orgEvents = groupedEvents[orgName] || [];
                                    const targetOrg = allOrganizations.find(o => o.name === orgName);
                                    const targetOrgId = targetOrg?.id;
                                    const myMembership = user?.memberships?.find(m => (m.orgName === orgName || m.organization?.name === orgName) && m.status === 'APPROVED');
                                    const myRoleInThisOrg = myMembership?.orgRole || myMembership?.role || '';

                                    const isLeaderForThisOrg = user?.role === 'SYS_ADMIN' || ['OWNER', 'ORGANIZER'].includes(myRoleInThisOrg);
                                    const canManageApps = user?.role === 'SYS_ADMIN' || ['OWNER', 'ORGANIZER', 'COORDINATOR'].includes(myRoleInThisOrg);
                                    const orgIdToLeave = myMembership?.orgId || myMembership?.organization?.id;

                                    const currentInnerTab = orgEventTabs[orgName] || 0;
                                    const currentInnerSearch = orgEventSearches[orgName] || '';

                                    const filteredOrgEvents = orgEvents.filter(event => {
                                        if (currentInnerSearch && !event.title.toLowerCase().includes(currentInnerSearch.toLowerCase())) return false;
                                        const category = getEventCategory(event);
                                        if (currentInnerTab === 0 && category !== 'ACTIVE') return false;
                                        if (currentInnerTab === 1 && category !== 'UPCOMING') return false;
                                        if (currentInnerTab === 2 && category !== 'PAST') return false;
                                        return true;
                                    });

                                    return (
                                        <Accordion
                                            key={orgName} expanded={expandedOrg === orgName}
                                            onChange={(_e, isExpanded) => setExpandedOrg(isExpanded ? orgName : false)}
                                            elevation={expandedOrg === orgName ? 4 : 1}
                                            sx={{ mb: 2, borderRadius: '12px !important', '&::before': { display: 'none' }, border: '1px solid', borderColor: expandedOrg === orgName ? 'primary.main' : 'grey.200', overflow: 'hidden' }}
                                        >
                                            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: expandedOrg === orgName ? '#f4fafe' : 'white', py: 1 }}>
                                                <Box
                                                    display="flex"
                                                    flexDirection={{ xs: 'column', md: 'row' }}
                                                    justifyContent="space-between"
                                                    alignItems={{ xs: 'flex-start', md: 'center' }}
                                                    width="100%"
                                                    gap={2}
                                                >
                                                    {/* --- BAL OLDAL --- */}
                                                    <Box display="flex" alignItems="center" gap={2}>
                                                        <Avatar sx={{ bgcolor: 'primary.main' }}><BusinessIcon /></Avatar>
                                                        <Box>
                                                            <Typography variant="h6" fontWeight="bold" lineHeight={1.2}>{orgName}</Typography>
                                                            <Box display="flex" alignItems="center" flexWrap="wrap" gap={1} mt={0.5}>
                                                                <Chip label={myRoleInThisOrg === 'OWNER' ? 'Alapító' : myRoleInThisOrg === 'ORGANIZER' ? 'Szervező' : myRoleInThisOrg === 'COORDINATOR' ? 'Koordinátor' : 'Önkéntes'} size="small" color={isLeaderForThisOrg ? "secondary" : "default"} variant={isLeaderForThisOrg ? "filled" : "outlined"} sx={{ height: 20, fontSize: '0.7rem' }} />
                                                                <Typography variant="caption" color="text.secondary">{orgEvents.length} esemény</Typography>
                                                            </Box>
                                                        </Box>
                                                    </Box>

                                                    {/* --- JAVÍTOTT: JOBB OLDAL GOMBOK --- */}
                                                    <Box
                                                        component="div"
                                                        onClick={(e) => e.stopPropagation()}
                                                        onFocus={(e) => e.stopPropagation()}
                                                        sx={{
                                                            display: 'flex',
                                                            flexDirection: { xs: 'column', sm: 'row' },
                                                            gap: 1.5,
                                                            width: { xs: '100%', md: 'auto' }
                                                        }}
                                                    >
                                                        {isLeaderForThisOrg && (
                                                            <Box component="div" sx={{ display: 'flex', gap: 1, width: { xs: '100%', sm: 'auto' } }}>
                                                                <Button
                                                                    component="div"
                                                                    variant="contained"
                                                                    size="small"
                                                                    startIcon={<AddIcon />}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        navigate('/create-event', { state: { selectedOrgId: targetOrgId } });
                                                                    }}
                                                                    sx={{ borderRadius: 2, whiteSpace: 'nowrap', px: 2.5, flex: { xs: 1, sm: 'initial' } }}
                                                                >
                                                                    Új Esemény
                                                                </Button>
                                                                <Button
                                                                    component="div"
                                                                    variant="outlined"
                                                                    size="small"
                                                                    startIcon={<GroupIcon />}
                                                                    onClick={(e) => { e.stopPropagation(); navigate('/team'); }}
                                                                    sx={{ borderRadius: 2, whiteSpace: 'nowrap', px: 2.5, flex: { xs: 1, sm: 'initial' } }}
                                                                >
                                                                    Csapat
                                                                </Button>
                                                            </Box>
                                                        )}
                                                        {myRoleInThisOrg !== 'OWNER' && orgIdToLeave && (
                                                            <Button
                                                                component="div"
                                                                variant="outlined" color="error" size="small"
                                                                onClick={(e) => { e.stopPropagation(); setLeaveOrgModal({ id: orgIdToLeave, name: orgName }); }}
                                                                sx={{ borderRadius: 2, px: 2.5, width: { xs: '100%', sm: 'auto' } }}
                                                            >
                                                                Kilépés
                                                            </Button>
                                                        )}
                                                    </Box>
                                                </Box>
                                            </AccordionSummary>
                                            <Divider />

                                            <AccordionDetails sx={{ bgcolor: '#fafafa', p: { xs: 2, md: 3 } }}>
                                                <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems="stretch" gap={2} mb={3} p={1.5} sx={{ bgcolor: 'white', borderRadius: 3, border: '1px solid #eee' }}>
                                                    <Paper elevation={0} sx={{ display: 'flex', p: 0.5, bgcolor: '#f4f6f8', borderRadius: 2, flexGrow: 1, width: { xs: '100%', md: 'auto' } }}>
                                                        {[
                                                            { label: 'Aktív', icon: <PlayCircleOutlineIcon sx={{fontSize: 18, mr: 0.5}}/> },
                                                            { label: 'Közelgő', icon: <AccessTimeIcon sx={{fontSize: 18, mr: 0.5}}/> },
                                                            { label: 'Lezárult', icon: <CheckCircleOutlineIcon sx={{fontSize: 18, mr: 0.5}}/> }
                                                        ].map((tab, idx) => (
                                                            <Button
                                                                key={tab.label}
                                                                fullWidth
                                                                disableElevation
                                                                size="small"
                                                                onClick={() => setOrgEventTabs(prev => ({ ...prev, [orgName]: idx }))}
                                                                variant={currentInnerTab === idx ? 'contained' : 'text'}
                                                                color={currentInnerTab === idx ? 'primary' : 'inherit'}
                                                                sx={{ borderRadius: 1.5, py: 0.8, color: currentInnerTab === idx ? 'white' : 'text.secondary', fontWeight: 'bold' }}
                                                            >
                                                                <Box display="flex" alignItems="center">{tab.icon} {tab.label}</Box>
                                                            </Button>
                                                        ))}
                                                    </Paper>

                                                    <TextField
                                                        size="small"
                                                        placeholder="Esemény keresése..."
                                                        value={currentInnerSearch}
                                                        onChange={(e) => setOrgEventSearches(prev => ({ ...prev, [orgName]: e.target.value }))}
                                                        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
                                                        sx={{ minWidth: { xs: '100%', md: '250px' } }}
                                                    />
                                                </Box>

                                                <Grid container spacing={3}>
                                                    {filteredOrgEvents.length === 0 ? (
                                                        <Box textAlign="center" py={4} width="100%">
                                                            <Typography variant="body2" color="text.secondary" fontStyle="italic">Nincs találat ebben a kategóriában.</Typography>
                                                        </Box>
                                                    ) : (
                                                        filteredOrgEvents.map((event) => (
                                                            <Grid size={{xs:12, sm:6, md:4}} key={event.id}>
                                                                <EventCard event={event} isLeader={isLeaderForThisOrg} canManageApplications={canManageApps} />
                                                            </Grid>
                                                        ))
                                                    )}
                                                </Grid>
                                            </AccordionDetails>
                                        </Accordion>
                                    );
                                })
                            )}

                            {paginatedMyOrgs.total > MY_ORGS_PER_PAGE && (
                                <Box display="flex" justifyContent="center" mt={4}>
                                    <Pagination count={Math.ceil(paginatedMyOrgs.total / MY_ORGS_PER_PAGE)} page={myPage} onChange={(_e, p) => setMyPage(p)} color="primary" siblingCount={0} />
                                </Box>
                            )}
                        </Box>
                    )}
                </Box>
            )}

            {/* --- 2. FÜL: FELFEDEZÉS --- */}
            {currentTab === 1 && (
                <Box>
                    <Box mb={4}>
                        <TextField
                            fullWidth size="medium" placeholder="Keresés a szervezetek között..."
                            value={discoverSearch} onChange={(e) => setDiscoverSearch(e.target.value)}
                            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon color="primary" /></InputAdornment>, sx: { bgcolor: 'white', borderRadius: 2 } }}
                        />
                    </Box>

                    <Grid container spacing={4}>
                        {paginatedDiscoverOrgs.items.length === 0 ? (
                            <Typography color="text.secondary" textAlign="center" py={4} width="100%">Nincs a keresésnek megfelelő szervezet.</Typography>
                        ) : (
                            paginatedDiscoverOrgs.items.map((org) => {
                                const { status, rejectionMessage } = getMembershipInfo(org.id);
                                return (
                                    <Grid size={{xs:12, sm:6, md:4}}  key={org.id}>
                                        <Card elevation={3} sx={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 3, transition: '0.3s', '&:hover': { transform: 'translateY(-5px)', boxShadow: 6 } }}>
                                            <CardContent sx={{ flexGrow: 1, textAlign: 'center', pt: 4 }}>
                                                <BusinessIcon sx={{ fontSize: 60, color: '#1976d2', opacity: 0.8, mb: 2 }} />
                                                <Typography variant="h5" fontWeight="bold" gutterBottom>{org.name}</Typography>
                                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}><LocationOnIcon sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} />{org.address}</Typography>
                                            </CardContent>
                                            <CardActions sx={{ p: 2, flexDirection: 'column', gap: 1.5, bgcolor: '#fbfbfb', borderTop: '1px solid #eee' }}>

                                                {(status === 'NONE' || status === 'LEFT') && <Button variant="contained" fullWidth onClick={() => handleJoin(org.id)} disabled={joiningId === org.id}>{joiningId === org.id ? <CircularProgress size={24} /> : 'Csatlakozom'}</Button>}
                                                {status === 'PENDING' && <Button variant="contained" fullWidth disabled sx={{ bgcolor: 'warning.light', color: 'warning.dark', '&.Mui-disabled': { bgcolor: '#ffe0b2', color: '#e65100' } }}>Elbírálás alatt</Button>}
                                                {status === 'APPROVED' && (
                                                    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
                                                        <Button variant="contained" fullWidth disabled sx={{ bgcolor: '#c8e6c9', color: '#1b5e20', '&.Mui-disabled': { bgcolor: '#c8e6c9', color: '#1b5e20' } }}>
                                                            Már tag vagy
                                                        </Button>
                                                        <Button variant="text" color="error" size="small" onClick={() => setLeaveOrgModal({ id: org.id, name: org.name })} sx={{ fontSize: '0.75rem' }}>
                                                            Tagság megszüntetése
                                                        </Button>
                                                    </Box>
                                                )}

                                                {status === 'REJECTED' && (
                                                    <Box sx={{ width: '100%' }}>
                                                        {rejectionMessage && (
                                                            <Typography variant="caption" display="block" sx={{ color: 'error.dark', bgcolor: '#ffebee', p: 1, borderRadius: 1, mb: 1, textAlign: 'center', lineHeight: 1.2 }}>
                                                                <strong>Szervező üzenete:</strong> {rejectionMessage}
                                                            </Typography>
                                                        )}
                                                        <Button variant="outlined" color="error" fullWidth onClick={() => handleJoin(org.id)} disabled={joiningId === org.id} sx={{ fontWeight: 'bold' }}>
                                                            {joiningId === org.id ? <CircularProgress size={24} color="error" /> : 'Elutasítva - Újrajelentkezés'}
                                                        </Button>
                                                    </Box>
                                                )}

                                                <Button variant="outlined" fullWidth startIcon={<InfoIcon />} onClick={() => setSelectedOrgModal(org)}>Részletek</Button>
                                            </CardActions>
                                        </Card>
                                    </Grid>
                                );
                            })
                        )}
                    </Grid>

                    {paginatedDiscoverOrgs.total > DISCOVER_PER_PAGE && (
                        <Box display="flex" justifyContent="center" mt={5}>
                            <Pagination count={Math.ceil(paginatedDiscoverOrgs.total / DISCOVER_PER_PAGE)} page={discoverPage} onChange={(_e, p) => setDiscoverPage(p)} color="primary" size="large" siblingCount={0} />
                        </Box>
                    )}
                </Box>
            )}

            {/* --- MODALOK --- */}
            <Dialog open={!!selectedOrgModal} onClose={() => setSelectedOrgModal(null)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
                <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 'bold' }}>{selectedOrgModal?.name}</DialogTitle>
                <DialogContent dividers sx={{ p: 3 }}>
                    <Box mb={3}>
                        <Typography variant="h6" fontWeight="bold" gutterBottom color="primary">Rólunk</Typography>
                        <Typography variant="body1" sx={{ textAlign: 'justify' }}>{selectedOrgModal?.description || 'A szervezet még nem adott meg bővebb leírást magáról.'}</Typography>
                    </Box>
                    <Divider sx={{ mb: 3 }} />
                    <Box mb={1} display="flex" alignItems="center" gap={1.5}><LocationOnIcon color="action" /><Typography variant="body1"><strong>Székhely:</strong> {selectedOrgModal?.address || 'Nincs megadva'}</Typography></Box>
                    <Box mb={1} display="flex" alignItems="center" gap={1.5}><EmailIcon color="action" /><Typography variant="body1"><strong>Email:</strong> {selectedOrgModal?.email || 'Nincs adat'}</Typography></Box>
                    <Box display="flex" alignItems="center" gap={1.5}><PhoneIcon color="action" /><Typography variant="body1"><strong>Telefon:</strong> {selectedOrgModal?.phone || 'Nincs adat'}</Typography></Box>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}><Button onClick={() => setSelectedOrgModal(null)} variant="contained" color="inherit" sx={{ fontWeight: 'bold' }}>Bezárás</Button></DialogActions>
            </Dialog>

            <Dialog open={!!leaveOrgModal} onClose={() => setLeaveOrgModal(null)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ fontWeight: 'bold', color: 'error.main' }}>Kilépés a szervezetből</DialogTitle>
                <DialogContent>
                    <Typography>Biztosan ki szeretnél lépni innen: <strong>{leaveOrgModal?.name}</strong>?</Typography>
                    <Typography variant="body2" color="text.secondary" mt={2}>Ha kilépsz, a jövőben nem láthatod a belső eseményeket, és újra kell jelentkezned, ha vissza szeretnél térni.</Typography>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setLeaveOrgModal(null)} color="inherit" disabled={leaving}>Mégse</Button>
                    <Button onClick={handleLeaveOrganization} variant="contained" color="error" disabled={leaving}>{leaving ? 'Folyamatban...' : 'Igen, kilépek'}</Button>
                </DialogActions>
            </Dialog>

        </Container>
    );
}