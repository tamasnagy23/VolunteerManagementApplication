import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Container, Typography, Box, Paper, Button, CircularProgress,
    Alert, Tabs, Tab, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Select, MenuItem, FormControl, InputLabel,
    TableSortLabel, Checkbox, IconButton, Collapse,
    Dialog, DialogTitle, DialogContent, DialogActions, Avatar, Chip, Divider, TextField,
    useMediaQuery, useTheme, FormControlLabel
} from '@mui/material';
import Grid from '@mui/material/Grid';
import type { SelectChangeEvent } from '@mui/material';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DownloadIcon from '@mui/icons-material/Download';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CloseIcon from '@mui/icons-material/Close';
import EmailIcon from '@mui/icons-material/Email';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import api from '../api/axios';
import axios from 'axios';
import * as XLSX from 'xlsx';

// --- INTERFÉSZEK ---
interface Application {
    id: number;
    userName: string;
    userEmail: string;
    userPhone: string;
    workAreaName: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
    answers: Record<string, string>;
    userAvatar?: string;
    userJoinDate?: string;
    userOrgRole?: string;
    adminNote?: string;
    rejectionMessage?: string;
    withdrawalReason?: string;
}

interface WorkArea { id: number; name: string; capacity?: number; }
interface EventQuestion { id: number; questionText: string; }
interface EventData { id: number; title: string; workAreas: WorkArea[]; questions: EventQuestion[]; }
interface GroupedApplication { userName: string; userEmail: string; userPhone: string; areas: string[]; statuses: string[]; answers: Record<string, string>; }
type SortField = 'userName' | 'workAreaName';
type SortOrder = 'asc' | 'desc';

