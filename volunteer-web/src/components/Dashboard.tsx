import { useEffect, useState, useMemo } from 'react';
import {
    Container, Typography, Box, Paper, Button,
    Alert, TextField, InputAdornment, Avatar,
    List, ListItem, IconButton, Tooltip, useTheme, alpha,
    Dialog, DialogTitle, DialogContent, DialogActions, Collapse,
    Card, CardContent, CardActions
} from '@mui/material';
import Grid from '@mui/material/Grid';
import api from '../api/axios';
import { useNavigate } from 'react-router-dom';

// Ikonok
import BusinessIcon from '@mui/icons-material/Business';
import SearchIcon from '@mui/icons-material/Search';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import AddIcon from '@mui/icons-material/Add';
import LoadingScreen from "./LoadingScreen.tsx";

// A Kiszervezett Hírfolyam Komponens
import SocialFeed from '../components/SocialFeed';

// --- INTERFÉSZEK ---
interface Organization {
    id: number;
    name: string;
    address: string;
    logoUrl?: string;
    tenantId?: string;
}

interface Membership {
    orgId?: number;
    organization?: Organization;
    status: string;
    role?: string;
    orgRole?: string;
    orgName?: string;
    rejectionMessage?: string;
}

interface UserProfile {
    id: number;
    name: string;
    email: string;
    role: string;
    profileImageUrl?: string;
    memberships: Membership[];
}

