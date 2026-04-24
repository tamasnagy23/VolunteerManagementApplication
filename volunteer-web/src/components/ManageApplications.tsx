import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
    Container, Typography, Box, Paper, Button, CircularProgress,
    Alert, Tabs, Tab, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Select, MenuItem, FormControl, InputLabel,
    TableSortLabel, Checkbox, IconButton, Collapse,
    Dialog, DialogContent, DialogActions, Avatar, Chip, Divider, TextField,
    useMediaQuery, useTheme, FormControlLabel, alpha, Stack, DialogTitle
} from '@mui/material';
import type { SelectChangeEvent, Theme } from '@mui/material';
import Grid from '@mui/material/Grid';

import DownloadIcon from '@mui/icons-material/Download';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EmailIcon from '@mui/icons-material/Email';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import PhoneIcon from '@mui/icons-material/Phone';
import AlternateEmailIcon from '@mui/icons-material/AlternateEmail';

// --- RICH TEXT EDITOR ---
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

import api from '../api/axios';
import * as XLSX from 'xlsx';
import { useThemeToggle } from '../theme/ThemeContextProvider';
import LoadingScreen from "./LoadingScreen.tsx";

// --- INTERFÉSZEK ---
interface Application {
    id: number;
    userName: string;
    userEmail: string;
    userPhone?: string;
    userAvatar?: string;
    workAreaName: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
    answers: Record<string, string>;
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

// --- STÁTUSZ SZÍNEZŐ ---
const getStatusStyles = (status: string, theme: Theme, isDarkMode: boolean) => {
    switch (status) {
        case 'APPROVED': return { bgcolor: alpha(theme.palette.success.main, isDarkMode ? 0.15 : 0.1), color: isDarkMode ? theme.palette.success.light : theme.palette.success.dark };
        case 'REJECTED': return { bgcolor: alpha(theme.palette.error.main, isDarkMode ? 0.15 : 0.1), color: isDarkMode ? theme.palette.error.light : theme.palette.error.dark };
        case 'WITHDRAWN': return { bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f5f5f5', color: 'text.secondary' };
        default: return { bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'white', color: 'text.primary' };
    }
};

const quillModules = {
    toolbar: [
        [{ 'header': [1, 2, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        ['link'],
        ['clean']
    ]
};
const quillFormats = [ 'header', 'bold', 'italic', 'underline', 'strike', 'list', 'bullet', 'link' ];

const stringToColor = (string: string) => {
    let hash = 0;
    for (let i = 0; i < string.length; i += 1) {
        hash = string.charCodeAt(i) + ((hash << 5) - hash);
    }
    let color = '#';
    for (let i = 0; i < 3; i += 1) {
        const value = (hash >> (i * 8)) & 0xff;
        color += `00${value.toString(16)}`.slice(-2);
    }
    return color;
};

// --- ÚJ, GYÖNYÖRŰ ÜVEGHATÁSÚ MODAL (X GOMB NÉLKÜL, PONTOS FELIRATOKKAL) ---
function ProfileModal({ open, onClose, app, isDarkMode }: { open: boolean, onClose: () => void, app: Application, isDarkMode: boolean }) {
    const backendUrl = "http://localhost:8081";
    const fullAvatarUrl = app.userAvatar ? (app.userAvatar.startsWith('http') ? app.userAvatar : `${backendUrl}${app.userAvatar}`) : undefined;
    const displayPhone = app.userPhone && app.userPhone !== "Nincs telefon" && app.userPhone !== "null" ? app.userPhone : 'Nincs megadva';

    // Szín beállítása a szerepkörhöz
    let roleColor: 'primary' | 'secondary' | 'info' | 'default' = 'primary';
    if (app.userOrgRole === 'Főszervező') roleColor = 'secondary';
    else if (app.userOrgRole === 'Koordinátor') roleColor = 'info';

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="xs"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: 5,
                    bgcolor: isDarkMode ? 'rgba(15,23,42,0.7)' : 'rgba(255,255,255,0.7)',
                    backdropFilter: 'blur(40px) saturate(150%)',
                    backgroundImage: 'none',
                    border: '1px solid',
                    borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.6)',
                    boxShadow: isDarkMode ? '0 25px 50px -12px rgba(0, 0, 0, 0.8)' : '0 25px 50px -12px rgba(0, 0, 0, 0.2)',
                    overflow: 'hidden'
                }
            }}
        >
            <Box sx={{ position: 'absolute', top: '-50px', left: '50%', transform: 'translateX(-50%)', width: '200px', height: '200px', bgcolor: 'primary.main', filter: 'blur(80px)', opacity: isDarkMode ? 0.3 : 0.15, zIndex: 0, pointerEvents: 'none' }} />

            <DialogContent sx={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 5, pb: 4, px: 3 }}>
                <Avatar
                    src={fullAvatarUrl}
                    sx={{ width: 110, height: 110, mb: 2, bgcolor: fullAvatarUrl ? 'transparent' : stringToColor(app.userName || '?'), fontSize: '3.5rem', fontWeight: 'bold', border: '3px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'white', boxShadow: isDarkMode ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.1)' }}
                >
                    {app.userName ? app.userName.charAt(0).toUpperCase() : '?'}
                </Avatar>

