import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom'; // <-- ÚJ IMPORT
import {
    Container, Typography, Box, Paper, CircularProgress, Alert,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip,
    FormControl, InputLabel, Select, MenuItem, InputAdornment, Divider,
    TextField, TablePagination, useMediaQuery, useTheme, Card, CardContent, Button
} from '@mui/material';
import api from '../api/axios';

// Ikonok
import BusinessIcon from '@mui/icons-material/Business';
import SearchIcon from '@mui/icons-material/Search';
import CategoryIcon from '@mui/icons-material/Category';
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

interface AuditLog {
    id: number;
    timestamp: string;
    userEmail: string;
    action: string;
    target: string;
    details: string;
    organizationId?: number;
    organizationName?: string;
}

export default function SystemLogs() {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const navigate = useNavigate(); // <-- ÚJ: Navigáció inicializálása

    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [selectedOrgId, setSelectedOrgId] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [actionFilter, setActionFilter] = useState<string>('ALL');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(15);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const response = await api.get('/audit-logs');
                setLogs(response.data);
            } catch {
                setError('Nem sikerült betölteni a naplót. Nincs jogosultságod vagy hiba történt.');
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, []);

    const availableOrganizations = useMemo(() => {
        const orgs = new Map<number, string>();
        logs.forEach(log => {
            if (log.organizationId && log.organizationName) {
                orgs.set(log.organizationId, log.organizationName);
            }
        });
        return Array.from(orgs.entries()).map(([id, name]) => ({ id, name }));
    }, [logs]);

    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            if (selectedOrgId !== 'ALL' && log.organizationId?.toString() !== selectedOrgId) return false;
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const matchesEmail = log.userEmail?.toLowerCase().includes(query);
                const matchesDetails = log.details?.toLowerCase().includes(query);
                const matchesTarget = log.target?.toLowerCase().includes(query);
                if (!matchesEmail && !matchesDetails && !matchesTarget) return false;
            }
            if (actionFilter !== 'ALL') {
                const a = log.action.toUpperCase();
                if (actionFilter === 'VIEW' && !a.includes('VIEW')) return false;
                if (actionFilter === 'MUTATION' && a.includes('VIEW')) return false;
                if (actionFilter === 'DANGER' && !a.includes('DELETE') && !a.includes('REMOVE') && !a.includes('REJECT')) return false;
            }
            return true;
        });
    }, [logs, selectedOrgId, searchQuery, actionFilter]);

    const paginatedLogs = useMemo(() => {
        const startIndex = page * rowsPerPage;
        return filteredLogs.slice(startIndex, startIndex + rowsPerPage);
    }, [filteredLogs, page, rowsPerPage]);

    // Szigorú MUI szín típusok
    type LogColor = 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';

    const getActionColor = (action: string): LogColor => {
        const a = action.toUpperCase();
        if (a.includes('REJECT') || a.includes('REMOVE') || a.includes('DELETE') || a.includes('WITHDRAW')) return 'error';
        if (a.includes('APPROVE') || a.includes('CREATE') || a.includes('JOIN')) return 'success';
        if (a.includes('UPDATE') || a.includes('EMAIL') || a.includes('NOTE') || a.includes('ASSIGN')) return 'info';
        if (a.includes('VIEW')) return 'default';
        return 'secondary';
    };

    if (loading) return <Box display="flex" justifyContent="center" mt={10}><CircularProgress size={60} /></Box>;

    return (
        <Container maxWidth="xl" sx={{ mt: { xs: 2, sm: 5 }, mb: 10 }}>

            {/* --- ÚJ: VISSZA GOMB --- */}
            <Box mb={2}>
                <Button
                    startIcon={<ArrowBackIcon />}
                    onClick={() => navigate(-1)} // Visszavisz az előző oldalra
                    sx={{ color: 'text.secondary', '&:hover': { bgcolor: 'transparent', color: 'primary.main' } }}
                >
                    Vissza
                </Button>
            </Box>

            {/* FEJLÉC */}
            <Box mb={4}>
                <Typography variant="h4" fontWeight="bold" gutterBottom sx={{ color: '#1a237e', fontSize: { xs: '1.8rem', sm: '2.125rem' } }}>
                    Kiterjesztett Eseménynapló 📜
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Kövesd nyomon a rendszer összes tevékenységét. Használd a szűrőket a gyorsabb kereséshez!
                </Typography>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

            {/* --- PROFI SZŰRŐ SÁV --- */}
            <Paper elevation={2} sx={{ p: 2, mb: 3, borderRadius: 3, bgcolor: '#fbfcfd', border: '1px solid #e0e0e0' }}>
                <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={2}>

                    <TextField
                        fullWidth
                        size="small"
                        placeholder="Keresés email, név vagy esemény alapján..."
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
                        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment> }}
                        sx={{ bgcolor: 'white', flex: 2 }}
                    />

                    {availableOrganizations.length > 0 && (
                        <FormControl size="small" sx={{ flex: 1, bgcolor: 'white' }}>
                            <InputLabel>Szervezet</InputLabel>
                            <Select
                                value={selectedOrgId}
                                label="Szervezet"
                                onChange={(e) => { setSelectedOrgId(e.target.value); setPage(0); }}
                                startAdornment={<InputAdornment position="start"><BusinessIcon fontSize="small" /></InputAdornment>}
                            >
                                <MenuItem value="ALL"><strong>Minden szervezet</strong></MenuItem>
                                <Divider />
                                {availableOrganizations.map(org => (
                                    <MenuItem key={org.id} value={org.id.toString()}>{org.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}

                    <FormControl size="small" sx={{ flex: 1, bgcolor: 'white' }}>
                        <InputLabel>Tevékenység Típusa</InputLabel>
                        <Select
                            value={actionFilter}
                            label="Tevékenység Típusa"
                            onChange={(e) => { setActionFilter(e.target.value); setPage(0); }}
                            startAdornment={<InputAdornment position="start"><CategoryIcon fontSize="small" /></InputAdornment>}
                        >
                            <MenuItem value="ALL">Minden esemény</MenuItem>
                            <MenuItem value="MUTATION">Csak Módosítások (Kritikus)</MenuItem>
                            <MenuItem value="VIEW">Csak Megtekintések (Forgalom)</MenuItem>
                            <MenuItem value="DANGER" sx={{ color: 'error.main', fontWeight: 'bold' }}>Veszélyes Műveletek</MenuItem>
                        </Select>
                    </FormControl>
                </Box>
            </Paper>

            {/* --- NAPLÓ MEGJELENÍTÉSE --- */}
            {isMobile ? (
                // MOBIL NÉZET
                <Box>
                    <Box display="flex" flexDirection="column" gap={2}>
                        {paginatedLogs.length === 0 ? (
                            <Typography color="text.secondary" textAlign="center" py={4}>Nincs találat.</Typography>
                        ) : (
                            paginatedLogs.map(log => (
                                <Card key={log.id} variant="outlined" sx={{ borderRadius: 2, borderLeft: '4px solid', borderLeftColor: getActionColor(log.action) === 'default' ? 'grey.400' : `${getActionColor(log.action)}.main` }}>
                                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                                            <Typography variant="caption" color="text.secondary">
                                                {new Date(log.timestamp).toLocaleString('hu-HU')}
                                            </Typography>
                                            <Chip label={log.action} size="small" color={getActionColor(log.action)} sx={{ height: 20, fontSize: '0.65rem', fontWeight: 'bold' }} />
                                        </Box>
                                        <Typography variant="subtitle2" fontWeight="bold">{log.userEmail}</Typography>
                                        <Typography variant="caption" color={log.organizationName ? "primary.main" : "text.disabled"} display="block" mb={1}>
                                            {log.organizationName || 'Rendszer'}
                                        </Typography>
                                        <Typography variant="body2" sx={{ bgcolor: '#f5f5f5', p: 1, borderRadius: 1 }}>
                                            {log.target && <strong>[{log.target}] </strong>}
                                            {log.details}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </Box>

                    {/* MOBILOS LAPOZÓ */}
                    <Paper elevation={0} sx={{ mt: 3, borderRadius: 3, border: '1px solid #e0e0e0', display: 'flex', justifyContent: 'center' }}>
                        <TablePagination
                            rowsPerPageOptions={[15, 30, 50]}
                            component="div"
                            count={filteredLogs.length}
                            rowsPerPage={rowsPerPage}
                            page={page}
                            onPageChange={(_e, newPage) => setPage(newPage)}
                            onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                            labelRowsPerPage="Sorok:"
                            labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`}
                            sx={{ '.MuiTablePagination-toolbar': { px: 1 }, '.MuiTablePagination-selectLabel': { display: 'none' } }}
                        />
                    </Paper>
                </Box>
            ) : (
                // ASZTALI NÉZET
                <Paper elevation={3} sx={{ borderRadius: 3, overflow: 'hidden' }}>
                    <TableContainer>
                        <Table size="small">
                            <TableHead sx={{ bgcolor: '#1a237e' }}>
                                <TableRow>
                                    <TableCell sx={{ color: 'white', py: 2 }}><strong>Időpont</strong></TableCell>
                                    <TableCell sx={{ color: 'white' }}><strong>Felelős</strong></TableCell>
                                    <TableCell sx={{ color: 'white' }}><strong>Művelet</strong></TableCell>
                                    <TableCell sx={{ color: 'white' }}><strong>Szervezet</strong></TableCell>
                                    <TableCell sx={{ color: 'white' }}><strong>Részletek</strong></TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {paginatedLogs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                                            <Typography color="text.secondary" variant="h6">Nincs találat.</Typography>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedLogs.map((log) => (
                                        <TableRow key={log.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                                            <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                                                {new Date(log.timestamp).toLocaleString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                            </TableCell>
                                            <TableCell><Typography variant="body2" fontWeight="500">{log.userEmail}</Typography></TableCell>
                                            <TableCell><Chip label={log.action} size="small" color={getActionColor(log.action)} sx={{ fontWeight: 'bold', fontSize: '0.7rem', borderRadius: '4px' }} /></TableCell>
                                            <TableCell>
                                                {log.organizationName ? <Typography variant="body2" fontWeight="bold" color="primary.main">{log.organizationName}</Typography> : <Typography variant="caption" color="text.disabled">Rendszer</Typography>}
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" color="text.primary">{log.target && <strong>[{log.target}] </strong>}{log.details}</Typography>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    {/* ASZTALI LAPOZÓ */}
                    <TablePagination
                        rowsPerPageOptions={[15, 30, 50, 100]}
                        component="div"
                        count={filteredLogs.length}
                        rowsPerPage={rowsPerPage}
                        page={page}
                        onPageChange={(_e, newPage) => setPage(newPage)}
                        onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                        labelRowsPerPage="Sorok száma:"
                        labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`}
                    />
                </Paper>
            )}
        </Container>
    );
}