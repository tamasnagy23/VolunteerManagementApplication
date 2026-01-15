import { useState } from 'react';
import { Box, Button, TextField, Typography, Container, Paper } from '@mui/material';
import api from '../api/axios';
import { useNavigate } from 'react-router-dom';

export default function CreateEvent() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        location: '',
        // Kezdő és végdátumot egyelőre egyszerű szövegként vagy ISO formátumban kezeljük
        // Később tehetünk ide naptár választót
        startTime: '2026-06-01T10:00:00',
        endTime: '2026-06-01T18:00:00'
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/events', formData);
            alert('Esemény sikeresen létrehozva!');
            navigate('/events'); // Visszaugrunk a listához
        } catch (error) {
            console.error("Hiba a mentéskor:", error);
            alert('Nem sikerült menteni az eseményt. Fut a Backend?');
        }
    };

    return (
        <Container maxWidth="sm" sx={{ mt: 4 }}>
            <Paper elevation={3} sx={{ p: 4 }}>
                <Typography variant="h5" gutterBottom>
                    Új Esemény Hozzáadása
                </Typography>
                <form onSubmit={handleSubmit}>
                    <TextField
                        fullWidth
                        label="Esemény címe"
                        name="title"
                        value={formData.title}
                        onChange={handleChange}
                        margin="normal"
                        required
                    />
                    <TextField
                        fullWidth
                        label="Helyszín"
                        name="location"
                        value={formData.location}
                        onChange={handleChange}
                        margin="normal"
                        required
                    />
                    <TextField
                        fullWidth
                        label="Leírás"
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        margin="normal"
                        multiline
                        rows={4}
                        required
                    />
                    {/* Egyszerűsített dátum mezők */}
                    <TextField
                        fullWidth
                        label="Kezdés (ÉÉÉÉ-HH-NNTÓÓ:PP:MP)"
                        name="startTime"
                        value={formData.startTime}
                        onChange={handleChange}
                        margin="normal"
                        helperText="Példa: 2026-06-01T10:00:00"
                    />

                    <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                        <Button type="submit" variant="contained" color="primary">
                            Mentés
                        </Button>
                        <Button variant="outlined" onClick={() => navigate('/events')}>
                            Mégse
                        </Button>
                    </Box>
                </form>
            </Paper>
        </Container>
    );
}