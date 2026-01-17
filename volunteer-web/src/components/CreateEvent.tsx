import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Box, Button, TextField, Typography, Container, Paper, IconButton, Divider } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import api from '../api/axios';
import { useNavigate } from 'react-router-dom';

interface ShiftData {
    area: string;
    startTime: string;
    endTime: string;
    maxVolunteers: string;
}

export default function CreateEvent() {
    const navigate = useNavigate();

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

    const handleEventChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setEventData({ ...eventData, [e.target.name]: e.target.value });
    };

    const handleShiftChange = (index: number, field: keyof ShiftData, value: string) => {
        const newShifts = [...shifts];
        newShifts[index] = { ...newShifts[index], [field]: value };
        setShifts(newShifts);
    };

    const addShift = () => {
        setShifts([...shifts, {
            area: '',
            startTime: eventData.startTime,
            endTime: eventData.endTime,
            maxVolunteers: '5'
        }]);
    };

    const removeShift = (index: number) => {
        const newShifts = shifts.filter((_, i) => i !== index);
        setShifts(newShifts);
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const fixDate = (dateStr: string) => dateStr.length === 16 ? dateStr + ":00" : dateStr;

        const payload = {
            title: eventData.title,
            description: eventData.description,
            location: eventData.location,
            startTime: fixDate(eventData.startTime),
            endTime: fixDate(eventData.endTime),
            shifts: shifts.map(s => ({
                area: s.area,
                startTime: fixDate(s.startTime),
                endTime: fixDate(s.endTime),
                maxVolunteers: parseInt(s.maxVolunteers, 10) || 0
            }))
        };

        try {
            await api.post('/events', payload);
            alert('Sikeres létrehozás!');
            navigate('/events');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            console.error("Hiba:", error);
            const errorMsg = error.response?.data
                ? (typeof error.response.data === 'object' ? JSON.stringify(error.response.data) : error.response.data)
                : 'Ismeretlen hiba';
            alert('Nem sikerült menteni: ' + errorMsg);
        }
    };

    return (
        <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
            <Paper elevation={3} sx={{ p: 4 }}>
                <Typography variant="h4" gutterBottom>Új Esemény</Typography>

                <form onSubmit={handleSubmit}>
                    <Box sx={{ mb: 4 }}>
                        <Typography variant="h6" color="primary">1. Alapadatok</Typography>
                        <TextField fullWidth label="Cím" name="title" value={eventData.title} onChange={handleEventChange} margin="normal" required />
                        <TextField fullWidth label="Helyszín" name="location" value={eventData.location} onChange={handleEventChange} margin="normal" required />
                        <TextField fullWidth label="Leírás" name="description" value={eventData.description} onChange={handleEventChange} margin="normal" multiline rows={3} required />
                        <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                            <TextField fullWidth type="datetime-local" label="Kezdés" name="startTime" value={eventData.startTime} onChange={handleEventChange} InputLabelProps={{ shrink: true }} required />
                            <TextField fullWidth type="datetime-local" label="Vége" name="endTime" value={eventData.endTime} onChange={handleEventChange} InputLabelProps={{ shrink: true }} required />
                        </Box>
                    </Box>

                    <Divider sx={{ mb: 4 }} />

                    <Box sx={{ mb: 4 }}>
                        <Typography variant="h6" color="primary">2. Műszakok</Typography>
                        {shifts.map((shift, index) => (
                            <Paper key={index} variant="outlined" sx={{ p: 2, mb: 2, bgcolor: '#f9f9f9' }}>
                                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, alignItems: 'center' }}>
                                    <Box sx={{ flex: 2, width: '100%' }}>
                                        <TextField label="Terület" fullWidth size="small" value={shift.area} onChange={(e) => handleShiftChange(index, 'area', e.target.value)} required />
                                    </Box>
                                    <Box sx={{ flex: 2, width: '100%' }}>
                                        <TextField type="datetime-local" fullWidth size="small" value={shift.startTime} onChange={(e) => handleShiftChange(index, 'startTime', e.target.value)} InputLabelProps={{ shrink: true }} required />
                                    </Box>
                                    <Box sx={{ flex: 2, width: '100%' }}>
                                        <TextField type="datetime-local" fullWidth size="small" value={shift.endTime} onChange={(e) => handleShiftChange(index, 'endTime', e.target.value)} InputLabelProps={{ shrink: true }} required />
                                    </Box>
                                    <Box sx={{ flex: 1, width: '100%' }}>
                                        <TextField type="number" label="Fő" fullWidth size="small" value={shift.maxVolunteers} onChange={(e) => handleShiftChange(index, 'maxVolunteers', e.target.value)} required />
                                    </Box>
                                    <IconButton color="error" onClick={() => removeShift(index)} disabled={shifts.length === 1}><DeleteIcon /></IconButton>
                                </Box>
                            </Paper>
                        ))}
                        <Button startIcon={<AddCircleOutlineIcon />} onClick={addShift} variant="outlined">Műszak hozzáadása</Button>
                    </Box>

                    {/* --- ITT A JAVÍTÁS: A GOMBOK --- */}
                    <Box sx={{ display: 'flex', gap: 2, mt: 4 }}>
                        <Button type="submit" variant="contained" size="large" color="primary" sx={{ flexGrow: 1 }}>
                            Mentés
                        </Button>
                        <Button variant="outlined" size="large" color="secondary" onClick={() => navigate('/dashboard')} sx={{ flexGrow: 1 }}>
                            Mégse
                        </Button>
                    </Box>
                    {/* -------------------------------- */}
                </form>
            </Paper>
        </Container>
    );
}