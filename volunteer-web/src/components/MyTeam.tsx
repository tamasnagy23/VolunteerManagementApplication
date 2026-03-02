import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Container, Typography, Box, Paper, CircularProgress, Alert,
    FormControl, InputLabel, Select, MenuItem, Chip, Button, Divider,
    TextField, InputAdornment, Pagination, Dialog, DialogTitle, DialogContent,
    DialogActions, IconButton, Tooltip, Tabs, Tab, TableContainer, Table,
    TableHead, TableRow, TableCell, TableBody, Checkbox, useMediaQuery, useTheme,
    FormControlLabel, Avatar
} from '@mui/material';
import Grid from '@mui/material/Grid';

// Ikonok
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import PersonIcon from '@mui/icons-material/Person';
import PhoneIcon from '@mui/icons-material/Phone';
import CancelIcon from '@mui/icons-material/Cancel';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EmailIcon from '@mui/icons-material/Email';

import api from '../api/axios';
import * as XLSX from 'xlsx';

// --- INTERFÉSZEK ---
interface OrgMembership { orgId: number; orgName: string; orgRole: string; }
interface TeamMember { id: number; name: string; email: string; globalRole: string; phoneNumber: string; organizations: OrgMembership[]; }
interface PendingApplication { id: number; userName: string; userEmail: string; userPhone: string; orgName: string; orgId: number; status: string; rejectionMessage?: string; }
interface CurrentUser { role: string; email: string; }

// --- INTERFÉSZ AZ EXCEL EXPORTHOZ ---
interface ExportRow {
    name: string;
    email: string;
    phone: string;
    org: string;
    role: string;
    status: string;
}

const ROLE_WEIGHTS: Record<string, number> = { 'OWNER': 4, 'ORGANIZER': 3, 'COORDINATOR': 2, 'VOLUNTEER': 1 };
const ROLE_LABELS: Record<string, string> = { 'VOLUNTEER': 'Önkéntes', 'COORDINATOR': 'Koordinátor', 'ORGANIZER': 'Szervező', 'OWNER': 'Alapító' };
const ROLE_COLORS: Record<string, "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning"> = { 'VOLUNTEER': 'default', 'COORDINATOR': 'info', 'ORGANIZER': 'secondary', 'OWNER': 'error' };

