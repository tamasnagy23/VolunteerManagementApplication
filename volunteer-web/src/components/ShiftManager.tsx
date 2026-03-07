import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
    Container, Typography, Box, Paper, Button, CircularProgress,
    Alert, Avatar, IconButton, Collapse, Dialog, DialogTitle,
    DialogContent, DialogActions, Checkbox, Divider, TextField,
    MenuItem, Select, InputLabel, FormControl, ToggleButton, ToggleButtonGroup,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Chip // A Tooltip-et kivettük, mert nem mobilbarát!
} from '@mui/material';
import Grid from '@mui/material/Grid';

// Ikonok
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import ViewListIcon from '@mui/icons-material/ViewList';
import DownloadIcon from '@mui/icons-material/Download';
import SearchIcon from '@mui/icons-material/Search';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';

import api from '../api/axios';

// --- INTERFÉSZEK ---
interface AssignedUser {
    applicationId: number;
    userId: number;
    name: string;
    email: string;
}

interface Shift {
    id: number;
    workAreaId: number;
    workAreaName: string;
    name?: string;
    startTime: string;
    endTime: string;
    maxVolunteers: number;
    assignedUsers: AssignedUser[];
}

interface WorkArea {
    id: number;
    name: string;
}

interface ApprovedApplicant {
    applicationId: number;
    userName: string;
    workAreaId: number;
}

interface EventData {
    id: number;
    title: string;
}

interface PendingApplicationDTO {
    id: number;
    userName: string;
    userEmail: string;
    workAreaId: number;
    workAreaName: string;
    status: string;
}

// --- DÁTUM HELPEREK ---
const getDayName = (dateString: string) => {
    const days = ['Vasárnap', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat'];
    return days[new Date(dateString).getDay()];
};

const formatDateWithDay = (dateString: string) => {
    const d = new Date(dateString);
    const datePart = d.toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' });
    return `${datePart} (${getDayName(dateString)})`;
};

const formatTimeOnly = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
};

const formatDateForInput = (dateString: string) => {
    if (!dateString) return '';
    return dateString.substring(0, 16);
};

