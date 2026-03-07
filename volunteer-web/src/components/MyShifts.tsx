import { useEffect, useState, useMemo } from 'react';
import {
    Container, Typography, Box, Paper, Button, CircularProgress,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField,
    Chip, Divider, Avatar, Alert, ToggleButton, ToggleButtonGroup,
    FormControl, InputLabel, Select, MenuItem, IconButton, Pagination,
    useTheme, useMediaQuery, Popover, InputAdornment
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

// Naptár és Típus importok
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import type { Event as CalendarEvent, View, ToolbarProps } from 'react-big-calendar';

import {
    format, parse, startOfWeek, getDay, startOfMonth, endOfMonth,
    eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, endOfWeek
} from 'date-fns';
import { hu } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';

import api from '../api/axios';

const locales = { 'hu': hu };
const localizer = dateFnsLocalizer({
    format, parse, startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }), getDay, locales,
});

interface MyShiftDTO {
    assignmentId: number;
    shiftId: number;
    eventName: string;
    workAreaName: string;
    startTime: string;
    endTime: string;
    status: 'PENDING' | 'CONFIRMED' | 'MODIFICATION_REQUESTED';
    message?: string;
    coWorkers: string[];
}

interface ShiftCalendarEvent extends CalendarEvent {
    resource: MyShiftDTO;
}

// --- ASZTALI NAPTÁR FEJLÉC ---
const CustomToolbar = (toolbar: ToolbarProps<ShiftCalendarEvent>) => {
    const goToBack = () => toolbar.onNavigate('PREV');
    const goToNext = () => toolbar.onNavigate('NEXT');
    const goToCurrent = () => toolbar.onNavigate('TODAY');

    return (
        <Box display="flex" flexWrap="wrap" justifyContent="space-between" alignItems="center" mb={3} gap={2}>
            <Button variant="outlined" onClick={goToCurrent} size="small" sx={{ fontWeight: 'bold' }}>Ma</Button>
            <Box display="flex" alignItems="center" gap={1}>
                <IconButton onClick={goToBack} color="primary" sx={{ bgcolor: '#f1f5f9' }}><ChevronLeftIcon /></IconButton>
                <Typography variant="h6" fontWeight="bold" sx={{ minWidth: 160, textAlign: 'center', textTransform: 'capitalize' }}>
                    {toolbar.label}
                </Typography>
                <IconButton onClick={goToNext} color="primary" sx={{ bgcolor: '#f1f5f9' }}><ChevronRightIcon /></IconButton>
            </Box>
            <ToggleButtonGroup value={toolbar.view} exclusive onChange={(_, newView) => newView && toolbar.onView(newView)} size="small">
                <ToggleButton value="month">Hónap</ToggleButton>
                <ToggleButton value="week">Hét</ToggleButton>
                <ToggleButton value="day">Nap</ToggleButton>
                <ToggleButton value="agenda">Napló</ToggleButton>
            </ToggleButtonGroup>
        </Box>
    );
};

