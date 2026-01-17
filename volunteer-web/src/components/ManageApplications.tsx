import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Container, Typography, Box, Paper, Button, Chip, IconButton, CircularProgress,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField, Grid,
    Card, CardContent, CardHeader, Divider, List, ListItem, ListItemText,
    Checkbox, ListItemIcon, Alert, ListItemButton
} from '@mui/material'; // <--- ListItemButton HOZZÁADVA
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import api from '../api/axios';

// Típusok
interface User { id: number; username: string; email: string; }
interface WorkArea { id: number; name: string; }
interface Shift { id: number; name: string; startTime: string; endTime: string; volunteers?: User[]; }
interface Application {
    id: number;
    user: User;
    workArea: WorkArea;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export default function ManageApplications() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [applications, setApplications] = useState<Application[]>([]);
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    // Modalok állapota
    const [openCreateShift, setOpenCreateShift] = useState(false);
    const [openAddPeople, setOpenAddPeople] = useState(false);

    // Form adatok
    const [newShiftName, setNewShiftName] = useState("");
    const [newShiftStart, setNewShiftStart] = useState("");
    const [newShiftEnd, setNewShiftEnd] = useState("");

    // Tömeges hozzáadáshoz
    const [targetShiftId, setTargetShiftId] = useState<number | null>(null);
    const [selectedVolunteers, setSelectedVolunteers] = useState<number[]>([]);

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [appsRes, shiftsRes] = await Promise.all([
                api.get(`/applications/event/${id}`),
                api.get(`/shifts/event/${id}`)
            ]);
            setApplications(appsRes.data);
            setShifts(shiftsRes.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // --- MŰSZAK LÉTREHOZÁSA ---
    const handleCreateShift = async () => {
        if (!newShiftName || !newShiftStart || !newShiftEnd) return alert("Minden mező kötelező!");
        try {
            await api.post('/shifts/create', {
                eventId: id,
                name: newShiftName,
                startTime: newShiftStart,
                endTime: newShiftEnd
            });
            setOpenCreateShift(false);
            setNewShiftName(""); setNewShiftStart(""); setNewShiftEnd("");
            fetchData();
        } catch (error) {
            console.error(error);
            alert("Hiba a létrehozáskor");
        }
    };

    // --- EMBEREK HOZZÁADÁSA (TÖMEGES) ---
    const handleOpenAddPeople = (shiftId: number) => {
        setTargetShiftId(shiftId);
        setSelectedVolunteers([]); // Reset
        setOpenAddPeople(true);
    };

    const handleBulkAssign = async () => {
        if (!targetShiftId || selectedVolunteers.length === 0) return;

        try {
            const promises = selectedVolunteers.map(userId =>
                api.post(`/shifts/${targetShiftId}/assign/${userId}`)
            );
            await Promise.all(promises);

            setOpenAddPeople(false);
            fetchData();
        } catch (error) {
            console.error(error);
            alert("Hiba történt a hozzárendeléskor.");
        }
    };

    const getAvailableVolunteers = (shiftId: number) => {
        const currentShift = shifts.find(s => s.id === shiftId);
        const assignedIds = currentShift?.volunteers?.map(v => v.id) || [];

        return applications.filter(app =>
            app.status === 'APPROVED' && !assignedIds.includes(app.user.id)
        );
    };

    const handleToggleVolunteer = (userId: number) => {
        const currentIndex = selectedVolunteers.indexOf(userId);
        const newChecked = [...selectedVolunteers];

        if (currentIndex === -1) {
            newChecked.push(userId);
        } else {
            newChecked.splice(currentIndex, 1);
        }
        setSelectedVolunteers(newChecked);
    };

    const formatTime = (date: string) => new Date(date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    const formatDate = (date: string) => new Date(date).toLocaleDateString([], {month: 'short', day: 'numeric'});

    const changeStatus = async (appId: number, status: string) => {
        try {
            await api.put(`/applications/${appId}/status`, null, { params: { status } });
            fetchData();
        } catch (e) { console.error(e); }
    };

    if (loading) return <Box display="flex" justifyContent="center" mt={5}><CircularProgress /></Box>;

    return (
        <Container sx={{ mt: 4, mb: 10 }}>
            {/* FEJLÉC */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
                <Box display="flex" alignItems="center">
                    <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/dashboard')} sx={{ mr: 2 }}>Vissza</Button>
                    <Typography variant="h4">Beosztás Tervező</Typography>
                </Box>
                <Button variant="contained" startIcon={<AddCircleOutlineIcon />} onClick={() => setOpenCreateShift(true)}>
                    Új Műszak
                </Button>
            </Box>

            <Grid container spacing={3}>

                {/* 1. BAL OSZLOP: JELENTKEZŐK LISTÁJA */}
                <Grid size={{ xs: 12, md: 3 }} sx={{ borderRight: '1px solid #eee' }}>
                    <Typography variant="h6" gutterBottom>Jelentkezések</Typography>
                    <Box sx={{ maxHeight: '70vh', overflowY: 'auto' }}>
                        {applications.length === 0 && <Typography variant="body2" color="text.secondary">Nincs jelentkező.</Typography>}
                        {applications.map(app => (
                            <Paper key={app.id} elevation={1} sx={{ p: 1.5, mb: 1.5, borderLeft: `4px solid ${app.status === 'APPROVED' ? 'green' : app.status === 'PENDING' ? 'orange' : 'red'}` }}>
                                <Typography variant="subtitle2">{app.user.username}</Typography>
                                <Typography variant="caption" display="block">{app.workArea.name}</Typography>

                                {app.status === 'PENDING' && (
                                    <Box mt={1} display="flex" gap={1}>
                                        <IconButton size="small" color="success" onClick={() => changeStatus(app.id, 'APPROVED')}><CheckIcon fontSize="small" /></IconButton>
                                        <IconButton size="small" color="error" onClick={() => changeStatus(app.id, 'REJECTED')}><CloseIcon fontSize="small" /></IconButton>
                                    </Box>
                                )}
                                {app.status === 'APPROVED' && <Chip label="Jöhet" size="small" color="success" variant="outlined" sx={{ mt: 0.5 }} />}
                            </Paper>
                        ))}
                    </Box>
                </Grid>

                {/* 2. JOBB OSZLOP: MŰSZAKOK (KÁRTYÁK) */}
                <Grid size={{ xs: 12, md: 9 }}>
                    <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>Műszakok</Typography>

                    <Grid container spacing={3}>
                        {shifts.map(shift => (
                            <Grid size={{ xs: 12, md: 6, lg: 4 }} key={shift.id}>
                                <Card elevation={3} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                    <CardHeader
                                        title={shift.name}
                                        subheader={`${formatDate(shift.startTime)} ${formatTime(shift.startTime)} - ${formatTime(shift.endTime)}`}
                                        sx={{ bgcolor: '#f5f5f5', pb: 1 }}
                                        titleTypographyProps={{ variant: 'h6' }}
                                    />
                                    <Divider />
                                    <CardContent sx={{ flexGrow: 1, p: 1 }}>
                                        <List dense>
                                            {shift.volunteers && shift.volunteers.length > 0 ? (
                                                shift.volunteers.map(vol => (
                                                    <ListItem key={vol.id} sx={{ bgcolor: '#fff', borderRadius: 1, mb: 0.5, border: '1px solid #eee' }}>
                                                        <ListItemText primary={vol.username} />
                                                    </ListItem>
                                                ))
                                            ) : (
                                                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
                                                    Még nincs beosztott ember.
                                                </Typography>
                                            )}
                                        </List>
                                    </CardContent>
                                    <Divider />
                                    <Button
                                        fullWidth
                                        variant="contained"
                                        color="primary"
                                        startIcon={<AddCircleOutlineIcon />}
                                        onClick={() => handleOpenAddPeople(shift.id)}
                                        sx={{ borderRadius: 0, py: 1.5 }}
                                    >
                                        Emberek hozzáadása
                                    </Button>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>
                </Grid>
            </Grid>

            {/* --- MODAL: ÚJ MŰSZAK --- */}
            <Dialog open={openCreateShift} onClose={() => setOpenCreateShift(false)}>
                <DialogTitle>Új Műszak Létrehozása</DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 0.5 }}>
                        <Grid size={{ xs: 12 }}>
                            <TextField label="Műszak Neve (pl. Pultos Reggel)" fullWidth value={newShiftName} onChange={e => setNewShiftName(e.target.value)} autoFocus />
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                            <TextField type="datetime-local" label="Kezdés" fullWidth InputLabelProps={{shrink: true}} value={newShiftStart} onChange={e => setNewShiftStart(e.target.value)} />
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                            <TextField type="datetime-local" label="Vége" fullWidth InputLabelProps={{shrink: true}} value={newShiftEnd} onChange={e => setNewShiftEnd(e.target.value)} />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenCreateShift(false)}>Mégse</Button>
                    <Button onClick={handleCreateShift} variant="contained">Létrehozás</Button>
                </DialogActions>
            </Dialog>

            {/* --- MODAL: EMBEREK HOZZÁADÁSA --- */}
            <Dialog open={openAddPeople} onClose={() => setOpenAddPeople(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Önkéntesek kiválasztása</DialogTitle>
                <DialogContent dividers>
                    {targetShiftId && getAvailableVolunteers(targetShiftId).length === 0 ? (
                        <Alert severity="info">Nincs elérhető, elfogadott jelentkező erre a műszakra.</Alert>
                    ) : (
                        <List>
                            {targetShiftId && getAvailableVolunteers(targetShiftId).map((app) => {
                                const labelId = `checkbox-list-label-${app.user.id}`;
                                return (
                                    // JAVÍTÁS: ListItemButton használata a kattinthatóságért
                                    <ListItem key={app.user.id} disablePadding>
                                        <ListItemButton onClick={() => handleToggleVolunteer(app.user.id)}>
                                            <ListItemIcon>
                                                <Checkbox
                                                    edge="start"
                                                    checked={selectedVolunteers.indexOf(app.user.id) !== -1}
                                                    tabIndex={-1}
                                                    disableRipple
                                                    inputProps={{ 'aria-labelledby': labelId }}
                                                />
                                            </ListItemIcon>
                                            <ListItemText
                                                id={labelId}
                                                primary={app.user.username}
                                                secondary={`${app.workArea.name} - ${app.user.email}`}
                                            />
                                        </ListItemButton>
                                    </ListItem>
                                );
                            })}
                        </List>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenAddPeople(false)}>Mégse</Button>
                    <Button
                        onClick={handleBulkAssign}
                        variant="contained"
                        color="primary"
                        disabled={selectedVolunteers.length === 0}
                    >
                        Hozzáadás ({selectedVolunteers.length} fő)
                    </Button>
                </DialogActions>
            </Dialog>

        </Container>
    );
}