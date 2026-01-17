import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Container, Typography, Box, Button, CircularProgress,
    Card, CardContent, CardActions, Chip, Alert, Grid
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import WorkIcon from '@mui/icons-material/Work';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import api from '../api/axios';
import { isAxiosError } from 'axios';

interface Event {
    id: number;
    title: string;
    description: string;
    location: string;
    startTime: string;
    endTime: string;
}

interface WorkArea {
    id: number;
    name: string;
    description: string;
}

interface Application {
    id: number;
    event: { id: number };
    workArea: { id: number; name: string };
    status: string;
}

export default function EventDetails() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [event, setEvent] = useState<Event | null>(null);
    const [workAreas, setWorkAreas] = useState<WorkArea[]>([]);
    const [existingApplication, setExistingApplication] = useState<Application | null>(null);

    const [loading, setLoading] = useState<boolean>(true);
    const [applyingId, setApplyingId] = useState<number | null>(null); // Éppen melyik gomb tölt

    useEffect(() => {
        const fetchData = async () => {
            try {
                if (!id) return;
                setLoading(true);

                // 1. Esemény adatai
                const eventReq = api.get(`/events/${id}`);
                // 2. Munkaterületek ehhez az eseményhez
                const areasReq = api.get(`/applications/work-areas/${id}`);
                // 3. Megnézzük, jelentkeztem-e már
                const myAppsReq = api.get('/applications/my');

                const [eventRes, areasRes, myAppsRes] = await Promise.all([eventReq, areasReq, myAppsReq]);

                setEvent(eventRes.data);
                setWorkAreas(areasRes.data);

                // Megkeressük, van-e jelentkezésünk ERRE az eseményre
                const myApp = myAppsRes.data.find((app: Application) => app.event.id === Number(id));
                setExistingApplication(myApp || null);

            } catch (error) {
                console.error("Hiba az adatok betöltésekor:", error);
                alert("Nem sikerült betölteni az esemény adatait.");
                navigate('/');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [id, navigate]);

    const handleApply = async (workAreaId: number) => {
        if (!id) return;

        // Biztonsági kérdés
        const confirm = window.confirm("Biztosan jelentkezni szeretnél erre a pozícióra?");
        if (!confirm) return;

        try {
            setApplyingId(workAreaId);

            // POST kérés az új ApplicationController-hez
            await api.post('/applications', null, {
                params: {
                    eventId: id,
                    workAreaId: workAreaId
                }
            });

            alert("Sikeres jelentkezés! A koordinátor hamarosan elbírálja.");

            // Oldal újratöltése helyett frissítjük az állapotot
            window.location.reload();

        } catch (error) {
            console.error(error);
            let msg = "Hiba történt a jelentkezéskor.";
            if (isAxiosError(error) && error.response?.data) {
                msg = typeof error.response.data === 'string'
                    ? error.response.data
                    : JSON.stringify(error.response.data);
            }
            alert(msg);
        } finally {
            setApplyingId(null);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('hu-HU', {
            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    if (loading) {
        return <Box display="flex" justifyContent="center" mt={10}><CircularProgress /></Box>;
    }

    if (!event) {
        return <Container><Typography>Esemény nem található.</Typography></Container>;
    }

    return (
        <Container sx={{ mt: 4, mb: 4 }}>
            <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/dashboard')} sx={{ mb: 2 }}>
                Vissza
            </Button>

            {/* ESEMÉNY FEJLÉC */}
            <Box mb={4} p={3} component={Card} elevation={3}>
                <Typography variant="h3" gutterBottom color="primary">
                    {event.title}
                </Typography>

                <Box mb={2}>
                    <Typography variant="subtitle1" color="text.secondary">
                        📍 <strong>Helyszín:</strong> {event.location}
                    </Typography>
                    <Typography variant="subtitle1" color="text.secondary">
                        📅 <strong>Időpont:</strong> {formatDate(event.startTime)} - {formatDate(event.endTime)}
                    </Typography>
                </Box>

                <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
                    {event.description}
                </Typography>
            </Box>

            {/* JELENTKEZÉS STÁTUSZA */}
            {existingApplication ? (
                <Alert severity="success" icon={<CheckCircleIcon fontSize="inherit" />} sx={{ mb: 4 }}>
                    <Typography variant="h6">
                        Már jelentkeztél erre az eseményre!
                    </Typography>
                    <Typography variant="body2">
                        Választott terület: <strong>{existingApplication.workArea.name}</strong> <br />
                        Státusz: <strong>{existingApplication.status === 'PENDING' ? 'Elbírálás alatt' :
                        existingApplication.status === 'APPROVED' ? 'Elfogadva' : 'Elutasítva'}</strong>
                    </Typography>
                </Alert>
            ) : (
                <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
                    Válassz egy területet a jelentkezéshez:
                </Typography>
            )}

            {/* MUNKATERÜLETEK LISTÁJA */}
            <Grid container spacing={3}>
                {workAreas.map((area) => (
                    // JAVÍTÁS ITT: 'item' törölve, és a méretezés a 'size' propba került (MUI v6 szabvány)
                    // Ha régebbi verziót használsz, simán: <Grid xs={12} md={6} key={area.id}> is jó lehet item nélkül.
                    <Grid size={{ xs: 12, md: 6 }} key={area.id}>
                        <Card variant="outlined" sx={{
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            borderColor: existingApplication?.workArea.id === area.id ? 'success.main' : 'grey.300',
                            borderWidth: existingApplication?.workArea.id === area.id ? 2 : 1
                        }}>
                            {/* ... a Card tartalma változatlan ... */}
                            <CardContent sx={{ flexGrow: 1 }}>
                                <Box display="flex" alignItems="center" mb={1}>
                                    <WorkIcon color="primary" sx={{ mr: 1 }} />
                                    <Typography variant="h6">
                                        {area.name}
                                    </Typography>
                                </Box>
                                <Typography variant="body2" color="text.secondary">
                                    {area.description}
                                </Typography>
                            </CardContent>

                            <CardActions sx={{ p: 2, pt: 0 }}>
                                {existingApplication ? (
                                    existingApplication.workArea.id === area.id ? (
                                        <Chip label="Kiválasztva" color="success" icon={<CheckCircleIcon />} />
                                    ) : (
                                        <Button disabled fullWidth variant="outlined">
                                            Nem választható
                                        </Button>
                                    )
                                ) : (
                                    <Button
                                        fullWidth
                                        variant="contained"
                                        onClick={() => handleApply(area.id)}
                                        disabled={applyingId !== null}
                                    >
                                        {applyingId === area.id ? <CircularProgress size={24} color="inherit" /> : "Jelentkezem ide"}
                                    </Button>
                                )}
                            </CardActions>
                        </Card>
                    </Grid>
                ))}

                {workAreas.length === 0 && (
                    // JAVÍTÁS ITT IS: 'item' törölve
                    <Grid size={{ xs: 12 }}>
                        <Alert severity="info">Ehhez az eseményhez még nincsenek meghirdetett pozíciók.</Alert>
                    </Grid>
                )}
            </Grid>
        </Container>
    );
}