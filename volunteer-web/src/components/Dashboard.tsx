import { useEffect, useState } from 'react';
import {
    Container, Typography, Card, CardContent, Button, Box,
    CardActions, Chip, CircularProgress
} from '@mui/material';
import api from '../api/axios';
import { useNavigate } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import GroupIcon from '@mui/icons-material/Group';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';

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
    const [userRole, setUserRole] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const [eventsResponse, userResponse] = await Promise.all([
                    api.get('/events'),
                    api.get('/users/me')
                ]);

                setEvents(eventsResponse.data.content || eventsResponse.data || []);
                setUserRole(userResponse.data.role);
            } catch (error) {
                console.error("Hiba az adatok betöltésekor:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString('hu-HU', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    // --- JOGOSULTSÁGOK ---
    // 1. SZINT: Admin/Szervező (Csapat, Új esemény)
    const isAdminOrOrganizer = ['SYS_ADMIN', 'ORGANIZER'].includes(userRole);

    // 2. SZINT: Koordinátor is (Jelentkezők kezelése)
    const canManageApplications = ['SYS_ADMIN', 'ORGANIZER', 'COORDINATOR'].includes(userRole);
    // ---------------------

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Container sx={{ mt: 4, mb: 4 }}>
            {/* FEJLÉC */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={4} flexWrap="wrap" gap={2}>
                <Typography variant="h4">Elérhető Események</Typography>

                <Box>
                    {/* A navigációs gombok (Saját műszak, Kijelentkezés) INNEN TÖRÖLVE LETTEK,
                        mert már a Layout menüsorában vannak. */}

                    {/* --- CSAK ADMIN ÉS SZERVEZŐ GOMBOK --- */}
                    {/* Ezek maradnak itt, mert ezek "műveletek", nem navigáció */}
                    {isAdminOrOrganizer && (
                        <>
                            <Button
                                variant="outlined"
                                color="primary"
                                startIcon={<GroupIcon />}
                                onClick={() => navigate('/team')}
                                sx={{ mr: 2 }}
                            >
                                Csapat Kezelése
                            </Button>

                            <Button
                                variant="contained"
                                color="primary"
                                startIcon={<AddIcon />}
                                onClick={() => navigate('/create-event')}
                            >
                                Új Esemény
                            </Button>
                        </>
                    )}
                </Box>
            </Box>

            {/* ESEMÉNYEK LISTÁZÁSA */}
            {events.length === 0 ? (
                <Typography align="center" color="text.secondary">Még nincsenek események feltöltve.</Typography>
            ) : (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {events.map((event) => (
                        <Box key={event.id} sx={{ width: { xs: '100%', md: '30%', lg: '30%' }, flexGrow: 1 }}>
                            <Card elevation={3} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                <CardContent sx={{ flexGrow: 1 }}>
                                    <Typography variant="h6" component="div" gutterBottom>{event.title}</Typography>
                                    <Box display="flex" alignItems="center" mb={1} gap={1}>
                                        <Typography variant="body2" color="text.secondary" fontWeight="bold">📍 {event.location}</Typography>
                                    </Box>

                                    {event.shifts && event.shifts.length > 0 && (
                                        <Chip
                                            icon={<CalendarTodayIcon />}
                                            label={formatDate(event.shifts[0].startTime)}
                                            size="small"
                                            color="primary"
                                            variant="outlined"
                                            sx={{ mb: 2 }}
                                        />
                                    )}

                                    <Typography variant="body2" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                                        {event.description}
                                    </Typography>
                                </CardContent>

                                {/* Részletek gomb */}
                                <CardActions>
                                    <Button
                                        size="small"
                                        fullWidth
                                        variant="contained"
                                        onClick={() => navigate(`/events/${event.id}`)}
                                    >
                                        Részletek és Jelentkezés
                                    </Button>
                                </CardActions>

                                {/* Jelentkezők kezelése gomb (Koordinátoroknak is) */}
                                {canManageApplications && (
                                    <CardActions sx={{ borderTop: '1px solid #eee', pt: 1, pb: 2, px: 1 }}>
                                        <Button
                                            size="small"
                                            color="secondary"
                                            variant="outlined"
                                            fullWidth
                                            startIcon={<GroupIcon />}
                                            onClick={() => navigate(`/events/${event.id}/applications`)}
                                        >
                                            Jelentkezők kezelése
                                        </Button>
                                    </CardActions>
                                )}
                            </Card>
                        </Box>
                    ))}
                </Box>
            )}
        </Container>
    );
}