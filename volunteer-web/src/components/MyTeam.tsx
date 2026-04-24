import React, { useEffect, useState, useMemo } from 'react';
import {
    Container, Typography, Box, Paper, CircularProgress, Alert,
    FormControl, InputLabel, Select, MenuItem, Chip, Button,
    TextField, InputAdornment, Pagination, Dialog, DialogTitle, DialogContent,
    DialogActions, IconButton, TableContainer, Table,
    TableHead, TableRow, TableCell, TableBody, Checkbox, useMediaQuery, useTheme,
    FormControlLabel, Avatar, Card, CardContent, CardActions, Fade, Stack, Tooltip,
    Collapse, ToggleButton, ToggleButtonGroup
} from '@mui/material';
import Grid from '@mui/material/Grid';
import type { SelectChangeEvent } from '@mui/material';

// Ikonok
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import PersonIcon from '@mui/icons-material/Person';
import PhoneIcon from '@mui/icons-material/Phone';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EmailIcon from '@mui/icons-material/Email';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import GroupsIcon from '@mui/icons-material/Groups';
import AccessTimeFilledIcon from '@mui/icons-material/AccessTimeFilled';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import SecurityIcon from '@mui/icons-material/Security';
import RestoreIcon from '@mui/icons-material/Restore';
import AttachFileIcon from '@mui/icons-material/AttachFile';

// React Quill
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

import api from '../api/axios';
import * as XLSX from 'xlsx';
import { useThemeToggle } from '../theme/ThemeContextProvider';

// --- INTERFÉSZEK ---
interface OrgMembership { orgId: number; orgName: string; orgRole: string; status?: string; }
interface TeamMember { id: number; name: string; email: string; globalRole: string; role?: string; phoneNumber?: string; phone?: string; profileImageUrl?: string | null; avatarUrl?: string | null; profilePictureUrl?: string | null; organizations: OrgMembership[]; }
interface PendingApplication { id: number; userName: string; userEmail: string; userPhone?: string; phone?: string; orgName: string; orgId: number; status: string; rejectionMessage?: string; profileImageUrl?: string | null; userAvatar?: string | null; }
interface CurrentUser { role: string; email: string; }
interface ExportRow { name: string; email: string; phone: string; org: string; role: string; status: string; reason?: string; }

const ROLE_WEIGHTS: Record<string, number> = { 'OWNER': 3, 'ORGANIZER': 2, 'VOLUNTEER': 1 };
const ROLE_LABELS: Record<string, string> = { 'VOLUNTEER': 'Önkéntes', 'ORGANIZER': 'Globális Szervező', 'OWNER': 'Alapító' };
const ROLE_COLORS: Record<string, "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning"> = { 'VOLUNTEER': 'default', 'ORGANIZER': 'secondary', 'OWNER': 'error' };

const getAvatarUrl = (url1?: string | null, url2?: string | null, url3?: string | null) => {
    const url = url1 || url2 || url3;
    if (!url || url.trim() === '') return undefined;
    const backendBaseUrl = 'http://localhost:8081';
    return url.startsWith('http') ? url : `${backendBaseUrl}${url}`;
};

