import { useEffect, useState, useRef } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import {
    Box, Button, TextField, Typography, Container, Paper,
    IconButton, Divider, Alert, CircularProgress,
    Select, MenuItem, FormControl, InputLabel, Checkbox, FormControlLabel,
    useMediaQuery, useTheme, Dialog, DialogTitle, DialogContent, DialogActions,
    List, ListItem, ListItemText, Switch, Tooltip, Fade
} from '@mui/material';
import Grid from '@mui/material/Grid';
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';

// --- PROFI NAPTÁR IMPORTOK ---
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { renderTimeViewClock } from '@mui/x-date-pickers/timeViewRenderers';
import { hu } from 'date-fns/locale';

import api from '../api/axios';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import axios from 'axios';
import LoadingScreen from "./LoadingScreen.tsx";

// --- INTERFÉSZEK ---
interface WorkAreaInput {
    id?: number;
    name: string;
    description: string;
    capacity: number;
}

interface EventQuestionInput {
    id?: number;
    questionText: string;
    questionType: 'TEXT' | 'DROPDOWN' | 'CHECKBOX';
    options: string;
    isRequired: boolean;
}

interface Organization {
    id: number;
    name: string;
    tenantId?: string;
}

interface UserProfile {
    role: string;
}

interface ShiftData {
    id: number;
    workAreaId: number;
    workAreaName: string;
    startTime: string;
    endTime: string;
    maxVolunteers: number;
    type?: string;
}