// --- ASZTALI NÉZET: TÁBLÁZAT SOR ---
function ApplicationRow({ app, isSelected, onSelect, onStatusChange, questions, onNoteUpdated }: { app: Application, isSelected: boolean, onSelect: (id: number) => void, onStatusChange: (id: number, e: SelectChangeEvent<string>) => void, questions: EventQuestion[], onNoteUpdated: (id: number, note: string) => void }) {
    const [open, setOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [note, setNote] = useState(app.adminNote || '');
    const [savingNote, setSavingNote] = useState(false);

    useEffect(() => { setNote(app.adminNote || ''); }, [app.adminNote]);

    const handleSaveNote = async () => {
        setSavingNote(true);
        try {
            await api.put(`/applications/${app.id}/note`, { note });
            onNoteUpdated(app.id, note);
        } catch {
            alert("Hiba a megjegyzés mentésekor.");
        } finally {
            setSavingNote(false);
        }
    };

    return (
        <React.Fragment>
            <TableRow hover selected={isSelected} sx={{ '& > *': { borderBottom: 'unset' } }}>
                <TableCell padding="checkbox"><Checkbox checked={isSelected} onChange={() => onSelect(app.id)} /></TableCell>
                <TableCell sx={{ minWidth: '100px' }}>
                    <Box display="flex" gap={1}>
                        <IconButton size="small" onClick={() => setOpen(!open)} title="Részletek megtekintése">
                            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                        </IconButton>
                        <IconButton size="small" color="primary" onClick={() => setProfileOpen(true)} title="Profil megtekintése">
                            <VisibilityIcon />
                        </IconButton>
                    </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>{app.userName}</TableCell>
                <TableCell>
                    <Typography variant="body2">{app.userEmail}</Typography>
                    <Typography variant="caption" color="text.secondary">{app.userPhone || 'Nincs tel.'}</Typography>
                </TableCell>
                <TableCell>{app.workAreaName}</TableCell>
                <TableCell align="center">
                    <Select
                        value={app.status} size="small" onChange={(e) => onStatusChange(app.id, e as SelectChangeEvent<string>)}
                        sx={{ minWidth: 150, fontWeight: 'bold', bgcolor: app.status === 'APPROVED' ? '#e8f5e9' : app.status === 'REJECTED' ? '#ffebee' : app.status === 'WITHDRAWN' ? '#f5f5f5' : 'white', color: app.status === 'WITHDRAWN' ? 'text.secondary' : 'inherit' }}
                    >
                        <MenuItem value="PENDING">⏳ Függőben</MenuItem>
                        <MenuItem value="APPROVED">✅ Elfogadva</MenuItem>
                        <MenuItem value="REJECTED">❌ Elutasítva</MenuItem>
                        <MenuItem value="WITHDRAWN" disabled={app.status !== 'WITHDRAWN'}>🏳️ Visszavont</MenuItem>
                    </Select>
                </TableCell>
            </TableRow>

            <TableRow>
                <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
                    <Collapse in={open} timeout="auto" unmountOnExit>
                        <Box sx={{ margin: 1, p: 2, bgcolor: '#f8fbff', borderRadius: 2, border: '1px solid #e0e0e0' }}>

                            {app.status === 'WITHDRAWN' && app.withdrawalReason && (
                                <Alert severity="warning" sx={{ mb: 2, border: '1px solid #ffcc80' }}>
                                    <strong>Visszavonás indoka:</strong> {app.withdrawalReason}
                                </Alert>
                            )}

                            {app.status === 'REJECTED' && app.rejectionMessage && (
                                <Alert severity="error" sx={{ mb: 2 }}><strong>Elutasítás indoka:</strong> {app.rejectionMessage}</Alert>
                            )}

                            <Typography variant="subtitle2" gutterBottom color="primary" fontWeight="bold">📝 Kérdőív válaszai</Typography>
                            {questions && questions.length > 0 ? (
                                <Grid container spacing={2} sx={{ mt: 1 }}>
                                    {questions.map((q, idx) => (
                                        <Grid size={{xs:12, sm:6, md:4}} key={idx}>
                                            <Typography variant="caption" color="text.secondary" display="block">{q.questionText}</Typography>
                                            <Typography variant="body2" fontWeight="500">{app.answers?.[q.questionText] || '- Nincs megadva -'}</Typography>
                                        </Grid>
                                    ))}
                                </Grid>
                            ) : ( <Typography variant="body2" color="text.secondary">Ehhez a jelentkezéshez nincsenek extra kérdések.</Typography> )}

                            <Divider sx={{ my: 2 }} />
                            <Typography variant="subtitle2" gutterBottom color="secondary" fontWeight="bold">🔒 Szervezői megjegyzés (Privát)</Typography>
                            <Box display="flex" gap={2} alignItems="flex-start" mt={1}>
                                <TextField size="small" fullWidth multiline rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ide írhatsz belső megjegyzést az önkéntesről..." sx={{ bgcolor: 'white' }} />
                                <Button variant="contained" color="secondary" onClick={handleSaveNote} disabled={savingNote || note === (app.adminNote || '')} sx={{ height: '40px', minWidth: '100px' }}>{savingNote ? 'Mentés...' : 'Mentés'}</Button>
                            </Box>
                        </Box>
                    </Collapse>
                </TableCell>
            </TableRow>

            <Dialog open={profileOpen} onClose={() => setProfileOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#f5f5f5', pb: 1.5 }}><Typography variant="h6" fontWeight="bold">Önkéntes Profil</Typography><IconButton size="small" onClick={() => setProfileOpen(false)}><CloseIcon /></IconButton></DialogTitle>
                <DialogContent sx={{ mt: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <Avatar src={app.userAvatar} sx={{ width: 90, height: 90, mb: 2, bgcolor: 'primary.main', fontSize: '2.5rem', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>{app.userName ? app.userName.charAt(0).toUpperCase() : '?'}</Avatar>
                    <Typography variant="h5" fontWeight="bold">{app.userName}</Typography>
                    <Typography variant="body2" color="text.secondary" mb={3}>{app.userEmail}</Typography>
                    <Box sx={{ width: '100%' }}>
                        <Divider sx={{ mb: 2 }} />
                        <Grid container spacing={2}>
                            <Grid size={{xs:6}}><Typography variant="caption" color="text.secondary" display="block">Telefon</Typography><Typography variant="body2" fontWeight="500">{app.userPhone || 'Nincs megadva'}</Typography></Grid>
                            <Grid size={{xs:6}}><Typography variant="caption" color="text.secondary" display="block">Csatlakozás</Typography><Typography variant="body2" fontWeight="500">{app.userJoinDate || 'Jelentkező'}</Typography></Grid>
                            <Grid size={{xs:12}} sx={{ mt: 1, textAlign: 'center' }}><Typography variant="caption" color="text.secondary" display="block" mb={0.5}>Jogosultság a szervezetben</Typography><Chip label={app.userOrgRole || 'Önkéntes'} color={app.userOrgRole === 'Szervező' ? 'secondary' : 'primary'} variant="outlined" sx={{ fontWeight: 'bold' }} /></Grid>
                        </Grid>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 2, bgcolor: '#fafafa' }}><Button onClick={() => setProfileOpen(false)} variant="contained" size="small" disableElevation>Bezárás</Button></DialogActions>
            </Dialog>
        </React.Fragment>
    );
}

// --- MOBILOS NÉZET: KÁRTYA ELRENDEZÉS ---
function ApplicationCard({ app, isSelected, onSelect, onStatusChange, questions, onNoteUpdated }: { app: Application, isSelected: boolean, onSelect: (id: number) => void, onStatusChange: (id: number, e: SelectChangeEvent<string>) => void, questions: EventQuestion[], onNoteUpdated: (id: number, note: string) => void }) {
    const [open, setOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [note, setNote] = useState(app.adminNote || '');
    const [savingNote, setSavingNote] = useState(false);

    useEffect(() => { setNote(app.adminNote || ''); }, [app.adminNote]);

    const handleSaveNote = async () => {
        setSavingNote(true);
        try {
            await api.put(`/applications/${app.id}/note`, { note });
            onNoteUpdated(app.id, note);
        } catch { alert("Hiba a megjegyzés mentésekor."); } finally { setSavingNote(false); }
    };

    return (
        <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 3, borderColor: isSelected ? 'primary.main' : 'divider', bgcolor: isSelected ? '#f4fafe' : 'white', boxShadow: isSelected ? '0 0 0 1px #1976d2' : 'none' }}>
            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                <Box display="flex" alignItems="flex-start" gap={1} width="100%">
                    <Checkbox checked={isSelected} onChange={() => onSelect(app.id)} sx={{ p: 0, mt: 0.5 }} />
                    <Box flexGrow={1}>
                        <Typography variant="subtitle1" fontWeight="bold" lineHeight={1.2}>{app.userName}</Typography>
                        <Typography variant="body2" color="text.secondary" mt={0.5} sx={{ wordBreak: 'break-all' }}>{app.userEmail}</Typography>
                    </Box>
                </Box>
            </Box>
            <Box pl={4} mb={2}>
                <Typography variant="caption" color="text.secondary" display="block">📱 {app.userPhone || 'Nincs tel.'}</Typography>
                <Chip label={app.workAreaName} size="small" color="primary" variant="outlined" sx={{ mt: 1, fontWeight: 'bold' }} />
            </Box>

            <Box display="flex" flexDirection="column" gap={1.5} pl={4} mb={1}>
                <Select value={app.status} size="small" fullWidth onChange={(e) => onStatusChange(app.id, e as SelectChangeEvent<string>)} sx={{ height: 36, fontSize: '0.85rem', fontWeight: 'bold', bgcolor: app.status === 'APPROVED' ? '#e8f5e9' : app.status === 'REJECTED' ? '#ffebee' : app.status === 'WITHDRAWN' ? '#f5f5f5' : 'white', color: app.status === 'WITHDRAWN' ? 'text.secondary' : 'inherit' }}>
                    <MenuItem value="PENDING">⏳ Függő</MenuItem>
                    <MenuItem value="APPROVED">✅ Elfogadva</MenuItem>
                    <MenuItem value="REJECTED">❌ Elutasítva</MenuItem>
                    <MenuItem value="WITHDRAWN" disabled={app.status !== 'WITHDRAWN'}>🏳️ Visszavont</MenuItem>
                </Select>
                <Box display="flex" gap={1}>
                    <Button fullWidth size="small" variant="outlined" startIcon={open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />} onClick={() => setOpen(!open)}>Részletek</Button>
                    <Button fullWidth size="small" variant="contained" color="primary" disableElevation startIcon={<VisibilityIcon />} onClick={() => setProfileOpen(true)}>Profil</Button>
                </Box>
            </Box>

            <Collapse in={open} timeout="auto" unmountOnExit>
                <Box sx={{ mt: 2, p: 2, bgcolor: '#f8fbff', borderRadius: 2, border: '1px solid #e0e0e0' }}>

                    {app.status === 'WITHDRAWN' && app.withdrawalReason && (
                        <Box sx={{ mb: 2, p: 1.5, bgcolor: '#fff3e0', borderRadius: 1, borderLeft: '4px solid #ff9800' }}>
                            <Typography variant="body2" color="warning.dark">
                                <strong>Visszavonásod indoka:</strong> {app.withdrawalReason}
                            </Typography>
                        </Box>
                    )}

                    {app.status === 'REJECTED' && app.rejectionMessage && <Alert severity="error" sx={{ mb: 2 }}><strong>Indok:</strong> {app.rejectionMessage}</Alert>}

                    <Typography variant="subtitle2" gutterBottom color="primary" fontWeight="bold">📝 Válaszok</Typography>
                    {questions && questions.length > 0 ? (
                        <Box sx={{ mt: 1 }}>{questions.map((q, idx) => (<Box key={idx} mb={1.5}><Typography variant="caption" color="text.secondary" display="block">{q.questionText}</Typography><Typography variant="body2" fontWeight="500">{app.answers?.[q.questionText] || '- Nincs megadva -'}</Typography></Box>))}</Box>
                    ) : ( <Typography variant="body2" color="text.secondary">Nincsenek extra kérdések.</Typography> )}
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" gutterBottom color="secondary" fontWeight="bold">🔒 Belső megjegyzés</Typography>
                    <TextField size="small" fullWidth multiline rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Megjegyzés..." sx={{ bgcolor: 'white', mb: 1.5 }} />
                    <Button variant="contained" color="secondary" onClick={handleSaveNote} disabled={savingNote || note === (app.adminNote || '')} fullWidth>{savingNote ? 'Mentés...' : 'Mentés'}</Button>
                </Box>
            </Collapse>

            <Dialog open={profileOpen} onClose={() => setProfileOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#f5f5f5', pb: 1.5 }}><Typography variant="h6" fontWeight="bold">Önkéntes Profil</Typography><IconButton size="small" onClick={() => setProfileOpen(false)}><CloseIcon /></IconButton></DialogTitle>
                <DialogContent sx={{ mt: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <Avatar src={app.userAvatar} sx={{ width: 90, height: 90, mb: 2, bgcolor: 'primary.main', fontSize: '2.5rem', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>{app.userName ? app.userName.charAt(0).toUpperCase() : '?'}</Avatar>
                    <Typography variant="h5" fontWeight="bold" align="center">{app.userName}</Typography>
                    <Typography variant="body2" color="text.secondary" mb={3} align="center">{app.userEmail}</Typography>
                    <Box sx={{ width: '100%' }}>
                        <Divider sx={{ mb: 2 }} />
                        <Grid container spacing={2}>
                            <Grid size={{xs:6}}><Typography variant="caption" color="text.secondary" display="block">Telefon</Typography><Typography variant="body2" fontWeight="500">{app.userPhone || 'Nincs megadva'}</Typography></Grid>
                            <Grid size={{xs:6}}><Typography variant="caption" color="text.secondary" display="block">Csatlakozás</Typography><Typography variant="body2" fontWeight="500">{app.userJoinDate || 'Jelentkező'}</Typography></Grid>
                            <Grid size={{xs:12}} sx={{ mt: 1, textAlign: 'center' }}><Typography variant="caption" color="text.secondary" display="block" mb={0.5}>Jogosultság a szervezetben</Typography><Chip label={app.userOrgRole || 'Önkéntes'} color={app.userOrgRole === 'Szervező' ? 'secondary' : 'primary'} variant="outlined" sx={{ fontWeight: 'bold' }} /></Grid>
                        </Grid>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 2, bgcolor: '#fafafa' }}><Button onClick={() => setProfileOpen(false)} variant="contained" size="small" disableElevation>Bezárás</Button></DialogActions>
            </Dialog>
        </Paper>
    );
}

// --- FŐ KOMPONENS ---
export default function ManageApplications() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const [event, setEvent] = useState<EventData | null>(null);
    const [applications, setApplications] = useState<Application[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const [currentTab, setCurrentTab] = useState<number>(0);
    const [areaFilter, setAreaFilter] = useState<string>('ALL');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [sortBy, setSortBy] = useState<SortField>('userName');
    const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [rejectMessage, setRejectMessage] = useState('');
    const [rejectTarget, setRejectTarget] = useState<number | 'BULK' | null>(null);

    const [emailModalOpen, setEmailModalOpen] = useState(false);
    const [emailSubject, setEmailSubject] = useState('');
    const [emailMessage, setEmailMessage] = useState('');
    const [sendingEmail, setSendingEmail] = useState(false);
    const [emailSuccessOpen, setEmailSuccessOpen] = useState(false);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [eventRes, appsRes] = await Promise.all([
                api.get(`/events/${id}`),
                api.get(`/applications/event/${id}`, { params: { t: new Date().getTime() } })
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

    const handleStatusChange = async (appId: number, eventSelect: SelectChangeEvent<string>) => {
        const newStatus = eventSelect.target.value;
        if (newStatus === 'REJECTED') {
            setRejectTarget(appId);
            setRejectMessage('');
            setRejectModalOpen(true);
            return;
        }
        try {
            await api.put(`/applications/${appId}/status`, null, { params: { status: newStatus } });
            fetchData();
        } catch { alert("Hiba."); }
    };

    const handleBulkStatusChange = async (newStatus: string) => {
        if (newStatus === 'REJECTED') {
            setRejectTarget('BULK');
            setRejectMessage('');
            setRejectModalOpen(true);
            return;
        }
        if (!window.confirm(`Biztosan módosítod ${selectedIds.length} jelentkező státuszát?`)) return;
        try {
            setLoading(true);
            await api.put(`/applications/bulk-status`, selectedIds, { params: { status: newStatus } });
            setSelectedIds([]);
            await fetchData();
            alert("Sikeres tömeges módosítás!");
        } catch { alert("Hiba történt a tömeges módosítás során."); } finally { setLoading(false); }
    };

    const confirmRejection = async () => {
        try {
            setLoading(true);
            if (rejectTarget === 'BULK') {
                await api.put(`/applications/bulk-status`, selectedIds, { params: { status: 'REJECTED', rejectionMessage: rejectMessage.trim() || undefined } });
                setSelectedIds([]);
            } else if (rejectTarget !== null) {
                await api.put(`/applications/${rejectTarget}/status`, null, { params: { status: 'REJECTED', rejectionMessage: rejectMessage.trim() || undefined } });
            }
            setRejectModalOpen(false);
            await fetchData();
        } catch { alert("Hiba történt az elutasítás során."); } finally { setLoading(false); }
    };

    const handleSendEmail = async () => {
        setSendingEmail(true);
        try {
            await api.post('/applications/bulk-email', {
                applicationIds: selectedIds, subject: emailSubject, message: emailMessage
            });
            setEmailModalOpen(false);
            setEmailSubject('');
            setEmailMessage('');
            setSelectedIds([]);
            setEmailSuccessOpen(true);
        } catch {
            alert("Hiba történt az üzenetek küldésekor.");
        } finally {
            setSendingEmail(false);
        }
    };

    const handleNoteUpdated = (appId: number, newNote: string) => {
        setApplications(prev => prev.map(a => a.id === appId ? { ...a, adminNote: newNote } : a));
    };

    const handleSort = (field: SortField) => {
        const isAsc = sortBy === field && sortOrder === 'asc';
        setSortOrder(isAsc ? 'desc' : 'asc');
        setSortBy(field);
    };

    // --- ASZTALI FÜLEK VÁLTÁSA ---
    const handleTabChange = (_e: React.SyntheticEvent, newValue: number) => {
        setCurrentTab(newValue);
        setAreaFilter('ALL');
        setStatusFilter('ALL');
        setSelectedIds([]);
    };

    // --- MOBILOS LEGÖRDÜLŐ MENÜ VÁLTÁSA ---
    const handleMobileTabChange = (event: SelectChangeEvent<number>) => {
        setCurrentTab(Number(event.target.value));
        setAreaFilter('ALL');
        setStatusFilter('ALL');
        setSelectedIds([]);
    };

    const filteredAndSortedApplications = useMemo(() => {
        let filtered = [...applications];
        if (currentTab === 0) filtered = filtered.filter(app => app.status === 'PENDING');
        else if (currentTab === 1) filtered = filtered.filter(app => app.status === 'APPROVED');
        else if (currentTab === 2) filtered = filtered.filter(app => app.status === 'REJECTED');
        else if (currentTab === 3) filtered = filtered.filter(app => app.status === 'WITHDRAWN');
        else if (event?.workAreas) {
            const targetAreaName = event?.workAreas[currentTab - 4]?.name;
            if (targetAreaName) {
                filtered = filtered.filter(app => app.workAreaName === targetAreaName);
            }
        }

        if (areaFilter !== 'ALL') filtered = filtered.filter(app => app.workAreaName === areaFilter);
        if (statusFilter !== 'ALL') filtered = filtered.filter(app => app.status === statusFilter);

        filtered.sort((a, b) => {
            const aVal = (sortBy === 'userName' ? a.userName : a.workAreaName) || '';
            const bVal = (sortBy === 'userName' ? b.userName : b.workAreaName) || '';
            return sortOrder === 'asc' ? aVal.localeCompare(bVal, 'hu') : bVal.localeCompare(aVal, 'hu');
        });

        return filtered;
    }, [applications, currentTab, areaFilter, statusFilter, sortBy, sortOrder, event]);

    const handleSelectAllClick = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(filteredAndSortedApplications.map(app => app.id));
            return;
        }
        setSelectedIds([]);
    };

    const handleSelectRow = (id: number) => { setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]); };

    const getCount = (filterFn: (app: Application) => boolean) => applications.filter(filterFn).length;

    const generateSheetData = (appsToExport: Application[]) => {
        const baseHeaders = ['Név', 'Email', 'Telefon', 'Jelentkezett Területek', 'Státuszok'];
        const questionTexts = event?.questions?.map(q => q.questionText) || [];
        const allHeaders = [...baseHeaders, ...questionTexts];

        const groupedData = new Map<string, GroupedApplication>();

        appsToExport.forEach(app => {
            if (!groupedData.has(app.userEmail)) {
                groupedData.set(app.userEmail, { userName: app.userName, userEmail: app.userEmail, userPhone: app.userPhone, areas: [], statuses: [], answers: app.answers || {} });
            }
            const g = groupedData.get(app.userEmail)!;
            if (!g.areas.includes(app.workAreaName)) g.areas.push(app.workAreaName);
            const statusHu = app.status === 'PENDING' ? 'Függő' : app.status === 'APPROVED' ? 'Elfogadva' : app.status === 'REJECTED' ? 'Elutasítva' : 'Visszavont';
            g.statuses.push(`${app.workAreaName}: ${statusHu}`);
            g.answers = { ...g.answers, ...app.answers };
        });

        const rows = Array.from(groupedData.values()).map(g => {
            const baseData = [g.userName || '', g.userEmail || '', g.userPhone || '', g.areas.join(', '), g.statuses.join(' | ')];
            const questionAnswers = questionTexts.map(qText => g.answers[qText] || '-');
            return [...baseData, ...questionAnswers];
        });

        return [allHeaders, ...rows];
    };

    const exportToExcel = () => {
        const wb = XLSX.utils.book_new();
        const safeSheetName = (name: string) => name.substring(0, 31).replace(/[\\/*?:[\]]/g, '');

        const currentData = generateSheetData(filteredAndSortedApplications);
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(currentData), "Aktuális Szűrés");

        const pendingData = generateSheetData(applications.filter(a => a.status === 'PENDING'));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pendingData), "Függőben");

        const approvedData = generateSheetData(applications.filter(a => a.status === 'APPROVED'));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(approvedData), "Elfogadva");

        const rejectedData = generateSheetData(applications.filter(a => a.status === 'REJECTED'));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rejectedData), "Elutasítva");

        const withdrawnData = generateSheetData(applications.filter(a => a.status === 'WITHDRAWN'));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(withdrawnData), "Visszavont");

        event?.workAreas?.forEach(area => {
            const areaData = generateSheetData(applications.filter(a => a.workAreaName === area.name));
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(areaData), safeSheetName(area.name));
        });

        XLSX.writeFile(wb, `jelentkezok_${event?.title || 'lista'}.xlsx`);
    };

    const selectedApps = applications.filter(app => selectedIds.includes(app.id));
    const disableApproveBtn = selectedApps.length > 0 && (selectedApps.every(app => app.status === 'APPROVED') || selectedApps.some(app => app.status === 'WITHDRAWN'));
    const disableRejectBtn = selectedApps.length > 0 && (selectedApps.every(app => app.status === 'REJECTED') || selectedApps.some(app => app.status === 'WITHDRAWN'));

    if (loading && !rejectModalOpen) return <Box display="flex" justifyContent="center" mt={10}><CircularProgress /></Box>;

    return (
        <Container maxWidth="xl" sx={{ mt: { xs: 2, sm: 4 }, mb: 10, px: { xs: 1, sm: 2, md: 3 } }}>
            {/* FEJLÉC */}
            <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} gap={2} mb={3}>
                <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} gap={1}>
                    <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/dashboard')} sx={{ alignSelf: 'flex-start' }}>Vissza</Button>
                    <Typography variant="h5" sx={{ fontSize: { xs: '1.4rem', md: '2.125rem' }, fontWeight: 'bold', lineHeight: 1.2 }}>{event?.title}</Typography>
                </Box>
                <Button variant="contained" color="success" startIcon={<DownloadIcon />} onClick={exportToExcel} fullWidth={isMobile} sx={{ py: 1.2 }}>
                    Excel Export
                </Button>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

            {/* JAVÍTOTT KATEGÓRIAVÁLASZTÓ: Mobilon Select, asztalin Tab */}
            {isMobile ? (
                <FormControl fullWidth sx={{ mb: 3 }}>
                    <Select
                        value={currentTab}
                        onChange={handleMobileTabChange}
                        sx={{
                            bgcolor: 'white',
                            borderRadius: 3,
                            fontWeight: 'bold',
                            boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                            '& .MuiOutlinedInput-notchedOutline': { border: 'none' }
                        }}
                    >
                        <MenuItem value={0}>⏳ Függő jelentkezők ({getCount(a => a.status === 'PENDING')})</MenuItem>
                        <MenuItem value={1}>✅ Elfogadottak ({getCount(a => a.status === 'APPROVED')})</MenuItem>
                        <MenuItem value={2}>❌ Elutasítottak ({getCount(a => a.status === 'REJECTED')})</MenuItem>
                        <MenuItem value={3}>🏳️ Visszavonták ({getCount(a => a.status === 'WITHDRAWN')})</MenuItem>

                        {event?.workAreas && event.workAreas.length > 0 && <Divider key="divider" />}

                        {event?.workAreas?.map((area, index) => (
                            <MenuItem key={area.id} value={4 + index}>
                                📍 {area.name} ({getCount(a => a.workAreaName === area.name)})
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            ) : (
                <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                    <Tabs value={currentTab} onChange={handleTabChange} variant="standard">
                        <Tab label={`⏳ Függő (${getCount(a => a.status === 'PENDING')})`} />
                        <Tab label={`✅ Elfogadott (${getCount(a => a.status === 'APPROVED')})`} />
                        <Tab label={`❌ Elutasított (${getCount(a => a.status === 'REJECTED')})`} />
                        <Tab label={`🏳️ Visszavont (${getCount(a => a.status === 'WITHDRAWN')})`} />
                        {event?.workAreas?.map((area) => (
                            <Tab key={area.id} label={`📍 ${area.name} (${getCount(a => a.workAreaName === area.name)})`} />
                        ))}
                    </Tabs>
                </Box>
            )}

            {/* BULK ACTIONS */}
            {/* JAVÍTOTT BULK ACTIONS (TÖMEGES MŰVELETEK) */}
            {selectedIds.length > 0 && (
                <Paper
                    elevation={0}
                    sx={{
                        mb: 3,
                        p: 2,
                        bgcolor: '#e3f2fd', // Kellemes halványkék háttér
                        borderRadius: 3,
                        border: '1px solid',
                        borderColor: 'info.light',
                    }}
                >
                    <Box display="flex" alignItems="center" gap={1} mb={2}>
                        <InfoOutlinedIcon color="info" />
                        <Typography variant="subtitle2" fontWeight="bold" color="info.dark">
                            {selectedIds.length} jelentkező kiválasztva
                        </Typography>
                    </Box>

                    {/* Mobilon: 1 nagy gomb fent, 2 kisebb egymás mellett lent */}
                    <Grid container spacing={1.5}>
                        <Grid size={{ xs: 12, sm: 4 }}>
                            <Button
                                fullWidth
                                color="primary"
                                variant="contained"
                                startIcon={<EmailIcon />}
                                onClick={() => setEmailModalOpen(true)}
                                sx={{ py: 1, fontWeight: 'bold' }}
                            >
                                Üzenet
                            </Button>
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4 }}>
                            <Button
                                fullWidth
                                color="success"
                                variant="contained"
                                startIcon={<CheckCircleIcon />}
                                onClick={() => handleBulkStatusChange('APPROVED')}
                                disabled={disableApproveBtn}
                                sx={{ py: 1, fontWeight: 'bold' }}
                            >
                                Elfogadás
                            </Button>
                        </Grid>
                        <Grid size={{ xs: 6, sm: 4 }}>
                            <Button
                                fullWidth
                                color="error"
                                variant="contained"
                                startIcon={<CancelIcon />}
                                onClick={() => handleBulkStatusChange('REJECTED')}
                                disabled={disableRejectBtn}
                                sx={{ py: 1, fontWeight: 'bold' }}
                            >
                                Elutasítás
                            </Button>
                        </Grid>
                    </Grid>
                </Paper>
            )}

            {/* SZŰRŐK */}
            <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: '#fbfbfb', display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, alignItems: { xs: 'stretch', sm: 'center' } }}>
                {(currentTab <= 3) && (
                    <FormControl size="small" sx={{ flex: 1 }}>
                        <InputLabel>Munkaterület</InputLabel>
                        <Select value={areaFilter} label="Munkaterület" onChange={(e) => setAreaFilter(e.target.value)}>
                            <MenuItem value="ALL">Összes terület</MenuItem>
                            {event?.workAreas?.map((area) => <MenuItem key={area.id} value={area.name}>{area.name}</MenuItem>)}
                        </Select>
                    </FormControl>
                )}
                {currentTab > 3 && (
                    <FormControl size="small" sx={{ flex: 1 }}>
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
                <Typography variant="body2" sx={{ fontWeight: 500, textAlign: { xs: 'left', sm: 'right' } }}>Találatok: {filteredAndSortedApplications.length} fő</Typography>
            </Paper>

            {/* LISTA / TÁBLÁZAT */}
            {filteredAndSortedApplications.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>Nincs megjeleníthető jelentkező ezen a listán.</Paper>
            ) : isMobile ? (
                <Box>
                    <Box display="flex" flexDirection="column" gap={2} mb={2} p={1.5} bgcolor="#f5f5f5" borderRadius={2}>
                        <FormControlLabel
                            control={<Checkbox indeterminate={selectedIds.length > 0 && selectedIds.length < filteredAndSortedApplications.length} checked={filteredAndSortedApplications.length > 0 && selectedIds.length === filteredAndSortedApplications.length} onChange={handleSelectAllClick} />}
                            label={<Typography variant="body2" fontWeight="bold">Összes kijelölése a listán</Typography>}
                        />
                        <FormControl size="small" fullWidth>
                            <InputLabel>Rendezés</InputLabel>
                            <Select value={`${sortBy}-${sortOrder}`} label="Rendezés" onChange={(e) => { const val = e.target.value as string; const [field, order] = val.split('-'); setSortBy(field as SortField); setSortOrder(order as SortOrder); }}>
                                <MenuItem value="userName-asc">Név szerint (A-Z)</MenuItem>
                                <MenuItem value="userName-desc">Név szerint (Z-A)</MenuItem>
                                <MenuItem value="workAreaName-asc">Terület szerint (A-Z)</MenuItem>
                                <MenuItem value="workAreaName-desc">Terület szerint (Z-A)</MenuItem>
                            </Select>
                        </FormControl>
                    </Box>
                    {filteredAndSortedApplications.map((app) => <ApplicationCard key={app.id} app={app} isSelected={selectedIds.includes(app.id)} onSelect={handleSelectRow} onStatusChange={handleStatusChange} questions={event?.questions || []} onNoteUpdated={handleNoteUpdated} />)}
                </Box>
            ) : (
                <TableContainer component={Paper} elevation={3}>
                    <Table>
                        <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                            <TableRow>
                                <TableCell padding="checkbox"><Checkbox indeterminate={selectedIds.length > 0 && selectedIds.length < filteredAndSortedApplications.length} checked={filteredAndSortedApplications.length > 0 && selectedIds.length === filteredAndSortedApplications.length} onChange={handleSelectAllClick} /></TableCell>
                                <TableCell width="90px" align="center"><strong>Adatok</strong></TableCell>
                                <TableCell><TableSortLabel active={sortBy === 'userName'} direction={sortOrder} onClick={() => handleSort('userName')}><strong>Név</strong></TableSortLabel></TableCell>
                                <TableCell><strong>Elérhetőség</strong></TableCell>
                                <TableCell><TableSortLabel active={sortBy === 'workAreaName'} direction={sortOrder} onClick={() => handleSort('workAreaName')}><strong>Terület</strong></TableSortLabel></TableCell>
                                <TableCell align="center"><strong>Művelet</strong></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredAndSortedApplications.map((app) => <ApplicationRow key={app.id} app={app} isSelected={selectedIds.includes(app.id)} onSelect={handleSelectRow} onStatusChange={handleStatusChange} questions={event?.questions || []} onNoteUpdated={handleNoteUpdated}/>)}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* MODALOK */}
            <Dialog open={emailModalOpen} onClose={() => setEmailModalOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { m: { xs: 2, sm: 3 } } }}>
                <DialogTitle sx={{ bgcolor: '#1976d2', color: 'white', fontWeight: 'bold', fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>Üzenet küldése ({selectedIds.length} főnek)</DialogTitle>
                <DialogContent sx={{ mt: 2, p: { xs: 2, sm: 3 } }}>
                    <Typography variant="body2" color="text.secondary" mb={2}>A rendszer rejtett másolatban (BCC) küldi ki az üzeneteket, így a címzettek nem látják egymás e-mail címét.</Typography>
                    <TextField fullWidth size="small" margin="normal" label="E-mail tárgya" variant="outlined" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
                    <TextField fullWidth margin="normal" label="Üzenet szövege" multiline rows={6} variant="outlined" value={emailMessage} onChange={(e) => setEmailMessage(e.target.value)} placeholder="Kedves Önkéntesek!..." />
                </DialogContent>
                <DialogActions sx={{ p: 2, bgcolor: '#f5f5f5' }}>
                    <Button onClick={() => setEmailModalOpen(false)} color="inherit" disabled={sendingEmail}>Mégse</Button>
                    <Button variant="contained" color="primary" onClick={handleSendEmail} disabled={sendingEmail || !emailSubject.trim() || !emailMessage.trim()} startIcon={<EmailIcon />}>{sendingEmail ? 'Küldés...' : 'Kiküldés'}</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={rejectModalOpen} onClose={() => setRejectModalOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { m: { xs: 2, sm: 3 } } }}>
                <DialogTitle sx={{ bgcolor: '#d32f2f', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1, fontSize: { xs: '1rem', sm: '1.25rem' } }}><CancelIcon /> Elutasítás indoklása</DialogTitle>
                <DialogContent sx={{ mt: 2, p: { xs: 2, sm: 3 } }}>
                    <Typography variant="body2" color="text.secondary" mb={3}>Kérlek, add meg, hogy miért utasítod el a jelentkezőt. Ezt az üzenetet a felhasználó is látni fogja a profiljában. (A mező kitöltése opcionális, de erősen ajánlott).</Typography>
                    <TextField fullWidth autoFocus multiline rows={4} label="Elutasítás oka" variant="outlined" placeholder="Pl.: Sajnos a megjelölt munkaterületek már beteltek..." value={rejectMessage} onChange={(e) => setRejectMessage(e.target.value)} />
                </DialogContent>
                <DialogActions sx={{ p: 2, bgcolor: '#fafafa' }}>
                    <Button onClick={() => setRejectModalOpen(false)} color="inherit" disabled={loading}>Mégse</Button>
                    <Button onClick={confirmRejection} variant="contained" color="error" disabled={loading}>{loading ? 'Folyamatban...' : 'Véglegesítés'}</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={emailSuccessOpen} onClose={() => setEmailSuccessOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3, m: { xs: 2, sm: 3 } } }}>
                <DialogContent sx={{ textAlign: 'center', py: 4, px: 2 }}>
                    <CheckCircleIcon sx={{ fontSize: 70, color: '#2e7d32', mb: 2 }} />
                    <Typography variant="h5" fontWeight="bold" gutterBottom color="text.primary">Sikeres küldés!</Typography>
                    <Typography variant="body2" color="text.secondary">Az e-mailek sikeresen kézbesítve lettek a kiválasztott tagoknak.</Typography>
                </DialogContent>
                <DialogActions sx={{ justifyContent: 'center', pb: 3 }}>
                    <Button variant="contained" color="success" onClick={() => setEmailSuccessOpen(false)} sx={{ px: 4, py: 1, borderRadius: 2, fontWeight: 'bold' }}>Nagyszerű!</Button>
                </DialogActions>
            </Dialog>

        </Container>
    );
}