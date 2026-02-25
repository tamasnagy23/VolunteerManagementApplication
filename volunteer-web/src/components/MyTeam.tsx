import { useEffect, useState } from 'react';
import {
    Container, Typography, Box, Paper, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, CircularProgress, Alert,
    FormControl, InputLabel, Select, MenuItem, Chip, Button, Divider
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
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
    id: number; // Membership ID
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

export default function MyTeam() {
    const navigate = useNavigate();
    const [users, setUsers] = useState<TeamMember[]>([]);
    const [pendingApps, setPendingApps] = useState<PendingApplication[]>([]);
    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [updatingKey, setUpdatingKey] = useState<string | null>(null);

    const [orgFilter, setOrgFilter] = useState('ALL');
    const [roleFilter, setRoleFilter] = useState('ALL');

    useEffect(() => {
        fetchTeamData();
    }, []);

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
            await api.put(`/users/${userId}/organizations/${orgId}/role`, null, {
                params: { newRole }
            });

            setUsers(prev => prev.map(u => u.id === userId ? {
                ...u,
                organizations: u.organizations.map(o => o.orgId === orgId ? { ...o, orgRole: newRole } : o)
            } : u));
        } catch (err: unknown) { // any helyett unknown
            console.error(err); // Így az 'err' már használt, eltűnik a linter hiba
            let errorMessage = "Hiba történt a módosításkor.";

            // Típusbiztos hibaellenőrzés any nélkül
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
            console.error(err); // ESLint hiba megoldva
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

    const isSysAdmin = currentUser?.role === 'SYS_ADMIN';
    const myDetailedProfile = users.find(u => u.email === currentUser?.email);

    // --- SZŰRÉSI LOGIKA ---
    const filteredUsers = users.filter(user => {
        const matchesOrg = orgFilter === 'ALL' || user.organizations.some(o => o.orgName === orgFilter);
        const matchesRole = roleFilter === 'ALL' || user.organizations.some(o => o.orgRole === roleFilter);
        return matchesOrg && matchesRole;
    });

    const allOrgs = Array.from(new Set(
        users.flatMap(u =>
            u.organizations
                .filter(o => isSysAdmin || myDetailedProfile?.organizations.some(myOrg => myOrg.orgId === o.orgId))
                .map(o => o.orgName)
        )
    )).sort();

    if (loading) return <Box display="flex" justifyContent="center" mt={10}><CircularProgress /></Box>;

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/dashboard')} sx={{ mb: 3 }}>
                Vissza a Dashboardra
            </Button>

            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h4" fontWeight="bold" color="primary">Csapat Kezelése</Typography>
                <Chip label={`Tagok: ${filteredUsers.length} fő`} color="primary" variant="outlined" />
            </Box>

            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

            {/* --- ÚJ JELENTKEZŐK SZEKCIÓ (Csak ha van függőben lévő) --- */}
            {pendingApps.length > 0 && (
                <Box sx={{ mb: 6 }}>
                    <Typography variant="h5" fontWeight="bold" color="warning.main" gutterBottom>
                        Függőben lévő jelentkezések
                    </Typography>
                    <TableContainer component={Paper} elevation={4} sx={{ borderRadius: 3, border: '1px solid #ed6c02' }}>
                        <Table size="small">
                            <TableHead sx={{ bgcolor: '#fff3e0' }}>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Név / Email</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Telefon</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>Szervezet</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold', textAlign: 'right' }}>Műveletek</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {pendingApps.map((app) => (
                                    <TableRow key={app.id}>
                                        <TableCell>
                                            <Typography variant="body2" fontWeight="bold">{app.userName}</Typography>
                                            <Typography variant="caption" color="text.secondary">{app.userEmail}</Typography>
                                        </TableCell>
                                        <TableCell>{app.userPhone}</TableCell>
                                        <TableCell><Chip label={app.orgName} size="small" variant="outlined" /></TableCell>
                                        <TableCell sx={{ textAlign: 'right' }}>
                                            <Box display="flex" justifyContent="flex-end" gap={1}>
                                                <Button
                                                    variant="contained" color="success" size="small" startIcon={<CheckIcon />}
                                                    onClick={() => handleApplication(app.id, 'APPROVED')}
                                                    disabled={updatingKey === `app-${app.id}`}
                                                >
                                                    Elfogad
                                                </Button>
                                                <Button
                                                    variant="outlined" color="error" size="small" startIcon={<CloseIcon />}
                                                    onClick={() => handleApplication(app.id, 'REJECTED')}
                                                    disabled={updatingKey === `app-${app.id}`}
                                                >
                                                    Elutasít
                                                </Button>
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>
            )}

            <Divider sx={{ mb: 4 }} />

            {/* --- SZŰRŐK ÉS A MEGLÉVŐ TÁBLÁZAT --- */}
            <Typography variant="h5" fontWeight="bold" sx={{ mb: 2 }}>Aktív Csapattagok</Typography>

            <Paper elevation={2} sx={{ p: 3, mb: 4, borderRadius: 2, bgcolor: '#fcfcfc', display: 'flex', gap: 3 }}>
                <FormControl sx={{ minWidth: 200 }} size="small">
                    <InputLabel id="org-filter-label">Szervezet</InputLabel>
                    <Select labelId="org-filter-label" value={orgFilter} label="Szervezet" onChange={(e) => setOrgFilter(e.target.value)}>
                        <MenuItem value="ALL">Összes szervezet</MenuItem>
                        {allOrgs.map(name => <MenuItem key={name} value={name}>{name}</MenuItem>)}
                    </Select>
                </FormControl>

                <FormControl sx={{ minWidth: 200 }} size="small">
                    <InputLabel id="role-filter-label">Szerepkör</InputLabel>
                    <Select labelId="role-filter-label" value={roleFilter} label="Szerepkör" onChange={(e) => setRoleFilter(e.target.value)}>
                        <MenuItem value="ALL">Minden szerepkör</MenuItem>
                        <MenuItem value="ORGANIZER">Szervező</MenuItem>
                        <MenuItem value="COORDINATOR">Koordinátor</MenuItem>
                        <MenuItem value="VOLUNTEER">Önkéntes</MenuItem>
                    </Select>
                </FormControl>
            </Paper>

            <TableContainer component={Paper} elevation={4} sx={{ borderRadius: 3, overflow: 'hidden' }}>
                <Table>
                    <TableHead sx={{ bgcolor: 'primary.main' }}>
                        <TableRow>
                            <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Felhasználó</TableCell>
                            <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Globális Profil</TableCell>
                            <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Szervezeti Tagságok és Jogok</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredUsers.map((user) => {
                            const visibleOrgs = user.organizations.filter(org =>
                                isSysAdmin || myDetailedProfile?.organizations.some(myOrg => myOrg.orgId === org.orgId)
                            );

                            if (visibleOrgs.length === 0) return null;

                            return (
                                <TableRow key={user.id} hover>
                                    <TableCell>
                                        <Typography fontWeight="bold">{user.name}</Typography>
                                        <Typography variant="body2" color="text.secondary">{user.email}</Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={user.globalRole === 'SYS_ADMIN' ? 'Admin' : 'User'}
                                            size="small"
                                            color={user.globalRole === 'SYS_ADMIN' ? 'error' : 'default'}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Box display="flex" flexDirection="column" gap={1.5}>
                                            {visibleOrgs.map((org) => {
                                                const isSelf = user.email === currentUser?.email;
                                                const myRoleInThisOrg = myDetailedProfile?.organizations.find(myOrg => myOrg.orgId === org.orgId)?.orgRole;

                                                const canEdit = isSysAdmin ||
                                                    (!isSelf && org.orgRole !== 'OWNER' &&
                                                        (myRoleInThisOrg === 'OWNER' || myRoleInThisOrg === 'ORGANIZER'));

                                                return (
                                                    <Paper key={org.orgId} variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#fbfbfb' }}>
                                                        <Typography variant="body2" fontWeight="medium">{org.orgName}</Typography>

                                                        <Box display="flex" alignItems="center" gap={1}>
                                                            {canEdit ? (
                                                                <FormControl size="small" sx={{ minWidth: 140 }}>
                                                                    <Select
                                                                        value={org.orgRole}
                                                                        disabled={updatingKey === `${user.id}-${org.orgId}`}
                                                                        onChange={(e) => handleOrgRoleChange(user.id, org.orgId, e.target.value)}
                                                                    >
                                                                        <MenuItem value="VOLUNTEER">Önkéntes</MenuItem>
                                                                        <MenuItem value="COORDINATOR">Koordinátor</MenuItem>
                                                                        <MenuItem value="ORGANIZER">Szervező</MenuItem>
                                                                        <MenuItem value="OWNER" disabled>Alapító</MenuItem>
                                                                    </Select>
                                                                </FormControl>
                                                            ) : (
                                                                <Chip label={org.orgRole} size="small" variant="filled" color="secondary" />
                                                            )}
                                                            {updatingKey === `${user.id}-${org.orgId}` && <CircularProgress size={16} />}
                                                        </Box>
                                                    </Paper>
                                                );
                                            })}
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
        </Container>
    );
}