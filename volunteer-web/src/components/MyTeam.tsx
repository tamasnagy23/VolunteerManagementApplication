import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Container, Typography, Box, Paper, CircularProgress, Alert,
    FormControl, InputLabel, Select, MenuItem, Chip, Button, Divider,
    TextField, InputAdornment, Pagination, Dialog, DialogTitle, DialogContent,
    DialogActions, IconButton, Tabs, Tab, TableContainer, Table,
    TableHead, TableRow, TableCell, TableBody, Checkbox, useMediaQuery, useTheme,
    FormControlLabel, Avatar, Card, CardContent, CardActions
} from '@mui/material';
import Grid from '@mui/material/Grid'; // JAVÍTVA GRID2-re
import type { SelectChangeEvent } from '@mui/material';

// Ikonok
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
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
interface ExportRow { name: string; email: string; phone: string; org: string; role: string; status: string; reason?: string; }

const ROLE_WEIGHTS: Record<string, number> = { 'OWNER': 4, 'ORGANIZER': 3, 'COORDINATOR': 2, 'VOLUNTEER': 1 };
const ROLE_LABELS: Record<string, string> = { 'VOLUNTEER': 'Önkéntes', 'COORDINATOR': 'Koordinátor', 'ORGANIZER': 'Szervező', 'OWNER': 'Alapító' };
const ROLE_COLORS: Record<string, "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning"> = { 'VOLUNTEER': 'default', 'COORDINATOR': 'info', 'ORGANIZER': 'secondary', 'OWNER': 'error' };

