import { useEffect, useState } from 'react';
import {
    Container, Typography, Box, Paper, CircularProgress, Alert,
    FormControl, InputLabel, Select, MenuItem, Chip, Button, Divider, Stack,
    TextField, InputAdornment, Pagination, Dialog, DialogTitle, DialogContent,
    DialogActions, IconButton, Tooltip
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

// --- INTERFÉSZEK ---
interface OrgMembership {
    orgId: number;
    orgName: string;
    orgRole: string;
}

interface TeamMember {
    id: number;
    name: string;
    email: string;
    globalRole: string;
    phoneNumber: string;
    organizations: OrgMembership[];
}

interface PendingApplication {
    id: number;
    userName: string;
    userEmail: string;
    userPhone: string;
    orgName: string;
    orgId: number;
}

interface CurrentUser {
    role: string;
    email: string;
}

const ROLE_WEIGHTS: Record<string, number> = {
    'OWNER': 4,
    'ORGANIZER': 3,
    'COORDINATOR': 2,
    'VOLUNTEER': 1
};

// --- ÚJ: Magyar fordítások és színek a Chipekhez ---
const ROLE_LABELS: Record<string, string> = {
    'VOLUNTEER': 'Önkéntes',
    'COORDINATOR': 'Koordinátor',
    'ORGANIZER': 'Szervező',
    'OWNER': 'Alapító'
};

const ROLE_COLORS: Record<string, "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning"> = {
    'VOLUNTEER': 'default',
    'COORDINATOR': 'info',
    'ORGANIZER': 'secondary',
    'OWNER': 'error'
};

export default function MyTeam() {
    const navigate = useNavigate();
    const [users, setUsers] = useState<TeamMember[]>([]);
    const [pendingApps, setPendingApps] = useState<PendingApplication[]>([]);
    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [updatingKey, setUpdatingKey] = useState<string | null>(null);

    // Keresés, Szűrés, Lapozás
    const [searchQuery, setSearchQuery] = useState('');
    const [orgFilter, setOrgFilter] = useState('ALL');
    const [roleFilter, setRoleFilter] = useState('ALL');
    const [sortOrder, setSortOrder] = useState('NAME_ASC');
    const [page, setPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    // Állapotok a Modalokhoz
    const [selectedUser, setSelectedUser] = useState<TeamMember | null>(null);
    const [memberToDelete, setMemberToDelete] = useState<{ userId: number, orgId: number, userName: string, orgName: string } | null>(null);

    useEffect(() => {
        fetchTeamData();
    }, []);

    useEffect(() => {
        setPage(1);
    }, [searchQuery, orgFilter, roleFilter, sortOrder]);

    const fetchTeamData = async () => {
        try {
            setLoading(true);
            const [meRes, teamRes, appsRes] = await Promise.all([
                api.get<CurrentUser>('/users/me'),
                api.get<TeamMember[]>('/users/team'),
                api.get<PendingApplication[]>('/organizations/applications/pending')
            ]);
            setCurrentUser(meRes.data);
            setUsers(teamRes.data);
            setPendingApps(appsRes.data);
        } catch (err) {
            console.error(err);
            setError("Nem sikerült betölteni a csapat adatait.");
        } finally {
            setLoading(false);
        }
    };

    const handleOrgRoleChange = async (userId: number, orgId: number, newRole: string) => {
        try {
            setUpdatingKey(`${userId}-${orgId}`);
            setError('');
            await api.put(`/users/${userId}/organizations/${orgId}/role`, null, { params: { newRole } });
            setUsers(prev => prev.map(u => u.id === userId ? {
                ...u, organizations: u.organizations.map(o => o.orgId === orgId ? { ...o, orgRole: newRole } : o)
            } : u));
        } catch (err: unknown) {
            let errorMessage = "Hiba történt a módosításkor.";
            if (err && typeof err === 'object' && 'response' in err) {
                const axiosError = err as { response: { data: { message?: string } } };
                errorMessage = axiosError.response.data.message || errorMessage;
            }
            setError(errorMessage);
        } finally {
            setUpdatingKey(null);
        }
    };

    const handleApplication = async (appId: number, status: 'APPROVED' | 'REJECTED') => {
        try {
            setUpdatingKey(`app-${appId}`);
            setError('');
            await api.put(`/organizations/applications/${appId}`, null, { params: { status } });
            setPendingApps(prev => prev.filter(app => app.id !== appId));
            if (status === 'APPROVED') {
                const teamRes = await api.get<TeamMember[]>('/users/team');
                setUsers(teamRes.data);
            }
        } catch (err: unknown) {
            let errorMessage = "Nem sikerült elbírálni a jelentkezést.";
            if (err && typeof err === 'object' && 'response' in err) {
                const axiosError = err as { response: { data: { message?: string } } };
                errorMessage = axiosError.response.data.message || errorMessage;
            }
            setError(errorMessage);
        } finally {
            setUpdatingKey(null);
        }
    };

    const handleRemoveMember = async () => {
        if (!memberToDelete) return;
        try {
            setUpdatingKey(`del-${memberToDelete.userId}-${memberToDelete.orgId}`);
            setError('');
            await api.delete(`/users/${memberToDelete.userId}/organizations/${memberToDelete.orgId}`);
            const teamRes = await api.get<TeamMember[]>('/users/team');
            setUsers(teamRes.data);
        } catch (err: unknown) {
            let errorMessage = "Hiba történt az eltávolításkor.";
            if (err && typeof err === 'object' && 'response' in err) {
                const axiosError = err as { response: { data: { message?: string } } };
                errorMessage = axiosError.response.data.message || errorMessage;
            }
            setError(errorMessage);
        } finally {
            setUpdatingKey(null);
            setMemberToDelete(null);
        }
    };

    const handleExportCSV = () => {
        const headers = ['Nev', 'Email', 'Telefon', 'Szervezet', 'Szerepkor'];
        const rows: string[] = [];

        processedUsers.forEach(user => {
            user.organizations.forEach(org => {
                if (orgFilter === 'ALL' || org.orgName === orgFilter) {
                    rows.push(`"${user.name}","${user.email}","${user.phoneNumber || '-'}","${org.orgName}","${ROLE_LABELS[org.orgRole] || org.orgRole}"`);
                }
            });
        });

        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + headers.join(',') + '\n' + rows.join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `csapat_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    const isSysAdmin = currentUser?.role === 'SYS_ADMIN';
    const myDetailedProfile = users.find(u => u.email === currentUser?.email);

    const getHighestRoleWeight = (user: TeamMember) => {
        const visibleOrgs = user.organizations.filter(org => isSysAdmin || myDetailedProfile?.organizations.some(myOrg => myOrg.orgId === org.orgId));
        let maxWeight = 0;
        visibleOrgs.forEach(org => {
            const weight = ROLE_WEIGHTS[org.orgRole] || 0;
            if (weight > maxWeight) maxWeight = weight;
        });
        return maxWeight;
    };

    const processedUsers = users.filter(user => {
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch = user.name.toLowerCase().includes(searchLower) || user.email.toLowerCase().includes(searchLower);
        const matchesOrg = orgFilter === 'ALL' || user.organizations.some(o => o.orgName === orgFilter);
        const matchesRole = roleFilter === 'ALL' || user.organizations.some(o => o.orgRole === roleFilter);
        return matchesSearch && matchesOrg && matchesRole;
    }).sort((a, b) => {
        if (sortOrder === 'NAME_ASC') return a.name.localeCompare(b.name);
        if (sortOrder === 'NAME_DESC') return b.name.localeCompare(a.name);
        if (sortOrder === 'ROLE_DESC') return getHighestRoleWeight(b) - getHighestRoleWeight(a);
        if (sortOrder === 'ROLE_ASC') return getHighestRoleWeight(a) - getHighestRoleWeight(b);
        return 0;
    });

    const totalPages = Math.ceil(processedUsers.length / ITEMS_PER_PAGE);
    const paginatedUsers = processedUsers.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    const handlePageChange = (_event: React.ChangeEvent<unknown>, value: number) => {
        setPage(value);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const allOrgs = Array.from(new Set(
        users.flatMap(u => u.organizations.filter(o => isSysAdmin || myDetailedProfile?.organizations.some(myOrg => myOrg.orgId === o.orgId)).map(o => o.orgName))
    )).sort();

    if (loading) return <Box display="flex" justifyContent="center" mt={10}><CircularProgress /></Box>;

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/dashboard')} sx={{ mb: 3 }}>
                Vissza a Dashboardra
            </Button>

            <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={2} mb={3}>
                <Typography variant="h4" fontWeight="bold" color="primary">Csapat Kezelése</Typography>
                <Chip label={`Tagok: ${processedUsers.length} fő`} color="primary" variant="outlined" />
            </Box>

            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

            {/* FÜGGŐBEN LÉVŐK */}
            {pendingApps.length > 0 && (
                <Box sx={{ mb: 6 }}>
                    <Typography variant="h5" fontWeight="bold" color="warning.main" gutterBottom>Függőben lévő jelentkezések</Typography>
                    <Stack spacing={2}>
                        {pendingApps.map((app) => (
                            <Paper key={app.id} elevation={3} sx={{ p: 2, borderRadius: 2, borderLeft: '5px solid #ed6c02', display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, gap: 2 }}>
                                <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} gap={{ xs: 1, sm: 4 }} flexGrow={1}>
                                    <Box minWidth={200}>
                                        <Typography variant="body1" fontWeight="bold">{app.userName}</Typography>
                                        <Typography variant="body2" color="text.secondary">{app.userEmail}</Typography>
                                    </Box>
                                    <Box display="flex" alignItems="center"><Typography variant="body2" sx={{ bgcolor: '#f5f5f5', px: 1, py: 0.5, borderRadius: 1 }}>{app.userPhone}</Typography></Box>
                                    <Box display="flex" alignItems="center"><Chip label={app.orgName} size="small" variant="outlined" color="warning" /></Box>
                                </Box>
                                <Box display="flex" width={{ xs: '100%', md: 'auto' }} gap={1} justifyContent="flex-end">
                                    <Button sx={{ width: { xs: '100%', md: 'auto' } }} variant="contained" color="success" size="small" startIcon={<CheckIcon />} onClick={() => handleApplication(app.id, 'APPROVED')} disabled={!!updatingKey}>Elfogad</Button>
                                    <Button sx={{ width: { xs: '100%', md: 'auto' } }} variant="outlined" color="error" size="small" startIcon={<CloseIcon />} onClick={() => handleApplication(app.id, 'REJECTED')} disabled={!!updatingKey}>Elutasít</Button>
                                </Box>
                            </Paper>
                        ))}
                    </Stack>
                </Box>
            )}

            <Divider sx={{ mb: 4 }} />

            <Typography variant="h5" fontWeight="bold" sx={{ mb: 2 }}>Aktív Csapattagok</Typography>

            {/* KERESŐ ÉS SZŰRŐK */}
            <Paper elevation={2} sx={{ p: 2, mb: 4, borderRadius: 2, bgcolor: '#fcfcfc', display: 'flex', flexDirection: { xs: 'column', md: 'row' }, flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
                <TextField size="small" placeholder="Keresés..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} sx={{ flexGrow: 1, minWidth: { xs: '100%', md: '200px' } }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }} />
                <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: '150px' } }}>
                    <InputLabel id="org-filter">Szervezet</InputLabel>
                    <Select labelId="org-filter" value={orgFilter} label="Szervezet" onChange={(e) => setOrgFilter(e.target.value)}>
                        <MenuItem value="ALL">Összes szervezet</MenuItem>
                        {allOrgs.map(name => <MenuItem key={name} value={name}>{name}</MenuItem>)}
                    </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: '150px' } }}>
                    <InputLabel id="role-filter">Szerepkör</InputLabel>
                    <Select labelId="role-filter" value={roleFilter} label="Szerepkör" onChange={(e) => setRoleFilter(e.target.value)}>
                        <MenuItem value="ALL">Minden szerepkör</MenuItem>
                        <MenuItem value="ORGANIZER">Szervező</MenuItem>
                        <MenuItem value="COORDINATOR">Koordinátor</MenuItem>
                        <MenuItem value="VOLUNTEER">Önkéntes</MenuItem>
                    </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: '180px' } }}>
                    <InputLabel id="sort-order">Rendezés</InputLabel>
                    <Select labelId="sort-order" value={sortOrder} label="Rendezés" onChange={(e) => setSortOrder(e.target.value)}>
                        <MenuItem value="NAME_ASC">Név szerint (A-Z)</MenuItem>
                        <MenuItem value="NAME_DESC">Név szerint (Z-A)</MenuItem>
                        <MenuItem value="ROLE_DESC">Szerepkör (Szervezőtől)</MenuItem>
                        <MenuItem value="ROLE_ASC">Szerepkör (Önkéntestől)</MenuItem>
                    </Select>
                </FormControl>
                <Button variant="contained" color="success" startIcon={<DownloadIcon />} onClick={handleExportCSV} sx={{ minWidth: { xs: '100%', md: 'auto' } }}>
                    Exportálás
                </Button>
            </Paper>

            {/* AKTÍV TAGOK LISTÁJA */}
            {paginatedUsers.length === 0 ? (
                <Alert severity="info" sx={{ mt: 2 }}>Nincs megjeleníthető csapattag.</Alert>
            ) : (
                <Stack spacing={2.5}>
                    {paginatedUsers.map((user) => {
                        const visibleOrgs = user.organizations.filter(org => isSysAdmin || myDetailedProfile?.organizations.some(myOrg => myOrg.orgId === org.orgId));
                        if (visibleOrgs.length === 0) return null;

                        return (
                            <Paper key={user.id} elevation={3} sx={{ borderRadius: 2, overflow: 'hidden' }}>
                                <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }}>

                                    <Box sx={{ p: 2.5, bgcolor: 'primary.main', color: 'white', minWidth: { md: '280px' }, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                        <Typography
                                            variant="h6" fontWeight="bold"
                                            sx={{ wordBreak: 'break-word', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                                            onClick={() => setSelectedUser(user)}
                                        >
                                            {user.name}
                                        </Typography>
                                        <Typography variant="body2" sx={{ opacity: 0.9, mb: 2, wordBreak: 'break-word' }}>{user.email}</Typography>
                                        <Box><Chip label={user.globalRole === 'SYS_ADMIN' ? 'Rendszergazda' : 'Felhasználó'} size="small" sx={{ bgcolor: user.globalRole === 'SYS_ADMIN' ? 'error.main' : 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 'bold' }} /></Box>
                                    </Box>

                                    <Box sx={{ p: 2, flexGrow: 1, bgcolor: '#ffffff' }}>
                                        <Stack spacing={1.5}>
                                            {visibleOrgs.map((org) => {
                                                const isSelf = user.email === currentUser?.email;
                                                const myRoleInThisOrg = myDetailedProfile?.organizations.find(myOrg => myOrg.orgId === org.orgId)?.orgRole;
                                                const canEdit = isSysAdmin || (!isSelf && org.orgRole !== 'OWNER' && (myRoleInThisOrg === 'OWNER' || myRoleInThisOrg === 'ORGANIZER'));

                                                return (
                                                    <Paper key={org.orgId} variant="outlined" sx={{ p: 1.5, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', gap: 2, bgcolor: '#fbfbfb', borderColor: '#e0e0e0' }}>
                                                        <Typography variant="body1" fontWeight="medium">{org.orgName}</Typography>

                                                        <Box display="flex" alignItems="center" width={{ xs: '100%', sm: 'auto' }} gap={1.5}>

                                                            {/* --- ÚJ: Kattintható Chip / Legördülő kombináció --- */}
                                                            <FormControl size="small">
                                                                <Select
                                                                    value={org.orgRole}
                                                                    disabled={!canEdit || updatingKey === `${user.id}-${org.orgId}`}
                                                                    onChange={(e) => handleOrgRoleChange(user.id, org.orgId, e.target.value)}
                                                                    sx={{
                                                                        boxShadow: 'none',
                                                                        '.MuiOutlinedInput-notchedOutline': { border: 0 },
                                                                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': { border: 0 },
                                                                        '&:hover .MuiOutlinedInput-notchedOutline': { border: 0 },
                                                                        pl: 0, pr: 0
                                                                    }}
                                                                    renderValue={(selected) => (
                                                                        <Chip
                                                                            label={ROLE_LABELS[selected as string]}
                                                                            color={ROLE_COLORS[selected as string]}
                                                                            size="small"
                                                                            variant={canEdit ? "filled" : "outlined"}
                                                                            sx={{
                                                                                fontWeight: 'bold',
                                                                                cursor: canEdit ? 'pointer' : 'default',
                                                                                opacity: (!canEdit && org.orgRole !== 'OWNER') ? 0.7 : 1
                                                                            }}
                                                                        />
                                                                    )}
                                                                >
                                                                    <MenuItem value="VOLUNTEER">Önkéntes</MenuItem>
                                                                    <MenuItem value="COORDINATOR">Koordinátor</MenuItem>
                                                                    <MenuItem value="ORGANIZER">Szervező</MenuItem>
                                                                    <MenuItem value="OWNER" disabled>Alapító</MenuItem>
                                                                </Select>
                                                            </FormControl>

                                                            <Tooltip title={org.orgRole === 'OWNER' ? "Az alapítót nem lehet eltávolítani" : !canEdit ? "Nincs jogosultságod az eltávolításhoz" : "Tag eltávolítása"}>
                                                                <span>
                                                                    <IconButton
                                                                        color="error"
                                                                        onClick={() => setMemberToDelete({ userId: user.id, orgId: org.orgId, userName: user.name, orgName: org.orgName })}
                                                                        disabled={!canEdit || org.orgRole === 'OWNER' || updatingKey === `${user.id}-${org.orgId}`}
                                                                    >
                                                                        <DeleteIcon />
                                                                    </IconButton>
                                                                </span>
                                                            </Tooltip>

                                                            {updatingKey === `${user.id}-${org.orgId}` && <CircularProgress size={20} />}
                                                        </Box>
                                                    </Paper>
                                                );
                                            })}
                                        </Stack>
                                    </Box>
                                </Box>
                            </Paper>
                        );
                    })}
                </Stack>
            )}

            {totalPages > 1 && (
                <Box display="flex" justifyContent="center" mt={4}>
                    <Pagination count={totalPages} page={page} onChange={handlePageChange} color="primary" size="large" showFirstButton showLastButton />
                </Box>
            )}

            {/* PROFIL FELUGRÓ ABLAK */}
            <Dialog open={!!selectedUser} onClose={() => setSelectedUser(null)} maxWidth="sm" fullWidth>
                {selectedUser && (
                    <>
                        <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 'bold' }}>
                            {selectedUser.name} - Profil Részletek
                        </DialogTitle>
                        <DialogContent dividers sx={{ p: 3 }}>
                            <Box display="flex" alignItems="center" gap={2} mb={2}>
                                <PersonIcon color="primary" />
                                <Typography variant="body1"><strong>Globális Szerepkör:</strong> {selectedUser.globalRole === 'SYS_ADMIN' ? 'Rendszergazda' : 'Felhasználó'}</Typography>
                            </Box>
                            <Box display="flex" alignItems="center" gap={2} mb={2}>
                                <EmailIcon color="primary" />
                                <Typography variant="body1"><strong>Email:</strong> {selectedUser.email}</Typography>
                            </Box>
                            <Box display="flex" alignItems="center" gap={2} mb={4}>
                                <PhoneIcon color="primary" />
                                <Typography variant="body1"><strong>Telefon:</strong> {selectedUser.phoneNumber || 'Nincs megadva'}</Typography>
                            </Box>
                            <Divider sx={{ mb: 2 }} />
                            <Typography variant="h6" fontWeight="bold" gutterBottom>Szervezeti Tagságok</Typography>
                            {selectedUser.organizations.map(org => (
                                <Box key={org.orgId} display="flex" justifyContent="space-between" mb={1}>
                                    <Typography variant="body2">• {org.orgName}</Typography>
                                    <Chip label={ROLE_LABELS[org.orgRole] || org.orgRole} color={ROLE_COLORS[org.orgRole] || 'default'} size="small" variant="outlined" />
                                </Box>
                            ))}
                        </DialogContent>
                        <DialogActions sx={{ p: 2 }}>
                            <Button onClick={() => setSelectedUser(null)} variant="contained">Bezárás</Button>
                        </DialogActions>
                    </>
                )}
            </Dialog>

            {/* TÖRLÉS MEGERŐSÍTŐ ABLAK */}
            <Dialog open={!!memberToDelete} onClose={() => setMemberToDelete(null)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ fontWeight: 'bold', color: 'error.main' }}>Tag eltávolítása</DialogTitle>
                <DialogContent>
                    <Typography>Biztosan el szeretnéd távolítani <strong>{memberToDelete?.userName}</strong> nevű tagot a(z) <strong>{memberToDelete?.orgName}</strong> szervezetből?</Typography>
                    <Typography variant="body2" color="error" sx={{ mt: 2 }}>Ez a művelet nem vonható vissza!</Typography>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setMemberToDelete(null)} color="inherit">Mégse</Button>
                    <Button onClick={handleRemoveMember} variant="contained" color="error" disabled={!!updatingKey}>
                        {updatingKey ? <CircularProgress size={24} color="inherit" /> : 'Eltávolítás'}
                    </Button>
                </DialogActions>
            </Dialog>

        </Container>
    );
}