export default function Dashboard() {
    const navigate = useNavigate();
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';

    const [allOrganizations, setAllOrganizations] = useState<Organization[]>([]);
    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>('');

    // Állapotok a kereséshez és a Felfedezés Modalhoz
    const [myOrgSearch, setMyOrgSearch] = useState<string>('');
    const [discoverSearch, setDiscoverSearch] = useState<string>('');
    const [isDiscoverOpen, setIsDiscoverOpen] = useState<boolean>(false);
    const [expandedMessages, setExpandedMessages] = useState<Record<number, boolean>>({});

    const fetchData = async () => {
        try {
            setLoading(true);
            const ts = new Date().getTime();
            const [orgsRes, userRes] = await Promise.all([
                api.get<Organization[]>('/organizations', { params: { t: ts } }),
                api.get<UserProfile>('/users/me', { params: { t: ts } })
            ]);
            setAllOrganizations(orgsRes.data);
            setUser(userRes.data);
        } catch (err: unknown) {
            console.error("Fetch error:", err);
            setError('Hiba történt az adatok betöltésekor.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        localStorage.removeItem('tenantId');
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const getImageUrl = (url?: string) => url ? (url.startsWith('http') ? url : `http://localhost:8081${url}`) : undefined;

    // --- SZERVEZETI AKCIÓK ---
    const handleOrgClick = (orgId: number, tenantId?: string) => {
        const targetTenantId = tenantId || String(orgId);
        localStorage.setItem('tenantId', targetTenantId);
        localStorage.setItem('activeOrgId', String(orgId));
        navigate(`/organization/${orgId}`);
    };

    const handleJoinOrg = async (orgId: number) => {
        try {
            await api.post(`/organizations/${orgId}/join`);
            fetchData();
        } catch (err: unknown) {
            console.error(err);
            setError("Hiba történt a csatlakozás során.");
        }
    };

    const handleLeaveOrg = async (orgId: number) => {
        if (!window.confirm("Biztosan ki szeretnél lépni ebből a csapatból?")) return;
        try {
            await api.delete(`/organization/${orgId}/leave`);
            fetchData();
        } catch (err: unknown) {
            console.error(err);
            setError("Hiba történt a kilépés során.");
        }
    };

    const toggleMessage = (orgId: number) => { setExpandedMessages(prev => ({ ...prev, [orgId]: !prev[orgId] })); };

    // --- LISTÁK KISZÁMOLÁSA ---
    const enrichedMemberships = useMemo(() => {
        const memberships = (user?.memberships || []).map((m: Membership) => {
            const orgId = m.orgId || m.organization?.id;
            return { ...m, orgId: orgId, organization: allOrganizations.find(o => o.id === orgId) || m.organization };
        });
        if (user?.role === 'SYS_ADMIN') {
            memberships.push(...allOrganizations.map((o: Organization) => ({ orgId: o.id, organization: o, status: 'APPROVED', role: 'SYS_ADMIN' })));
        }
        return memberships;
    }, [user, allOrganizations]);

    const myOrgs = useMemo(() => {
        return enrichedMemberships
            .filter((m: Membership) => m.status === 'APPROVED')
            .filter((m: Membership) => (m.organization?.name || m.orgName || '').toLowerCase().includes(myOrgSearch.toLowerCase()))
            .sort((a, b) => (a.organization?.name || '').localeCompare(b.organization?.name || '', 'hu'));
    }, [enrichedMemberships, myOrgSearch]);

    const discoverOrgs = useMemo(() => {
        return allOrganizations
            .filter((org: Organization) => (org.name || '').toLowerCase().includes(discoverSearch.toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name, 'hu'));
    }, [allOrganizations, discoverSearch]);

    if (loading) return <LoadingScreen />;

    return (
        <Container maxWidth="xl" sx={{ mt: { xs: 2, md: 5 }, mb: 10 }}>
            {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 3 }}>{error}</Alert>}

            {/* ========================================================================= */}
            {/* MOBIL NÉZET: Vízszintes "Sztori" sáv a csapatoknak (Csak telefonon látszik) */}
            {/* ========================================================================= */}
            <Box sx={{ display: { xs: 'flex', md: 'none' }, overflowX: 'auto', pb: 2, mb: 2, gap: 2, '&::-webkit-scrollbar': { display: 'none' } }}>
                {/* Új csapat keresése gomb (Fixen az első) */}
                <Box onClick={() => setIsDiscoverOpen(true)} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, minWidth: 72, cursor: 'pointer' }}>
                    <Avatar sx={{ width: 64, height: 64, border: '2px dashed', borderColor: 'primary.main', bgcolor: 'transparent', color: 'primary.main' }}>
                        <AddIcon fontSize="large" />
                    </Avatar>
                    <Typography variant="caption" fontWeight="bold" noWrap sx={{ maxWidth: 72, textAlign: 'center' }}>Felfedezés</Typography>
                </Box>

                {/* Saját csapatok */}
                {myOrgs.map((m: Membership) => {
                    const orgId = m.orgId;
                    return (
                        <Box key={orgId} onClick={() => orgId && handleOrgClick(orgId, m.organization?.tenantId)} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, minWidth: 72, cursor: 'pointer' }}>
                            <Avatar src={getImageUrl(m.organization?.logoUrl)} sx={{ width: 64, height: 64, border: '2px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#e2e8f0', bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }}>
                                <BusinessIcon />
                            </Avatar>
                            <Typography variant="caption" fontWeight="bold" noWrap sx={{ maxWidth: 72, textAlign: 'center' }}>
                                {m.organization?.name || m.orgName}
                            </Typography>
                        </Box>
                    );
                })}
            </Box>

            <Grid container spacing={4}>

                {/* ========================================================================= */}
                {/* BAL OSZLOP: A HÍRFOLYAM */}
                {/* ========================================================================= */}
                <Grid size={{ xs: 12, md: 8 }}>
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="h4" fontWeight="900" color="text.primary" sx={{ letterSpacing: '-1px' }}>
                            Hírfolyam
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            A legfrissebb információk a csapataidról.
                        </Typography>
                    </Box>
                    <SocialFeed user={user} />
                </Grid>

                {/* ========================================================================= */}
                {/* JOBB OSZLOP: LETISZTULT OLDALSÁV (Csak asztali nézetben) */}
                {/* ========================================================================= */}
                <Grid size={{ xs: 12, md: 4 }} sx={{ display: { xs: 'none', md: 'block' } }}>
                    <Box sx={{ position: 'sticky', top: 24 }}>

                        <Paper elevation={0} sx={{ borderRadius: 4, border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider', bgcolor: 'background.paper', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 48px)' }}>
                            <Box p={2.5} borderBottom="1px solid" borderColor="divider">
                                <Typography variant="h6" fontWeight="900" color="primary.main" mb={1}>Saját csapataim</Typography>
                                <TextField
                                    fullWidth size="small" placeholder="Keresés a csapataim között..."
                                    value={myOrgSearch} onChange={(e) => setMyOrgSearch(e.target.value)}
                                    InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
                                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3, bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : '#f1f5f9' } }}
                                />
                            </Box>

                            <List sx={{ flexGrow: 1, overflowY: 'auto', p: 0, '&::-webkit-scrollbar': { width: 6 }, '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 10 } }}>
                                {myOrgs.length === 0 ? (
                                    <Box p={4} textAlign="center">
                                        <Typography variant="body2" color="text.secondary">Jelenleg nem tartozol egy csapathoz sem.</Typography>
                                    </Box>
                                ) : (
                                    myOrgs.map((m: Membership) => {
                                        const orgId = m.orgId;
                                        return (
                                            <ListItem key={orgId} sx={{ px: 2, py: 2, borderBottom: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f1f5f9', '&:hover': { bgcolor: isDarkMode ? 'rgba(255,255,255,0.02)' : '#f8fafc' } }}>
                                                <Box display="flex" alignItems="center" gap={1.5} width="100%">
                                                    <Avatar src={getImageUrl(m.organization?.logoUrl)} sx={{ width: 44, height: 44, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }}><BusinessIcon fontSize="small" /></Avatar>
                                                    <Box flex={1} minWidth={0}>
                                                        <Typography variant="subtitle2" fontWeight="bold" noWrap>{m.organization?.name || m.orgName}</Typography>
                                                        <Typography variant="caption" color="text.secondary" display="block" noWrap>{m.orgRole || m.role || 'Tag'}</Typography>
                                                    </Box>

                                                    {/* Belépés és Kilépés gombok! */}
                                                    <Box display="flex" gap={0.5}>
                                                        <Tooltip title="Belépés a felületre">
                                                            <IconButton size="small" color="primary" onClick={() => orgId && handleOrgClick(orgId, m.organization?.tenantId)} sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
                                                                <ExitToAppIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                        {user?.role !== 'SYS_ADMIN' && (
                                                            <Tooltip title="Kilépés a csapatból">
                                                                <IconButton size="small" color="error" onClick={() => orgId && handleLeaveOrg(orgId)}>
                                                                    <RemoveCircleOutlineIcon fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                        )}
                                                    </Box>
                                                </Box>
                                            </ListItem>
                                        );
                                    })
                                )}
                            </List>

                            {/* Felfedezés gomb a lista alján */}
                            <Box p={2} borderTop="1px solid" borderColor="divider" bgcolor={isDarkMode ? 'rgba(0,0,0,0.2)' : '#f8fafc'}>
                                <Button
                                    fullWidth variant="contained" disableElevation
                                    startIcon={<SearchIcon />} onClick={() => setIsDiscoverOpen(true)}
                                    sx={{ borderRadius: 3, py: 1.2, fontWeight: 'bold' }}
                                >
                                    Új közösség keresése
                                </Button>
                            </Box>
                        </Paper>
                    </Box>
                </Grid>
            </Grid>

            {/* ========================================================================= */}
            {/* FELFEDEZÉS MODAL (DIALOG) */}
            {/* ========================================================================= */}
            <Dialog
                open={isDiscoverOpen}
                onClose={() => setIsDiscoverOpen(false)}
                maxWidth="md" fullWidth
                PaperProps={{ sx: { borderRadius: 4, bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.98)' : '#f8fafc', minHeight: '60vh' } }}
            >
                <DialogTitle sx={{ fontWeight: '900', borderBottom: '1px solid', borderColor: 'divider', pb: 2 }}>
                    Közösségek felfedezése
                </DialogTitle>
                <DialogContent sx={{ p: { xs: 2, sm: 3 }, pt: '24px !important' }}>
                    <TextField
                        fullWidth placeholder="Keress szervezetet név alapján..."
                        value={discoverSearch} onChange={(e) => setDiscoverSearch(e.target.value)}
                        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment> }}
                        sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: 3, bgcolor: 'background.paper' } }}
                    />

                    <Grid container spacing={2}>
                        {discoverOrgs.length === 0 ? (
                            <Grid size={{xs: 12}}>
                                <Typography variant="body1" color="text.secondary" textAlign="center" py={4}>Nem találtunk a keresésnek megfelelő szervezetet.</Typography>
                            </Grid>
                        ) : (
                            discoverOrgs.map((org: Organization) => {
                                const membership = enrichedMemberships.find((m: Membership) => m.orgId === org.id);
                                const status = membership?.status;
                                const rejectionMessage = membership?.rejectionMessage;
                                const isSysAdmin = user?.role === 'SYS_ADMIN';

                                return (
                                    <Grid size={{xs:12, sm:6}} key={org.id}>
                                        <Card elevation={0} sx={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                                            <CardContent sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 2, p: 2 }}>
                                                <Avatar src={getImageUrl(org.logoUrl)} sx={{ width: 56, height: 56, bgcolor: alpha(theme.palette.secondary.main, 0.1), color: 'secondary.main' }}><BusinessIcon /></Avatar>
                                                <Box flex={1} minWidth={0}>
                                                    <Typography variant="subtitle1" fontWeight="900" noWrap>{org.name}</Typography>

                                                    {status === 'APPROVED' ? <Typography variant="caption" color="success.main" fontWeight="bold">Már tag vagy</Typography>
                                                        : status === 'PENDING' ? <Typography variant="caption" color="warning.main" fontWeight="bold"><AccessTimeIcon sx={{ fontSize: 10, verticalAlign: 'middle', mr: 0.5 }}/>Függőben</Typography>
                                                            : (status === 'REJECTED' || status === 'REMOVED') ? <Typography variant="caption" color="error.main" fontWeight="bold"><ErrorOutlineIcon sx={{ fontSize: 10, verticalAlign: 'middle', mr: 0.5 }}/>Elutasítva</Typography>
                                                                : <Typography variant="caption" color="text.secondary" noWrap display="block">{org.address}</Typography>
                                                    }
                                                </Box>
                                            </CardContent>

                                            {(status === 'REJECTED' || status === 'REMOVED') && (
                                                <Box px={2} pb={1}>
                                                    <Alert severity="error" icon={false} sx={{ py: 0, px: 1, borderRadius: 2, '& .MuiAlert-message': { width: '100%', padding: 0 } }}>
                                                        <Box display="flex" justifyContent="space-between" alignItems="center">
                                                            <Typography variant="caption" fontWeight="bold" color="error.dark">Indoklás</Typography>
                                                            {rejectionMessage && <Button size="small" onClick={() => toggleMessage(org.id)} sx={{ p: 0, minWidth: 'auto', fontSize: '0.7rem' }}>{expandedMessages[org.id] ? 'Elrejt' : 'Mutat'}</Button>}
                                                        </Box>
                                                        <Collapse in={expandedMessages[org.id]}>
                                                            <Typography variant="caption" color="error.main" sx={{ fontStyle: 'italic', display: 'block', mt: 0.5 }}>{rejectionMessage || "Nincs megadva."}</Typography>
                                                        </Collapse>
                                                    </Alert>
                                                </Box>
                                            )}

                                            <CardActions sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider', bgcolor: alpha(theme.palette.primary.main, 0.02) }}>
                                                {isSysAdmin || status === 'APPROVED' ? (
                                                    <Button variant="contained" size="small" fullWidth disableElevation sx={{ borderRadius: 2, fontWeight: 'bold' }} onClick={() => { setIsDiscoverOpen(false); handleOrgClick(org.id, org.tenantId); }}>Belépés</Button>
                                                ) : status === 'PENDING' ? (
                                                    <Button variant="contained" size="small" disabled fullWidth sx={{ borderRadius: 2, fontWeight: 'bold' }}>Függőben</Button>
                                                ) : (
                                                    <Button variant="contained" size="small" color="primary" fullWidth disableElevation sx={{ borderRadius: 2, fontWeight: 'bold' }} onClick={() => handleJoinOrg(org.id)}>Csatlakozás</Button>
                                                )}
                                            </CardActions>
                                        </Card>
                                    </Grid>
                                );
                            })
                        )}
                    </Grid>
                </DialogContent>
                <DialogActions sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                    <Button onClick={() => setIsDiscoverOpen(false)} sx={{ fontWeight: 'bold' }} color="inherit">Bezárás</Button>
                </DialogActions>
            </Dialog>

        </Container>
    );
}