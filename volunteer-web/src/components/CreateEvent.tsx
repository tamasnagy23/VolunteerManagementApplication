import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import {
    Box, Button, TextField, Typography, Container, Paper,
    IconButton, Divider, Grid, Alert, CircularProgress
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import api from '../api/axios';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';

// --- INTERFÉSZEK ---
interface ShiftData {
    id?: number;
    area: string;
    startTime: string;
    endTime: string;
    maxVolunteers: string;
}

interface BackendShift {
    id: number;
    area?: string;        // Lehet, hogy area
    name?: string;        // Vagy lehet, hogy name
    startTime: string;
    endTime: string;
    maxVolunteers: number;
}

export default function EventForm() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const isEditMode = !!id;

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(isEditMode);

    const [eventData, setEventData] = useState({
        title: '',
        description: '',
        location: '',
        startTime: '2026-06-01T10:00',
        endTime: '2026-06-01T22:00'
    });

    const [shifts, setShifts] = useState<ShiftData[]>([
        { area: '', startTime: '2026-06-01T10:00', endTime: '2026-06-01T14:00', maxVolunteers: '5' }
    ]);

    // --- 1. ADATOK BETÖLTÉSE (Szerkesztésnél) ---
    useEffect(() => {
        if (isEditMode && id) {
            api.get(`/events/${id}`)
                .then(res => {
                    const data = res.data;
                    setEventData({
                        title: data.title || '',
                        description: data.description || '',
                        location: data.location || '',
                        startTime: data.startTime ? data.startTime.substring(0, 16) : '',
                        endTime: data.endTime ? data.endTime.substring(0, 16) : ''
                    });

                    if (data.shifts && Array.isArray(data.shifts)) {
                        setShifts(data.shifts.map((s: BackendShift) => ({
                            id: s.id,
                            // Itt a trükk: ha az area üres, próbálja meg a name-et használni
                            area: s.area || s.name || '',
                            startTime: s.startTime ? s.startTime.substring(0, 16) : '',
                            endTime: s.endTime ? s.endTime.substring(0, 16) : '',
                            maxVolunteers: (s.maxVolunteers ?? 0).toString()
                        })));
                    }
                })
                .catch(err => {
                    console.error("Hiba az esemény betöltésekor:", err);
                    setError("Nem sikerült betölteni az eseményt.");
                })
                .finally(() => setInitialLoading(false));
        }
    }, [id, isEditMode]);

    const handleEventChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setEventData({ ...eventData, [e.target.name]: e.target.value });
    };

    const handleShiftChange = (index: number, field: keyof ShiftData, value: string) => {
        const newShifts = [...shifts];
        const updatedShift = { ...newShifts[index], [field]: value };
        newShifts[index] = updatedShift;
        setShifts(newShifts);
    };

    const addShift = () => {
        setShifts([...shifts, { area: '', startTime: eventData.startTime, endTime: eventData.endTime, maxVolunteers: '5' }]);
    };

    const removeShift = (index: number) => {
        setShifts(shifts.filter((_, i) => i !== index));
    };

    // --- 2. TÖRLÉS ---
    const handleDelete = async () => {
        if (window.confirm('Biztosan törölni szeretnéd ezt az eseményt? A hozzá tartozó összes műszak és jelentkezés is elvész!')) {
            try {
                setLoading(true);
                await api.delete(`/events/${id}`);
                navigate('/dashboard');
            } catch (err) {
                console.error("Hiba a törléskor:", err);
                setError('Nem sikerült törölni az eseményt.');
                setLoading(false);
            }
        }
    };

    // --- 3. MENTÉS / FRISSÍTÉS ---
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const fixDate = (dateStr: string) => dateStr.length === 16 ? dateStr + ":00" : dateStr;

        const payload = {
            title: eventData.title,
            description: eventData.description,
            location: eventData.location,
            startTime: fixDate(eventData.startTime),
            endTime: fixDate(eventData.endTime),
            shifts: shifts.map(s => ({
                id: s.id,
                area: s.area,      // Küldjük area-ként
                name: s.area,      // Küldjük name-ként is a biztonság kedvéért
                startTime: fixDate(s.startTime),
                endTime: fixDate(s.endTime),
                maxVolunteers: parseInt(s.maxVolunteers, 10) || 0
            }))
        };

        try {
            if (isEditMode) {
                await api.put(`/events/${id}`, payload);
            } else {
                await api.post('/events', payload);
            }
            navigate('/dashboard');
        } catch (err: unknown) {
            console.error("Mentési hiba:", err);
            if (axios.isAxiosError(err)) {
                setError(err.response?.data?.message || 'Hiba történt a mentés során.');
            } else {
                setError('Váratlan hiba történt.');
            }
        } finally {
            setLoading(false);
        }
    };

    if (initialLoading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
                <CircularProgress />
            </Box>
        );
    }

    return (
        // JAVÍTÁS 1: maxWidth="md" helyett "lg" lett, hogy szélesebb legyen az űrlap
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/dashboard')} sx={{ mb: 2 }}>
                Mégse
            </Button>

            <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
                <Typography variant="h4" fontWeight="bold" gutterBottom>
                    {isEditMode ? 'Esemény Szerkesztése' : 'Új Esemény Létrehozása'}
                </Typography>

                {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

                <form onSubmit={handleSubmit}>
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

                    <Box sx={{ mb: 4 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="h6" color="primary" sx={{ fontWeight: 'bold' }}>2. Műszakok</Typography>
                            <Button startIcon={<AddCircleOutlineIcon />} onClick={addShift} variant="outlined" size="small">
                                Műszak hozzáadása
                            </Button>
                        </Box>

                        {shifts.map((shift, index) => (
                            <Paper key={index} variant="outlined" sx={{ p: 3, mb: 2, bgcolor: '#fcfcfc', borderRadius: 2 }}>
                                {/* JAVÍTÁS 2: Újrarajzolt Grid arányok (3+3+3+2+1 = 12 oszlop) és adtam a dátumoknak is címkét (label) */}
                                <Grid container spacing={2} alignItems="center">
                                    <Grid size={{ xs: 12, md: 3 }}>
                                        <TextField label="Terület" fullWidth size="small" value={shift.area} onChange={(e) => handleShiftChange(index, 'area', e.target.value)} required />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                        <TextField type="datetime-local" label="Kezdés" fullWidth size="small" value={shift.startTime} onChange={(e) => handleShiftChange(index, 'startTime', e.target.value)} InputLabelProps={{ shrink: true }} required />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                        <TextField type="datetime-local" label="Vége" fullWidth size="small" value={shift.endTime} onChange={(e) => handleShiftChange(index, 'endTime', e.target.value)} InputLabelProps={{ shrink: true }} required />
                                    </Grid>
                                    <Grid size={{ xs: 10, sm: 10, md: 2 }}>
                                        <TextField type="number" label="Fő" fullWidth size="small" value={shift.maxVolunteers} onChange={(e) => handleShiftChange(index, 'maxVolunteers', e.target.value)} required />
                                    </Grid>
                                    <Grid size={{ xs: 2, sm: 2, md: 1 }} textAlign="right">
                                        <IconButton color="error" onClick={() => removeShift(index)} disabled={shifts.length === 1}>
                                            <DeleteIcon />
                                        </IconButton>
                                    </Grid>
                                </Grid>
                            </Paper>
                        ))}
                    </Box>

                    <Box sx={{ display: 'flex', gap: 2, mt: 6 }}>
                        <Button
                            type="submit"
                            variant="contained"
                            size="large"
                            disabled={loading}
                            sx={{ flexGrow: 2, py: 1.5, fontWeight: 'bold', borderRadius: 2 }}
                        >
                            {loading ? 'Folyamatban...' : isEditMode ? 'Változtatások Mentése' : 'Esemény Publikálása'}
                        </Button>

                        {isEditMode && (
                            <Button
                                variant="outlined"
                                color="error"
                                size="large"
                                onClick={handleDelete}
                                disabled={loading}
                                sx={{ borderRadius: 2, px: 4 }}
                            >
                                Törlés
                            </Button>
                        )}
                    </Box>
                </form>
            </Paper>
        </Container>
    );
}