const combineDateAndTime = (date: Date | null, time: Date | null): string | null => {
    if (!date || !time) return null;
    const result = new Date(date);
    result.setHours(time.getHours(), time.getMinutes(), 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${result.getFullYear()}-${pad(result.getMonth() + 1)}-${pad(result.getDate())}T${pad(result.getHours())}:${pad(result.getMinutes())}:00`;
};

// --- NAPTÁR MAGYARÍTÁS ---
const huLocaleText = {
    cancelButtonLabel: 'Mégse',
    okButtonLabel: 'Rendben',
    clearButtonLabel: 'Törlés',
    datePickerToolbarTitle: 'Dátum kiválasztása',
    timePickerToolbarTitle: 'Időpont kiválasztása',
    dateTimePickerToolbarTitle: 'Dátum és idő kiválasztása',
};

export default function EventForm() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const isEditMode = !!id;

    const location = useLocation();
    const passedOrgId = location.state?.selectedOrgId;

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);

    const [user, setUser] = useState<UserProfile | null>(null);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [selectedAdminOrgId, setSelectedAdminOrgId] = useState<number | ''>(passedOrgId || '');

    const [eventData, setEventData] = useState({
        title: '', description: '', location: ''
    });

    const [bannerUrl, setBannerUrl] = useState<string | undefined>(undefined);
    const [bannerFile, setBannerFile] = useState<File | null>(null);
    const bannerFileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingBanner, setUploadingBanner] = useState(false);

    const [startDate, setStartDate] = useState<Date | null>(new Date());
    const [startTime, setStartTime] = useState<Date | null>(new Date());

    const [endDate, setEndDate] = useState<Date | null>(new Date());
    const [endTime, setEndTime] = useState<Date | null>(new Date());

    const [deadlineDate, setDeadlineDate] = useState<Date | null>(null);
    const [deadlineTime, setDeadlineTime] = useState<Date | null>(null);
    const [isRegistrationOpen, setIsRegistrationOpen] = useState(true);

    const [openStartDate, setOpenStartDate] = useState(false);
    const [openStartTime, setOpenStartTime] = useState(false);
    const [openEndDate, setOpenEndDate] = useState(false);
    const [openEndTime, setOpenEndTime] = useState(false);
    const [openDeadlineDate, setOpenDeadlineDate] = useState(false);
    const [openDeadlineTime, setOpenDeadlineTime] = useState(false);

    const [workAreas, setWorkAreas] = useState<WorkAreaInput[]>([{ name: '', description: '', capacity: 5 }]);
    const [questions, setQuestions] = useState<EventQuestionInput[]>([]);

    const [conflictModalOpen, setConflictModalOpen] = useState(false);
    const [conflictingShifts, setConflictingShifts] = useState<ShiftData[]>([]);
    const [editingShiftId, setEditingShiftId] = useState<number | null>(null);
    const [shiftEditStart, setShiftEditStart] = useState<Date | null>(null);
    const [shiftEditEnd, setShiftEditEnd] = useState<Date | null>(null);
    const [shiftActionLoading, setShiftActionLoading] = useState(false);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const userRes = await api.get('/users/me');
                setUser(userRes.data);

                if (userRes.data.role === 'SYS_ADMIN') {
                    const orgsRes = await api.get('/organizations');
                    setOrganizations(orgsRes.data);
                }

                if (isEditMode && id) {
                    const eventRes = await api.get(`/events/${id}`);
                    const data = eventRes.data;
                    setEventData({
                        title: data.title || '', description: data.description || '', location: data.location || ''
                    });

                    setBannerUrl(data.bannerUrl);

                    if (data.startTime) {
                        const sDate = new Date(data.startTime);
                        setStartDate(sDate); setStartTime(sDate);
                    }
                    if (data.endTime) {
                        const eDate = new Date(data.endTime);
                        setEndDate(eDate); setEndTime(eDate);
                    }
                    if (data.applicationDeadline) {
                        const dDate = new Date(data.applicationDeadline);
                        setDeadlineDate(dDate); setDeadlineTime(dDate);
                    }
                    if (data.isRegistrationOpen !== undefined) {
                        setIsRegistrationOpen(data.isRegistrationOpen);
                    }

                    if (data.workAreas) {
                        setWorkAreas(data.workAreas.map((wa: WorkAreaInput) => ({
                            id: wa.id, name: wa.name, description: wa.description || '', capacity: wa.capacity || 0
                        })));
                    }

                    if (data.questions) {
                        setQuestions(data.questions.map((q: EventQuestionInput) => ({
                            id: q.id, questionText: q.questionText, questionType: q.questionType, options: q.options || '', isRequired: q.isRequired
                        })));
                    }
                }
            } catch {
                setError("Hiba az oldal betöltésekor. Lehet, hogy nincsenek megfelelő jogosultságaid.");
            } finally {
                setInitialLoading(false);
            }
        };

        fetchInitialData();
    }, [id, isEditMode]);

    const getBannerDisplayUrl = () => {
        if (bannerFile) return URL.createObjectURL(bannerFile);
        if (!bannerUrl) return undefined;
        const backendBaseUrl = 'http://localhost:8081';
        return bannerUrl.startsWith('http') ? bannerUrl : `${backendBaseUrl}${bannerUrl}`;
    };

    const handleBannerSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert("Csak képfájlt tölthetsz fel!");
            return;
        }

        if (isEditMode && id) {
            setUploadingBanner(true);
            const formData = new FormData();
            formData.append('file', file);

            try {
                const response = await api.post(`/events/${id}/banner`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                const newBannerUrl = `${response.data.imageUrl}?t=${new Date().getTime()}`;
                setBannerUrl(newBannerUrl);
            } catch (err) {
                console.error(err);
                alert("Hiba történt a borítókép feltöltésekor.");
            } finally {
                setUploadingBanner(false);
                if (bannerFileInputRef.current) bannerFileInputRef.current.value = '';
            }
        } else {
            setBannerFile(file);
            if (bannerFileInputRef.current) bannerFileInputRef.current.value = '';
        }
    };

    const handleDeleteBanner = async () => {
        if (!window.confirm("Biztosan törölni szeretnéd a borítóképet?")) return;

        if (isEditMode && id) {
            setUploadingBanner(true);
            try {
                await api.delete(`/events/${id}/banner`);
                setBannerUrl(undefined);
            } catch {
                alert("Nem sikerült törölni a borítóképet.");
            } finally {
                setUploadingBanner(false);
            }
        } else {
            setBannerFile(null);
            setBannerUrl(undefined);
        }
    };

    const handleEventChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setEventData({ ...eventData, [e.target.name]: e.target.value });
    };

    const handleAreaChange = (index: number, field: keyof WorkAreaInput, value: string | number) => {
        const newAreas = [...workAreas];
        newAreas[index] = { ...newAreas[index], [field]: value };
        setWorkAreas(newAreas);
    };
    const addArea = () => setWorkAreas([...workAreas, { name: '', description: '', capacity: 5 }]);
    const removeArea = (index: number) => setWorkAreas(workAreas.filter((_, i) => i !== index));

    const handleQuestionChange = (index: number, field: keyof EventQuestionInput, value: string | boolean) => {
        const newQuestions = [...questions];
        newQuestions[index] = { ...newQuestions[index], [field]: value } as EventQuestionInput;
        if (field === 'questionType' && value === 'TEXT') newQuestions[index].options = '';
        setQuestions(newQuestions);
    };
    const addQuestion = () => setQuestions([...questions, { questionText: '', questionType: 'TEXT', options: '', isRequired: false }]);
    const removeQuestion = (index: number) => setQuestions(questions.filter((_, i) => i !== index));

    const handleDelete = async () => {
        if (window.confirm('Biztosan törölni szeretnéd ezt az eseményt? A hozzá tartozó jelentkezések is törlődnek!')) {
            try {
                setLoading(true);
                await api.delete(`/events/${id}`);
                navigate('/dashboard');
            } catch {
                setError('Nem sikerült törölni az eseményt.');
                setLoading(false);
            }
        }
    };

    const checkShiftConflicts = async (finalStart: string, finalEnd: string) => {
        if (!isEditMode || !id) return true;
        try {
            const shiftsRes = await api.get(`/events/${id}/shifts`);

            const shifts: ShiftData[] = shiftsRes.data.filter((s: ShiftData) => s.type !== 'PERSONAL');

            const newEventStart = new Date(finalStart).getTime();
            const newEventEnd = new Date(finalEnd).getTime();

            const conflicts = shifts.filter(s => {
                const sStart = new Date(s.startTime).getTime();
                const sEnd = new Date(s.endTime).getTime();
                return sStart < newEventStart || sEnd > newEventEnd;
            });

            if (conflicts.length > 0) {
                setConflictingShifts(conflicts);
                setConflictModalOpen(true);
                return false;
            }
            return true;
        } catch (err) {
            console.error("Hiba a műszakok ellenőrzésekor", err);
            return true;
        }
    };

    const handleSubmit = async (e?: FormEvent) => {
        if (e) e.preventDefault();
        setLoading(true);
        setError('');

        if (user?.role === 'SYS_ADMIN' && !isEditMode && selectedAdminOrgId === '') {
            setError('Rendszergazdaként kötelező kiválasztanod, hogy melyik szervezet nevében hozod létre az eseményt!');
            setLoading(false); return;
        }

        const finalStartISO = combineDateAndTime(startDate, startTime);
        const finalEndISO = combineDateAndTime(endDate, endTime);
        const finalDeadlineISO = (deadlineDate && deadlineTime) ? combineDateAndTime(deadlineDate, deadlineTime) : null;

        if (!finalStartISO || !finalEndISO) {
            setError('A kezdés és befejezés időpontja kötelező!');
            setLoading(false); return;
        }

        if (user?.role === 'SYS_ADMIN' && selectedAdminOrgId !== '') {
            const selectedOrg = organizations.find(o => o.id === selectedAdminOrgId);
            if (selectedOrg && selectedOrg.tenantId) {
                localStorage.setItem('tenantId', selectedOrg.tenantId);
            }
        }

        const canProceed = await checkShiftConflicts(finalStartISO, finalEndISO);
        if (!canProceed) {
            setLoading(false);
            return;
        }

        const payload = {
            ...eventData,
            startTime: finalStartISO,
            endTime: finalEndISO,
            applicationDeadline: finalDeadlineISO,
            isRegistrationOpen: isRegistrationOpen,
            workAreas: workAreas,
            questions: questions,
            organization: (user?.role === 'SYS_ADMIN' && selectedAdminOrgId !== '')
                ? { id: selectedAdminOrgId }
                : (passedOrgId ? { id: passedOrgId } : null)
        };

        try {
            let createdEventId = id;
            if (isEditMode) {
                await api.put(`/events/${id}`, payload);
            } else {
                const res = await api.post('/events', payload);
                createdEventId = res.data.id;
            }

            if (!isEditMode && bannerFile && createdEventId) {
                const formData = new FormData();
                formData.append('file', bannerFile);
                try {
                    await api.post(`/events/${createdEventId}/banner`, formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });
                } catch (bannerErr) {
                    console.error("Failed to upload banner after event creation", bannerErr);
                }
            }

            // JAVÍTÁS: Itt kezeljük okosan a navigációt!
            if (isEditMode) {
                navigate(-1); // Visszalépünk a history-ban az Adatlapra
            } else {
                navigate(`/events/${createdEventId}`, { replace: true }); // Felülírjuk az űrlapot a history-ban
            }

        } catch (err: unknown) {
            if (axios.isAxiosError(err)) setError(err.response?.data?.message || err.response?.data || 'Hiba történt a mentés során.');
            else setError('Váratlan hiba történt.');
        } finally {
            setLoading(false);
        }
    };

    const handleModalDeleteShift = async (shiftId: number) => {
        if (!window.confirm("Biztosan törlöd ezt az idősávot?")) return;
        setShiftActionLoading(true);
        try {
            await api.delete(`/shifts/${shiftId}`);
            const updatedConflicts = conflictingShifts.filter(s => s.id !== shiftId);
            setConflictingShifts(updatedConflicts);
            if (updatedConflicts.length === 0) setConflictModalOpen(false);
        } catch {
            alert("Hiba a műszak törlésekor.");
        } finally {
            setShiftActionLoading(false);
        }
    };

    const handleModalSaveShift = async (shift: ShiftData) => {
        if (!shiftEditStart || !shiftEditEnd) return;
        setShiftActionLoading(true);
        try {
            const payload = {
                startTime: combineDateAndTime(shiftEditStart, shiftEditStart),
                endTime: combineDateAndTime(shiftEditEnd, shiftEditEnd),
                maxVolunteers: shift.maxVolunteers
            };
            await api.put(`/shifts/${shift.id}`, payload);
            const updatedConflicts = conflictingShifts.filter(s => s.id !== shift.id);
            setConflictingShifts(updatedConflicts);
            setEditingShiftId(null);
            if (updatedConflicts.length === 0) setConflictModalOpen(false);
        } catch (err: unknown) {
            if (axios.isAxiosError(err)) alert(err.response?.data?.message || "Hiba az időpont mentésekor.");
            else alert("Váratlan hiba történt.");
        } finally {
            setShiftActionLoading(false);
        }
    };

    if (initialLoading) return <LoadingScreen />;

    return (
        <Fade in={true} timeout={600}>
            <Container maxWidth="lg" sx={{ mt: { xs: 2, md: 4 }, mb: 10 }}>

                <Paper elevation={0} sx={{
                    borderRadius: 3,
                    overflow: 'hidden',
                    bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.8)',
                    backdropFilter: 'blur(24px)',
                    border: '1px solid',
                    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.6)',
                    boxShadow: isDarkMode ? '0 20px 40px rgba(0,0,0,0.3)' : '0 20px 40px rgba(0,0,0,0.05)',
                }}>

                    <Box
                        sx={{
                            position: 'relative', width: '100%', height: { xs: 150, sm: 200, md: 250 },
                            backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.5)' : '#e3f2fd',
                            backgroundImage: (bannerUrl || bannerFile)
                                ? `url(${getBannerDisplayUrl()})`
                                : (isDarkMode ? 'linear-gradient(135deg, rgba(30, 58, 138, 0.4) 0%, rgba(15, 23, 42, 0.8) 100%)' : 'linear-gradient(135deg, rgba(25, 118, 210, 0.1) 0%, rgba(21, 101, 192, 0.2) 100%)'),
                            backgroundSize: 'cover', backgroundPosition: 'center',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            borderBottom: '1px solid', borderColor: 'divider'
                        }}
                    >
                        <input
                            type="file" accept="image/*" ref={bannerFileInputRef}
                            style={{ display: 'none' }} onChange={handleBannerSelect}
                        />

                        {!(bannerUrl || bannerFile) && (
                            <Typography variant="h5" color="text.primary" fontWeight="900" sx={{ opacity: 0.4, userSelect: 'none' }}>
                                Opcionális Borítókép
                            </Typography>
                        )}

                        <Box sx={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 1 }}>
                            <Button
                                variant="contained"
                                color="primary"
                                startIcon={uploadingBanner ? <CircularProgress size={20} color="inherit" /> : <PhotoCameraIcon />}
                                onClick={() => bannerFileInputRef.current?.click()}
                                disabled={uploadingBanner}
                                sx={{
                                    bgcolor: isDarkMode ? 'rgba(99, 102, 241, 0.9)' : 'rgba(25, 118, 210, 0.9)',
                                    backdropFilter: 'blur(8px)',
                                    borderRadius: 2,
                                    transition: 'transform 0.3s ease',
                                    '&:hover': { transform: 'scale(1.05)' }
                                }}
                            >
                                {isMobile ? '' : ((bannerUrl || bannerFile) ? 'Borítókép cseréje' : 'Borítókép feltöltése')}
                            </Button>

                            {(bannerUrl || bannerFile) && (
                                <Tooltip title="Borítókép törlése">
                                    <IconButton
                                        color="error"
                                        onClick={handleDeleteBanner}
                                        disabled={uploadingBanner}
                                        sx={{
                                            bgcolor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.9)',
                                            backdropFilter: 'blur(8px)',
                                            transition: 'transform 0.3s ease',
                                            '&:hover': { bgcolor: 'error.main', color: 'white', transform: 'scale(1.1)' }
                                        }}
                                    >
                                        <DeleteIcon />
                                    </IconButton>
                                </Tooltip>
                            )}
                        </Box>
                    </Box>

                    <Box sx={{ p: { xs: 2, sm: 4, md: 5 } }}>
                        <Typography variant="h4" fontWeight="900" color="text.primary" gutterBottom sx={{ fontSize: { xs: '1.6rem', md: '2.125rem' }, letterSpacing: '-0.5px' }}>
                            {isEditMode ? 'Esemény Szerkesztése' : 'Új Esemény Létrehozása'}
                        </Typography>

                        {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

                        <form onSubmit={handleSubmit}>

                            {user?.role === 'SYS_ADMIN' && !isEditMode && (
                                <Alert
                                    severity="warning"
                                    sx={{
                                        mb: 4, borderRadius: 2,
                                        bgcolor: isDarkMode ? 'rgba(217, 119, 6, 0.15)' : '#fff4e5',
                                        color: isDarkMode ? '#fcd34d' : 'inherit',
                                        backdropFilter: 'blur(10px)',
                                        border: '1px solid', borderColor: isDarkMode ? 'rgba(217, 119, 6, 0.3)' : 'transparent'
                                    }}
                                >
                                    <Typography variant="subtitle2" fontWeight="bold" gutterBottom>👑 Rendszergazdai Mód</Typography>
                                    <Typography variant="body2" mb={2}>Melyik csapat (Szervezet) alá akarod besorolni ezt az eseményt?</Typography>
                                    <FormControl fullWidth size="small" sx={{ bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'white', borderRadius: 1 }}>
                                        <InputLabel>Válaszd ki a szervezetet *</InputLabel>
                                        <Select value={selectedAdminOrgId} label="Válaszd ki a szervezetet *" onChange={(e) => setSelectedAdminOrgId(Number(e.target.value))} required>
                                            {organizations.map(org => <MenuItem key={org.id} value={org.id}>{org.name}</MenuItem>)}
                                        </Select>
                                    </FormControl>
                                </Alert>
                            )}

                            <Box sx={{ mb: 5 }}>
                                <Typography variant="subtitle1" color="primary" sx={{ mb: 3, fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                    1. Alapadatok
                                </Typography>
                                <Grid container spacing={3}>
                                    <Grid size={12}>
                                        <TextField fullWidth label="Esemény címe" name="title" value={eventData.title} onChange={handleEventChange} required />
                                    </Grid>
                                    <Grid size={12}>
                                        <TextField fullWidth label="Helyszín" name="location" value={eventData.location} onChange={handleEventChange} required />
                                    </Grid>
                                    <Grid size={12}>
                                        <TextField fullWidth label="Részletes leírás" name="description" value={eventData.description} onChange={handleEventChange} multiline rows={4} required />
                                    </Grid>

                                    <Grid size={12}>
                                        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={hu} localeText={huLocaleText}>
                                            <Grid container spacing={2} mt={1}>
                                                <Grid size={{ xs: 12, sm: 4 }}>
                                                    <DatePicker label="Kezdés Napja" value={startDate} open={openStartDate} onClose={() => setOpenStartDate(false)} onOpen={() => setOpenStartDate(true)} onChange={setStartDate} slotProps={{ toolbar: { hidden: false }, textField: { fullWidth: true, required: true, onClick: () => setOpenStartDate(true) } }}/>
                                                </Grid>
                                                <Grid size={{ xs: 12, sm: 2 }}>
                                                    <TimePicker
                                                        label="Óra" value={startTime} open={openStartTime} onClose={() => setOpenStartTime(false)} onOpen={() => setOpenStartTime(true)} onChange={setStartTime} ampm={false} timeSteps={{ minutes: 5 }} viewRenderers={{ hours: renderTimeViewClock, minutes: renderTimeViewClock, seconds: renderTimeViewClock }}
                                                        slotProps={{
                                                            toolbar: { hidden: false },
                                                            textField: { fullWidth: true, required: true, onClick: () => setOpenStartTime(true) }
                                                        }}
                                                    />
                                                </Grid>

                                                <Grid size={{ xs: 12, sm: 4 }}>
                                                    <DatePicker label="Befejezés Napja" value={endDate} minDate={startDate || undefined} open={openEndDate} onClose={() => setOpenEndDate(false)} onOpen={() => setOpenEndDate(true)} onChange={setEndDate} slotProps={{toolbar: { hidden: false }, textField: { fullWidth: true, required: true, onClick: () => setOpenEndDate(true) } }} />
                                                </Grid>
                                                <Grid size={{ xs: 12, sm: 2 }}>
                                                    <TimePicker
                                                        label="Óra" value={endTime} open={openEndTime} onClose={() => setOpenEndTime(false)} onOpen={() => setOpenEndTime(true)} onChange={setEndTime} ampm={false} timeSteps={{ minutes: 5 }} viewRenderers={{ hours: renderTimeViewClock, minutes: renderTimeViewClock, seconds: renderTimeViewClock }}
                                                        slotProps={{
                                                            toolbar: { hidden: false },
                                                            textField: { fullWidth: true, required: true, onClick: () => setOpenEndTime(true) }
                                                        }}
                                                    />
                                                </Grid>
                                            </Grid>

                                            <Divider sx={{ my: 4, borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider' }} />

                                            <Typography variant="subtitle1" color="primary" sx={{ mb: 2, fontWeight: '800', textTransform: 'uppercase' }}>
                                                Jelentkezési Határidők és Állapot
                                            </Typography>

                                            <Alert severity="info" sx={{ mb: 3, borderRadius: 2, bgcolor: isDarkMode ? 'rgba(59, 130, 246, 0.1)' : 'auto', color: isDarkMode ? '#93c5fd' : 'auto' }}>
                                                Ha megadsz határidőt, a rendszer automatikusan lezárja a jelentkezést az adott időpontban. A kapcsolóval viszont manuálisan is lezárhatod vagy megnyithatod bármikor!
                                            </Alert>

                                            <Grid container spacing={2} alignItems="center">
                                                <Grid size={{ xs: 12, sm: 4 }}>
                                                    <DatePicker label="Jelentkezési Határidő (Opcionális)" value={deadlineDate} open={openDeadlineDate} onClose={() => setOpenDeadlineDate(false)} onOpen={() => setOpenDeadlineDate(true)} onChange={setDeadlineDate} slotProps={{toolbar: { hidden: false }, textField: { fullWidth: true, onClick: () => setOpenDeadlineDate(true) } }} />
                                                </Grid>
                                                <Grid size={{ xs: 12, sm: 2 }}>
                                                    <TimePicker
                                                        label="Óra" value={deadlineTime} open={openDeadlineTime} onClose={() => setOpenDeadlineTime(false)} onOpen={() => setOpenDeadlineTime(true)} onChange={setDeadlineTime} ampm={false} timeSteps={{ minutes: 5 }} viewRenderers={{ hours: renderTimeViewClock, minutes: renderTimeViewClock, seconds: renderTimeViewClock }}
                                                        slotProps={{
                                                            toolbar: { hidden: false },
                                                            textField: { fullWidth: true, onClick: () => setOpenDeadlineTime(true) }
                                                        }}
                                                    />
                                                </Grid>

                                                <Grid size={{ xs: 12, sm: 6 }} sx={{ display: 'flex', justifyContent: { xs: 'flex-start', sm: 'center' } }}>
                                                    <Paper
                                                        elevation={0}
                                                        sx={{
                                                            px: 3, py: 1.5, width: '100%', display: 'flex', justifyContent: 'center',
                                                            borderRadius: 2,
                                                            border: '1px solid',
                                                            bgcolor: isRegistrationOpen
                                                                ? (isDarkMode ? 'rgba(34, 197, 94, 0.15)' : 'rgba(76, 175, 80, 0.1)')
                                                                : (isDarkMode ? 'rgba(239, 68, 68, 0.15)' : 'rgba(244, 67, 54, 0.1)'),
                                                            borderColor: isRegistrationOpen
                                                                ? (isDarkMode ? 'rgba(34, 197, 94, 0.3)' : 'rgba(76, 175, 80, 0.3)')
                                                                : (isDarkMode ? 'rgba(239, 68, 68, 0.3)' : 'rgba(244, 67, 54, 0.3)'),
                                                            transition: 'all 0.3s ease'
                                                        }}
                                                    >
                                                        <FormControlLabel
                                                            control={<Switch checked={isRegistrationOpen} onChange={(e) => setIsRegistrationOpen(e.target.checked)} color="success" />}
                                                            label={
                                                                <Typography fontWeight="bold" color={isRegistrationOpen ? (isDarkMode ? '#4ade80' : 'success.dark') : (isDarkMode ? '#f87171' : 'error.dark')}>
                                                                    {isRegistrationOpen ? "Jelentkezés Nyitva (Aktív)" : "Jelentkezés Lezárva (Szünetel)"}
                                                                </Typography>
                                                            }
                                                        />
                                                    </Paper>
                                                </Grid>
                                            </Grid>
                                        </LocalizationProvider>
                                    </Grid>
                                </Grid>
                            </Box>

                            <Divider sx={{ mb: 4, borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider' }} />

                            <Box sx={{ mb: 5 }}>
                                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, mb: 3, gap: 2 }}>
                                    <Typography variant="subtitle1" color="primary" sx={{ fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                        2. Munkaterületek / Beosztások
                                    </Typography>
                                    {!isMobile && (
                                        <Button
                                            startIcon={<AddCircleOutlineIcon />}
                                            onClick={addArea}
                                            variant="outlined"
                                            size="small"
                                            sx={{ borderRadius: 2, transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-2px)' } }}
                                        >
                                            Terület hozzáadása
                                        </Button>
                                    )}
                                </Box>

                                {workAreas.map((area, index) => (
                                    <Paper
                                        key={index}
                                        elevation={0}
                                        sx={{
                                            p: 3, mb: 2, borderRadius: 2, position: 'relative',
                                            bgcolor: isDarkMode ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.5)',
                                            backdropFilter: 'blur(10px)',
                                            border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                                            transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                                            '&:hover': {
                                                transform: 'translateY(-2px)',
                                                boxShadow: isDarkMode ? '0 10px 20px rgba(0,0,0,0.3)' : '0 10px 20px rgba(0,0,0,0.05)'
                                            },
                                            animation: 'popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
                                            '@keyframes popIn': {
                                                '0%': { opacity: 0, transform: 'scale(0.95) translateY(-10px)' },
                                                '100%': { opacity: 1, transform: 'scale(1) translateY(0)' }
                                            }
                                        }}
                                    >
                                        <IconButton
                                            color="error" onClick={() => removeArea(index)} disabled={workAreas.length === 1}
                                            sx={{ position: 'absolute', top: 12, right: 12, transition: '0.2s', '&:hover': { transform: 'scale(1.1)' } }}
                                        >
                                            <DeleteIcon />
                                        </IconButton>
                                        <Grid container spacing={2} sx={{ pr: { xs: 0, md: 4 }, mt: { xs: 3, md: 0 } }}>
                                            <Grid size={{ xs: 12, md: 5 }}><TextField label="Terület neve" fullWidth size="small" value={area.name} onChange={(e) => handleAreaChange(index, 'name', e.target.value)} required /></Grid>
                                            <Grid size={{ xs: 12, md: 4 }}><TextField label="Rövid feladatleírás" fullWidth size="small" value={area.description} onChange={(e) => handleAreaChange(index, 'description', e.target.value)} /></Grid>
                                            <Grid size={{ xs: 12, md: 3 }}><TextField type="number" label="Max fő" fullWidth size="small" value={area.capacity} onChange={(e) => handleAreaChange(index, 'capacity', parseInt(e.target.value) || 0)} required /></Grid>
                                        </Grid>
                                    </Paper>
                                ))}
                                {isMobile && (
                                    <Button
                                        fullWidth startIcon={<AddCircleOutlineIcon />} onClick={addArea} variant="outlined"
                                        sx={{ mt: 1, borderStyle: 'dashed', borderRadius: 2, py: 1.5 }}
                                    >
                                        Új Munkaterület
                                    </Button>
                                )}
                            </Box>

                            <Divider sx={{ mb: 4, borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider' }} />

                            <Box sx={{ mb: 4 }}>
                                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, mb: 3, gap: 2 }}>
                                    <Box>
                                        <Typography variant="subtitle1" color="primary" sx={{ fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                            3. Jelentkezési Kérdőív (Opcionális)
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">Kérj be extra adatokat a jelentkezőktől (pl. pólóméret, ételallergia).</Typography>
                                    </Box>
                                    {!isMobile && (
                                        <Button
                                            startIcon={<AddCircleOutlineIcon />} onClick={addQuestion} variant="outlined" color="secondary" size="small"
                                            sx={{ borderRadius: 2, transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-2px)' } }}
                                        >
                                            Kérdés hozzáadása
                                        </Button>
                                    )}
                                </Box>

                                {questions.map((q, index) => (
                                    <Paper
                                        key={index}
                                        elevation={0}
                                        sx={{
                                            p: 3, mb: 2, borderRadius: 2, position: 'relative',
                                            bgcolor: isDarkMode ? 'rgba(217, 249, 157, 0.05)' : 'rgba(249, 251, 231, 0.6)',
                                            backdropFilter: 'blur(10px)',
                                            border: '1px solid', borderColor: isDarkMode ? 'rgba(217, 249, 157, 0.1)' : 'rgba(0,0,0,0.05)',
                                            transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                                            '&:hover': {
                                                transform: 'translateY(-2px)',
                                                boxShadow: isDarkMode ? '0 10px 20px rgba(0,0,0,0.3)' : '0 10px 20px rgba(0,0,0,0.05)'
                                            },
                                            animation: 'popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
                                            '@keyframes popIn': {
                                                '0%': { opacity: 0, transform: 'scale(0.95) translateY(-10px)' },
                                                '100%': { opacity: 1, transform: 'scale(1) translateY(0)' }
                                            }
                                        }}
                                    >
                                        <IconButton
                                            color="error" onClick={() => removeQuestion(index)}
                                            sx={{ position: 'absolute', top: 12, right: 12, transition: '0.2s', '&:hover': { transform: 'scale(1.1)' } }}
                                        >
                                            <DeleteIcon />
                                        </IconButton>

                                        <Grid container spacing={2} sx={{ pr: { xs: 0, md: 4 }, mt: { xs: 3, md: 0 } }}>
                                            <Grid size={{ xs: 12, md: 5 }}><TextField label="Kérdés" fullWidth size="small" value={q.questionText} onChange={(e) => handleQuestionChange(index, 'questionText', e.target.value)} required /></Grid>
                                            <Grid size={{ xs: 12, md: 4 }}>
                                                <FormControl fullWidth size="small">
                                                    <InputLabel>Válasz Típusa</InputLabel>
                                                    <Select value={q.questionType} label="Válasz Típusa" onChange={(e) => handleQuestionChange(index, 'questionType', e.target.value)}>
                                                        <MenuItem value="TEXT">Szabad szöveges</MenuItem>
                                                        <MenuItem value="DROPDOWN">Legördülő lista</MenuItem>
                                                        <MenuItem value="CHECKBOX">Többválasztós</MenuItem>
                                                    </Select>
                                                </FormControl>
                                            </Grid>
                                            <Grid size={{ xs: 12, md: 3 }} sx={{ display: 'flex', alignItems: 'center' }}>
                                                <FormControlLabel control={<Checkbox checked={q.isRequired} onChange={(e) => handleQuestionChange(index, 'isRequired', e.target.checked)} color="primary" />} label="Kötelező" />
                                            </Grid>

                                            {q.questionType !== 'TEXT' && (
                                                <Grid size={{ xs: 12 }} sx={{ mt: 1 }}>
                                                    <TextField label="Válaszlehetőségek (vesszővel elválasztva)" fullWidth size="small" value={q.options} onChange={(e) => handleQuestionChange(index, 'options', e.target.value)} required />
                                                </Grid>
                                            )}
                                        </Grid>
                                    </Paper>
                                ))}
                                {isMobile && (
                                    <Button fullWidth color="secondary" startIcon={<AddCircleOutlineIcon />} onClick={addQuestion} variant="outlined" sx={{ mt: 1, borderStyle: 'dashed', borderRadius: 2, py: 1.5 }}>
                                        Új Kérdés
                                    </Button>
                                )}
                            </Box>

                            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, mt: 6 }}>
                                <Button
                                    type="submit" variant="contained" size="large" disabled={loading || uploadingBanner}
                                    sx={{
                                        flexGrow: 1, py: 1.5, fontWeight: '900', borderRadius: 3, fontSize: '1.1rem',
                                        transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                                        background: isDarkMode ? 'linear-gradient(135deg, #818cf8 0%, #4f46e5 100%)' : 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                                        '&:hover': {
                                            transform: 'translateY(-3px)',
                                            boxShadow: isDarkMode ? '0 10px 25px rgba(129, 140, 248, 0.4)' : '0 10px 25px rgba(25, 118, 210, 0.3)'
                                        }
                                    }}
                                >
                                    {loading ? 'Folyamatban...' : isEditMode ? 'Változtatások Mentése' : 'Esemény Publikálása'}
                                </Button>

                                {/* JAVÍTÁS: A Mégse gomb is visszadob a memóriában szerkesztés esetén */}
                                <Button
                                    variant="outlined" size="large" onClick={() => isEditMode ? navigate(-1) : navigate('/dashboard', { replace: true })}
                                    sx={{
                                        borderRadius: 3, py: 1.5, fontWeight: 'bold',
                                        transition: 'all 0.3s ease',
                                        '&:hover': { transform: 'translateY(-3px)', bgcolor: 'action.hover' }
                                    }}
                                >
                                    Mégse
                                </Button>

                                {isEditMode && (
                                    <Button
                                        variant="outlined" color="error" size="large" onClick={handleDelete} disabled={loading || uploadingBanner}
                                        sx={{
                                            borderRadius: 3, py: 1.5, fontWeight: 'bold',
                                            transition: 'transform 0.3s ease', '&:hover': { transform: 'translateY(-3px)' }
                                        }}
                                    >
                                        Törlés
                                    </Button>
                                )}
                            </Box>
                        </form>
                    </Box>
                </Paper>

                <Dialog
                    open={conflictModalOpen} maxWidth="md" fullWidth disableEscapeKeyDown
                    PaperProps={{
                        sx: {
                            borderRadius: 3,
                            bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                            backdropFilter: 'blur(20px)',
                            border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'transparent'
                        }
                    }}
                >
                    <DialogTitle sx={{ bgcolor: isDarkMode ? 'rgba(245, 158, 11, 0.2)' : 'warning.main', color: isDarkMode ? '#fcd34d' : 'white', fontWeight: '900' }}>
                        ⚠️ Ütköző Beosztások Észlelve!
                    </DialogTitle>
                    <DialogContent sx={{ mt: 2 }}>
                        <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
                            Az Esemény új időpontja miatt az alábbi műszakok "kint maradtak". Módosítsd az idejüket, vagy töröld őket!
                        </Alert>
                        <List sx={{ bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : '#fbfbfb', borderRadius: 2, border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#e0e0e0' }}>
                            {conflictingShifts.map(shift => (
                                <ListItem key={shift.id} divider sx={{ py: 2, display: 'flex', flexDirection: 'column', alignItems: 'stretch', borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'divider' }}>
                                    <Box display="flex" justifyContent="space-between" alignItems="center" width="100%">
                                        <ListItemText
                                            primary={<Typography fontWeight="bold" color="primary">{shift.workAreaName}</Typography>}
                                            secondary={
                                                <Typography variant="body2" color="text.secondary">
                                                    Eredeti idő: {new Date(shift.startTime).toLocaleString('hu-HU')} - {new Date(shift.endTime).toLocaleTimeString('hu-HU')}
                                                </Typography>
                                            }
                                        />
                                        <Box display="flex" gap={1}>
                                            {editingShiftId !== shift.id && (
                                                <Button size="small" variant="outlined" startIcon={<EditIcon />} disabled={shiftActionLoading}
                                                        onClick={() => {
                                                            setEditingShiftId(shift.id);
                                                            setShiftEditStart(new Date(shift.startTime));
                                                            setShiftEditEnd(new Date(shift.endTime));
                                                        }}
                                                        sx={{ borderRadius: 2 }}
                                                >Módosít</Button>
                                            )}
                                            <Button size="small" variant="outlined" color="error" startIcon={<DeleteIcon />} disabled={shiftActionLoading} onClick={() => handleModalDeleteShift(shift.id)} sx={{ borderRadius: 2 }}>Töröl</Button>
                                        </Box>
                                    </Box>

                                    {editingShiftId === shift.id && (
                                        <Paper elevation={0} sx={{ mt: 2, p: 2, bgcolor: isDarkMode ? 'rgba(59, 130, 246, 0.1)' : '#e3f2fd', width: '100%', borderRadius: 2, border: '1px solid', borderColor: isDarkMode ? 'rgba(59, 130, 246, 0.2)' : 'transparent' }}>
                                            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={hu} localeText={huLocaleText}>
                                                <Grid container spacing={2} alignItems="center">
                                                    <Grid size={{xs: 12, sm: 5}}>
                                                        <DateTimePicker
                                                            label="Új Kezdés" value={shiftEditStart} onChange={setShiftEditStart} disabled={shiftActionLoading} ampm={false} timeSteps={{ minutes: 5 }}
                                                            slotProps={{ toolbar: { hidden: false }, textField: { fullWidth: true, size: 'small' } }}
                                                        />
                                                    </Grid>
                                                    <Grid size={{xs: 12, sm: 5}}>
                                                        <DateTimePicker
                                                            label="Új Befejezés" value={shiftEditEnd} onChange={setShiftEditEnd} disabled={shiftActionLoading} ampm={false} timeSteps={{ minutes: 5 }}
                                                            slotProps={{ toolbar: { hidden: false }, textField: { fullWidth: true, size: 'small' } }}
                                                        />
                                                    </Grid>
                                                    <Grid size={{xs: 12, sm: 2}} display="flex" gap={1}>
                                                        <IconButton color="success" onClick={() => handleModalSaveShift(shift)} disabled={shiftActionLoading} sx={{ bgcolor: isDarkMode ? 'rgba(74, 222, 128, 0.1)' : 'white' }}><CheckIcon /></IconButton>
                                                        <IconButton color="error" onClick={() => setEditingShiftId(null)} disabled={shiftActionLoading} sx={{ bgcolor: isDarkMode ? 'rgba(248, 113, 113, 0.1)' : 'white' }}><CloseIcon /></IconButton>
                                                    </Grid>
                                                </Grid>
                                            </LocalizationProvider>
                                        </Paper>
                                    )}
                                </ListItem>
                            ))}
                            {conflictingShifts.length === 0 && (
                                <ListItem><Alert severity="success" sx={{ width: '100%', borderRadius: 2 }}>Minden ütközést elhárítottál! Most már elmentheted az Eseményt!</Alert></ListItem>
                            )}
                        </List>
                    </DialogContent>
                    <DialogActions sx={{ p: 2, px: 3 }}>
                        <Button onClick={() => setConflictModalOpen(false)} variant="outlined" color="inherit" disabled={shiftActionLoading} sx={{ borderRadius: 2 }}>Mégse</Button>
                        <Button onClick={() => handleSubmit()} variant="contained" color="success" disabled={conflictingShifts.length > 0 || shiftActionLoading} sx={{ borderRadius: 2, fontWeight: 'bold' }}>Mentés folytatása</Button>
                    </DialogActions>
                </Dialog>
            </Container>
        </Fade>
    );
}