export default function MyShifts() {
    const [shifts, setShifts] = useState<MyShiftDTO[]>([]);
    const [loading, setLoading] = useState(true);

    const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
    const [selectedEventFilter, setSelectedEventFilter] = useState<string>('all');

    const [currentDate, setCurrentDate] = useState(new Date());
    const [currentView, setCurrentView] = useState<View>('month');
    const [listPage, setListPage] = useState(1);
    const ITEMS_PER_PAGE = 5;

    // PRÉMIUM HÓNAPVÁLASZTÓ ÁLLAPOTAI
    const [monthPickerAnchor, setMonthPickerAnchor] = useState<HTMLDivElement | null>(null);
    const [pickerYear, setPickerYear] = useState(currentDate.getFullYear());
    const monthNames = ['Január', 'Február', 'Március', 'Április', 'Május', 'Június', 'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December'];

    const navigate = useNavigate();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const [selectedShift, setSelectedShift] = useState<MyShiftDTO | null>(null);
    const [modalOpen, setModalOpen] = useState(false);

    const [changeMessage, setChangeMessage] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        fetchMyShifts();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        setListPage(1);
    }, [currentDate, selectedEventFilter]);

    const fetchMyShifts = async () => {
        try {
            setLoading(true);
            const response = await api.get('/events/my-shifts');
            const fetchedShifts: MyShiftDTO[] = response.data;
            setShifts(fetchedShifts);

            if (fetchedShifts.length > 0) {
                const now = new Date().getTime();
                const upcomingShifts = fetchedShifts.filter(s => new Date(s.endTime).getTime() > now);
                if (upcomingShifts.length > 0) {
                    const sortedUpcoming = upcomingShifts.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
                    setCurrentDate(new Date(sortedUpcoming[0].startTime));
                } else {
                    const sortedPast = [...fetchedShifts].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
                    setCurrentDate(new Date(sortedPast[0].startTime));
                }
            }
        } catch (error) {
            console.error("Hiba a műszakok betöltésekor:", error);
        } finally {
            setLoading(false);
        }
    };

    const uniqueEvents = useMemo(() => Array.from(new Set(shifts.map(s => s.eventName))).sort(), [shifts]);

    const filteredShifts = useMemo(() => {
        if (selectedEventFilter === 'all') return shifts;
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

    const calendarEvents: ShiftCalendarEvent[] = filteredShifts.map(shift => ({
        title: `${shift.workAreaName} (${shift.eventName})`,
        start: new Date(shift.startTime),
        end: new Date(shift.endTime),
        resource: shift
    }));

    const eventStyleGetter = (event: ShiftCalendarEvent) => {
        let backgroundColor = '#3174ad';
        if (event.resource.status === 'CONFIRMED') backgroundColor = '#2e7d32';
        if (event.resource.status === 'PENDING') backgroundColor = '#ed6c02';
        if (event.resource.status === 'MODIFICATION_REQUESTED') backgroundColor = '#d32f2f';
        return { style: { backgroundColor, borderRadius: '5px', opacity: 0.9, color: 'white', border: '0px', display: 'block' } };
    };

    const handleSelectEvent = (event: ShiftCalendarEvent) => {
        setSelectedShift(event.resource);
        setChangeMessage(event.resource.message || '');
        setModalOpen(true);
    };

    const handleUpdateStatus = async (newStatus: 'CONFIRMED' | 'MODIFICATION_REQUESTED') => {
        if (!selectedShift) return;
        setActionLoading(true);
        try {
            await api.put(`/shifts/assignments/${selectedShift.assignmentId}/status`, {
                status: newStatus,
                message: changeMessage
            });
            setModalOpen(false);
            fetchMyShifts();
        } catch (error) {
            console.error("Hiba:", error);
            alert("Hiba a művelet során.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleNavigate = (newDate: Date) => {
        setCurrentDate(newDate);
    };

    const mobileMonthStart = startOfMonth(currentDate);
    const mobileMonthEnd = endOfMonth(mobileMonthStart);
    const mobileStartDate = startOfWeek(mobileMonthStart, { weekStartsOn: 1 });
    const mobileEndDate = endOfWeek(mobileMonthEnd, { weekStartsOn: 1 });
    const mobileCalendarDays = eachDayOfInterval({ start: mobileStartDate, end: mobileEndDate });

    return (
        <Container component="main" maxWidth="lg" sx={{ mt: 4, mb: 10 }}>
            <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/dashboard')} sx={{ mb: 2 }}>
                Vissza a Dashboardra
            </Button>

            {/* --- JAVÍTOTT, ATOMBZITOS FEJLÉC ELRENDEZÉS --- */}
            <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'flex-start' }} gap={3} mb={4}>

                {/* BAL OLDAL: Címsor */}
                <Box sx={{ flex: 1 }}>
                    <Typography component="h1" variant="h4" fontWeight="900" color="primary.main" sx={{ fontSize: { xs: '2rem', sm: '2.125rem' }, display: 'flex', alignItems: 'center', gap: 1 }}>
                        Saját Műszakjaim <span>📅</span>
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
                        Itt kezelheted a beosztásaidat. Kérlek, igazold vissza a függőben lévőket!
                    </Typography>
                </Box>

                {/* JOBB OLDAL: Szűrők (Vezérlőpult) */}
                <Box display="flex" flexDirection="column" gap={1.5} sx={{ width: { xs: '100%', md: '450px' } }}>

                    {/* 1. Sor: Hónapválasztó és Eseményszűrő EGYMÁS MELLETT (50-50%) */}
                    <Box display="flex" gap={1.5} sx={{ width: '100%' }}>

                        {/* Hónapválasztó (Balra) */}
                        <Box sx={{ flex: 1 }}>
                            <TextField
                                fullWidth
                                label="Ugrás hónapra"
                                value={format(currentDate, 'yyyy. MMMM', { locale: hu })}
                                size="small"
                                onClick={(e) => {
                                    setMonthPickerAnchor(e.currentTarget);
                                    setPickerYear(currentDate.getFullYear());
                                }}
                                InputProps={{
                                    readOnly: true,
                                    startAdornment: <InputAdornment position="start"><CalendarMonthIcon color="action" fontSize="small" /></InputAdornment>,
                                    style: { cursor: 'pointer', textTransform: 'capitalize' }
                                }}
                                InputLabelProps={{ shrink: true }}
                                sx={{ bgcolor: 'white' }}
                            />

                            <Popover
                                open={Boolean(monthPickerAnchor)}
                                anchorEl={monthPickerAnchor}
                                onClose={() => setMonthPickerAnchor(null)}
                                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                                PaperProps={{ sx: { borderRadius: 3, mt: 0.5, boxShadow: 3 } }}
                            >
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
                                                <Button
                                                    key={month} size="small" variant={isCurrent ? "contained" : "text"} disableElevation
                                                    sx={{
                                                        borderRadius: 2, color: isCurrent ? 'white' : 'text.primary', textTransform: 'capitalize',
                                                        '&:hover': { bgcolor: isCurrent ? 'primary.dark' : '#f1f5f9' }
                                                    }}
                                                    onClick={() => {
                                                        setCurrentDate(new Date(pickerYear, index, 1));
                                                        setMonthPickerAnchor(null);
                                                    }}
                                                >
                                                    {month.substring(0, 3)}
                                                </Button>
                                            );
                                        })}
                                    </Box>
                                </Box>
                            </Popover>
                        </Box>

                        {/* Esemény szűrő (Jobbra) */}
                        <FormControl size="small" sx={{ flex: 1, bgcolor: 'white' }}>
                            <InputLabel>Esemény szűrő</InputLabel>
                            <Select value={selectedEventFilter} label="Esemény szűrő" onChange={(e) => setSelectedEventFilter(e.target.value)}>
                                <MenuItem value="all">Minden Esemény</MenuItem>
                                {uniqueEvents.map(eventName => <MenuItem key={eventName} value={eventName}>{eventName}</MenuItem>)}
                            </Select>
                        </FormControl>
                    </Box>

                    {/* 2. Sor: Naptár / Lista váltó */}
                    <ToggleButtonGroup
                        fullWidth
                        value={viewMode} exclusive onChange={(_, newView) => newView && setViewMode(newView)} size="small"
                        sx={{ bgcolor: 'white' }}
                    >
                        <ToggleButton value="calendar"><CalendarMonthIcon sx={{ mr: 1 }} /> Naptár</ToggleButton>
                        <ToggleButton value="list"><FormatListBulletedIcon sx={{ mr: 1 }} /> Lista</ToggleButton>
                    </ToggleButtonGroup>
                </Box>
            </Box>

            <Box display="flex" gap={2} mb={3} flexWrap="wrap">
                <Chip icon={<HelpOutlineIcon />} label="Függőben (Megerősítésre vár)" sx={{ bgcolor: '#fff3e0', color: '#e65100' }} />
                <Chip icon={<CheckCircleOutlineIcon />} label="Elfogadva" sx={{ bgcolor: '#e8f5e9', color: '#2e7d32' }} />
                <Chip label="Módosítást kértél" sx={{ bgcolor: '#ffebee', color: '#c62828' }} />
            </Box>

            <Paper elevation={3} sx={{ p: 2, borderRadius: 3, height: { xs: 'auto', md: '70vh' }, minHeight: { md: '600px' }, display: 'flex', flexDirection: 'column' }}>
                {loading ? (
                    <Box display="flex" justifyContent="center" alignItems="center" height="300px"><CircularProgress /></Box>
                ) : (
                    viewMode === 'calendar' ? (
                        isMobile ? (
                            /* --- SAMSUNG-STÍLUSÚ MOBIL NAPTÁR --- */
                            <Box display="flex" flexDirection="column" height="100%">
                                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                                    <IconButton onClick={() => setCurrentDate(subMonths(currentDate, 1))}><ChevronLeftIcon /></IconButton>
                                    <Typography fontWeight="bold" textTransform="capitalize" variant="h6">
                                        {format(currentDate, 'yyyy. MMMM', { locale: hu })}
                                    </Typography>
                                    <IconButton onClick={() => setCurrentDate(addMonths(currentDate, 1))}><ChevronRightIcon /></IconButton>
                                </Box>

                                <Box display="grid" gridTemplateColumns="repeat(7, 1fr)" mb={1}>
                                    {['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'].map(day => (
                                        <Typography key={day} align="center" variant="caption" color="text.secondary" fontWeight="bold">{day}</Typography>
                                    ))}
                                </Box>

                                <Box display="grid" gridTemplateColumns="repeat(7, 1fr)" gap={0.5} mb={2}>
                                    {mobileCalendarDays.map(day => {
                                        const isSelected = isSameDay(day, currentDate);
                                        const isCurrentMonth = isSameMonth(day, currentDate);
                                        const isToday = isSameDay(day, new Date());
                                        const dayShifts = filteredShifts.filter(s => isSameDay(new Date(s.startTime), day));

                                        return (
                                            <Box
                                                key={day.toISOString()}
                                                onClick={() => setCurrentDate(day)}
                                                sx={{
                                                    display: 'flex', flexDirection: 'column', alignItems: 'center', p: 1,
                                                    cursor: 'pointer', borderRadius: 3,
                                                    bgcolor: isSelected ? 'primary.main' : isToday ? '#e2e8f0' : 'transparent',
                                                    color: isSelected ? 'white' : isCurrentMonth ? 'text.primary' : 'text.disabled',
                                                    '&:hover': { bgcolor: isSelected ? 'primary.dark' : '#f8fafc' }
                                                }}
                                            >
                                                <Typography variant="body2" fontWeight={isSelected || isToday ? 'bold' : 'normal'}>
                                                    {format(day, 'd')}
                                                </Typography>
                                                <Box display="flex" gap={0.5} mt={0.5} height={6}>
                                                    {dayShifts.slice(0, 3).map((s, i) => (
                                                        <Box key={i} sx={{
                                                            width: 6, height: 6, borderRadius: '50%',
                                                            bgcolor: s.status === 'CONFIRMED' ? (isSelected ? '#a5d6a7' : '#2e7d32') :
                                                                s.status === 'PENDING' ? (isSelected ? '#ffcc80' : '#ed6c02') :
                                                                    (isSelected ? '#ef9a9a' : '#d32f2f')
                                                        }} />
                                                    ))}
                                                </Box>
                                            </Box>
                                        );
                                    })}
                                </Box>

                                <Divider sx={{ mb: 2 }} />

                                <Typography variant="subtitle1" fontWeight="bold" mb={2} color="primary.main">
                                    Teendők: {format(currentDate, 'MMMM d.', { locale: hu })}
                                </Typography>

                                <Box sx={{ overflowY: 'auto', flexGrow: 1, pr: 1, maxHeight: '300px' }}>
                                    {filteredShifts.filter(s => isSameDay(new Date(s.startTime), currentDate)).length === 0 ? (
                                        <Typography color="text.secondary" align="center" fontStyle="italic" mt={2}>Nincs teendőd ezen a napon.</Typography>
                                    ) : (
                                        filteredShifts.filter(s => isSameDay(new Date(s.startTime), currentDate)).map(shift => (
                                            <Paper key={shift.assignmentId} variant="outlined" sx={{ p: 2, mb: 2, cursor: 'pointer', borderLeft: '6px solid', borderLeftColor: shift.status === 'CONFIRMED' ? '#2e7d32' : shift.status === 'PENDING' ? '#ed6c02' : '#d32f2f' }} onClick={() => handleSelectEvent({ title: '', start: new Date(), end: new Date(), resource: shift })}>
                                                <Typography variant="h6" color="primary" fontWeight="bold">{shift.workAreaName}</Typography>
                                                <Typography variant="subtitle2" color="text.secondary">{shift.eventName}</Typography>
                                                <Typography variant="body1" sx={{ mt: 1 }}>{new Date(shift.startTime).toLocaleTimeString('hu-HU')} - {new Date(shift.endTime).toLocaleTimeString('hu-HU')}</Typography>
                                            </Paper>
                                        ))
                                    )}
                                </Box>
                            </Box>
                        ) : (
                            /* --- ASZTALI NAPTÁR --- */
                            <Box sx={{ flexGrow: 1, overflowX: 'auto' }}>
                                <Calendar
                                    localizer={localizer}
                                    events={calendarEvents}
                                    startAccessor="start" endAccessor="end"
                                    culture="hu"
                                    date={currentDate}
                                    onNavigate={handleNavigate}
                                    view={currentView}
                                    onView={(newView) => setCurrentView(newView)}
                                    selectable={true}
                                    onSelectSlot={(slotInfo) => {
                                        setCurrentDate(slotInfo.start);
                                        setCurrentView('day');
                                    }}
                                    onDrillDown={(date) => {
                                        setCurrentDate(date);
                                        setCurrentView('day');
                                    }}
                                    components={{ toolbar: CustomToolbar }}
                                    messages={{ noEventsInRange: "Nincs műszak.", showMore: (total) => `+${total} további` }}
                                    onSelectEvent={handleSelectEvent}
                                    eventPropGetter={eventStyleGetter}
                                    style={{ minWidth: 800, height: '100%', fontFamily: 'inherit' }}
                                />
                            </Box>
                        )
                    ) : (
                        /* --- LISTA NÉZET --- */
                        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                            <Box sx={{ overflowY: 'auto', flexGrow: 1, pr: 1 }}>
                                {finalShiftsForList.length === 0 ? (
                                    <Typography color="text.secondary" align="center" mt={4}>Nincs beosztásod ebben a hónapban.</Typography>
                                ) : (
                                    paginatedShifts.map(shift => (
                                        <Paper key={shift.assignmentId} variant="outlined" sx={{ p: 2, mb: 2, cursor: 'pointer', '&:hover': { bgcolor: '#f8fafc' }, borderLeft: '6px solid', borderLeftColor: shift.status === 'CONFIRMED' ? '#2e7d32' : shift.status === 'PENDING' ? '#ed6c02' : '#d32f2f' }} onClick={() => handleSelectEvent({ title: '', start: new Date(), end: new Date(), resource: shift })}>
                                            <Typography variant="h6" color="primary" fontWeight="bold">{shift.workAreaName}</Typography>
                                            <Typography variant="subtitle2" color="text.secondary">{shift.eventName}</Typography>
                                            <Typography variant="body1" sx={{ mt: 1 }}>{new Date(shift.startTime).toLocaleString('hu-HU')} - {new Date(shift.endTime).toLocaleTimeString('hu-HU')}</Typography>
                                        </Paper>
                                    ))
                                )}
                            </Box>
                            {finalShiftsForList.length > ITEMS_PER_PAGE && (
                                <Box display="flex" justifyContent="center" pt={2} pb={1} mt={1} sx={{ borderTop: '1px solid #e2e8f0' }}>
                                    <Pagination count={Math.ceil(finalShiftsForList.length / ITEMS_PER_PAGE)} page={listPage} onChange={(_, value) => setListPage(value)} color="primary" />
                                </Box>
                            )}
                        </Box>
                    )
                )}
            </Paper>

            {/* --- JAVÍTOTT MODAL --- */}
            <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
                <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 'bold' }}>Műszak Részletei</DialogTitle>
                <DialogContent sx={{ mt: 2 }}>
                    {selectedShift && (
                        <>
                            <Typography variant="h5" fontWeight="900" gutterBottom>{selectedShift.workAreaName}</Typography>
                            <Typography variant="subtitle1" color="text.secondary" gutterBottom>Esemény: {selectedShift.eventName}</Typography>

                            <Box bgcolor="#f1f5f9" p={2} borderRadius={2} mt={2} mb={3}>
                                <Typography variant="body1" fontWeight="bold">Időpont:</Typography>
                                <Typography variant="body1">Kezdés: {new Date(selectedShift.startTime).toLocaleString('hu-HU')} <br /> Vége: {new Date(selectedShift.endTime).toLocaleString('hu-HU')}</Typography>
                            </Box>

                            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Kivel leszel beosztva?</Typography>
                            {selectedShift.coWorkers && selectedShift.coWorkers.length > 0 ? (
                                <Box display="flex" flexWrap="wrap" gap={1} mb={3}>
                                    {selectedShift.coWorkers.map((name, idx) => <Chip key={idx} label={name} avatar={<Avatar>{name.charAt(0)}</Avatar>} />)}
                                </Box>
                            ) : (
                                <Typography variant="body2" color="text.secondary" mb={3} fontStyle="italic">Egyelőre csak te vagy beosztva.</Typography>
                            )}

                            <Divider sx={{ mb: 3 }} />

                            {selectedShift.status === 'CONFIRMED' && <Alert severity="success" sx={{ mb: 2 }}>Ezt a műszakot már elfogadtad. Köszönjük!</Alert>}
                            {selectedShift.status === 'MODIFICATION_REQUESTED' && <Alert severity="error" sx={{ mb: 2 }}>Módosítást / lemondást kértél erre a műszakra.</Alert>}
                            {selectedShift.status === 'PENDING' && <Alert severity="warning" sx={{ mb: 2 }}>Kérlek, jelezd a szervezőknek, hogy számíthatnak-e rád!</Alert>}

                            <Box mt={2}>
                                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                                    Üzenet a szervezőknek (opcionális, pl.: "Késem 10 percet...")
                                </Typography>
                                <TextField
                                    fullWidth multiline rows={2}
                                    placeholder="Írd ide az üzeneted..."
                                    value={changeMessage}
                                    onChange={(e) => setChangeMessage(e.target.value)}
                                    disabled={actionLoading}
                                />
                            </Box>
                        </>
                    )}
                </DialogContent>

                {/* TÖKÉLETESÍTETT GOMBSOR */}
                <DialogActions sx={{
                    p: 2, px: 3, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0',
                    display: 'flex', flexDirection: { xs: 'column-reverse', sm: 'row' }, gap: 1.5, justifyContent: 'space-between'
                }}>

                    <Button
                        onClick={() => setModalOpen(false)}
                        color="inherit"
                        sx={{ fontWeight: 'bold', width: { xs: '100%', sm: 'auto' } }}
                        disabled={actionLoading}
                    >
                        Bezárás
                    </Button>

                    <Box display="flex" gap={1.5} flexDirection={{ xs: 'column', sm: 'row' }} sx={{ width: { xs: '100%', sm: 'auto' } }}>
                        {selectedShift?.status === 'CONFIRMED' ? (
                            <>
                                <Button
                                    variant="outlined" color="error"
                                    sx={{ width: { xs: '100%', sm: 'auto' } }} // <-- JAVÍTVA
                                    onClick={() => handleUpdateStatus('MODIFICATION_REQUESTED')}
                                    disabled={actionLoading || !changeMessage.trim()}
                                >
                                    Mégsem tudok menni
                                </Button>
                                <Button
                                    variant="contained" color="primary"
                                    sx={{ width: { xs: '100%', sm: 'auto' } }} // <-- JAVÍTVA
                                    onClick={() => handleUpdateStatus('CONFIRMED')}
                                    disabled={actionLoading || changeMessage === (selectedShift?.message || '')}
                                >
                                    Üzenet frissítése
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button
                                    variant="outlined" color="error"
                                    sx={{ width: { xs: '100%', sm: 'auto' } }} // <-- JAVÍTVA
                                    onClick={() => handleUpdateStatus('MODIFICATION_REQUESTED')}
                                    disabled={actionLoading || !changeMessage.trim()}
                                >
                                    Probléma van / Nem jó
                                </Button>
                                <Button
                                    variant="contained" color="success" startIcon={<CheckCircleOutlineIcon />}
                                    sx={{ width: { xs: '100%', sm: 'auto' } }} // <-- JAVÍTVA
                                    onClick={() => handleUpdateStatus('CONFIRMED')}
                                    disabled={actionLoading}
                                >
                                    Elfogadom a műszakot
                                </Button>
                            </>
                        )}
                    </Box>
                </DialogActions>
            </Dialog>
        </Container>
    );
}