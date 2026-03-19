import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Container, Typography, Box, Paper, Button, CircularProgress, Alert,
    TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
    Dialog, DialogTitle, DialogContent, DialogActions, FormControl,
    InputLabel, Select, MenuItem, Checkbox, FormControlLabel, FormGroup,
    Chip, Avatar, useMediaQuery, useTheme, Card, CardContent, Divider,
    TextField, InputAdornment, Pagination
} from '@mui/material';
import Grid from '@mui/material/Grid';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import SecurityIcon from '@mui/icons-material/Security';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import SearchIcon from '@mui/icons-material/Search';
import api from '../api/axios';

// --- INTERFÉSZEK ---
interface EventTeamMember {
    userId: number;
    userName: string;
    userEmail: string;
    eventRole: string | null;
    permissions: string[];
    coordinatedWorkAreaIds: number[];
}

interface WorkArea {
    id: number;
    name: string;
}

interface EventData {
    id: number;
    title: string;
    workAreas: WorkArea[];
}

const AVAILABLE_PERMISSIONS = [
    { value: 'MANAGE_APPLICATIONS', label: 'Jelentkezések elbírálása' },
    { value: 'MANAGE_SHIFTS', label: 'Műszakok és Naptár kezelése' },
    { value: 'ASSIGN_VOLUNTEERS', label: 'Önkéntesek beosztása' },
    { value: 'EDIT_EVENT_DETAILS', label: 'Esemény adatainak szerkesztése' }
];

