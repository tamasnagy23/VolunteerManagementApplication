import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Container, Typography, Box, Paper, Button, CircularProgress,
    Alert, Divider, Dialog, DialogTitle, DialogContent,
    DialogActions, FormControlLabel, Checkbox, TextField,
    FormControl, InputLabel, Select, MenuItem, FormGroup, Tooltip
} from '@mui/material';
import Grid from '@mui/material/Grid'; // Biztonság kedvéért a friss Grid2-t használjuk
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import DeleteIcon from '@mui/icons-material/Delete';
import RestoreIcon from '@mui/icons-material/Restore';
import api from '../api/axios';
import axios from 'axios';

// --- INTERFÉSZEK ---
interface EventQuestion {
    id: number;
    questionText: string;
    questionType: 'TEXT' | 'DROPDOWN' | 'CHECKBOX';
    options: string;
    isRequired: boolean;
}

interface WorkArea {
    id: number;
    name: string;
    description: string;
    capacity: number;
}

interface EventData {
    id: number;
    title: string;
    description: string;
    location: string;
    startTime: string;
    endTime: string;
    workAreas: WorkArea[];
    questions: EventQuestion[];
    organization: { name: string };
}

interface UserApplication {
    id: number;
    eventId?: number;
    orgName: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
    workAreaName: string;
    rejectionMessage?: string; // <--- ÚJ MEZŐ HOZZÁADVA
}