export default function MyTeam() {
    const { isDarkMode } = useThemeToggle();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const [users, setUsers] = useState<TeamMember[]>([]);
    const [pendingApps, setPendingApps] = useState<PendingApplication[]>([]);
    const [historyApps, setHistoryApps] = useState<PendingApplication[]>([]);

    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [updatingKey, setUpdatingKey] = useState<string | null>(null);

    const [expandedCards, setExpandedCards] = useState<Record<number, boolean>>({});

    const [currentTab, setCurrentTab] = useState(0);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [orgFilter, setOrgFilter] = useState('ALL');

    const [roleFilter, setRoleFilter] = useState('ALL');
    const [sortOrder, setSortOrder] = useState('NAME_ASC');
    const [page, setPage] = useState(1);
    const ITEMS_PER_PAGE = isMobile ? 5 : 10;

    const [selectedUser, setSelectedUser] = useState<TeamMember | null>(null);
    const [memberToDelete, setMemberToDelete] = useState<{ userId: number, orgId: number, userName: string, orgName: string, reason: string } | null>(null);

    const [memberToRestore, setMemberToRestore] = useState<{ membershipId: number, userName: string, orgName: string } | null>(null);
    const [bulkRestoreModalOpen, setBulkRestoreModalOpen] = useState(false);

    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [rejectTarget, setRejectTarget] = useState<number | 'BULK' | null>(null);
    const [rejectMessage, setRejectMessage] = useState('');

    const [emailModalOpen, setEmailModalOpen] = useState(false);
    const [emailSubject, setEmailSubject] = useState('');
    const [emailMessage, setEmailMessage] = useState('');
    const [emailAttachments, setEmailAttachments] = useState<File[]>([]);
    const [sendingEmail, setSendingEmail] = useState(false);
    const [emailSuccessOpen, setEmailSuccessOpen] = useState(false);

    useEffect(() => { fetchTeamData(); }, []);
    useEffect(() => { setPage(1); setSelectedIds([]); }, [searchQuery, orgFilter, roleFilter, sortOrder, currentTab]);

    const fetchTeamData = async () => {
        try {
            setLoading(true);
            const activeOrgId = localStorage.getItem('activeOrgId');
            const queryParams = activeOrgId ? { orgId: activeOrgId } : {};

            const [meRes, teamRes, appsRes, historyRes] = await Promise.all([
                api.get<CurrentUser>('/users/me'),
                api.get<TeamMember[]>('/users/team', { params: queryParams }),
                api.get<PendingApplication[]>('/organizations/applications/pending', { params: queryParams }),
                api.get<PendingApplication[]>('/organizations/applications/history', { params: queryParams }).catch(() => ({ data: [] }))
            ]);

            setCurrentUser(meRes.data);

            const isNotDeleted = (email: string) => !email.endsWith('@anonymized.local');

            const activeTeam = teamRes.data.filter(u => {
                const hasApproved = u.organizations.some(o => o.status === 'APPROVED');
                return hasApproved || u.globalRole === 'SYS_ADMIN' || u.role === 'SYS_ADMIN';
            });

            setUsers(activeTeam.filter(u => isNotDeleted(u.email)));
            setPendingApps(appsRes.data.filter(app => isNotDeleted(app.userEmail)));
            setHistoryApps(historyRes.data.filter(app => isNotDeleted(app.userEmail)));

            if (activeOrgId && activeTeam.length > 0) {
                const orgName = activeTeam.flatMap(u => u.organizations).find(o => o.orgId.toString() === activeOrgId)?.orgName;
                if (orgName) {
                    setOrgFilter(orgName);
                }
            }

        } catch {
            setError("Nem sikerült betölteni a csapat adatait.");
        } finally {
            setLoading(false);
        }
    };

    const isSysAdmin = currentUser?.role === 'SYS_ADMIN';
    const myDetailedProfile = users.find(u => u.email === currentUser?.email);

    const handleOrgRoleChange = async (userId: number, orgId: number, newRole: string) => {
        try {
            setUpdatingKey(`${userId}-${orgId}`); setError('');
            await api.put(`/users/${userId}/organizations/${orgId}/role`, null, { params: { newRole } });
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, organizations: u.organizations.map(o => o.orgId === orgId ? { ...o, orgRole: newRole } : o) } : u));
        } catch { alert("Hiba történt a módosításkor."); } finally { setUpdatingKey(null); }
    };

    const handleApplication = async (appId: number, status: 'APPROVED' | 'REJECTED') => {
        if (status === 'REJECTED') { setRejectTarget(appId); setRejectMessage(''); setRejectModalOpen(true); return; }
        try {
            setUpdatingKey(`app-${appId}`); setError('');
            await api.put(`/organizations/${appId}/handle`, null, { params: { status } });
            await fetchTeamData();
        } catch { alert("Hiba a művelet során."); } finally { setUpdatingKey(null); }
    };

    const handleBulkApplication = async (status: 'APPROVED' | 'REJECTED') => {
        if (status === 'REJECTED') { setRejectTarget('BULK'); setRejectMessage(''); setRejectModalOpen(true); return; }
        if (!window.confirm(`Biztosan elfogadod mind a(z) ${selectedIds.length} jelentkezőt?`)) return;
        try {
            setLoading(true);
            await Promise.all(selectedIds.map(id => api.put(`/organizations/${id}/handle`, null, { params: { status } })));
            setSelectedIds([]); await fetchTeamData();
            alert("Sikeres tömeges elfogadás!");
        } catch { alert("Hiba a tömeges művelet során."); } finally { setLoading(false); }
    };

    const confirmRejection = async () => {
        try {
            setLoading(true);
            if (rejectTarget === 'BULK') {
                await Promise.all(selectedIds.map(id => api.put(`/organizations/${id}/handle`, null, { params: { status: 'REJECTED', rejectionMessage: rejectMessage.trim() || undefined } })));
                setSelectedIds([]);
            } else if (rejectTarget !== null) {
                await api.put(`/organizations/${rejectTarget}/handle`, null, { params: { status: 'REJECTED', rejectionMessage: rejectMessage.trim() || undefined } });
            }
            setRejectModalOpen(false); await fetchTeamData();
        } catch { alert("Hiba történt az elutasítás során."); } finally { setLoading(false); }
    };

    const handleRemoveMember = async () => {
        if (!memberToDelete) return;
        try {
            setUpdatingKey(`del-${memberToDelete.userId}-${memberToDelete.orgId}`); setError('');

            await api.delete(`/organizations/${memberToDelete.orgId}/members/${memberToDelete.userId}`, {
                params: { reason: memberToDelete.reason.trim() || undefined }
            });

            setUsers(prev => prev.map(u => {
                if (u.id === memberToDelete.userId) {
                    return {
                        ...u,
                        organizations: u.organizations.map(o => {
                            if (o.orgId === memberToDelete.orgId) {
                                return { ...o, status: 'REMOVED' };
                            }
                            return o;
                        })
                    };
                }
                return u;
            }));

            const activeOrgId = localStorage.getItem('activeOrgId');
            const queryParams = activeOrgId ? { orgId: activeOrgId } : {};
            const historyRes = await api.get<PendingApplication[]>('/organizations/applications/history', { params: queryParams }).catch(() => ({ data: [] }));
            setHistoryApps(historyRes.data.filter(app => !app.userEmail.endsWith('@anonymized.local')));

        } catch { alert("Hiba történt a törlés során."); } finally { setUpdatingKey(null); setMemberToDelete(null); }
    };

    const confirmRestoreMember = async () => {
        if (!memberToRestore) return;
        try {
            setUpdatingKey(`restore-${memberToRestore.membershipId}`);
            await api.put(`/organizations/memberships/${memberToRestore.membershipId}/restore`);
            setMemberToRestore(null);
            await fetchTeamData();
        } catch {
            alert("Hiba történt a visszaállítás során.");
        } finally {
            setUpdatingKey(null);
        }
    };

    const confirmBulkRestore = async () => {
        try {
            setLoading(true);
            await Promise.all(selectedIds.map(id => api.put(`/organizations/memberships/${id}/restore`)));
            setSelectedIds([]);
            setBulkRestoreModalOpen(false);
            await fetchTeamData();
        } catch {
            alert("Hiba történt a tömeges visszaállítás során.");
        } finally {
            setLoading(false);
        }
    };

    const handleSendEmail = async () => {
        setSendingEmail(true);
        try {
            const endpoint = currentTab === 0 ? '/users/team/bulk-email' : '/applications/bulk-email';
            const payloadKey = currentTab === 0 ? 'userIds' : 'applicationIds';

            const cleanMessage = emailMessage.replace(/<[^>]*>?/gm, '').trim();
            if (!cleanMessage) throw new Error("Az üzenet nem lehet üres!");

            const formData = new FormData();
            formData.append('subject', emailSubject);
            formData.append('message', emailMessage);
            selectedIds.forEach(id => formData.append(payloadKey, String(id)));
            emailAttachments.forEach(file => formData.append('attachments', file));

            await api.post(endpoint, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setEmailModalOpen(false);
            setEmailSubject('');
            setEmailMessage('');
            setEmailAttachments([]);
            setSelectedIds([]);
            setEmailSuccessOpen(true);
        } catch (e) {
            // JAVÍTÁS: Típusvizsgálat az 'any' helyett
            if (e instanceof Error) {
                alert(e.message);
            } else {
                alert("Hiba történt az üzenetek küldésekor.");
            }
        } finally {
            setSendingEmail(false);
        }
    };

    const handleMobileTabChange = (event: SelectChangeEvent<number>) => {
        setCurrentTab(Number(event.target.value));
        setOrgFilter('ALL'); setRoleFilter('ALL'); setSelectedIds([]);
    };

    const toggleCardExpansion = (userId: number) => {
        setExpandedCards(prev => ({ ...prev, [userId]: !prev[userId] }));
    };

    const processedUsers = useMemo(() => {
        return users.filter(user => {
            const searchLower = searchQuery.toLowerCase();
            const matchesSearch = user.name.toLowerCase().includes(searchLower) || user.email.toLowerCase().includes(searchLower);

            const activeOrgs = user.organizations.filter(o => o.status === 'APPROVED');
            const isSysAdminUser = user.globalRole === 'SYS_ADMIN' || user.role === 'SYS_ADMIN';

            const matchesOrg = isSysAdminUser || orgFilter === 'ALL' || activeOrgs.some(o => o.orgName === orgFilter);
            const matchesRole = isSysAdminUser || roleFilter === 'ALL' || activeOrgs.some(o => o.orgRole === roleFilter);

            const hasVisibleOrg = isSysAdminUser || isSysAdmin || activeOrgs.some(org => {
                return myDetailedProfile?.organizations?.some(myOrg => myOrg.orgId === org.orgId);
            });

            const isTrulyActive = activeOrgs.length > 0 || isSysAdminUser;

            return matchesSearch && matchesOrg && matchesRole && hasVisibleOrg && isTrulyActive;
        }).sort((a, b) => {
            const getHighestRoleWeight = (u: TeamMember) => {
                let max = 0; u.organizations.filter(o => o.status === 'APPROVED').forEach(o => { if ((ROLE_WEIGHTS[o.orgRole] || 0) > max) max = ROLE_WEIGHTS[o.orgRole]; }); return max;
            };
            if (sortOrder === 'NAME_ASC') return a.name.localeCompare(b.name, 'hu');
            if (sortOrder === 'NAME_DESC') return b.name.localeCompare(a.name, 'hu');
            if (sortOrder === 'ROLE_DESC') return getHighestRoleWeight(b) - getHighestRoleWeight(a);
            if (sortOrder === 'ROLE_ASC') return getHighestRoleWeight(a) - getHighestRoleWeight(b);
            return 0;
        });
    }, [users, searchQuery, orgFilter, roleFilter, sortOrder, isSysAdmin, myDetailedProfile]);

    const processedPendingApps = useMemo(() => {
        return pendingApps.filter(app => {
            const searchLower = searchQuery.toLowerCase();
            const matchesSearch = app.userName.toLowerCase().includes(searchLower) || app.userEmail.toLowerCase().includes(searchLower);
            const matchesOrg = orgFilter === 'ALL' || app.orgName === orgFilter;
            return matchesSearch && matchesOrg;
        }).sort((a, b) => a.userName.localeCompare(b.userName, 'hu'));
    }, [pendingApps, searchQuery, orgFilter]);

    const processedHistoryApps = useMemo(() => {
        return historyApps.filter(app => {
            const searchLower = searchQuery.toLowerCase();
            const matchesSearch = app.userName.toLowerCase().includes(searchLower) || app.userEmail.toLowerCase().includes(searchLower);
            const matchesOrg = orgFilter === 'ALL' || app.orgName === orgFilter;
            return matchesSearch && matchesOrg;
        }).sort((a, b) => a.userName.localeCompare(b.userName, 'hu'));
    }, [historyApps, searchQuery, orgFilter]);

    const currentListLength = currentTab === 0 ? processedUsers.length : currentTab === 1 ? processedPendingApps.length : processedHistoryApps.length;
    const totalPages = Math.ceil(currentListLength / ITEMS_PER_PAGE);
    const paginatedUsers = processedUsers.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
    const paginatedApps = processedPendingApps.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
    const paginatedHistory = processedHistoryApps.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    const allOrgs = Array.from(new Set([
        ...users.flatMap(u => u.organizations.map(o => o.orgName)),
        ...pendingApps.map(a => a.orgName),
        ...historyApps.map(h => h.orgName)
    ])).sort();

    const handleExportExcel = () => {
        const wb = XLSX.utils.book_new();
        const headers = ['Név', 'Email', 'Telefon', 'Szervezet', 'Szerepkör', 'Státusz', 'Indoklás'];

        const appendSheet = (data: ExportRow[], sheetName: string) => {
            const rows = data.map(row => [row.name, row.email, row.phone, row.org, row.role, row.status, row.reason || '-']);
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...rows]), sheetName.substring(0, 31));
        };

        const activeData: ExportRow[] = [];
        processedUsers.forEach(u => u.organizations.forEach(o => {
            if (orgFilter === 'ALL' || o.orgName === orgFilter) {
                const phoneStr = u.phoneNumber || u.phone || '-';
                activeData.push({ name: u.name, email: u.email, phone: phoneStr, org: o.orgName, role: ROLE_LABELS[o.orgRole], status: 'Aktív Tag' });
            }
        }));
        appendSheet(activeData, "Aktív Csapattagok");

        const pendingData: ExportRow[] = pendingApps.map(a => ({ name: a.userName, email: a.userEmail, phone: a.userPhone || a.phone || '-', org: a.orgName, role: 'Önkéntes', status: 'Függőben' }));
        if (pendingData.length > 0) appendSheet(pendingData, "Függő Jelentkezések");

        const historyData = historyApps.map(h => ({
            name: h.userName, email: h.userEmail, phone: h.userPhone || h.phone || '-', org: h.orgName, role: '-',
            status: h.status === 'LEFT' ? 'Kilépett' : h.status === 'REJECTED' ? 'Elutasítva' : 'Eltávolítva',
            reason: h.rejectionMessage || ''
        }));
        if (historyData.length > 0) appendSheet(historyData, "Archívum (Történelem)");

        XLSX.writeFile(wb, `Csapat_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleSelectAllClick = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            if (currentTab === 0) setSelectedIds(paginatedUsers.map(u => u.id));
            else if (currentTab === 1) setSelectedIds(paginatedApps.map(a => a.id));
            else setSelectedIds(paginatedHistory.map(h => h.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectRow = (id: number) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
    };

    const quillModules = {
        toolbar: [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            [{ 'color': [] }, { 'background': [] }],
            ['link'],
            ['clean']
        ],
    };

    if (loading && !rejectModalOpen) return (
        <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="60vh" gap={2}>
            <CircularProgress size={48} thickness={4} />
            <Typography variant="body1" color="text.secondary" fontWeight="500" sx={{ animation: 'pulse 1.5s infinite' }}>Csapat betöltése...</Typography>
        </Box>
    );

    return (
        <Fade in={true} timeout={500}>
            <Container maxWidth="xl" sx={{ mt: { xs: 2, sm: 4 }, mb: 10, px: { xs: 1, sm: 2, md: 3 } }}>
                <Box mb={4}>
                    <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} gap={2}>
                        <Box>
                            <Typography component="h1" variant="h3" fontWeight="900" sx={{
                                background: isDarkMode ? 'linear-gradient(90deg, #818cf8, #c084fc)' : 'linear-gradient(90deg, #4f46e5, #9333ea)',
                                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'inline-flex', alignItems: 'center', gap: 1
                            }}>
                                Csapat Kezelése
                            </Typography>
                            <Typography variant="body1" color="text.secondary" sx={{ mt: 1, fontSize: '1.1rem', maxWidth: '600px' }}>
                                Kezeld az önkénteseket, hagyd jóvá a jelentkezéseket és exportáld az adatokat!
                            </Typography>
                        </Box>
                        <Button variant="contained" color="primary" startIcon={<DownloadIcon />} onClick={handleExportExcel} sx={{ borderRadius: 3, fontWeight: 'bold', px: 4, py: 1.5, boxShadow: isDarkMode ? '0 8px 20px rgba(0,0,0,0.4)' : '0 8px 20px rgba(79, 70, 229, 0.2)' }}>
                            Excel Export
                        </Button>
                    </Box>
                </Box>

                {error && <Alert severity="error" sx={{ mb: 4, borderRadius: 3 }}>{error}</Alert>}

                {isMobile ? (
                    <FormControl fullWidth sx={{ mb: 4 }}>
                        <Select
                            value={currentTab}
                            onChange={handleMobileTabChange}
                            sx={{
                                bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)',
                                borderRadius: 3, fontWeight: 'bold', '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                                boxShadow: isDarkMode ? '0 4px 20px rgba(0,0,0,0.4)' : '0 4px 20px rgba(0,0,0,0.05)'
                            }}
                        >
                            <MenuItem value={0}><GroupsIcon sx={{ mr: 1, verticalAlign: 'middle' }}/> Aktív Tagok ({processedUsers.length})</MenuItem>
                            <MenuItem value={1}><AccessTimeFilledIcon sx={{ mr: 1, verticalAlign: 'middle' }}/> Függő Jelentkezések ({processedPendingApps.length})</MenuItem>
                            <MenuItem value={2}><HistoryEduIcon sx={{ mr: 1, verticalAlign: 'middle' }}/> Történelem ({processedHistoryApps.length})</MenuItem>
                        </Select>
                    </FormControl>
                ) : (
                    <Box sx={{ mb: 4, display: 'flex', justifyContent: 'center' }}>
                        <ToggleButtonGroup
                            value={currentTab} exclusive onChange={(_e: React.MouseEvent<HTMLElement>, v: number | null) => { if (v !== null) { setCurrentTab(v); setOrgFilter('ALL'); setRoleFilter('ALL'); setSelectedIds([]); } }}
                            sx={{
                                bgcolor: isDarkMode ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)', p: 0.5, borderRadius: 8, backdropFilter: 'blur(10px)',
                                '& .MuiToggleButton-root': {
                                    border: 'none', borderRadius: 8, px: 3, py: 1, color: 'text.secondary', fontWeight: 'bold', textTransform: 'none', fontSize: '1rem',
                                    '&.Mui-selected': { bgcolor: isDarkMode ? 'rgba(255,255,255,0.15)' : 'white', color: 'text.primary', boxShadow: isDarkMode ? 'none' : '0 2px 4px rgba(0,0,0,0.1)' }
                                }
                            }}
                        >
                            <ToggleButton value={0}><GroupsIcon sx={{ mr: 1 }}/> Aktív Tagok ({processedUsers.length})</ToggleButton>
                            <ToggleButton value={1}><AccessTimeFilledIcon sx={{ mr: 1 }}/> Függőben ({processedPendingApps.length})</ToggleButton>
                            <ToggleButton value={2}><HistoryEduIcon sx={{ mr: 1 }}/> Történelem ({processedHistoryApps.length})</ToggleButton>
                        </ToggleButtonGroup>
                    </Box>
                )}

                {currentTab === 0 && (
                    <Alert
                        severity="info"
                        icon={<LightbulbIcon />}
                        sx={{
                            mb: 4, borderRadius: 3, border: '1px solid',
                            borderColor: isDarkMode ? 'rgba(129, 140, 248, 0.3)' : 'info.light',
                            bgcolor: isDarkMode ? 'rgba(129, 140, 248, 0.1)' : '#f8fbff',
                            backdropFilter: 'blur(10px)'
                        }}
                    >
                        <Typography variant="subtitle2" fontWeight="bold" color={isDarkMode ? '#818cf8' : 'info.dark'}>
                            💡 Tipp a csapatkezeléshez: A kétszintű rendszer
                        </Typography>
                        <Typography variant="body2" mt={0.5} color={isDarkMode ? 'rgba(255,255,255,0.7)' : 'text.secondary'}>
                            Akinek itt <strong>"Globális Szervező"</strong> rangot adsz, az a szervezet <em>összes</em> eseményét látni és szerkeszteni fogja.
                            Ha valakire csak egy <em>konkrét</em> esemény vezetését bíznád rá, hagyd itt <strong>"Önkéntes"</strong> státuszban, és az adott Esemény "Csapat" fülén nevezd ki <strong>Koordinátornak</strong>!
                        </Typography>
                    </Alert>
                )}

                <Collapse in={selectedIds.length > 0}>
                    <Paper elevation={0} sx={{
                        mb: 4, p: 2, borderRadius: 4,
                        background: isDarkMode ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9))' : 'linear-gradient(135deg, #e0e7ff, #ede9fe)',
                        border: '1px solid', borderColor: isDarkMode ? 'rgba(129, 140, 248, 0.3)' : 'primary.light',
                        boxShadow: isDarkMode ? '0 8px 32px rgba(0,0,0,0.4)' : '0 8px 32px rgba(79, 70, 229, 0.1)'
                    }}>
                        <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems="center" gap={2}>
                            <Typography variant="h6" fontWeight="bold" color={isDarkMode ? 'white' : 'primary.dark'}>
                                {selectedIds.length} elem kiválasztva
                            </Typography>
                            <Box display="flex" gap={2} width={{ xs: '100%', md: 'auto' }}>
                                <Button sx={{ flex: 1, bgcolor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'white', color: isDarkMode ? 'white' : 'primary.main', '&:hover': { bgcolor: isDarkMode ? 'rgba(255,255,255,0.2)' : '#f8fafc' }, fontWeight: 'bold', borderRadius: 2 }} variant="contained" startIcon={<EmailIcon />} onClick={() => setEmailModalOpen(true)}>Üzenet</Button>
                                {currentTab === 1 && (
                                    <>
                                        <Button sx={{ flex: 1, borderRadius: 2, fontWeight: 'bold' }} color="success" variant="contained" startIcon={<CheckCircleIcon />} onClick={() => handleBulkApplication('APPROVED')} disableElevation>Elfogad</Button>
                                        <Button sx={{ flex: 1, borderRadius: 2, fontWeight: 'bold' }} color="error" variant="contained" startIcon={<CancelIcon />} onClick={() => handleBulkApplication('REJECTED')} disableElevation>Elutasít</Button>
                                    </>
                                )}
                                {currentTab === 2 && (
                                    <Button sx={{ flex: 1, borderRadius: 2, fontWeight: 'bold' }} color="primary" variant="contained" startIcon={<RestoreIcon />} onClick={() => setBulkRestoreModalOpen(true)} disableElevation>Visszaállítás</Button>
                                )}
                            </Box>
                        </Box>
                    </Paper>
                </Collapse>

                <Paper elevation={0} sx={{
                    p: { xs: 2, md: 3 }, mb: 4, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', borderRadius: 4,
                    bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.5)' : 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(20px)',
                    border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
                }}>
                    <TextField
                        size="small" placeholder="Keresés név vagy email alapján..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                        sx={{ flex: 1, minWidth: { xs: '100%', sm: 250 }, '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'white', borderRadius: 2 } }}
                        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
                    />
                    <FormControl size="small" sx={{ flex: 1, minWidth: { xs: '100%', sm: 200 }, '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'white', borderRadius: 2 } }}>
                        <InputLabel>Szervezet</InputLabel>
                        <Select value={orgFilter} label="Szervezet" onChange={(e) => setOrgFilter(e.target.value)}>
                            <MenuItem value="ALL" sx={{ fontWeight: 'bold' }}>Összes szervezet</MenuItem>
                            {allOrgs.map(name => <MenuItem key={name} value={name}>{name}</MenuItem>)}
                        </Select>
                    </FormControl>
                    {currentTab === 0 && (
                        <>
                            <FormControl size="small" sx={{ flex: 1, minWidth: { xs: '100%', sm: 180 }, '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'white', borderRadius: 2 } }}>
                                <InputLabel>Szerepkör</InputLabel>
                                <Select value={roleFilter} label="Szerepkör" onChange={(e) => setRoleFilter(e.target.value)}>
                                    <MenuItem value="ALL" sx={{ fontWeight: 'bold' }}>Minden szerepkör</MenuItem>
                                    <MenuItem value="ORGANIZER">Globális Szervező</MenuItem>
                                    <MenuItem value="VOLUNTEER">Önkéntes</MenuItem>
                                </Select>
                            </FormControl>
                            <FormControl size="small" sx={{ flex: 1, minWidth: { xs: '100%', sm: 200 }, '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'white', borderRadius: 2 } }}>
                                <InputLabel>Rendezés</InputLabel>
                                <Select value={sortOrder} label="Rendezés" onChange={(e) => setSortOrder(e.target.value)}>
                                    <MenuItem value="NAME_ASC">Név szerint (A-Z)</MenuItem>
                                    <MenuItem value="NAME_DESC">Név szerint (Z-A)</MenuItem>
                                    <MenuItem value="ROLE_DESC">Szerepkör (Szervezőtől)</MenuItem>
                                    <MenuItem value="ROLE_ASC">Szerepkör (Önkéntestől)</MenuItem>
                                </Select>
                            </FormControl>
                        </>
                    )}
                </Paper>

                {currentListLength > 0 && (
                    <Box mb={2} px={2} py={1} sx={{ bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)', borderRadius: 2, display: 'inline-flex' }}>
                        <FormControlLabel control={<Checkbox indeterminate={selectedIds.length > 0 && selectedIds.length < (currentTab === 0 ? paginatedUsers.length : currentTab === 1 ? paginatedApps.length : paginatedHistory.length)} checked={selectedIds.length > 0 && selectedIds.length === (currentTab === 0 ? paginatedUsers.length : currentTab === 1 ? paginatedApps.length : paginatedHistory.length)} onChange={handleSelectAllClick} />} label={<Typography variant="body2" fontWeight="bold">Összes kijelölése ezen az oldalon</Typography>} />
                    </Box>
                )}

                {/* --- TARTALOM MEGJELENÍTÉSE FÜLEK SZERINT --- */}
                {currentListLength === 0 ? (
                    <Paper elevation={0} sx={{
                        p: 8, textAlign: 'center', borderRadius: 4,
                        bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.5)' : 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(20px)',
                        border: '2px dashed', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                    }}>
                        <Avatar sx={{ width: 80, height: 80, bgcolor: 'transparent', color: 'text.secondary', mx: 'auto', mb: 2 }}>
                            <SearchIcon sx={{ fontSize: 60 }} />
                        </Avatar>
                        <Typography variant="h5" fontWeight="800" color="text.primary" gutterBottom>Nincs találat</Typography>
                        <Typography variant="body1" color="text.secondary">Próbáld meg módosítani a szűrőket vagy a keresési feltételt.</Typography>
                    </Paper>
                ) : currentTab === 2 ? (
                    isMobile ? (
                        <Stack spacing={2}>
                            {paginatedHistory.map((history) => {
                                const hPhone = history.userPhone || history.phone || 'Nincs adat';
                                const isSelected = selectedIds.includes(history.id);
                                return (
                                    <Card key={history.id} elevation={0} sx={{
                                        borderRadius: 3,
                                        bgcolor: isSelected ? (isDarkMode ? 'rgba(129, 140, 248, 0.1)' : '#eef2ff') : (isDarkMode ? 'rgba(30, 41, 59, 0.5)' : 'white'),
                                        border: '1px solid', borderColor: isSelected ? 'primary.main' : (isDarkMode ? 'rgba(255,255,255,0.05)' : 'divider'),
                                        transition: 'all 0.2s', transform: 'translateZ(0)'
                                    }}>
                                        <CardContent sx={{ pb: 1, display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                                            <Avatar
                                                src={!isSelected ? getAvatarUrl(history.userAvatar || history.profileImageUrl) : undefined}
                                                onClick={() => handleSelectRow(history.id)}
                                                sx={{
                                                    width: 48, height: 48, cursor: 'pointer',
                                                    bgcolor: isSelected ? 'success.main' : (isDarkMode ? 'primary.dark' : 'primary.main'),
                                                    fontWeight: 'bold', transition: 'transform 0.2s',
                                                    boxShadow: isSelected ? '0 0 0 3px rgba(46, 125, 50, 0.4)' : 'none',
                                                    '&:hover': { transform: 'scale(1.05)' }
                                                }}>
                                                {isSelected ? <CheckCircleIcon sx={{ color: 'white' }} /> : history.userName.charAt(0)}
                                            </Avatar>
                                            <Box>
                                                <Typography variant="subtitle1" fontWeight="bold" color="text.primary">{history.userName}</Typography>
                                                <Typography variant="body2" color="text.secondary">{history.userEmail} | {hPhone}</Typography>
                                                <Chip label={history.orgName} size="small" variant="outlined" sx={{ mt: 1.5, fontWeight: 'bold' }} />
                                            </Box>
                                        </CardContent>
                                        <CardActions sx={{ px: 2, pb: 2, display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Box display="flex" flexDirection="column" alignItems="flex-start" gap={1}>
                                                <Chip label={history.status === 'LEFT' ? 'Önként Kilépett' : history.status === 'REJECTED' ? 'Elutasítva' : 'Eltávolítva'} color={history.status === 'LEFT' ? 'default' : history.status === 'REJECTED' ? 'error' : 'warning'} size="small" sx={{ fontWeight: 'bold' }} />
                                                {history.rejectionMessage && <Typography variant="caption" fontStyle="italic" color="text.secondary">"{history.rejectionMessage}"</Typography>}
                                            </Box>
                                            <Tooltip title="Visszaállítás az Aktív tagok közé">
                                                <IconButton
                                                    color="primary"
                                                    onClick={() => setMemberToRestore({ membershipId: history.id, userName: history.userName, orgName: history.orgName })}
                                                    disabled={updatingKey === `restore-${history.id}`}
                                                    sx={{ bgcolor: isDarkMode ? 'rgba(56, 189, 248, 0.1)' : '#e0f2fe' }}
                                                >
                                                    <RestoreIcon />
                                                </IconButton>
                                            </Tooltip>
                                        </CardActions>
                                    </Card>
                                );
                            })}
                        </Stack>
                    ) : (
                        <TableContainer component={Paper} elevation={0} sx={{
                            borderRadius: 4, bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.5)' : 'white', backdropFilter: 'blur(20px)',
                            border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                            transform: 'translateZ(0)'
                        }}>
                            <Table>
                                <TableHead sx={{ bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : '#f8fafc' }}>
                                    <TableRow>
                                        <TableCell padding="checkbox" sx={{ borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)' }}><Checkbox onChange={handleSelectAllClick} checked={selectedIds.length === paginatedHistory.length && paginatedHistory.length > 0} /></TableCell>
                                        <TableCell sx={{ borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)' }}><strong>Felhasználó</strong></TableCell>
                                        <TableCell sx={{ borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)' }}><strong>Elérhetőség</strong></TableCell>
                                        <TableCell sx={{ borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)' }}><strong>Szervezet</strong></TableCell>
                                        <TableCell sx={{ borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)' }}><strong>Státusz & Indoklás</strong></TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {paginatedHistory.map((history) => {
                                        const hPhone = history.userPhone || history.phone || 'Nincs adat';
                                        const isSelected = selectedIds.includes(history.id);
                                        return (
                                            <TableRow key={history.id} hover selected={isSelected} sx={{ '&:last-child td, &:last-child th': { border: 0 }, bgcolor: isSelected ? (isDarkMode ? 'rgba(129, 140, 248, 0.1) !important' : '#eef2ff !important') : 'inherit' }}>
                                                <TableCell sx={{ borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)', textAlign: 'center' }}>
                                                    <Tooltip title={isSelected ? "Kijelölés megszüntetése" : "Kijelölés"}>
                                                        <Avatar
                                                            src={!isSelected ? getAvatarUrl(history.userAvatar || history.profileImageUrl) : undefined}
                                                            onClick={() => handleSelectRow(history.id)}
                                                            sx={{
                                                                width: 36, height: 36, cursor: 'pointer', mx: 'auto',
                                                                bgcolor: isSelected ? 'success.main' : (isDarkMode ? 'primary.dark' : 'primary.main'),
                                                                fontWeight: 'bold', fontSize: '0.9rem', transition: 'transform 0.2s',
                                                                boxShadow: isSelected ? '0 0 0 2px rgba(46, 125, 50, 0.4)' : 'none',
                                                                '&:hover': { transform: 'scale(1.1)' }
                                                            }}
                                                        >
                                                            {isSelected ? <CheckCircleIcon sx={{ color: 'white', fontSize: 20 }} /> : history.userName.charAt(0)}
                                                        </Avatar>
                                                    </Tooltip>
                                                </TableCell>
                                                <TableCell sx={{ borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)' }}>
                                                    <Typography fontWeight="bold" color="text.primary">{history.userName}</Typography>
                                                </TableCell>
                                                <TableCell sx={{ borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)' }}>
                                                    <Typography variant="body2" color="text.primary">{history.userEmail}</Typography>
                                                    <Typography variant="caption" color="text.secondary">{hPhone}</Typography>
                                                </TableCell>
                                                <TableCell sx={{ borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)' }}><Chip label={history.orgName} size="small" variant="outlined" sx={{ fontWeight: 'bold' }} /></TableCell>
                                                <TableCell sx={{ borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)' }}>
                                                    <Box display="flex" justifyContent="space-between" alignItems="center">
                                                        <Box display="flex" flexDirection="column" alignItems="flex-start" gap={1}>
                                                            <Chip label={history.status === 'LEFT' ? 'Önként Kilépett' : history.status === 'REJECTED' ? 'Elutasítva' : 'Eltávolítva'} color={history.status === 'LEFT' ? 'default' : history.status === 'REJECTED' ? 'error' : 'warning'} size="small" sx={{ fontWeight: 'bold' }} />
                                                            {history.rejectionMessage && <Typography variant="caption" color="text.secondary" fontStyle="italic">"{history.rejectionMessage}"</Typography>}
                                                        </Box>
                                                        <Tooltip title="Visszaállítás az Aktív tagok közé">
                                                            <IconButton
                                                                color="primary"
                                                                size="small"
                                                                onClick={() => setMemberToRestore({ membershipId: history.id, userName: history.userName, orgName: history.orgName })}
                                                                disabled={updatingKey === `restore-${history.id}`}
                                                                sx={{ bgcolor: isDarkMode ? 'rgba(56, 189, 248, 0.1)' : '#e0f2fe' }}
                                                            >
                                                                <RestoreIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </Box>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )
                ) : currentTab === 1 ? (
                    isMobile ? (
                        <Stack spacing={2}>
                            {paginatedApps.map((app) => {
                                const aPhone = app.userPhone || app.phone || 'Nincs adat';
                                const isSelected = selectedIds.includes(app.id);
                                return (
                                    <Card key={app.id} elevation={0} sx={{
                                        borderRadius: 3,
                                        bgcolor: isSelected ? (isDarkMode ? 'rgba(129, 140, 248, 0.1)' : '#eef2ff') : (isDarkMode ? 'rgba(30, 41, 59, 0.5)' : 'white'),
                                        border: '1px solid', borderColor: isSelected ? 'primary.main' : (isDarkMode ? 'rgba(255,255,255,0.05)' : 'divider'),
                                        transition: 'all 0.2s', transform: 'translateZ(0)'
                                    }}>
                                        <CardContent sx={{ pb: 1, display: 'flex', gap: 2 }}>
                                            <Avatar
                                                src={!isSelected ? getAvatarUrl(app.userAvatar || app.profileImageUrl) : undefined}
                                                onClick={() => handleSelectRow(app.id)}
                                                sx={{
                                                    width: 48, height: 48, cursor: 'pointer',
                                                    bgcolor: isSelected ? 'success.main' : (isDarkMode ? 'primary.dark' : 'primary.main'),
                                                    fontWeight: 'bold', transition: 'transform 0.2s',
                                                    boxShadow: isSelected ? '0 0 0 3px rgba(46, 125, 50, 0.4)' : 'none',
                                                    '&:hover': { transform: 'scale(1.05)' }
                                                }}
                                            >
                                                {isSelected ? <CheckCircleIcon sx={{ color: 'white' }} /> : app.userName.charAt(0)}
                                            </Avatar>
                                            <Box>
                                                <Typography variant="subtitle1" fontWeight="bold" color="text.primary">{app.userName}</Typography>
                                                <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-all' }}>{app.userEmail}</Typography>
                                                <Typography variant="caption" display="block" color="text.secondary">📱 {aPhone}</Typography>
                                                <Chip label={app.orgName} size="small" variant="outlined" color="warning" sx={{ mt: 1, fontWeight: 'bold' }} />
                                            </Box>
                                        </CardContent>
                                        <CardActions sx={{ p: 2, pt: 1 }}>
                                            <Button fullWidth variant="contained" color="success" size="small" onClick={() => handleApplication(app.id, 'APPROVED')} disabled={!!updatingKey} sx={{ borderRadius: 2, fontWeight: 'bold' }} disableElevation>Elfogad</Button>
                                            <Button fullWidth variant="outlined" color="error" size="small" onClick={() => handleApplication(app.id, 'REJECTED')} disabled={!!updatingKey} sx={{ borderRadius: 2, fontWeight: 'bold' }}>Elutasít</Button>
                                        </CardActions>
                                    </Card>
                                );
                            })}
                        </Stack>
                    ) : (
                        <TableContainer component={Paper} elevation={0} sx={{
                            borderRadius: 4, bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.5)' : 'white', backdropFilter: 'blur(20px)',
                            border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                            transform: 'translateZ(0)'
                        }}>
                            <Table>
                                <TableHead sx={{ bgcolor: isDarkMode ? 'rgba(249, 115, 22, 0.1)' : '#fff3e0' }}>
                                    <TableRow>
                                        <TableCell padding="checkbox" sx={{ borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)' }}><Checkbox onChange={handleSelectAllClick} checked={selectedIds.length === paginatedApps.length && paginatedApps.length > 0} /></TableCell>
                                        <TableCell sx={{ borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)' }}><strong>Jelentkező Neve</strong></TableCell>
                                        <TableCell sx={{ borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)' }}><strong>Email & Telefon</strong></TableCell>
                                        <TableCell sx={{ borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)' }}><strong>Szervezet</strong></TableCell>
                                        <TableCell align="center" sx={{ borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)' }}><strong>Művelet</strong></TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {paginatedApps.map((app) => {
                                        const aPhone = app.userPhone || app.phone || 'Nincs adat';
                                        const isSelected = selectedIds.includes(app.id);
                                        return (
                                            <TableRow key={app.id} hover selected={isSelected} sx={{ '&:last-child td, &:last-child th': { border: 0 }, bgcolor: isSelected ? (isDarkMode ? 'rgba(129, 140, 248, 0.1) !important' : '#eef2ff !important') : 'inherit' }}>
                                                <TableCell sx={{ borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)', textAlign: 'center' }}>
                                                    <Tooltip title={isSelected ? "Kijelölés megszüntetése" : "Kijelölés"}>
                                                        <Avatar
                                                            src={!isSelected ? getAvatarUrl(app.userAvatar || app.profileImageUrl) : undefined}
                                                            onClick={() => handleSelectRow(app.id)}
                                                            sx={{
                                                                width: 36, height: 36, cursor: 'pointer', mx: 'auto',
                                                                bgcolor: isSelected ? 'success.main' : (isDarkMode ? 'primary.dark' : 'primary.main'),
                                                                fontWeight: 'bold', fontSize: '0.9rem', transition: 'transform 0.2s',
                                                                boxShadow: isSelected ? '0 0 0 2px rgba(46, 125, 50, 0.4)' : 'none',
                                                                '&:hover': { transform: 'scale(1.1)' }
                                                            }}
                                                        >
                                                            {isSelected ? <CheckCircleIcon sx={{ color: 'white', fontSize: 20 }} /> : app.userName.charAt(0)}
                                                        </Avatar>
                                                    </Tooltip>
                                                </TableCell>
                                                <TableCell sx={{ fontWeight: 'bold', color: 'text.primary', borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)' }}>
                                                    <Typography fontWeight="bold" color="text.primary">{app.userName}</Typography>
                                                </TableCell>
                                                <TableCell sx={{ borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)' }}>
                                                    <Typography variant="body2" color="text.primary">{app.userEmail}</Typography>
                                                    <Typography variant="caption" color="text.secondary">{aPhone}</Typography>
                                                </TableCell>
                                                <TableCell sx={{ borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)' }}><Chip label={app.orgName} size="small" variant="outlined" color="warning" sx={{ fontWeight: 'bold' }} /></TableCell>
                                                <TableCell align="center" sx={{ borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)' }}>
                                                    <Box display="flex" justifyContent="center" gap={1}>
                                                        <Button variant="contained" color="success" size="small" onClick={() => handleApplication(app.id, 'APPROVED')} disabled={!!updatingKey} sx={{ borderRadius: 2, fontWeight: 'bold' }} disableElevation>Elfogad</Button>
                                                        <Button variant="outlined" color="error" size="small" onClick={() => handleApplication(app.id, 'REJECTED')} disabled={!!updatingKey} sx={{ borderRadius: 2, fontWeight: 'bold' }}>Elutasít</Button>
                                                    </Box>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )
                ) : (
                    // --- ÚJ GRID-ALAPÚ ELRENDEZÉS ---
                    <Grid container spacing={3}>
                        {paginatedUsers.map((user) => {
                            const visibleOrgs = user.organizations.filter(org => {
                                if (org.status === 'REMOVED' || org.status === 'PENDING') return false;
                                if (isSysAdmin) return true;
                                return myDetailedProfile?.organizations?.some(myOrg => myOrg.orgId === org.orgId);
                            });

                            const isSysAdminUser = user.globalRole === 'SYS_ADMIN' || user.role === 'SYS_ADMIN';
                            if (visibleOrgs.length === 0 && !isSysAdminUser) return null;

                            const displayOrgs = expandedCards[user.id] ? visibleOrgs : visibleOrgs.slice(0, 2);
                            const hiddenOrgsCount = visibleOrgs.length - 2;
                            const isSelected = selectedIds.includes(user.id);
                            const uPhone = user.phoneNumber || user.phone || 'Nincs adat';

                            return (
                                <Grid size={{ xs: 12, md: 6, xl: 4 }} key={user.id}>
                                    <Paper elevation={0} sx={{
                                        borderRadius: 4, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%',
                                        bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.5)' : 'white', backdropFilter: 'blur(20px)',
                                        border: '1px solid', borderColor: isSelected ? 'primary.main' : (isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
                                        transition: 'all 0.3s ease', transform: 'translateZ(0)',
                                        '&:hover': { transform: 'translateY(-4px)', boxShadow: isDarkMode ? '0 12px 40px rgba(0,0,0,0.4)' : '0 12px 40px rgba(149, 157, 165, 0.2)' }
                                    }}>
                                        <Box sx={{
                                            p: 3,
                                            bgcolor: isSelected ? (isDarkMode ? 'rgba(129, 140, 248, 0.1)' : '#eef2ff') : 'transparent',
                                            borderBottom: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'divider'
                                        }}>
                                            <Box display="flex" alignItems="flex-start" gap={2}>
                                                <Tooltip title={isSelected ? "Kijelölés megszüntetése" : "Kijelölés"}>
                                                    <Avatar
                                                        src={!isSelected ? getAvatarUrl(user.profileImageUrl, user.profilePictureUrl, user.avatarUrl) : undefined}
                                                        onClick={() => handleSelectRow(user.id)}
                                                        sx={{
                                                            width: 50, height: 50, cursor: 'pointer', flexShrink: 0,
                                                            bgcolor: isSelected ? 'success.main' : (isDarkMode ? 'primary.dark' : 'primary.main'),
                                                            fontSize: '1.2rem', fontWeight: 'bold', transition: 'transform 0.2s, box-shadow 0.2s',
                                                            boxShadow: isSelected ? '0 0 0 3px rgba(46, 125, 50, 0.4)' : 'none',
                                                            '&:hover': { transform: 'scale(1.05)' }
                                                        }}
                                                    >
                                                        {isSelected ? <CheckCircleIcon sx={{ color: 'white', fontSize: 30 }} /> : user.name.charAt(0)}
                                                    </Avatar>
                                                </Tooltip>
                                                <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                                                    <Typography
                                                        variant="h6" fontWeight="900" color="primary.main"
                                                        onClick={() => setSelectedUser(user)}
                                                        sx={{ cursor: 'pointer', wordBreak: 'break-word', lineHeight: 1.2, mb: 0.5, '&:hover': { textDecoration: 'underline' } }}
                                                    >
                                                        {user.name}
                                                    </Typography>
                                                    {isSysAdminUser && (
                                                        <Chip label="Adminisztrátor" size="small" color="primary" sx={{ display: 'inline-flex', mb: 1, height: '20px', fontSize: '0.7rem', fontWeight: 'bold' }} />
                                                    )}
                                                    <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-all', display: 'flex', alignItems: 'flex-start', gap: 0.5, mt: 0.5 }}>
                                                        <EmailIcon fontSize="small" sx={{ mt: '2px', flexShrink: 0 }}/> {user.email}
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                                                        <PhoneIcon fontSize="small" sx={{ flexShrink: 0 }}/> {uPhone}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </Box>

                                        <Box sx={{ p: 3, flexGrow: 1, display: 'flex', flexDirection: 'column', bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : '#f8fafc' }}>
                                            <Typography variant="caption" fontWeight="bold" color="text.secondary" textTransform="uppercase" letterSpacing={1} mb={2} display="block">Szervezeti Szerepkörök</Typography>

                                            {isSysAdminUser ? (
                                                <Box sx={{
                                                    p: 2, borderRadius: 3,
                                                    bgcolor: isDarkMode ? 'rgba(56, 189, 248, 0.1)' : '#f0f9ff',
                                                    border: '1px solid', borderColor: isDarkMode ? 'rgba(56, 189, 248, 0.3)' : '#bae6fd'
                                                }}>
                                                    <Typography variant="subtitle1" color={isDarkMode ? '#38bdf8' : 'info.main'} fontWeight="900" display="flex" alignItems="center" gap={1}>
                                                        <SecurityIcon fontSize="small" /> Globális Rendszergazda
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary" mt={0.5}>
                                                        Ennek a felhasználónak korlátlan hozzáférése van a rendszer összes szervezetéhez és eseményéhez, a helyi plecsniktől függetlenül.
                                                    </Typography>
                                                </Box>
                                            ) : visibleOrgs.length === 0 ? (
                                                <Typography variant="body2" color="text.secondary" fontStyle="italic">Nincs aktív tagsága szervezetben.</Typography>
                                            ) : (
                                                <Stack spacing={1.5}>
                                                    {displayOrgs.map((org) => {
                                                        const isSelf = user.email === currentUser?.email;
                                                        const myRoleInThisOrg = myDetailedProfile?.organizations.find(myOrg => myOrg.orgId === org.orgId)?.orgRole;
                                                        const canEdit = isSysAdmin || (!isSelf && org.orgRole !== 'OWNER' && (myRoleInThisOrg === 'OWNER' || myRoleInThisOrg === 'ORGANIZER'));

                                                        return (
                                                            <Paper key={org.orgId} elevation={0} sx={{
                                                                p: 2, display: 'flex', flexDirection: 'column', gap: 1,
                                                                bgcolor: isDarkMode ? 'rgba(255,255,255,0.02)' : 'white',
                                                                border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#e2e8f0', borderRadius: 3
                                                            }}>
                                                                <Typography variant="subtitle2" fontWeight="800" color="text.primary">{org.orgName}</Typography>
                                                                <Box display="flex" alignItems="center" justifyContent="space-between">
                                                                    <FormControl size="small" sx={{ flexGrow: 1, mr: 1 }}>
                                                                        <Select
                                                                            value={org.orgRole} disabled={!canEdit || updatingKey === `${user.id}-${org.orgId}`}
                                                                            onChange={(e) => handleOrgRoleChange(user.id, org.orgId, e.target.value)}
                                                                            sx={{
                                                                                boxShadow: 'none', '.MuiOutlinedInput-notchedOutline': { border: 0 },
                                                                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { border: 0 },
                                                                                pl: 0, pr: '0 !important', bgcolor: 'transparent',
                                                                                '& .MuiSelect-select': { py: 0.5, pl: 0, display: 'flex', alignItems: 'center' }
                                                                            }}
                                                                            renderValue={(selected) => (
                                                                                <Chip label={ROLE_LABELS[selected as string]} color={ROLE_COLORS[selected as string]} size="small" variant={canEdit ? "filled" : "outlined"} sx={{ width: '100%', justifyContent: 'space-between', fontWeight: 'bold', borderRadius: 2 }} />
                                                                            )}
                                                                        >
                                                                            <MenuItem value="VOLUNTEER" sx={{ fontWeight: 'bold' }}>Önkéntes</MenuItem>
                                                                            <MenuItem value="ORGANIZER" sx={{ fontWeight: 'bold', color: 'secondary.main' }}>Globális Szervező</MenuItem>
                                                                            <MenuItem value="OWNER" disabled sx={{ fontWeight: 'bold', color: 'error.main' }}>Alapító</MenuItem>
                                                                        </Select>
                                                                    </FormControl>
                                                                    {canEdit && org.orgRole !== 'OWNER' && (
                                                                        <Tooltip title="Eltávolítás a szervezetből">
                                                                            <IconButton size="small" color="error" onClick={() => setMemberToDelete({ userId: user.id, orgId: org.orgId, userName: user.name, orgName: org.orgName, reason: '' })} disabled={updatingKey === `${user.id}-${org.orgId}`} sx={{ bgcolor: isDarkMode ? 'rgba(239, 68, 68, 0.1)' : '#fee2e2' }}>
                                                                                <DeleteIcon fontSize="small" />
                                                                            </IconButton>
                                                                        </Tooltip>
                                                                    )}
                                                                </Box>
                                                            </Paper>
                                                        );
                                                    })}
                                                </Stack>
                                            )}

                                            {hiddenOrgsCount > 0 && !expandedCards[user.id] && (
                                                <Button size="small" endIcon={<KeyboardArrowDownIcon />} onClick={() => toggleCardExpansion(user.id)} sx={{ mt: 2, alignSelf: 'flex-start', fontWeight: 'bold', borderRadius: 2 }}>
                                                    +{hiddenOrgsCount} további szervezet
                                                </Button>
                                            )}
                                            {expandedCards[user.id] && (
                                                <Button size="small" endIcon={<KeyboardArrowUpIcon />} onClick={() => toggleCardExpansion(user.id)} sx={{ mt: 2, alignSelf: 'flex-start', fontWeight: 'bold', borderRadius: 2 }}>
                                                    Kevesebb mutatása
                                                </Button>
                                            )}
                                        </Box>
                                    </Paper>
                                </Grid>
                            );
                        })}
                    </Grid>
                )}

                {totalPages > 1 && (
                    <Box display="flex" justifyContent="center" mt={5}>
                        <Pagination count={totalPages} page={page} onChange={(_e, v) => setPage(v)} color="primary" size={isMobile ? "small" : "large"} shape="rounded" sx={{ '& .MuiPaginationItem-root': { fontWeight: 'bold' } }}/>
                    </Box>
                )}

                <Dialog open={!!selectedUser} onClose={() => setSelectedUser(null)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, bgcolor: isDarkMode ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.9)', backdropFilter: 'blur(24px)', backgroundImage: 'none', border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.6)', overflow: 'hidden' } }}>
                    <Box sx={{ p: 4, textAlign: 'center', background: isDarkMode ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.9))' : 'linear-gradient(135deg, #e0e7ff, #ede9fe)', borderBottom: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider' }}>
                        <Avatar src={getAvatarUrl(selectedUser?.profileImageUrl, selectedUser?.profilePictureUrl, selectedUser?.avatarUrl)} sx={{ width: 100, height: 100, mx: 'auto', mb: 2, bgcolor: 'primary.main', fontSize: '3rem', fontWeight: 'bold', border: '4px solid white', boxShadow: '0 4px 14px rgba(0,0,0,0.1)' }}>{selectedUser?.name.charAt(0)}</Avatar>
                        <Typography variant="h4" fontWeight="900" color={isDarkMode ? 'white' : 'primary.dark'}>{selectedUser?.name}</Typography>
                        <Typography variant="body1" color={isDarkMode ? 'rgba(255,255,255,0.7)' : 'text.secondary'} mt={1}>{selectedUser?.email}</Typography>
                    </Box>
                    <DialogContent sx={{ p: { xs: 3, sm: 4 } }}>
                        <Box display="flex" alignItems="center" gap={2} mb={2} p={2} borderRadius={3} bgcolor={isDarkMode ? 'rgba(0,0,0,0.2)' : '#f8fafc'} border="1px solid" borderColor={isDarkMode ? 'rgba(255,255,255,0.05)' : '#e2e8f0'}>
                            <Avatar sx={{ bgcolor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'white', color: 'text.primary' }}><PhoneIcon /></Avatar>
                            <Box><Typography variant="caption" color="text.secondary" fontWeight="bold">Telefonszám</Typography><Typography variant="body1" fontWeight="bold" color="text.primary">{selectedUser?.phoneNumber || selectedUser?.phone || 'Nincs megadva'}</Typography></Box>
                        </Box>
                        <Box display="flex" alignItems="center" gap={2} mb={4} p={2} borderRadius={3} bgcolor={isDarkMode ? 'rgba(0,0,0,0.2)' : '#f8fafc'} border="1px solid" borderColor={isDarkMode ? 'rgba(255,255,255,0.05)' : '#e2e8f0'}>
                            <Avatar sx={{ bgcolor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'white', color: 'text.primary' }}><PersonIcon /></Avatar>
                            <Box><Typography variant="caption" color="text.secondary" fontWeight="bold">Rendszer Jogosultság</Typography><Typography variant="body1" fontWeight="bold" color="text.primary">{selectedUser?.globalRole === 'SYS_ADMIN' || selectedUser?.role === 'SYS_ADMIN' ? 'Adminisztrátor' : 'Felhasználó'}</Typography></Box>
                        </Box>

                        <Typography variant="subtitle2" color="primary" fontWeight="900" textTransform="uppercase" letterSpacing={1} gutterBottom mb={2}>Szervezeti Tagságok</Typography>
                        <Stack spacing={1.5}>
                            {selectedUser?.globalRole === 'SYS_ADMIN' || selectedUser?.role === 'SYS_ADMIN' ? (
                                <Box sx={{ p: 2, borderRadius: 3, bgcolor: isDarkMode ? 'rgba(56, 189, 248, 0.1)' : '#f0f9ff', border: '1px solid', borderColor: isDarkMode ? 'rgba(56, 189, 248, 0.3)' : '#bae6fd' }}>
                                    <Typography variant="body2" fontWeight="bold" color={isDarkMode ? '#38bdf8' : 'info.main'}>Globális Rendszergazda</Typography>
                                    <Typography variant="caption" color="text.secondary">Teljes hozzáférés minden szervezethez.</Typography>
                                </Box>
                            ) : selectedUser?.organizations.filter(o => o.status === 'APPROVED').length === 0 ? (
                                <Typography variant="body2" color="text.secondary" fontStyle="italic">Nincs aktív tagsága.</Typography>
                            ) : (
                                selectedUser?.organizations.filter(o => o.status === 'APPROVED').map(org => (
                                    <Box key={org.orgId} display="flex" justifyContent="space-between" alignItems="center" p={2} bgcolor={isDarkMode ? 'rgba(255,255,255,0.05)' : '#f1f5f9'} borderRadius={3}>
                                        <Typography variant="body2" fontWeight="bold" color="text.primary">{org.orgName}</Typography>
                                        <Chip label={ROLE_LABELS[org.orgRole]} color={ROLE_COLORS[org.orgRole]} size="small" variant="filled" sx={{ fontWeight: 'bold', borderRadius: 2 }} />
                                    </Box>
                                ))
                            )}
                        </Stack>
                    </DialogContent>
                    <DialogActions sx={{ p: 3, pt: 1, bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'transparent' }}><Button onClick={() => setSelectedUser(null)} variant="contained" sx={{ borderRadius: 3, fontWeight: 'bold', px: 4 }} disableElevation>Bezárás</Button></DialogActions>
                </Dialog>

                <Dialog open={!!memberToDelete} onClose={() => setMemberToDelete(null)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, bgcolor: isDarkMode ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.9)', backdropFilter: 'blur(24px)', backgroundImage: 'none' } }}>
                    <DialogTitle sx={{ fontWeight: '900', color: 'error.main', pt: 4 }}>Tag eltávolítása</DialogTitle>
                    <DialogContent sx={{ mt: 1 }}>
                        <Typography color="text.secondary" mb={3}>Biztosan eltávolítod <strong>{memberToDelete?.userName}</strong> nevű tagot innen: <strong>{memberToDelete?.orgName}</strong>?</Typography>
                        <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>Az eltávolítás indoklását a felhasználó látni fogja a Történelem fülén.</Alert>
                        <TextField
                            fullWidth autoFocus multiline rows={3} label="Eltávolítás indoka (Opcionális)" variant="outlined"
                            value={memberToDelete?.reason || ''}
                            onChange={(e) => setMemberToDelete(prev => prev ? { ...prev, reason: e.target.value } : null)}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                        />
                    </DialogContent>
                    <DialogActions sx={{ p: 3, pt: 1 }}><Button onClick={() => setMemberToDelete(null)} color="inherit" sx={{ fontWeight: 'bold' }}>Mégse</Button><Button onClick={handleRemoveMember} variant="contained" color="error" disabled={!!updatingKey} sx={{ borderRadius: 3, fontWeight: 'bold', px: 3 }} disableElevation>{updatingKey ? 'Eltávolítás...' : 'Véglegesítés'}</Button></DialogActions>
                </Dialog>

                <Dialog open={rejectModalOpen} onClose={() => setRejectModalOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, bgcolor: isDarkMode ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.9)', backdropFilter: 'blur(24px)', backgroundImage: 'none', border: '1px solid', borderColor: isDarkMode ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.3)' } }}>
                    <DialogTitle sx={{ fontWeight: '900', color: 'error.main', pt: 4 }}>Elutasítás indoklása</DialogTitle>
                    <DialogContent sx={{ mt: 1 }}>
                        <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>Az indoklást a jelentkező látni fogja a saját profiljában.</Alert>
                        <TextField fullWidth autoFocus multiline rows={4} label="Indoklás (Kötelező)" variant="outlined" value={rejectMessage} onChange={(e) => setRejectMessage(e.target.value)} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}/>
                    </DialogContent>
                    <DialogActions sx={{ p: 3, pt: 1 }}><Button onClick={() => setRejectModalOpen(false)} color="inherit" disabled={loading} sx={{ fontWeight: 'bold' }}>Mégse</Button><Button onClick={confirmRejection} variant="contained" color="error" disabled={loading || !rejectMessage.trim()} sx={{ borderRadius: 3, fontWeight: 'bold', px: 3 }} disableElevation>{loading ? 'Folyamatban...' : 'Véglegesítés'}</Button></DialogActions>
                </Dialog>

                <Dialog open={bulkRestoreModalOpen} onClose={() => setBulkRestoreModalOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, bgcolor: isDarkMode ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.9)', backdropFilter: 'blur(24px)', backgroundImage: 'none' } }}>
                    <DialogTitle sx={{ fontWeight: '900', color: 'primary.main', pt: 4 }}>Tömeges Visszaállítás</DialogTitle>
                    <DialogContent sx={{ mt: 1 }}>
                        <Typography color="text.secondary" mb={3}>
                            Biztosan visszaállítod a kijelölt <strong>{selectedIds.length}</strong> tagot az Aktív csapatba?
                        </Typography>
                        <Alert severity="info" sx={{ mb: 1, borderRadius: 2 }}>
                            A visszaállítás után a felhasználók azonnal visszakapják a jogosultságaikat a szervezetben.
                        </Alert>
                    </DialogContent>
                    <DialogActions sx={{ p: 3, pt: 1 }}>
                        <Button onClick={() => setBulkRestoreModalOpen(false)} color="inherit" sx={{ fontWeight: 'bold' }}>Mégse</Button>
                        <Button onClick={confirmBulkRestore} variant="contained" color="primary" disabled={loading} sx={{ borderRadius: 3, fontWeight: 'bold', px: 3 }} disableElevation>
                            {loading ? 'Folyamatban...' : 'Igen, visszaállítom'}
                        </Button>
                    </DialogActions>
                </Dialog>

                <Dialog open={!!memberToRestore} onClose={() => setMemberToRestore(null)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, bgcolor: isDarkMode ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.9)', backdropFilter: 'blur(24px)', backgroundImage: 'none' } }}>
                    <DialogTitle sx={{ fontWeight: '900', color: 'primary.main', pt: 4 }}>Tag visszaállítása</DialogTitle>
                    <DialogContent sx={{ mt: 1 }}>
                        <Typography color="text.secondary" mb={3}>
                            Biztosan visszaállítod <strong>{memberToRestore?.userName}</strong> nevű tagot az Aktív csapatba (<strong>{memberToRestore?.orgName}</strong>)?
                        </Typography>
                        <Alert severity="info" sx={{ mb: 1, borderRadius: 2 }}>
                            A visszaállítás után a felhasználó azonnal visszanyeri jogosultságait.
                        </Alert>
                    </DialogContent>
                    <DialogActions sx={{ p: 3, pt: 1 }}>
                        <Button onClick={() => setMemberToRestore(null)} color="inherit" sx={{ fontWeight: 'bold' }}>Mégse</Button>
                        <Button onClick={confirmRestoreMember} variant="contained" color="primary" disabled={!!updatingKey} sx={{ borderRadius: 3, fontWeight: 'bold', px: 3 }} disableElevation>
                            {updatingKey ? 'Visszaállítás...' : 'Igen, visszaállítom'}
                        </Button>
                    </DialogActions>
                </Dialog>

                <Dialog
                    open={emailModalOpen}
                    onClose={() => { setEmailModalOpen(false); setEmailAttachments([]); }}
                    maxWidth="sm"
                    fullWidth
                    PaperProps={{ sx: { borderRadius: 4, bgcolor: isDarkMode ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.9)', backdropFilter: 'blur(24px)', backgroundImage: 'none' } }}
                >
                    <DialogTitle sx={{ fontWeight: '900', color: 'primary.main', pt: 4 }}>Közös üzenet küldése ({selectedIds.length} fő)</DialogTitle>
                    <DialogContent sx={{ mt: 1, overflow: 'visible' }}>
                        <TextField
                            fullWidth
                            size="small"
                            margin="normal"
                            label="E-mail tárgya"
                            variant="outlined"
                            value={emailSubject}
                            onChange={(e) => setEmailSubject(e.target.value)}
                            sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                        />

                        <Typography variant="caption" fontWeight="bold" color="text.secondary" mb={1} display="block">
                            Üzenet (HTML támogatott)
                        </Typography>
                        <Box sx={{
                            '.ql-container': {
                                borderBottomLeftRadius: 12,
                                borderBottomRightRadius: 12,
                                minHeight: '200px',
                                fontSize: '1rem',
                                borderColor: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
                                color: isDarkMode ? 'white' : 'inherit',
                                fontFamily: 'inherit'
                            },
                            '.ql-toolbar': {
                                borderTopLeftRadius: 12,
                                borderTopRightRadius: 12,
                                borderColor: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
                                bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#fafafa',
                                '& .ql-stroke': { stroke: isDarkMode ? '#cbd5e1' : '#444' },
                                '& .ql-fill': { fill: isDarkMode ? '#cbd5e1' : '#444' },
                                '& .ql-picker': { color: isDarkMode ? '#cbd5e1' : '#444' }
                            },
                            '.ql-editor': {
                                minHeight: '200px'
                            },
                            '.ql-editor.ql-blank::before': {
                                color: isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                                fontStyle: 'italic',
                            }
                        }}>
                            <ReactQuill
                                theme="snow"
                                modules={quillModules}
                                value={emailMessage}
                                onChange={setEmailMessage}
                                placeholder="Írd ide a formázott üzenetet..."
                            />
                        </Box>

                        <Box mt={3}>
                            <Button
                                component="label"
                                variant="outlined"
                                startIcon={<AttachFileIcon />}
                                size="small"
                                sx={{ borderRadius: 2, fontWeight: 'bold' }}
                            >
                                Fájl csatolása
                                <input
                                    type="file"
                                    multiple
                                    hidden
                                    onChange={(e) => {
                                        if (e.target.files) {
                                            setEmailAttachments(prev => [...prev, ...Array.from(e.target.files as FileList)]);
                                        }
                                        e.target.value = '';
                                    }}
                                />
                            </Button>

                            {emailAttachments.length > 0 && (
                                <Box mt={2} display="flex" flexWrap="wrap" gap={1}>
                                    {emailAttachments.map((file, index) => (
                                        <Chip
                                            key={index}
                                            label={file.name}
                                            onDelete={() => setEmailAttachments(prev => prev.filter((_, i) => i !== index))}
                                            size="small"
                                            color="primary"
                                            variant="outlined"
                                        />
                                    ))}
                                </Box>
                            )}
                        </Box>
                    </DialogContent>
                    <DialogActions sx={{ p: 3, pt: 2 }}>
                        <Button onClick={() => { setEmailModalOpen(false); setEmailAttachments([]); }} color="inherit" sx={{ fontWeight: 'bold' }}>Mégse</Button>
                        <Button variant="contained" color="primary" onClick={handleSendEmail} disabled={sendingEmail || !emailSubject.trim() || !emailMessage.trim() || emailMessage === '<p><br></p>'} sx={{ borderRadius: 3, fontWeight: 'bold', px: 3 }} disableElevation>
                            {sendingEmail ? 'Küldés...' : 'Kiküldés'}
                        </Button>
                    </DialogActions>
                </Dialog>

                <Dialog open={emailSuccessOpen} onClose={() => setEmailSuccessOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 4, bgcolor: isDarkMode ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.9)', backdropFilter: 'blur(24px)', backgroundImage: 'none' } }}>
                    <DialogContent sx={{ textAlign: 'center', py: 5 }}>
                        <CheckCircleIcon sx={{ fontSize: 90, color: '#16a34a', mb: 2 }} />
                        <Typography variant="h5" fontWeight="900" color="text.primary">Sikeres küldés!</Typography>
                        <Typography variant="body2" color="text.secondary" mt={1}>Az üzenetek bekerültek a háttérfolyamatba.</Typography>
                    </DialogContent>
                    <DialogActions sx={{ justifyContent: 'center', pb: 4 }}><Button variant="contained" color="success" onClick={() => setEmailSuccessOpen(false)} sx={{ borderRadius: 3, fontWeight: 'bold', px: 4 }} disableElevation>Rendben</Button></DialogActions>
                </Dialog>
            </Container>
        </Fade>
    );
}