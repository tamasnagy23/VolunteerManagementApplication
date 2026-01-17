import { useEffect, useState } from 'react';
import { Box, Typography, Container, Paper, List, ListItem, ListItemText, Button, Chip, Divider } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

// A Backend ShiftDTO-jához igazított típus
interface ShiftDTO {
    area: string;
    startTime: string;
    endTime: string;
    maxVolunteers: number;
}

export default function MyShifts() {
    const [shifts, setShifts] = useState<ShiftDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchMyShifts = async () => {
            try {
                // A javított Backend végpont
                const response = await api.get('/events/my-shifts');
                console.log("Műszakok:", response.data); // Debug: lássuk mi jön
                setShifts(response.data);
            } catch (error) {
                console.error("Hiba a műszakok betöltésekor:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchMyShifts();
    }, []);

    const formatDate = (dateString: string) => {
        if (!dateString) return "";
        return new Date(dateString).toLocaleString('hu-HU', {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <Container component="main" maxWidth="md" sx={{ mt: 4 }}>
            <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/dashboard')} sx={{ mb: 2 }}>
                Vissza a Dashboardra
            </Button>

            <Paper elevation={3} sx={{ p: 3 }}>
                <Typography component="h1" variant="h4" gutterBottom>
                    Saját Műszakjaim 📅
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                    Itt találod az összes elfogadott jelentkezésedet.
                </Typography>

                <Divider />

                {loading ? (
                    <Typography sx={{ mt: 3, textAlign: 'center' }}>Betöltés...</Typography>
                ) : shifts.length === 0 ? (
                    <Box sx={{ mt: 3, textAlign: 'center' }}>
                        <Typography variant="h6" color="text.secondary">
                            Még nem jelentkeztél egyetlen műszakra sem.
                        </Typography>
                        <Button variant="contained" sx={{ mt: 2 }} onClick={() => navigate('/dashboard')}>
                            Események böngészése
                        </Button>
                    </Box>
                ) : (
                    <List sx={{ mt: 2 }}>
                        {shifts.map((shift, index) => (
                            <Paper key={index} variant="outlined" sx={{ mb: 2 }}>
                                <ListItem>
                                    <ListItemText
                                        primary={
                                            <Typography variant="h6" color="primary" sx={{ fontWeight: 'bold' }}>
                                                {shift.area || "Általános feladatkör"}
                                            </Typography>
                                        }
                                        secondary={
                                            <Box>
                                                <Typography variant="body2" sx={{ mt: 0.5, mb: 1 }}>
                                                    🕒 {formatDate(shift.startTime)} - {formatDate(shift.endTime)}
                                                </Typography>
                                                <Chip
                                                    label="Jelentkezés elfogadva"
                                                    color="success"
                                                    size="small"
                                                    variant="outlined"
                                                />
                                            </Box>
                                        }
                                    />
                                </ListItem>
                            </Paper>
                        ))}
                    </List>
                )}
            </Paper>
        </Container>
    );
}