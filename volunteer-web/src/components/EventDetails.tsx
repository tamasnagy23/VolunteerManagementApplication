import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Container, Typography, Box, Button, CircularProgress,
    Card, CardContent, CardActions, Chip, Alert, Grid, Divider
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import WorkIcon from '@mui/icons-material/Work';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PeopleIcon from '@mui/icons-material/People';
import ScheduleIcon from '@mui/icons-material/Schedule';
import api from '../api/axios';
import axios from 'axios';

// --- INTERFÉSZEK ---
interface Shift {
    id: number;
    area?: string;
    name?: string;
    startTime: string;
    endTime: string;
    maxVolunteers: number;
}

interface Event {
    id: number;
    title: string;
    description: string;
    location: string;
    startTime: string;
    endTime: string;
    shifts: Shift[];
}

interface Application {
    id: number;
    event: { id: number };
    shift?: { id: number; name: string };
    status: string;
}

export default function EventDetails() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [event, setEvent] = useState<Event | null>(null);
    const [existingApplication, setExistingApplication] = useState<Application | null>(null);

    const [loading, setLoading] = useState<boolean>(true);
    const [applyingId, setApplyingId] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null); // EZ HIÁNYZOTT!

    useEffect(() => {
        const fetchData = async () => {
            try {
                if (!id) return;
                setLoading(true);
                setError(null);

                // 1. Esemény adatai (ebben már benne vannak a műszakok is!)
                const eventRes = await api.get(`/events/${id}`);
                setEvent(eventRes.data);

                // 2. Megnézzük, jelentkeztem-e már
                try {
                    const myAppsRes = await api.get('/applications/my');
                    const myApp = myAppsRes.data.find((app: Application) => app.event.id === Number(id));
                    setExistingApplication(myApp || null);
                } catch (appErr) {
                    console.warn("Nem sikerült betölteni a jelentkezéseket:", appErr);
                }

            } catch (err) {
                console.error("Hiba az adatok betöltésekor:", err);
                setError("Nem sikerült betölteni az esemény adatait.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [id]);

    const handleApply = async (shiftId: number) => {
        if (!id) return;

        const confirm = window.confirm("Biztosan jelentkezni szeretnél erre a műszakra?");
        if (!confirm) return;

        try {
            setApplyingId(shiftId);
            setError(null);

            await api.post('/applications', null, {
                params: {
                    eventId: id,
                    shiftId: shiftId
                }
            });

            window.location.reload();

        } catch (err) {
            console.error(err);
            let msg = "Hiba történt a jelentkezéskor.";
            if (axios.isAxiosError(err) && err.response?.data) {
                msg = typeof err.response.data === 'string'
                    ? err.response.data
                    : JSON.stringify(err.response.data);
            }
            setError(msg);
        } finally {
            setApplyingId(null);
        }
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString('hu-HU', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    if (loading) {
        return <Box display="flex" justifyContent="center" mt={10}><CircularProgress /></Box>;
    }

    if (!event) {
        return <Container sx={{ mt: 4 }}><Alert severity="error">Esemény nem található.</Alert></Container>;
    }

    const shifts = event.shifts || [];

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/dashboard')} sx={{ mb: 3 }}>
                Vissza a Dashboardra
            </Button>

            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

            {/* ESEMÉNY FEJLÉC */}
            <Card elevation={2} sx={{ mb: 4, borderRadius: 3 }}>
                <CardContent sx={{ p: 4 }}>
                    <Typography variant="h3" fontWeight="bold" gutterBottom color="primary">
                        {event.title}
                    </Typography>

                    <Box display="flex" gap={4} mb={3} flexWrap="wrap">
                        <Box display="flex" alignItems="center" gap={1}>
                            <WorkIcon color="action" />
                            <Typography variant="subtitle1" color="text.secondary">
                                {event.location}
                            </Typography>
                        </Box>
                        <Box display="flex" alignItems="center" gap={1}>
                            <ScheduleIcon color="action" />
                            <Typography variant="subtitle1" color="text.secondary">
                                {formatDate(event.startTime)} - {formatDate(event.endTime)}
                            </Typography>
                        </Box>
                    </Box>

                    <Divider sx={{ mb: 3 }} />

                    <Typography variant="body1" sx={{ whiteSpace: 'pre-line', fontSize: '1.1rem', lineHeight: 1.7 }}>
                        {event.description}
                    </Typography>
                </CardContent>
            </Card>

            {/* JELENTKEZÉS STÁTUSZA */}
            {existingApplication ? (
                <Alert severity="success" icon={<CheckCircleIcon fontSize="inherit" />} sx={{ mb: 4, borderRadius: 2 }}>
                    <Typography variant="h6" fontWeight="bold">
                        Már jelentkeztél erre az eseményre!
                    </Typography>
                    <Typography variant="body1" sx={{ mt: 1 }}>
                        Választott műszak: <strong>{existingApplication.shift?.name || 'Ismeretlen'}</strong> <br />
                        Státusz: <strong>
                        {existingApplication.status === 'PENDING' ? 'Elbírálás alatt ⏳' :
                            existingApplication.status === 'APPROVED' ? 'Elfogadva ✅' : 'Elutasítva ❌'}
                    </strong>
                    </Typography>
                </Alert>
            ) : (
                <Typography variant="h5" fontWeight="bold" sx={{ mb: 3 }}>
                    Elérhető Műszakok és Területek:
                </Typography>
            )}

            {/* MŰSZAKOK LISTÁZÁSA GRIDBEN */}
            <Grid container spacing={3}>
                {shifts.map((shift) => (
                    // JAVÍTÁS: MUI v6 szintaxis
                    <Grid size={{ xs: 12, md: 6 }} key={shift.id}>
                        <Card
                            variant="outlined"
                            sx={{
                                height: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                borderRadius: 2,
                                transition: '0.2s',
                                '&:hover': { borderColor: 'primary.main', boxShadow: 2 }
                            }}
                        >
                            <CardContent sx={{ flexGrow: 1 }}>
                                <Box display="flex" alignItems="center" mb={2}>
                                    <WorkIcon color="primary" sx={{ mr: 1.5, fontSize: 28 }} />
                                    <Typography variant="h5" fontWeight="bold">
                                        {shift.name || shift.area || 'Névtelen terület'}
                                    </Typography>
                                </Box>

                                <Box display="flex" alignItems="center" mb={1} color="text.secondary">
                                    <ScheduleIcon sx={{ mr: 1, fontSize: 20 }} />
                                    <Typography variant="body1">
                                        {formatDate(shift.startTime)} - {formatDate(shift.endTime)}
                                    </Typography>
                                </Box>

                                <Box display="flex" alignItems="center" color="text.secondary">
                                    <PeopleIcon sx={{ mr: 1, fontSize: 20 }} />
                                    <Typography variant="body1">
                                        Szükséges létszám: <strong>{shift.maxVolunteers || 'Nincs megadva'} fő</strong>
                                    </Typography>
                                </Box>
                            </CardContent>

                            <Divider />

                            <CardActions sx={{ p: 2, bgcolor: '#fafafa' }}>
                                {existingApplication ? (
                                    existingApplication.shift?.id === shift.id ? (
                                        <Chip label="Ide jelentkeztél" color="success" icon={<CheckCircleIcon />} sx={{ fontWeight: 'bold' }} />
                                    ) : (
                                        <Button disabled fullWidth variant="text" sx={{ color: 'text.disabled' }}>
                                            Már jelentkeztél máshova
                                        </Button>
                                    )
                                ) : (
                                    <Button
                                        fullWidth
                                        variant="contained"
                                        size="large"
                                        onClick={() => handleApply(shift.id)}
                                        disabled={applyingId !== null}
                                        sx={{ borderRadius: 2, fontWeight: 'bold' }}
                                    >
                                        {applyingId === shift.id ? <CircularProgress size={24} color="inherit" /> : "Jelentkezem ide"}
                                    </Button>
                                )}
                            </CardActions>
                        </Card>
                    </Grid>
                ))}

                {shifts.length === 0 && (
                    // JAVÍTÁS: MUI v6 szintaxis
                    <Grid size={{ xs: 12 }}>
                        <Alert severity="info" sx={{ borderRadius: 2 }}>
                            Ehhez az eseményhez jelenleg nincsenek feltöltve műszakok.
                        </Alert>
                    </Grid>
                )}
            </Grid>
        </Container>
    );
}