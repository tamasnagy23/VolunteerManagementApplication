import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
    Container, Typography, Box, Paper, Button, CircularProgress,
    Alert, Avatar, IconButton, Collapse, Dialog, DialogTitle,
    DialogContent, DialogActions, Checkbox, Divider, TextField,
    MenuItem, Select, InputLabel, FormControl, ToggleButton, ToggleButtonGroup,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow
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

export default function ShiftManager() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    // Adatok tárolása
    const [event, setEvent] = useState<EventData | null>(null);
    const [workAreas, setWorkAreas] = useState<WorkArea[]>([]);
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [approvedApplicants, setApprovedApplicants] = useState<ApprovedApplicant[]>([]);

    // UI állapotok
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [expandedShifts, setExpandedShifts] = useState<number[]>([]);

    // Szűrők és Nézetek
    const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
    const [filterArea, setFilterArea] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Modal állapotok
    const [assignModalOpen, setAssignModalOpen] = useState(false);
    const [createModalOpen, setCreateModalOpen] = useState(false);

    const [selectedShiftForAssign, setSelectedShiftForAssign] = useState<Shift | null>(null);
    const [selectedApplicantIds, setSelectedApplicantIds] = useState<number[]>([]);

    const [editMode, setEditMode] = useState(false);
    const [editingShiftId, setEditingShiftId] = useState<number | null>(null);
    const [targetWorkAreaId, setTargetWorkAreaId] = useState<number | null>(null);
    const [newShiftData, setNewShiftData] = useState({
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

    // --- SZŰRŐ LOGIKA ---
    const filteredShifts = useMemo(() => {
        return shifts.filter(shift => {
            if (filterArea !== 'all' && shift.workAreaId.toString() !== filterArea) return false;

            const isFull = (shift.assignedUsers?.length || 0) >= shift.maxVolunteers;
            if (filterStatus === 'full' && !isFull) return false;
            if (filterStatus === 'has_space' && isFull) return false;

            if (searchQuery.trim() !== '') {
                const query = searchQuery.toLowerCase();
                const hasVolunteer = shift.assignedUsers?.some(u => u.name.toLowerCase().includes(query));
                if (!hasVolunteer) return false;
            }

            return true;
        });
    }, [shifts, filterArea, filterStatus, searchQuery]);

    // --- EXCEL EXPORT ---
    const exportToExcel = () => {
        const excelData = shifts.map(shift => {
            const volunteers = shift.assignedUsers?.map(u => u.name).join(', ') || 'Nincs beosztva senki';
            return {
                'Munkaterület': shift.workAreaName,
                'Kezdés': formatTime(shift.startTime),
                'Befejezés': formatTime(shift.endTime),
                'Kapacitás': `${shift.assignedUsers?.length || 0} / ${shift.maxVolunteers}`,
                'Státusz': (shift.assignedUsers?.length || 0) >= shift.maxVolunteers ? 'Betelt' : 'Van hely',
                'Beosztott Önkéntesek': volunteers
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(excelData);

        const columnWidths = [
            { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 50 }
        ];
        worksheet['!cols'] = columnWidths;

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Beosztás");

        XLSX.writeFile(workbook, `Beosztas_${event?.title || 'esemeny'}.xlsx`);
    };

    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
    };

    const formatDateForInput = (dateString: string) => {
        if (!dateString) return '';
        return dateString.substring(0, 16);
    };

    const toggleShiftExpand = (shiftId: number) => {
        setExpandedShifts(prev => prev.includes(shiftId) ? prev.filter(i => i !== shiftId) : [...prev, shiftId]);
    };

    const handleOpenCreateModal = (waId: number) => {
        setTargetWorkAreaId(waId);
        setEditMode(false);
        setNewShiftData({ startTime: '', endTime: '', maxVolunteers: 5 });
        setCreateModalOpen(true);
    };

    const handleOpenEditModal = (shift: Shift) => {
        setEditingShiftId(shift.id);
        setEditMode(true);
        setNewShiftData({
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
        } catch {
            alert("Hiba történt a mentés során.");
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
            alert("Hiba történt a törlés során.");
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
            // Megmondjuk a TypeScriptnek, hogy ez valószínűleg egy Axios hibaobjektum
            const err = error as { response?: { data?: { message?: string } | string } };

            if (err.response && err.response.data) {
                const data = err.response.data;
                // Megnézzük, hogy a data objektum-e (amiben van message), vagy sima szöveg
                const msg = typeof data === 'object' && data.message ? data.message : String(data);
                alert(`Hiba a beosztásnál: ${msg}`);
            } else {
                alert("Hiba történt a beosztás során.");
            }
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
            alert("Hiba az eltávolításnál.");
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
                <Typography variant="h6" color="text.secondary">Beosztás és Idősávok</Typography>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

            {/* --- ESZKÖZTÁR ÉS SZŰRŐK --- */}
            <Paper elevation={0} sx={{ p: 2, mb: 4, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 3 }}>
                <Grid container spacing={2} alignItems="center">
                    <Grid>
                        <ToggleButtonGroup value={viewMode} exclusive onChange={(_, newView) => newView && setViewMode(newView)} size="small">
                            <ToggleButton value="cards"><ViewModuleIcon sx={{ mr: 1 }}/> Kártyák</ToggleButton>
                            <ToggleButton value="table"><ViewListIcon sx={{ mr: 1 }}/> Táblázat</ToggleButton>
                        </ToggleButtonGroup>
                    </Grid>
                    <Grid size={{xs:12, sm:6, md:3}}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Munkaterület</InputLabel>
                            <Select value={filterArea} label="Munkaterület" onChange={(e) => setFilterArea(e.target.value)}>
                                <MenuItem value="all">Összes terület</MenuItem>
                                {workAreas.map(wa => <MenuItem key={wa.id} value={wa.id.toString()}>{wa.name}</MenuItem>)}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid size={{xs:12, sm:6, md:2}}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Státusz</InputLabel>
                            <Select value={filterStatus} label="Státusz" onChange={(e) => setFilterStatus(e.target.value)}>
                                <MenuItem value="all">Minden státusz</MenuItem>
                                <MenuItem value="has_space">Van még hely</MenuItem>
                                <MenuItem value="full">Betelt</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid size={{xs:12, md:3}}>
                        <TextField
                            fullWidth size="small" label="Keresés névre..."
                            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                            slotProps={{ input: { endAdornment: <SearchIcon color="action" /> } }}
                        />
                    </Grid>
                    <Grid size={{xs:12, md:"auto"}} sx={{ ml: 'auto' }}>
                        <Button variant="outlined" color="success" startIcon={<DownloadIcon />} onClick={exportToExcel}>
                            Excel Letöltés
                        </Button>
                    </Grid>
                </Grid>
            </Paper>

            {/* --- NÉZETEK --- */}
            {viewMode === 'cards' && (
                workAreas.filter(area => filterArea === 'all' || filterArea === area.id.toString()).map((area) => (
                    <Box key={area.id} mb={5}>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} sx={{ borderBottom: '2px solid #e2e8f0', pb: 1 }}>
                            <Typography variant="h6" fontWeight="bold" color="secondary.main">📍 {area.name}</Typography>
                            <Button size="small" variant="contained" color="secondary" startIcon={<AddIcon />} onClick={() => handleOpenCreateModal(area.id)} disabled={actionLoading} sx={{ borderRadius: 2 }}>
                                Új idősáv
                            </Button>
                        </Box>

                        <Grid container spacing={2}>
                            {filteredShifts.filter(s => s.workAreaId === area.id).length === 0 ? (
                                <Grid size={{xs:12}}>
                                    <Typography variant="body2" color="text.secondary" fontStyle="italic">Nincsenek a szűrésnek megfelelő idősávok ezen a területen.</Typography>
                                </Grid>
                            ) : (
                                filteredShifts.filter(s => s.workAreaId === area.id).map((shift) => {
                                    const currentCount = shift.assignedUsers?.length || 0;
                                    const isFull = currentCount >= shift.maxVolunteers;
                                    const isExpanded = expandedShifts.includes(shift.id);

                                    return (
                                        <Grid size={{xs:12, md:6}} key={shift.id}>
                                            <Paper variant="outlined" sx={{ borderRadius: 3, borderLeft: '5px solid', borderLeftColor: isFull ? 'success.main' : 'warning.main', overflow: 'hidden' }}>
                                                <Box onClick={() => toggleShiftExpand(shift.id)} sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                                                    <Box display="flex" alignItems="center" gap={1.5}>
                                                        <Avatar sx={{ bgcolor: isFull ? 'success.light' : 'warning.light', color: isFull ? 'success.dark' : 'warning.dark' }}>
                                                            <AccessTimeIcon />
                                                        </Avatar>
                                                        <Box>
                                                            <Typography variant="subtitle1" fontWeight="bold">{formatTime(shift.startTime)} - {formatTime(shift.endTime)}</Typography>
                                                            <Typography variant="caption" fontWeight="bold">{currentCount} / {shift.maxVolunteers} fő</Typography>
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
                                                    <Box sx={{ p: 2, bgcolor: '#f8fafc' }}>
                                                        {shift.assignedUsers?.map(user => (
                                                            <Paper key={user.applicationId} elevation={0} sx={{ p: 1, mb: 1, display: 'flex', justifyContent: 'space-between', border: '1px solid #e2e8f0', borderRadius: 2 }}>
                                                                <Typography variant="body2" fontWeight="500">{user.name}</Typography>
                                                                <IconButton size="small" color="error" onClick={() => handleRemoveUser(shift.id, user.applicationId, user.name)} disabled={actionLoading}><DeleteOutlineIcon fontSize="small" /></IconButton>
                                                            </Paper>
                                                        ))}
                                                        <Button fullWidth variant="outlined" startIcon={<GroupAddIcon />} onClick={() => { setSelectedShiftForAssign(shift); setSelectedApplicantIds([]); setAssignModalOpen(true); }} disabled={actionLoading} sx={{ mt: 1, borderRadius: 2 }}>
                                                            Hozzáadás
                                                        </Button>
                                                    </Box>
                                                </Collapse>
                                            </Paper>
                                        </Grid>
                                    )
                                })
                            )}
                        </Grid>
                    </Box>
                ))
            )}

            {viewMode === 'table' && (
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3, mb: 5 }}>
                    <Table>
                        <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                            <TableRow>
                                <TableCell><b>Munkaterület</b></TableCell>
                                <TableCell><b>Idősáv</b></TableCell>
                                <TableCell><b>Kapacitás</b></TableCell>
                                <TableCell><b>Beosztott Önkéntesek</b></TableCell>
                                <TableCell align="right"><b>Műveletek</b></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredShifts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>Nincs a szűrésnek megfelelő idősáv.</TableCell>
                                </TableRow>
                            ) : (
                                filteredShifts.map((shift) => {
                                    const isFull = (shift.assignedUsers?.length || 0) >= shift.maxVolunteers;
                                    return (
                                        <TableRow key={shift.id} hover>
                                            <TableCell>{shift.workAreaName}</TableCell>
                                            <TableCell>{formatTime(shift.startTime)} - {formatTime(shift.endTime)}</TableCell>
                                            <TableCell>
                                                <Typography color={isFull ? 'success.main' : 'text.primary'} fontWeight="bold">
                                                    {shift.assignedUsers?.length || 0} / {shift.maxVolunteers}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                {shift.assignedUsers?.length ? shift.assignedUsers.map(u => u.name).join(', ') : <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Üres</span>}
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
                    <TextField margin="normal" type="datetime-local" label="Kezdés" fullWidth InputLabelProps={{ shrink: true }} value={newShiftData.startTime} onChange={(e) => setNewShiftData({...newShiftData, startTime: e.target.value})} disabled={actionLoading} />
                    <TextField margin="normal" type="datetime-local" label="Vége" fullWidth InputLabelProps={{ shrink: true }} value={newShiftData.endTime} onChange={(e) => setNewShiftData({...newShiftData, endTime: e.target.value})} disabled={actionLoading} />
                    <TextField margin="normal" type="number" label="Létszám" fullWidth value={newShiftData.maxVolunteers} onChange={(e) => setNewShiftData({...newShiftData, maxVolunteers: parseInt(e.target.value) || 0})} disabled={actionLoading} />
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setCreateModalOpen(false)} color="inherit" disabled={actionLoading}>Mégse</Button>
                    <Button onClick={handleSaveShift} variant="contained" disabled={actionLoading}>
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
        </Container>
    );
}