                <Typography variant="h5" fontWeight="900" color="text.primary" textAlign="center">{app.userName}</Typography>

                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1, mt: 0.5, mb: 1, fontWeight: 'bold' }}>
                    Esemény szerepkör
                </Typography>
                <Chip label={app.userOrgRole || 'Önkéntes'} size="small" color={roleColor} sx={{ fontWeight: '800', borderRadius: 2, mb: 3 }} />

                <Stack spacing={1.5} sx={{ width: '100%' }}>
                    {/* E-mail Kártya */}
                    <Paper elevation={0} sx={{ p: 2, borderRadius: 4, bgcolor: isDarkMode ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.5)', border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ bgcolor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'white', color: 'primary.main', width: 40, height: 40, boxShadow: isDarkMode ? 'none' : '0 2px 8px rgba(0,0,0,0.05)' }}><AlternateEmailIcon fontSize="small"/></Avatar>
                        <Box sx={{ overflow: 'hidden' }}>
                            <Typography variant="caption" color="text.secondary" fontWeight="bold" display="block">E-mail cím</Typography>
                            <Typography variant="body2" color="text.primary" fontWeight="700" sx={{ wordBreak: 'break-all' }}>{app.userEmail}</Typography>
                        </Box>
                    </Paper>

                    {/* Telefon Kártya */}
                    <Paper elevation={0} sx={{ p: 2, borderRadius: 4, bgcolor: isDarkMode ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.5)', border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ bgcolor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'white', color: 'primary.main', width: 40, height: 40, boxShadow: isDarkMode ? 'none' : '0 2px 8px rgba(0,0,0,0.05)' }}><PhoneIcon fontSize="small"/></Avatar>
                        <Box>
                            <Typography variant="caption" color="text.secondary" fontWeight="bold" display="block">Telefonszám</Typography>
                            <Typography variant="body2" color="text.primary" fontWeight="700">{displayPhone}</Typography>
                        </Box>
                    </Paper>

                    {/* Csatlakozás Dátuma Kártya */}
                    <Box sx={{ mt: 1, p: 2, textAlign: 'center', borderRadius: 4, border: '1px dashed', borderColor: isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)', bgcolor: isDarkMode ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                        <Typography variant="caption" color="text.secondary" display="block" mb={0.5} fontWeight="bold">Eseményhez csatlakozás dátuma</Typography>
                        <Typography variant="body2" fontWeight="900" color={app.userJoinDate && app.userJoinDate !== '-' ? 'text.primary' : 'text.disabled'}>
                            {app.userJoinDate && app.userJoinDate !== '-' ? app.userJoinDate : 'Nincs adat'}
                        </Typography>
                    </Box>
                </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 2, justifyContent: 'center', pb: 3 }}>
                <Button onClick={onClose} variant={isDarkMode ? 'outlined' : 'contained'} color="primary" disableElevation sx={{ fontWeight: 'bold', borderRadius: 3, px: 4, bgcolor: isDarkMode ? 'transparent' : 'white', color: isDarkMode ? 'primary.main' : 'text.primary' }}>
                    Bezárás
                </Button>
            </DialogActions>
        </Dialog>
    );
}

