import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Box, Typography, IconButton, Paper, useTheme, alpha, ToggleButtonGroup, ToggleButton, Button } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import {
    format, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
    eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths,
    addWeeks, subWeeks, addDays, subDays
} from 'date-fns';
import { hu } from 'date-fns/locale';

export interface CalendarEventData {
    id: string | number;
    title: string;
    start: Date;
    end: Date;
    color?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    originalData?: any;
}

export interface ExtendedCalendarEventData extends CalendarEventData {
    spanType?: 'single' | 'start' | 'middle' | 'end';
    renderType?: 'spanner' | 'spacer';
    span?: number;
}

interface CustomCalendarProps {
    currentDate: Date;
    events: CalendarEventData[];
    view: 'month' | 'week' | 'day';
    onViewChange: (view: 'month' | 'week' | 'day') => void;
    onDateChange: (date: Date) => void;
    onSelectSlot: (date: Date) => void;
    onSelectEvent: (event: CalendarEventData) => void;
    isMobile: boolean;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT = 60;

export default function CustomCalendar({
                                           currentDate, events, view, onViewChange, onDateChange, onSelectSlot, onSelectEvent, isMobile
                                       }: CustomCalendarProps) {
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';
    const timeGridRef = useRef<HTMLDivElement>(null);

    const [selectedDate, setSelectedDate] = useState<Date>(currentDate);
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (view !== 'month' && timeGridRef.current) {
            const currentHour = now.getHours();
            const scrollAmount = Math.max(0, (currentHour - 2) * HOUR_HEIGHT);
            timeGridRef.current.scrollTop = scrollAmount;
        }
    }, [view, now]);

    useEffect(() => {
        if (isMobile && view !== 'month') {
            onViewChange('month');
        }
    }, [isMobile, view, onViewChange]);

    const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('left');
    const [animKey, setAnimKey] = useState(0);
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);
    const minSwipeDistance = 50;

    const navigateTo = (newDate: Date, direction: 'left' | 'right') => {
        setSlideDirection(direction);
        setAnimKey(prev => prev + 1);
        onDateChange(newDate);
    };

    const handlePrev = () => {
        if (view === 'month') navigateTo(subMonths(currentDate, 1), 'right');
        else if (view === 'week') navigateTo(subWeeks(currentDate, 1), 'right');
        else navigateTo(subDays(currentDate, 1), 'right');
    };

    const handleNext = () => {
        if (view === 'month') navigateTo(addMonths(currentDate, 1), 'left');
        else if (view === 'week') navigateTo(addWeeks(currentDate, 1), 'left');
        else navigateTo(addDays(currentDate, 1), 'left');
    };

    const handleToday = () => {
        const today = new Date();
        navigateTo(today, today > currentDate ? 'left' : 'right');
        setSelectedDate(today);
    };

    const onTouchStartEvent = (e: React.TouchEvent) => { e.stopPropagation(); setTouchEnd(null); setTouchStart(e.targetTouches[0].clientX); };
    const onTouchMoveEvent = (e: React.TouchEvent) => { e.stopPropagation(); setTouchEnd(e.targetTouches[0].clientX); };
    const onTouchEndEvent = (e: React.TouchEvent) => {
        e.stopPropagation();
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        if (distance > minSwipeDistance) handleNext();
        if (distance < -minSwipeDistance) handlePrev();
        setTouchStart(null); setTouchEnd(null);
    };

    const calendarDays = useMemo(() => {
        let start, end;
        if (view === 'month') {
            start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
            end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
        } else if (view === 'week') {
            start = startOfWeek(currentDate, { weekStartsOn: 1 });
            end = endOfWeek(currentDate, { weekStartsOn: 1 });
        } else {
            start = currentDate;
            end = currentDate;
        }
        return eachDayOfInterval({ start, end });
    }, [currentDate, view]);

    const eventsByDay = useMemo(() => {
        const sortedEvents = [...events].sort((a, b) => {
            const timeDiff = a.start.getTime() - b.start.getTime();
            if (timeDiff !== 0) return timeDiff;
            return (b.end.getTime() - b.start.getTime()) - (a.end.getTime() - a.start.getTime());
        });

        const map = new Map<string, ExtendedCalendarEventData[]>();
        calendarDays.forEach(day => map.set(format(day, 'yyyy-MM-dd'), []));

        sortedEvents.forEach(event => {
            let effectiveEnd = event.end;
            if (effectiveEnd.getHours() === 0 && effectiveEnd.getMinutes() === 0 && effectiveEnd.getTime() > event.start.getTime()) {
                effectiveEnd = new Date(effectiveEnd.getTime() - 1000);
            }

            const startDay = new Date(event.start.getFullYear(), event.start.getMonth(), event.start.getDate());
            const endDay = new Date(effectiveEnd.getFullYear(), effectiveEnd.getMonth(), effectiveEnd.getDate());

            const daysSpanned = eachDayOfInterval({ start: startDay, end: endDay });

            daysSpanned.forEach((day, index) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                if (!map.has(dateKey)) return;

                const isStartDay = index === 0;
                const isMonday = day.getDay() === 1;
                const isSpanner = isStartDay || isMonday;

                let spanType: 'single' | 'start' | 'middle' | 'end' = 'single';
                if (daysSpanned.length > 1) {
                    if (index === 0) spanType = 'start';
                    else if (index === daysSpanned.length - 1) spanType = 'end';
                    else spanType = 'middle';
                }

                if (isSpanner) {
                    const daysLeftInEvent = daysSpanned.length - index;
                    const daysLeftInWeek = day.getDay() === 0 ? 1 : 8 - day.getDay();
                    const span = Math.min(daysLeftInEvent, daysLeftInWeek);

                    map.get(dateKey)!.push({ ...event, renderType: 'spanner', spanType, span });
                } else {
                    map.get(dateKey)!.push({ ...event, renderType: 'spacer', spanType });
                }
            });
        });

        return map;
    }, [events, calendarDays]);

    const getHeaderLabel = () => {
        if (view === 'month') {
            const str = format(currentDate, 'MMMM yyyy', { locale: hu });
            return str.charAt(0).toUpperCase() + str.slice(1);
        }
        if (view === 'week') {
            const start = startOfWeek(currentDate, { weekStartsOn: 1 });
            const end = endOfWeek(currentDate, { weekStartsOn: 1 });
            return `${format(start, 'MMM d.', { locale: hu })} - ${format(end, 'MMM d.', { locale: hu })}`;
        }
        const str = format(currentDate, 'yyyy. MMMM d., EEEE', { locale: hu });
        return str.charAt(0).toUpperCase() + str.slice(1);
    };

    const renderTimeGrid = () => (
        <Box
            ref={timeGridRef}
            sx={{
                flexGrow: 1, overflowY: 'auto', scrollBehavior: 'smooth',
                bgcolor: isDarkMode ? '#0f172a' : 'white',
                height: { xs: 500, md: 650 },
                '&::-webkit-scrollbar': { width: '8px' },
                '&::-webkit-scrollbar-thumb': { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)', borderRadius: '4px' }
            }}
        >
            <Box sx={{ display: 'flex', position: 'relative', pt: 2, pb: 4 }}>
                <Box sx={{ width: { xs: 40, sm: 50 }, flexShrink: 0, borderRight: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'divider', bgcolor: isDarkMode ? '#0f172a' : '#f8fafc', position: 'sticky', left: 0, zIndex: 5 }}>
                    {HOURS.map(h => (
                        <Box key={h} sx={{ height: HOUR_HEIGHT, display: 'flex', justifyContent: 'center', pt: 0.5 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold', fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>{`${h}:00`}</Typography>
                        </Box>
                    ))}
                </Box>

                <Box sx={{ flexGrow: 1, display: 'grid', gridTemplateColumns: view === 'day' ? '1fr' : 'repeat(7, 1fr)', position: 'relative' }}>
                    <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
                        {HOURS.map(h => (
                            <Box key={h} sx={{ height: HOUR_HEIGHT, borderBottom: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }} />
                        ))}
                    </Box>

                    {calendarDays.map((day, index) => {
                        const dayEvents = eventsByDay.get(format(day, 'yyyy-MM-dd')) || [];
                        const isToday = format(day, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');

                        const cellStart = new Date(day);
                        cellStart.setHours(0, 0, 0, 0);
                        const cellEnd = new Date(day);
                        cellEnd.setHours(23, 59, 59, 999);

                        return (
                            <Box key={day.toISOString()} sx={{ borderRight: index < calendarDays.length - 1 ? '1px solid' : 'none', borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', position: 'relative', zIndex: 1, bgcolor: isToday ? (isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)') : 'transparent' }}>
                                <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', zIndex: 2 }}>
                                    {HOURS.map(h => (
                                        <Box key={h} onClick={(e) => { e.stopPropagation(); const slotDate = new Date(day); slotDate.setHours(h, 0, 0, 0); onSelectSlot(slotDate); }} sx={{ height: HOUR_HEIGHT, cursor: 'pointer', '&:hover': { bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' } }} />
                                    ))}
                                </Box>

                                {isToday && (
                                    <Box sx={{ position: 'absolute', top: (now.getHours() + now.getMinutes() / 60) * HOUR_HEIGHT, left: 0, right: 0, height: 2, bgcolor: '#ef4444', zIndex: 50, pointerEvents: 'none' }}>
                                        <Box sx={{ position: 'absolute', left: -4, top: -4, width: 10, height: 10, borderRadius: '50%', bgcolor: '#ef4444', boxShadow: '0 0 4px rgba(239,68,68,0.8)' }} />
                                    </Box>
                                )}

                                {dayEvents.map(ev => {
                                    const displayStart = ev.start < cellStart ? cellStart : ev.start;
                                    const displayEnd = ev.end > cellEnd ? cellEnd : ev.end;

                                    const startHour = displayStart.getHours() + displayStart.getMinutes() / 60;
                                    const durationHours = (displayEnd.getTime() - displayStart.getTime()) / (1000 * 60 * 60);

                                    const top = startHour * HOUR_HEIGHT;
                                    const height = Math.max(durationHours * HOUR_HEIGHT, 22);

                                    const isPersonal = ev.originalData?.type === 'PERSONAL' || ev.title.includes('Személyes');
                                    const bgColor = isPersonal ? (isDarkMode ? '#334155' : '#475569') : (ev.color ? alpha(ev.color, isDarkMode ? 0.9 : 0.85) : 'primary.main');

                                    return (
                                        <Paper key={`${ev.id}-${day.getTime()}`} onClick={(e) => { e.stopPropagation(); onSelectEvent(ev); }} elevation={2}
                                               sx={{ position: 'absolute', top, height, left: { xs: 1, sm: 4 }, right: { xs: 1, sm: 4 }, zIndex: 10, bgcolor: bgColor, color: 'white', p: { xs: 0.25, sm: 0.5 }, overflow: 'hidden', borderRadius: 1.5, cursor: 'pointer', transition: 'filter 0.2s', '&:hover': { filter: 'brightness(1.15)', zIndex: 11 } }}>
                                            <Typography variant="caption" fontWeight="bold" sx={{ display: 'block', lineHeight: 1.1, fontSize: { xs: '0.55rem', sm: '0.75rem' }, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>{ev.title}</Typography>
                                            {height > 30 && (
                                                <Typography variant="caption" sx={{ fontSize: { xs: '0.5rem', sm: '0.65rem' }, opacity: 0.9, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>{format(ev.start, 'HH:mm')}-{format(ev.end, 'HH:mm')}</Typography>
                                            )}
                                        </Paper>
                                    );
                                })}
                            </Box>
                        );
                    })}
                </Box>
            </Box>
        </Box>
    );

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

            <Box display="flex" justifyContent="space-between" alignItems="center" mb={isMobile ? 1 : 2} position="relative" width="100%">
                {isMobile ? (
                    <Box position="relative" display="flex" justifyContent="center" alignItems="center" width="100%" pt={1} pb={1}>
                        <Box position="absolute" left={0}>
                            <Button
                                variant="contained" disableElevation onClick={handleToday}
                                sx={{ borderRadius: '24px', px: 2, minWidth: '40px', py: 0.5, fontWeight: 'bold', textTransform: 'none', bgcolor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', color: isDarkMode ? 'white' : 'text.primary', '&:hover': { bgcolor: isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' } }}
                            >
                                Ma
                            </Button>
                        </Box>
                        <Box display="flex" justifyContent="center" alignItems="center">
                            <IconButton onClick={handlePrev} size="small" sx={{ bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', mx: 1 }}><ChevronLeftIcon /></IconButton>
                            <Typography variant="h6" fontWeight="900" sx={{ textTransform: 'lowercase', px: 0.5, minWidth: 130, textAlign: 'center', color: isDarkMode ? 'white' : 'primary.main', fontSize: '1.25rem', whiteSpace: 'nowrap' }}>
                                {getHeaderLabel()}
                            </Typography>
                            <IconButton onClick={handleNext} size="small" sx={{ bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', mx: 1 }}><ChevronRightIcon /></IconButton>
                        </Box>
                    </Box>
                ) : (
                    <>
                        <Box flex={1} display="flex" justifyContent="flex-start">
                            <Button variant="contained" disableElevation onClick={handleToday} sx={{ borderRadius: 8, bgcolor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', color: isDarkMode ? 'white' : 'text.primary', fontWeight: 'bold', px: 3 }}>Ma</Button>
                        </Box>
                        <Box flex={2} display="flex" justifyContent="center" alignItems="center" gap={2}>
                            <IconButton onClick={handlePrev} sx={{ bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}><ChevronLeftIcon /></IconButton>
                            <Typography variant="h5" fontWeight="900" sx={{ textTransform: 'none', minWidth: 250, textAlign: 'center', color: isDarkMode ? 'white' : 'primary.main' }}>
                                {getHeaderLabel()}
                            </Typography>
                            <IconButton onClick={handleNext} sx={{ bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}><ChevronRightIcon /></IconButton>
                        </Box>
                        <Box flex={1} display="flex" justifyContent="flex-end">
                            <ToggleButtonGroup value={view} exclusive onChange={(_, newView) => newView && onViewChange(newView)} size="small" sx={{ bgcolor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', p: 0.5, borderRadius: '24px', '& .MuiToggleButton-root': { border: 'none', borderRadius: '24px', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 'bold', color: 'text.secondary', px: 2.5, '&.Mui-selected': { bgcolor: isDarkMode ? 'rgba(255,255,255,0.15)' : 'white', color: 'text.primary', boxShadow: isDarkMode ? 'none' : '0 2px 4px rgba(0,0,0,0.1)' } } }}>
                                <ToggleButton value="month">Hónap</ToggleButton>
                                <ToggleButton value="week">Hét</ToggleButton>
                                <ToggleButton value="day">Nap</ToggleButton>
                            </ToggleButtonGroup>
                        </Box>
                    </>
                )}
            </Box>

            <Box sx={{ flexGrow: 1, position: 'relative', overflow: 'hidden' }}>
                <Box
                    key={animKey}
                    onTouchStart={isMobile && view === 'month' ? onTouchStartEvent : undefined}
                    onTouchMove={isMobile && view === 'month' ? onTouchMoveEvent : undefined}
                    onTouchEnd={isMobile && view === 'month' ? onTouchEndEvent : undefined}
                    sx={{
                        display: 'flex', flexDirection: 'column', height: '100%', touchAction: 'pan-y',
                        animation: `${slideDirection === 'left' ? 'slideInRight' : 'slideInLeft'} 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards`,
                        '@keyframes slideInRight': { '0%': { transform: 'translateX(30px)', opacity: 0 }, '100%': { transform: 'none', opacity: 1 } },
                        '@keyframes slideInLeft': { '0%': { transform: 'translateX(-30px)', opacity: 0 }, '100%': { transform: 'none', opacity: 1 } }
                    }}
                >
                    <Paper elevation={0} sx={{
                        flexGrow: 1, display: 'flex', flexDirection: 'column',
                        border: isMobile ? 'none' : '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider',
                        borderRadius: isMobile ? 0 : 4, overflow: 'hidden',
                        bgcolor: isDarkMode ? (isMobile ? 'transparent' : '#0f172a') : 'white'
                    }}>

                        {view !== 'day' && (
                            <Box display="flex">
                                {view === 'week' && !isMobile && <Box sx={{ width: { xs: 40, sm: 50 }, flexShrink: 0, borderRight: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'divider', bgcolor: 'transparent' }} />}
                                <Box display="grid" gridTemplateColumns="repeat(7, minmax(0, 1fr))" sx={{ flexGrow: 1, borderBottom: isMobile ? 'none' : '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'divider', bgcolor: 'transparent' }}>
                                    {calendarDays.slice(0, 7).map(day => (
                                        <Typography key={day.toISOString()} align="center" variant="subtitle2" fontWeight="bold" color={isDarkMode ? 'white' : 'text.secondary'} sx={{ py: { xs: 1, sm: 1.5 }, fontSize: { xs: '0.75rem', sm: '0.875rem' }, textTransform: 'lowercase' }}>
                                            {format(day, isMobile ? 'EE' : 'EEEE', { locale: hu })} {view === 'week' && <span style={{ opacity: 0.7 }}><br/>{format(day, 'd.')}</span>}
                                        </Typography>
                                    ))}
                                </Box>
                            </Box>
                        )}

                        {view === 'month' ? (
                            <Box display="grid" gridTemplateColumns="repeat(7, minmax(0, 1fr))" sx={{ flexGrow: 1, gridAutoRows: '1fr', minHeight: isMobile ? 280 : 500 }}>
                                {calendarDays.map((day, index) => {
                                    const isCurrentMonth = isSameMonth(day, currentDate);
                                    const isToday = format(day, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');
                                    const isSelected = isSameDay(day, selectedDate);
                                    const dayEvents = eventsByDay.get(format(day, 'yyyy-MM-dd')) || [];

                                    // LÉTSZÁMLIMIT BEÁLLÍTÁSOK (Desktopnál 1 esemény jelenik meg)
                                    const MAX_DESKTOP_EVENTS = 1;
                                    const MAX_MOBILE_LINES = 3;
                                    const MAX_MOBILE_DOTS = 4;

                                    return (
                                        <Box key={day.toISOString()}
                                             onClick={() => {
                                                 setSelectedDate(day);
                                                 if (!isCurrentMonth) navigateTo(startOfMonth(day), day > currentDate ? 'left' : 'right');
                                                 if (!isMobile) onSelectSlot(day);
                                             }}
                                             sx={{
                                                 minWidth: 0,
                                                 borderRight: isMobile ? 'none' : ((index + 1) % 7 !== 0 ? '1px solid' : 'none'),
                                                 borderBottom: isMobile ? 'none' : (index < calendarDays.length - 7 ? '1px solid' : 'none'),
                                                 borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                                                 py: isMobile ? 0.5 : 1, px: 0,
                                                 display: 'flex', flexDirection: 'column',
                                                 WebkitTapHighlightColor: 'transparent',
                                                 bgcolor: (!isCurrentMonth && !isMobile) ? (isDarkMode ? 'rgba(255,255,255,0.03)' : '#f8fafc') : 'transparent',
                                                 cursor: 'pointer', transition: 'background-color 0.2s',
                                                 '&:hover': isMobile ? {} : { bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f1f5f9' }
                                             }}
                                        >
                                            <Box display="flex" justifyContent={isMobile ? 'center' : 'flex-end'} mb={0.5} px={1}>
                                                <Typography variant="body2" sx={{
                                                    width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%',
                                                    bgcolor: (isMobile && isSelected) ? '#818cf8' : (isToday ? alpha(theme.palette.primary.main, 0.2) : 'transparent'),
                                                    color: (isMobile && isSelected) ? 'white' : (isToday ? '#818cf8' : (isCurrentMonth ? 'text.primary' : 'text.disabled')),
                                                    fontWeight: (isToday || isSelected) ? 'bold' : 'normal'
                                                }}>
                                                    {format(day, 'd')}
                                                </Typography>
                                            </Box>

                                            <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 5 }}>
                                                {isMobile ? (
                                                    <>
                                                        <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', mt: 0.5 }}>
                                                            {dayEvents.filter(e => e.spanType !== 'single').slice(0, MAX_MOBILE_LINES).map((event) => {
                                                                const isPersonal = event.originalData?.type === 'PERSONAL' || event.title.includes('Személyes');
                                                                const mobileBgColor = isPersonal ? (isDarkMode ? '#64748b' : '#475569') : (event.color || theme.palette.primary.main);

                                                                return (
                                                                    <Box key={`${event.id}-${day.getTime()}-multi`} sx={{ position: 'relative', height: '4px', mb: '2px', width: '100%' }}>
                                                                        <Box sx={{ width: '100%', height: '100%', opacity: 0 }} />
                                                                        {event.renderType === 'spanner' && (
                                                                            <Box
                                                                                onClick={(e) => { e.stopPropagation(); onSelectEvent(event); }}
                                                                                sx={{
                                                                                    position: 'absolute', top: 0, left: '2px',
                                                                                    width: `calc(${event.span! * 100}% - 4px)`,
                                                                                    height: '100%',
                                                                                    bgcolor: mobileBgColor,
                                                                                    borderRadius: '4px',
                                                                                    zIndex: 10
                                                                                }}
                                                                            />
                                                                        )}
                                                                    </Box>
                                                                );
                                                            })}
                                                        </Box>
                                                        <Box display="flex" flexWrap="wrap" justifyContent="center" gap={0.5} px={1} mt={0.5}>
                                                            {dayEvents.filter(e => e.spanType === 'single').slice(0, MAX_MOBILE_DOTS).map((ev) => {
                                                                const isPersonal = ev.originalData?.type === 'PERSONAL' || ev.title.includes('Személyes');
                                                                const dotColor = isPersonal ? (isDarkMode ? '#64748b' : '#475569') : (ev.color || theme.palette.primary.main);
                                                                return (
                                                                    <Box key={`${ev.id}-single`} sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: dotColor }} />
                                                                );
                                                            })}
                                                        </Box>
                                                    </>
                                                ) : (
                                                    <>
                                                        {dayEvents.slice(0, MAX_DESKTOP_EVENTS).map(event => {
                                                            const isPersonal = event.originalData?.type === 'PERSONAL' || event.title.includes('Személyes');
                                                            const bgColor = isPersonal ? (isDarkMode ? '#334155' : '#475569') : (event.color ? alpha(event.color, isDarkMode ? 0.2 : 0.1) : (isDarkMode ? 'rgba(255,255,255,0.1)' : '#f1f5f9'));
                                                            const textColor = isPersonal ? 'white' : (event.color || 'text.primary');

                                                            return (
                                                                <Box key={`${event.id}-${day.getTime()}`} sx={{ position: 'relative', height: '24px', mb: '2px', width: '100%' }}>
                                                                    {/* JAVÍTÁS 1: A Spacer-re (üres helykitöltő a folytonos napokon) IS rátesszük a kattintást! */}
                                                                    <Box
                                                                        onClick={(e) => { e.stopPropagation(); onSelectEvent(event); }}
                                                                        sx={{ width: '100%', height: '100%', opacity: 0, cursor: 'pointer', position: 'absolute', zIndex: 11 }}
                                                                    />

                                                                    {event.renderType === 'spanner' && (
                                                                        <Box
                                                                            onClick={(e) => { e.stopPropagation(); onSelectEvent(event); }}
                                                                            sx={{
                                                                                position: 'absolute', top: 0, left: '2px',
                                                                                width: `calc(${event.span! * 100}% + ${event.span! - 1}px - 4px)`,
                                                                                height: '100%',
                                                                                bgcolor: bgColor, color: textColor,
                                                                                borderRadius: '12px',
                                                                                px: 1, display: 'flex', alignItems: 'center',
                                                                                fontSize: '0.75rem', fontWeight: 'bold',
                                                                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                                                                cursor: 'pointer', zIndex: 10,
                                                                                '&:hover': { filter: 'brightness(0.95)', zIndex: 11 },
                                                                                // Hogy átengedje a kattintást az alatta lévő spacer-nek, ha a spanner csak dísz
                                                                                pointerEvents: 'auto'
                                                                            }}>
                                                                            {format(event.start, 'HH:mm')} {event.title}
                                                                        </Box>
                                                                    )}
                                                                </Box>
                                                            );
                                                        })}

                                                        {dayEvents.length > MAX_DESKTOP_EVENTS && (
                                                            <Typography
                                                                variant="caption"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedDate(day);
                                                                    onDateChange(day);
                                                                    onViewChange('day');
                                                                }}
                                                                sx={{
                                                                    fontWeight: 'bold', fontSize: '0.7rem',
                                                                    color: 'text.secondary', cursor: 'pointer',
                                                                    pl: 1, mt: 0.5,
                                                                    '&:hover': { color: theme.palette.primary.main, textDecoration: 'underline' }
                                                                }}
                                                            >
                                                                + {dayEvents.length - MAX_DESKTOP_EVENTS} további
                                                            </Typography>
                                                        )}
                                                    </>
                                                )}
                                            </Box>
                                        </Box>
                                    );
                                })}
                            </Box>
                        ) : (
                            renderTimeGrid()
                        )}
                    </Paper>
                </Box>
            </Box>

            {isMobile && view === 'month' && (
                <Box sx={{ mt: 1 }}>
                    <Box display="flex" flexDirection="column" gap={1.5}>
                        {(() => {
                            const dayEvents = eventsByDay.get(format(selectedDate, 'yyyy-MM-dd')) || [];
                            if (dayEvents.length === 0) return <Typography color="text.disabled" fontStyle="italic" sx={{ pl: 1, textAlign: 'center', mt: 4, fontSize: '1.1rem' }}>Ezen a napon szabad vagy.</Typography>;

                            return dayEvents.map(event => (
                                <Paper key={`${event.id}-${selectedDate.getTime()}`} elevation={0} onClick={() => onSelectEvent(event)}
                                       sx={{ p: 2, borderRadius: 3, cursor: 'pointer', bgcolor: isDarkMode ? '#0f172a' : 'white', border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'divider', borderLeft: '5px solid', borderLeftColor: event.color || 'primary.main' }}>
                                    <Typography variant="subtitle2" fontWeight="bold" color="text.primary">{event.title}</Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                        <AccessTimeIcon sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
                                        {format(event.start, 'HH:mm')} - {format(event.end, 'HH:mm')}
                                    </Typography>
                                </Paper>
                            ));
                        })()}
                    </Box>
                    <Button fullWidth variant="contained" color="primary" sx={{ mt: 3, borderRadius: '24px', py: 1.5, fontWeight: 'bold', fontSize: '1rem', textTransform: 'none', bgcolor: '#818cf8', color: 'white', '&:hover': {bgcolor: '#6366f1'} }} onClick={() => onSelectSlot(selectedDate)}>
                        + Új bejegyzés ehhez a naphoz
                    </Button>
                </Box>
            )}
        </Box>
    );
}