export default function MyTeam() {
    const navigate = useNavigate();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const [users, setUsers] = useState<TeamMember[]>([]);
    const [pendingApps, setPendingApps] = useState<PendingApplication[]>([]);
    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [updatingKey, setUpdatingKey] = useState<string | null>(null);

    // UI Állapotok
    const [currentTab, setCurrentTab] = useState(0);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [orgFilter, setOrgFilter] = useState('ALL');
    const [roleFilter, setRoleFilter] = useState('ALL');
    const [sortOrder, setSortOrder] = useState('NAME_ASC');
    const [page, setPage] = useState(1);
    const ITEMS_PER_PAGE = isMobile ? 5 : 10;

    // Modal Állapotok
    const [selectedUser, setSelectedUser] = useState<TeamMember | null>(null);
    const [memberToDelete, setMemberToDelete] = useState<{ userId: number, orgId: number, userName: string, orgName: string } | null>(null);
    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [rejectTarget, setRejectTarget] = useState<number | 'BULK' | null>(null);
    const [rejectMessage, setRejectMessage] = useState('');

    const [emailModalOpen, setEmailModalOpen] = useState(false);
    const [emailSubject, setEmailSubject] = useState('');
    const [emailMessage, setEmailMessage] = useState('');
    const [sendingEmail, setSendingEmail] = useState(false);
    const [emailSuccessOpen, setEmailSuccessOpen] = useState(false); // <-- ÚJ ÁLLAPOT

    useEffect(() => { fetchTeamData(); }, []);

    // Fül váltásnál vagy szűrésnél töröljük a kijelöléseket, nehogy bent ragadjanak
    useEffect(() => { setPage(1); setSelectedIds([]); }, [searchQuery, orgFilter, roleFilter, sortOrder, currentTab]);

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
        } catch { setError("Nem sikerült betölteni a csapat adatait."); } finally { setLoading(false); }
    };

    const isSysAdmin = currentUser?.role === 'SYS_ADMIN';
    const myDetailedProfile = users.find(u => u.email === currentUser?.email);

    // --- MŰVELETEK ---
    const handleOrgRoleChange = async (userId: number, orgId: number, newRole: string) => {
        try {
            setUpdatingKey(`${userId}-${orgId}`); setError('');
            await api.put(`/users/${userId}/organizations/${orgId}/role`, null, { params: { newRole } });
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, organizations: u.organizations.map(o => o.orgId === orgId ? { ...o, orgRole: newRole } : o) } : u));
        } catch { alert("Hiba történt a módosításkor."); } finally { setUpdatingKey(null); }
    };

    const handleApplication = async (appId: number, status: 'APPROVED' | 'REJECTED') => {
        if (status === 'REJECTED') {
            setRejectTarget(appId); setRejectMessage(''); setRejectModalOpen(true); return;
        }
        try {
            setUpdatingKey(`app-${appId}`); setError('');
            await api.put(`/organizations/applications/${appId}`, null, { params: { status } });
            await fetchTeamData();
        } catch { alert("Nem sikerült elfogadni a jelentkezést."); } finally { setUpdatingKey(null); }
    };

    const handleBulkApplication = async (status: 'APPROVED' | 'REJECTED') => {
        if (status === 'REJECTED') {
            setRejectTarget('BULK'); setRejectMessage(''); setRejectModalOpen(true); return;
        }
        if (!window.confirm(`Biztosan elfogadod mind a(z) ${selectedIds.length} jelentkezőt?`)) return;
        try {
            setLoading(true);
            await Promise.all(selectedIds.map(id => api.put(`/organizations/applications/${id}`, null, { params: { status } })));
            setSelectedIds([]); await fetchTeamData();
            alert("Sikeres tömeges elfogadás!");
        } catch { alert("Hiba a tömeges művelet során."); } finally { setLoading(false); }
    };

    const confirmRejection = async () => {
        try {
            setLoading(true);
            if (rejectTarget === 'BULK') {
                await Promise.all(selectedIds.map(id => api.put(`/organizations/applications/${id}`, null, { params: { status: 'REJECTED', rejectionMessage: rejectMessage.trim() || undefined } })));
                setSelectedIds([]);
            } else if (rejectTarget !== null) {
                await api.put(`/organizations/applications/${rejectTarget}`, null, { params: { status: 'REJECTED', rejectionMessage: rejectMessage.trim() || undefined } });
            }
            setRejectModalOpen(false); await fetchTeamData();
        } catch { alert("Hiba történt az elutasítás során."); } finally { setLoading(false); }
    };

    const handleRemoveMember = async () => {
        if (!memberToDelete) return;
        try {
            setUpdatingKey(`del-${memberToDelete.userId}-${memberToDelete.orgId}`); setError('');
            await api.delete(`/users/${memberToDelete.userId}/organizations/${memberToDelete.orgId}`);
            await fetchTeamData();
        } catch { alert("Hiba történt az eltávolításkor."); } finally { setUpdatingKey(null); setMemberToDelete(null); }
    };

    const handleSendEmail = async () => {
        setSendingEmail(true);
        try {
            // Dinamikus végpont a fültől függően
            const endpoint = currentTab === 0 ? '/users/team/bulk-email' : '/applications/bulk-email';
            const payloadKey = currentTab === 0 ? 'userIds' : 'applicationIds';

            await api.post(endpoint, {
                [payloadKey]: selectedIds, subject: emailSubject, message: emailMessage
            });

            // BEZÁRJUK AZ ŰRLAPOT ÉS MEGJELENÍTJÜK A SIKER ABLAKOT
            setEmailModalOpen(false);
            setEmailSubject('');
            setEmailMessage('');
            setSelectedIds([]);
            setEmailSuccessOpen(true);

        } catch {
            alert("Hiba történt az üzenetek küldésekor.");
        } finally {
            setSendingEmail(false);
        }
    };

    // --- FELDOLGOZOTT LISTÁK ---
    const processedUsers = useMemo(() => {
        return users.filter(user => {
            const searchLower = searchQuery.toLowerCase();
            const matchesSearch = user.name.toLowerCase().includes(searchLower) || user.email.toLowerCase().includes(searchLower);
            const matchesOrg = orgFilter === 'ALL' || user.organizations.some(o => o.orgName === orgFilter);
            const matchesRole = roleFilter === 'ALL' || user.organizations.some(o => o.orgRole === roleFilter);
            return matchesSearch && matchesOrg && matchesRole;
        }).sort((a, b) => {
            const getHighestRoleWeight = (u: TeamMember) => {
                let max = 0; u.organizations.forEach(o => { if ((ROLE_WEIGHTS[o.orgRole] || 0) > max) max = ROLE_WEIGHTS[o.orgRole]; }); return max;
            };
            if (sortOrder === 'NAME_ASC') return a.name.localeCompare(b.name, 'hu');
            if (sortOrder === 'NAME_DESC') return b.name.localeCompare(a.name, 'hu');
            if (sortOrder === 'ROLE_DESC') return getHighestRoleWeight(b) - getHighestRoleWeight(a);
            if (sortOrder === 'ROLE_ASC') return getHighestRoleWeight(a) - getHighestRoleWeight(b);
            return 0;
        });
    }, [users, searchQuery, orgFilter, roleFilter, sortOrder]);

    const processedPendingApps = useMemo(() => {
        return pendingApps.filter(app => {
            const searchLower = searchQuery.toLowerCase();
            const matchesSearch = app.userName.toLowerCase().includes(searchLower) || app.userEmail.toLowerCase().includes(searchLower);
            const matchesOrg = orgFilter === 'ALL' || app.orgName === orgFilter;
            return matchesSearch && matchesOrg;
        }).sort((a, b) => a.userName.localeCompare(b.userName, 'hu'));
    }, [pendingApps, searchQuery, orgFilter]);

    // Lapozás Logika
    const currentListLength = currentTab === 0 ? processedUsers.length : processedPendingApps.length;
    const totalPages = Math.ceil(currentListLength / ITEMS_PER_PAGE);
    const paginatedUsers = processedUsers.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
    const paginatedApps = processedPendingApps.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    const allOrgs = Array.from(new Set(users.flatMap(u => u.organizations.filter(o => isSysAdmin || myDetailedProfile?.organizations.some(myOrg => myOrg.orgId === o.orgId)).map(o => o.orgName)))).sort();

    // --- EXPORTÁLÁS (OKOS EXCEL) ---
    const handleExportExcel = () => {
        const wb = XLSX.utils.book_new();
        const headers = ['Név', 'Email', 'Telefon', 'Szervezet', 'Szerepkör', 'Státusz'];

        const appendSheet = (data: ExportRow[], sheetName: string) => {
            const rows = data.map(row => [row.name, row.email, row.phone, row.org, row.role, row.status]);
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...rows]), sheetName.substring(0, 31));
        };

        const activeData: ExportRow[] = [];
        processedUsers.forEach(u => u.organizations.forEach(o => {
            if (orgFilter === 'ALL' || o.orgName === orgFilter) {
                activeData.push({ name: u.name, email: u.email, phone: u.phoneNumber || '-', org: o.orgName, role: ROLE_LABELS[o.orgRole], status: 'Aktív Tag' });
            }
        }));
        appendSheet(activeData, "Aktív Csapattagok");

        const pendingData: ExportRow[] = pendingApps.map(a => ({ name: a.userName, email: a.userEmail, phone: a.userPhone || '-', org: a.orgName, role: 'Önkéntes', status: 'Függőben' }));
        if (pendingData.length > 0) appendSheet(pendingData, "Függő Jelentkezések");

        allOrgs.forEach(orgName => {
            const orgSpecificData = activeData.filter(d => d.org === orgName);
            if (orgSpecificData.length > 0) appendSheet(orgSpecificData, orgName);
        });

        XLSX.writeFile(wb, `Csapat_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleSelectAllClick = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(currentTab === 0 ? paginatedUsers.map(u => u.id) : paginatedApps.map(a => a.id));
        } else { setSelectedIds([]); }
    };
    const handleSelectRow = (id: number) => { setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]); };

    if (loading && !rejectModalOpen) return <Box display="flex" justifyContent="center" mt={10}><CircularProgress size={60} /></Box>;

    return (
        <Container maxWidth="xl" sx={{ mt: 4, mb: 10 }}>
            {/* Fejléc */}
            <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={2} mb={4}>
                <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} gap={1}>
                    <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/dashboard')} sx={{ mb: { xs: 1, sm: 0 }, ml: { xs: -1, sm: 0 } }}>Vissza</Button>
                    <Typography variant="h4" sx={{ fontSize: { xs: '1.6rem', md: '2.125rem' }, fontWeight: 'bold' }}>Szervezeti Csapatok Kezelése</Typography>
                </Box>
                <Button variant="contained" color="success" startIcon={<DownloadIcon />} onClick={handleExportExcel} sx={{ whiteSpace: 'nowrap' }}>Okos Excel Export</Button>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                <Tabs value={currentTab} onChange={(_e, v) => setCurrentTab(v)} variant="scrollable" scrollButtons="auto">
                    <Tab label={<Typography fontWeight="bold">👥 Aktív Csapattagok ({processedUsers.length})</Typography>} />
                    <Tab label={<Typography fontWeight="bold">⏳ Függő Jelentkezések ({processedPendingApps.length})</Typography>} />
                </Tabs>
            </Box>

            {/* Kék Tömeges Művelet Sáv */}
            {selectedIds.length > 0 && (
                <Alert severity="info" sx={{ mb: 2, alignItems: 'center', bgcolor: '#e3f2fd' }}
                       action={
                           <Box display="flex" gap={1}>
                               <Button color="primary" variant="contained" size="small" startIcon={<EmailIcon />} onClick={() => setEmailModalOpen(true)}>Üzenet</Button>

                               {/* Csak a Függő tabon mutatjuk az Elfogad/Elutasít gombokat */}
                               {currentTab === 1 && (
                                   <>
                                       <Button color="success" variant="contained" size="small" startIcon={<CheckCircleIcon />} onClick={() => handleBulkApplication('APPROVED')}>Elfogad</Button>
                                       <Button color="error" variant="contained" size="small" startIcon={<CancelIcon />} onClick={() => handleBulkApplication('REJECTED')}>Elutasít</Button>
                                   </>
                               )}
                           </Box>
                       }
                ><strong>{selectedIds.length}</strong> {currentTab === 0 ? 'aktív tag' : 'jelentkező'} kiválasztva.</Alert>
            )}

            {/* Szűrők */}
            <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: '#fbfbfb', display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', borderRadius: 2 }}>
                <TextField size="small" placeholder="Név vagy Email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} sx={{ minWidth: { xs: '100%', sm: 200 } }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }} />
                <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 200 } }}>
                    <InputLabel>Szervezet</InputLabel>
                    <Select value={orgFilter} label="Szervezet" onChange={(e) => setOrgFilter(e.target.value)}>
                        <MenuItem value="ALL">Összes szervezet</MenuItem>
                        {allOrgs.map(name => <MenuItem key={name} value={name}>{name}</MenuItem>)}
                    </Select>
                </FormControl>
                {currentTab === 0 && (
                    <>
                        <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 150 } }}>
                            <InputLabel>Szerepkör</InputLabel>
                            <Select value={roleFilter} label="Szerepkör" onChange={(e) => setRoleFilter(e.target.value)}>
                                <MenuItem value="ALL">Minden szerepkör</MenuItem>
                                <MenuItem value="ORGANIZER">Szervező</MenuItem>
                                <MenuItem value="COORDINATOR">Koordinátor</MenuItem>
                                <MenuItem value="VOLUNTEER">Önkéntes</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 180 } }}>
                            <InputLabel>Rendezés</InputLabel>
                            <Select value={sortOrder} label="Rendezés" onChange={(e) => setSortOrder(e.target.value)}>
                                <MenuItem value="NAME_ASC">Név szerint (A-Z)</MenuItem>
                                <MenuItem value="NAME_DESC">Név szerint (Z-A)</MenuItem>
                                <MenuItem value="ROLE_DESC">Szerepkör (Szervezőtől)</MenuItem>
                                <MenuItem value="ROLE_ASC">Szerepkör (Önkéntestől)</MenuItem>
                            </Select>
                        </FormControl>
                    </>
                )}
            </Paper>

            {/* ÖSSZES KIJELÖLÉSE GOMB AZ AKTÍV TAGOK FÖLÉ */}
            {currentTab === 0 && paginatedUsers.length > 0 && (
                <Box mb={2} px={1}>
                    <FormControlLabel
                        control={
                            <Checkbox
                                indeterminate={selectedIds.length > 0 && selectedIds.length < paginatedUsers.length}
                                checked={paginatedUsers.length > 0 && selectedIds.length === paginatedUsers.length}
                                onChange={handleSelectAllClick}
                            />
                        }
                        label={<Typography variant="body2" fontWeight="bold">Összes kijelölése ezen az oldalon</Typography>}
                    />
                </Box>
            )}

            {/* TARTALOM MEGJELENÍTÉSE */}
            {currentListLength === 0 ? (
                <Paper sx={{ p: 5, textAlign: 'center', color: 'text.secondary', borderRadius: 3 }}>Nincs találat. Próbáld módosítani a szűrőket!</Paper>
            ) : currentTab === 1 ? (
                /* FÜGGŐ JELENTKEZÉSEK */
                <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 2 }}>
                    <Table>
                        <TableHead sx={{ bgcolor: '#fff3e0' }}>
                            <TableRow>
                                <TableCell padding="checkbox"><Checkbox onChange={handleSelectAllClick} checked={selectedIds.length === paginatedApps.length && paginatedApps.length > 0} /></TableCell>
                                <TableCell><strong>Jelentkező Neve</strong></TableCell>
                                <TableCell><strong>Email & Telefon</strong></TableCell>
                                <TableCell><strong>Szervezet</strong></TableCell>
                                <TableCell align="center"><strong>Művelet</strong></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {paginatedApps.map((app) => (
                                <TableRow key={app.id} hover selected={selectedIds.includes(app.id)}>
                                    <TableCell padding="checkbox"><Checkbox checked={selectedIds.includes(app.id)} onChange={() => handleSelectRow(app.id)} /></TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>{app.userName}</TableCell>
                                    <TableCell>
                                        <Typography variant="body2">{app.userEmail}</Typography>
                                        <Typography variant="caption" color="text.secondary">{app.userPhone}</Typography>
                                    </TableCell>
                                    <TableCell><Chip label={app.orgName} size="small" variant="outlined" color="warning" sx={{ fontWeight: 'bold' }} /></TableCell>
                                    <TableCell align="center">
                                        <Box display="flex" justifyContent="center" gap={1}>
                                            <Button variant="contained" color="success" size="small" startIcon={<CheckIcon />} onClick={() => handleApplication(app.id, 'APPROVED')} disabled={!!updatingKey}>Elfogad</Button>
                                            <Button variant="outlined" color="error" size="small" startIcon={<CloseIcon />} onClick={() => handleApplication(app.id, 'REJECTED')} disabled={!!updatingKey}>Elutasít</Button>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            ) : (
                /* AKTÍV TAGOK (Kártyás) */
                <Grid container spacing={2}>
                    {paginatedUsers.map((user) => {
                        const visibleOrgs = user.organizations.filter(org => isSysAdmin || myDetailedProfile?.organizations.some(myOrg => myOrg.orgId === org.orgId));
                        if (visibleOrgs.length === 0) return null;

                        return (
                            <Grid size={{ xs: 12 }} key={user.id}>
                                <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden', display: 'flex', flexDirection: { xs: 'column', md: 'row' } }}>

                                    <Box sx={{ p: 2, bgcolor: '#f4fafe', minWidth: { md: '300px' }, borderRight: { md: '1px solid #e0e0e0' } }}>
                                        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                                            <Box display="flex" alignItems="flex-start" gap={1}>
                                                <Checkbox checked={selectedIds.includes(user.id)} onChange={() => handleSelectRow(user.id)} sx={{ p: 0, mt: 0.5 }} />
                                                <Box>
                                                    <Typography variant="h6" fontWeight="bold" color="primary.main">{user.name}</Typography>
                                                    <Typography variant="body2" color="text.secondary" mb={1}>{user.email}</Typography>
                                                    <Typography variant="caption" display="block">📱 {user.phoneNumber || 'Nincs adat'}</Typography>
                                                </Box>
                                            </Box>
                                            <IconButton size="small" color="primary" onClick={() => setSelectedUser(user)}><VisibilityIcon /></IconButton>
                                        </Box>
                                    </Box>

                                    <Box sx={{ p: 2, flexGrow: 1 }}>
                                        <Grid container spacing={2}>
                                            {visibleOrgs.map((org) => {
                                                const isSelf = user.email === currentUser?.email;
                                                const myRoleInThisOrg = myDetailedProfile?.organizations.find(myOrg => myOrg.orgId === org.orgId)?.orgRole;
                                                const canEdit = isSysAdmin || (!isSelf && org.orgRole !== 'OWNER' && (myRoleInThisOrg === 'OWNER' || myRoleInThisOrg === 'ORGANIZER'));

                                                return (
                                                    <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={org.orgId}>
                                                        <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1, height: '100%', borderColor: '#e0e0e0', bgcolor: '#fafafa' }}>
                                                            <Typography variant="subtitle2" fontWeight="bold">{org.orgName}</Typography>
                                                            <Box display="flex" alignItems="center" justifyContent="space-between" mt="auto">
                                                                <FormControl size="small">
                                                                    <Select
                                                                        value={org.orgRole} disabled={!canEdit || updatingKey === `${user.id}-${org.orgId}`}
                                                                        onChange={(e) => handleOrgRoleChange(user.id, org.orgId, e.target.value)}
                                                                        sx={{ boxShadow: 'none', '.MuiOutlinedInput-notchedOutline': { border: 0 }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { border: 0 }, '&:hover .MuiOutlinedInput-notchedOutline': { border: 0 }, pl: 0, pr: 0 }}
                                                                        renderValue={(selected) => (
                                                                            <Chip label={ROLE_LABELS[selected as string]} color={ROLE_COLORS[selected as string]} size="small" variant={canEdit ? "filled" : "outlined"} sx={{ fontWeight: 'bold', cursor: canEdit ? 'pointer' : 'default', opacity: (!canEdit && org.orgRole !== 'OWNER') ? 0.7 : 1 }} />
                                                                        )}
                                                                    >
                                                                        <MenuItem value="VOLUNTEER">Önkéntes</MenuItem>
                                                                        <MenuItem value="COORDINATOR">Koordinátor</MenuItem>
                                                                        <MenuItem value="ORGANIZER">Szervező</MenuItem>
                                                                        <MenuItem value="OWNER" disabled>Alapító</MenuItem>
                                                                    </Select>
                                                                </FormControl>
                                                                <Tooltip title={org.orgRole === 'OWNER' ? "Az alapítót nem lehet eltávolítani" : !canEdit ? "Nincs jogosultságod" : "Tag eltávolítása"}>
                                                                    <span>
                                                                        <IconButton size="small" color="error" onClick={() => setMemberToDelete({ userId: user.id, orgId: org.orgId, userName: user.name, orgName: org.orgName })} disabled={!canEdit || org.orgRole === 'OWNER' || updatingKey === `${user.id}-${org.orgId}`}>
                                                                            <DeleteIcon fontSize="small" />
                                                                        </IconButton>
                                                                    </span>
                                                                </Tooltip>
                                                            </Box>
                                                        </Paper>
                                                    </Grid>
                                                );
                                            })}
                                        </Grid>
                                    </Box>
                                </Paper>
                            </Grid>
                        );
                    })}
                </Grid>
            )}

            {totalPages > 1 && <Box display="flex" justifyContent="center" mt={4}><Pagination count={totalPages} page={page} onChange={(_e, v) => setPage(v)} color="primary" size="large" /></Box>}

            {/* MODALOK */}
            <Dialog open={!!selectedUser} onClose={() => setSelectedUser(null)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 'bold' }}>Profil Részletek</DialogTitle>
                <DialogContent dividers>
                    <Box display="flex" flexDirection="column" alignItems="center" mb={3}>
                        <Avatar sx={{ width: 80, height: 80, mb: 1, bgcolor: 'primary.main', fontSize: '2rem' }}>{selectedUser?.name.charAt(0)}</Avatar>
                        <Typography variant="h5" fontWeight="bold">{selectedUser?.name}</Typography>
                        <Typography variant="body2" color="text.secondary">{selectedUser?.email}</Typography>
                    </Box>
                    <Divider sx={{ mb: 2 }} />
                    <Box display="flex" alignItems="center" gap={2} mb={1}><PhoneIcon color="action" /><Typography variant="body1"><strong>Telefon:</strong> {selectedUser?.phoneNumber || 'Nincs megadva'}</Typography></Box>
                    <Box display="flex" alignItems="center" gap={2} mb={3}><PersonIcon color="action" /><Typography variant="body1"><strong>Rendszer Jogosultság:</strong> {selectedUser?.globalRole === 'SYS_ADMIN' ? 'Adminisztrátor' : 'Felhasználó'}</Typography></Box>
                    <Typography variant="subtitle2" color="primary" fontWeight="bold" gutterBottom>Szervezeti Tagságok</Typography>
                    {selectedUser?.organizations.map(org => (
                        <Box key={org.orgId} display="flex" justifyContent="space-between" alignItems="center" p={1} bgcolor="#f5f5f5" borderRadius={1} mb={1}>
                            <Typography variant="body2">{org.orgName}</Typography>
                            <Chip label={ROLE_LABELS[org.orgRole]} color={ROLE_COLORS[org.orgRole]} size="small" variant="outlined" />
                        </Box>
                    ))}
                </DialogContent>
                <DialogActions sx={{ p: 2 }}><Button onClick={() => setSelectedUser(null)} variant="contained">Bezárás</Button></DialogActions>
            </Dialog>

            <Dialog open={!!memberToDelete} onClose={() => setMemberToDelete(null)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ fontWeight: 'bold', color: 'error.main' }}>Tag eltávolítása</DialogTitle>
                <DialogContent>
                    <Typography>Biztosan eltávolítod <strong>{memberToDelete?.userName}</strong> nevű tagot innen: <strong>{memberToDelete?.orgName}</strong>?</Typography>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setMemberToDelete(null)} color="inherit">Mégse</Button>
                    <Button onClick={handleRemoveMember} variant="contained" color="error" disabled={!!updatingKey}>{updatingKey ? 'Eltávolítás...' : 'Eltávolítás'}</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={rejectModalOpen} onClose={() => setRejectModalOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ bgcolor: '#d32f2f', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}><CancelIcon /> Elutasítás indoklása</DialogTitle>
                <DialogContent sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary" mb={3}>Kérlek, add meg az elutasítás okát (opcionális).</Typography>
                    <TextField fullWidth autoFocus multiline rows={4} label="Indoklás" variant="outlined" value={rejectMessage} onChange={(e) => setRejectMessage(e.target.value)} />
                </DialogContent>
                <DialogActions sx={{ p: 2, bgcolor: '#fafafa' }}>
                    <Button onClick={() => setRejectModalOpen(false)} color="inherit" disabled={loading}>Mégse</Button>
                    <Button onClick={confirmRejection} variant="contained" color="error" disabled={loading}>{loading ? 'Folyamatban...' : 'Véglegesítés'}</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={emailModalOpen} onClose={() => setEmailModalOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ bgcolor: '#1976d2', color: 'white', fontWeight: 'bold' }}>Üzenet küldése ({selectedIds.length} kijelölt személynek)</DialogTitle>
                <DialogContent sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary" mb={2}>A rendszer rejtett másolatban (BCC) küldi ki az üzeneteket.</Typography>
                    <TextField fullWidth size="small" margin="normal" label="E-mail tárgya" variant="outlined" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
                    <TextField fullWidth margin="normal" label="Üzenet szövege" multiline rows={6} variant="outlined" value={emailMessage} onChange={(e) => setEmailMessage(e.target.value)} placeholder="Kedves Csapattagok!..." />
                </DialogContent>
                <DialogActions sx={{ p: 2, bgcolor: '#f5f5f5' }}>
                    <Button onClick={() => setEmailModalOpen(false)} color="inherit" disabled={sendingEmail}>Mégse</Button>
                    <Button variant="contained" color="primary" onClick={handleSendEmail} disabled={sendingEmail || !emailSubject.trim() || !emailMessage.trim()} startIcon={<EmailIcon />}>{sendingEmail ? 'Küldés...' : 'Kiküldés'}</Button>
                </DialogActions>
            </Dialog>

            {/* --- ÚJ: SIKERES EMAIL KÜLDÉS MODAL --- */}
            <Dialog
                open={emailSuccessOpen}
                onClose={() => setEmailSuccessOpen(false)}
                maxWidth="xs"
                fullWidth
                PaperProps={{ sx: { borderRadius: 3 } }}
            >
                <DialogContent sx={{ textAlign: 'center', py: 5 }}>
                    <CheckCircleIcon sx={{ fontSize: 90, color: '#2e7d32', mb: 2 }} />
                    <Typography variant="h5" fontWeight="bold" gutterBottom color="text.primary">
                        Sikeres küldés!
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Az e-mailek sikeresen kézbesítve lettek a kiválasztott tagoknak.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ justifyContent: 'center', pb: 4 }}>
                    <Button
                        variant="contained"
                        color="success"
                        onClick={() => setEmailSuccessOpen(false)}
                        sx={{ px: 4, py: 1, borderRadius: 2, fontWeight: 'bold' }}
                    >
                        Nagyszerű!
                    </Button>
                </DialogActions>
            </Dialog>

        </Container>
    );
}