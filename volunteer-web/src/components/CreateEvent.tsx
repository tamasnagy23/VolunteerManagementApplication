import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import {
    Box, Button, TextField, Typography, Container, Paper,
    IconButton, Divider, Alert, CircularProgress,
    Select, MenuItem, FormControl, InputLabel, Checkbox, FormControlLabel,
    useMediaQuery, useTheme, Dialog, DialogTitle, DialogContent, DialogActions,
    List, ListItem, ListItemText
} from '@mui/material';
import Grid from '@mui/material/Grid';
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import api from '../api/axios';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import axios from 'axios';

// --- INTERFÉSZEK ---
interface WorkAreaInput {
    id?: number;
    name: string;
    description: string;
    capacity: number;
}

interface EventQuestionInput {
    id?: number;
    questionText: string;
    questionType: 'TEXT' | 'DROPDOWN' | 'CHECKBOX';
    options: string;
    isRequired: boolean;
}

interface Organization {
    id: number;
    name: string;
}

interface UserProfile {
    role: string;
}

// ÚJ: A beosztás interfésze a Modalhoz
interface ShiftData {
    id: number;
    workAreaId: number;
    workAreaName: string;
    startTime: string;
    endTime: string;
    maxVolunteers: number;
}

export default function EventForm() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const isEditMode = !!id;

    const location = useLocation();
    const passedOrgId = location.state?.selectedOrgId;

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);

    const [user, setUser] = useState<UserProfile | null>(null);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [selectedAdminOrgId, setSelectedAdminOrgId] = useState<number | ''>(passedOrgId || '');

    const [eventData, setEventData] = useState({
        title: '', description: '', location: '',
        startTime: '2026-06-01T10:00', endTime: '2026-06-01T22:00'
    });

    const [workAreas, setWorkAreas] = useState<WorkAreaInput[]>([
        { name: '', description: '', capacity: 5 }
    ]);

    const [questions, setQuestions] = useState<EventQuestionInput[]>([]);

    // --- ÚJ: Ütközéskezelő Modal Állapotai ---
    const [conflictModalOpen, setConflictModalOpen] = useState(false);
    const [conflictingShifts, setConflictingShifts] = useState<ShiftData[]>([]);
    const [editingShiftId, setEditingShiftId] = useState<number | null>(null);
    const [shiftEditData, setShiftEditData] = useState({ startTime: '', endTime: '' });
    const [shiftActionLoading, setShiftActionLoading] = useState(false);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const userRes = await api.get('/users/me');
                setUser(userRes.data);

                if (userRes.data.role === 'SYS_ADMIN') {
                    const orgsRes = await api.get('/organizations');
                    setOrganizations(orgsRes.data);
                }

                if (isEditMode && id) {
                    const eventRes = await api.get(`/events/${id}`);
                    const data = eventRes.data;
                    setEventData({
                        title: data.title || '', description: data.description || '', location: data.location || '',
                        startTime: data.startTime ? data.startTime.substring(0, 16) : '',
                        endTime: data.endTime ? data.endTime.substring(0, 16) : ''
                    });

                    if (data.workAreas) {
                        setWorkAreas(data.workAreas.map((wa: WorkAreaInput) => ({
                            id: wa.id, name: wa.name, description: wa.description || '', capacity: wa.capacity || 0
                        })));
                    }

                    if (data.questions) {
                        setQuestions(data.questions.map((q: EventQuestionInput) => ({
                            id: q.id, questionText: q.questionText, questionType: q.questionType, options: q.options || '', isRequired: q.isRequired
                        })));
                    }
                }
            } catch {
                setError("Hiba az oldal betöltésekor. Lehet, hogy nincsenek megfelelő jogosultságaid.");
            } finally {
                setInitialLoading(false);
            }
        };

        fetchInitialData();
    }, [id, isEditMode]);

    const handleEventChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setEventData({ ...eventData, [e.target.name]: e.target.value });
    };

    const handleAreaChange = (index: number, field: keyof WorkAreaInput, value: string | number) => {
        const newAreas = [...workAreas];
        newAreas[index] = { ...newAreas[index], [field]: value };
        setWorkAreas(newAreas);
    };
    const addArea = () => setWorkAreas([...workAreas, { name: '', description: '', capacity: 5 }]);
    const removeArea = (index: number) => setWorkAreas(workAreas.filter((_, i) => i !== index));

    const handleQuestionChange = (index: number, field: keyof EventQuestionInput, value: string | boolean) => {
        const newQuestions = [...questions];
        newQuestions[index] = { ...newQuestions[index], [field]: value } as EventQuestionInput;
        if (field === 'questionType' && value === 'TEXT') newQuestions[index].options = '';
        setQuestions(newQuestions);
    };
    const addQuestion = () => setQuestions([...questions, { questionText: '', questionType: 'TEXT', options: '', isRequired: false }]);
    const removeQuestion = (index: number) => setQuestions(questions.filter((_, i) => i !== index));

    const handleDelete = async () => {
        if (window.confirm('Biztosan törölni szeretnéd ezt az eseményt? A hozzá tartozó jelentkezések is törlődnek!')) {
            try {
                setLoading(true);
                await api.delete(`/events/${id}`);
                navigate('/dashboard');
            } catch {
                setError('Nem sikerült törölni az eseményt.');
                setLoading(false);
            }
        }
    };

    const fixDate = (dateStr: string) => dateStr.length === 16 ? dateStr + ":00" : dateStr;

    // --- ÚJ: Műszakok ellenőrzése mentés előtt ---
    const checkShiftConflicts = async () => {
        if (!isEditMode || !id) return true; // Létrehozáskor nincsenek még műszakok

        try {
            const shiftsRes = await api.get(`/events/${id}/shifts`);
            const shifts: ShiftData[] = shiftsRes.data;

            const newEventStart = new Date(eventData.startTime).getTime();
            const newEventEnd = new Date(eventData.endTime).getTime();

            // Kikeressük azokat a műszakokat, amik kilógnak az új időkeretből
            const conflicts = shifts.filter(s => {
                const sStart = new Date(s.startTime).getTime();
                const sEnd = new Date(s.endTime).getTime();
                return sStart < newEventStart || sEnd > newEventEnd;
            });

            if (conflicts.length > 0) {
                setConflictingShifts(conflicts);
                setConflictModalOpen(true);
                return false; // Megállítjuk a mentést!
            }
            return true; // Nincs ütközés
        } catch (err) {
            console.error("Hiba a műszakok ellenőrzésekor", err);
            return true; // Ha hiba van a lekérdezésben, ráhagyjuk a Backend validációjára
        }
    };

    const handleSubmit = async (e?: FormEvent) => {
        if (e) e.preventDefault();
        setLoading(true);
        setError('');

        if (user?.role === 'SYS_ADMIN' && !isEditMode && selectedAdminOrgId === '') {
            setError('Rendszergazdaként kötelező kiválasztanod, hogy melyik szervezet nevében hozod létre az eseményt!');
            setLoading(false);
            return;
        }

        // --- PRE-CHECK: Ellenőrizzük az ütközéseket ---
        const canProceed = await checkShiftConflicts();
        if (!canProceed) {
            setLoading(false);
            return; // A Modal kinyílt, megállunk.
        }

        const payload = {
            ...eventData,
            startTime: fixDate(eventData.startTime),
            endTime: fixDate(eventData.endTime),
            workAreas: workAreas,
            questions: questions,
            organization: (user?.role === 'SYS_ADMIN' && selectedAdminOrgId !== '')
                ? { id: selectedAdminOrgId }
                : (passedOrgId ? { id: passedOrgId } : null)
        };

        try {
            if (isEditMode) await api.put(`/events/${id}`, payload);
            else await api.post('/events', payload);
            navigate('/dashboard');
        } catch (err: unknown) {
            if (axios.isAxiosError(err)) setError(err.response?.data?.message || err.response?.data || 'Hiba történt a mentés során.');
            else setError('Váratlan hiba történt.');
        } finally {
            setLoading(false);
        }
    };

    // --- ÚJ: Műszak Törlése a Modalban ---
    const handleModalDeleteShift = async (shiftId: number) => {
        if (!window.confirm("Biztosan törlöd ezt az idősávot?")) return;
        setShiftActionLoading(true);
        try {
            await api.delete(`/shifts/${shiftId}`);
            // Kivesszük a listából, ha sikeres
            const updatedConflicts = conflictingShifts.filter(s => s.id !== shiftId);
            setConflictingShifts(updatedConflicts);
            if (updatedConflicts.length === 0) setConflictModalOpen(false);
        } catch {
            alert("Hiba a műszak törlésekor.");
        } finally {
            setShiftActionLoading(false);
        }
    };

    // --- ÚJ: Műszak Módosítása a Modalban ---
    const handleModalSaveShift = async (shift: ShiftData) => {
        setShiftActionLoading(true);
        try {
            const payload = {
                startTime: fixDate(shiftEditData.startTime),
                endTime: fixDate(shiftEditData.endTime),
                maxVolunteers: shift.maxVolunteers
            };
            await api.put(`/shifts/${shift.id}`, payload);

            // Ha sikeresen átírta, levesszük az ütközési listáról
            const updatedConflicts = conflictingShifts.filter(s => s.id !== shift.id);
            setConflictingShifts(updatedConflicts);
            setEditingShiftId(null);

            if (updatedConflicts.length === 0) setConflictModalOpen(false);
        } catch (err: unknown) {
            if (axios.isAxiosError(err)) alert(err.response?.data?.message || "Hiba az időpont mentésekor.");
            else alert("Váratlan hiba történt.");
        } finally {
            setShiftActionLoading(false);
        }
    };

    if (initialLoading) return <Box display="flex" justifyContent="center" mt={10}><CircularProgress /></Box>;

    return (
        <Container maxWidth="lg" sx={{ mt: { xs: 2, md: 4 }, mb: 10 }}>
            <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/dashboard')} sx={{ mb: 2 }}>Mégse</Button>

            <Paper elevation={2} sx={{ p: { xs: 2, sm: 4 }, borderRadius: 3 }}>
                <Typography variant="h4" fontWeight="900" color="primary.main" gutterBottom sx={{ fontSize: { xs: '1.6rem', md: '2.125rem' } }}>
                    {isEditMode ? 'Esemény Szerkesztése' : 'Új Esemény Létrehozása'}
                </Typography>

                {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

                <form onSubmit={handleSubmit}>

                    {user?.role === 'SYS_ADMIN' && !isEditMode && (
                        <Alert severity="warning" sx={{ mb: 4, borderRadius: 2, bgcolor: '#fff4e5' }}>
                            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                                👑 Rendszergazdai Mód
                            </Typography>
                            <Typography variant="body2" mb={2}>
                                Mivel te látod az egész rendszert, ki kell választanod, hogy melyik csapat (Szervezet) alá akarod besorolni ezt az eseményt.
                            </Typography>
                            <FormControl fullWidth size="small" sx={{ bgcolor: 'white' }}>
                                <InputLabel>Válaszd ki a szervezetet *</InputLabel>
                                <Select
                                    value={selectedAdminOrgId}
                                    label="Válaszd ki a szervezetet *"
                                    onChange={(e) => setSelectedAdminOrgId(Number(e.target.value))}
                                    required
                                >
                                    {organizations.map(org => (
                                        <MenuItem key={org.id} value={org.id}>{org.name}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Alert>
                    )}

                    {/* 1. ALAPADATOK */}
                    <Box sx={{ mb: 4 }}>
                        <Typography variant="subtitle1" color="primary" sx={{ mb: 2, fontWeight: 'bold', textTransform: 'uppercase' }}>1. Alapadatok</Typography>
                        <Grid container spacing={2}>
                            <Grid size={12}>
                                <TextField fullWidth label="Esemény címe" name="title" value={eventData.title} onChange={handleEventChange} required />
                            </Grid>
                            <Grid size={12}>
                                <TextField fullWidth label="Helyszín" name="location" value={eventData.location} onChange={handleEventChange} required />
                            </Grid>
                            <Grid size={12}>
                                <TextField fullWidth label="Részletes leírás" name="description" value={eventData.description} onChange={handleEventChange} multiline rows={4} required />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField fullWidth type="datetime-local" label="Kezdés Időpontja" name="startTime" value={eventData.startTime} onChange={handleEventChange} InputLabelProps={{ shrink: true }} required />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField fullWidth type="datetime-local" label="Befejezés Időpontja" name="endTime" value={eventData.endTime} onChange={handleEventChange} InputLabelProps={{ shrink: true }} required />
                            </Grid>
                        </Grid>
                    </Box>

                    <Divider sx={{ mb: 4 }} />

                    {/* 2. MUNKATERÜLETEK */}
                    <Box sx={{ mb: 4 }}>
                        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, mb: 2, gap: 2 }}>
                            <Typography variant="subtitle1" color="primary" sx={{ fontWeight: 'bold', textTransform: 'uppercase' }}>2. Munkaterületek / Beosztások</Typography>
                            {!isMobile && (
                                <Button startIcon={<AddCircleOutlineIcon />} onClick={addArea} variant="outlined" size="small">Terület hozzáadása</Button>
                            )}
                        </Box>

                        {workAreas.map((area, index) => (
                            <Paper key={index} variant="outlined" sx={{ p: 2, mb: 2, bgcolor: '#fcfcfc', borderRadius: 2, position: 'relative' }}>
                                <IconButton
                                    color="error"
                                    onClick={() => removeArea(index)}
                                    disabled={workAreas.length === 1}
                                    sx={{ position: 'absolute', top: 8, right: 8 }}
                                >
                                    <DeleteIcon />
                                </IconButton>

                                <Grid container spacing={2} sx={{ pr: 4 }}>
                                    <Grid size={{ xs: 12, md: 5 }}>
                                        <TextField label="Terület neve (Pl. Jegykezelő)" fullWidth size="small" value={area.name} onChange={(e) => handleAreaChange(index, 'name', e.target.value)} required />
                                    </Grid>
                                    <Grid size={{ xs: 12, md: 4 }}>
                                        <TextField label="Rövid feladatleírás" fullWidth size="small" value={area.description} onChange={(e) => handleAreaChange(index, 'description', e.target.value)} />
                                    </Grid>
                                    <Grid size={{ xs: 12, md: 3 }}>
                                        <TextField type="number" label="Max fő" fullWidth size="small" value={area.capacity} onChange={(e) => handleAreaChange(index, 'capacity', parseInt(e.target.value) || 0)} required />
                                    </Grid>
                                </Grid>
                            </Paper>
                        ))}
                        {isMobile && (
                            <Button fullWidth startIcon={<AddCircleOutlineIcon />} onClick={addArea} variant="outlined" sx={{ mt: 1, borderStyle: 'dashed' }}>Új Munkaterület</Button>
                        )}
                    </Box>

                    <Divider sx={{ mb: 4 }} />

                    {/* 3. KÉRDŐÍV KÉSZÍTŐ */}
                    <Box sx={{ mb: 4 }}>
                        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, mb: 2, gap: 2 }}>
                            <Box>
                                <Typography variant="subtitle1" color="primary" sx={{ fontWeight: 'bold', textTransform: 'uppercase' }}>3. Jelentkezési Kérdőív (Opcionális)</Typography>
                                <Typography variant="caption" color="text.secondary">Kérj be extra adatokat a jelentkezőktől (pl. pólóméret, ételallergia).</Typography>
                            </Box>
                            {!isMobile && (
                                <Button startIcon={<AddCircleOutlineIcon />} onClick={addQuestion} variant="outlined" color="secondary" size="small">Kérdés hozzáadása</Button>
                            )}
                        </Box>

                        {questions.map((q, index) => (
                            <Paper key={index} variant="outlined" sx={{ p: 2, mb: 2, bgcolor: '#f9fbe7', borderRadius: 2, position: 'relative' }}>
                                <IconButton color="error" onClick={() => removeQuestion(index)} sx={{ position: 'absolute', top: 8, right: 8 }}>
                                    <DeleteIcon />
                                </IconButton>

                                <Grid container spacing={2} sx={{ pr: 4 }}>
                                    <Grid size={{ xs: 12, md: 5 }}>
                                        <TextField label="Kérdés (Pl. Mi a pólóméreted?)" fullWidth size="small" value={q.questionText} onChange={(e) => handleQuestionChange(index, 'questionText', e.target.value)} required />
                                    </Grid>
                                    <Grid size={{ xs: 12, md: 4 }}>
                                        <FormControl fullWidth size="small">
                                            <InputLabel>Válasz Típusa</InputLabel>
                                            <Select value={q.questionType} label="Válasz Típusa" onChange={(e) => handleQuestionChange(index, 'questionType', e.target.value)}>
                                                <MenuItem value="TEXT">Szabad szöveges</MenuItem>
                                                <MenuItem value="DROPDOWN">Legördülő lista</MenuItem>
                                                <MenuItem value="CHECKBOX">Többválasztós (Jelölőnégyzet)</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                    <Grid size={{ xs: 12, md: 3 }} sx={{ display: 'flex', alignItems: 'center' }}>
                                        <FormControlLabel control={<Checkbox checked={q.isRequired} onChange={(e) => handleQuestionChange(index, 'isRequired', e.target.checked)} color="primary" />} label="Kötelező kitölteni" />
                                    </Grid>

                                    {q.questionType !== 'TEXT' && (
                                        <Grid size={{ xs: 12 }} sx={{ mt: 1 }}>
                                            <TextField
                                                label="Válaszlehetőségek (vesszővel elválasztva)"
                                                fullWidth size="small"
                                                placeholder="S, M, L, XL"
                                                value={q.options}
                                                onChange={(e) => handleQuestionChange(index, 'options', e.target.value)}
                                                required
                                                helperText="A megadott értékeket vessző (,) alapján vágja szét a rendszer."
                                            />
                                        </Grid>
                                    )}
                                </Grid>
                            </Paper>
                        ))}
                        {isMobile && (
                            <Button fullWidth color="secondary" startIcon={<AddCircleOutlineIcon />} onClick={addQuestion} variant="outlined" sx={{ mt: 1, borderStyle: 'dashed' }}>Új Kérdés</Button>
                        )}
                    </Box>

                    {/* BEKÜLDÉS GOMBOK */}
                    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, mt: 5 }}>
                        <Button type="submit" variant="contained" size="large" disabled={loading} sx={{ flexGrow: 1, py: 1.5, fontWeight: 'bold', borderRadius: 2 }}>
                            {loading ? 'Folyamatban...' : isEditMode ? 'Változtatások Mentése' : 'Esemény Publikálása'}
                        </Button>
                        {isEditMode && (
                            <Button variant="outlined" color="error" size="large" onClick={handleDelete} disabled={loading} sx={{ borderRadius: 2, py: 1.5 }}>
                                Esemény Törlése
                            </Button>
                        )}
                    </Box>
                </form>
            </Paper>

            {/* --- ÚJ: ÜTKÖZÉSKEZELŐ MODAL --- */}
            <Dialog
                open={conflictModalOpen}
                maxWidth="md"
                fullWidth
                PaperProps={{ sx: { borderRadius: 3 } }}
                // Letiltjuk a mellékattintást, hogy a felhasználó ne tudja véletlenül bezárni
                disableEscapeKeyDown
            >
                <DialogTitle sx={{ bgcolor: 'warning.main', color: 'white', fontWeight: 'bold' }}>
                    ⚠️ Ütköző Beosztások Észlelve!
                </DialogTitle>
                <DialogContent sx={{ mt: 2 }}>
                    <Alert severity="warning" sx={{ mb: 3 }}>
                        Az Esemény új időpontja miatt az alábbi műszakok "kint maradtak" (kilógnak az eseményből).
                        Kérlek, módosítsd az idejüket, vagy töröld őket, hogy el tudd menteni az eseményt!
                    </Alert>

                    <List sx={{ bgcolor: '#fbfbfb', borderRadius: 2, border: '1px solid #e0e0e0' }}>
                        {conflictingShifts.map(shift => (
                            <ListItem key={shift.id} divider sx={{ py: 2, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
                                <Box display="flex" justifyContent="space-between" alignItems="center" width="100%">
                                    <ListItemText
                                        primary={<Typography fontWeight="bold" color="primary">{shift.workAreaName}</Typography>}
                                        secondary={
                                            <Typography variant="body2" color="text.secondary">
                                                Eredeti idő: {new Date(shift.startTime).toLocaleString('hu-HU')} - {new Date(shift.endTime).toLocaleTimeString('hu-HU')}
                                            </Typography>
                                        }
                                    />

                                    <Box display="flex" gap={1}>
                                        {editingShiftId !== shift.id && (
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                startIcon={<EditIcon />}
                                                onClick={() => {
                                                    setEditingShiftId(shift.id);
                                                    setShiftEditData({
                                                        startTime: shift.startTime.substring(0, 16),
                                                        endTime: shift.endTime.substring(0, 16)
                                                    });
                                                }}
                                                disabled={shiftActionLoading}
                                            >
                                                Módosít
                                            </Button>
                                        )}
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            color="error"
                                            startIcon={<DeleteIcon />}
                                            onClick={() => handleModalDeleteShift(shift.id)}
                                            disabled={shiftActionLoading}
                                        >
                                            Töröl
                                        </Button>
                                    </Box>
                                </Box>

                                {/* INLINE EDIT SZEKCIÓ */}
                                {editingShiftId === shift.id && (
                                    <Paper elevation={0} sx={{ mt: 2, p: 2, bgcolor: '#e3f2fd', width: '100%', borderRadius: 2 }}>
                                        <Grid container spacing={2} alignItems="center">
                                            <Grid size={{xs: 12, sm: 5}}>
                                                <TextField
                                                    fullWidth size="small" type="datetime-local" label="Új Kezdés"
                                                    InputLabelProps={{ shrink: true }}
                                                    value={shiftEditData.startTime}
                                                    onChange={e => setShiftEditData({...shiftEditData, startTime: e.target.value})}
                                                    disabled={shiftActionLoading}
                                                />
                                            </Grid>
                                            <Grid size={{xs: 12, sm: 5}}>
                                                <TextField
                                                    fullWidth size="small" type="datetime-local" label="Új Befejezés"
                                                    InputLabelProps={{ shrink: true }}
                                                    value={shiftEditData.endTime}
                                                    onChange={e => setShiftEditData({...shiftEditData, endTime: e.target.value})}
                                                    disabled={shiftActionLoading}
                                                />
                                            </Grid>
                                            <Grid size={{xs: 12, sm: 2}} display="flex" gap={1}>
                                                <IconButton color="success" onClick={() => handleModalSaveShift(shift)} disabled={shiftActionLoading}>
                                                    <CheckIcon />
                                                </IconButton>
                                                <IconButton color="error" onClick={() => setEditingShiftId(null)} disabled={shiftActionLoading}>
                                                    <CloseIcon />
                                                </IconButton>
                                            </Grid>
                                        </Grid>
                                    </Paper>
                                )}
                            </ListItem>
                        ))}
                        {conflictingShifts.length === 0 && (
                            <ListItem>
                                <Alert severity="success" sx={{ width: '100%' }}>Minden ütközést elhárítottál! Most már elmentheted az Eseményt!</Alert>
                            </ListItem>
                        )}
                    </List>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button
                        onClick={() => setConflictModalOpen(false)}
                        variant="outlined"
                        color="inherit"
                        disabled={shiftActionLoading}
                    >
                        Mégse
                    </Button>
                    <Button
                        onClick={() => handleSubmit()}
                        variant="contained"
                        color="success"
                        disabled={conflictingShifts.length > 0 || shiftActionLoading}
                    >
                        Mentés folytatása
                    </Button>
                </DialogActions>
            </Dialog>

        </Container>
    );
}