export default function EventDetails() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [event, setEvent] = useState<EventData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [myApplications, setMyApplications] = useState<UserApplication[]>([]);

    const [openModal, setOpenModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [selectedWorkAreas, setSelectedWorkAreas] = useState<number[]>([]);
    const [answers, setAnswers] = useState<Record<number, string | string[]>>({});

    useEffect(() => {
        if (id) {
            fetchEventData();
            checkIfApplied();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const fetchEventData = async () => {
        try {
            const res = await api.get(`/events/${id}`);
            setEvent(res.data);

            const initialAnswers: Record<number, string | string[]> = {};
            if (res.data.questions) {
                res.data.questions.forEach((q: EventQuestion) => {
                    initialAnswers[q.id] = q.questionType === 'CHECKBOX' ? [] : '';
                });
            }
            setAnswers(initialAnswers);
        } catch {
            setError("Hiba történt az esemény betöltésekor.");
        } finally {
            setLoading(false);
        }
    };

    const checkIfApplied = async () => {
        try {
            const res = await api.get('/applications/my');
            const appsForThisEvent = res.data.filter((app: UserApplication) => app.eventId === Number(id));
            setMyApplications(appsForThisEvent);
        } catch (err) {
            console.error("Hiba a jelentkezések ellenőrzésekor:", err);
        }
    };

    const handleWithdraw = async (applicationId: number) => {
        if (window.confirm("Biztosan vissza szeretnéd vonni a jelentkezésedet erről a területről?")) {
            try {
                await api.delete(`/applications/${applicationId}`);
                await checkIfApplied();
            } catch {
                alert("Nem sikerült visszavonni a jelentkezést.");
            }
        }
    };

    const handleReApply = async (applicationId: number) => {
        try {
            await api.put(`/applications/${applicationId}/status`, null, { params: { status: 'PENDING' } });
            await checkIfApplied();
            alert("Sikeresen visszajelentkeztél erre a területre!");
        } catch {
            alert("Nem sikerült a visszajelentkezés.");
        }
    };

    const handleWorkAreaToggle = (areaId: number) => {
        setSelectedWorkAreas(prev =>
            prev.includes(areaId) ? prev.filter(id => id !== areaId) : [...prev, areaId]
        );
    };

    const handleAnswerChange = (questionId: number, value: string | string[]) => {
        setAnswers(prev => ({ ...prev, [questionId]: value }));
    };

    const handleCheckboxAnswerToggle = (questionId: number, option: string) => {
        setAnswers(prev => {
            const currentSelected = (prev[questionId] as string[]) || [];
            const updated = currentSelected.includes(option)
                ? currentSelected.filter(item => item !== option)
                : [...currentSelected, option];
            return { ...prev, [questionId]: updated };
        });
    };

    const handleSubmitApplication = async () => {
        if (selectedWorkAreas.length === 0) {
            alert("Kérlek válassz ki legalább egy munkaterületet!");
            return;
        }

        for (const q of event?.questions || []) {
            if (q.isRequired) {
                const answer = answers[q.id];
                if (!answer || (Array.isArray(answer) && answer.length === 0)) {
                    alert(`A(z) "${q.questionText}" kérdés megválaszolása kötelező!`);
                    return;
                }
            }
        }

        setSubmitting(true);
        try {
            const formattedAnswers: Record<number, string> = {};
            Object.keys(answers).forEach(key => {
                const numKey = Number(key);
                formattedAnswers[numKey] = Array.isArray(answers[numKey])
                    ? (answers[numKey] as string[]).join(', ')
                    : (answers[numKey] as string);
            });

            await api.post('/applications', {
                eventId: event?.id,
                preferredWorkAreaIds: selectedWorkAreas,
                answers: formattedAnswers
            });

            setOpenModal(false);
            await checkIfApplied();
            alert("Sikeres jelentkezés!");
        } catch (err: unknown) {
            if (axios.isAxiosError(err)) {
                alert(err.response?.data || "Hiba történt a jelentkezés során.");
            }
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <Box display="flex" justifyContent="center" mt={10}><CircularProgress /></Box>;
    if (!event) return <Container><Alert severity="error">Esemény nem található.</Alert></Container>;

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 10 }}>
            <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/dashboard')} sx={{ mb: 3 }}>
                Vissza a listához
            </Button>

            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

            {myApplications.length > 0 && (
                <Alert
                    severity="info"
                    sx={{ mb: 4, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: '#f8fbff' }}
                >
                    <Typography variant="subtitle1" fontWeight="bold" mb={2} color="primary">
                        Jelentkezéseid állapota:
                    </Typography>

                    {myApplications.map((app) => (
                        <Box key={app.id} sx={{
                            mb: 1.5, p: 2,
                            bgcolor: 'white',
                            borderRadius: 2,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                        }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <Typography sx={{ minWidth: { xs: '100px', md: '180px' }, fontWeight: 'bold' }}>
                                        {app.workAreaName}
                                    </Typography>
                                    <Typography
                                        variant="body2"
                                        fontWeight="bold"
                                        color={
                                            app.status === 'APPROVED' ? 'success.main' :
                                                app.status === 'REJECTED' ? 'error.main' :
                                                    app.status === 'WITHDRAWN' ? 'text.disabled' : 'text.secondary'
                                        }
                                    >
                                        {app.status === 'PENDING' ? '⏳ Elbírálás alatt' :
                                            app.status === 'APPROVED' ? '✅ Elfogadva' :
                                                app.status === 'REJECTED' ? '❌ Elutasítva' : '🏳️ Visszavonva'}
                                    </Typography>
                                </Box>

                                <Box>
                                    {/* Csak akkor vonhatja vissza, ha még elbírálás alatt van vagy már elfogadták */}
                                    {(app.status === 'PENDING' || app.status === 'APPROVED') && (
                                        <Tooltip title="Jelentkezés visszavonása">
                                            <Button
                                                size="small"
                                                color="error"
                                                variant="outlined"
                                                startIcon={<DeleteIcon />}
                                                onClick={() => handleWithdraw(app.id)}
                                            >
                                                Visszavonás
                                            </Button>
                                        </Tooltip>
                                    )}

                                    {/* Ha visszavonta, lehetőséget adunk az újrajelentkezésre */}
                                    {app.status === 'WITHDRAWN' && (
                                        <Tooltip title="Újrajelentkezés erre a területre">
                                            <Button
                                                size="small"
                                                color="primary"
                                                variant="contained"
                                                startIcon={<RestoreIcon />}
                                                onClick={() => handleReApply(app.id)}
                                            >
                                                Visszajelentkezés
                                            </Button>
                                        </Tooltip>
                                    )}
                                </Box>
                            </Box>

                            {/* --- ÚJ: ELUTASÍTÁS INDOKLÁSA (Csak ha van) --- */}
                            {app.status === 'REJECTED' && app.rejectionMessage && (
                                <Box sx={{ mt: 2, p: 1.5, bgcolor: '#ffebee', borderRadius: 1, borderLeft: '4px solid #d32f2f' }}>
                                    <Typography variant="body2" color="error.dark">
                                        <strong>A szervező üzenete:</strong> {app.rejectionMessage}
                                    </Typography>
                                </Box>
                            )}

                        </Box>
                    ))}
                </Alert>
            )}

            <Paper elevation={3} sx={{ p: { xs: 3, md: 5 }, borderRadius: 3 }}>
                <Grid container spacing={4}>
                    <Grid size={{ xs: 12, md: 8 }}>
                        <Typography variant="h3" fontWeight="bold" gutterBottom color="primary">
                            {event.title}
                        </Typography>
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                            Szervező: {event.organization.name}
                        </Typography>
                        <Box mt={4}>
                            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', fontSize: '1.1rem' }}>
                                {event.description}
                            </Typography>
                        </Box>
                    </Grid>

                    <Grid size={{ xs: 12, md: 4 }}>
                        <Paper variant="outlined" sx={{ p: 3, bgcolor: '#f5f5f5', borderRadius: 2 }}>
                            <Typography variant="subtitle1" fontWeight="bold">Helyszín</Typography>
                            <Typography variant="body2" mb={2}>{event.location}</Typography>

                            <Typography variant="subtitle1" fontWeight="bold">Kezdés</Typography>
                            <Typography variant="body2" mb={2}>{new Date(event.startTime).toLocaleString('hu-HU')}</Typography>

                            <Typography variant="subtitle1" fontWeight="bold">Befejezés</Typography>
                            <Typography variant="body2" mb={3}>{new Date(event.endTime).toLocaleString('hu-HU')}</Typography>

                            <Button
                                variant="contained"
                                size="large"
                                fullWidth
                                startIcon={<HowToRegIcon />}
                                disabled={myApplications.some(app => app.status !== 'WITHDRAWN')}
                                onClick={() => setOpenModal(true)}
                                sx={{ py: 1.5, fontWeight: 'bold', borderRadius: 2 }}
                            >
                                {myApplications.some(app => app.status !== 'WITHDRAWN') ? "Jelentkezés leadva" : "Jelentkezem az Eseményre"}
                            </Button>
                        </Paper>
                    </Grid>
                </Grid>

                <Divider sx={{ my: 5 }} />

                <Typography variant="h5" fontWeight="bold" mb={3}>Elérhető Munkaterületek</Typography>
                <Grid container spacing={3}>
                    {event.workAreas.map((area) => (
                        <Grid size={{ xs: 12, sm: 6, md: 4 }} key={area.id}>
                            <Paper variant="outlined" sx={{ p: 3, height: '100%', borderRadius: 2, borderLeft: '4px solid #1976d2' }}>
                                <Typography variant="h6" fontWeight="bold">{area.name}</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2, minHeight: 40 }}>
                                    {area.description || "Nincs megadva leírás."}
                                </Typography>
                                <Typography variant="caption" fontWeight="bold" color="primary">
                                    Kapacitás: {area.capacity} fő
                                </Typography>
                            </Paper>
                        </Grid>
                    ))}
                </Grid>
            </Paper>

            <Dialog open={openModal} onClose={() => setOpenModal(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ fontWeight: 'bold', bgcolor: '#1976d2', color: 'white' }}>
                    Jelentkezési Lap leadása
                </DialogTitle>
                <DialogContent sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary" mb={3}>
                        Kérjük, jelöld meg, mely területeken dolgoznál a legszívesebben!
                    </Typography>

                    <Typography variant="subtitle1" fontWeight="bold" color="primary">Mely területek érdekelnek?</Typography>
                    <FormGroup sx={{ mb: 3 }}>
                        {event.workAreas.map(area => (
                            <FormControlLabel
                                key={area.id}
                                control={<Checkbox checked={selectedWorkAreas.includes(area.id)} onChange={() => handleWorkAreaToggle(area.id)} />}
                                label={`${area.name} (Max ${area.capacity} fő)`}
                            />
                        ))}
                    </FormGroup>

                    <Divider sx={{ my: 3 }} />

                    {event.questions && event.questions.length > 0 && (
                        <>
                            <Typography variant="subtitle1" fontWeight="bold" color="primary" mb={2}>További információk</Typography>
                            {event.questions.map(q => (
                                <Box key={q.id} mb={3}>
                                    {q.questionType === 'TEXT' && (
                                        <TextField
                                            fullWidth
                                            label={q.questionText}
                                            required={q.isRequired}
                                            value={answers[q.id] || ''}
                                            onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                        />
                                    )}

                                    {q.questionType === 'DROPDOWN' && (
                                        <FormControl fullWidth required={q.isRequired}>
                                            <InputLabel>{q.questionText}</InputLabel>
                                            <Select
                                                label={q.questionText}
                                                value={answers[q.id] || ''}
                                                onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                            >
                                                {q.options.split(',').map((opt, i) => (
                                                    <MenuItem key={i} value={opt.trim()}>{opt.trim()}</MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    )}

                                    {q.questionType === 'CHECKBOX' && (
                                        <FormControl component="fieldset" required={q.isRequired}>
                                            <Typography variant="body1">{q.questionText} {q.isRequired && '*'}</Typography>
                                            <FormGroup>
                                                {q.options.split(',').map((opt, i) => {
                                                    const optionTrimmed = opt.trim();
                                                    return (
                                                        <FormControlLabel
                                                            key={i}
                                                            control={
                                                                <Checkbox
                                                                    checked={((answers[q.id] as string[]) || []).includes(optionTrimmed)}
                                                                    onChange={() => handleCheckboxAnswerToggle(q.id, optionTrimmed)}
                                                                />
                                                            }
                                                            label={optionTrimmed}
                                                        />
                                                    );
                                                })}
                                            </FormGroup>
                                        </FormControl>
                                    )}
                                </Box>
                            ))}
                        </>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 2, bgcolor: '#f5f5f5' }}>
                    <Button onClick={() => setOpenModal(false)} color="inherit" disabled={submitting}>Mégse</Button>
                    <Button onClick={handleSubmitApplication} variant="contained" disabled={submitting}>
                        {submitting ? 'Beküldés...' : 'Jelentkezés Beküldése'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
}