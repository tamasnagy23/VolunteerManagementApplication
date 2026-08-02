import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
    Container, Typography, Box, Paper, Button,
    Alert, Fade, CircularProgress,
    Tabs, Tab, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Chip, IconButton, Select, MenuItem,
    FormControl, InputLabel, Dialog, DialogTitle, DialogContent, DialogActions,
    Tooltip, Grid, TextField
} from '@mui/material';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import DownloadIcon from '@mui/icons-material/Download';
import HistoryIcon from '@mui/icons-material/History';
import EditIcon from '@mui/icons-material/Edit';
import SettingsIcon from '@mui/icons-material/Settings';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import * as XLSX from 'xlsx';

// --- AZ EREDETI, JÓ IMPORTOK A DATE-FNS-HEZ ---
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { renderTimeViewClock } from '@mui/x-date-pickers/timeViewRenderers';
import { hu } from 'date-fns/locale';

import api from '../api/axios';
import { useThemeToggle } from '../theme/ThemeContextProvider';

// --- INTERFÉSZEK A BACKENDHEZ ---
interface MealStats {
    normal: number;
    vegetarian: number;
    vegan: number;
    glutenFree: number;
    lactoseFree: number;
    total: number;
}

interface CateringSummary {
    breakfast: MealStats;
    lunch: MealStats;
    dinner: MealStats;
}

interface MealScanHistory {
    id: number;
    mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER';
    scannedAt: string;
    scannedByUserName: string;
}

interface CateringVolunteer {
    userId: number;
    name: string;
    workAreaName: string;
    dietaryPreference: string;
    eligibleMealsToday: ('BREAKFAST' | 'LUNCH' | 'DINNER')[];
    scansToday: MealScanHistory[];
}

// --- HELPER FÜGGVÉNYEK A DATE <-> STRING (HH:mm) KONVERZIÓHOZ ---
const parseLocalTime = (timeStr: string | null): Date | null => {
    if (!timeStr) return null;
    const [h, m] = timeStr.split(':');
    const d = new Date();
    d.setHours(Number(h), Number(m), 0, 0);
    return d;
};