export default function ShiftManager() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [event, setEvent] = useState<EventData | null>(null);
    const [workAreas, setWorkAreas] = useState<WorkArea[]>([]);
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [approvedApplicants, setApprovedApplicants] = useState<ApprovedApplicant[]>([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [expandedShifts, setExpandedShifts] = useState<number[]>([]);

    const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
    const [filterArea, setFilterArea] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterDate, setFilterDate] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const [assignModalOpen, setAssignModalOpen] = useState(false);
    const [createModalOpen, setCreateModalOpen] = useState(false);

    const [errorModalOpen, setErrorModalOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    // --- ÚJ: Mobilos név-lista Modal állapota ---
    const [usersListModalOpen, setUsersListModalOpen] = useState(false);
    const [selectedShiftForUsersList, setSelectedShiftForUsersList] = useState<Shift | null>(null);

    const [selectedShiftForAssign, setSelectedShiftForAssign] = useState<Shift | null>(null);
    const [selectedApplicantIds, setSelectedApplicantIds] = useState<number[]>([]);

    const [editMode, setEditMode] = useState(false);
    const [editingShiftId, setEditingShiftId] = useState<number | null>(null);
    const [targetWorkAreaId, setTargetWorkAreaId] = useState<number | null>(null);
    const [newShiftData, setNewShiftData] = useState({
        name: '',
        startTime: '',
        endTime: '',
        maxVolunteers: 5
    });

    useEffect(() => {
        if (id) fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError('');
            const [eventRes, areasRes, shiftsRes, appsRes] = await Promise.all([
                api.get(`/events/${id}`),
                api.get(`/events/${id}/work-areas`),
                api.get(`/events/${id}/shifts`),
                api.get(`/applications/event/${id}`, { params: { status: 'APPROVED' } })
            ]);

            setEvent(eventRes.data);
            setWorkAreas(areasRes.data);
            setShifts(shiftsRes.data);

            const applicants: ApprovedApplicant[] = appsRes.data
                .filter((app: PendingApplicationDTO) => app.userName !== "Törölt Felhasználó")
                .map((app: PendingApplicationDTO) => ({
                    applicationId: app.id,
                    userName: app.userName,
                    workAreaId: app.workAreaId
                }));

            setApprovedApplicants(applicants);
        } catch (err) {
            console.error("Hiba az adatok betöltésekor:", err);
            setError("Nem sikerült betölteni az adatokat. Kérlek, ellenőrizd a kapcsolatot!");
        } finally {
            setLoading(false);
        }
    };

    const uniqueDates = useMemo(() => {
        const dates = shifts.map(s => formatDateWithDay(s.startTime));
        return Array.from(new Set(dates)).sort();
    }, [shifts]);

    const filteredShifts = useMemo(() => {
        return shifts.filter(shift => {
            if (filterArea !== 'all' && shift.workAreaId.toString() !== filterArea) return false;
            if (filterDate !== 'all' && formatDateWithDay(shift.startTime) !== filterDate) return false;

            const isFull = (shift.assignedUsers?.length || 0) >= shift.maxVolunteers;
            if (filterStatus === 'full' && !isFull) return false;
            if (filterStatus === 'has_space' && isFull) return false;

            if (searchQuery.trim() !== '') {
                const query = searchQuery.toLowerCase();
                const hasVolunteer = shift.assignedUsers?.some(u => u.name.toLowerCase().includes(query));
                const matchName = shift.name?.toLowerCase().includes(query);
                if (!hasVolunteer && !matchName) return false;
            }

            return true;
        }).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    }, [shifts, filterArea, filterStatus, filterDate, searchQuery]);

    const exportToExcel = () => {
        const excelData = shifts.map(shift => {
            const volunteers = shift.assignedUsers?.map(u => u.name).join(', ') || 'Nincs beosztva senki';
            return {
                'Munkaterület': shift.workAreaName,
                'Megnevezés': shift.name || '-',
                'Nap': formatDateWithDay(shift.startTime),
                'Kezdés': formatTimeOnly(shift.startTime),
                'Befejezés': formatTimeOnly(shift.endTime),
                'Kapacitás': `${shift.assignedUsers?.length || 0} / ${shift.maxVolunteers}`,
                'Státusz': (shift.assignedUsers?.length || 0) >= shift.maxVolunteers ? 'Betelt' : 'Van hely',
                'Beosztott Önkéntesek': volunteers
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        worksheet['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 50 }];
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Beosztás");
        XLSX.writeFile(workbook, `Beosztas_${event?.title || 'esemeny'}.xlsx`);
    };

    const toggleShiftExpand = (shiftId: number) => {
        setExpandedShifts(prev => prev.includes(shiftId) ? prev.filter(i => i !== shiftId) : [...prev, shiftId]);
    };

    const handleOpenCreateModal = (waId: number) => {
        setTargetWorkAreaId(waId);
        setEditMode(false);
        setNewShiftData({ name: '', startTime: '', endTime: '', maxVolunteers: 5 });
        setCreateModalOpen(true);
    };

    const handleOpenEditModal = (shift: Shift) => {
        setEditingShiftId(shift.id);
        setEditMode(true);
        setNewShiftData({
            name: shift.name || '',
            startTime: formatDateForInput(shift.startTime),
            endTime: formatDateForInput(shift.endTime),
            maxVolunteers: shift.maxVolunteers
        });
        setCreateModalOpen(true);
    };

    const handleSaveShift = async () => {
        setActionLoading(true);
        try {
            if (editMode && editingShiftId) {
                await api.put(`/shifts/${editingShiftId}`, newShiftData);
            } else if (targetWorkAreaId) {
                await api.post(`/shifts/work-area/${targetWorkAreaId}`, newShiftData);
            }
            setCreateModalOpen(false);
            fetchData();
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } | string } };
            let errorMsg = "Váratlan hiba történt a mentés során.";
            if (err.response?.data) {
                if (typeof err.response.data === 'string') errorMsg = err.response.data;
                else if (typeof err.response.data === 'object' && err.response.data.message) errorMsg = err.response.data.message;
            }
            setErrorMessage(errorMsg);
            setErrorModalOpen(true);
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeleteShift = async (shiftId: number) => {
        if (!window.confirm("Biztosan törlöd ezt az idősávot? Minden benne lévő beosztás elvész.")) return;
        setActionLoading(true);
        try {
            await api.delete(`/shifts/${shiftId}`);
            fetchData();
        } catch {
            setErrorMessage("Hiba történt a törlés során.");
            setErrorModalOpen(true);
        } finally {
            setActionLoading(false);
        }
    };

    const handleAssignUsers = async () => {
        if (!selectedShiftForAssign) return;
        setActionLoading(true);
        try {
            await api.post(`/shifts/${selectedShiftForAssign.id}/assign`, { applicationIds: selectedApplicantIds });
            setAssignModalOpen(false);
            fetchData();
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } | string } };
            let errorMsg = "Hiba történt a beosztás során.";
            if (err.response?.data) {
                if (typeof err.response.data === 'string') errorMsg = err.response.data;
                else if (typeof err.response.data === 'object' && err.response.data.message) errorMsg = err.response.data.message;
            }
            setErrorMessage(errorMsg);
            setErrorModalOpen(true);
        } finally {
            setActionLoading(false);
        }
    };

    const handleRemoveUser = async (shiftId: number, appId: number, name: string) => {
        if (!window.confirm(`Biztosan eltávolítod ${name} nevű önkéntest a műszakból?`)) return;
        setActionLoading(true);
        try {
            await api.delete(`/shifts/${shiftId}/remove/${appId}`);
            fetchData();
        } catch {
            setErrorMessage("Hiba az eltávolításnál.");
            setErrorModalOpen(true);
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) return <Box display="flex" justifyContent="center" mt={10}><CircularProgress size={60} /></Box>;

    return (
        <Container maxWidth="xl" sx={{ mt: { xs: 2, md: 4 }, mb: 10 }}>
            <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(`/dashboard`)} sx={{ mb: 3 }} disabled={actionLoading}>
                Vissza a dashboard-ra
            </Button>

            <Box mb={4}>
                <Typography variant="h4" fontWeight="900" color="primary.main">{event?.title}</Typography>
                <Typography variant="h6" color="text.secondary">Beosztás és Idősávok kezelése</Typography>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

            {/* --- RESZPONSZÍV ESZKÖZTÁR ÉS SZŰRŐK --- */}
            <Paper elevation={0} sx={{ p: 2, mb: 4, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 3 }}>
                <Grid container spacing={2} alignItems="center">
                    <Grid size={{ xs: 12, md: 'auto', lg: 'auto' }}>
                        <ToggleButtonGroup
                            value={viewMode}
                            exclusive
                            onChange={(_, newView) => newView && setViewMode(newView)}
                            size="small"
                            sx={{ display: 'flex', width: '100%' }}
                        >
                            <ToggleButton value="cards" sx={{ flexGrow: { xs: 1, md: 0 } }}><ViewModuleIcon sx={{ mr: 1 }}/> Kártyák</ToggleButton>
                            <ToggleButton value="table" sx={{ flexGrow: { xs: 1, md: 0 } }}><ViewListIcon sx={{ mr: 1 }}/> Táblázat</ToggleButton>
                        </ToggleButtonGroup>
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6, md: 3, lg: 2 }}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Munkaterület</InputLabel>
                            <Select value={filterArea} label="Munkaterület" onChange={(e) => setFilterArea(e.target.value)}>
                                <MenuItem value="all">Összes terület</MenuItem>
                                {workAreas.map(wa => <MenuItem key={wa.id} value={wa.id.toString()}>{wa.name}</MenuItem>)}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3, lg: 2 }}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Melyik Nap?</InputLabel>
                            <Select value={filterDate} label="Melyik Nap?" onChange={(e) => setFilterDate(e.target.value)}>
                                <MenuItem value="all">Minden nap</MenuItem>
                                {uniqueDates.map(date => <MenuItem key={date} value={date}>{date}</MenuItem>)}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3, lg: 2 }}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Státusz</InputLabel>
                            <Select value={filterStatus} label="Státusz" onChange={(e) => setFilterStatus(e.target.value)}>
                                <MenuItem value="all">Minden státusz</MenuItem>
                                <MenuItem value="has_space">Van még hely</MenuItem>
                                <MenuItem value="full">Betelt</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3, lg: 2 }}>
                        <TextField
                            fullWidth size="small" label="Keresés..."
                            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                            slotProps={{ input: { endAdornment: <SearchIcon color="action" /> } }}
                        />
                    </Grid>

                    <Grid size={{ xs: 12, lg: "auto" }} sx={{ ml: { lg: 'auto' } }}>
                        <Button
                            variant="outlined"
                            color="success"
                            fullWidth
                            startIcon={<DownloadIcon />}
                            onClick={exportToExcel}
                        >
                            Excel Letöltés
                        </Button>
                    </Grid>
                </Grid>
            </Paper>

            {/* --- NÉZETEK --- */}
            {viewMode === 'cards' && (
                workAreas.filter(area => filterArea === 'all' || filterArea === area.id.toString()).map((area) => {
                    const shiftsInArea = filteredShifts.filter(s => s.workAreaId === area.id);

                    const groupedShifts = shiftsInArea.reduce((acc, shift) => {
                        const dateKey = formatDateWithDay(shift.startTime);
                        if (!acc[dateKey]) acc[dateKey] = [];
                        acc[dateKey].push(shift);
                        return acc;
                    }, {} as Record<string, Shift[]>);

                    return (
                        <Box key={area.id} mb={6}>
                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} sx={{ borderBottom: '2px solid #e2e8f0', pb: 1 }}>
                                <Typography variant="h5" fontWeight="900" color="secondary.main">📍 {area.name}</Typography>
                                <Button size="small" variant="contained" color="secondary" startIcon={<AddIcon />} onClick={() => handleOpenCreateModal(area.id)} disabled={actionLoading} sx={{ borderRadius: 2 }}>
                                    Új idősáv
                                </Button>
                            </Box>

                            {Object.keys(groupedShifts).length === 0 ? (
                                <Typography variant="body2" color="text.secondary" fontStyle="italic" sx={{ ml: 2 }}>Nincsenek a szűrésnek megfelelő idősávok ezen a területen.</Typography>
                            ) : (
                                Object.entries(groupedShifts).map(([dateLabel, dayShifts]) => (
                                    <Box key={dateLabel} sx={{ mb: 4, ml: 1, pl: 2, borderLeft: '3px solid #cbd5e1' }}>
                                        <Typography variant="subtitle1" fontWeight="bold" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                            <CalendarTodayIcon fontSize="small" /> {dateLabel}
                                        </Typography>

                                        <Grid container spacing={2}>
                                            {dayShifts.map((shift) => {
                                                const currentCount = shift.assignedUsers?.length || 0;
                                                const isFull = currentCount >= shift.maxVolunteers;
                                                const isExpanded = expandedShifts.includes(shift.id);

                                                return (
                                                    <Grid size={{xs:12, md:6, lg:4}} key={shift.id}>
                                                        <Paper variant="outlined" sx={{ borderRadius: 3, borderLeft: '6px solid', borderLeftColor: isFull ? 'success.main' : 'warning.main', overflow: 'hidden' }}>
                                                            <Box onClick={() => toggleShiftExpand(shift.id)} sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', '&:hover': { bgcolor: '#f8fafc' } }}>
                                                                <Box display="flex" alignItems="center" gap={1.5}>
                                                                    <Avatar sx={{ bgcolor: isFull ? 'success.light' : 'warning.light', color: isFull ? 'success.dark' : 'warning.dark' }}>
                                                                        <AccessTimeIcon />
                                                                    </Avatar>
                                                                    <Box>
                                                                        <Typography variant="subtitle1" fontWeight="bold">
                                                                            {shift.name ? `${shift.name} (` : ''}
                                                                            {formatTimeOnly(shift.startTime)} - {formatTimeOnly(shift.endTime)}
                                                                            {shift.name ? ')' : ''}
                                                                        </Typography>
                                                                        <Typography variant="caption" fontWeight="bold" color={isFull ? 'success.main' : 'warning.dark'}>
                                                                            {currentCount} / {shift.maxVolunteers} fő beosztva
                                                                        </Typography>
                                                                    </Box>
                                                                </Box>
                                                                <Box display="flex" alignItems="center" gap={0.5}>
                                                                    <IconButton size="small" color="primary" onClick={(e) => { e.stopPropagation(); handleOpenEditModal(shift); }} disabled={actionLoading}><EditIcon fontSize="small" /></IconButton>
                                                                    <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); handleDeleteShift(shift.id); }} disabled={actionLoading}><DeleteIcon fontSize="small" /></IconButton>
                                                                    <IconButton size="small">{isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}</IconButton>
                                                                </Box>
                                                            </Box>

                                                            <Collapse in={isExpanded}>
                                                                <Divider />
                                                                <Box sx={{ p: 2, bgcolor: '#f1f5f9' }}>
                                                                    {shift.assignedUsers?.map(user => (
                                                                        <Paper key={user.applicationId} elevation={0} sx={{ p: 1, mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: 2 }}>
                                                                            <Typography variant="body2" fontWeight="500">{user.name}</Typography>
                                                                            <IconButton size="small" color="error" onClick={() => handleRemoveUser(shift.id, user.applicationId, user.name)} disabled={actionLoading}><DeleteOutlineIcon fontSize="small" /></IconButton>
                                                                        </Paper>
                                                                    ))}
                                                                    <Button fullWidth variant="outlined" startIcon={<GroupAddIcon />} onClick={() => { setSelectedShiftForAssign(shift); setSelectedApplicantIds([]); setAssignModalOpen(true); }} disabled={actionLoading} sx={{ mt: 1, borderRadius: 2, bgcolor: 'white' }}>
                                                                        Önkéntes hozzáadása
                                                                    </Button>
                                                                </Box>
                                                            </Collapse>
                                                        </Paper>
                                                    </Grid>
                                                )
                                            })}
                                        </Grid>
                                    </Box>
                                ))
                            )}
                        </Box>
                    );
                })
            )}

            {/* --- JAVÍTOTT: TÁBLÁZATOS NÉZET KATTINTHATÓ CÍMKÉVEL --- */}
            {viewMode === 'table' && (
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3, mb: 5 }}>
                    <Table>
                        <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                            <TableRow>
                                <TableCell><b>Munkaterület</b></TableCell>
                                <TableCell><b>Nap</b></TableCell>
                                <TableCell><b>Idősáv</b></TableCell>
                                <TableCell><b>Kapacitás</b></TableCell>
                                <TableCell><b>Beosztott Önkéntesek</b></TableCell>
                                <TableCell align="right"><b>Műveletek</b></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredShifts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} align="center" sx={{ py: 3, color: 'text.secondary' }}>Nincs a szűrésnek megfelelő idősáv.</TableCell>
                                </TableRow>
                            ) : (
                                filteredShifts.map((shift) => {
                                    const isFull = (shift.assignedUsers?.length || 0) >= shift.maxVolunteers;
                                    return (
                                        <TableRow key={shift.id} hover>
                                            <TableCell>{shift.workAreaName}</TableCell>
                                            <TableCell>{formatDateWithDay(shift.startTime)}</TableCell>
                                            <TableCell>
                                                {shift.name ? <strong>{shift.name} </strong> : ''}
                                                ({formatTimeOnly(shift.startTime)} - {formatTimeOnly(shift.endTime)})
                                            </TableCell>
                                            <TableCell>
                                                <Typography color={isFull ? 'success.main' : 'text.primary'} fontWeight="bold">
                                                    {shift.assignedUsers?.length || 0} / {shift.maxVolunteers}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                {/* --- BUBORÉK HELYETT KATTINTHATÓ GOMB (MOBILBARÁT) --- */}
                                                {shift.assignedUsers?.length ? (
                                                    <Box display="flex" flexWrap="wrap" gap={0.5}>
                                                        {shift.assignedUsers.slice(0, 3).map(u => (
                                                            <Chip key={u.applicationId} label={u.name} size="small" variant="outlined" />
                                                        ))}
                                                        {shift.assignedUsers.length > 3 && (
                                                            <Chip
                                                                label={`+${shift.assignedUsers.length - 3} fő`}
                                                                size="small"
                                                                color="primary"
                                                                sx={{ cursor: 'pointer', fontWeight: 'bold' }}
                                                                onClick={() => {
                                                                    setSelectedShiftForUsersList(shift);
                                                                    setUsersListModalOpen(true);
                                                                }}
                                                            />
                                                        )}
                                                    </Box>
                                                ) : (
                                                    <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Üres</span>
                                                )}
                                            </TableCell>
                                            <TableCell align="right">
                                                <Button size="small" variant="contained" disabled={actionLoading} onClick={() => { setSelectedShiftForAssign(shift); setSelectedApplicantIds([]); setAssignModalOpen(true); }} sx={{ mr: 1 }}>
                                                    Beoszt
                                                </Button>
                                                <IconButton size="small" color="primary" onClick={() => handleOpenEditModal(shift)} disabled={actionLoading}><EditIcon fontSize="small" /></IconButton>
                                                <IconButton size="small" color="error" onClick={() => handleDeleteShift(shift.id)} disabled={actionLoading}><DeleteIcon fontSize="small" /></IconButton>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* --- MODALOK --- */}
            <Dialog open={createModalOpen} onClose={() => setCreateModalOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
                <DialogTitle sx={{ fontWeight: 'bold' }}>{editMode ? 'Idősáv módosítása' : 'Új idősáv'}</DialogTitle>
                <DialogContent dividers sx={{ p: 3 }}>
                    <TextField margin="normal" label="Műszak neve (pl. Délelőtt) - Opcionális" fullWidth value={newShiftData.name} onChange={(e) => setNewShiftData({...newShiftData, name: e.target.value})} disabled={actionLoading} />
                    <TextField margin="normal" type="datetime-local" label="Kezdés *" fullWidth InputLabelProps={{ shrink: true }} value={newShiftData.startTime} onChange={(e) => setNewShiftData({...newShiftData, startTime: e.target.value})} disabled={actionLoading} />
                    <TextField margin="normal" type="datetime-local" label="Vége *" fullWidth InputLabelProps={{ shrink: true }} value={newShiftData.endTime} onChange={(e) => setNewShiftData({...newShiftData, endTime: e.target.value})} disabled={actionLoading} />
                    <TextField margin="normal" type="number" label="Létszám (Max fő)" fullWidth value={newShiftData.maxVolunteers} onChange={(e) => setNewShiftData({...newShiftData, maxVolunteers: parseInt(e.target.value) || 0})} disabled={actionLoading} />
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setCreateModalOpen(false)} color="inherit" disabled={actionLoading}>Mégse</Button>
                    <Button
                        onClick={handleSaveShift}
                        variant="contained"
                        disabled={actionLoading || !newShiftData.startTime || !newShiftData.endTime}
                    >
                        {actionLoading ? 'Mentés...' : 'Mentés'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={assignModalOpen} onClose={() => setAssignModalOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
                <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white' }}>Önkéntesek beosztása</DialogTitle>
                <DialogContent sx={{ mt: 2 }}>
                    {approvedApplicants
                        .filter(a => a.workAreaId === selectedShiftForAssign?.workAreaId && !selectedShiftForAssign.assignedUsers.some(u => u.applicationId === a.applicationId))
                        .map(app => (
                            <Paper key={app.applicationId} elevation={0} sx={{ p: 1.5, mb: 1, display: 'flex', alignItems: 'center', gap: 2, border: '1px solid #e2e8f0', borderRadius: 2, cursor: 'pointer' }} onClick={() => !actionLoading && setSelectedApplicantIds(prev => prev.includes(app.applicationId) ? prev.filter(i => i !== app.applicationId) : [...prev, app.applicationId])}>
                                <Checkbox checked={selectedApplicantIds.includes(app.applicationId)} disabled={actionLoading} />
                                <Typography fontWeight="500">{app.userName}</Typography>
                            </Paper>
                        ))
                    }
                    {approvedApplicants.filter(a => a.workAreaId === selectedShiftForAssign?.workAreaId && !selectedShiftForAssign.assignedUsers.some(u => u.applicationId === a.applicationId)).length === 0 && <Alert severity="info">Nincs beosztható önkéntes ezen a területen (Vagy mindenki be van már osztva).</Alert>}
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setAssignModalOpen(false)} color="inherit" disabled={actionLoading}>Mégse</Button>
                    <Button onClick={handleAssignUsers} variant="contained" disabled={actionLoading || selectedApplicantIds.length === 0}>
                        {actionLoading ? 'Feldolgozás...' : `Beosztás (${selectedApplicantIds.length} fő)`}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* --- ÚJ: MOBILBARÁT BEOSZTOTTAK LISTÁJA MODAL --- */}
            <Dialog open={usersListModalOpen} onClose={() => setUsersListModalOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
                <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 'bold' }}>
                    Beosztott Önkéntesek
                </DialogTitle>
                <DialogContent dividers sx={{ p: 2, bgcolor: '#f8fafc' }}>
                    {selectedShiftForUsersList?.assignedUsers.map(user => (
                        <Paper key={user.applicationId} elevation={0} sx={{ p: 1.5, mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: 2 }}>
                            <Typography fontWeight="500">{user.name}</Typography>
                            {/* Itt is hagyhatunk egy törlés gombot a kényelemért, ha szükséges, de egyelőre a listázás a lényeg */}
                        </Paper>
                    ))}
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setUsersListModalOpen(false)} variant="contained" color="inherit" fullWidth>
                        Bezárás
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={errorModalOpen} onClose={() => setErrorModalOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
                <DialogTitle sx={{ bgcolor: 'error.main', color: 'white', display: 'flex', alignItems: 'center', gap: 1, fontWeight: 'bold' }}>
                    ⚠️ Figyelmeztetés
                </DialogTitle>
                <DialogContent sx={{ mt: 3, mb: 1 }}>
                    <Typography variant="body1" sx={{ fontSize: '1.1rem', whiteSpace: 'pre-wrap' }}>{errorMessage}</Typography>
                </DialogContent>
                <DialogActions sx={{ p: 2, bgcolor: '#f8fafc' }}><Button onClick={() => setErrorModalOpen(false)} variant="contained" color="error" sx={{ fontWeight: 'bold', px: 3 }}>Megértettem</Button></DialogActions>
            </Dialog>
        </Container>
    );
}