import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Container, Typography, Box, Paper, Button, CircularProgress,
    Alert, Divider, Dialog, DialogTitle, DialogContent,
    DialogActions, FormControlLabel, Checkbox, TextField,
    FormControl, InputLabel, Select, MenuItem, FormGroup,
    useMediaQuery, useTheme, Chip
} from '@mui/material';
import Grid from '@mui/material/Grid'; // Grid2 importálva
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
    rejectionMessage?: string;
}

export default function EventDetails() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm')); // Reszponzív breakpoint

    const [event, setEvent] = useState<EventData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [myApplications, setMyApplications] = useState<UserApplication[]>([]);

    const [openModal, setOpenModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [selectedWorkAreas, setSelectedWorkAreas] = useState<number[]>([]);
    const [answers, setAnswers] = useState<Record<number, string | string[]>>({});

    const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
    const [withdrawAppId, setWithdrawAppId] = useState<number | null>(null);
    const [withdrawReason, setWithdrawReason] = useState('');
    const [withdrawing, setWithdrawing] = useState(false);

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

    const handleWithdrawClick = (applicationId: number) => {
        setWithdrawAppId(applicationId);
        setWithdrawReason('');
        setWithdrawModalOpen(true);
    };

    const confirmWithdraw = async () => {
        if (!withdrawAppId) return;
        setWithdrawing(true);
        try {
            await api.delete(`/applications/${withdrawAppId}`, {
                params: { reason: withdrawReason.trim() || undefined }
            });
            setWithdrawModalOpen(false);
            await checkIfApplied();
        } catch {
            alert("Nem sikerült visszavonni a jelentkezést.");
        } finally {
            setWithdrawing(false);
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
            prev.includes(areaId) ? prev.filter(aId => aId !== areaId) : [...prev, areaId]
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
        <Container maxWidth="lg" sx={{ mt: { xs: 2, md: 4 }, mb: 10 }}>
            <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/dashboard')} sx={{ mb: 2 }}>
                Vissza a listához
            </Button>

            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

            {/* JELENTKEZÉSEID ÁLLAPOTA (JAVÍTOTT RESZPONZIVITÁS) */}
            {myApplications.length > 0 && (
                <Alert
                    severity="info"
                    sx={{ mb: 4, borderRadius: 3, border: '1px solid', borderColor: 'info.light', bgcolor: '#f8fbff' }}
                >
                    <Typography variant="subtitle1" fontWeight="bold" mb={2} color="info.dark">
                        Jelentkezéseid állapota:
                    </Typography>

                    {myApplications.map((app) => (
                        <Box key={app.id} sx={{
                            mb: 1.5, p: 2,
                            bgcolor: 'white',
                            borderRadius: 2,
                            boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                            display: 'flex',
                            flexDirection: { xs: 'column', sm: 'row' }, // Mobilon egymás alá
                            alignItems: { xs: 'flex-start', sm: 'center' },
                            justifyContent: 'space-between',
                            gap: 2
                        }}>
                            <Box>
                                <Typography sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                                    {app.workAreaName}
                                </Typography>
                                <Typography
                                    variant="body2"
                                    fontWeight="bold"
                                    sx={{ mt: 0.5 }}
                                    color={
                                        app.status === 'APPROVED' ? 'success.main' :
                                            app.status === 'REJECTED' ? 'error.main' :
                                                app.status === 'WITHDRAWN' ? 'text.disabled' : 'warning.dark'
                                    }
                                >
                                    {app.status === 'PENDING' ? '⏳ Elbírálás alatt' :
                                        app.status === 'APPROVED' ? '✅ Elfogadva' :
                                            app.status === 'REJECTED' ? '❌ Elutasítva' : '🏳️ Visszavonva'}
                                </Typography>
                            </Box>

                            <Box sx={{ width: { xs: '100%', sm: 'auto' } }}>
                                {(app.status === 'PENDING' || app.status === 'APPROVED') && (
                                    <Button
                                        fullWidth={isMobile}
                                        size="small"
                                        color="error"
                                        variant="outlined"
                                        startIcon={<DeleteIcon />}
                                        onClick={() => handleWithdrawClick(app.id)}
                                    >
                                        Visszavonás
                                    </Button>
                                )}

                                {app.status === 'WITHDRAWN' && (
                                    <Button
                                        fullWidth={isMobile}
                                        size="small"
                                        color="primary"
                                        variant="contained"
                                        startIcon={<RestoreIcon />}
                                        onClick={() => handleReApply(app.id)}
                                    >
                                        Visszajelentkezés
                                    </Button>
                                )}
                            </Box>

                            {app.status === 'REJECTED' && app.rejectionMessage && (
                                <Box sx={{ width: '100%', mt: 1, p: 1.5, bgcolor: '#ffebee', borderRadius: 1, borderLeft: '4px solid #d32f2f' }}>
                                    <Typography variant="body2" color="error.dark">
                                        <strong>Szervező üzenete:</strong> {app.rejectionMessage}
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    ))}
                </Alert>
            )}

            <Paper elevation={2} sx={{ p: { xs: 2, sm: 4, md: 5 }, borderRadius: 3 }}>
                <Grid container spacing={4}>
                    <Grid size={{ xs: 12, md: 8 }}>
                        <Typography variant="h4" sx={{ fontSize: { xs: '1.8rem', md: '2.5rem' }, fontWeight: '900', color: 'primary.main', mb: 1 }}>
                            {event.title}
                        </Typography>
                        <Typography variant="subtitle1" color="text.secondary" gutterBottom sx={{ fontWeight: 'bold' }}>
                            Szervező: {event.organization.name}
                        </Typography>
                        <Box mt={4}>
                            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', fontSize: '1.05rem', lineHeight: 1.7 }}>
                                {event.description}
                            </Typography>
                        </Box>
                    </Grid>

                    <Grid size={{ xs: 12, md: 4 }}>
                        <Paper variant="outlined" sx={{ p: 3, bgcolor: '#f8fafc', borderRadius: 3, border: '1px solid #e2e8f0' }}>
                            <Typography variant="subtitle2" color="primary" fontWeight="bold" textTransform="uppercase">Helyszín</Typography>
                            <Typography variant="body1" mb={2} fontWeight="500">{event.location}</Typography>

                            <Typography variant="subtitle2" color="primary" fontWeight="bold" textTransform="uppercase">Kezdés</Typography>
                            <Typography variant="body1" mb={2} fontWeight="500">{new Date(event.startTime).toLocaleString('hu-HU')}</Typography>

                            <Typography variant="subtitle2" color="primary" fontWeight="bold" textTransform="uppercase">Befejezés</Typography>
                            <Typography variant="body1" mb={3} fontWeight="500">{new Date(event.endTime).toLocaleString('hu-HU')}</Typography>

                            <Button
                                variant="contained"
                                size="large"
                                fullWidth
                                startIcon={<HowToRegIcon />}
                                disabled={myApplications.some(app => app.status !== 'WITHDRAWN')}
                                onClick={() => setOpenModal(true)}
                                sx={{ py: 1.5, fontWeight: 'bold', borderRadius: 2 }}
                            >
                                {myApplications.some(app => app.status !== 'WITHDRAWN') ? "Jelentkezés leadva" : "Jelentkezem!"}
                            </Button>
                        </Paper>
                    </Grid>
                </Grid>

                <Divider sx={{ my: 5 }} />

                <Typography variant="h5" fontWeight="bold" mb={3}>Elérhető Munkaterületek</Typography>
                <Grid container spacing={3}>
                    {event.workAreas.map((area) => (
                        <Grid size={{ xs: 12, sm: 6, md: 4 }} key={area.id}>
                            <Paper variant="outlined" sx={{ p: 3, height: '100%', borderRadius: 3, borderLeft: '4px solid #1976d2', display: 'flex', flexDirection: 'column' }}>
                                <Typography variant="h6" fontWeight="bold">{area.name}</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2, flexGrow: 1 }}>
                                    {area.description || "Nincs megadva részletes leírás."}
                                </Typography>
                                <Chip label={`Kapacitás: ${area.capacity} fő`} size="small" color="primary" variant="outlined" sx={{ fontWeight: 'bold', alignSelf: 'flex-start' }} />
                            </Paper>
                        </Grid>
                    ))}
                </Grid>
            </Paper>

            {/* --- JELENTKEZÉS MODAL (JAVÍTOTT MARGÓK MOBILON) --- */}
            <Dialog open={openModal} onClose={() => setOpenModal(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { m: { xs: 2, sm: 3 }, borderRadius: 3 } }}>
                <DialogTitle sx={{ fontWeight: 'bold', bgcolor: 'primary.main', color: 'white', fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
                    Jelentkezési Lap
                </DialogTitle>
                <DialogContent sx={{ p: { xs: 2, sm: 3 }, pt: '16px !important' }}>
                    <Typography variant="body2" color="text.secondary" mb={3}>
                        Kérjük, jelöld meg, mely területeken dolgoznál a legszívesebben! Többet is választhatsz.
                    </Typography>

                    <Typography variant="subtitle2" fontWeight="bold" color="primary" textTransform="uppercase">1. Mely területek érdekelnek?</Typography>
                    <FormGroup sx={{ mb: 1, mt: 1 }}>
                        {event.workAreas.map(area => (
                            <FormControlLabel
                                key={area.id}
                                control={<Checkbox checked={selectedWorkAreas.includes(area.id)} onChange={() => handleWorkAreaToggle(area.id)} />}
                                label={`${area.name} (Max ${area.capacity} fő)`}
                            />
                        ))}
                    </FormGroup>

                    {event.questions && event.questions.length > 0 && (
                        <>
                            <Divider sx={{ my: 3 }} />
                            <Typography variant="subtitle2" fontWeight="bold" color="primary" textTransform="uppercase" mb={2}>2. További információk</Typography>
                            {event.questions.map(q => (
                                <Box key={q.id} mb={3}>
                                    {q.questionType === 'TEXT' && (
                                        <TextField fullWidth size="small" label={q.questionText} required={q.isRequired} value={answers[q.id] || ''} onChange={(e) => handleAnswerChange(q.id, e.target.value)} />
                                    )}
                                    {q.questionType === 'DROPDOWN' && (
                                        <FormControl fullWidth size="small" required={q.isRequired}>
                                            <InputLabel>{q.questionText}</InputLabel>
                                            <Select label={q.questionText} value={answers[q.id] || ''} onChange={(e) => handleAnswerChange(q.id, e.target.value)}>
                                                {q.options.split(',').map((opt, i) => (<MenuItem key={i} value={opt.trim()}>{opt.trim()}</MenuItem>))}
                                            </Select>
                                        </FormControl>
                                    )}
                                    {q.questionType === 'CHECKBOX' && (
                                        <FormControl component="fieldset" required={q.isRequired}>
                                            <Typography variant="body2" fontWeight="500" mb={1}>{q.questionText} {q.isRequired && '*'}</Typography>
                                            <FormGroup>
                                                {q.options.split(',').map((opt, i) => {
                                                    const optionTrimmed = opt.trim();
                                                    return (<FormControlLabel key={i} control={<Checkbox size="small" checked={((answers[q.id] as string[]) || []).includes(optionTrimmed)} onChange={() => handleCheckboxAnswerToggle(q.id, optionTrimmed)}/>} label={<Typography variant="body2">{optionTrimmed}</Typography>} />);
                                                })}
                                            </FormGroup>
                                        </FormControl>
                                    )}
                                </Box>
                            ))}
                        </>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 2, bgcolor: '#f8fafc' }}>
                    <Button onClick={() => setOpenModal(false)} color="inherit" disabled={submitting}>Mégse</Button>
                    <Button onClick={handleSubmitApplication} variant="contained" disabled={submitting} sx={{ borderRadius: 2 }}>
                        {submitting ? 'Beküldés...' : 'Jelentkezés Beküldése'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* --- VISSZAVONÁS MODAL --- */}
            <Dialog open={withdrawModalOpen} onClose={() => setWithdrawModalOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { m: { xs: 2, sm: 3 }, borderRadius: 3 } }}>
                <DialogTitle sx={{ bgcolor: 'error.main', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1, fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
                    <DeleteIcon /> Jelentkezés visszavonása
                </DialogTitle>
                <DialogContent sx={{ p: { xs: 2, sm: 3 }, pt: '16px !important' }}>
                    <Typography variant="body2" mb={2}>
                        Sajnáljuk, hogy meggondoltad magad! Kérjük, oszd meg a szervezőkkel, hogy miért vonod vissza a jelentkezésedet (opcionális).
                    </Typography>
                    <TextField
                        fullWidth
                        autoFocus
                        multiline
                        rows={3}
                        label="Visszavonás oka"
                        variant="outlined"
                        placeholder="Pl.: Közbejött egy családi esemény..."
                        value={withdrawReason}
                        onChange={(e) => setWithdrawReason(e.target.value)}
                    />
                </DialogContent>
                <DialogActions sx={{ p: 2, bgcolor: '#f8fafc' }}>
                    <Button onClick={() => setWithdrawModalOpen(false)} color="inherit" disabled={withdrawing}>Mégse</Button>
                    <Button onClick={confirmWithdraw} variant="contained" color="error" disabled={withdrawing} sx={{ borderRadius: 2 }}>
                        {withdrawing ? 'Folyamatban...' : 'Végleges Visszavonás'}
                    </Button>
                </DialogActions>
            </Dialog>

        </Container>
    );
}