const formatLocalTime = (date: Date | null): string | null => {
    if (!date) return null;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export default function EventCatering() {
    const { id } = useParams<{ id: string }>();
    const { isDarkMode } = useThemeToggle();

    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [eventDates, setEventDates] = useState<string[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [hasPermission, setHasPermission] = useState(false);

    const [summary, setSummary] = useState<CateringSummary | null>(null);
    const [volunteers, setVolunteers] = useState<CateringVolunteer[]>([]);

    // --- Szűrők állapotai ---
    const [searchTerm, setSearchTerm] = useState('');
    const [filterWorkArea, setFilterWorkArea] = useState('ALL');
    const [filterDiet, setFilterDiet] = useState('ALL');
    const [filterMeal, setFilterMeal] = useState('ALL');

    // Modálokhoz (Menü szerkesztés)
    const [editDietModalOpen, setEditDietModalOpen] = useState(false);
    const [selectedVolunteer, setSelectedVolunteer] = useState<CateringVolunteer | null>(null);
    const [newDiet, setNewDiet] = useState('');

    // Modálokhoz (Visszavonás)
    const [revokeModalOpen, setRevokeModalOpen] = useState(false);
    const [revokeData, setRevokeData] = useState<{ volunteerId: number, mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER' } | null>(null);

    // --- Idősáv szerkesztő állapotok ---
    const [timeSlotsModalOpen, setTimeSlotsModalOpen] = useState(false);

    const [breakfastStart, setBreakfastStart] = useState<Date | null>(null);
    const [breakfastEnd, setBreakfastEnd] = useState<Date | null>(null);
    const [openBreakfastStart, setOpenBreakfastStart] = useState(false);
    const [openBreakfastEnd, setOpenBreakfastEnd] = useState(false);

    const [lunchStart, setLunchStart] = useState<Date | null>(null);
    const [lunchEnd, setLunchEnd] = useState<Date | null>(null);
    const [openLunchStart, setOpenLunchStart] = useState(false);
    const [openLunchEnd, setOpenLunchEnd] = useState(false);

    const [dinnerStart, setDinnerStart] = useState<Date | null>(null);
    const [dinnerEnd, setDinnerEnd] = useState<Date | null>(null);
    const [openDinnerStart, setOpenDinnerStart] = useState(false);
    const [openDinnerEnd, setOpenDinnerEnd] = useState(false);

    useEffect(() => {
        if (!id) return;
        fetchInitialData();
    }, [id]);

    useEffect(() => {
        if (selectedDate) {
            fetchDailyData(selectedDate);
        }
    }, [selectedDate]);

    const fetchInitialData = async () => {
        try {
            const permRes = await api.get(`/events/${id}/my-permissions`);
            const isAdminOrCoord = permRes.data.globalAdmin || permRes.data.eventRole === 'ORGANIZER' ||
                permRes.data.permissions?.includes('MANAGE_CATERING') ||
                permRes.data.permissions?.includes('MANAGE_CATERING_GLOBAL') ||
                permRes.data.permissions?.includes('MANAGE_CATERING_LOCAL');

            setHasPermission(isAdminOrCoord);

            if (!isAdminOrCoord) {
                setLoading(false);
                return;
            }

            const evRes = await api.get(`/events/${id}`);
            const start = new Date(evRes.data.startTime);
            const end = new Date(evRes.data.endTime);
            const days: string[] = [];

            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                days.push(d.toISOString().split('T')[0]);
            }
            setEventDates(days);
            setSelectedDate(days[0]);

            // Kezdeti értékek betöltése
            setBreakfastStart(parseLocalTime(evRes.data.breakfastStartTime));
            setBreakfastEnd(parseLocalTime(evRes.data.breakfastEndTime));
            setLunchStart(parseLocalTime(evRes.data.lunchStartTime));
            setLunchEnd(parseLocalTime(evRes.data.lunchEndTime));
            setDinnerStart(parseLocalTime(evRes.data.dinnerStartTime));
            setDinnerEnd(parseLocalTime(evRes.data.dinnerEndTime));

        } catch (err) {
            console.error("Hiba az inicializáláskor:", err);
        }
    };

    const fetchDailyData = async (date: string) => {
        setLoading(true);
        try {
            const [summaryRes, volRes] = await Promise.all([
                api.get(`/catering/events/${id}/summary?date=${date}`),
                api.get(`/catering/events/${id}/volunteers?date=${date}`)
            ]);

            setSummary(summaryRes.data);
            setVolunteers(volRes.data);
        } catch (err) {
            console.error("Hiba a napi adatok lekérésekor:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveTimeSlots = async () => {
        setActionLoading(true);
        try {
            const payload = {
                breakfastStartTime: formatLocalTime(breakfastStart),
                breakfastEndTime: formatLocalTime(breakfastEnd),
                lunchStartTime: formatLocalTime(lunchStart),
                lunchEndTime: formatLocalTime(lunchEnd),
                dinnerStartTime: formatLocalTime(dinnerStart),
                dinnerEndTime: formatLocalTime(dinnerEnd),
            };

            await api.patch(`/events/${id}/catering-times`, payload);
            setTimeSlotsModalOpen(false);
            alert("Idősávok sikeresen frissítve!");
        } catch (err) {
            console.error("Hiba az idősávok mentésekor:", err);
            alert("Hiba az idősávok mentésekor!");
        } finally {
            setActionLoading(false);
        }
    };

    const uniqueWorkAreas = useMemo(() => {
        const areas = new Set(volunteers.map(v => v.workAreaName));
        return Array.from(areas).sort();
    }, [volunteers]);

    const filteredVolunteers = useMemo(() => {
        return volunteers.filter(vol => {
            const matchName = vol.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchArea = filterWorkArea === 'ALL' || vol.workAreaName === filterWorkArea;
            const matchDiet = filterDiet === 'ALL' || vol.dietaryPreference === filterDiet;

            // Explicit típus megadva az ESLint any hiba ellen
            const matchMeal = filterMeal === 'ALL' || vol.eligibleMealsToday.includes(filterMeal as 'BREAKFAST' | 'LUNCH' | 'DINNER');

            return matchName && matchArea && matchDiet && matchMeal;
        });
    }, [volunteers, searchTerm, filterWorkArea, filterDiet, filterMeal]);

    const handleExportExcel = () => {
        if (filteredVolunteers.length === 0) return;

        const exportData = filteredVolunteers.map(v => {
            const breakfastScan = v.scansToday.find(s => s.mealType === 'BREAKFAST');
            const lunchScan = v.scansToday.find(s => s.mealType === 'LUNCH');
            const dinnerScan = v.scansToday.find(s => s.mealType === 'DINNER');

            return {
                'Név': v.name,
                'Munkaterület': v.workAreaName,
                'Kért Menü': v.dietaryPreference,
                'Reggeli Állapot': breakfastScan ? 'Kiadva' : (v.eligibleMealsToday.includes('BREAKFAST') ? 'Jogosult' : 'Nem jogosult'),
                'Reggeli Kiadva (Idő)': breakfastScan ? new Date(breakfastScan.scannedAt).toLocaleTimeString('hu-HU') : '-',
                'Reggeli Pultos': breakfastScan ? breakfastScan.scannedByUserName : '-',

                'Ebéd Állapot': lunchScan ? 'Kiadva' : (v.eligibleMealsToday.includes('LUNCH') ? 'Jogosult' : 'Nem jogosult'),
                'Ebéd Kiadva (Idő)': lunchScan ? new Date(lunchScan.scannedAt).toLocaleTimeString('hu-HU') : '-',
                'Ebéd Pultos': lunchScan ? lunchScan.scannedByUserName : '-',

                'Vacsora Állapot': dinnerScan ? 'Kiadva' : (v.eligibleMealsToday.includes('DINNER') ? 'Jogosult' : 'Nem jogosult'),
                'Vacsora Kiadva (Idő)': dinnerScan ? new Date(dinnerScan.scannedAt).toLocaleTimeString('hu-HU') : '-',
                'Vacsora Pultos': dinnerScan ? dinnerScan.scannedByUserName : '-',
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, `Catering_${selectedDate}`);
        XLSX.writeFile(workbook, `Esemeny_Catering_${selectedDate}.xlsx`);
    };

    const openDietModal = (volunteer: CateringVolunteer) => {
        setSelectedVolunteer(volunteer);
        setNewDiet(volunteer.dietaryPreference);
        setEditDietModalOpen(true);
    };

    const handleSaveDiet = async () => {
        if (!selectedVolunteer) return;
        setActionLoading(true);
        try {
            await api.put(`/catering/events/${id}/volunteers/${selectedVolunteer.userId}/diet`, { dietaryPreference: newDiet });

            setVolunteers(prev => prev.map(v => v.userId === selectedVolunteer.userId ? { ...v, dietaryPreference: newDiet } : v));
            setEditDietModalOpen(false);

            const summaryRes = await api.get(`/catering/events/${id}/summary?date=${selectedDate}`);
            setSummary(summaryRes.data);

        } catch (err) {
            console.error("Hiba a menü módosításakor:", err);
            alert("Hiba a menü módosításakor!");
        } finally {
            setActionLoading(false);
        }
    };

    const openRevokeModal = (volunteerId: number, mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER') => {
        setRevokeData({ volunteerId, mealType });
        setRevokeModalOpen(true);
    };

    const confirmRevokeScan = async () => {
        if (!revokeData) return;

        setActionLoading(true);
        try {
            await api.post(`/meals/undo`, {
                volunteerId: revokeData.volunteerId,
                eventId: Number(id),
                mealType: revokeData.mealType
            });

            setVolunteers(prev => prev.map(v => {
                if (v.userId === revokeData.volunteerId) {
                    return { ...v, scansToday: v.scansToday.filter(s => s.mealType !== revokeData.mealType) };
                }
                return v;
            }));

            setRevokeModalOpen(false);
        } catch (err) {
            console.error("Hiba a visszavonáskor:", err);
            alert("Hiba a visszavonáskor!");
        } finally {
            setActionLoading(false);
        }
    };

    if (!hasPermission && !loading) {
        return (
            <Container sx={{ mt: 10 }}><Alert severity="error">Nincs jogosultságod a Catering modul kezeléséhez!</Alert></Container>
        );
    }

    const renderSummaryBox = (title: string, data: MealStats) => (
        <Paper sx={{ p: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider', bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'white', flex: 1 }}>
            <Typography variant="h6" fontWeight="900" color="primary.main" mb={1}>{title}</Typography>
            <Typography variant="h3" fontWeight="900" mb={2}>{data.total} <Typography component="span" color="text.secondary" fontWeight="bold">adag</Typography></Typography>
            <Box display="flex" flexWrap="wrap" gap={1}>
                <Chip label={`Normál: ${data.normal}`} size="small" variant="outlined" />
                <Chip label={`Vega: ${data.vegetarian}`} size="small" color="success" variant="outlined" />
                <Chip label={`Vegán: ${data.vegan}`} size="small" color="success" />
                <Chip label={`Gluténmentes: ${data.glutenFree}`} size="small" color="warning" variant="outlined" />
                <Chip label={`Laktózmentes: ${data.lactoseFree}`} size="small" color="info" variant="outlined" />
            </Box>
        </Paper>
    );

    return (
        <Fade in timeout={600}>
            <Container maxWidth="xl" sx={{ mt: 4, mb: 10 }}>
                {/* FEJLÉC ÉS EXPORT */}
                <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} mb={4} gap={2}>
                    <Box display="flex" alignItems="center" gap={2}>
                        <Box>
                            <Typography variant="h4" fontWeight="900" sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <RestaurantIcon color="warning" fontSize="large" /> Catering Vezérlőpult
                            </Typography>
                        </Box>
                    </Box>

                    <Box display="flex" gap={2}>
                        <Button
                            variant="outlined" startIcon={<SettingsIcon />}
                            onClick={() => setTimeSlotsModalOpen(true)}
                            sx={{ borderRadius: 3, fontWeight: 'bold' }}
                        >
                            Idősávok beállítása
                        </Button>
                        <Button
                            variant="contained" color="success" startIcon={<DownloadIcon />}
                            onClick={handleExportExcel} disabled={loading || filteredVolunteers.length === 0}
                            sx={{ borderRadius: 3, fontWeight: 'bold' }}
                        >
                            Excel Export
                        </Button>
                    </Box>
                </Box>

                {/* NAPVÁLASZTÓ TABS */}
                <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 4 }}>
                    <Tabs
                        value={selectedDate}
                        onChange={(_, newValue) => setSelectedDate(newValue)}
                        variant="scrollable" scrollButtons="auto"
                        textColor="primary" indicatorColor="primary"
                    >
                        {eventDates.map(date => (
                            <Tab key={date} value={date} label={new Date(date).toLocaleDateString('hu-HU', { weekday: 'long', month: 'short', day: 'numeric' })} sx={{ fontWeight: 'bold', fontSize: '1.1rem', textTransform: 'capitalize' }} />
                        ))}
                    </Tabs>
                </Box>

                {loading ? (
                    <Box display="flex" justifyContent="center" py={10}><CircularProgress /></Box>
                ) : (
                    <>
                        {/* ÖSSZEGZŐ KÁRTYÁK */}
                        {summary && (
                            <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={3} mb={5}>
                                {renderSummaryBox("🥐 Reggeli", summary.breakfast)}
                                {renderSummaryBox("🍲 Ebéd", summary.lunch)}
                                {renderSummaryBox("🍕 Vacsora", summary.dinner)}
                            </Box>
                        )}

                        {/* SZŰRŐSÁV */}
                        <Paper sx={{ p: 2, mb: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider', bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : '#f8fafc' }}>
                            <Box display="flex" alignItems="center" gap={1} mb={2}>
                                <FilterListIcon color="primary" />
                                <Typography variant="subtitle1" fontWeight="bold">Gyorskeresés és Szűrés</Typography>
                            </Box>
                            <Grid container spacing={2}>
                                <Grid size={{ xs: 12, md: 3 }}>
                                    <TextField
                                        fullWidth size="small"
                                        label="Keresés név alapján..."
                                        variant="outlined"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        InputProps={{
                                            startAdornment: <SearchIcon fontSize="small" sx={{ color: 'text.secondary', mr: 1 }} />
                                        }}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, md: 3 }}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Munkaterület</InputLabel>
                                        <Select value={filterWorkArea} label="Munkaterület" onChange={(e) => setFilterWorkArea(e.target.value)}>
                                            <MenuItem value="ALL"><em>Összes munkaterület</em></MenuItem>
                                            {uniqueWorkAreas.map(area => (
                                                <MenuItem key={area} value={area}>{area}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid size={{ xs: 12, md: 3 }}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Menü (Diéta)</InputLabel>
                                        <Select value={filterDiet} label="Menü (Diéta)" onChange={(e) => setFilterDiet(e.target.value)}>
                                            <MenuItem value="ALL"><em>Összes</em></MenuItem>
                                            <MenuItem value="Normál">Normál</MenuItem>
                                            <MenuItem value="Vegetáriánus">Vegetáriánus</MenuItem>
                                            <MenuItem value="Vegán">Vegán</MenuItem>
                                            <MenuItem value="Gluténmentes">Gluténmentes</MenuItem>
                                            <MenuItem value="Laktózmentes">Laktózmentes</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid size={{ xs: 12, md: 3 }}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Jogosult Napszak</InputLabel>
                                        <Select value={filterMeal} label="Jogosult Napszak" onChange={(e) => setFilterMeal(e.target.value)}>
                                            <MenuItem value="ALL"><em>Bármelyik étkezés</em></MenuItem>
                                            <MenuItem value="BREAKFAST">🥐 Reggeli</MenuItem>
                                            <MenuItem value="LUNCH">🍲 Ebéd</MenuItem>
                                            <MenuItem value="DINNER">🍕 Vacsora</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>
                            </Grid>
                        </Paper>

                        {/* RÉSZLETES TÁBLÁZAT */}
                        <Paper sx={{ borderRadius: 4, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
                            <TableContainer sx={{ maxHeight: '600px' }}>
                                <Table stickyHeader>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 'bold', bgcolor: isDarkMode ? '#1e293b' : '#f8fafc' }}>Önkéntes Neve</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold', bgcolor: isDarkMode ? '#1e293b' : '#f8fafc' }}>Munkaterület</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold', bgcolor: isDarkMode ? '#1e293b' : '#f8fafc' }}>Kért Menü</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold', bgcolor: isDarkMode ? '#1e293b' : '#f8fafc' }}>🥐 Reggeli</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold', bgcolor: isDarkMode ? '#1e293b' : '#f8fafc' }}>🍲 Ebéd</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold', bgcolor: isDarkMode ? '#1e293b' : '#f8fafc' }}>🍕 Vacsora</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {filteredVolunteers.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} align="center" sx={{ py: 5 }}>
                                                    <Typography color="text.secondary">Nincs a szűrésnek megfelelő önkéntes.</Typography>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredVolunteers.map((vol) => {
                                                const renderMealStatus = (mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER') => {
                                                    const isEligible = vol.eligibleMealsToday.includes(mealType);
                                                    const scan = vol.scansToday.find(s => s.mealType === mealType);

                                                    if (scan) {
                                                        return (
                                                            <Box>
                                                                <Chip label="Kiadva" color="success" size="small" sx={{ fontWeight: 'bold', mb: 0.5 }} />
                                                                <Typography variant="caption" display="block" color="text.secondary">
                                                                    {new Date(scan.scannedAt).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}
                                                                </Typography>
                                                                <Typography variant="caption" display="block" color="primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                                    Pultos: {scan.scannedByUserName}
                                                                    <Tooltip title="Kiadás visszavonása">
                                                                        <IconButton size="small" color="error" onClick={() => openRevokeModal(vol.userId, mealType)} disabled={actionLoading} sx={{ p: 0.2 }}>
                                                                            <HistoryIcon fontSize="small" />
                                                                        </IconButton>
                                                                    </Tooltip>
                                                                </Typography>
                                                            </Box>
                                                        );
                                                    }
                                                    return isEligible ? <Chip label="Jogosult" color="info" size="small" variant="outlined" /> : <Typography variant="body2" color="text.disabled">-</Typography>;
                                                };

                                                return (
                                                    <TableRow key={vol.userId} hover>
                                                        <TableCell><Typography fontWeight="bold">{vol.name}</Typography></TableCell>
                                                        <TableCell>{vol.workAreaName}</TableCell>
                                                        <TableCell>
                                                            <Box display="flex" alignItems="center" gap={1}>
                                                                <Chip label={vol.dietaryPreference} size="small" color={vol.dietaryPreference === 'Normál' ? 'default' : 'success'} />
                                                                <IconButton size="small" onClick={() => openDietModal(vol)}><EditIcon fontSize="small" /></IconButton>
                                                            </Box>
                                                        </TableCell>
                                                        <TableCell>{renderMealStatus('BREAKFAST')}</TableCell>
                                                        <TableCell>{renderMealStatus('LUNCH')}</TableCell>
                                                        <TableCell>{renderMealStatus('DINNER')}</TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Paper>
                    </>
                )}

                {/* MENÜ MÓDOSÍTÓ DIALOG */}
                <Dialog open={editDietModalOpen} onClose={() => setEditDietModalOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
                    <DialogTitle sx={{ fontWeight: 'bold' }}>Menü módosítása</DialogTitle>
                    <DialogContent>
                        <Typography mb={2}>Új menü beállítása <b>{selectedVolunteer?.name}</b> számára:</Typography>
                        <FormControl fullWidth size="small">
                            <InputLabel>Kért Menü</InputLabel>
                            <Select value={newDiet} label="Kért Menü" onChange={(e) => setNewDiet(e.target.value)}>
                                <MenuItem value="Normál">Normál</MenuItem>
                                <MenuItem value="Vegetáriánus">Vegetáriánus</MenuItem>
                                <MenuItem value="Vegán">Vegán</MenuItem>
                                <MenuItem value="Gluténmentes">Gluténmentes</MenuItem>
                                <MenuItem value="Laktózmentes">Laktózmentes</MenuItem>
                            </Select>
                        </FormControl>
                    </DialogContent>
                    <DialogActions sx={{ p: 2 }}>
                        <Button onClick={() => setEditDietModalOpen(false)}>Mégse</Button>
                        <Button variant="contained" onClick={handleSaveDiet} disabled={actionLoading} sx={{ borderRadius: 2 }}>Mentés</Button>
                    </DialogActions>
                </Dialog>

                {/* VISSZAVONÁS MEGERŐSÍTŐ DIALOG */}
                <Dialog open={revokeModalOpen} onClose={() => setRevokeModalOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
                    <DialogTitle sx={{ fontWeight: 'bold', color: 'error.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                        <HistoryIcon /> Kiadás Visszavonása
                    </DialogTitle>
                    <DialogContent>
                        <Typography>
                            Biztosan visszavonod ezt a kiadást? A számláló visszaáll, és a személy újra felveheti az ételt!
                        </Typography>
                    </DialogContent>
                    <DialogActions sx={{ p: 2 }}>
                        <Button onClick={() => setRevokeModalOpen(false)} disabled={actionLoading}>
                            Mégse
                        </Button>
                        <Button variant="contained" color="error" onClick={confirmRevokeScan} disabled={actionLoading} sx={{ borderRadius: 2 }}>
                            Igen, Visszavonom
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* IDŐSÁVOK BEÁLLÍTÁSA DIALOG */}
                <Dialog open={timeSlotsModalOpen} onClose={() => setTimeSlotsModalOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 5, bgcolor: isDarkMode ? 'rgba(30,41,59,0.98)' : 'white', backdropFilter: 'blur(15px)' } }}>
                    <DialogTitle sx={{ fontWeight: '900', bgcolor: isDarkMode ? '#1e293b' : 'primary.main', color: 'white', py: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <SettingsIcon /> Étkezési idősávok beállítása
                    </DialogTitle>
                    <DialogContent sx={{ p: 4 }}>
                        <Typography variant="subtitle2" fontWeight="900" sx={{ mb: 4, mt: 1, color: isDarkMode ? '#818cf8' : 'primary.main' }}>
                            ÁLLÍTSD BE AZ EGYES ÉTKEZÉSEK IDŐTARTAMÁT:
                        </Typography>

                        {/* A LÉNYEG: LOCALIZATION PROVIDER KÖRBEVESZI A PICKEREKET */}
                        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={hu}>
                            <Grid container spacing={4}>
                                <Grid size={{ xs: 12, md: 4 }}>
                                    <Paper sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider', bgcolor: isDarkMode ? 'rgba(0,0,0,0.1)' : 'auto' }}>
                                        <Typography fontWeight="bold" sx={{ mb: 2, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
                                            🥐 Reggeli
                                        </Typography>
                                        <Box display="flex" flexDirection="column" gap={2}>
                                            <TimePicker
                                                label="Kezdés" value={breakfastStart} onChange={setBreakfastStart} ampm={false}
                                                open={openBreakfastStart} onClose={() => setOpenBreakfastStart(false)} onOpen={() => setOpenBreakfastStart(true)}
                                                viewRenderers={{ hours: renderTimeViewClock, minutes: renderTimeViewClock }}
                                                slotProps={{ textField: { size: 'small', onClick: () => setOpenBreakfastStart(true), inputProps: { readOnly: true, style: { cursor: 'pointer' } } } }}
                                            />
                                            <TimePicker
                                                label="Vége" value={breakfastEnd} onChange={setBreakfastEnd} ampm={false}
                                                open={openBreakfastEnd} onClose={() => setOpenBreakfastEnd(false)} onOpen={() => setOpenBreakfastEnd(true)}
                                                viewRenderers={{ hours: renderTimeViewClock, minutes: renderTimeViewClock }}
                                                slotProps={{ textField: { size: 'small', onClick: () => setOpenBreakfastEnd(true), inputProps: { readOnly: true, style: { cursor: 'pointer' } } } }}
                                            />
                                        </Box>
                                    </Paper>
                                </Grid>
                                <Grid size={{ xs: 12, md: 4 }}>
                                    <Paper sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider', bgcolor: isDarkMode ? 'rgba(0,0,0,0.1)' : 'auto' }}>
                                        <Typography fontWeight="bold" sx={{ mb: 2, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
                                            🍲 Ebéd
                                        </Typography>
                                        <Box display="flex" flexDirection="column" gap={2}>
                                            <TimePicker
                                                label="Kezdés" value={lunchStart} onChange={setLunchStart} ampm={false}
                                                open={openLunchStart} onClose={() => setOpenLunchStart(false)} onOpen={() => setOpenLunchStart(true)}
                                                viewRenderers={{ hours: renderTimeViewClock, minutes: renderTimeViewClock }}
                                                slotProps={{ textField: { size: 'small', onClick: () => setOpenLunchStart(true), inputProps: { readOnly: true, style: { cursor: 'pointer' } } } }}
                                            />
                                            <TimePicker
                                                label="Vége" value={lunchEnd} onChange={setLunchEnd} ampm={false}
                                                open={openLunchEnd} onClose={() => setOpenLunchEnd(false)} onOpen={() => setOpenLunchEnd(true)}
                                                viewRenderers={{ hours: renderTimeViewClock, minutes: renderTimeViewClock }}
                                                slotProps={{ textField: { size: 'small', onClick: () => setOpenLunchEnd(true), inputProps: { readOnly: true, style: { cursor: 'pointer' } } } }}
                                            />
                                        </Box>
                                    </Paper>
                                </Grid>
                                <Grid size={{ xs: 12, md: 4 }}>
                                    <Paper sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider', bgcolor: isDarkMode ? 'rgba(0,0,0,0.1)' : 'auto' }}>
                                        <Typography fontWeight="bold" sx={{ mb: 2, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
                                            🍕 Vacsora
                                        </Typography>
                                        <Box display="flex" flexDirection="column" gap={2}>
                                            <TimePicker
                                                label="Kezdés" value={dinnerStart} onChange={setDinnerStart} ampm={false}
                                                open={openDinnerStart} onClose={() => setOpenDinnerStart(false)} onOpen={() => setOpenDinnerStart(true)}
                                                viewRenderers={{ hours: renderTimeViewClock, minutes: renderTimeViewClock }}
                                                slotProps={{ textField: { size: 'small', onClick: () => setOpenDinnerStart(true), inputProps: { readOnly: true, style: { cursor: 'pointer' } } } }}
                                            />
                                            <TimePicker
                                                label="Vége" value={dinnerEnd} onChange={setDinnerEnd} ampm={false}
                                                open={openDinnerEnd} onClose={() => setOpenDinnerEnd(false)} onOpen={() => setOpenDinnerEnd(true)}
                                                viewRenderers={{ hours: renderTimeViewClock, minutes: renderTimeViewClock }}
                                                slotProps={{ textField: { size: 'small', onClick: () => setOpenDinnerEnd(true), inputProps: { readOnly: true, style: { cursor: 'pointer' } } } }}
                                            />
                                        </Box>
                                    </Paper>
                                </Grid>
                            </Grid>
                        </LocalizationProvider>

                    </DialogContent>
                    <DialogActions sx={{ p: 3, borderTop: '1px solid', borderColor: 'divider' }}>
                        <Button onClick={() => setTimeSlotsModalOpen(false)} sx={{ fontWeight: '800' }}>Mégse</Button>
                        <Button variant="contained" onClick={handleSaveTimeSlots} disabled={actionLoading} sx={{ borderRadius: 2, fontWeight: '800', px: 4 }}>
                            {actionLoading ? 'Mentés...' : 'Mentés'}
                        </Button>
                    </DialogActions>
                </Dialog>

            </Container>
        </Fade>
    );
}