import { useEffect, useState } from 'react';
// KIVETTÜK A GRID-et, helyette Box-ot használunk
import { Container, Typography, Card, CardContent, Button, Box } from '@mui/material';
import api from '../api/axios';
import { useNavigate } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';

interface Shift {
    id: number;
    startTime: string;
    endTime: string;
}

interface Event {
    id: number;
    title: string;
    description: string;
    location: string;
    shifts: Shift[];
}

export default function Dashboard() {
    const [events, setEvents] = useState<Event[]>([]);
    const navigate = useNavigate();

    // JAVÍTÁS 1: A függvényt a useEffect-en BELÜL hozzuk létre.
    // Így az ESLint és a React is boldog, nincs "cascade render" hiba.
    useEffect(() => {
        const fetchEvents = async () => {
            try {
                const response = await api.get('/events');
                const content = response.data.content || [];
                setEvents(content);
            } catch (error) {
                console.error("Hiba a lekéréskor:", error);
            }
        };

        fetchEvents();
    }, []); // Az üres tömb [] jelenti, hogy csak egyszer fut le az oldal betöltésekor.

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/');
    };

    return (
        <Container sx={{ mt: 4 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
                <Typography variant="h4">
                    Elérhető Események
                </Typography>

                <Box>
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<AddIcon />}
                        onClick={() => navigate('/create-event')}
                        sx={{ mr: 2 }}
                    >
                        Új Esemény
                    </Button>

                    <Button variant="outlined" color="secondary" onClick={handleLogout}>
                        Kijelentkezés
                    </Button>
                </Box>
            </Box>

            {events.length === 0 ? (
                <Typography>Még nincsenek események feltöltve.</Typography>
            ) : (
                /* JAVÍTÁS 2: Grid helyett Flexbox-ot használunk (Box)
                   Ez nem függ a verzióktól, mindig működik. */
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {events.map((event) => (
                        <Box
                            key={event.id}
                            sx={{
                                // Mobilokon 100% szélesség, asztali gépen kb 3 kártya férjen el
                                width: { xs: '100%', md: '30%', lg: '30%' },
                                flexGrow: 1
                            }}
                        >
                            <Card elevation={3} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                <CardContent>
                                    <Typography variant="h6" component="div" gutterBottom>
                                        {event.title}
                                    </Typography>
                                    <Typography sx={{ mb: 1.5 }} color="text.secondary" fontWeight="bold">
                                        📍 {event.location}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {event.description}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Box>
                    ))}
                </Box>
            )}
        </Container>
    );
}