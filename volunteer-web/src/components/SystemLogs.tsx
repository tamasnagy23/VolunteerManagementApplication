import { useEffect, useState, useMemo } from 'react';
import {
    Container, Typography, Box, Paper, CircularProgress, Alert,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip,
    FormControl, InputLabel, Select, MenuItem, InputAdornment, Divider,
    TextField, TablePagination, useMediaQuery, useTheme, Card, CardContent, alpha, Fade
} from '@mui/material';
import api from '../api/axios';

// Ikonok
import BusinessIcon from '@mui/icons-material/Business';
import SearchIcon from '@mui/icons-material/Search';
import CategoryIcon from '@mui/icons-material/Category';

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
    const isDarkMode = theme.palette.mode === 'dark';
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

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
        <Fade in={true} timeout={500}>
            <Container maxWidth="xl" sx={{ mt: { xs: 2, sm: 4 }, mb: 10 }}>

                {/* FEJLÉC */}
                <Box mb={4}>
                    <Typography variant="h4" fontWeight="900" gutterBottom sx={{ color: isDarkMode ? 'primary.light' : 'primary.main', fontSize: { xs: '1.8rem', sm: '2.5rem' }, letterSpacing: '-0.5px' }}>
                        Kiterjesztett Eseménynapló 📜
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Kövesd nyomon a rendszer összes tevékenységét. Használd a szűrőket a gyorsabb kereséshez!
                    </Typography>
                </Box>

                {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

                {/* --- PROFI SZŰRŐ SÁV --- */}
                <Paper elevation={0} sx={{
                    p: { xs: 2, sm: 3 }, mb: 4,
                    borderRadius: 4,
                    bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc',
                    border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#e2e8f0'
                }}>
                    <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={2}>
                        <TextField
                            fullWidth
                            size="small"
                            placeholder="Keresés email, név vagy esemény alapján..."
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
                            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon color="action" /></InputAdornment> }}
                            sx={{ flex: 2, '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'white', borderRadius: 2 } }}
                        />

                        {availableOrganizations.length > 0 && (
                            <FormControl size="small" sx={{ flex: 1, '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'white', borderRadius: 2 } }}>
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

                        <FormControl size="small" sx={{ flex: 1, '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'white', borderRadius: 2 } }}>
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
                                <Paper elevation={0} sx={{ p: 4, textAlign: 'center', borderRadius: 4, bgcolor: 'transparent', border: '1px dashed', borderColor: 'divider' }}>
                                    <Typography color="text.secondary">Nincs a keresésnek megfelelő naplóbejegyzés.</Typography>
                                </Paper>
                            ) : (
                                paginatedLogs.map(log => {
                                    const actionColor = getActionColor(log.action);
                                    return (
                                        <Card key={log.id} elevation={0} sx={{
                                            borderRadius: 3,
                                            bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.4)' : 'white',
                                            border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'divider',
                                            borderLeft: `4px solid ${actionColor === 'default' ? theme.palette.grey[400] : theme.palette[actionColor].main}`
                                        }}>
                                            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                                                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                                                    <Typography variant="caption" color="text.secondary" fontWeight="bold">
                                                        {new Date(log.timestamp).toLocaleString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </Typography>
                                                    <Chip label={log.action} size="small" color={actionColor} sx={{ height: 22, fontSize: '0.7rem', fontWeight: 'bold', borderRadius: 1.5 }} />
                                                </Box>
                                                <Typography variant="subtitle2" fontWeight="900" color="text.primary">{log.userEmail}</Typography>
                                                <Typography variant="caption" color={log.organizationName ? "primary.main" : "text.secondary"} display="block" mb={1.5} fontWeight="bold">
                                                    {log.organizationName || 'Rendszer Szintű'}
                                                </Typography>
                                                <Typography variant="body2" color="text.primary" sx={{ bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : '#f8fafc', p: 1.5, borderRadius: 2, border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#e2e8f0' }}>
                                                    {log.target && <strong style={{ color: theme.palette.primary.main }}>[{log.target}] </strong>}
                                                    {log.details}
                                                </Typography>
                                            </CardContent>
                                        </Card>
                                    );
                                })
                            )}
                        </Box>

                        {/* MOBILOS LAPOZÓ */}
                        {filteredLogs.length > 0 && (
                            <Paper elevation={0} sx={{ mt: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider', bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.5)' : 'white', display: 'flex', justifyContent: 'center' }}>
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
                        )}
                    </Box>
                ) : (
                    // ASZTALI NÉZET
                    <Paper elevation={0} sx={{
                        borderRadius: 4, overflow: 'hidden',
                        bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.4)' : 'white',
                        border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider'
                    }}>
                        <TableContainer>
                            <Table size="medium">
                                <TableHead sx={{ bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(248, 250, 252, 1)' }}>
                                    <TableRow>
                                        <TableCell sx={{ py: 2 }}><Typography variant="subtitle2" fontWeight="800" color="text.secondary" sx={{ textTransform: 'uppercase' }}>Időpont</Typography></TableCell>
                                        <TableCell><Typography variant="subtitle2" fontWeight="800" color="text.secondary" sx={{ textTransform: 'uppercase' }}>Felelős Felhasználó</Typography></TableCell>
                                        <TableCell><Typography variant="subtitle2" fontWeight="800" color="text.secondary" sx={{ textTransform: 'uppercase' }}>Művelet</Typography></TableCell>
                                        <TableCell><Typography variant="subtitle2" fontWeight="800" color="text.secondary" sx={{ textTransform: 'uppercase' }}>Szervezet</Typography></TableCell>
                                        <TableCell><Typography variant="subtitle2" fontWeight="800" color="text.secondary" sx={{ textTransform: 'uppercase' }}>Részletek</Typography></TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {paginatedLogs.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} align="center" sx={{ py: 8 }}>
                                                <Typography color="text.secondary" variant="body1" fontStyle="italic">Nincs a keresésnek megfelelő naplóbejegyzés.</Typography>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        paginatedLogs.map((log) => {
                                            const actionColor = getActionColor(log.action);
                                            return (
                                                <TableRow key={log.id} hover sx={{
                                                    '&:last-child td, &:last-child th': { border: 0 },
                                                    transition: 'background-color 0.2s',
                                                    '&:hover': { bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }
                                                }}>
                                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                                        <Typography variant="body2" color="text.secondary" fontWeight="500">
                                                            {new Date(log.timestamp).toLocaleString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" fontWeight="bold" color="text.primary">{log.userEmail}</Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip label={log.action} size="small" color={actionColor} variant={isDarkMode ? 'filled' : 'soft'} sx={{ fontWeight: 'bold', fontSize: '0.7rem', borderRadius: 1.5, bgcolor: !isDarkMode && actionColor !== 'default' ? alpha(theme.palette[actionColor].main, 0.1) : undefined, color: !isDarkMode && actionColor !== 'default' ? `${actionColor}.dark` : undefined }} />
                                                    </TableCell>
                                                    <TableCell>
                                                        {log.organizationName ? <Typography variant="body2" fontWeight="bold" color="primary.main">{log.organizationName}</Typography> : <Typography variant="caption" color="text.secondary" fontWeight="bold">Rendszer</Typography>}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" color="text.primary" sx={{ wordBreak: 'break-word' }}>
                                                            {log.target && <strong style={{ color: theme.palette.primary.main }}>[{log.target}] </strong>}
                                                            {log.details}
                                                        </Typography>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>

                        {/* ASZTALI LAPOZÓ */}
                        {filteredLogs.length > 0 && (
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
                                sx={{ borderTop: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'divider', bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'transparent' }}
                            />
                        )}
                    </Paper>
                )}
            </Container>
        </Fade>
    );
}