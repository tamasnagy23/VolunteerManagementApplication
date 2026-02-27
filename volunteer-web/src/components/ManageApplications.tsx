import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Container, Typography, Box, Paper, Button, CircularProgress,
    Alert, Tabs, Tab, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Select, MenuItem, FormControl, InputLabel,
    TableSortLabel
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DownloadIcon from '@mui/icons-material/Download';
import api from '../api/axios';
import axios from 'axios';

// --- INTERFÉSZEK ---
interface Application {
    id: number;
    userName: string;
    userEmail: string;
    userPhone: string;
    workAreaName: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
    answers: Record<string, string>; // ÚJ: Itt érkeznek a kérdőív válaszai
}

interface WorkArea {
    id: number;
    name: string;
}

interface EventQuestion {
    id: number;
    questionText: string;
}

interface EventData {
    id: number;
    title: string;
    workAreas: WorkArea[];
    questions: EventQuestion[]; // ÚJ: Szükséges az export oszlopaihoz
}

type SortField = 'userName' | 'workAreaName';
type SortOrder = 'asc' | 'desc';

export default function ManageApplications() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [event, setEvent] = useState<EventData | null>(null);
    const [applications, setApplications] = useState<Application[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const [currentTab, setCurrentTab] = useState<number>(0);
    const [areaFilter, setAreaFilter] = useState<string>('ALL');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [sortBy, setSortBy] = useState<SortField>('userName');
    const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

    const fetchData = async () => {
        try {
            setLoading(true);
            const [eventRes, appsRes] = await Promise.all([
                api.get(`/events/${id}`),
                api.get(`/applications/event/${id}`)
            ]);

            setEvent(eventRes.data);
            setApplications(Array.isArray(appsRes.data) ? appsRes.data : []);
        } catch (err) {
            if (axios.isAxiosError(err) && err.response?.status === 403) {
                setError("Nincs jogosultságod a jelentkezők megtekintéséhez.");
            } else {
                setError("Hiba történt az adatok betöltésekor.");
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (id) fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const handleStatusChange = async (appId: number, eventSelect: SelectChangeEvent) => {
        const newStatus = eventSelect.target.value;
        try {
            await api.put(`/applications/${appId}/status`, null, { params: { status: newStatus } });
            fetchData();
        } catch {
            alert("Nem sikerült módosítani a státuszt.");
        }
    };

    const handleSort = (field: SortField) => {
        const isAsc = sortBy === field && sortOrder === 'asc';
        setSortOrder(isAsc ? 'desc' : 'asc');
        setSortBy(field);
    };

    const filteredAndSortedApplications = useMemo(() => {
        let filtered = [...applications];

        if (currentTab === 0) {
            filtered = filtered.filter(app => app.status === 'PENDING');
        } else if (currentTab === 1) {
            filtered = filtered.filter(app => app.status === 'APPROVED');
        } else if (currentTab === 2) {
            filtered = filtered.filter(app => app.status === 'REJECTED');
        } else if (currentTab === 3) {
            filtered = filtered.filter(app => app.status === 'WITHDRAWN');
        } else if (event?.workAreas) {
            const targetAreaName = event.workAreas[currentTab - 4]?.name;
            filtered = filtered.filter(app => app.workAreaName === targetAreaName);
        }

        if (areaFilter !== 'ALL') {
            filtered = filtered.filter(app => app.workAreaName === areaFilter);
        }
        if (statusFilter !== 'ALL') {
            filtered = filtered.filter(app => app.status === statusFilter);
        }

        filtered.sort((a, b) => {
            const aVal = (sortBy === 'userName' ? a.userName : a.workAreaName) || '';
            const bVal = (sortBy === 'userName' ? b.userName : b.workAreaName) || '';
            return sortOrder === 'asc'
                ? aVal.localeCompare(bVal, 'hu')
                : bVal.localeCompare(aVal, 'hu');
        });

        return filtered;
    }, [applications, currentTab, areaFilter, statusFilter, sortBy, sortOrder, event]);

    // --- ÚJ, DINAMIKUS EXPORT FUNKCIÓ ---
    const exportToCSV = () => {
        // 1. Alap oszlopfejlécek
        const baseHeaders = ['Név', 'Email', 'Telefon', 'Terület', 'Státusz'];

        // 2. Egyedi kérdések kigyűjtése oszlopfejlécnek
        const questionTexts = event?.questions?.map(q => q.questionText) || [];
        const allHeaders = [...baseHeaders, ...questionTexts];

        // 3. Adatsorok összeállítása
        const rows = filteredAndSortedApplications.map(app => {
            const baseData = [
                `"${app.userName || ''}"`,
                `"${app.userEmail || ''}"`,
                `"${app.userPhone || ''}"`,
                `"${app.workAreaName || ''}"`,
                `"${app.status}"`
            ];

            // Válaszok hozzáadása a megfelelő kérdés-oszlophoz
            const questionAnswers = questionTexts.map(qText => {
                const answer = app.answers && app.answers[qText] ? app.answers[qText] : '-';
                return `"${answer}"`;
            });

            return [...baseData, ...questionAnswers];
        });

        const csvContent = [allHeaders.join(','), ...rows.map(e => e.join(','))].join('\n');

        // UTF-8 BOM és Blob az ékezetek miatt
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.body.appendChild(document.createElement("a"));
        link.href = URL.createObjectURL(blob);
        link.download = `jelentkezok_${event?.title || 'lista'}.csv`;
        link.click();
        document.body.removeChild(link);
    };

    if (loading) return <Box display="flex" justifyContent="center" mt={10}><CircularProgress /></Box>;

    return (
        <Container maxWidth="xl" sx={{ mt: 4, mb: 10 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
                <Box display="flex" alignItems="center">
                    <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/dashboard')} sx={{ mr: 2 }}>Vissza</Button>
                    <Typography variant="h4" fontWeight="bold">
                        {event?.title} jelentkezői
                    </Typography>
                </Box>
                <Button variant="contained" color="success" startIcon={<DownloadIcon />} onClick={exportToCSV}>
                    Lista letöltése (.CSV)
                </Button>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                <Tabs
                    value={currentTab}
                    onChange={(_e, v) => { setCurrentTab(v); setAreaFilter('ALL'); setStatusFilter('ALL'); }}
                    variant="scrollable"
                    scrollButtons="auto"
                >
                    <Tab label="⏳ Elbírálásra vár" />
                    <Tab label="✅ Összes Elfogadott" />
                    <Tab label="❌ Összes Elutasított" />
                    <Tab label="🏳️ Visszavont" />
                    {event?.workAreas.map((area) => (
                        <Tab key={area.id} label={`📍 ${area.name}`} />
                    ))}
                </Tabs>
            </Box>

            <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: '#fbfbfb', display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                {(currentTab <= 3) && (
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                        <InputLabel>Munkaterület</InputLabel>
                        <Select value={areaFilter} label="Munkaterület" onChange={(e) => setAreaFilter(e.target.value)}>
                            <MenuItem value="ALL">Összes terület</MenuItem>
                            {event?.workAreas.map((area) => (
                                <MenuItem key={area.id} value={area.name}>{area.name}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                )}

                {currentTab > 3 && (
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                        <InputLabel>Státusz szűrő</InputLabel>
                        <Select value={statusFilter} label="Státusz szűrő" onChange={(e) => setStatusFilter(e.target.value)}>
                            <MenuItem value="ALL">Összes státusz</MenuItem>
                            <MenuItem value="PENDING">Elbírálás alatt</MenuItem>
                            <MenuItem value="APPROVED">Elfogadva</MenuItem>
                            <MenuItem value="REJECTED">Elutasítva</MenuItem>
                            <MenuItem value="WITHDRAWN">Visszavont</MenuItem>
                        </Select>
                    </FormControl>
                )}

                <Typography variant="body2" sx={{ ml: 'auto', fontWeight: 500 }}>
                    Találatok: {filteredAndSortedApplications.length} fő
                </Typography>
            </Paper>

            <TableContainer component={Paper} elevation={3}>
                <Table>
                    <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                        <TableRow>
                            <TableCell>
                                <TableSortLabel active={sortBy === 'userName'} direction={sortOrder} onClick={() => handleSort('userName')}>
                                    <strong>Név</strong>
                                </TableSortLabel>
                            </TableCell>
                            <TableCell><strong>Elérhetőség</strong></TableCell>
                            <TableCell>
                                <TableSortLabel active={sortBy === 'workAreaName'} direction={sortOrder} onClick={() => handleSort('workAreaName')}>
                                    <strong>Terület</strong>
                                </TableSortLabel>
                            </TableCell>
                            <TableCell align="center"><strong>Művelet</strong></TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredAndSortedApplications.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                                    Nincs megjeleníthető jelentkező ezen a listán.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredAndSortedApplications.map((app) => (
                                <TableRow key={app.id} hover>
                                    <TableCell sx={{ fontWeight: 'bold' }}>{app.userName}</TableCell>
                                    <TableCell>
                                        <Typography variant="body2">{app.userEmail}</Typography>
                                        <Typography variant="caption" color="text.secondary">{app.userPhone || 'Nincs tel.'}</Typography>
                                    </TableCell>
                                    <TableCell>{app.workAreaName}</TableCell>
                                    <TableCell align="center">
                                        <Select
                                            value={app.status}
                                            size="small"
                                            onChange={(e) => handleStatusChange(app.id, e)}
                                            sx={{
                                                minWidth: 150,
                                                fontWeight: 'bold',
                                                bgcolor:
                                                    app.status === 'APPROVED' ? '#e8f5e9' :
                                                        app.status === 'REJECTED' ? '#ffebee' :
                                                            app.status === 'WITHDRAWN' ? '#f5f5f5' : 'white',
                                                color: app.status === 'WITHDRAWN' ? 'text.secondary' : 'inherit'
                                            }}
                                        >
                                            <MenuItem value="PENDING">⏳ Függőben</MenuItem>
                                            <MenuItem value="APPROVED">✅ Elfogadva</MenuItem>
                                            <MenuItem value="REJECTED">❌ Elutasítva</MenuItem>
                                            <MenuItem value="WITHDRAWN" disabled={app.status !== 'WITHDRAWN'}>🏳️ Visszavont</MenuItem>
                                        </Select>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Container>
    );
}