export default function EventTeamManager() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const [event, setEvent] = useState<EventData | null>(null);
    const [team, setTeam] = useState<EventTeamMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Szűrés és Keresés állapotok
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('ALL');

    // Lapozás állapotok
    const [page, setPage] = useState(1);
    const ITEMS_PER_PAGE = isMobile ? 5 : 10;

    // Szerkesztő Modal állapotok
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    const [editingUserId, setEditingUserId] = useState<number | null>(null);
    const [editingName, setEditingName] = useState('');
    const [draftRole, setDraftRole] = useState<string>('NONE');
    const [draftPermissions, setDraftPermissions] = useState<string[]>([]);
    const [draftAreas, setDraftAreas] = useState<number[]>([]);

    // --- ÚJ: Részletek Modal állapotok (A "+ X további" gombhoz) ---
    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [detailsModalTitle, setDetailsModalTitle] = useState('');
    const [detailsModalItems, setDetailsModalItems] = useState<string[]>([]);

    useEffect(() => {
        if (id) fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    useEffect(() => {
        setPage(1);
    }, [searchTerm, roleFilter]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [eventRes, teamRes] = await Promise.all([
                api.get(`/events/${id}`),
                api.get(`/events/${id}/team`)
            ]);
            setEvent(eventRes.data);

            const activeTeam = (teamRes.data as EventTeamMember[]).filter(
                member => !member.userEmail.endsWith('@anonymized.local')
            );
            setTeam(activeTeam);
        } catch {
            setError("Hiba történt az adatok betöltésekor. Lehet, hogy nincs jogosultságod ehhez a felülethez.");
        } finally {
            setLoading(false);
        }
    };

    const handleOpenEdit = (member: EventTeamMember) => {
        setEditingUserId(member.userId);
        setEditingName(member.userName);
        setDraftRole(member.eventRole || 'NONE');
        setDraftPermissions(member.permissions || []);
        setDraftAreas(member.coordinatedWorkAreaIds || []);
        setEditModalOpen(true);
    };

    const handlePermissionToggle = (permValue: string) => {
        setDraftPermissions(prev =>
            prev.includes(permValue) ? prev.filter(p => p !== permValue) : [...prev, permValue]
        );
    };

    const handleSave = async () => {
        if (!editingUserId) return;
        setSaving(true);
        try {
            const payload = {
                eventRole: draftRole === 'NONE' ? null : draftRole,
                permissions: draftRole === 'COORDINATOR' ? draftPermissions : [],
                coordinatedWorkAreaIds: draftRole === 'COORDINATOR' ? draftAreas : []
            };

            await api.put(`/events/${id}/team/${editingUserId}`, payload);
            setEditModalOpen(false);
            await fetchData();
        } catch {
            alert("Hiba történt a jogosultságok mentésekor.");
        } finally {
            setSaving(false);
        }
    };

    // --- ÚJ: A "+ X további" kattintás kezelője ---
    const handleOpenDetails = (title: string, items: string[]) => {
        setDetailsModalTitle(title);
        setDetailsModalItems(items);
        setDetailsModalOpen(true);
    };

    // --- ÚJ LOGIKA: Intelligens Chip listázó, ami elrejti a többletet ---
    const renderChipGroup = (items: string[], title: string, color: 'default' | 'primary' | 'secondary' | 'info' = 'default', limit: number = 2) => {
        if (items.length === 0) return <Typography variant="caption" color="text.secondary">-</Typography>;

        if (items.length <= limit) {
            return (
                <Box display="flex" flexWrap="wrap" gap={0.5}>
                    {items.map((item, idx) => <Chip key={idx} label={item} size="small" color={color} variant="outlined" />)}
                </Box>
            );
        }

        // Ha túl sok van, csak az első (limit - 1) darabot mutatjuk, és egy "további" gombot
        const visible = items.slice(0, limit - 1);
        const hiddenCount = items.length - visible.length;

        return (
            <Box display="flex" flexWrap="wrap" gap={0.5}>
                {visible.map((item, idx) => <Chip key={idx} label={item} size="small" color={color} variant="outlined" />)}
                <Chip
                    label={`+ ${hiddenCount} további...`}
                    size="small"
                    color={color}
                    onClick={() => handleOpenDetails(title, items)}
                    sx={{ fontWeight: 'bold', cursor: 'pointer', '&:hover': { backgroundColor: 'rgba(0,0,0,0.04)' } }}
                />
            </Box>
        );
    };

    const filteredTeam = useMemo(() => {
        return team.filter(member => {
            const matchesSearch = member.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                member.userEmail.toLowerCase().includes(searchTerm.toLowerCase());

            let matchesRole = true;
            if (roleFilter === 'ORGANIZER') matchesRole = member.eventRole === 'ORGANIZER';
            if (roleFilter === 'COORDINATOR') matchesRole = member.eventRole === 'COORDINATOR';
            if (roleFilter === 'VOLUNTEER') matchesRole = !member.eventRole;

            return matchesSearch && matchesRole;
        }).sort((a, b) => {
            const roleWeight = (role: string | null) => role === 'ORGANIZER' ? 3 : role === 'COORDINATOR' ? 2 : 1;
            const weightA = roleWeight(a.eventRole);
            const weightB = roleWeight(b.eventRole);

            if (weightA !== weightB) return weightB - weightA;
            return a.userName.localeCompare(b.userName, 'hu');
        });
    }, [team, searchTerm, roleFilter]);

    const totalPages = Math.ceil(filteredTeam.length / ITEMS_PER_PAGE);
    const paginatedTeam = filteredTeam.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    if (loading) return <Box display="flex" justifyContent="center" mt={10}><CircularProgress /></Box>;
    if (!event) return <Container><Alert severity="error">Esemény nem található.</Alert></Container>;

    return (
        <Container maxWidth="lg" sx={{ mt: { xs: 2, md: 4 }, mb: 10 }}>
            {/* FEJLÉC */}
            <Box display="flex" alignItems="center" gap={2} mb={3}>
                <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(`/events/${id}`)}>
                    Vissza az Eseményhez
                </Button>
            </Box>

            <Typography variant="h4" fontWeight="900" color="primary.main" mb={1} sx={{ fontSize: { xs: '1.8rem', sm: '2.125rem' } }}>
                Csapat és Jogosultságok
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" mb={3}>
                {event.title} - Oszd ki a szervezői és koordinátori feladatokat!
            </Typography>

            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

            {/* KERESŐ ÉS SZŰRŐ SÁV */}
            <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: '#fbfbfb', display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', borderRadius: 2 }}>
                <TextField
                    size="small"
                    placeholder="Keresés név vagy email alapján..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    sx={{ flex: 1, minWidth: { xs: '100%', sm: 250 } }}
                    InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
                />
                <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 200 } }}>
                    <InputLabel>Szerepkör szűrő</InputLabel>
                    <Select value={roleFilter} label="Szerepkör szűrő" onChange={(e) => setRoleFilter(e.target.value)}>
                        <MenuItem value="ALL">Összes résztvevő</MenuItem>
                        <MenuItem value="ORGANIZER">Főszervezők</MenuItem>
                        <MenuItem value="COORDINATOR">Koordinátorok</MenuItem>
                        <MenuItem value="VOLUNTEER">Sima Önkéntesek</MenuItem>
                    </Select>
                </FormControl>
            </Paper>

            {filteredTeam.length === 0 ? (
                <Paper sx={{ p: 5, textAlign: 'center', color: 'text.secondary', borderRadius: 3 }}>
                    Nincs a keresésnek megfelelő személy.
                </Paper>
            ) : (
                <>
                    {/* MOBILOS NÉZET */}
                    {isMobile ? (
                        <Grid container spacing={2}>
                            {paginatedTeam.map(member => {
                                const permLabels = member.permissions.map(p => AVAILABLE_PERMISSIONS.find(ap => ap.value === p)?.label || p);
                                const areaLabels = member.coordinatedWorkAreaIds.map(areaId => `📍 ${event.workAreas.find(wa => wa.id === areaId)?.name || 'Ismeretlen terület'}`);

                                return (
                                    <Grid size={{xs:12}} key={member.userId}>
                                        <Card variant="outlined" sx={{ borderRadius: 3, borderColor: member.eventRole ? 'primary.main' : '#e0e0e0', bgcolor: member.eventRole ? '#fcfdfe' : 'white' }}>
                                            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                                                <Box display="flex" alignItems="center" gap={1.5} mb={2}>
                                                    <Avatar sx={{ bgcolor: member.eventRole === 'ORGANIZER' ? 'secondary.main' : member.eventRole === 'COORDINATOR' ? 'info.main' : 'grey.400' }}>
                                                        {member.userName.charAt(0).toUpperCase()}
                                                    </Avatar>
                                                    <Box>
                                                        <Typography variant="subtitle1" fontWeight="bold">{member.userName}</Typography>
                                                        <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-all' }}>{member.userEmail}</Typography>
                                                    </Box>
                                                </Box>

                                                <Divider sx={{ my: 1.5 }} />

                                                <Box mb={3}>
                                                    <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                                                        Esemény Szerepkör:
                                                    </Typography>
                                                    {member.eventRole === 'ORGANIZER' ? (
                                                        <Chip icon={<SecurityIcon />} label="Főszervező (Mindenhez van joga)" color="secondary" size="small" sx={{ fontWeight: 'bold' }} />
                                                    ) : member.eventRole === 'COORDINATOR' ? (
                                                        <Chip icon={<SupervisorAccountIcon />} label="Koordinátor" color="info" size="small" sx={{ fontWeight: 'bold' }} />
                                                    ) : (
                                                        <Chip label="Sima Önkéntes" size="small" variant="outlined" />
                                                    )}

                                                    {member.eventRole === 'COORDINATOR' && member.permissions.length > 0 && (
                                                        <Box mt={1.5}>
                                                            <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                                                                Jogosultságok:
                                                            </Typography>
                                                            {renderChipGroup(permLabels, `${member.userName} - Jogosultságok`, 'default', 2)}
                                                        </Box>
                                                    )}

                                                    {member.eventRole === 'COORDINATOR' && member.coordinatedWorkAreaIds.length > 0 && (
                                                        <Box mt={1.5}>
                                                            <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                                                                Kezelt Területek:
                                                            </Typography>
                                                            {renderChipGroup(areaLabels, `${member.userName} - Kezelt Területek`, 'primary', 2)}
                                                        </Box>
                                                    )}
                                                </Box>

                                                <Button fullWidth variant={member.eventRole ? "contained" : "outlined"} startIcon={<EditIcon />} onClick={() => handleOpenEdit(member)} disableElevation>
                                                    Kinevezés / Szerkesztés
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                )})}
                        </Grid>
                    ) : (
                        /* ASZTALI NÉZET (BONTOTT OSZLOPOKKAL ÉS ÖSSZECSUKÁSSAL) */
                        <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 3 }}>
                            <Table>
                                <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                                    <TableRow>
                                        <TableCell><strong>Szervezet Tagja</strong></TableCell>
                                        <TableCell><strong>Szerepkör</strong></TableCell>
                                        <TableCell width="30%"><strong>Jogosultságok (Plecsnik)</strong></TableCell>
                                        <TableCell width="25%"><strong>Kezelt Területek</strong></TableCell>
                                        <TableCell align="center"><strong>Művelet</strong></TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {paginatedTeam.map(member => {
                                        const permLabels = member.permissions.map(p => AVAILABLE_PERMISSIONS.find(ap => ap.value === p)?.label || p);
                                        const areaLabels = member.coordinatedWorkAreaIds.map(areaId => `📍 ${event.workAreas.find(wa => wa.id === areaId)?.name || 'Ismeretlen'}`);

                                        return (
                                            <TableRow key={member.userId} hover sx={{ bgcolor: member.eventRole ? '#fcfdfe' : 'inherit' }}>
                                                <TableCell>
                                                    <Typography fontWeight="bold">{member.userName}</Typography>
                                                    <Typography variant="body2" color="text.secondary">{member.userEmail}</Typography>
                                                </TableCell>

                                                <TableCell>
                                                    {member.eventRole === 'ORGANIZER' ? (
                                                        <Chip icon={<SecurityIcon />} label="Főszervező" color="secondary" size="small" sx={{ fontWeight: 'bold' }} />
                                                    ) : member.eventRole === 'COORDINATOR' ? (
                                                        <Chip icon={<SupervisorAccountIcon />} label="Koordinátor" color="info" size="small" sx={{ fontWeight: 'bold' }} />
                                                    ) : (
                                                        <Typography variant="body2" color="text.secondary">Önkéntes</Typography>
                                                    )}
                                                </TableCell>

                                                <TableCell>
                                                    {member.eventRole === 'ORGANIZER' ? (
                                                        <Typography variant="caption" color="secondary" fontWeight="bold">Minden jogosultság</Typography>
                                                    ) : member.eventRole === 'COORDINATOR' ? (
                                                        renderChipGroup(permLabels, `${member.userName} - Jogosultságok`, 'default', 2)
                                                    ) : (
                                                        <Typography variant="caption" color="text.secondary">-</Typography>
                                                    )}
                                                </TableCell>

                                                <TableCell>
                                                    {member.eventRole === 'ORGANIZER' ? (
                                                        <Typography variant="caption" color="secondary" fontWeight="bold">Minden terület</Typography>
                                                    ) : member.eventRole === 'COORDINATOR' ? (
                                                        renderChipGroup(areaLabels, `${member.userName} - Kezelt Területek`, 'primary', 2)
                                                    ) : (
                                                        <Typography variant="caption" color="text.secondary">-</Typography>
                                                    )}
                                                </TableCell>

                                                <TableCell align="center">
                                                    <Button variant="outlined" size="small" startIcon={<EditIcon />} onClick={() => handleOpenEdit(member)}>
                                                        Szerkesztés
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )})}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}

                    {totalPages > 1 && (
                        <Box display="flex" justifyContent="center" mt={4}>
                            <Pagination count={totalPages} page={page} onChange={(_, value) => setPage(value)} color="primary" size={isMobile ? "small" : "medium"} />
                        </Box>
                    )}
                </>
            )}

            {/* --- RÉSZLETEK MODAL (A +X további gombhoz) --- */}
            <Dialog open={detailsModalOpen} onClose={() => setDetailsModalOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3, m: { xs: 2, sm: 3 } } }}>
                <DialogTitle sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5', pb: 2 }}>
                    {detailsModalTitle}
                </DialogTitle>
                <DialogContent sx={{ mt: 2, p: { xs: 2, sm: 3 } }}>
                    <Box display="flex" flexDirection="column" gap={1}>
                        {detailsModalItems.map((item, idx) => (
                            <Chip
                                key={idx}
                                label={item}
                                color={detailsModalTitle.includes('Terület') ? 'primary' : 'default'}
                                variant="outlined"
                                sx={{ justifyContent: 'flex-start', px: 1, py: 2.5, fontSize: '0.95rem', fontWeight: '500' }}
                            />
                        ))}
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setDetailsModalOpen(false)} variant="contained" color="primary" disableElevation>Bezárás</Button>
                </DialogActions>
            </Dialog>

            {/* --- SZERKESZTŐ MODAL --- */}
            <Dialog open={editModalOpen} onClose={() => !saving && setEditModalOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { m: { xs: 2, sm: 3 }, borderRadius: 3 } }}>
                <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 'bold', fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
                    {editingName} jogosultságai
                </DialogTitle>
                <DialogContent sx={{ mt: 2, p: { xs: 2, sm: 3 } }}>
                    <FormControl fullWidth sx={{ mb: 3, mt: 1 }}>
                        <InputLabel id="event-role-label">Esemény Szerepkör</InputLabel>
                        <Select labelId="event-role-label" label="Esemény Szerepkör" value={draftRole} onChange={(e) => setDraftRole(e.target.value)}>
                            <MenuItem value="NONE">Sima Önkéntes (Nincs szervezői joga)</MenuItem>
                            <MenuItem value="COORDINATOR">Koordinátor (Korlátozott jogok)</MenuItem>
                            <MenuItem value="ORGANIZER">Főszervező (Mindenhez van joga)</MenuItem>
                        </Select>
                    </FormControl>

                    {draftRole === 'COORDINATOR' && (
                        <Box sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                            <Typography variant="subtitle2" color="primary" fontWeight="bold" mb={1}>
                                Mikhez férhet hozzá globálisan az eseményen?
                            </Typography>
                            <FormGroup sx={{ mb: 3 }}>
                                {AVAILABLE_PERMISSIONS.map(perm => (
                                    <FormControlLabel
                                        key={perm.value}
                                        control={<Checkbox size="small" checked={draftPermissions.includes(perm.value)} onChange={() => handlePermissionToggle(perm.value)} />}
                                        label={<Typography variant="body2">{perm.label}</Typography>}
                                    />
                                ))}
                            </FormGroup>

                            <Divider sx={{ my: 2 }} />

                            <Typography variant="subtitle2" color="primary" fontWeight="bold" mb={2}>
                                Melyik munkaterületeknek ő a közvetlen vezetője?
                            </Typography>
                            <FormControl fullWidth size="small">
                                <InputLabel id="areas-select-label">Munkaterületek</InputLabel>
                                <Select
                                    labelId="areas-select-label"
                                    multiple
                                    label="Munkaterületek"
                                    value={draftAreas}
                                    onChange={(e) => setDraftAreas(typeof e.target.value === 'string' ? e.target.value.split(',').map(Number) : e.target.value as number[])}
                                    renderValue={(selected) => (
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                            {selected.map((value) => {
                                                const areaName = event.workAreas.find(wa => wa.id === value)?.name;
                                                return <Chip key={value} label={areaName} size="small" color="primary" />;
                                            })}
                                        </Box>
                                    )}
                                >
                                    {event.workAreas.map((area) => (
                                        <MenuItem key={area.id} value={area.id}>
                                            <Checkbox checked={draftAreas.includes(area.id)} size="small" />
                                            <Typography variant="body2">{area.name}</Typography>
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Box>
                    )}

                    {draftRole === 'ORGANIZER' && (
                        <Alert severity="info" sx={{ mt: 2 }}>
                            A Főszervező automatikusan minden Munkaterülethez és funkcióhoz (Jelentkezések, Naptár) teljes hozzáférést kap.
                        </Alert>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 2, bgcolor: '#f5f5f5' }}>
                    <Button onClick={() => setEditModalOpen(false)} color="inherit" disabled={saving}>Mégse</Button>
                    <Button onClick={handleSave} variant="contained" color="primary" disabled={saving} sx={{ borderRadius: 2 }}>
                        {saving ? 'Mentés...' : 'Jogosultságok Mentése'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
}