export default function MyTeam() {
    const navigate = useNavigate();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const [users, setUsers] = useState<TeamMember[]>([]);
    const [pendingApps, setPendingApps] = useState<PendingApplication[]>([]);
    const [historyApps, setHistoryApps] = useState<PendingApplication[]>([]);

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
    const [emailSuccessOpen, setEmailSuccessOpen] = useState(false);

    useEffect(() => { fetchTeamData(); }, []);
    useEffect(() => { setPage(1); setSelectedIds([]); }, [searchQuery, orgFilter, roleFilter, sortOrder, currentTab]);

    const fetchTeamData = async () => {
        try {
            setLoading(true);
            const [meRes, teamRes, appsRes, historyRes] = await Promise.all([
                api.get<CurrentUser>('/users/me'),
                api.get<TeamMember[]>('/users/team'),
                api.get<PendingApplication[]>('/organizations/applications/pending'),
                api.get<PendingApplication[]>('/organizations/applications/history').catch(() => ({ data: [] }))
            ]);
            setCurrentUser(meRes.data);
            setUsers(teamRes.data);
            setPendingApps(appsRes.data);
            setHistoryApps(historyRes.data);
        } catch {
            setError("Nem sikerült betölteni a csapat adatait.");
        } finally {
            setLoading(false);
        }
    };

    const isSysAdmin = currentUser?.role === 'SYS_ADMIN';
    const myDetailedProfile = users.find(u => u.email === currentUser?.email);

    const handleOrgRoleChange = async (userId: number, orgId: number, newRole: string) => {
        try {
            setUpdatingKey(`${userId}-${orgId}`); setError('');
            await api.put(`/users/${userId}/organizations/${orgId}/role`, null, { params: { newRole } });
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, organizations: u.organizations.map(o => o.orgId === orgId ? { ...o, orgRole: newRole } : o) } : u));
        } catch { alert("Hiba történt a módosításkor."); } finally { setUpdatingKey(null); }
    };

    const handleApplication = async (appId: number, status: 'APPROVED' | 'REJECTED') => {
        if (status === 'REJECTED') { setRejectTarget(appId); setRejectMessage(''); setRejectModalOpen(true); return; }
        try {
            setUpdatingKey(`app-${appId}`); setError('');
            await api.put(`/organizations/applications/${appId}`, null, { params: { status } });
            await fetchTeamData();
        } catch { alert("Hiba a művelet során."); } finally { setUpdatingKey(null); }
    };

    const handleBulkApplication = async (status: 'APPROVED' | 'REJECTED') => {
        if (status === 'REJECTED') { setRejectTarget('BULK'); setRejectMessage(''); setRejectModalOpen(true); return; }
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
        } catch { alert("Hiba történt."); } finally { setLoading(false); }
    };

    const handleRemoveMember = async () => {
        if (!memberToDelete) return;
        try {
            setUpdatingKey(`del-${memberToDelete.userId}-${memberToDelete.orgId}`); setError('');
            await api.delete(`/organizations/${memberToDelete.orgId}/members/${memberToDelete.userId}`);
            await fetchTeamData();
        } catch { alert("Hiba történt."); } finally { setUpdatingKey(null); setMemberToDelete(null); }
    };

    const handleSendEmail = async () => {
        setSendingEmail(true);
        try {
            const endpoint = currentTab === 0 ? '/users/team/bulk-email' : '/applications/bulk-email';
            const payloadKey = currentTab === 0 ? 'userIds' : 'applicationIds';
            await api.post(endpoint, { [payloadKey]: selectedIds, subject: emailSubject, message: emailMessage });
            setEmailModalOpen(false); setEmailSubject(''); setEmailMessage(''); setSelectedIds([]); setEmailSuccessOpen(true);
        } catch { alert("Hiba történt az üzenetek küldésekor."); } finally { setSendingEmail(false); }
    };

    const handleMobileTabChange = (event: SelectChangeEvent<number>) => {
        setCurrentTab(Number(event.target.value));
        setOrgFilter('ALL'); setRoleFilter('ALL'); setSelectedIds([]);
    };

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

    const processedHistoryApps = useMemo(() => {
        return historyApps.filter(app => {
            const searchLower = searchQuery.toLowerCase();
            const matchesSearch = app.userName.toLowerCase().includes(searchLower) || app.userEmail.toLowerCase().includes(searchLower);
            const matchesOrg = orgFilter === 'ALL' || app.orgName === orgFilter;
            return matchesSearch && matchesOrg;
        }).sort((a, b) => a.userName.localeCompare(b.userName, 'hu'));
    }, [historyApps, searchQuery, orgFilter]);

    const currentListLength = currentTab === 0 ? processedUsers.length : currentTab === 1 ? processedPendingApps.length : processedHistoryApps.length;
    const totalPages = Math.ceil(currentListLength / ITEMS_PER_PAGE);
    const paginatedUsers = processedUsers.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
    const paginatedApps = processedPendingApps.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
    const paginatedHistory = processedHistoryApps.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    const allOrgs = Array.from(new Set([
        ...users.flatMap(u => u.organizations.map(o => o.orgName)),
        ...pendingApps.map(a => a.orgName),
        ...historyApps.map(h => h.orgName)
    ])).sort();

    const handleExportExcel = () => {
        const wb = XLSX.utils.book_new();
        const headers = ['Név', 'Email', 'Telefon', 'Szervezet', 'Szerepkör', 'Státusz', 'Indoklás'];

        const appendSheet = (data: ExportRow[], sheetName: string) => {
            const rows = data.map(row => [row.name, row.email, row.phone, row.org, row.role, row.status, row.reason || '-']);
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

        const historyData = historyApps.map(h => ({
            name: h.userName, email: h.userEmail, phone: h.userPhone || '-', org: h.orgName, role: '-',
            status: h.status === 'LEFT' ? 'Kilépett' : h.status === 'REJECTED' ? 'Elutasítva' : 'Eltávolítva',
            reason: h.rejectionMessage || ''
        }));
        if (historyData.length > 0) appendSheet(historyData, "Archívum (Történelem)");

        XLSX.writeFile(wb, `Csapat_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleSelectAllClick = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) setSelectedIds(currentTab === 0 ? paginatedUsers.map(u => u.id) : paginatedApps.map(a => a.id));
        else setSelectedIds([]);
    };
    const handleSelectRow = (id: number) => { setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]); };

    if (loading && !rejectModalOpen) return <Box display="flex" justifyContent="center" mt={10}><CircularProgress size={60} /></Box>;

    return (
        <Container maxWidth="xl" sx={{ mt: { xs: 2, sm: 4 }, mb: 10, px: { xs: 1, sm: 2, md: 3 } }}>
            {/* FEJLÉC */}
            <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={2} mb={4}>
                <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} gap={1}>
                    <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/dashboard')} sx={{ alignSelf: 'flex-start' }}>Vissza</Button>
                    <Typography variant="h4" sx={{ fontSize: { xs: '1.6rem', md: '2.125rem' }, fontWeight: 'bold' }}>Csapat Kezelése</Typography>
                </Box>
                <Button variant="contained" color="success" startIcon={<DownloadIcon />} onClick={handleExportExcel} fullWidth={isMobile}>Excel Export</Button>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

            {/* JAVÍTOTT KATEGÓRIAVÁLASZTÓ MOBILRA */}
            {isMobile ? (
                <FormControl fullWidth sx={{ mb: 3 }}>
                    <Select
                        value={currentTab}
                        onChange={handleMobileTabChange}
                        sx={{ bgcolor: 'white', borderRadius: 3, fontWeight: 'bold', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', '& .MuiOutlinedInput-notchedOutline': { border: 'none' } }}
                    >
                        <MenuItem value={0}>👥 Aktív Csapattagok ({processedUsers.length})</MenuItem>
                        <MenuItem value={1}>⏳ Függő Jelentkezések ({processedPendingApps.length})</MenuItem>
                        <MenuItem value={2}>📜 Történelem ({processedHistoryApps.length})</MenuItem>
                    </Select>
                </FormControl>
            ) : (
                <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                    <Tabs value={currentTab} onChange={(_e, v) => { setCurrentTab(v); setOrgFilter('ALL'); setRoleFilter('ALL'); setSelectedIds([]); }} variant="standard">
                        <Tab label={`👥 Aktív Csapattagok (${processedUsers.length})`} sx={{ fontWeight: 'bold' }} />
                        <Tab label={`⏳ Függő Jelentkezések (${processedPendingApps.length})`} sx={{ fontWeight: 'bold' }} />
                        <Tab label={`📜 Történelem (${processedHistoryApps.length})`} sx={{ fontWeight: 'bold' }} />
                    </Tabs>
                </Box>
            )}

            {/* BULK ACTIONS SÁV JAVÍTVA MOBILRA */}
            {selectedIds.length > 0 && currentTab !== 2 && (
                <Paper elevation={0} sx={{ mb: 3, p: 2, bgcolor: '#e3f2fd', borderRadius: 3, border: '1px solid #90caf9' }}>
                    <Typography variant="subtitle2" fontWeight="bold" color="info.dark" mb={1}>{selectedIds.length} elem kiválasztva</Typography>
                    <Grid container spacing={1}>
                        <Grid size={{ xs: 12, sm: 4 }}>
                            <Button fullWidth color="primary" variant="contained" startIcon={<EmailIcon />} onClick={() => setEmailModalOpen(true)}>Üzenet</Button>
                        </Grid>
                        {currentTab === 1 && (
                            <>
                                <Grid size={{ xs: 6, sm: 4 }}>
                                    <Button fullWidth color="success" variant="contained" startIcon={<CheckCircleIcon />} onClick={() => handleBulkApplication('APPROVED')}>Elfogad</Button>
                                </Grid>
                                <Grid size={{ xs: 6, sm: 4 }}>
                                    <Button fullWidth color="error" variant="contained" startIcon={<CancelIcon />} onClick={() => handleBulkApplication('REJECTED')}>Elutasít</Button>
                                </Grid>
                            </>
                        )}
                    </Grid>
                </Paper>
            )}

            {/* SZŰRŐK */}
            <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: '#fbfbfb', display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', borderRadius: 2 }}>
                <TextField size="small" placeholder="Keresés..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} sx={{ flex: 1, minWidth: { xs: '100%', sm: 200 } }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }} />
                <FormControl size="small" sx={{ flex: 1, minWidth: { xs: '100%', sm: 200 } }}>
                    <InputLabel>Szervezet</InputLabel>
                    <Select value={orgFilter} label="Szervezet" onChange={(e) => setOrgFilter(e.target.value)}>
                        <MenuItem value="ALL">Összes szervezet</MenuItem>
                        {allOrgs.map(name => <MenuItem key={name} value={name}>{name}</MenuItem>)}
                    </Select>
                </FormControl>
                {currentTab === 0 && (
                    <>
                        <FormControl size="small" sx={{ flex: 1, minWidth: { xs: '100%', sm: 150 } }}>
                            <InputLabel>Szerepkör</InputLabel>
                            <Select value={roleFilter} label="Szerepkör" onChange={(e) => setRoleFilter(e.target.value)}>
                                <MenuItem value="ALL">Minden szerepkör</MenuItem>
                                <MenuItem value="ORGANIZER">Szervező</MenuItem>
                                <MenuItem value="COORDINATOR">Koordinátor</MenuItem>
                                <MenuItem value="VOLUNTEER">Önkéntes</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ flex: 1, minWidth: { xs: '100%', sm: 180 } }}>
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

            {currentTab !== 2 && currentListLength > 0 && (
                <Box mb={2} px={1}>
                    <FormControlLabel control={<Checkbox indeterminate={selectedIds.length > 0 && selectedIds.length < (currentTab === 0 ? paginatedUsers.length : paginatedApps.length)} checked={selectedIds.length > 0 && selectedIds.length === (currentTab === 0 ? paginatedUsers.length : paginatedApps.length)} onChange={handleSelectAllClick} />} label={<Typography variant="body2" fontWeight="bold">Összes kijelölése ezen az oldalon</Typography>} />
                </Box>
            )}

            {/* --- TARTALOM MEGJELENÍTÉSE FÜLEK SZERINT --- */}
            {currentListLength === 0 ? (
                <Paper sx={{ p: 5, textAlign: 'center', color: 'text.secondary', borderRadius: 3 }}>Nincs találat.</Paper>
            ) : currentTab === 2 ? (
                // TÖRTÉNELEM (Mobilon Kártyák, Asztalin Táblázat)
                isMobile ? (
                    <Box display="flex" flexDirection="column" gap={2}>
                        {paginatedHistory.map((history) => (
                            <Card key={history.id} variant="outlined" sx={{ borderRadius: 2 }}>
                                <CardContent sx={{ pb: 1 }}>
                                    <Typography variant="subtitle1" fontWeight="bold">{history.userName}</Typography>
                                    <Typography variant="body2" color="text.secondary">{history.userEmail} | {history.userPhone || '-'}</Typography>
                                    <Typography variant="caption" display="block" mt={1} fontWeight="bold" color="primary">{history.orgName}</Typography>
                                </CardContent>
                                <CardActions sx={{ px: 2, pb: 2, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
                                    <Chip label={history.status === 'LEFT' ? 'Önként Kilépett' : history.status === 'REJECTED' ? 'Elutasítva' : 'Eltávolítva'} color={history.status === 'LEFT' ? 'default' : history.status === 'REJECTED' ? 'error' : 'warning'} size="small" />
                                    {history.rejectionMessage && <Typography variant="caption" fontStyle="italic">"{history.rejectionMessage}"</Typography>}
                                </CardActions>
                            </Card>
                        ))}
                    </Box>
                ) : (
                    <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 2 }}>
                        <Table>
                            <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                                <TableRow>
                                    <TableCell><strong>Felhasználó</strong></TableCell>
                                    <TableCell><strong>Elérhetőség</strong></TableCell>
                                    <TableCell><strong>Szervezet</strong></TableCell>
                                    <TableCell><strong>Státusz & Indoklás</strong></TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {paginatedHistory.map((history) => (
                                    <TableRow key={history.id} hover>
                                        <TableCell sx={{ fontWeight: 'bold' }}>{history.userName}</TableCell>
                                        <TableCell><Typography variant="body2">{history.userEmail}</Typography><Typography variant="caption" color="text.secondary">{history.userPhone || '-'}</Typography></TableCell>
                                        <TableCell><Typography variant="body2" fontWeight="bold">{history.orgName}</Typography></TableCell>
                                        <TableCell>
                                            <Box display="flex" flexDirection="column" alignItems="flex-start" gap={1}>
                                                <Chip label={history.status === 'LEFT' ? 'Önként Kilépett' : history.status === 'REJECTED' ? 'Elutasítva' : 'Eltávolítva'} color={history.status === 'LEFT' ? 'default' : history.status === 'REJECTED' ? 'error' : 'warning'} size="small" />
                                                {history.rejectionMessage && <Typography variant="caption" color="text.secondary" fontStyle="italic">"{history.rejectionMessage}"</Typography>}
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )
            ) : currentTab === 1 ? (
                // FÜGGŐ JELENTKEZÉSEK (Mobilon Kártyák, Asztalin Táblázat)
                isMobile ? (
                    <Box display="flex" flexDirection="column" gap={2}>
                        {paginatedApps.map((app) => (
                            <Card key={app.id} variant="outlined" sx={{ borderRadius: 2, borderColor: selectedIds.includes(app.id) ? 'primary.main' : 'divider' }}>
                                <CardContent sx={{ pb: 1, display: 'flex', gap: 1 }}>
                                    <Checkbox checked={selectedIds.includes(app.id)} onChange={() => handleSelectRow(app.id)} sx={{ p: 0 }} />
                                    <Box>
                                        <Typography variant="subtitle1" fontWeight="bold">{app.userName}</Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-all' }}>{app.userEmail}</Typography>
                                        <Typography variant="caption" display="block">📱 {app.userPhone || '-'}</Typography>
                                        <Chip label={app.orgName} size="small" variant="outlined" color="warning" sx={{ mt: 1, fontWeight: 'bold' }} />
                                    </Box>
                                </CardContent>
                                <CardActions sx={{ p: 2, pt: 0 }}>
                                    <Button fullWidth variant="contained" color="success" size="small" onClick={() => handleApplication(app.id, 'APPROVED')} disabled={!!updatingKey}>Elfogad</Button>
                                    <Button fullWidth variant="outlined" color="error" size="small" onClick={() => handleApplication(app.id, 'REJECTED')} disabled={!!updatingKey}>Elutasít</Button>
                                </CardActions>
                            </Card>
                        ))}
                    </Box>
                ) : (
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
                                        <TableCell><Typography variant="body2">{app.userEmail}</Typography><Typography variant="caption" color="text.secondary">{app.userPhone}</Typography></TableCell>
                                        <TableCell><Chip label={app.orgName} size="small" variant="outlined" color="warning" sx={{ fontWeight: 'bold' }} /></TableCell>
                                        <TableCell align="center">
                                            <Box display="flex" justifyContent="center" gap={1}>
                                                <Button variant="contained" color="success" size="small" onClick={() => handleApplication(app.id, 'APPROVED')} disabled={!!updatingKey}>Elfogad</Button>
                                                <Button variant="outlined" color="error" size="small" onClick={() => handleApplication(app.id, 'REJECTED')} disabled={!!updatingKey}>Elutasít</Button>
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )
            ) : (
                /* --- AKTÍV TAGOK (Grid2 Kártyás Design - Már eleve jó volt, csak javítottuk a Grid szinaktist) --- */
                <Grid container spacing={2}>
                    {paginatedUsers.map((user) => {
                        const visibleOrgs = user.organizations.filter(org => isSysAdmin || myDetailedProfile?.organizations.some(myOrg => myOrg.orgId === org.orgId));
                        if (visibleOrgs.length === 0) return null;

                        return (
                            <Grid size={12} key={user.id}>
                                <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden', display: 'flex', flexDirection: { xs: 'column', md: 'row' } }}>

                                    <Box sx={{ p: 2, bgcolor: '#f4fafe', minWidth: { md: '300px' }, borderRight: { md: '1px solid #e0e0e0' } }}>
                                        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                                            <Box display="flex" alignItems="flex-start" gap={1}>
                                                <Checkbox checked={selectedIds.includes(user.id)} onChange={() => handleSelectRow(user.id)} sx={{ p: 0, mt: 0.5 }} />
                                                <Box>
                                                    <Typography variant="h6" fontWeight="bold" color="primary.main">{user.name}</Typography>
                                                    <Typography variant="body2" color="text.secondary" mb={1} sx={{ wordBreak: 'break-all' }}>{user.email}</Typography>
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
                                                                        sx={{ boxShadow: 'none', '.MuiOutlinedInput-notchedOutline': { border: 0 }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { border: 0 }, pl: 0, pr: 0 }}
                                                                        renderValue={(selected) => (
                                                                            <Chip label={ROLE_LABELS[selected as string]} color={ROLE_COLORS[selected as string]} size="small" variant={canEdit ? "filled" : "outlined"} sx={{ fontWeight: 'bold' }} />
                                                                        )}
                                                                    >
                                                                        <MenuItem value="VOLUNTEER">Önkéntes</MenuItem>
                                                                        <MenuItem value="COORDINATOR">Koordinátor</MenuItem>
                                                                        <MenuItem value="ORGANIZER">Szervező</MenuItem>
                                                                        <MenuItem value="OWNER" disabled>Alapító</MenuItem>
                                                                    </Select>
                                                                </FormControl>
                                                                {canEdit && org.orgRole !== 'OWNER' && (
                                                                    <IconButton size="small" color="error" onClick={() => setMemberToDelete({ userId: user.id, orgId: org.orgId, userName: user.name, orgName: org.orgName })} disabled={updatingKey === `${user.id}-${org.orgId}`}>
                                                                        <DeleteIcon fontSize="small" />
                                                                    </IconButton>
                                                                )}
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

            {totalPages > 1 && <Box display="flex" justifyContent="center" mt={4}><Pagination count={totalPages} page={page} onChange={(_e, v) => setPage(v)} color="primary" size={isMobile ? "small" : "medium"} /></Box>}

            {/* MODALOK (Ugyanaz maradt, csak mobilbarát margók) */}
            <Dialog open={!!selectedUser} onClose={() => setSelectedUser(null)} maxWidth="sm" fullWidth PaperProps={{ sx: { m: { xs: 2, sm: 3 } } }}>
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

            {/* A TÖBBI MODAL (Törlés, Email, Elutasítás) ITT VAN, VÁLTOZATLANUL... */}
            <Dialog open={!!memberToDelete} onClose={() => setMemberToDelete(null)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ fontWeight: 'bold', color: 'error.main' }}>Tag eltávolítása</DialogTitle>
                <DialogContent><Typography>Biztosan eltávolítod <strong>{memberToDelete?.userName}</strong> nevű tagot innen: <strong>{memberToDelete?.orgName}</strong>?</Typography></DialogContent>
                <DialogActions sx={{ p: 2 }}><Button onClick={() => setMemberToDelete(null)} color="inherit">Mégse</Button><Button onClick={handleRemoveMember} variant="contained" color="error" disabled={!!updatingKey}>{updatingKey ? 'Eltávolítás...' : 'Eltávolítás'}</Button></DialogActions>
            </Dialog>

            <Dialog open={rejectModalOpen} onClose={() => setRejectModalOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ bgcolor: '#d32f2f', color: 'white', fontWeight: 'bold' }}>Elutasítás indoklása</DialogTitle>
                <DialogContent sx={{ mt: 2 }}><TextField fullWidth autoFocus multiline rows={4} label="Indoklás" variant="outlined" value={rejectMessage} onChange={(e) => setRejectMessage(e.target.value)} /></DialogContent>
                <DialogActions sx={{ p: 2, bgcolor: '#fafafa' }}><Button onClick={() => setRejectModalOpen(false)} color="inherit" disabled={loading}>Mégse</Button><Button onClick={confirmRejection} variant="contained" color="error" disabled={loading}>{loading ? 'Folyamatban...' : 'Véglegesítés'}</Button></DialogActions>
            </Dialog>

            <Dialog open={emailModalOpen} onClose={() => setEmailModalOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ bgcolor: '#1976d2', color: 'white', fontWeight: 'bold' }}>Üzenet küldése</DialogTitle>
                <DialogContent sx={{ mt: 2 }}>
                    <TextField fullWidth size="small" margin="normal" label="E-mail tárgya" variant="outlined" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
                    <TextField fullWidth margin="normal" label="Üzenet szövege" multiline rows={6} variant="outlined" value={emailMessage} onChange={(e) => setEmailMessage(e.target.value)} />
                </DialogContent>
                <DialogActions sx={{ p: 2, bgcolor: '#f5f5f5' }}><Button onClick={() => setEmailModalOpen(false)} color="inherit">Mégse</Button><Button variant="contained" color="primary" onClick={handleSendEmail} disabled={sendingEmail || !emailSubject.trim() || !emailMessage.trim()}>{sendingEmail ? 'Küldés...' : 'Kiküldés'}</Button></DialogActions>
            </Dialog>

            <Dialog open={emailSuccessOpen} onClose={() => setEmailSuccessOpen(false)} maxWidth="xs" fullWidth>
                <DialogContent sx={{ textAlign: 'center', py: 5 }}>
                    <CheckCircleIcon sx={{ fontSize: 90, color: '#2e7d32', mb: 2 }} />
                    <Typography variant="h5" fontWeight="bold">Sikeres küldés!</Typography>
                </DialogContent>
                <DialogActions sx={{ justifyContent: 'center', pb: 4 }}><Button variant="contained" color="success" onClick={() => setEmailSuccessOpen(false)}>Rendben</Button></DialogActions>
            </Dialog>
        </Container>
    );
}