import { useEffect, useState, useMemo } from 'react';
import {
    Container, Typography, Box, Paper, Button, CircularProgress,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField,
    Chip, Divider, Avatar, Alert, ToggleButton, ToggleButtonGroup,
    FormControl, InputLabel, Select, MenuItem, IconButton, Pagination,
    useTheme, useMediaQuery, Popover, InputAdornment, Fade, Stack, Switch, FormControlLabel, Grid,
    Collapse
} from '@mui/material';

import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import BlockIcon from '@mui/icons-material/Block';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';

import { format, isSameDay } from 'date-fns';
import { hu } from 'date-fns/locale';

import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { renderTimeViewClock } from '@mui/x-date-pickers/timeViewRenderers';

import api from '../api/axios';
import { useThemeToggle } from '../theme/ThemeContextProvider';

import CustomCalendar, { type CalendarEventData } from '../components/CustomCalendar';

interface MyShiftDTO {
    assignmentId: number;
    shiftId: number;
    eventName: string | null;
    workAreaName: string | null;
    shiftName: string | null;
    startTime: string;
    endTime: string;
    status: 'PENDING' | 'CONFIRMED' | 'MODIFICATION_REQUESTED';
    message?: string;
    type?: 'WORK' | 'MEETING' | 'PERSONAL';
    description?: string;
    coWorkers: string[];
    tenantId: string;
}

const toLocalISO = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
};

// Okos Dátum-képző függvény (Külön napi vagy egész napos eseményekhez)
const renderDateRange = (startDateStr: string, endDateStr: string) => {
    const start = new Date(startDateStr);
    let end = new Date(endDateStr);

    // Ha 00:00-nál végződik, technikai okokból visszahúzzuk egy nappal a vizuális megjelenítéshez
    if (end.getHours() === 0 && end.getMinutes() === 0 && end.getTime() > start.getTime()) {
        end = new Date(end.getTime() - 1000);
    }

    const isAllDay = start.getHours() === 0 && start.getMinutes() === 0 && end.getHours() === 23 && end.getMinutes() >= 59;
    const sameDay = isSameDay(start, end);

    if (sameDay) {
        if (isAllDay) return { time: 'Egész napos', date: format(start, 'yyyy. MMMM d.', { locale: hu }) };
        return {
            time: `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`,
            date: format(start, 'yyyy. MMMM d.', { locale: hu })
        };
    } else {
        if (isAllDay) return { time: 'Több napos esemény', date: `${format(start, 'MMM d.', { locale: hu })} – ${format(end, 'MMM d.', { locale: hu })}` };
        return {
            time: `${format(start, 'MMM d. HH:mm', { locale: hu })} – ${format(end, 'MMM d. HH:mm', { locale: hu })}`,
            date: 'Több napos esemény'
        };
    }
};