// --- ASZTALI NÉZET: TÁBLÁZAT SOR ---
function ApplicationRow({ app, isSelected, onSelect, onStatusChange, questions, onNoteUpdated }: { app: Application, isSelected: boolean, onSelect: (id: number) => void, onStatusChange: (id: number, e: SelectChangeEvent<string>) => void, questions: EventQuestion[], onNoteUpdated: (id: number, note: string) => void }) {
    const [open, setOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [note, setNote] = useState(app.adminNote || '');
    const [savingNote, setSavingNote] = useState(false);

    const theme = useTheme();
    const { isDarkMode } = useThemeToggle();

    useEffect(() => { setNote(app.adminNote || ''); }, [app.adminNote]);

    const handleSaveNote = async () => {
        setSavingNote(true);
        try {
            await api.put(`/applications/${app.id}/note`, { note });
            onNoteUpdated(app.id, note);
        } catch { alert("Hiba a megjegyzés mentésekor."); } finally { setSavingNote(false); }
    };

    const statusStyles = getStatusStyles(app.status, theme, isDarkMode);
    const backendUrl = "http://localhost:8081";
    const fullAvatarUrl = app.userAvatar ? (app.userAvatar.startsWith('http') ? app.userAvatar : `${backendUrl}${app.userAvatar}`) : undefined;
    const displayPhone = app.userPhone && app.userPhone !== "Nincs telefon" && app.userPhone !== "null" ? app.userPhone : 'Nincs telefonszám';

    return (
        <React.Fragment>
            <TableRow hover selected={isSelected} sx={{ '& > *': { borderBottom: 'unset' }, transition: 'background-color 0.2s' }}>
                <TableCell padding="checkbox"><Checkbox checked={isSelected} onChange={() => onSelect(app.id)} /></TableCell>
                <TableCell sx={{ minWidth: '100px' }}>
                    <Box display="flex" gap={1}>
                        <IconButton size="small" onClick={() => setOpen(!open)} sx={{ color: isDarkMode ? 'white' : 'inherit' }}>
                            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                        </IconButton>
                        <IconButton size="small" color="primary" onClick={() => setProfileOpen(true)}>
                            <VisibilityIcon />
                        </IconButton>
                    </Box>
                </TableCell>

                <TableCell sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                    <Box display="flex" alignItems="center" gap={1.5}>
                        <Avatar
                            src={fullAvatarUrl}
                            sx={{ width: 36, height: 36, bgcolor: fullAvatarUrl ? 'transparent' : stringToColor(app.userName || '?'), fontSize: '1rem', fontWeight: 'bold', border: '2px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#f1f5f9' }}
                        >
                            {app.userName ? app.userName.charAt(0).toUpperCase() : '?'}
                        </Avatar>
                        {app.userName}
                    </Box>
                </TableCell>

                <TableCell>
                    <Box display="flex" flexDirection="column" gap={0.5}>
                        <Typography variant="body2" color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <AlternateEmailIcon sx={{ fontSize: 14, color: 'text.secondary' }}/> {app.userEmail}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <PhoneIcon sx={{ fontSize: 14, color: 'text.secondary' }}/> {displayPhone}
                        </Typography>
                    </Box>
                </TableCell>

                <TableCell sx={{ color: 'text.primary' }}>
                    <Chip label={app.workAreaName} size="small" variant="outlined" sx={{ fontWeight: 'bold', borderRadius: 2 }} />
                </TableCell>

                <TableCell align="center">
                    <Select
                        value={app.status} size="small" onChange={(e) => onStatusChange(app.id, e as SelectChangeEvent<string>)}
                        sx={{ minWidth: 150, fontWeight: 'bold', ...statusStyles, '& .MuiOutlinedInput-notchedOutline': { border: 'none' } }}
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
                        <Box sx={{ margin: 1, p: 2, bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : '#f8fbff', borderRadius: 2, border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#e0e0e0' }}>
                            {app.status === 'WITHDRAWN' && app.withdrawalReason && (
                                <Alert severity="warning" sx={{ mb: 2 }}><strong>Visszavonás indoka:</strong> {app.withdrawalReason}</Alert>
                            )}
                            {app.status === 'REJECTED' && app.rejectionMessage && (
                                <Alert severity="error" sx={{ mb: 2 }}><strong>Elutasítás indoka:</strong> {app.rejectionMessage}</Alert>
                            )}

                            <Typography variant="subtitle2" gutterBottom color="primary" fontWeight="bold">📝 Kérdőív válaszai</Typography>
                            {questions && questions.length > 0 ? (
                                <Grid container spacing={2} sx={{ mt: 1 }}>
                                    {questions.map((q, idx) => (
                                        <Grid size={{ xs: 12, sm: 6, md: 4 }} key={idx}>
                                            <Typography variant="caption" color="text.secondary" display="block">{q.questionText}</Typography>
                                            <Typography variant="body2" fontWeight="500" color="text.primary">{app.answers?.[q.questionText] || '- Nincs megadva -'}</Typography>
                                        </Grid>
                                    ))}
                                </Grid>
                            ) : ( <Typography variant="body2" color="text.secondary">Ehhez a jelentkezéshez nincsenek extra kérdések.</Typography> )}

                            <Divider sx={{ my: 2, borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider' }} />
                            <Typography variant="subtitle2" gutterBottom color="secondary" fontWeight="bold">🔒 Szervezői megjegyzés (Privát)</Typography>
                            <Box display="flex" gap={2} alignItems="flex-start" mt={1}>
                                <TextField size="small" fullWidth multiline rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ide írhatsz belső megjegyzést az önkéntesről..." sx={{ '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? 'rgba(0,0,0,0.3)' : 'white' } }} />
                                <Button variant="contained" color="secondary" onClick={handleSaveNote} disabled={savingNote || note === (app.adminNote || '')} sx={{ height: '40px', minWidth: '100px', fontWeight: 'bold' }}>{savingNote ? 'Mentés...' : 'Mentés'}</Button>
                            </Box>
                        </Box>
                    </Collapse>
                </TableCell>
            </TableRow>

            <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} app={app} isDarkMode={isDarkMode} />
        </React.Fragment>
    );
}

// --- MOBILOS NÉZET: KÁRTYA ELRENDEZÉS ---
function ApplicationCard({ app, isSelected, onSelect, onStatusChange, questions, onNoteUpdated }: { app: Application, isSelected: boolean, onSelect: (id: number) => void, onStatusChange: (id: number, e: SelectChangeEvent<string>) => void, questions: EventQuestion[], onNoteUpdated: (id: number, note: string) => void }) {
    const [open, setOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [note, setNote] = useState(app.adminNote || '');
    const [savingNote, setSavingNote] = useState(false);

    const theme = useTheme();
    const { isDarkMode } = useThemeToggle();

    useEffect(() => { setNote(app.adminNote || ''); }, [app.adminNote]);

    const handleSaveNote = async () => {
        setSavingNote(true);
        try { await api.put(`/applications/${app.id}/note`, { note }); onNoteUpdated(app.id, note); }
        catch { alert("Hiba a megjegyzés mentésekor."); } finally { setSavingNote(false); }
    };

    const statusStyles = getStatusStyles(app.status, theme, isDarkMode);

    const backendUrl = "http://localhost:8081";
    const fullAvatarUrl = app.userAvatar ? (app.userAvatar.startsWith('http') ? app.userAvatar : `${backendUrl}${app.userAvatar}`) : undefined;
    const displayPhone = app.userPhone && app.userPhone !== "Nincs telefon" && app.userPhone !== "null" ? app.userPhone : 'Nincs megadva';

    return (
        <Paper variant="outlined" sx={{
            p: 2, mb: 2, borderRadius: 3,
            borderColor: isSelected ? 'primary.main' : (isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider'),
            bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.05) : (isDarkMode ? 'rgba(30, 41, 59, 0.5)' : 'white'),
            boxShadow: isSelected ? `0 0 0 1px ${theme.palette.primary.main}` : 'none'
        }}>
            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
                <Box display="flex" alignItems="center" gap={1.5} width="100%">
                    <Checkbox checked={isSelected} onChange={() => onSelect(app.id)} sx={{ p: 0 }} />
                    <Avatar
                        src={fullAvatarUrl}
                        sx={{ width: 40, height: 40, bgcolor: fullAvatarUrl ? 'transparent' : stringToColor(app.userName || '?'), fontWeight: 'bold' }}
                    >
                        {app.userName ? app.userName.charAt(0).toUpperCase() : '?'}
                    </Avatar>
                    <Box flexGrow={1}>
                        <Typography variant="subtitle1" fontWeight="bold" lineHeight={1.2} color="text.primary">{app.userName}</Typography>
                        <Chip label={app.workAreaName} size="small" variant="outlined" sx={{ mt: 0.5, fontWeight: 'bold', height: 20, fontSize: '0.7rem' }} />
                    </Box>
                </Box>
            </Box>

            <Box pl={5} mb={2} display="flex" flexDirection="column" gap={0.5}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><AlternateEmailIcon sx={{fontSize: 14}}/> {app.userEmail}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><PhoneIcon sx={{fontSize: 14}}/> {displayPhone}</Typography>
            </Box>

            <Box display="flex" flexDirection="column" gap={1.5} pl={2} mb={1}>
                <Select value={app.status} size="small" fullWidth onChange={(e) => onStatusChange(app.id, e as SelectChangeEvent<string>)} sx={{ height: 36, fontSize: '0.85rem', fontWeight: 'bold', ...statusStyles, '& .MuiOutlinedInput-notchedOutline': { border: 'none' } }}>
                    <MenuItem value="PENDING">⏳ Függő</MenuItem>
                    <MenuItem value="APPROVED">✅ Elfogadva</MenuItem>
                    <MenuItem value="REJECTED">❌ Elutasítva</MenuItem>
                    <MenuItem value="WITHDRAWN" disabled={app.status !== 'WITHDRAWN'}>🏳️ Visszavont</MenuItem>
                </Select>
                <Box display="flex" gap={1}>
                    <Button fullWidth size="small" variant="outlined" startIcon={open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />} onClick={() => setOpen(!open)} sx={{ fontWeight: 'bold', borderRadius: 2 }}>Kérdőív</Button>
                    <Button fullWidth size="small" variant="contained" color="primary" disableElevation startIcon={<VisibilityIcon />} onClick={() => setProfileOpen(true)} sx={{ fontWeight: 'bold', borderRadius: 2 }}>Profil</Button>
                </Box>
            </Box>

            <Collapse in={open} timeout="auto" unmountOnExit>
                <Box sx={{ mt: 2, p: 2, bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : '#f8fbff', borderRadius: 2, border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#e0e0e0' }}>
                    {app.status === 'WITHDRAWN' && app.withdrawalReason && (
                        <Alert severity="warning" sx={{ mb: 2 }}><strong>Visszavonásod indoka:</strong> {app.withdrawalReason}</Alert>
                    )}
                    {app.status === 'REJECTED' && app.rejectionMessage && <Alert severity="error" sx={{ mb: 2 }}><strong>Indok:</strong> {app.rejectionMessage}</Alert>}

                    <Typography variant="subtitle2" gutterBottom color="primary" fontWeight="bold">📝 Válaszok</Typography>
                    {questions && questions.length > 0 ? (
                        <Box sx={{ mt: 1 }}>{questions.map((q, idx) => (<Box key={idx} mb={1.5}><Typography variant="caption" color="text.secondary" display="block">{q.questionText}</Typography><Typography variant="body2" fontWeight="500" color="text.primary">{app.answers?.[q.questionText] || '- Nincs megadva -'}</Typography></Box>))}</Box>
                    ) : ( <Typography variant="body2" color="text.secondary">Nincsenek extra kérdések.</Typography> )}
                    <Divider sx={{ my: 2, borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider' }} />
                    <Typography variant="subtitle2" gutterBottom color="secondary" fontWeight="bold">🔒 Belső megjegyzés</Typography>
                    <TextField size="small" fullWidth multiline rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Megjegyzés..." sx={{ '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? 'rgba(0,0,0,0.3)' : 'white' }, mb: 1.5 }} />
                    <Button variant="contained" color="secondary" onClick={handleSaveNote} disabled={savingNote || note === (app.adminNote || '')} fullWidth sx={{ fontWeight: 'bold' }}>{savingNote ? 'Mentés...' : 'Mentés'}</Button>
                </Box>
            </Collapse>

            <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} app={app} isDarkMode={isDarkMode} />
        </Paper>
    );
}

// --- FŐ KOMPONENS ---
export default function ManageApplications() {
    const { id } = useParams<{ id: string }>();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const { isDarkMode } = useThemeToggle();

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
    const [attachments, setAttachments] = useState<File[]>([]);
    const [sendingEmail, setSendingEmail] = useState(false);
    const [emailSuccessOpen, setEmailSuccessOpen] = useState(false);

    const [showEditor, setShowEditor] = useState(false);

    useEffect(() => {
        if (emailModalOpen) {
            const timer = setTimeout(() => setShowEditor(true), 150);
            return () => clearTimeout(timer);
        } else {
            setShowEditor(false);
        }
    }, [emailModalOpen]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [eventRes, appsRes] = await Promise.all([
                api.get(`/events/${id}`),
                api.get(`/applications/event/${id}`, { params: { t: new Date().getTime() } })
            ]);

            setEvent(eventRes.data);
            setApplications(Array.isArray(appsRes.data) ? appsRes.data : []);
        } catch {
            setError("Hiba történt az adatok betöltésekor.");
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

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const fileList = e.target.files;
            const newFiles: File[] = [];
            for (let i = 0; i < fileList.length; i++) {
                const file = fileList.item(i);
                if (file) newFiles.push(file);
            }
            setAttachments(prev => [...prev, ...newFiles]);
        }
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleSendEmail = async () => {
        if (!emailMessage || emailMessage === '<p><br></p>') return;

        setSendingEmail(true);
        try {
            const formData = new FormData();
            formData.append('subject', emailSubject);
            formData.append('message', emailMessage);

            selectedIds.forEach(appId => {
                formData.append('applicationIds', String(appId));
            });

            attachments.forEach(file => {
                formData.append('attachments', file);
            });

            await api.post('/applications/bulk-email', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            setEmailModalOpen(false);
            setEmailSubject('');
            setEmailMessage('');
            setAttachments([]);
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

    const handleTabChange = (_e: React.SyntheticEvent, newValue: number) => {
        setCurrentTab(newValue);
        setAreaFilter('ALL');
        setStatusFilter('ALL');
        setSelectedIds([]);
    };

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
                groupedData.set(app.userEmail, { userName: app.userName, userEmail: app.userEmail, userPhone: app.userPhone || '', areas: [], statuses: [], answers: app.answers || {} });
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

    if (loading && !rejectModalOpen) return <LoadingScreen/>;

    return (
        <Container maxWidth="xl" sx={{ mt: { xs: 2, sm: 4 }, mb: 10, px: { xs: 1, sm: 2, md: 3 }, overflowX: 'hidden', maxWidth: '100%' }}>
            {/* FEJLÉC */}
            <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} gap={2} mb={3}>
                <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} gap={1}>
                    <Typography variant="h5" color="text.primary" sx={{ fontSize: { xs: '1.4rem', md: '2.125rem' }, fontWeight: '900', lineHeight: 1.2 }}>{event?.title}</Typography>
                </Box>
                <Button variant="contained" color="success" startIcon={<DownloadIcon />} onClick={exportToExcel} fullWidth={isMobile} sx={{ py: 1.2, fontWeight: 'bold', borderRadius: 2 }}>
                    Excel Export
                </Button>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

            {/* KATEGÓRIAVÁLASZTÓ */}
            {isMobile ? (
                <FormControl fullWidth sx={{ mb: 3 }}>
                    <Select
                        value={currentTab}
                        onChange={handleMobileTabChange}
                        sx={{
                            bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.8)' : 'white',
                            borderRadius: 3,
                            fontWeight: 'bold',
                            boxShadow: isDarkMode ? '0 4px 15px rgba(0,0,0,0.3)' : '0 2px 10px rgba(0,0,0,0.05)',
                            '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                            color: 'text.primary'
                        }}
                    >
                        <MenuItem value={0}>⏳ Függő jelentkezők ({getCount(a => a.status === 'PENDING')})</MenuItem>
                        <MenuItem value={1}>✅ Elfogadottak ({getCount(a => a.status === 'APPROVED')})</MenuItem>
                        <MenuItem value={2}>❌ Elutasítottak ({getCount(a => a.status === 'REJECTED')})</MenuItem>
                        <MenuItem value={3}>🏳️ Visszavonták ({getCount(a => a.status === 'WITHDRAWN')})</MenuItem>
                        {event?.workAreas && event.workAreas.length > 0 && <Divider key="divider" sx={{ borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider' }} />}
                        {event?.workAreas?.map((area, index) => (
                            <MenuItem key={area.id} value={4 + index}>📍 {area.name} ({getCount(a => a.workAreaName === area.name)})</MenuItem>
                        ))}
                    </Select>
                </FormControl>
            ) : (
                <Box sx={{ borderBottom: 1, borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider', mb: 3 }}>
                    <Tabs value={currentTab} onChange={handleTabChange} variant="scrollable" scrollButtons="auto" textColor="primary" indicatorColor="primary">
                        <Tab label={`⏳ Függő (${getCount(a => a.status === 'PENDING')})`} sx={{ fontWeight: 'bold' }} />
                        <Tab label={`✅ Elfogadott (${getCount(a => a.status === 'APPROVED')})`} sx={{ fontWeight: 'bold' }} />
                        <Tab label={`❌ Elutasított (${getCount(a => a.status === 'REJECTED')})`} sx={{ fontWeight: 'bold' }} />
                        <Tab label={`🏳️ Visszavont (${getCount(a => a.status === 'WITHDRAWN')})`} sx={{ fontWeight: 'bold' }} />
                        {event?.workAreas?.map((area) => (
                            <Tab key={area.id} label={`📍 ${area.name} (${getCount(a => a.workAreaName === area.name)})`} sx={{ fontWeight: 'bold' }} />
                        ))}
                    </Tabs>
                </Box>
            )}

            {/* BULK ACTIONS (TÖMEGES MŰVELETEK) */}
            {selectedIds.length > 0 && (
                <Paper
                    elevation={0}
                    sx={{
                        mb: 3, p: 2, borderRadius: 3, border: '1px solid',
                        bgcolor: isDarkMode ? alpha(theme.palette.info.main, 0.1) : '#e3f2fd',
                        borderColor: isDarkMode ? alpha(theme.palette.info.main, 0.3) : 'info.light',
                        backdropFilter: 'blur(10px)'
                    }}
                >
                    <Box display="flex" alignItems="center" gap={1} mb={2}>
                        <InfoOutlinedIcon color="info" />
                        <Typography variant="subtitle2" fontWeight="bold" color={isDarkMode ? 'info.light' : 'info.dark'}>
                            {selectedIds.length} jelentkező kiválasztva
                        </Typography>
                    </Box>
                    <Grid container spacing={1.5}>
                        <Grid size={{ xs: 12, sm: 4 }}><Button fullWidth color="primary" variant="contained" startIcon={<EmailIcon />} onClick={() => setEmailModalOpen(true)} sx={{ py: 1, fontWeight: 'bold', borderRadius: 2 }}>Üzenet</Button></Grid>
                        <Grid size={{ xs: 6, sm: 4 }}><Button fullWidth color="success" variant="contained" startIcon={<CheckCircleIcon />} onClick={() => handleBulkStatusChange('APPROVED')} disabled={disableApproveBtn} sx={{ py: 1, fontWeight: 'bold', borderRadius: 2 }}>Elfogadás</Button></Grid>
                        <Grid size={{ xs: 6, sm: 4 }}><Button fullWidth color="error" variant="contained" startIcon={<CancelIcon />} onClick={() => handleBulkStatusChange('REJECTED')} disabled={disableRejectBtn} sx={{ py: 1, fontWeight: 'bold', borderRadius: 2 }}>Elutasítás</Button></Grid>
                    </Grid>
                </Paper>
            )}

            {/* SZŰRŐK */}
            <Paper elevation={0} sx={{
                p: 2, mb: 3, borderRadius: 3, border: '1px solid',
                bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : '#fbfbfb',
                borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'divider',
                display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, alignItems: { xs: 'stretch', sm: 'center' }
            }}>
                {(currentTab <= 3) && (
                    <FormControl size="small" sx={{ flex: 1 }}>
                        <InputLabel>Munkaterület</InputLabel>
                        <Select value={areaFilter} label="Munkaterület" onChange={(e) => setAreaFilter(e.target.value)} sx={{ '& .MuiOutlinedInput-notchedOutline': { borderColor: isDarkMode ? 'rgba(255,255,255,0.2)' : 'inherit' } }}>
                            <MenuItem value="ALL">Összes terület</MenuItem>
                            {event?.workAreas?.map((area) => <MenuItem key={area.id} value={area.name}>{area.name}</MenuItem>)}
                        </Select>
                    </FormControl>
                )}
                {currentTab > 3 && (
                    <FormControl size="small" sx={{ flex: 1 }}>
                        <InputLabel>Státusz szűrő</InputLabel>
                        <Select value={statusFilter} label="Státusz szűrő" onChange={(e) => setStatusFilter(e.target.value)} sx={{ '& .MuiOutlinedInput-notchedOutline': { borderColor: isDarkMode ? 'rgba(255,255,255,0.2)' : 'inherit' } }}>
                            <MenuItem value="ALL">Összes státusz</MenuItem>
                            <MenuItem value="PENDING">Elbírálás alatt</MenuItem>
                            <MenuItem value="APPROVED">Elfogadva</MenuItem>
                            <MenuItem value="REJECTED">Elutasítva</MenuItem>
                            <MenuItem value="WITHDRAWN">Visszavont</MenuItem>
                        </Select>
                    </FormControl>
                )}
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'bold', textAlign: { xs: 'left', sm: 'right' } }}>Találatok: {filteredAndSortedApplications.length} fő</Typography>
            </Paper>

            {/* LISTA / TÁBLÁZAT */}
            {filteredAndSortedApplications.length === 0 ? (
                <Paper elevation={0} sx={{ p: 6, textAlign: 'center', borderRadius: 4, bgcolor: isDarkMode ? 'rgba(30,41,59,0.5)' : 'rgba(255,255,255,0.5)', border: '1px dashed', borderColor: 'divider' }}>
                    <Typography variant="h6" color="text.secondary" fontWeight="bold">Nincs megjeleníthető jelentkező ezen a listán.</Typography>
                </Paper>
            ) : isMobile ? (
                <Box>
                    <Box display="flex" flexDirection="column" gap={2} mb={2} p={1.5} bgcolor={isDarkMode ? 'rgba(0,0,0,0.2)' : '#f5f5f5'} borderRadius={3}>
                        <FormControlLabel control={<Checkbox indeterminate={selectedIds.length > 0 && selectedIds.length < filteredAndSortedApplications.length} checked={filteredAndSortedApplications.length > 0 && selectedIds.length === filteredAndSortedApplications.length} onChange={handleSelectAllClick} />} label={<Typography variant="body2" fontWeight="bold">Összes kijelölése a listán</Typography>} />
                        <FormControl size="small" fullWidth>
                            <InputLabel>Rendezés</InputLabel>
                            <Select value={`${sortBy}-${sortOrder}`} label="Rendezés" onChange={(e) => { const val = e.target.value as string; const [field, order] = val.split('-'); setSortBy(field as SortField); setSortOrder(order as SortOrder); }} sx={{ '& .MuiOutlinedInput-notchedOutline': { borderColor: isDarkMode ? 'rgba(255,255,255,0.2)' : 'inherit' } }}>
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
                <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider', bgcolor: isDarkMode ? 'background.paper' : 'white' }}>
                    <Table>
                        <TableHead sx={{ bgcolor: isDarkMode ? 'rgba(0,0,0,0.3)' : '#f8fafc' }}>
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

            {/* --- ÚJ E-MAIL MODAL --- */}
            <Dialog
                open={emailModalOpen}
                onClose={() => !sendingEmail && setEmailModalOpen(false)}
                maxWidth="md"
                fullWidth
                disableEnforceFocus
                disableAutoFocus
                PaperProps={{ sx: { m: { xs: 2, sm: 3 }, borderRadius: 3, bgcolor: isDarkMode ? 'background.paper' : 'white', backgroundImage: 'none' } }}
            >
                <DialogTitle sx={{ bgcolor: isDarkMode ? theme.palette.primary.dark : '#1976d2', color: 'white', fontWeight: 'bold', fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
                    Üzenet küldése ({selectedIds.length} főnek)
                </DialogTitle>

                <DialogContent sx={{ mt: 2, p: { xs: 2, sm: 3 } }}>
                    <Typography variant="body2" color="text.secondary" mb={2}>
                        A rendszer rejtett másolatban (BCC) küldi ki az üzeneteket, így a címzettek nem látják egymás e-mail címét.
                    </Typography>

                    <TextField
                        fullWidth size="small" margin="normal" label="E-mail tárgya"
                        variant="outlined" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)}
                        sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                    />

                    {/* RICH TEXT EDITOR */}
                    <Box sx={{
                        mb: 2,
                        '& .ql-editor': { minHeight: '200px', fontSize: '1rem', color: isDarkMode ? 'white' : 'black' },
                        '& .ql-toolbar': {
                            bgcolor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#f8f9fa',
                            borderRadius: '8px 8px 0 0',
                            borderColor: isDarkMode ? 'rgba(255,255,255,0.2)' : '#ccc',
                            whiteSpace: 'normal',
                            display: 'flex',
                            flexWrap: 'wrap'
                        },
                        '& .ql-container': {
                            borderRadius: '0 0 8px 8px',
                            borderColor: isDarkMode ? 'rgba(255,255,255,0.2)' : '#ccc'
                        },
                        '& .ql-snow .ql-stroke': { stroke: isDarkMode ? '#e2e8f0' : '#444' },
                        '& .ql-snow .ql-fill': { fill: isDarkMode ? '#e2e8f0' : '#444' },
                        '& .ql-snow .ql-picker': { color: isDarkMode ? '#e2e8f0' : '#444' },
                        '& .ql-snow .ql-picker-options': { bgcolor: isDarkMode ? '#1e293b' : 'white', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' }
                    }}>
                        <Typography variant="subtitle2" mb={1} color="text.secondary" fontWeight="bold">Üzenet szövege</Typography>

                        {showEditor ? (
                            <ReactQuill
                                theme="snow"
                                modules={quillModules}
                                formats={quillFormats}
                                value={emailMessage}
                                onChange={setEmailMessage}
                                placeholder="Kedves Önkéntesek!..."
                            />
                        ) : (
                            <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                                <CircularProgress size={30} />
                            </Box>
                        )}
                    </Box>

                    {/* FÁJL CSATOLMÁNYOK */}
                    <Box sx={{ mt: 3, p: 2, borderRadius: 2, border: '1px dashed', borderColor: isDarkMode ? 'rgba(255,255,255,0.2)' : 'divider', bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : '#f8fafc' }}>
                        <Button
                            component="label"
                            variant="outlined"
                            startIcon={<AttachFileIcon />}
                            sx={{ fontWeight: 'bold', borderRadius: 2 }}
                        >
                            Fájlok csatolása
                            <input type="file" hidden multiple onChange={handleFileChange} />
                        </Button>

                        {attachments.length > 0 && (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
                                {attachments.map((file, idx) => (
                                    <Chip
                                        key={idx}
                                        label={file.name}
                                        onDelete={() => removeAttachment(idx)}
                                        color="primary"
                                        variant="outlined"
                                    />
                                ))}
                            </Box>
                        )}
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 2, bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : '#f5f5f5' }}>
                    <Button onClick={() => setEmailModalOpen(false)} color="inherit" disabled={sendingEmail} sx={{ fontWeight: 'bold' }}>
                        Mégse
                    </Button>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleSendEmail}
                        disabled={sendingEmail || !emailSubject.trim() || !emailMessage || emailMessage === '<p><br></p>'}
                        startIcon={<EmailIcon />}
                        sx={{ fontWeight: 'bold', borderRadius: 2 }}
                    >
                        {sendingEmail ? 'Küldés...' : 'Kiküldés'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={rejectModalOpen} onClose={() => setRejectModalOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { m: { xs: 2, sm: 3 }, borderRadius: 3, bgcolor: isDarkMode ? 'background.paper' : 'white', backgroundImage: 'none' } }}>
                <DialogTitle sx={{ bgcolor: isDarkMode ? theme.palette.error.dark : '#d32f2f', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1, fontSize: { xs: '1rem', sm: '1.25rem' } }}><CancelIcon /> Elutasítás indoklása</DialogTitle>
                <DialogContent sx={{ mt: 2, p: { xs: 2, sm: 3 } }}>
                    <Typography variant="body2" color="text.secondary" mb={3}>Kérlek, add meg, hogy miért utasítod el a jelentkezőt. Ezt az üzenetet a felhasználó is látni fogja a profiljában. (A mező kitöltése opcionális, de erősen ajánlott).</Typography>
                    <TextField fullWidth autoFocus multiline rows={4} label="Elutasítás oka" variant="outlined" placeholder="Pl.: Sajnos a megjelölt munkaterületek már beteltek..." value={rejectMessage} onChange={(e) => setRejectMessage(e.target.value)} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                </DialogContent>
                <DialogActions sx={{ p: 2, bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : '#fafafa' }}>
                    <Button onClick={() => setRejectModalOpen(false)} color="inherit" disabled={loading} sx={{ fontWeight: 'bold' }}>Mégse</Button>
                    <Button onClick={confirmRejection} variant="contained" color="error" disabled={loading} sx={{ fontWeight: 'bold', borderRadius: 2 }}>{loading ? 'Folyamatban...' : 'Véglegesítés'}</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={emailSuccessOpen} onClose={() => setEmailSuccessOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3, m: { xs: 2, sm: 3 }, bgcolor: isDarkMode ? 'background.paper' : 'white', backgroundImage: 'none' } }}>
                <DialogContent sx={{ textAlign: 'center', py: 4, px: 2 }}>
                    <CheckCircleIcon sx={{ fontSize: 70, color: theme.palette.success.main, mb: 2 }} />
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