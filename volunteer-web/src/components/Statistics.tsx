import { useEffect, useState } from 'react';
import {
    Container, Typography, Box, Paper, CircularProgress,
    Alert, FormControl, InputLabel, Select, MenuItem, Divider, useTheme, useMediaQuery, Button, alpha, Fade,
    ToggleButtonGroup, ToggleButton, Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import Grid from '@mui/material/Grid';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import AssignmentIcon from '@mui/icons-material/Assignment';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import DownloadIcon from '@mui/icons-material/Download';
import TableChartIcon from '@mui/icons-material/TableChart';
import PieChartIcon from '@mui/icons-material/PieChart';
import BarChartIcon from '@mui/icons-material/BarChart';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

import api from '../api/axios';
import * as XLSX from 'xlsx';

// --- INTERFÉSZEK ---
interface MyStats {
    completedShifts: number;
    totalHoursWorked: number;
    upcomingShifts: number;
}

interface EventStats {
    totalApprovedVolunteers: number;
    totalShifts: number;
    fullShifts: number;
    volunteersPerWorkArea: Record<string, number>;
}

interface EventOption {
    id: number;
    title: string;
}

interface Membership {
    orgRole?: string;
    role?: string;
    status: string;
}

interface UserProfile {
    role: string;
    name: string;
    memberships: Membership[];
}

interface PieLabelProps {
    name?: string;
    percent?: number;
}

interface RawEvent {
    id: number;
    title: string;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#f97316', '#8b5cf6', '#ec4899', '#06b6d4'];

export default function Statistics() {
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const [loadingMe, setLoadingMe] = useState(true);
    const [myStats, setMyStats] = useState<MyStats | null>(null);
    const [isOrganizer, setIsOrganizer] = useState(false);
    const [userName, setUserName] = useState('Felhasználó');

    const [events, setEvents] = useState<EventOption[]>([]);
    const [selectedEventId, setSelectedEventId] = useState<number | string>('');
    const [loadingEventStats, setLoadingEventStats] = useState(false);
    const [eventStats, setEventStats] = useState<EventStats | null>(null);

    const [error, setError] = useState('');
    const [reportType, setReportType] = useState<string>('');
    const [chartType, setChartType] = useState<'pie' | 'bar'>('pie');

    const [warningModalOpen, setWarningModalOpen] = useState(false);

    useEffect(() => {
        loadInitialData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (selectedEventId !== '') {
            fetchEventStats(Number(selectedEventId));
        } else {
            setEventStats(null);
        }
    }, [selectedEventId]);

    const loadInitialData = async () => {
        try {
            const [statsRes, userRes] = await Promise.all([
                api.get('/statistics/me'),
                api.get('/users/me')
            ]);

            setMyStats(statsRes.data);

            const profile: UserProfile = userRes.data;
            setUserName(profile.name);

            const hasOrganizerRights = profile.role === 'SYS_ADMIN' ||
                (profile.memberships && profile.memberships.some((m: Membership) => {
                    return m.status === 'APPROVED' && (m.orgRole === 'OWNER' || m.orgRole === 'ORGANIZER' || m.role === 'OWNER' || m.role === 'ORGANIZER');
                }));

            setIsOrganizer(hasOrganizerRights);

            if (hasOrganizerRights) {
                const evRes = await api.get('/events?size=50');
                if (evRes.data && evRes.data.content) {
                    const mappedEvents = evRes.data.content.map((e: RawEvent) => {
                        return { id: e.id, title: e.title };
                    });
                    setEvents(mappedEvents);
                }
            }

        } catch (err) {
            console.error(err);
            setError("Nem sikerült betölteni az adatokat.");
        } finally {
            setLoadingMe(false);
        }
    };

    const fetchEventStats = async (eventId: number) => {
        setLoadingEventStats(true);
        try {
            const res = await api.get(`/statistics/event/${eventId}`);
            setEventStats(res.data);
        } catch (err) {
            console.error(err);
            setEventStats(null);
        } finally {
            setLoadingEventStats(false);
        }
    };

    // JAVÍTÁS 1: Null-safe adatelérés a WSOD megelőzésére!
    const chartData = (eventStats && eventStats.volunteersPerWorkArea)
        ? Object.entries(eventStats.volunteersPerWorkArea).map((entry) => {
            return { name: entry[0], value: entry[1] };
        })
        : [];

    const renderCustomizedLabel = (props: PieLabelProps) => {
        const name = props.name || 'Ismeretlen';
        const percent = props.percent || 0;
        return `${name} (${(percent * 100).toFixed(0)}%)`;
    };

    const handleDownloadExcel = () => {
        if (reportType === 'my_stats' && myStats) {
            const data = [
                { 'Név': userName, 'Mutató': 'Ledolgozott Órák', 'Érték': myStats.totalHoursWorked },
                { 'Név': userName, 'Mutató': 'Teljesített Műszakok', 'Érték': myStats.completedShifts },
                { 'Név': userName, 'Mutató': 'Várható Műszakok', 'Érték': myStats.upcomingShifts }
            ];

            const worksheet = XLSX.utils.json_to_sheet(data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Teljesítmény");

            const dateStr = new Date().toISOString().split('T')[0];
            XLSX.writeFile(workbook, `Sajat_Statisztika_${dateStr}.xlsx`);

        } else if (reportType === 'event_summary' && eventStats && selectedEventId !== '') {
            const selectedEventName = events.find(e => e.id === selectedEventId)?.title || 'Esemény';

            const summaryData = [
                { 'Mutató': 'Elfogadott Önkéntesek Száma', 'Érték': eventStats.totalApprovedVolunteers },
                { 'Mutató': 'Létrehozott Műszakok', 'Érték': eventStats.totalShifts },
                { 'Mutató': 'Betelt (Fullos) Műszakok', 'Érték': eventStats.fullShifts },
                { 'Mutató': 'Üres Műszakok Száma', 'Érték': eventStats.totalShifts - eventStats.fullShifts }
            ];

            const areaData = Object.entries(eventStats.volunteersPerWorkArea || {}).map(([area, count]) => ({
                'Munkaterület Neve': area,
                'Beosztott Önkéntesek Száma': count
            }));

            const wb = XLSX.utils.book_new();

            const wsSummary = XLSX.utils.json_to_sheet(summaryData);
            XLSX.utils.book_append_sheet(wb, wsSummary, "Összegzés");

            if (areaData.length > 0) {
                const wsAreas = XLSX.utils.json_to_sheet(areaData);
                XLSX.utils.book_append_sheet(wb, wsAreas, "Területek Eloszlása");
            }

            const dateStr = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `Esemeny_Riport_${selectedEventName.replace(/\s+/g, '_')}_${dateStr}.xlsx`);
        } else {
            setWarningModalOpen(true);
        }
    };

    const hasAnyStats = myStats && (myStats.totalHoursWorked > 0 || myStats.completedShifts > 0 || myStats.upcomingShifts > 0);
    const shouldShowMyStats = !isOrganizer || hasAnyStats;

    return (
        <>
        <Fade in={true} timeout={500}>
            <Container maxWidth="lg" sx={{ mt: { xs: 2, md: 4 }, mb: 10 }}>
                <Typography variant="h4" fontWeight="900" color={isDarkMode ? 'primary.light' : 'primary.main'} mb={1} sx={{ fontSize: { xs: '2rem', sm: '2.5rem' }, letterSpacing: '-0.5px' }}>
                    Statisztikák 📊
                </Typography>
                <Typography variant="body1" color="text.secondary" mb={4}>
                    Kövesd nyomon {shouldShowMyStats ? 'a saját teljesítményedet és ' : ''}az események alakulását!
                </Typography>

                {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

                {loadingMe ? (
                    <Box display="flex" justifyContent="center" p={5}><CircularProgress /></Box>
                ) : (
                    <>
                        {shouldShowMyStats && myStats && (
                            <>
                                <Typography variant="h5" fontWeight="bold" mb={3} color="text.primary">
                                    Saját Teljesítményem
                                </Typography>
                                <Grid container spacing={3} mb={isOrganizer ? 6 : 2}>
                                    <Grid size={{ xs: 12, md: 4 }}>
                                        <Paper elevation={0} sx={{
                                            p: 3, borderRadius: 4,
                                            background: isDarkMode ? 'linear-gradient(135deg, #3730a3 0%, #312e81 100%)' : 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
                                            color: 'white', display: 'flex', alignItems: 'center', gap: 2,
                                            boxShadow: isDarkMode ? '0 10px 30px rgba(0,0,0,0.3)' : '0 10px 30px rgba(30, 60, 114, 0.2)'
                                        }}>
                                            <Box sx={{
                                                width: 60, height: 60, flexShrink: 0,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                bgcolor: 'rgba(255,255,255,0.15)', borderRadius: '50%', backdropFilter: 'blur(10px)'
                                            }}>
                                                <AccessTimeIcon sx={{ fontSize: 32 }} />
                                            </Box>
                                            <Box>
                                                <Typography variant="h3" fontWeight="900" sx={{ lineHeight: 1.1 }}>{myStats.totalHoursWorked}</Typography>
                                                <Typography variant="subtitle1" fontWeight="500" sx={{ opacity: 0.9 }}>Ledolgozott Óra</Typography>
                                            </Box>
                                        </Paper>
                                    </Grid>

                                    <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                                        <Paper elevation={0} sx={{
                                            p: 3, borderRadius: 4, height: '100%',
                                            bgcolor: isDarkMode ? alpha(theme.palette.success.main, 0.1) : '#f0fdf4',
                                            border: '1px solid', borderColor: isDarkMode ? alpha(theme.palette.success.main, 0.2) : '#bbf7d0',
                                            display: 'flex', alignItems: 'center', gap: 2
                                        }}>
                                            <Box sx={{
                                                width: 60, height: 60, flexShrink: 0,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                bgcolor: isDarkMode ? alpha(theme.palette.success.main, 0.2) : '#dcfce7', color: isDarkMode ? theme.palette.success.light : '#166534', borderRadius: '50%'
                                            }}>
                                                <TaskAltIcon sx={{ fontSize: 32 }} />
                                            </Box>
                                            <Box>
                                                <Typography variant="h4" fontWeight="900" color={isDarkMode ? theme.palette.success.light : '#166534'} sx={{ lineHeight: 1.1 }}>{myStats.completedShifts}</Typography>
                                                <Typography variant="subtitle2" fontWeight="bold" color={isDarkMode ? theme.palette.success.main : '#15803d'}>Teljesített Műszak</Typography>
                                            </Box>
                                        </Paper>
                                    </Grid>

                                    <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                                        <Paper elevation={0} sx={{
                                            p: 3, borderRadius: 4, height: '100%',
                                            bgcolor: isDarkMode ? alpha(theme.palette.warning.main, 0.1) : '#fffbeb',
                                            border: '1px solid', borderColor: isDarkMode ? alpha(theme.palette.warning.main, 0.2) : '#fef08a',
                                            display: 'flex', alignItems: 'center', gap: 2
                                        }}>
                                            <Box sx={{
                                                width: 60, height: 60, flexShrink: 0,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                bgcolor: isDarkMode ? alpha(theme.palette.warning.main, 0.2) : '#fef3c7', color: isDarkMode ? theme.palette.warning.light : '#b45309', borderRadius: '50%'
                                            }}>
                                                <EventAvailableIcon sx={{ fontSize: 32 }} />
                                            </Box>
                                            <Box>
                                                <Typography variant="h4" fontWeight="900" color={isDarkMode ? theme.palette.warning.light : '#b45309'} sx={{ lineHeight: 1.1 }}>{myStats.upcomingShifts}</Typography>
                                                <Typography variant="subtitle2" fontWeight="bold" color={isDarkMode ? theme.palette.warning.main : '#b45309'}>Várható Műszak</Typography>
                                            </Box>
                                        </Paper>
                                    </Grid>
                                </Grid>
                            </>
                        )}
                    </>
                )}

                {isOrganizer && (
                    <>
                        <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={2} mb={3}>
                            <Typography variant="h5" fontWeight="bold" color="text.primary">
                                Szervezői Esemény Riportok
                            </Typography>

                            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 250 } }}>
                                <InputLabel>Válassz egy eseményt</InputLabel>
                                <Select
                                    value={selectedEventId}
                                    label="Válassz egy eseményt"
                                    onChange={(e) => setSelectedEventId(e.target.value)}
                                    sx={{ bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'white', borderRadius: 2 }}
                                >
                                    <MenuItem value=""><em>Kérlek válassz...</em></MenuItem>
                                    {events.map(ev => <MenuItem key={ev.id} value={ev.id}>{ev.title}</MenuItem>)}
                                </Select>
                            </FormControl>
                        </Box>

                        {selectedEventId === '' ? (
                            <Paper elevation={0} sx={{ p: 5, textAlign: 'center', borderRadius: 4, bgcolor: isDarkMode ? 'rgba(255,255,255,0.02)' : '#f8fafc', border: '1px dashed', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider' }}>
                                <Typography color="text.secondary">Válassz ki egy eseményt a fenti legördülő menüből a statisztikák megtekintéséhez!</Typography>
                            </Paper>
                        ) : loadingEventStats ? (
                            <Box display="flex" justifyContent="center" p={5}><CircularProgress /></Box>
                        ) : eventStats ? (
                            <Grid container spacing={4}>
                                <Grid size={{ xs: 12, md: 4 }}>
                                    <Box display="flex" flexDirection="column" gap={2}>
                                        <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 2, bgcolor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'white', border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'divider', borderLeft: `5px solid ${theme.palette.primary.main}` }}>
                                            <PeopleAltIcon color="primary" fontSize="large" />
                                            <Box>
                                                <Typography variant="h5" fontWeight="bold" color="text.primary">{eventStats.totalApprovedVolunteers} fő</Typography>
                                                <Typography variant="body2" color="text.secondary">Elfogadott Önkéntesek</Typography>
                                            </Box>
                                        </Paper>
                                        <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 2, bgcolor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'white', border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'divider', borderLeft: `5px solid ${theme.palette.secondary.main}` }}>
                                            <AssignmentIcon color="secondary" fontSize="large" />
                                            <Box>
                                                <Typography variant="h5" fontWeight="bold" color="text.primary">{eventStats.totalShifts} db</Typography>
                                                <Typography variant="body2" color="text.secondary">Létrehozott Műszakok</Typography>
                                            </Box>
                                        </Paper>
                                        <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 2, bgcolor: eventStats.fullShifts === eventStats.totalShifts && eventStats.totalShifts > 0 ? alpha(theme.palette.success.main, 0.1) : (isDarkMode ? 'rgba(255,255,255,0.03)' : 'white'), border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'divider', borderLeft: `5px solid ${theme.palette.success.main}` }}>
                                            <TaskAltIcon color="success" fontSize="large" />
                                            <Box>
                                                <Typography variant="h5" fontWeight="bold" color="text.primary">{eventStats.fullShifts} db</Typography>
                                                <Typography variant="body2" color="text.secondary">Betelt (Fullos) Műszakok</Typography>
                                            </Box>
                                        </Paper>

                                        {eventStats.fullShifts < eventStats.totalShifts && (
                                            <Alert severity="warning" sx={{ borderRadius: 3 }} icon={<WarningAmberIcon />}>
                                                Még van {eventStats.totalShifts - eventStats.fullShifts} db olyan műszak, ahova férnek önkéntesek!
                                            </Alert>
                                        )}
                                    </Box>
                                </Grid>

                                <Grid size={{ xs: 12, md: 8 }}>
                                    <Paper elevation={0} sx={{ p: 3, borderRadius: 4, height: '100%', minHeight: 350, display: 'flex', flexDirection: 'column', bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.5)' : 'white', border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'divider' }}>

                                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                                            <Typography variant="h6" fontWeight="bold" color="text.primary" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
                                                Eloszlás Területenként
                                            </Typography>

                                            <ToggleButtonGroup
                                                value={chartType}
                                                exclusive
                                                onChange={(_, newVal) => { if (newVal) setChartType(newVal); }}
                                                size="small"
                                                sx={{
                                                    bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.04)',
                                                    p: 0.5, borderRadius: 2,
                                                    '& .MuiToggleButton-root': { border: 'none', borderRadius: 1.5, px: 1.5 }
                                                }}
                                            >
                                                <ToggleButton value="pie" sx={{ '&.Mui-selected': { bgcolor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'white', boxShadow: isDarkMode ? 'none' : '0 2px 4px rgba(0,0,0,0.05)' } }}>
                                                    <PieChartIcon fontSize="small" />
                                                </ToggleButton>
                                                <ToggleButton value="bar" sx={{ '&.Mui-selected': { bgcolor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'white', boxShadow: isDarkMode ? 'none' : '0 2px 4px rgba(0,0,0,0.05)' } }}>
                                                    <BarChartIcon fontSize="small" />
                                                </ToggleButton>
                                            </ToggleButtonGroup>
                                        </Box>

                                        {chartData.length === 0 ? (
                                            <Box display="flex" flexGrow={1} justifyContent="center" alignItems="center">
                                                <Typography color="text.secondary" fontStyle="italic">Nincsenek még beosztott önkéntesek.</Typography>
                                            </Box>
                                        ) : (
                                            <ResponsiveContainer width="100%" height={300}>
                                                {chartType === 'pie' ? (
                                                    <PieChart>
                                                        <Pie
                                                            data={chartData} cx="50%" cy="50%"
                                                            labelLine={!isMobile}
                                                            label={isMobile ? undefined : renderCustomizedLabel} // JAVÍTÁS 2: Visszakerült a címke!
                                                            outerRadius={isMobile ? 80 : 100}
                                                            fill="#8884d8" dataKey="value"
                                                        >
                                                            {chartData.map((_entry, index) => (
                                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                            ))}
                                                        </Pie>
                                                        <Tooltip
                                                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                            formatter={(value: any) => {
                                                                const val = Array.isArray(value) ? value[0] : value;
                                                                return [`${val || 0} fő`, 'Önkéntes'];
                                                            }}
                                                            contentStyle={{ backgroundColor: isDarkMode ? '#1e293b' : 'white', borderRadius: '8px', border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #ccc', color: isDarkMode ? 'white' : 'black' }}
                                                        />
                                                        {isMobile && <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ color: isDarkMode ? '#cbd5e1' : 'inherit', fontSize: '12px' }}/>}
                                                    </PieChart>
                                                ) : (
                                                    <BarChart data={chartData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} vertical={false} />
                                                        <XAxis dataKey="name" tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                                                        <YAxis allowDecimals={false} tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                                                        <Tooltip
                                                            cursor={{ fill: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }}
                                                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                            formatter={(value: any) => {
                                                                const val = Array.isArray(value) ? value[0] : value;
                                                                return [`${val || 0} fő`, 'Önkéntes'];
                                                            }}
                                                            contentStyle={{ backgroundColor: isDarkMode ? '#1e293b' : 'white', borderRadius: '8px', border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #ccc', color: isDarkMode ? 'white' : 'black' }}
                                                        />
                                                        <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={60}>
                                                            {chartData.map((_entry, index) => (
                                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                            ))}
                                                        </Bar>
                                                    </BarChart>
                                                )}
                                            </ResponsiveContainer>
                                        )}
                                    </Paper>
                                </Grid>
                            </Grid>
                        ) : null}
                    </>
                )}

                <Divider sx={{ my: 5, borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider' }} />

                {/* EXPORT SZÁKCIÓ */}
                <Paper elevation={0} sx={{
                    p: { xs: 3, sm: 4 }, borderRadius: 4,
                    bgcolor: isDarkMode ? alpha(theme.palette.primary.main, 0.05) : '#f8fafc',
                    border: '1px solid', borderColor: isDarkMode ? alpha(theme.palette.primary.main, 0.1) : '#e2e8f0'
                }}>
                    <Box display="flex" alignItems="center" gap={2} mb={3}>
                        <TableChartIcon color="primary" fontSize="large" />
                        <Typography variant="h5" fontWeight="bold" color="text.primary">
                            Riportkészítő (Excel)
                        </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" mb={3}>
                        Válaszd ki, hogy milyen adatokat szeretnél letölteni .XLSX formátumban a további elemzésekhez.
                    </Typography>

                    <Grid container spacing={2} alignItems="center">
                        <Grid size={{ xs: 12, sm: 8, md: 6 }}>
                            <FormControl fullWidth size="medium" sx={{ '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'white', borderRadius: 2 } }}>
                                <InputLabel>Riport Típusa</InputLabel>
                                <Select
                                    value={reportType}
                                    label="Riport Típusa"
                                    onChange={(e) => setReportType(e.target.value)}
                                >
                                    <MenuItem value=""><em>Válassz riport típust...</em></MenuItem>
                                    {shouldShowMyStats && (
                                        <MenuItem value="my_stats">Saját teljesítményem letöltése</MenuItem>
                                    )}
                                    {isOrganizer && (
                                        <MenuItem value="event_summary">Esemény Összesítő (fent kiválasztott eseményből)</MenuItem>
                                    )}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4, md: 6 }}>
                            <Button
                                variant="contained"
                                color="secondary"
                                size="large"
                                fullWidth={isMobile}
                                startIcon={<DownloadIcon />}
                                onClick={handleDownloadExcel}
                                sx={{ py: 1.5, px: 4, borderRadius: 2, fontWeight: 'bold' }}
                                disableElevation
                            >
                                Exportálás
                            </Button>
                        </Grid>
                    </Grid>
                </Paper>

            </Container>
        </Fade>

    {/* FIGYELMEZTETŐ MODAL - Kikerült a Fade-ből! */}
    <Dialog
        open={warningModalOpen}
        onClose={() => setWarningModalOpen(false)}
        PaperProps={{
            sx: {
                borderRadius: 4,
                p: 1,
                bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.95)' : 'white',
                backdropFilter: 'blur(20px)',
                border: '1px solid',
                borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'transparent'
            }
        }}
    >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: '900', color: theme.palette.warning.main }}>
            <WarningAmberIcon fontSize="large" /> Hiányzó adat
        </DialogTitle>
        <DialogContent>
            <Typography variant="body1" color="text.primary" sx={{ mt: 1 }}>
                Kérlek, válassz ki egy <strong>Eseményt</strong> vagy egy releváns <strong>Riport típust</strong> a legördülő menüből, mielőtt elindítod az exportálást!
            </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
            <Button
                onClick={() => setWarningModalOpen(false)}
                variant="contained"
                color="warning"
                disableElevation
                sx={{ borderRadius: 2, fontWeight: 'bold', px: 3, color: 'white' }}
            >
                Rendben
            </Button>
        </DialogActions>
    </Dialog>
</>
    );
}