export default function MyShifts() {
    const { isDarkMode } = useThemeToggle();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const [shifts, setShifts] = useState<MyShiftDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
    const [selectedEventFilter, setSelectedEventFilter] = useState<string>('all');

    const [currentDate, setCurrentDate] = useState(new Date());
    const [calendarView, setCalendarView] = useState<'month' | 'week' | 'day'>('month');
    const [listPage, setListPage] = useState(1);
    const ITEMS_PER_PAGE = 5;

    const [monthPickerAnchor, setMonthPickerAnchor] = useState<HTMLDivElement | null>(null);
    const [pickerYear, setPickerYear] = useState(currentDate.getFullYear());
    const monthNames = ['Január', 'Február', 'Március', 'Április', 'Május', 'Június', 'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December'];

    const [selectedShift, setSelectedShift] = useState<MyShiftDTO | null>(null);
    const [modalOpen, setModalOpen] = useState(false);

    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

    const [changeMessage, setChangeMessage] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    const [personalModalOpen, setPersonalModalOpen] = useState(false);
    const [isEditingPersonal, setIsEditingPersonal] = useState(false);
    const [editingPersonalId, setEditingPersonalId] = useState<number | null>(null);

    const [personalData, setPersonalData] = useState<{
        name: string; start: Date | null; end: Date | null; isAllDay: boolean;
    }>({ name: '', start: null, end: null, isAllDay: false });

    const [openDateStart, setOpenDateStart] = useState(false);
    const [openTimeStart, setOpenTimeStart] = useState(false);
    const [openDateEnd, setOpenDateEnd] = useState(false);
    const [openTimeEnd, setOpenTimeEnd] = useState(false);

    useEffect(() => {
        fetchMyShifts();
    }, []);

    useEffect(() => { setListPage(1); }, [currentDate, selectedEventFilter]);

    const fetchMyShifts = async () => {
        try {
            setLoading(true);
            const response = await api.get('/events/my-shifts');
            setShifts(response.data);

            if (isInitialLoad && response.data.length > 0) {
                const now = new Date().getTime();
                const upcomingShifts = response.data.filter((s: MyShiftDTO) => new Date(s.endTime).getTime() > now);
                if (upcomingShifts.length > 0) {
                    setCurrentDate(new Date(upcomingShifts.sort((a: MyShiftDTO, b: MyShiftDTO) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0].startTime));
                } else {
                    setCurrentDate(new Date([...response.data].sort((a: MyShiftDTO, b: MyShiftDTO) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0].startTime));
                }
                setIsInitialLoad(false);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const uniqueEvents = useMemo(() => {
        const eventsList = shifts.map(s => s.eventName).filter(name => name !== null && name !== undefined) as string[];
        return Array.from(new Set(eventsList)).sort();
    }, [shifts]);

    const hasPersonalShifts = useMemo(() => shifts.some(s => s.type === 'PERSONAL'), [shifts]);

    const filteredShifts = useMemo(() => {
        if (selectedEventFilter === 'all') return shifts;
        if (selectedEventFilter === 'PERSONAL_ONLY') return shifts.filter(s => s.type === 'PERSONAL');
        return shifts.filter(s => s.eventName === selectedEventFilter);
    }, [shifts, selectedEventFilter]);

    const finalShiftsForList = useMemo(() => {
        return filteredShifts.filter(s => {
            const shiftDate = new Date(s.startTime);
            return shiftDate.getMonth() === currentDate.getMonth() && shiftDate.getFullYear() === currentDate.getFullYear();
        });
    }, [filteredShifts, currentDate]);

    const paginatedShifts = useMemo(() => {
        const startIndex = (listPage - 1) * ITEMS_PER_PAGE;
        return finalShiftsForList.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [finalShiftsForList, listPage]);

    const customCalendarEvents = useMemo<CalendarEventData[]>(() => {
        return filteredShifts.map(shift => {
            let eventTitle = shift.workAreaName || 'Gyűlés';
            if (shift.type === 'PERSONAL') eventTitle = `[Személyes] ${shift.description}`;
            else if (shift.type === 'MEETING') eventTitle = shift.shiftName || 'Globális Gyűlés';
            else if (shift.shiftName) eventTitle = `${shift.workAreaName} (${shift.shiftName})`;

            let color = isDarkMode ? '#ea580c' : '#f97316';
            if (shift.type === 'PERSONAL') color = isDarkMode ? '#475569' : '#64748b';
            else if (shift.type === 'MEETING') color = isDarkMode ? '#9333ea' : '#a855f7';
            else {
                if (shift.status === 'CONFIRMED') color = isDarkMode ? '#16a34a' : '#22c55e';
                if (shift.status === 'MODIFICATION_REQUESTED') color = isDarkMode ? '#dc2626' : '#ef4444';
            }

            return {
                id: `${shift.tenantId}-${shift.assignmentId}`,
                title: eventTitle,
                start: new Date(shift.startTime),
                end: new Date(shift.endTime),
                color: color,
                originalData: shift
            };
        });
    }, [filteredShifts, isDarkMode]);

    const handleSelectEvent = (eventData: CalendarEventData) => {
        const shift = eventData.originalData as MyShiftDTO;
        setSelectedShift(shift);
        setChangeMessage(shift.message || '');
        setModalOpen(true);
    };

    const handleOpenNewPersonalModal = (start?: Date, end?: Date, isAllDay: boolean = false) => {
        const defaultStart = start || new Date();
        const defaultEnd = end || new Date(defaultStart.getTime() + 60 * 60 * 1000);

        setPersonalData({ name: '', start: defaultStart, end: defaultEnd, isAllDay });
        setOpenDateStart(false); setOpenTimeStart(false); setOpenDateEnd(false); setOpenTimeEnd(false);
        setIsEditingPersonal(false); setEditingPersonalId(null);
        setPersonalModalOpen(true);
    };

    const handleSelectSlot = (date: Date) => {
        const start = new Date(date);
        const end = new Date(start);
        let isAllDay = false;

        if (start.getHours() === 0 && start.getMinutes() === 0) {
            isAllDay = true;
            end.setHours(23, 59, 59, 999);
        } else {
            end.setHours(start.getHours() + 1);
            isAllDay = false;
        }

        handleOpenNewPersonalModal(start, end, isAllDay);
    };

    const handleEditPersonalShift = () => {
        if (!selectedShift) return;
        const sTime = new Date(selectedShift.startTime);
        let eTime = new Date(selectedShift.endTime);

        if (eTime.getHours() === 0 && eTime.getMinutes() === 0) {
            eTime = new Date(eTime.getTime() - 1000);
        }

        const isAllDay = sTime.getHours() === 0 && sTime.getMinutes() === 0 && eTime.getHours() === 23 && eTime.getMinutes() >= 59;

        setPersonalData({ name: selectedShift.description || '', start: sTime, end: eTime, isAllDay });
        setOpenDateStart(false); setOpenTimeStart(false); setOpenDateEnd(false); setOpenTimeEnd(false);
        setIsEditingPersonal(true); setEditingPersonalId(selectedShift.shiftId);
        setModalOpen(false); setPersonalModalOpen(true);
    };

    const handleSavePersonalShift = async () => {
        if (!personalData.start || !personalData.end) return;
        setActionLoading(true);

        try {
            const finalStart = new Date(personalData.start);
            let finalEnd = new Date(personalData.end);

            if (personalData.isAllDay) {
                finalStart.setHours(0, 0, 0, 0);
                finalEnd.setHours(23, 59, 59, 999);
            }

            if (finalStart >= finalEnd) {
                finalEnd = new Date(finalStart.getTime() + 60 * 60 * 1000); // +1 óra ha rosszul állítják be
            }

            const payload = { description: personalData.name, startTime: toLocalISO(finalStart), endTime: toLocalISO(finalEnd), type: 'PERSONAL', maxVolunteers: 1 };
            const originalTenant = localStorage.getItem('tenantId');
            if (isEditingPersonal && selectedShift?.tenantId) localStorage.setItem('tenantId', selectedShift.tenantId);

            try {
                if (isEditingPersonal && editingPersonalId) await api.put(`/shifts/${editingPersonalId}`, payload);
                else await api.post(`/shifts/personal`, payload);
            } finally {
                if (originalTenant) localStorage.setItem('tenantId', originalTenant);
                else localStorage.removeItem('tenantId');
            }

            setPersonalModalOpen(false);
            fetchMyShifts();
        } catch (error) {
            console.error(error); alert("Hiba a mentés során.");
        } finally {
            setActionLoading(false);
        }
    };

    const executeDeletePersonalShift = async () => {
        if (!selectedShift) return;
        setActionLoading(true);

        const originalTenant = localStorage.getItem('tenantId');
        if (selectedShift.tenantId) localStorage.setItem('tenantId', selectedShift.tenantId);

        try {
            await api.delete(`/shifts/personal/${selectedShift.shiftId}`);
            setDeleteConfirmOpen(false);
            setModalOpen(false);
            fetchMyShifts();
        } catch (error) {
            console.error(error); alert("Hiba a törlés során.");
        } finally {
            if (originalTenant) localStorage.setItem('tenantId', originalTenant);
            else localStorage.removeItem('tenantId');
            setActionLoading(false);
        }
    };

    const handleUpdateStatus = async (newStatus: 'CONFIRMED' | 'MODIFICATION_REQUESTED') => {
        if (!selectedShift) return;
        setActionLoading(true);

        const originalTenant = localStorage.getItem('tenantId');
        if (selectedShift.tenantId) localStorage.setItem('tenantId', selectedShift.tenantId);

        try {
            await api.put(`/shifts/assignments/${selectedShift.assignmentId}/status`, { status: newStatus, message: changeMessage });
            setModalOpen(false); fetchMyShifts();
        } catch (error) {
            console.error(error); alert("Hiba a művelet során.");
        } finally {
            if (originalTenant) localStorage.setItem('tenantId', originalTenant);
            else localStorage.removeItem('tenantId');
            setActionLoading(false);
        }
    };

    return (
        <Fade in={true} timeout={500}>
            <Container component="main" maxWidth="lg" sx={{ pt: { xs: 2, sm: 4 }, pb: { xs: 2, sm: 4 }, display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ flexShrink: 0 }}>
                    <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'flex-start' }} gap={3} mb={3}>
                        <Box sx={{ flex: 1 }}>
                            <Typography component="h1" variant="h3" fontWeight="900" sx={{ background: isDarkMode ? 'linear-gradient(90deg, #818cf8, #c084fc)' : 'linear-gradient(90deg, #4f46e5, #9333ea)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                                Saját Naptáram <span style={{ WebkitTextFillColor: 'initial', fontSize: '2.5rem' }}>📅</span>
                            </Typography>
                            <Typography variant="body1" color="text.secondary" sx={{ mt: 1, fontSize: '1.1rem' }}>
                                Kezeld a beosztásaidat, és rögzítsd a saját elfoglaltságaidat!
                            </Typography>
                        </Box>

                        <Box display="flex" flexDirection="column" gap={1.5} sx={{ width: { xs: '100%', md: '450px' } }}>
                            <Box display="flex" gap={1.5} sx={{ width: '100%' }}>
                                <Box sx={{ flex: 1 }}>
                                    <TextField
                                        fullWidth label="Ugrás hónapra" value={format(currentDate, 'yyyy. MMMM', { locale: hu })} size="small"
                                        onClick={(e) => { setMonthPickerAnchor(e.currentTarget); setPickerYear(currentDate.getFullYear()); }}
                                        InputProps={{ readOnly: true, startAdornment: <InputAdornment position="start"><CalendarMonthIcon color="action" fontSize="small" /></InputAdornment>, style: { cursor: 'pointer', textTransform: 'capitalize' } }}
                                        InputLabelProps={{ shrink: true }}
                                        sx={{ '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.4)' : 'rgba(255,255,255,0.6)', backdropFilter: 'blur(10px)', borderRadius: 3 } }}
                                    />
                                    <Popover open={Boolean(monthPickerAnchor)} anchorEl={monthPickerAnchor} onClose={() => setMonthPickerAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }} transformOrigin={{ vertical: 'top', horizontal: 'left' }} PaperProps={{ elevation: 0, sx: { borderRadius: 4, mt: 1, border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', bgcolor: isDarkMode ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.85)', backdropFilter: 'blur(24px)' } }}>
                                        <Box p={2} width={280}>
                                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                                                <IconButton size="small" onClick={() => setPickerYear(y => y - 1)}><ChevronLeftIcon /></IconButton>
                                                <Typography fontWeight="bold" variant="h6">{pickerYear}</Typography>
                                                <IconButton size="small" onClick={() => setPickerYear(y => y + 1)}><ChevronRightIcon /></IconButton>
                                            </Box>
                                            <Box display="grid" gridTemplateColumns="repeat(3, 1fr)" gap={1}>
                                                {monthNames.map((month, index) => {
                                                    const isCurrent = currentDate.getMonth() === index && currentDate.getFullYear() === pickerYear;
                                                    return (
                                                        <Button key={month} size="small" variant={isCurrent ? "contained" : "text"} disableElevation sx={{ borderRadius: 2, color: isCurrent ? 'white' : 'text.primary', textTransform: 'capitalize', fontWeight: isCurrent ? 800 : 500 }} onClick={() => { setCurrentDate(new Date(pickerYear, index, 1)); setMonthPickerAnchor(null); }}>
                                                            {month.substring(0, 3)}
                                                        </Button>
                                                    );
                                                })}
                                            </Box>
                                        </Box>
                                    </Popover>
                                </Box>
                                <FormControl size="small" sx={{ flex: 1, '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.4)' : 'rgba(255,255,255,0.6)', backdropFilter: 'blur(10px)', borderRadius: 3 } }}>
                                    <InputLabel>Esemény szűrő</InputLabel>
                                    <Select value={selectedEventFilter} label="Esemény szűrő" onChange={(e) => setSelectedEventFilter(e.target.value)}>
                                        <MenuItem value="all" sx={{ fontWeight: 'bold' }}>Minden Esemény</MenuItem>
                                        {hasPersonalShifts && <MenuItem value="PERSONAL_ONLY" sx={{ fontWeight: 'bold', color: 'primary.main' }}>Saját Elfoglaltságok</MenuItem>}
                                        {uniqueEvents.map(eventName => <MenuItem key={eventName} value={eventName}>{eventName}</MenuItem>)}
                                    </Select>
                                </FormControl>
                            </Box>
                            <ToggleButtonGroup fullWidth value={viewMode} exclusive onChange={(_, newView) => newView && setViewMode(newView)} size="small"
                                               sx={{
                                                   bgcolor: isDarkMode ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)', p: 0.5, borderRadius: 8, backdropFilter: 'blur(10px)',
                                                   '& .MuiToggleButton-root': { border: 'none', borderRadius: 8, color: 'text.secondary', fontWeight: 'bold', '&.Mui-selected': { bgcolor: isDarkMode ? 'rgba(255,255,255,0.15)' : 'white', color: 'text.primary', boxShadow: isDarkMode ? 'none' : '0 2px 4px rgba(0,0,0,0.1)' } }
                                               }}>
                                <ToggleButton value="calendar"><CalendarMonthIcon sx={{ mr: 1, fontSize: 20 }} /> Naptár</ToggleButton>
                                <ToggleButton value="list"><FormatListBulletedIcon sx={{ mr: 1, fontSize: 20 }} /> Lista</ToggleButton>
                            </ToggleButtonGroup>
                        </Box>
                    </Box>

                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={2}>
                        <Box display="flex" gap={1} flexWrap="wrap">
                            <Chip label="Személyes (Saját)" size="small" sx={{ bgcolor: isDarkMode ? 'rgba(100, 116, 139, 0.2)' : '#f1f5f9', color: isDarkMode ? '#cbd5e1' : '#64748b', fontWeight: 700, borderRadius: 2 }} icon={<BlockIcon fontSize="small"/>} />
                            <Chip label="Gyűlés / Eligazítás" size="small" sx={{ bgcolor: isDarkMode ? 'rgba(147, 51, 234, 0.2)' : '#f3e5f5', color: isDarkMode ? '#d8b4fe' : '#9c27b0', fontWeight: 700, borderRadius: 2 }} icon={<RecordVoiceOverIcon fontSize="small"/>} />
                            <Chip label="Függőben" size="small" sx={{ bgcolor: isDarkMode ? 'rgba(234, 88, 12, 0.2)' : '#fff3e0', color: isDarkMode ? '#fdba74' : '#e65100', fontWeight: 700, borderRadius: 2 }} icon={<HelpOutlineIcon fontSize="small"/>} />
                            <Chip label="Elfogadva" size="small" sx={{ bgcolor: isDarkMode ? 'rgba(22, 163, 74, 0.2)' : '#e8f5e9', color: isDarkMode ? '#86efac' : '#2e7d32', fontWeight: 700, borderRadius: 2 }} icon={<CheckCircleOutlineIcon fontSize="small"/>} />
                        </Box>
                        {!isMobile && (
                            <Button
                                variant="contained" color="primary" startIcon={<AddIcon />} onClick={() => handleOpenNewPersonalModal()}
                                sx={{ borderRadius: 3, fontWeight: 'bold', boxShadow: isDarkMode ? '0 8px 20px rgba(0,0,0,0.4)' : '0 8px 20px rgba(79, 70, 229, 0.2)', px: 3 }}
                            >
                                Saját elfoglaltság
                            </Button>
                        )}
                    </Box>
                </Box>

                <Paper elevation={0} sx={{
                    p: { xs: 1, md: 2 }, borderRadius: 4,
                    flexGrow: 1, display: 'flex', flexDirection: 'column', minHeight: 0,
                    bgcolor: isDarkMode ? 'rgba(15, 23, 42, 0.2)' : 'rgba(255, 255, 255, 0.3)', backdropFilter: 'blur(30px) saturate(150%)',
                    border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.6)',
                    boxShadow: isDarkMode ? '0 8px 32px rgba(0,0,0,0.3)' : '0 8px 32px rgba(31, 38, 135, 0.05)',
                }}>
                    {loading ? (
                        <Box display="flex" justifyContent="center" alignItems="center" height="100%"><CircularProgress /></Box>
                    ) : (
                        viewMode === 'calendar' ? (
                            <Box sx={{ flexGrow: 1, minWidth: 0, minHeight: 0 }}>
                                <CustomCalendar
                                    currentDate={currentDate}
                                    events={customCalendarEvents}
                                    view={calendarView}
                                    onViewChange={(v) => setCalendarView(v)}
                                    onDateChange={setCurrentDate}
                                    onSelectSlot={handleSelectSlot}
                                    onSelectEvent={handleSelectEvent}
                                    isMobile={isMobile}
                                />
                            </Box>
                        ) : (
                            <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minHeight: 0 }}>
                                <Box sx={{ overflowY: 'auto', flexGrow: 1, pr: 1 }}>
                                    {finalShiftsForList.length === 0 ? (
                                        <Typography color="text.secondary" align="center" mt={6} variant="h6">Nincs beosztásod ebben a hónapban.</Typography>
                                    ) : (
                                        <Stack spacing={2} pt={1}>
                                            {paginatedShifts.map(shift => {
                                                let color = isDarkMode ? '#ea580c' : '#f97316';
                                                if (shift.type === 'PERSONAL') color = isDarkMode ? '#475569' : '#64748b';
                                                else if (shift.type === 'MEETING') color = isDarkMode ? '#9333ea' : '#a855f7';
                                                else if (shift.status === 'CONFIRMED') color = isDarkMode ? '#16a34a' : '#22c55e';
                                                else if (shift.status === 'MODIFICATION_REQUESTED') color = isDarkMode ? '#dc2626' : '#ef4444';

                                                let boxTitle = shift.workAreaName || 'Gyűlés';
                                                if (shift.type === 'PERSONAL') boxTitle = shift.description || 'Személyes';
                                                else if (shift.type === 'MEETING') boxTitle = shift.shiftName || 'Globális Gyűlés';
                                                else if (shift.shiftName) boxTitle = `${shift.workAreaName} - ${shift.shiftName}`;

                                                const dateInfo = renderDateRange(shift.startTime, shift.endTime);

                                                return (
                                                    <Paper key={`${shift.tenantId}-${shift.assignmentId}`} elevation={0} sx={{
                                                        p: { xs: 2, sm: 3 }, cursor: 'pointer', borderLeft: '6px solid', borderLeftColor: color, borderRadius: 3,
                                                        bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)', borderTop: '1px solid', borderRight: '1px solid', borderBottom: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#e2e8f0',
                                                        transition: 'all 0.2s', '&:hover': { transform: 'translateY(-2px)', boxShadow: isDarkMode ? '0 4px 20px rgba(0,0,0,0.4)' : '0 4px 20px rgba(0,0,0,0.05)' }
                                                    }} onClick={() => handleSelectEvent({ title: '', start: new Date(), end: new Date(), originalData: shift } as CalendarEventData)}>
                                                        <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
                                                            <Box>
                                                                <Typography variant="h6" color="text.primary" fontWeight="800">{boxTitle}</Typography>
                                                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontWeight: 600 }}>{dateInfo.time} <span style={{opacity: 0.6}}>({dateInfo.date})</span></Typography>
                                                            </Box>
                                                            <Chip label={shift.eventName || 'Személyes'} variant="outlined" size="small" sx={{ borderRadius: 2, fontWeight: 'bold' }}/>
                                                        </Box>
                                                    </Paper>
                                                );
                                            })}
                                        </Stack>
                                    )}
                                </Box>
                                {finalShiftsForList.length > ITEMS_PER_PAGE && (
                                    <Box display="flex" justifyContent="center" pt={3} pb={1} mt={2} sx={{ borderTop: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#e2e8f0' }}>
                                        <Pagination count={Math.ceil(finalShiftsForList.length / ITEMS_PER_PAGE)} page={listPage} onChange={(_, value) => setListPage(value)} color="primary" shape="rounded" />
                                    </Box>
                                )}

                                {isMobile && (
                                    <Box mt={2}>
                                        <Button fullWidth variant="contained" color="primary" sx={{ borderRadius: 3, py: 1.5, fontWeight: 'bold' }} onClick={() => handleOpenNewPersonalModal()}>
                                            + Új saját elfoglaltság
                                        </Button>
                                    </Box>
                                )}
                            </Box>
                        )
                    )}
                </Paper>

                <Dialog open={personalModalOpen} onClose={() => setPersonalModalOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, bgcolor: isDarkMode ? 'rgba(15,23,42,0.6)' : 'rgba(255,255,255,0.6)', backdropFilter: 'blur(30px) saturate(150%)', backgroundImage: 'none', border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.6)' } }}>
                    <DialogTitle sx={{ fontWeight: '900', pt: 3 }}>{isEditingPersonal ? 'Elfoglaltság Módosítása' : 'Saját Elfoglaltság Rögzítése'}</DialogTitle>
                    <DialogContent sx={{ p: {xs: 2, sm: 3}, pb: 0 }}>
                        <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
                            Ezt a bejegyzést csak te látod. A szervezőknek "Személyes elfoglaltságként" fog megjelenni (szürkén), így ide nem oszthatnak be.
                        </Alert>
                        <TextField margin="normal" label="Elfoglaltság (pl. Vizsga, Fogorvos, Nyaralás)" fullWidth value={personalData.name} onChange={(e) => setPersonalData({...personalData, name: e.target.value})} disabled={actionLoading} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}/>

                        <Box mt={2} mb={1}>
                            <FormControlLabel
                                control={<Switch color="primary" checked={personalData.isAllDay} onChange={(e) => setPersonalData({ ...personalData, isAllDay: e.target.checked })} />}
                                label={<Typography fontWeight="bold">Egész napos program / Több napos utazás</Typography>}
                            />
                        </Box>

                        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={hu}>
                            <Grid container spacing={2} mt={1}>
                                <Grid size={{xs:12, sm:6}}>
                                    <Box display="flex" flexDirection="column" gap={2}>
                                        <DatePicker
                                            label="Kezdés napja *" value={personalData.start}
                                            onChange={(newDate) => setPersonalData({ ...personalData, start: newDate })}
                                            disabled={actionLoading}
                                            slotProps={{ textField: { fullWidth: true, required: true, onClick: () => setOpenDateStart(true), sx: { '& .MuiOutlinedInput-root': { borderRadius: 3 } } } }}
                                            open={openDateStart} onClose={() => setOpenDateStart(false)} onOpen={() => setOpenDateStart(true)}
                                        />
                                        <Collapse in={!personalData.isAllDay}>
                                            <TimePicker
                                                label="Kezdés ideje *" value={personalData.start}
                                                onChange={(newTime) => setPersonalData({ ...personalData, start: newTime })}
                                                disabled={actionLoading} ampm={false} timeSteps={{ minutes: 5 }}
                                                viewRenderers={{ hours: renderTimeViewClock, minutes: renderTimeViewClock, seconds: renderTimeViewClock }}
                                                slotProps={{ textField: { fullWidth: true, required: true, onClick: () => setOpenTimeStart(true), sx: { '& .MuiOutlinedInput-root': { borderRadius: 3 } } } }}
                                                open={openTimeStart} onClose={() => setOpenTimeStart(false)} onOpen={() => setOpenTimeStart(true)}
                                            />
                                        </Collapse>
                                    </Box>
                                </Grid>

                                <Grid size={{xs:12, sm:6}}>
                                    <Box display="flex" flexDirection="column" gap={2}>
                                        <DatePicker
                                            label="Befejezés napja *" value={personalData.end} minDate={personalData.start || undefined}
                                            onChange={(newDate) => setPersonalData({ ...personalData, end: newDate })}
                                            disabled={actionLoading}
                                            slotProps={{ textField: { fullWidth: true, required: true, onClick: () => setOpenDateEnd(true), sx: { '& .MuiOutlinedInput-root': { borderRadius: 3 } } } }}
                                            open={openDateEnd} onClose={() => setOpenDateEnd(false)} onOpen={() => setOpenDateEnd(true)}
                                        />
                                        <Collapse in={!personalData.isAllDay}>
                                            <TimePicker
                                                label="Vége ideje *" value={personalData.end}
                                                onChange={(newTime) => setPersonalData({ ...personalData, end: newTime })}
                                                disabled={actionLoading} ampm={false} timeSteps={{ minutes: 5 }} minTime={isSameDay(personalData.start || new Date(), personalData.end || new Date()) ? (personalData.start || undefined) : undefined}
                                                viewRenderers={{ hours: renderTimeViewClock, minutes: renderTimeViewClock, seconds: renderTimeViewClock }}
                                                slotProps={{ textField: { fullWidth: true, required: true, onClick: () => setOpenTimeEnd(true), sx: { '& .MuiOutlinedInput-root': { borderRadius: 3 } } } }}
                                                open={openTimeEnd} onClose={() => setOpenTimeEnd(false)} onOpen={() => setOpenTimeEnd(true)}
                                            />
                                        </Collapse>
                                    </Box>
                                </Grid>
                            </Grid>
                        </LocalizationProvider>
                    </DialogContent>
                    <DialogActions sx={{ p: 3, pt: 3 }}>
                        <Button onClick={() => setPersonalModalOpen(false)} color="inherit" disabled={actionLoading} sx={{ fontWeight: 'bold' }}>Mégse</Button>
                        <Button onClick={handleSavePersonalShift} variant="contained" disabled={actionLoading || !personalData.start || !personalData.end || !personalData.name.trim()} sx={{ borderRadius: 3, fontWeight: 'bold', px: 3 }} disableElevation>
                            Mentés
                        </Button>
                    </DialogActions>
                </Dialog>

                <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, bgcolor: isDarkMode ? 'rgba(15,23,42,0.6)' : 'rgba(255,255,255,0.6)', backdropFilter: 'blur(30px) saturate(150%)', backgroundImage: 'none', overflow: 'hidden', border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.6)' } }}>
                    <Box sx={{ bgcolor: selectedShift?.type === 'PERSONAL' ? (isDarkMode ? 'rgba(51, 65, 85, 0.5)' : 'rgba(100, 116, 139, 0.5)') : (isDarkMode ? 'rgba(79, 70, 229, 0.5)' : 'rgba(79, 70, 229, 0.6)'), color: 'white', p: 3, backdropFilter: 'blur(10px)' }}>
                        <Typography variant="h5" fontWeight="900">
                            {selectedShift?.type === 'PERSONAL' ? <><BlockIcon sx={{ verticalAlign: 'bottom', mr: 1 }}/> {selectedShift.description}</> : (selectedShift?.shiftName || selectedShift?.workAreaName || 'Globális Gyűlés')}
                        </Typography>
                        {selectedShift?.type !== 'PERSONAL' && <Typography variant="subtitle2" sx={{ opacity: 0.8, mt: 0.5 }}>Esemény: {selectedShift?.eventName}</Typography>}
                    </Box>
                    <DialogContent sx={{ mt: 2, p: 3 }}>
                        {selectedShift && (
                            <>
                                {selectedShift.type === 'PERSONAL' ? (
                                    <Alert severity="info" sx={{ borderRadius: 2 }}>Ez egy általad rögzített személyes elfoglaltság. Ezt az időpontot a szervezők is látják szürkén.</Alert>
                                ) : (
                                    <>
                                        <Typography variant="subtitle2" fontWeight="800" color="text.secondary" gutterBottom textTransform="uppercase" sx={{ fontSize: '0.75rem', letterSpacing: 1 }}>Kivel leszel beosztva?</Typography>
                                        {selectedShift.coWorkers && selectedShift.coWorkers.length > 0 ? (
                                            <Box display="flex" flexWrap="wrap" gap={1} mb={4}>
                                                {selectedShift.coWorkers.map((name, idx) => <Chip key={idx} label={name} avatar={<Avatar>{name.charAt(0)}</Avatar>} sx={{ fontWeight: 'bold', borderRadius: 2 }} />)}
                                            </Box>
                                        ) : (
                                            <Typography variant="body2" color="text.disabled" mb={4} fontStyle="italic">Egyelőre csak te vagy beosztva.</Typography>
                                        )}
                                        <Divider sx={{ mb: 3, borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider' }} />

                                        {selectedShift.status === 'CONFIRMED' && <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }}>Ezt a beosztást már elfogadtad. Köszönjük!</Alert>}
                                        {selectedShift.status === 'MODIFICATION_REQUESTED' && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>Módosítást kértél.</Alert>}
                                        {selectedShift.status === 'PENDING' && <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>Kérlek, jelezd a szervezőknek, hogy számíthatnak-e rád!</Alert>}

                                        <Box mb={2}>
                                            <Typography variant="subtitle2" fontWeight="800" color="text.secondary" gutterBottom textTransform="uppercase" sx={{ fontSize: '0.75rem', letterSpacing: 1 }}>Üzenet a szervezőknek</Typography>
                                            <TextField fullWidth multiline rows={2} placeholder="Opcionális megjegyzés..." value={changeMessage} onChange={(e) => setChangeMessage(e.target.value)} disabled={actionLoading} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}/>
                                        </Box>
                                    </>
                                )}

                                <Box bgcolor={isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.3)'} p={2.5} borderRadius={3} mt={3} border="1px solid" borderColor={isDarkMode ? 'rgba(255,255,255,0.05)' : '#e2e8f0'} display="flex" alignItems="center" gap={2}>
                                    <Avatar sx={{ bgcolor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'white', color: 'text.primary' }}><CalendarMonthIcon /></Avatar>
                                    <Box>
                                        <Typography variant="body2" color="text.secondary" fontWeight="bold">Időtartam:</Typography>
                                        <Typography variant="body1" fontWeight="900" color="text.primary">
                                            {renderDateRange(selectedShift.startTime, selectedShift.endTime).time}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {renderDateRange(selectedShift.startTime, selectedShift.endTime).date}
                                        </Typography>
                                    </Box>
                                </Box>
                            </>
                        )}
                    </DialogContent>
                    <DialogActions sx={{ p: 2, px: 3, bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)', borderTop: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#e2e8f0', display: 'flex', flexDirection: { xs: 'column-reverse', sm: 'row' }, gap: 1.5, justifyContent: 'space-between' }}>
                        <Button onClick={() => setModalOpen(false)} color="inherit" sx={{ fontWeight: 'bold', width: { xs: '100%', sm: 'auto' } }} disabled={actionLoading}>Bezárás</Button>
                        <Box display="flex" gap={1.5} flexDirection={{ xs: 'column', sm: 'row' }} sx={{ width: { xs: '100%', sm: 'auto' } }}>
                            {selectedShift?.type === 'PERSONAL' ? (
                                <>
                                    <Button variant="outlined" color="primary" startIcon={<EditIcon />} sx={{ width: { xs: '100%', sm: 'auto' }, borderRadius: 2, fontWeight: 'bold' }} onClick={handleEditPersonalShift} disabled={actionLoading}>Szerkesztés</Button>
                                    <Button variant="contained" color="error" startIcon={<DeleteOutlineIcon />} sx={{ width: { xs: '100%', sm: 'auto' }, borderRadius: 2, fontWeight: 'bold' }} disableElevation onClick={() => setDeleteConfirmOpen(true)} disabled={actionLoading}>Törlés</Button>
                                </>
                            ) : selectedShift?.status === 'CONFIRMED' ? (
                                <>
                                    <Button variant="outlined" color="error" sx={{ width: { xs: '100%', sm: 'auto' }, borderRadius: 2, fontWeight: 'bold' }} onClick={() => handleUpdateStatus('MODIFICATION_REQUESTED')} disabled={actionLoading || !changeMessage.trim()}>Mégsem tudok menni</Button>
                                    <Button variant="contained" color="primary" sx={{ width: { xs: '100%', sm: 'auto' }, borderRadius: 2, fontWeight: 'bold' }} disableElevation onClick={() => handleUpdateStatus('CONFIRMED')} disabled={actionLoading || changeMessage === (selectedShift?.message || '')}>Üzenet frissítése</Button>
                                </>
                            ) : (
                                <>
                                    <Button variant="outlined" color="error" sx={{ width: { xs: '100%', sm: 'auto' }, borderRadius: 2, fontWeight: 'bold' }} onClick={() => handleUpdateStatus('MODIFICATION_REQUESTED')} disabled={actionLoading || !changeMessage.trim()}>Probléma van / Nem jó</Button>
                                    <Button variant="contained" color="success" startIcon={<CheckCircleOutlineIcon />} sx={{ width: { xs: '100%', sm: 'auto' }, borderRadius: 2, fontWeight: 'bold' }} disableElevation onClick={() => handleUpdateStatus('CONFIRMED')} disabled={actionLoading}>Elfogadom</Button>
                                </>
                            )}
                        </Box>
                    </DialogActions>
                </Dialog>

                <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 4, bgcolor: isDarkMode ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.95)', backdropFilter: 'blur(30px) saturate(150%)', border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' } }}>
                    <DialogTitle sx={{ fontWeight: '900', color: theme.palette.error.main, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <DeleteOutlineIcon /> Törlés megerősítése
                    </DialogTitle>
                    <DialogContent>
                        <Typography variant="body1">Biztosan törlöd ezt a személyes bejegyzést?</Typography>
                    </DialogContent>
                    <DialogActions sx={{ p: 2, px: 3 }}>
                        <Button onClick={() => setDeleteConfirmOpen(false)} color="inherit" sx={{ fontWeight: 'bold' }} disabled={actionLoading}>Mégse</Button>
                        <Button onClick={executeDeletePersonalShift} variant="contained" color="error" sx={{ borderRadius: 2, fontWeight: 'bold' }} disableElevation disabled={actionLoading}>Törlés</Button>
                    </DialogActions>
                </Dialog>

            </Container>
        </Fade>
    );
}