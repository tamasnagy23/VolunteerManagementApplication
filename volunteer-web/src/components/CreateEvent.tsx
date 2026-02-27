import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import {
    Box, Button, TextField, Typography, Container, Paper,
    IconButton, Divider, Alert, CircularProgress, Grid,
    Select, MenuItem, FormControl, InputLabel, Checkbox, FormControlLabel
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import api from '../api/axios';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';

interface WorkAreaInput {
    id?: number;
    name: string;
    description: string;
    capacity: number;
}

// ÚJ INTERFÉSZ A KÉRDÉSEKHEZ
interface EventQuestionInput {
    id?: number;
    questionText: string;
    questionType: 'TEXT' | 'DROPDOWN' | 'CHECKBOX';
    options: string;
    isRequired: boolean;
}

export default function EventForm() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const isEditMode = !!id;

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(isEditMode);

    const [eventData, setEventData] = useState({
        title: '', description: '', location: '',
        startTime: '2026-06-01T10:00', endTime: '2026-06-01T22:00'
    });

    const [workAreas, setWorkAreas] = useState<WorkAreaInput[]>([
        { name: '', description: '', capacity: 5 }
    ]);

    // ÚJ STATE A KÉRDÉSEKNEZ
    const [questions, setQuestions] = useState<EventQuestionInput[]>([]);

    useEffect(() => {
        if (isEditMode && id) {
            api.get(`/events/${id}`)
                .then(res => {
                    const data = res.data;
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

                    // BETÖLTJÜK A KÉRDÉSEKET (ha vannak)
                    if (data.questions) {
                        setQuestions(data.questions.map((q: EventQuestionInput) => ({
                            id: q.id, questionText: q.questionText, questionType: q.questionType, options: q.options || '', isRequired: q.isRequired
                        })));
                    }
                })
                .catch(() => setError("Nem sikerült betölteni az eseményt."))
                .finally(() => setInitialLoading(false));
        }
    }, [id, isEditMode]);

    const handleEventChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setEventData({ ...eventData, [e.target.name]: e.target.value });
    };

    // Terület kezelők
    const handleAreaChange = (index: number, field: keyof WorkAreaInput, value: string | number) => {
        const newAreas = [...workAreas];
        newAreas[index] = { ...newAreas[index], [field]: value };
        setWorkAreas(newAreas);
    };
    const addArea = () => setWorkAreas([...workAreas, { name: '', description: '', capacity: 5 }]);
    const removeArea = (index: number) => setWorkAreas(workAreas.filter((_, i) => i !== index));

    // Kérdés kezelők (ÚJ - ESLint és TS barát verzió)
    const handleQuestionChange = (
        index: number,
        field: keyof EventQuestionInput,
        value: string | boolean
    ) => {
        const newQuestions = [...questions];

        // Új érték beállítása típus-biztosan
        newQuestions[index] = {
            ...newQuestions[index],
            [field]: value
        } as EventQuestionInput;

        // Ha visszavált szövegesre, ürítjük az opciókat
        if (field === 'questionType' && value === 'TEXT') {
            newQuestions[index].options = '';
        }

        setQuestions(newQuestions);
    };
    const addQuestion = () => setQuestions([...questions, { questionText: '', questionType: 'TEXT', options: '', isRequired: false }]);
    const removeQuestion = (index: number) => setQuestions(questions.filter((_, i) => i !== index));

    const handleDelete = async () => {
        if (window.confirm('Biztosan törölni szeretnéd ezt az eseményt?')) {
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

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const fixDate = (dateStr: string) => dateStr.length === 16 ? dateStr + ":00" : dateStr;

        const payload = {
            ...eventData,
            startTime: fixDate(eventData.startTime),
            endTime: fixDate(eventData.endTime),
            workAreas: workAreas,
            questions: questions // BEKÜLDJÜK A KÉRDÉSEKET IS
        };

        try {
            if (isEditMode) await api.put(`/events/${id}`, payload);
            else await api.post('/events', payload);
            navigate('/dashboard');
        } catch (err: unknown) {
            if (axios.isAxiosError(err)) setError(err.response?.data?.message || 'Hiba történt a mentés során.');
            else setError('Váratlan hiba történt.');
        } finally {
            setLoading(false);
        }
    };

    if (initialLoading) return <Box display="flex" justifyContent="center" mt={10}><CircularProgress /></Box>;

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/dashboard')} sx={{ mb: 2 }}>Mégse</Button>
            <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
                <Typography variant="h4" fontWeight="bold" gutterBottom>
                    {isEditMode ? 'Esemény Szerkesztése' : 'Új Esemény Létrehozása'}
                </Typography>

                {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

                <form onSubmit={handleSubmit}>
                    {/* 1. ALAPADATOK (Változatlan) */}
                    <Box sx={{ mb: 5 }}>
                        <Typography variant="h6" color="primary" sx={{ mb: 2, fontWeight: 'bold' }}>1. Alapadatok</Typography>
                        <Grid container spacing={3}>
                            <Grid size={{ xs: 12 }}>
                                <TextField fullWidth label="Esemény címe" name="title" value={eventData.title} onChange={handleEventChange} required />
                            </Grid>
                            <Grid size={{ xs: 12 }}>
                                <TextField fullWidth label="Helyszín" name="location" value={eventData.location} onChange={handleEventChange} required />
                            </Grid>
                            <Grid size={{ xs: 12 }}>
                                <TextField fullWidth label="Leírás" name="description" value={eventData.description} onChange={handleEventChange} multiline rows={3} required />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField fullWidth type="datetime-local" label="Kezdés" name="startTime" value={eventData.startTime} onChange={handleEventChange} InputLabelProps={{ shrink: true }} required />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField fullWidth type="datetime-local" label="Vége" name="endTime" value={eventData.endTime} onChange={handleEventChange} InputLabelProps={{ shrink: true }} required />
                            </Grid>
                        </Grid>
                    </Box>

                    <Divider sx={{ mb: 4 }} />

                    {/* 2. MUNKATERÜLETEK (Változatlan) */}
                    <Box sx={{ mb: 5 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="h6" color="primary" sx={{ fontWeight: 'bold' }}>2. Munkaterületek</Typography>
                            <Button startIcon={<AddCircleOutlineIcon />} onClick={addArea} variant="outlined" size="small">Terület hozzáadása</Button>
                        </Box>
                        {workAreas.map((area, index) => (
                            <Paper key={index} variant="outlined" sx={{ p: 3, mb: 2, bgcolor: '#fcfcfc', borderRadius: 2 }}>
                                <Grid container spacing={2} alignItems="center">
                                    <Grid size={{ xs: 12, md: 4 }}>
                                        <TextField label="Terület neve" fullWidth size="small" value={area.name} onChange={(e) => handleAreaChange(index, 'name', e.target.value)} required />
                                    </Grid>
                                    <Grid size={{ xs: 12, md: 5 }}>
                                        <TextField label="Leírás / Feladat" fullWidth size="small" value={area.description} onChange={(e) => handleAreaChange(index, 'description', e.target.value)} />
                                    </Grid>
                                    <Grid size={{ xs: 10, md: 2 }}>
                                        <TextField type="number" label="Kapacitás (fő)" fullWidth size="small" value={area.capacity} onChange={(e) => handleAreaChange(index, 'capacity', parseInt(e.target.value) || 0)} required />
                                    </Grid>
                                    <Grid size={{ xs: 2, md: 1 }} sx={{ textAlign: 'right' }}>
                                        <IconButton color="error" onClick={() => removeArea(index)} disabled={workAreas.length === 1}><DeleteIcon /></IconButton>
                                    </Grid>
                                </Grid>
                            </Paper>
                        ))}
                    </Box>

                    <Divider sx={{ mb: 4 }} />

                    {/* 3. KÉRDŐÍV KÉSZÍTŐ (ÚJ RÉSZ) */}
                    <Box sx={{ mb: 4 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Box>
                                <Typography variant="h6" color="primary" sx={{ fontWeight: 'bold' }}>3. Jelentkezési Kérdőív (Opcionális)</Typography>
                                <Typography variant="caption" color="text.secondary">Milyen extra adatokat kérsz az önkéntesektől?</Typography>
                            </Box>
                            <Button startIcon={<AddCircleOutlineIcon />} onClick={addQuestion} variant="outlined" size="small" color="secondary">
                                Kérdés hozzáadása
                            </Button>
                        </Box>

                        {questions.length === 0 && (
                            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', textAlign: 'center', py: 2 }}>
                                Jelenleg nincsenek egyedi kérdések. Az önkéntesek csak az alapadataikat küldik el.
                            </Typography>
                        )}

                        {questions.map((q, index) => (
                            <Paper key={index} variant="outlined" sx={{ p: 3, mb: 2, bgcolor: '#f9fbe7', borderRadius: 2 }}>
                                <Grid container spacing={2} alignItems="center">
                                    <Grid size={{ xs: 12, md: 5 }}>
                                        <TextField label="Kérdés szövege (pl. Pólóméret?)" fullWidth size="small" value={q.questionText} onChange={(e) => handleQuestionChange(index, 'questionText', e.target.value)} required />
                                    </Grid>
                                    <Grid size={{ xs: 12, md: 3 }}>
                                        <FormControl fullWidth size="small">
                                            <InputLabel>Típus</InputLabel>
                                            <Select value={q.questionType} label="Típus" onChange={(e) => handleQuestionChange(index, 'questionType', e.target.value)}>
                                                <MenuItem value="TEXT">Szabad szöveges</MenuItem>
                                                <MenuItem value="DROPDOWN">Legördülő lista</MenuItem>
                                                <MenuItem value="CHECKBOX">Többválasztós (Jelölőnégyzet)</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                    <Grid size={{ xs: 10, md: 3 }} sx={{ display: 'flex', alignItems: 'center' }}>
                                        <FormControlLabel control={
                                            <Checkbox checked={q.isRequired} onChange={(e) => handleQuestionChange(index, 'isRequired', e.target.checked)} color="primary" />
                                        } label="Kötelező" />
                                    </Grid>
                                    <Grid size={{ xs: 2, md: 1 }} sx={{ textAlign: 'right' }}>
                                        <IconButton color="error" onClick={() => removeQuestion(index)}><DeleteIcon /></IconButton>
                                    </Grid>

                                    {/* Opciók megadása, ha nem TEXT típusú */}
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
                    </Box>

                    <Box sx={{ display: 'flex', gap: 2, mt: 6 }}>
                        <Button type="submit" variant="contained" size="large" disabled={loading} sx={{ flexGrow: 2, py: 1.5, fontWeight: 'bold', borderRadius: 2 }}>
                            {loading ? 'Folyamatban...' : isEditMode ? 'Változtatások Mentése' : 'Esemény Publikálása'}
                        </Button>
                        {isEditMode && (
                            <Button variant="outlined" color="error" size="large" onClick={handleDelete} disabled={loading} sx={{ borderRadius: 2, px: 4 }}>Törlés</Button>
                        )}
                    </Box>
                </form>
            </Paper>
        </Container>
    );
}