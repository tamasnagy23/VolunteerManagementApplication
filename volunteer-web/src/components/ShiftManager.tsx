import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
    Container, Typography, Box, Paper, Button, CircularProgress,
    Alert, Avatar, IconButton, Collapse, Dialog, DialogTitle,
    DialogContent, DialogActions, Checkbox, Divider, TextField,
    MenuItem, Select, InputLabel, FormControl, ToggleButton, ToggleButtonGroup,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Chip, List, ListItem, ListItemButton, ListItemText, ListItemAvatar,
    useTheme, useMediaQuery, RadioGroup, FormControlLabel, Radio
} from '@mui/material';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import ViewListIcon from '@mui/icons-material/ViewList';
import DownloadIcon from '@mui/icons-material/Download';
import SearchIcon from '@mui/icons-material/Search';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import EmailIcon from '@mui/icons-material/Email';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import PersonIcon from '@mui/icons-material/Person';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LayersIcon from '@mui/icons-material/Layers';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import BlockIcon from '@mui/icons-material/Block';
import LockIcon from '@mui/icons-material/Lock';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';

import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import type { Event as CalendarEvent, View, ToolbarProps, SlotInfo } from 'react-big-calendar';

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

// --- INTERFÉSZEK ---
interface AssignedUser {
    applicationId: number;
    userId: number;
    name: string;
    email: string;
    status?: 'PENDING' | 'CONFIRMED' | 'MODIFICATION_REQUESTED';
    message?: string;
    isBackup: boolean; // ÚJ: Jelzi, ha beugró!
}

interface Shift {
    id: number;
    workAreaId: number | null;
    workAreaName: string | null;
    name?: string;
    startTime: string;
    endTime: string;
    maxVolunteers: number;
    maxBackupVolunteers: number; // ÚJ: Beugrók maximális száma
    type: 'WORK' | 'MEETING' | 'PERSONAL';
    description?: string;
    assignedUsers: AssignedUser[];
}

interface WorkArea {
    id: number;
    name: string;
}

interface ApprovedApplicant {
    applicationId: number;
    userName: string;
    userEmail: string;
    workAreaId: number;
}

interface EventData {
    id: number;
    title: string;
}

interface ShiftCalendarEvent extends CalendarEvent {
    resource: {
        shift: Shift;
        assignedData: AssignedUser | null;
    };
}

interface PendingApplicationDTO {
    id: number;
    userName: string;
    userEmail: string;
    workAreaId: number;
    workAreaName: string;
    status: string;
}

interface MyPermissions {
    globalAdmin: boolean;
    eventRole: string | null;
    permissions: string[];
    coordinatedWorkAreas: number[];
}

interface EventTeamMember {
    userId: number;
    userName: string;
    userEmail: string;
    eventRole: string | null;
    coordinatedWorkAreaIds: number[];
}

const getDayName = (dateString: string) => {
    const days = ['Vasárnap', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat'];
    return days[new Date(dateString).getDay()];
};
const formatDateWithDay = (dateString: string) => {
    const d = new Date(dateString);
    const datePart = d.toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' });
    return `${datePart} (${getDayName(dateString)})`;
};
const formatTimeOnly = (dateString: string) => new Date(dateString).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
const formatDateForInput = (dateString: string) => dateString ? dateString.substring(0, 16) : '';

const CustomToolbar = (toolbar: ToolbarProps<ShiftCalendarEvent>) => {
    return (
        <Box display="flex" flexWrap="wrap" justifyContent="space-between" alignItems="center" mb={2} gap={1}>
            <Button variant="outlined" onClick={() => toolbar.onNavigate('TODAY')} size="small" sx={{ fontWeight: 'bold' }}>Ma</Button>
            <Box display="flex" alignItems="center" gap={1}>
                <IconButton onClick={() => toolbar.onNavigate('PREV')} color="primary" sx={{ bgcolor: '#f1f5f9', width: 32, height: 32 }}><ChevronLeftIcon /></IconButton>
                <Typography variant="subtitle1" fontWeight="bold" sx={{ minWidth: 120, textAlign: 'center', textTransform: 'capitalize' }}>
                    {toolbar.label}
                </Typography>
                <IconButton onClick={() => toolbar.onNavigate('NEXT')} color="primary" sx={{ bgcolor: '#f1f5f9', width: 32, height: 32 }}><ChevronRightIcon /></IconButton>
            </Box>
            <ToggleButtonGroup value={toolbar.view} exclusive onChange={(_, newView) => newView && toolbar.onView(newView)} size="small">
                <ToggleButton value="month">Hó</ToggleButton>
                <ToggleButton value="week">Hét</ToggleButton>
                <ToggleButton value="day">Nap</ToggleButton>
            </ToggleButtonGroup>
        </Box>
    );
};

export default function ShiftManager() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const [event, setEvent] = useState<EventData | null>(null);
    const [workAreas, setWorkAreas] = useState<WorkArea[]>([]);
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [approvedApplicants, setApprovedApplicants] = useState<ApprovedApplicant[]>([]);

    const [myPermissions, setMyPermissions] = useState<MyPermissions | null>(null);
    const [team, setTeam] = useState<EventTeamMember[]>([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [expandedShifts, setExpandedShifts] = useState<number[]>([]);

    const [viewMode, setViewMode] = useState<'cards' | 'table' | 'calendar'>('cards');

    const [filterArea, setFilterArea] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterDate, setFilterDate] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const [selectedVolunteerForCalendar, setSelectedVolunteerForCalendar] = useState<string | null>(null);
    const [calendarDate, setCalendarDate] = useState(new Date());
    const [calendarView, setCalendarView] = useState<View>('month');

    // BEOSZTÁS ÁLLAPOTOK
    const [assignModalOpen, setAssignModalOpen] = useState(false);
    const [selectedShiftForAssign, setSelectedShiftForAssign] = useState<Shift | null>(null);
    const [selectedApplicantIds, setSelectedApplicantIds] = useState<number[]>([]);
    const [selectedBackupIds, setSelectedBackupIds] = useState<number[]>([]); // ÚJ: Beugrók listája
    const [assignMode, setAssignMode] = useState<'NORMAL' | 'BACKUP'>('NORMAL'); // ÚJ: Modal kapcsoló

    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [errorModalOpen, setErrorModalOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [usersListModalOpen, setUsersListModalOpen] = useState(false);
    const [selectedShiftForUsersList, setSelectedShiftForUsersList] = useState<Shift | null>(null);

    const [openedFromList, setOpenedFromList] = useState(false);
    const [volunteerDetailsModalOpen, setVolunteerDetailsModalOpen] = useState(false);
    const [selectedVolunteerDetails, setSelectedVolunteerDetails] = useState<{ user: AssignedUser, shift: Shift } | null>(null);

    const [editMode, setEditMode] = useState(false);
    const [editingShiftId, setEditingShiftId] = useState<number | null>(null);
    const [targetWorkAreaId, setTargetWorkAreaId] = useState<number | string | null>(null);

    // ÚJ: maxBackupVolunteers bekerült a state-be
    const [newShiftData, setNewShiftData] = useState({ name: '', startTime: '', endTime: '', maxVolunteers: 5, maxBackupVolunteers: 0, type: 'WORK', description: '' });

    const [autoAssignApplicationId, setAutoAssignApplicationId] = useState<number | null>(null);

    const [deletePersonalModalOpen, setDeletePersonalModalOpen] = useState(false);
    const [personalDeleteMessage, setPersonalDeleteMessage] = useState('');
    const [shiftToDelete, setShiftToDelete] = useState<Shift | null>(null);

    useEffect(() => {
        if (id) fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError('');
            const [eventRes, areasRes, shiftsRes, appsRes, permsRes, teamRes] = await Promise.all([
                api.get(`/events/${id}`),
                api.get(`/events/${id}/work-areas`),
                api.get(`/events/${id}/shifts`),
                api.get(`/applications/event/${id}`, { params: { status: 'APPROVED' } }),
                api.get(`/events/${id}/my-permissions`),
                api.get(`/events/${id}/team`)
            ]);

            setEvent(eventRes.data);
            setWorkAreas(areasRes.data);
            setShifts(shiftsRes.data);
            setMyPermissions(permsRes.data);

            setTeam((teamRes.data as EventTeamMember[]).filter(m => !m.userEmail.endsWith('@anonymized.local')));

            const applicants: ApprovedApplicant[] = appsRes.data
                .filter((app: PendingApplicationDTO) => !app.userEmail.endsWith('@anonymized.local'))
                .map((app: PendingApplicationDTO) => ({
                    applicationId: app.id,
                    userName: app.userName,
                    userEmail: app.userEmail,
                    workAreaId: app.workAreaId
                }));
            setApprovedApplicants(applicants);
        } catch (err) {
            console.error(err); setError("Hiba az adatok betöltésekor!");
        } finally {
            setLoading(false);
        }
    };

    const canManageArea = (areaId: number | string | null) => {
        if (!myPermissions) return false;
        if (myPermissions.globalAdmin || myPermissions.eventRole === 'ORGANIZER') return true;
        if (myPermissions.permissions.includes('MANAGE_SHIFTS')) return true;
        if (areaId === 'global' || areaId === null) return false;
        return myPermissions.coordinatedWorkAreas.includes(Number(areaId));
    };

    const canManageShift = (shift: Shift) => {
        if (shift.type === 'PERSONAL') return true;
        return canManageArea(shift.workAreaId);
    };

    const uniqueDates = useMemo(() => Array.from(new Set(shifts.map(s => formatDateWithDay(s.startTime)))).sort(), [shifts]);

    const filteredShifts = useMemo(() => {
        return shifts.filter(shift => {
            if (filterArea !== 'all' && shift.workAreaId !== null && shift.workAreaId.toString() !== filterArea) return false;
            if (filterDate !== 'all' && formatDateWithDay(shift.startTime) !== filterDate) return false;

            if (shift.type !== 'PERSONAL') {
                const normalCount = shift.assignedUsers?.filter(u => !u.isBackup).length || 0;
                const isFull = normalCount >= shift.maxVolunteers;
                if (filterStatus === 'full' && !isFull) return false;
                if (filterStatus === 'has_space' && isFull) return false;
            }

            if (searchQuery.trim() !== '') {
                const query = searchQuery.toLowerCase();
                const hasVolunteer = shift.assignedUsers?.some(u => u.name.toLowerCase().includes(query));
                const matchName = shift.name?.toLowerCase().includes(query) || shift.description?.toLowerCase().includes(query);
                if (!hasVolunteer && !matchName) return false;
            }
            return true;
        }).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    }, [shifts, filterArea, filterStatus, filterDate, searchQuery]);

    const uniqueVolunteers = useMemo(() => {
        const map = new Map<string, { email: string, name: string }>();
        approvedApplicants.forEach(a => {
            if (filterArea !== 'all' && a.workAreaId.toString() !== filterArea) return;
            if (searchQuery !== '' && !a.userName.toLowerCase().includes(searchQuery.toLowerCase())) return;
            if (!map.has(a.userEmail)) map.set(a.userEmail, { email: a.userEmail, name: a.userName });
        });
        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [approvedApplicants, filterArea, searchQuery]);

    const activeShifts = useMemo(() => {
        if (selectedVolunteerForCalendar) {
            return filteredShifts.filter(s => s.assignedUsers?.some(u => u.email === selectedVolunteerForCalendar));
        } else {
            return filteredShifts.filter(s => s.type !== 'PERSONAL');
        }
    }, [filteredShifts, selectedVolunteerForCalendar]);

    const shiftsByDay = useMemo(() => {
        const map = new Map<string, Shift[]>();
        activeShifts.forEach(shift => {
            const dateKey = format(new Date(shift.startTime), 'yyyy-MM-dd');
            if (!map.has(dateKey)) map.set(dateKey, []);
            map.get(dateKey)!.push(shift);
        });
        return map;
    }, [activeShifts]);

    const assignableApplicants = useMemo(() => {
        if (!selectedShiftForAssign) return [];
        if (selectedShiftForAssign.type === 'MEETING') {
            const unique = new Map<string, ApprovedApplicant>();
            approvedApplicants.forEach(a => {
                if (!unique.has(a.userEmail) && !selectedShiftForAssign.assignedUsers.some(u => u.email === a.userEmail)) {
                    unique.set(a.userEmail, a);
                }
            });
            return Array.from(unique.values());
        } else {
            return approvedApplicants.filter(a =>
                a.workAreaId === selectedShiftForAssign.workAreaId &&
                !selectedShiftForAssign.assignedUsers.some(u => u.email === a.userEmail)
            );
        }
    }, [approvedApplicants, selectedShiftForAssign]);

    const desktopCalendarEvents = useMemo<ShiftCalendarEvent[]>(() => {
        return activeShifts.map(shift => {
            if (selectedVolunteerForCalendar) {
                const assignedData = shift.assignedUsers.find(u => u.email === selectedVolunteerForCalendar);
                return {
                    title: shift.type === 'PERSONAL' ? `[Személyes] ${shift.description}` : `${shift.workAreaName || 'Globális'} ${shift.name ? `(${shift.name})` : ''}`,
                    start: new Date(shift.startTime),
                    end: new Date(shift.endTime),
                    resource: { shift, assignedData: assignedData || null }
                };
            } else {
                const normalCount = shift.assignedUsers?.filter(u => !u.isBackup).length || 0;
                return {
                    title: `${shift.workAreaName || 'Globális'} ${shift.name ? `(${shift.name})` : ''} (${normalCount}/${shift.type === 'MEETING' ? '∞' : shift.maxVolunteers})`,
                    start: new Date(shift.startTime),
                    end: new Date(shift.endTime),
                    resource: { shift, assignedData: null }
                };
            }
        });
    }, [activeShifts, selectedVolunteerForCalendar]);

    const eventStyleGetter = (event: ShiftCalendarEvent) => {
        let backgroundColor = '#3174ad';
        if (event.resource.shift.type === 'PERSONAL') backgroundColor = '#64748b';
        else if (event.resource.shift.type === 'MEETING') backgroundColor = '#9c27b0';
        else if (selectedVolunteerForCalendar && event.resource.assignedData) {
            if (event.resource.assignedData.status === 'CONFIRMED') backgroundColor = '#2e7d32';
            else if (event.resource.assignedData.status === 'MODIFICATION_REQUESTED') backgroundColor = '#d32f2f';
            else backgroundColor = '#ed6c02';
        } else {
            const normalCount = event.resource.shift.assignedUsers?.filter(u => !u.isBackup).length || 0;
            const isFull = normalCount >= event.resource.shift.maxVolunteers;
            backgroundColor = isFull ? '#2e7d32' : '#ed6c02';
        }
        return { style: { backgroundColor, borderRadius: '5px', opacity: 0.9, color: 'white', border: '0px', display: 'block' } };
    };

    const exportToExcel = () => {
        const excelData = shifts.map(shift => {
            const volunteers = shift.assignedUsers?.map(u => {
                let statusInfo = u.isBackup ? '[Beugró]' : '';
                if (u.status === 'CONFIRMED') statusInfo += ' (Elfogadva)';
                if (u.status === 'MODIFICATION_REQUESTED') statusInfo += ' (Probléma)';
                return `${u.name} ${statusInfo}`;
            }).join(', ') || 'Nincs beosztva senki';

            const normalCount = shift.assignedUsers?.filter(u => !u.isBackup).length || 0;

            return {
                'Típus': shift.type === 'MEETING' ? 'Gyűlés' : shift.type === 'PERSONAL' ? 'Személyes' : 'Műszak',
                'Munkaterület': shift.workAreaName || 'Globális',
                'Megnevezés': shift.name || shift.description || '-',
                'Nap': formatDateWithDay(shift.startTime),
                'Kezdés': formatTimeOnly(shift.startTime), 'Befejezés': formatTimeOnly(shift.endTime),
                'Kapacitás': shift.type === 'PERSONAL' ? '-' : `${normalCount} / ${shift.maxVolunteers} (+${shift.maxBackupVolunteers} beugró)`,
                'Státusz': normalCount >= shift.maxVolunteers ? 'Betelt' : 'Van hely',
                'Érintettek': volunteers
            };
        });
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        worksheet['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 25 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 50 }];
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Beosztás");
        XLSX.writeFile(workbook, `Beosztas_${event?.title || 'esemeny'}.xlsx`);
    };

    const toggleShiftExpand = (shiftId: number) => {
        setExpandedShifts(prev => prev.includes(shiftId) ? prev.filter(i => i !== shiftId) : [...prev, shiftId]);
    };

    const handleOpenCreateModal = (waId: number | string | null = null) => {
        setTargetWorkAreaId(waId);
        setAutoAssignApplicationId(null);
        setEditMode(false);
        setNewShiftData({ name: '', startTime: '', endTime: '', maxVolunteers: 5, maxBackupVolunteers: 0, type: 'WORK', description: '' });
        setCreateModalOpen(true);
    };

    const handleSelectSlot = (slotInfo: SlotInfo) => {
        const start = new Date(slotInfo.start);
        let end = new Date(slotInfo.end);

        if (start.getHours() === 0 && start.getMinutes() === 0 && end.getHours() === 0) {
            start.setHours(8, 0, 0, 0);
            end = new Date(start);
            end.setHours(16, 0, 0, 0);
        }

        const pad = (num: number) => String(num).padStart(2, '0');
        const toLocalISO = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

        if (selectedVolunteerForCalendar) {
            const volunteerApp = approvedApplicants.find(a => a.userEmail === selectedVolunteerForCalendar);
            if (volunteerApp) {
                if (!canManageArea(volunteerApp.workAreaId)) {
                    setErrorMessage("Nincs jogosultságod erre a területre beosztani őt.");
                    setErrorModalOpen(true);
                    return;
                }
                setTargetWorkAreaId(volunteerApp.workAreaId);
                setAutoAssignApplicationId(volunteerApp.applicationId);
            }
        } else {
            setTargetWorkAreaId(null);
            setAutoAssignApplicationId(null);
        }

        setEditMode(false);
        setNewShiftData({
            name: '', startTime: toLocalISO(start), endTime: toLocalISO(end), maxVolunteers: 5, maxBackupVolunteers: 0, type: 'WORK', description: ''
        });
        setCreateModalOpen(true);
    };

    const handleOpenCreateModalFromMobile = (date: Date) => {
        const slotInfo = { start: date, end: date } as SlotInfo;
        handleSelectSlot(slotInfo);
    };

    const handleOpenEditModal = (shift: Shift) => {
        if (shift.type === 'PERSONAL') {
            setErrorMessage("Személyes elfoglaltságot nem szerkeszthetsz, csak törölhetsz!");
            setErrorModalOpen(true);
            return;
        }

        setEditingShiftId(shift.id);
        setTargetWorkAreaId(shift.workAreaId || 'global');
        setAutoAssignApplicationId(null);
        setEditMode(true);
        setNewShiftData({
            name: shift.name || '',
            startTime: formatDateForInput(shift.startTime),
            endTime: formatDateForInput(shift.endTime),
            maxVolunteers: shift.maxVolunteers,
            maxBackupVolunteers: shift.maxBackupVolunteers || 0,
            type: shift.type,
            description: shift.description || ''
        });
        setCreateModalOpen(true);
    };

    const getStatusColor = (shiftType: string, status?: string) => {
        if (shiftType === 'PERSONAL') return '#64748b';
        if (shiftType === 'MEETING') return '#9c27b0';

        if (status === 'CONFIRMED') return '#2e7d32';
        if (status === 'MODIFICATION_REQUESTED') return '#d32f2f';
        return '#ed6c02';
    };

    const getStatusDot = (shiftType: string, status?: string) => {
        return <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: getStatusColor(shiftType, status), display: 'inline-block' }} />;
    };

    const handleSaveShift = async () => {
        setActionLoading(true);
        try {
            const payload = { ...newShiftData };

            if (editMode && editingShiftId) {
                await api.put(`/shifts/${editingShiftId}`, payload);
            } else {
                let res;
                if (targetWorkAreaId === 'global' || (newShiftData.type === 'MEETING' && targetWorkAreaId === 'global')) {
                    res = await api.post(`/shifts/event/${id}/global`, payload);
                } else {
                    res = await api.post(`/shifts/work-area/${targetWorkAreaId}`, payload);
                }

                if (autoAssignApplicationId && res.data && res.data.id) {
                    // Itt az auto beosztás mindig normálként történik (a naptáras drag&drop esetén)
                    await api.post(`/shifts/${res.data.id}/assign`, { applicationIds: [autoAssignApplicationId], backupApplicationIds: [] });
                }
            }
            setCreateModalOpen(false);
            setAutoAssignApplicationId(null);
            fetchData();
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } | string } };
            setErrorMessage(typeof err.response?.data === 'string' ? err.response.data : (err.response?.data?.message || "Hiba történt!"));
            setErrorModalOpen(true);
        } finally {
            setActionLoading(false);
        }
    };

    const confirmDeletePersonal = (shift: Shift) => {
        setShiftToDelete(shift);
        setPersonalDeleteMessage('');
        setDeletePersonalModalOpen(true);
    };

    const executeDeleteShift = async () => {
        if (!shiftToDelete) return;
        setActionLoading(true);
        try {
            let url = `/shifts/${shiftToDelete.id}`;
            if (shiftToDelete.type === 'PERSONAL') {
                url += `?message=${encodeURIComponent(personalDeleteMessage)}`;
            }
            await api.delete(url);
            setDeletePersonalModalOpen(false);
            setShiftToDelete(null);
            fetchData();
        }
        catch { setErrorMessage("Hiba törléskor."); setErrorModalOpen(true); }
        finally { setActionLoading(false); }
    };

    const handleDeleteShift = (shift: Shift) => {
        if (shift.type === 'PERSONAL') {
            confirmDeletePersonal(shift);
        } else {
            if (window.confirm("Biztosan törlöd ezt az idősávot?")) {
                setShiftToDelete(shift);
                executeDeleteShift();
            }
        }
    };

    const handleAssignUsers = async () => {
        if (!selectedShiftForAssign) return;
        setActionLoading(true);
        try {
            await api.post(`/shifts/${selectedShiftForAssign.id}/assign`, {
                applicationIds: selectedApplicantIds,
                backupApplicationIds: selectedBackupIds
            });
            setAssignModalOpen(false); fetchData();
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } | string } };
            setErrorMessage(typeof err.response?.data === 'string' ? err.response.data : (err.response?.data?.message || "Hiba a beosztásnál."));
            setErrorModalOpen(true);
        } finally {
            setActionLoading(false);
        }
    };

    const handleRemoveUser = async (shiftId: number, appId: number, name: string) => {
        if (!window.confirm(`Biztosan eltávolítod ${name} nevű önkéntest?`)) return;
        setActionLoading(true);
        try {
            await api.delete(`/shifts/${shiftId}/remove/${appId}`);
            setVolunteerDetailsModalOpen(false);
            setOpenedFromList(false);
            fetchData();
        } catch {
            setErrorMessage("Hiba az eltávolításnál."); setErrorModalOpen(true);
        } finally {
            setActionLoading(false);
        }
    };

    const openVolunteerDetails = (user: AssignedUser, shift: Shift, fromList: boolean = false) => {
        setSelectedVolunteerDetails({ user, shift });
        setOpenedFromList(fromList);
        setVolunteerDetailsModalOpen(true);
    };

    const mobileMonthStart = startOfMonth(calendarDate);
    const mobileMonthEnd = endOfMonth(mobileMonthStart);
    const mobileStartDate = startOfWeek(mobileMonthStart, { weekStartsOn: 1 });
    const mobileEndDate = endOfWeek(mobileMonthEnd, { weekStartsOn: 1 });
    const mobileCalendarDays = useMemo(() => eachDayOfInterval({ start: mobileStartDate, end: mobileEndDate }), [mobileStartDate, mobileEndDate]);

    if (loading) return <Box display="flex" justifyContent="center" mt={10}><CircularProgress size={60} /></Box>;

    return (
        <Container maxWidth="xl" sx={{ mt: { xs: 2, md: 4 }, mb: 10 }}>
            <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(`/dashboard`)} sx={{ mb: 3 }} disabled={actionLoading}>
                Vissza a dashboard-ra
            </Button>

            <Box mb={4} display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap">
                <Box>
                    <Typography variant="h4" fontWeight="900" color="primary.main">{event?.title}</Typography>
                    <Typography variant="h6" color="text.secondary">Beosztás, Gyűlések és Naptár kezelése</Typography>
                </Box>
                <Box display="flex" gap={1} flexWrap="wrap">
                    <Chip label="Műszak" sx={{ bgcolor: '#e8f5e9', color: '#2e7d32', fontWeight: 'bold' }} />
                    <Chip label="Gyűlés" sx={{ bgcolor: '#f3e5f5', color: '#9c27b0', fontWeight: 'bold' }} icon={<RecordVoiceOverIcon />} />
                    <Chip label="Személyes" sx={{ bgcolor: '#f1f5f9', color: '#64748b', fontWeight: 'bold' }} icon={<BlockIcon />} />
                    <Chip label="Beugró" sx={{ bgcolor: '#f3e5f5', color: 'secondary.main', fontWeight: 'bold' }} />
                </Box>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

            <Paper elevation={0} sx={{ p: 2, mb: 4, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 3 }}>
                <Box display="flex" flexWrap="wrap" gap={2} alignItems="center">

                    <ToggleButtonGroup
                        value={viewMode} exclusive onChange={(_, newView) => newView && setViewMode(newView)} size="small"
                        sx={{ bgcolor: 'white', flexGrow: { xs: 1, md: 0 }, '& .MuiToggleButton-root': { flexGrow: 1 } }}
                    >
                        <ToggleButton value="cards"><ViewModuleIcon sx={{ mr: 1 }}/> Kártyák</ToggleButton>
                        <ToggleButton value="table"><ViewListIcon sx={{ mr: 1 }}/> Táblázat</ToggleButton>
                        <ToggleButton value="calendar"><CalendarMonthIcon sx={{ mr: 1 }}/> Naptár</ToggleButton>
                    </ToggleButtonGroup>

                    <FormControl size="small" sx={{ minWidth: 150, flexGrow: { xs: 1, sm: 0 }, bgcolor: 'white' }}>
                        <InputLabel>Munkaterület</InputLabel>
                        <Select value={filterArea} label="Munkaterület" onChange={(e) => setFilterArea(e.target.value)}>
                            <MenuItem value="all">Minden Terület/Globális</MenuItem>
                            {workAreas.map(wa => <MenuItem key={wa.id} value={wa.id.toString()}>{wa.name}</MenuItem>)}
                        </Select>
                    </FormControl>

                    <FormControl size="small" sx={{ minWidth: 150, flexGrow: { xs: 1, sm: 0 }, bgcolor: 'white' }}>
                        <InputLabel>Melyik Nap?</InputLabel>
                        <Select value={filterDate} label="Melyik Nap?" onChange={(e) => setFilterDate(e.target.value)}>
                            <MenuItem value="all">Minden nap</MenuItem>
                            {uniqueDates.map(date => <MenuItem key={date} value={date}>{date}</MenuItem>)}
                        </Select>
                    </FormControl>

                    <FormControl size="small" sx={{ minWidth: 150, flexGrow: { xs: 1, sm: 0 }, bgcolor: 'white' }}>
                        <InputLabel>Státusz</InputLabel>
                        <Select value={filterStatus} label="Státusz" onChange={(e) => setFilterStatus(e.target.value)}>
                            <MenuItem value="all">Minden státusz</MenuItem>
                            <MenuItem value="has_space">Van még hely</MenuItem>
                            <MenuItem value="full">Betelt</MenuItem>
                        </Select>
                    </FormControl>

                    <TextField
                        size="small" label="Keresés névre/eseményre..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                        slotProps={{ input: { endAdornment: <SearchIcon color="action" /> } }}
                        sx={{ minWidth: 150, flexGrow: { xs: 1, md: 0 }, bgcolor: 'white' }}
                    />

                    <Button variant="outlined" color="success" startIcon={<DownloadIcon />} onClick={exportToExcel} sx={{ ml: { xs: 0, lg: 'auto' }, width: { xs: '100%', lg: 'auto' }, bgcolor: 'white' }}>
                        Excel Letöltés
                    </Button>
                </Box>
            </Paper>

            {/* --- KÁRTYA NÉZET --- */}
            {viewMode === 'cards' && (
                [
                    ...workAreas.filter(area => filterArea === 'all' || filterArea === area.id.toString()).map(a => ({ id: a.id, name: a.name })),
                    { id: 'global', name: '🌐 Globális Gyűlések' }
                ].map((area) => {
                    const shiftsInArea = filteredShifts.filter(s => {
                        if (area.id === 'global') return s.workAreaId === null && s.type === 'MEETING';
                        return s.workAreaId === area.id;
                    });

                    const hasAccess = canManageArea(area.id);

                    const areaCoordinators = team.filter(member => member.eventRole === 'COORDINATOR' && member.coordinatedWorkAreaIds.includes(area.id as number));
                    const displayCoordinators = area.id === 'global' ? team.filter(m => m.eventRole === 'ORGANIZER') : areaCoordinators;

                    const groupedShifts = shiftsInArea.reduce((acc, shift) => {
                        const dateKey = formatDateWithDay(shift.startTime);
                        if (!acc[dateKey]) acc[dateKey] = [];
                        acc[dateKey].push(shift);
                        return acc;
                    }, {} as Record<string, Shift[]>);

                    return (
                        <Box key={area.id} mb={6}>
                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} sx={{ borderBottom: '2px solid #e2e8f0', pb: 1, flexWrap: 'wrap', gap: 2 }}>
                                <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
                                    <Typography variant="h5" fontWeight="900" color="secondary.main">{area.name}</Typography>

                                    {!hasAccess && <Chip icon={<LockIcon fontSize="small"/>} label="Csak megtekintés" size="small" />}

                                    {displayCoordinators.length > 0 && (
                                        <Box display="flex" gap={0.5} flexWrap="wrap">
                                            {displayCoordinators.map(c => (
                                                <Chip key={c.userId} icon={<SupervisorAccountIcon />} label={c.userName} size="small" variant="outlined" color="info" />
                                            ))}
                                        </Box>
                                    )}
                                </Box>

                                {hasAccess && (
                                    <Button size="small" variant="contained" color="secondary" startIcon={<AddIcon />} onClick={() => handleOpenCreateModal(area.id)} disabled={actionLoading} sx={{ borderRadius: 2 }}>
                                        Új esemény ide
                                    </Button>
                                )}
                            </Box>

                            {Object.keys(groupedShifts).length === 0 ? (
                                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', mb: 3, ml: 1 }}>
                                    Még nincs idősáv létrehozva ezen a területen.
                                </Typography>
                            ) : (
                                Object.entries(groupedShifts).map(([dateLabel, dayShifts]) => (
                                    <Box key={dateLabel} sx={{ mb: 4, ml: 1, pl: 2, borderLeft: '3px solid #cbd5e1' }}>
                                        <Typography variant="subtitle1" fontWeight="bold" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                            <CalendarTodayIcon fontSize="small" /> {dateLabel}
                                        </Typography>

                                        <Box display="flex" flexWrap="wrap" gap={2}>
                                            {dayShifts.map((shift) => {
                                                const normalCount = shift.assignedUsers?.filter(u => !u.isBackup).length || 0;
                                                const backupCount = shift.assignedUsers?.filter(u => u.isBackup).length || 0;
                                                const isFull = shift.type === 'WORK' ? normalCount >= shift.maxVolunteers : false;
                                                const isExpanded = expandedShifts.includes(shift.id);

                                                let borderColor = '#ed6c02';
                                                let icon = <AccessTimeIcon />;
                                                let avatarColor = { bg: '#fff3e0', text: '#ed6c02' };

                                                if (shift.type === 'MEETING') {
                                                    borderColor = '#9c27b0'; icon = <RecordVoiceOverIcon />; avatarColor = { bg: '#f3e5f5', text: '#9c27b0' };
                                                } else if (isFull) {
                                                    borderColor = '#2e7d32'; avatarColor = { bg: '#e8f5e9', text: '#2e7d32' };
                                                }

                                                return (
                                                    <Paper key={shift.id} variant="outlined" sx={{ width: { xs: '100%', sm: 'calc(50% - 16px)', lg: 'calc(33.333% - 16px)' }, borderRadius: 3, borderLeft: '6px solid', borderLeftColor: borderColor, overflow: 'hidden' }}>
                                                        <Box onClick={() => toggleShiftExpand(shift.id)} sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', '&:hover': { bgcolor: '#f8fafc' } }}>
                                                            <Box display="flex" alignItems="center" gap={1.5}>
                                                                <Avatar sx={{ bgcolor: avatarColor.bg, color: avatarColor.text }}>{icon}</Avatar>
                                                                <Box>
                                                                    <Typography variant="subtitle1" fontWeight="bold">
                                                                        {shift.name || shift.workAreaName}
                                                                    </Typography>
                                                                    <Typography variant="caption" fontWeight="bold" color="text.secondary">
                                                                        {formatTimeOnly(shift.startTime)} - {formatTimeOnly(shift.endTime)}
                                                                        {shift.type === 'WORK' && ` (${normalCount}/${shift.maxVolunteers} fő${shift.maxBackupVolunteers > 0 ? ` | ${backupCount}/${shift.maxBackupVolunteers} beugró` : ''})`}
                                                                        {shift.type === 'MEETING' && ` (${normalCount} fő)`}
                                                                    </Typography>
                                                                </Box>
                                                            </Box>
                                                            <Box display="flex" alignItems="center" gap={0.5}>
                                                                {hasAccess && (
                                                                    <>
                                                                        <IconButton size="small" color="primary" onClick={(e) => { e.stopPropagation(); handleOpenEditModal(shift); }}><EditIcon fontSize="small" /></IconButton>
                                                                        <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); handleDeleteShift(shift); }}><DeleteIcon fontSize="small" /></IconButton>
                                                                    </>
                                                                )}
                                                                <IconButton size="small">{isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}</IconButton>
                                                            </Box>
                                                        </Box>

                                                        <Collapse in={isExpanded}>
                                                            <Divider />
                                                            <Box sx={{ p: 2, bgcolor: '#f1f5f9' }}>
                                                                {shift.assignedUsers?.map(user => (
                                                                    <Paper
                                                                        key={user.applicationId} elevation={0}
                                                                        sx={{ p: 1, mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid', borderColor: getStatusColor(shift.type, user.status) + '80', borderRadius: 2, cursor: 'pointer', '&:hover': { bgcolor: '#e2e8f0' } }}
                                                                        onClick={() => openVolunteerDetails(user, shift)}
                                                                    >
                                                                        <Box display="flex" alignItems="center" gap={1}>
                                                                            {getStatusDot(shift.type, user.status)}
                                                                            <Typography variant="body2" fontWeight="500">{user.name}</Typography>
                                                                            {user.isBackup && <Chip label="Beugró" size="small" color="secondary" sx={{ height: 20, fontSize: '0.65rem' }} />}
                                                                            {user.message && <EmailIcon sx={{ fontSize: 16, color: '#f59e0b' }} />}
                                                                        </Box>
                                                                        {hasAccess && (
                                                                            <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); handleRemoveUser(shift.id, user.applicationId, user.name); }}><DeleteOutlineIcon fontSize="small" /></IconButton>
                                                                        )}
                                                                    </Paper>
                                                                ))}

                                                                {hasAccess && (
                                                                    <Button fullWidth variant="outlined" startIcon={<GroupAddIcon />} onClick={() => {
                                                                        setSelectedShiftForAssign(shift);
                                                                        setSelectedApplicantIds([]);
                                                                        setSelectedBackupIds([]);
                                                                        setAssignMode('NORMAL');
                                                                        setAssignModalOpen(true);
                                                                    }} sx={{ mt: 1, borderRadius: 2, bgcolor: 'white' }}>
                                                                        {shift.type === 'MEETING' ? 'Meghívás Gyűlésre' : 'Önkéntes hozzáadása'}
                                                                    </Button>
                                                                )}
                                                            </Box>
                                                        </Collapse>
                                                    </Paper>
                                                )
                                            })}
                                        </Box>
                                    </Box>
                                ))
                            )}
                        </Box>
                    );
                })
            )}

            {/* --- TÁBLÁZAT NÉZET --- */}
            {viewMode === 'table' && (
                <Box mb={5}>
                    <Box display="flex" justifyContent="flex-end" mb={2}>
                        <Button variant="contained" color="secondary" startIcon={<AddIcon />} onClick={() => handleOpenCreateModal()} disabled={actionLoading} sx={{ borderRadius: 2 }}>
                            Új esemény létrehozása
                        </Button>
                    </Box>

                    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
                        <Table>
                            <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                                <TableRow>
                                    <TableCell><b>Típus</b></TableCell>
                                    <TableCell><b>Munkaterület</b></TableCell>
                                    <TableCell><b>Nap</b></TableCell>
                                    <TableCell><b>Idősáv</b></TableCell>
                                    <TableCell><b>Kapacitás</b></TableCell>
                                    <TableCell><b>Érintettek</b></TableCell>
                                    <TableCell align="right"><b>Műveletek</b></TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredShifts.filter(s => s.type !== 'PERSONAL' || searchQuery !== '').length === 0 ? (
                                    <TableRow><TableCell colSpan={7} align="center" sx={{ py: 3, color: 'text.secondary' }}>Nincs a szűrésnek megfelelő idősáv.</TableCell></TableRow>
                                ) : (
                                    filteredShifts.filter(s => s.type !== 'PERSONAL' || searchQuery !== '').map((shift) => {
                                        const hasAccess = canManageShift(shift);
                                        const normalCount = shift.assignedUsers?.filter(u => !u.isBackup).length || 0;
                                        const backupCount = shift.assignedUsers?.filter(u => u.isBackup).length || 0;

                                        return (
                                            <TableRow key={shift.id} hover>
                                                <TableCell>
                                                    {shift.type === 'MEETING' && <Chip size="small" icon={<RecordVoiceOverIcon />} label="Gyűlés" sx={{ bgcolor: '#f3e5f5', color: '#9c27b0' }} />}
                                                    {shift.type === 'PERSONAL' && <Chip size="small" icon={<BlockIcon />} label="Személyes" sx={{ bgcolor: '#f1f5f9', color: '#64748b' }} />}
                                                    {shift.type === 'WORK' && <Chip size="small" label="Műszak" color="primary" variant="outlined" />}
                                                    {!hasAccess && <LockIcon fontSize="small" color="disabled" sx={{ ml: 1, verticalAlign: 'middle' }} />}
                                                </TableCell>
                                                <TableCell>{shift.workAreaName || 'Globális'}</TableCell>
                                                <TableCell>{formatDateWithDay(shift.startTime)}</TableCell>
                                                <TableCell>
                                                    {shift.name ? <strong>{shift.name} </strong> : ''}
                                                    ({formatTimeOnly(shift.startTime)} - {formatTimeOnly(shift.endTime)})
                                                </TableCell>
                                                <TableCell>
                                                    {shift.type === 'PERSONAL' ? '-' : `${normalCount} / ${shift.type === 'MEETING' ? '∞' : shift.maxVolunteers}`}
                                                    {shift.type === 'WORK' && shift.maxBackupVolunteers > 0 && (
                                                        <Typography variant="caption" display="block" color="text.secondary">+{backupCount}/{shift.maxBackupVolunteers} beugró</Typography>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {shift.type === 'PERSONAL' ? (
                                                        <Typography variant="body2" color="text.secondary">"{shift.description}" ({shift.assignedUsers[0]?.name})</Typography>
                                                    ) : (
                                                        <Box display="flex" flexWrap="wrap" gap={0.5}>
                                                            {shift.assignedUsers.slice(0, 3).map(u => (
                                                                <Chip key={u.applicationId} label={u.name} size="small" variant={u.isBackup ? "filled" : "outlined"} color={u.isBackup ? "secondary" : "default"} onClick={() => openVolunteerDetails(u, shift)} />
                                                            ))}
                                                            {shift.assignedUsers.length > 3 && (
                                                                <Chip label={`+${shift.assignedUsers.length - 3} fő`} size="small" color="primary" sx={{ cursor: 'pointer' }} onClick={() => { setSelectedShiftForUsersList(shift); setUsersListModalOpen(true); }}/>
                                                            )}
                                                        </Box>
                                                    )}
                                                </TableCell>
                                                <TableCell align="right">
                                                    {hasAccess ? (
                                                        <Box display="flex" justifyContent="flex-end" gap={0.5}>
                                                            {shift.type !== 'PERSONAL' && <Button size="small" variant="contained" disabled={actionLoading} onClick={() => { setSelectedShiftForAssign(shift); setSelectedApplicantIds([]); setSelectedBackupIds([]); setAssignMode('NORMAL'); setAssignModalOpen(true); }}>Beoszt</Button>}
                                                            {shift.type !== 'PERSONAL' && <IconButton size="small" color="primary" onClick={() => handleOpenEditModal(shift)}><EditIcon fontSize="small" /></IconButton>}
                                                            <IconButton size="small" color="error" onClick={() => handleDeleteShift(shift)}><DeleteIcon fontSize="small" /></IconButton>
                                                        </Box>
                                                    ) : (
                                                        <Typography variant="caption" color="text.disabled">Nincs jogod</Typography>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>
            )}

            {/* --- NAPTÁR NÉZET --- */}
            {viewMode === 'calendar' && (
                <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={2} height={{ xs: 'auto', md: 'calc(100vh - 280px)' }} minHeight="600px" mb={4}>
                    {isMobile && (
                        <FormControl fullWidth size="small" sx={{ bgcolor: 'white', borderRadius: 1 }}>
                            <InputLabel>Kinek a naptára?</InputLabel>
                            <Select value={selectedVolunteerForCalendar === null ? 'all' : selectedVolunteerForCalendar} label="Kinek a naptára?" onChange={(e) => setSelectedVolunteerForCalendar(e.target.value === 'all' ? null : e.target.value)}>
                                <MenuItem value="all" sx={{ fontWeight: 'bold', color: 'secondary.main' }}>
                                    <LayersIcon fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} /> Összesített Naptár
                                </MenuItem>
                                {uniqueVolunteers.map(user => (
                                    <MenuItem key={user.email} value={user.email}>
                                        <PersonIcon fontSize="small" sx={{ mr: 1, color: 'primary.main', verticalAlign: 'middle' }} /> {user.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}

                    {!isMobile && (
                        <Paper variant="outlined" sx={{ width: 300, display: 'flex', flexDirection: 'column', borderRadius: 3, overflow: 'hidden' }}>
                            <Box p={2} bgcolor="#f1f5f9" borderBottom="1px solid #e2e8f0">
                                <Typography variant="subtitle1" fontWeight="bold" color="primary.main">Kinek a Naptára?</Typography>
                            </Box>
                            <List sx={{ flexGrow: 1, overflowY: 'auto', p: 0 }}>
                                <ListItem disablePadding divider>
                                    <ListItemButton selected={selectedVolunteerForCalendar === null} onClick={() => setSelectedVolunteerForCalendar(null)} sx={{ '&.Mui-selected': { bgcolor: 'secondary.light', color: 'white', '&:hover': { bgcolor: 'secondary.main' } } }}>
                                        <ListItemAvatar><Avatar sx={{ width: 32, height: 32, bgcolor: selectedVolunteerForCalendar === null ? 'white' : 'secondary.main', color: selectedVolunteerForCalendar === null ? 'secondary.main' : 'white' }}><LayersIcon fontSize="small" /></Avatar></ListItemAvatar>
                                        <ListItemText primary={<Typography variant="body2" fontWeight="bold">Összesített Nézet</Typography>} />
                                    </ListItemButton>
                                </ListItem>

                                {uniqueVolunteers.map(user => {
                                    const isSelected = selectedVolunteerForCalendar === user.email;
                                    return (
                                        <ListItem key={user.email} disablePadding divider>
                                            <ListItemButton selected={isSelected} onClick={() => setSelectedVolunteerForCalendar(user.email)} sx={{ '&.Mui-selected': { bgcolor: 'primary.light', color: 'white', '&:hover': { bgcolor: 'primary.main' } } }}>
                                                <ListItemAvatar><Avatar sx={{ width: 32, height: 32, bgcolor: isSelected ? 'white' : 'primary.main', color: isSelected ? 'primary.main' : 'white' }}><PersonIcon fontSize="small" /></Avatar></ListItemAvatar>
                                                <ListItemText primary={<Typography variant="body2" fontWeight="bold">{user.name}</Typography>} />
                                            </ListItemButton>
                                        </ListItem>
                                    );
                                })}
                            </List>
                        </Paper>
                    )}

                    <Paper elevation={3} sx={{ flexGrow: 1, p: 2, borderRadius: 3, display: 'flex', flexDirection: 'column' }}>
                        {isMobile ? (
                            <Box display="flex" flexDirection="column" height="100%">
                                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                                    <IconButton onClick={() => setCalendarDate(subMonths(calendarDate, 1))}><ChevronLeftIcon /></IconButton>
                                    <Typography fontWeight="bold" textTransform="capitalize" variant="h6">{format(calendarDate, 'yyyy. MMMM', { locale: hu })}</Typography>
                                    <IconButton onClick={() => setCalendarDate(addMonths(calendarDate, 1))}><ChevronRightIcon /></IconButton>
                                </Box>
                                <Box display="grid" gridTemplateColumns="repeat(7, 1fr)" mb={1}>
                                    {['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'].map(day => <Typography key={day} align="center" variant="caption" color="text.secondary" fontWeight="bold">{day}</Typography>)}
                                </Box>
                                <Box display="grid" gridTemplateColumns="repeat(7, 1fr)" gap={0.5} mb={2}>
                                    {mobileCalendarDays.map(day => {
                                        const isSelected = isSameDay(day, calendarDate);
                                        const isCurrentMonth = isSameMonth(day, calendarDate);
                                        const isToday = isSameDay(day, new Date());
                                        const dayKey = format(day, 'yyyy-MM-dd');
                                        const dayShifts = shiftsByDay.get(dayKey) || [];

                                        return (
                                            <Box key={day.toISOString()} onClick={() => setCalendarDate(day)} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 1, cursor: 'pointer', borderRadius: 3, bgcolor: isSelected ? 'primary.main' : isToday ? '#e2e8f0' : 'transparent', color: isSelected ? 'white' : isCurrentMonth ? 'text.primary' : 'text.disabled' }}>
                                                <Typography variant="body2" fontWeight={isSelected || isToday ? 'bold' : 'normal'}>{format(day, 'd')}</Typography>
                                                <Box display="flex" gap={0.5} mt={0.5} height={6}>
                                                    {dayShifts.slice(0, 3).map((s, i) => {
                                                        let dotColor = '#ed6c02';
                                                        if (s.type === 'PERSONAL') dotColor = '#64748b';
                                                        else if (s.type === 'MEETING') dotColor = '#9c27b0';
                                                        else if (selectedVolunteerForCalendar) {
                                                            const uData = s.assignedUsers.find(u => u.email === selectedVolunteerForCalendar);
                                                            if (uData?.status === 'CONFIRMED') dotColor = '#2e7d32';
                                                            if (uData?.status === 'MODIFICATION_REQUESTED') dotColor = '#d32f2f';
                                                        } else {
                                                            const normalCount = s.assignedUsers?.filter(u => !u.isBackup).length || 0;
                                                            dotColor = normalCount >= s.maxVolunteers ? '#2e7d32' : '#ed6c02';
                                                        }
                                                        if (isSelected && dotColor === '#2e7d32') dotColor = '#a5d6a7';
                                                        return <Box key={i} sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: dotColor }} />
                                                    })}
                                                </Box>
                                            </Box>
                                        );
                                    })}
                                </Box>
                                <Divider sx={{ mb: 2 }} />
                                <Box sx={{ overflowY: 'auto', flexGrow: 1, pr: 1, maxHeight: '300px' }}>
                                    {(() => {
                                        const selectedDayKey = format(calendarDate, 'yyyy-MM-dd');
                                        const currentDayShifts = shiftsByDay.get(selectedDayKey) || [];
                                        if (currentDayShifts.length === 0) return <Typography color="text.secondary" align="center" fontStyle="italic" mt={2}>Nincs esemény ezen a napon.</Typography>;

                                        return currentDayShifts.map(shift => {
                                            let barColor = '#ed6c02';
                                            if (shift.type === 'PERSONAL') barColor = '#64748b';
                                            else if (shift.type === 'MEETING') barColor = '#9c27b0';
                                            else if (selectedVolunteerForCalendar) {
                                                const uData = shift.assignedUsers.find(u => u.email === selectedVolunteerForCalendar);
                                                if (uData?.status === 'CONFIRMED') barColor = '#2e7d32';
                                                if (uData?.status === 'MODIFICATION_REQUESTED') barColor = '#d32f2f';
                                            } else {
                                                const normalCount = shift.assignedUsers?.filter(u => !u.isBackup).length || 0;
                                                barColor = normalCount >= shift.maxVolunteers ? '#2e7d32' : '#ed6c02';
                                            }

                                            const normalCount = shift.assignedUsers?.filter(u => !u.isBackup).length || 0;

                                            return (
                                                <Paper key={shift.id} variant="outlined" sx={{ p: 2, mb: 2, cursor: 'pointer', borderLeft: '6px solid', borderLeftColor: barColor }}
                                                       onClick={() => {
                                                           if (shift.type === 'PERSONAL') confirmDeletePersonal(shift);
                                                           else if (selectedVolunteerForCalendar) openVolunteerDetails(shift.assignedUsers.find(u => u.email === selectedVolunteerForCalendar)!, shift);
                                                           else { setSelectedShiftForUsersList(shift); setUsersListModalOpen(true); }
                                                       }}
                                                >
                                                    <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                                                        <Box>
                                                            <Typography variant="h6" color="primary" fontWeight="bold">{shift.type === 'PERSONAL' ? shift.assignedUsers[0]?.name : (shift.workAreaName || 'Globális')}</Typography>
                                                            <Typography variant="subtitle2" color="text.secondary">{shift.type === 'PERSONAL' ? shift.description : (shift.name || (!selectedVolunteerForCalendar && `${normalCount}/${shift.maxVolunteers} fő`))}</Typography>
                                                        </Box>
                                                        {!canManageShift(shift) && <LockIcon fontSize="small" color="disabled" />}
                                                    </Box>
                                                    <Typography variant="body1" sx={{ mt: 1 }}>{new Date(shift.startTime).toLocaleTimeString('hu-HU')} - {new Date(shift.endTime).toLocaleTimeString('hu-HU')}</Typography>
                                                </Paper>
                                            );
                                        });
                                    })()}
                                </Box>
                                <Button fullWidth variant="contained" color="secondary" startIcon={<AddIcon />} sx={{ mt: 2 }} onClick={() => handleOpenCreateModalFromMobile(calendarDate)}>
                                    Új esemény ide: {format(calendarDate, 'MMM d.', { locale: hu })}
                                </Button>
                            </Box>
                        ) : (
                            <Box sx={{ flexGrow: 1, overflowX: 'auto', display: 'flex', flexDirection: 'column' }}>
                                <Typography variant="caption" color="text.secondary" display="flex" alignItems="center" gap={0.5} mb={1}>
                                    <InfoOutlinedIcon fontSize="small" /> {selectedVolunteerForCalendar ? "Tipp: Húzz egy sávot egy üres területre az önkéntes automatikus beosztásához!" : "Tipp: Húzz egy sávot új (üres) műszak létrehozásához!"}
                                </Typography>
                                <Box sx={{ flexGrow: 1, minHeight: 0 }}>
                                    <Calendar
                                        localizer={localizer} events={desktopCalendarEvents} startAccessor="start" endAccessor="end" culture="hu"
                                        date={calendarDate} onNavigate={(date) => setCalendarDate(date)} view={calendarView} onView={(view) => setCalendarView(view)}
                                        components={{ toolbar: CustomToolbar }} eventPropGetter={eventStyleGetter} selectable={true} onSelectSlot={handleSelectSlot}
                                        onSelectEvent={(event) => {
                                            if (event.resource.shift.type === 'PERSONAL') confirmDeletePersonal(event.resource.shift);
                                            else if (selectedVolunteerForCalendar) openVolunteerDetails(event.resource.assignedData!, event.resource.shift);
                                            else { setSelectedShiftForUsersList(event.resource.shift); setUsersListModalOpen(true); }
                                        }}
                                        messages={{ noEventsInRange: "Nincs esemény.", showMore: (total) => `+${total} további` }}
                                        style={{ height: '100%', fontFamily: 'inherit', minWidth: 600 }}
                                    />
                                </Box>
                            </Box>
                        )}
                    </Paper>
                </Box>
            )}

            <Dialog open={createModalOpen} onClose={() => setCreateModalOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
                <DialogTitle sx={{ fontWeight: 'bold' }}>{editMode ? 'Esemény módosítása' : 'Új esemény létrehozása'}</DialogTitle>
                <DialogContent dividers sx={{ p: 3 }}>
                    <FormControl component="fieldset" sx={{ mb: 2, width: '100%', border: '1px solid #e2e8f0', borderRadius: 2, p: 1 }}>
                        <RadioGroup row value={newShiftData.type} onChange={(e) => setNewShiftData({...newShiftData, type: e.target.value as 'WORK'|'MEETING'})}>
                            <FormControlLabel value="WORK" control={<Radio color="primary"/>} label="Műszak" />
                            <FormControlLabel value="MEETING" control={<Radio color="secondary"/>} label={<span style={{color: '#9c27b0', fontWeight: 'bold'}}>Gyűlés / Eligazítás</span>} />
                        </RadioGroup>
                    </FormControl>

                    <FormControl fullWidth margin="normal">
                        <InputLabel>Munkaterület *</InputLabel>
                        <Select value={targetWorkAreaId || 'global'} label="Munkaterület *" onChange={(e) => setTargetWorkAreaId(e.target.value === 'global' ? 'global' : Number(e.target.value))} disabled={actionLoading || editMode}>
                            {newShiftData.type === 'MEETING' && <MenuItem value="global" sx={{ fontWeight: 'bold', color: 'secondary.main' }}>🌐 Globális (Mindenkinek)</MenuItem>}
                            {workAreas.filter(wa => canManageArea(wa.id)).map(wa => <MenuItem key={wa.id} value={wa.id}>{wa.name}</MenuItem>)}
                        </Select>
                    </FormControl>

                    {autoAssignApplicationId && !editMode && (
                        <Alert severity="info" sx={{ mb: 2 }}>Mentés után a kiválasztott önkéntes automatikusan be lesz osztva erre az eseményre!</Alert>
                    )}

                    <TextField margin="normal" label="Megnevezés (pl. Délelőtt, VIP Bejárás)" fullWidth value={newShiftData.name} onChange={(e) => setNewShiftData({...newShiftData, name: e.target.value})} disabled={actionLoading} />
                    <TextField margin="normal" type="datetime-local" label="Kezdés *" fullWidth InputLabelProps={{ shrink: true }} value={newShiftData.startTime} onChange={(e) => setNewShiftData({...newShiftData, startTime: e.target.value})} disabled={actionLoading} />
                    <TextField margin="normal" type="datetime-local" label="Vége *" fullWidth InputLabelProps={{ shrink: true }} value={newShiftData.endTime} onChange={(e) => setNewShiftData({...newShiftData, endTime: e.target.value})} disabled={actionLoading} />

                    {newShiftData.type === 'WORK' && (
                        <Box display="flex" gap={2} mt={1}>
                            <TextField margin="normal" type="number" label="Létszám (Max fő)" fullWidth value={newShiftData.maxVolunteers} onChange={(e) => setNewShiftData({...newShiftData, maxVolunteers: parseInt(e.target.value) || 0})} disabled={actionLoading} />
                            <TextField margin="normal" type="number" label="Beugrók (Max fő)" fullWidth value={newShiftData.maxBackupVolunteers} onChange={(e) => setNewShiftData({...newShiftData, maxBackupVolunteers: parseInt(e.target.value) || 0})} disabled={actionLoading} />
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setCreateModalOpen(false)} color="inherit" disabled={actionLoading}>Mégse</Button>
                    <Button onClick={handleSaveShift} variant="contained" disabled={actionLoading || !newShiftData.startTime || !newShiftData.endTime || !targetWorkAreaId}>Mentés</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={deletePersonalModalOpen} onClose={() => setDeletePersonalModalOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
                <DialogTitle sx={{ bgcolor: 'error.main', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <BlockIcon /> Személyes Esemény Törlése
                </DialogTitle>
                <DialogContent sx={{ mt: 3 }}>
                    <Alert severity="warning" sx={{ mb: 2 }}>Ez az esemény <b>{shiftToDelete?.assignedUsers[0]?.name}</b> személyes naptárbejegyzése: <br/><i>"{shiftToDelete?.description}"</i></Alert>
                    <Typography variant="body2" mb={1}>Kérlek, indokold meg a törlést (ezt az üzenetet az önkéntes látni fogja):</Typography>
                    <TextField fullWidth multiline rows={3} placeholder="Pl.: Bocsánat, de ebben az időszakban elengedhetetlen a jelenléted..." value={personalDeleteMessage} onChange={(e) => setPersonalDeleteMessage(e.target.value)} disabled={actionLoading} />
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setDeletePersonalModalOpen(false)} color="inherit" disabled={actionLoading}>Mégse</Button>
                    <Button variant="contained" color="error" onClick={executeDeleteShift} disabled={actionLoading || !personalDeleteMessage.trim()}>Törlés</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={assignModalOpen} onClose={() => setAssignModalOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
                <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Önkéntesek beosztása</span>
                    {selectedShiftForAssign?.type === 'MEETING' && (
                        <Button size="small" variant="outlined" sx={{ color: 'white', borderColor: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }} onClick={() => setSelectedApplicantIds(assignableApplicants.map(a => a.applicationId))}>
                            Mindenkit kijelöl
                        </Button>
                    )}
                </DialogTitle>
                <DialogContent sx={{ mt: 2 }}>
                    {selectedShiftForAssign?.type === 'WORK' && (
                        <ToggleButtonGroup
                            value={assignMode}
                            exclusive
                            onChange={(_, val) => val && setAssignMode(val)}
                            fullWidth
                            sx={{ mb: 3 }}
                            size="small"
                        >
                            <ToggleButton value="NORMAL" color="primary" sx={{ fontWeight: 'bold' }}>Normál Beosztás</ToggleButton>
                            <ToggleButton value="BACKUP" color="secondary" sx={{ fontWeight: 'bold' }}>Beugró / Készenléti</ToggleButton>
                        </ToggleButtonGroup>
                    )}

                    {assignableApplicants.map(app => {
                        const isNormal = selectedApplicantIds.includes(app.applicationId);
                        const isBackup = selectedBackupIds.includes(app.applicationId);

                        return (
                            <Paper key={app.applicationId} elevation={0} sx={{ p: 1.5, mb: 1, display: 'flex', alignItems: 'center', gap: 2, border: '1px solid', borderColor: isNormal ? 'primary.main' : isBackup ? 'secondary.main' : '#e2e8f0', borderRadius: 2, cursor: 'pointer', bgcolor: isNormal ? '#f0f7ff' : isBackup ? '#fdf4ff' : 'white' }}
                                   onClick={() => {
                                       if (actionLoading) return;
                                       if (assignMode === 'NORMAL') {
                                           if (isBackup) setSelectedBackupIds(prev => prev.filter(id => id !== app.applicationId));
                                           setSelectedApplicantIds(prev => prev.includes(app.applicationId) ? prev.filter(i => i !== app.applicationId) : [...prev, app.applicationId]);
                                       } else {
                                           if (isNormal) setSelectedApplicantIds(prev => prev.filter(id => id !== app.applicationId));
                                           setSelectedBackupIds(prev => prev.includes(app.applicationId) ? prev.filter(i => i !== app.applicationId) : [...prev, app.applicationId]);
                                       }
                                   }}>
                                <Checkbox checked={isNormal || isBackup} color={isBackup ? "secondary" : "primary"} disabled={actionLoading} />
                                <Typography fontWeight="500">{app.userName}</Typography>
                                {isNormal && <Chip label="Normálnak jelölve" size="small" color="primary" sx={{ ml: 'auto' }}/>}
                                {isBackup && <Chip label="Beugrónak jelölve" size="small" color="secondary" sx={{ ml: 'auto' }}/>}
                            </Paper>
                        );
                    })}
                    {assignableApplicants.length === 0 && <Alert severity="info">Nincs beosztható önkéntes ezen a területen (vagy már mindenkit beosztottál).</Alert>}
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setAssignModalOpen(false)} color="inherit">Mégse</Button>
                    <Button onClick={handleAssignUsers} variant="contained" disabled={actionLoading || (selectedApplicantIds.length === 0 && selectedBackupIds.length === 0)}>Beosztás ({selectedApplicantIds.length + selectedBackupIds.length} fő)</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={usersListModalOpen} onClose={() => setUsersListModalOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
                <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 'bold' }}>Érintett Önkéntesek</DialogTitle>
                <DialogContent dividers sx={{ p: 2, bgcolor: '#f8fafc' }}>
                    {selectedShiftForUsersList?.assignedUsers.map(user => (
                        <Paper key={user.applicationId} elevation={0} sx={{ p: 1.5, mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: 2, cursor: 'pointer' }} onClick={() => { setUsersListModalOpen(false); openVolunteerDetails(user, selectedShiftForUsersList, true); }}>
                            <Box display="flex" alignItems="center" gap={1}>
                                {getStatusDot(selectedShiftForUsersList.type, user.status)}
                                <Typography fontWeight="500">{user.name}</Typography>
                                {user.isBackup && <Chip label="Beugró" size="small" color="secondary" sx={{ height: 20, fontSize: '0.65rem' }} />}
                            </Box>
                        </Paper>
                    ))}
                </DialogContent>
                <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
                    {selectedShiftForUsersList && canManageShift(selectedShiftForUsersList) ? (
                        <Button onClick={() => { setUsersListModalOpen(false); setSelectedShiftForAssign(selectedShiftForUsersList); setSelectedApplicantIds([]); setSelectedBackupIds([]); setAssignMode('NORMAL'); setAssignModalOpen(true); }} color="primary" variant="outlined" startIcon={<GroupAddIcon />}>Új beosztás</Button>
                    ) : (
                        <div />
                    )}
                    <Button onClick={() => setUsersListModalOpen(false)} variant="contained" color="inherit">Bezárás</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={volunteerDetailsModalOpen} onClose={() => setVolunteerDetailsModalOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
                <DialogTitle sx={{ bgcolor: selectedVolunteerDetails?.user.status === 'MODIFICATION_REQUESTED' ? 'error.main' : 'primary.main', color: 'white', fontWeight: 'bold' }}>
                    {selectedVolunteerDetails?.user.name} beosztása {selectedVolunteerDetails?.user.isBackup ? '(Beugró)' : ''}
                </DialogTitle>
                <DialogContent sx={{ mt: 3 }}>
                    {selectedVolunteerDetails && (
                        <Box>
                            <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: '#f8fafc' }}>
                                <Typography variant="h6" color="primary.dark" fontWeight="bold">{selectedVolunteerDetails.shift.workAreaName || 'Globális'} {selectedVolunteerDetails.shift.name ? `(${selectedVolunteerDetails.shift.name})` : ''}</Typography>
                                <Typography variant="body1" sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}><CalendarTodayIcon fontSize="small" /> {formatDateWithDay(selectedVolunteerDetails.shift.startTime)}</Typography>
                                <Typography variant="body1" sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}><AccessTimeIcon fontSize="small" /> {formatTimeOnly(selectedVolunteerDetails.shift.startTime)} - {formatTimeOnly(selectedVolunteerDetails.shift.endTime)}</Typography>
                            </Paper>
                            {selectedVolunteerDetails.user.message && (
                                <Paper variant="outlined" sx={{ p: 2, bgcolor: '#fffde7', borderColor: '#ffe082', borderRadius: 2 }}>
                                    <Typography variant="body1" sx={{ fontStyle: 'italic', display: 'flex', alignItems: 'flex-start', gap: 1 }}><EmailIcon color="warning" sx={{ mt: 0.2 }} /> "{selectedVolunteerDetails.user.message}"</Typography>
                                </Paper>
                            )}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 2, px: 3, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0', justifyContent: 'space-between' }}>
                    <Box display="flex" gap={1}>
                        {openedFromList ? <Button onClick={() => { setVolunteerDetailsModalOpen(false); setUsersListModalOpen(true); }} color="inherit" startIcon={<ArrowBackIcon />}>Vissza</Button> : <Button onClick={() => setVolunteerDetailsModalOpen(false)} color="inherit">Bezárás</Button>}
                    </Box>
                    {selectedVolunteerDetails && canManageShift(selectedVolunteerDetails.shift) && (
                        <Button variant="outlined" color="error" startIcon={<DeleteOutlineIcon />} onClick={() => handleRemoveUser(selectedVolunteerDetails!.shift.id, selectedVolunteerDetails!.user.applicationId, selectedVolunteerDetails!.user.name)}>Törlés</Button>
                    )}
                </DialogActions>
            </Dialog>

            <Dialog open={errorModalOpen} onClose={() => setErrorModalOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
                <DialogTitle sx={{ bgcolor: 'error.main', color: 'white', display: 'flex', alignItems: 'center', gap: 1, fontWeight: 'bold' }}><WarningAmberIcon /> Figyelmeztetés</DialogTitle>
                <DialogContent sx={{ mt: 3, mb: 1 }}><Typography variant="body1" sx={{ fontSize: '1.1rem', whiteSpace: 'pre-wrap' }}>{errorMessage}</Typography></DialogContent>
                <DialogActions sx={{ p: 2, bgcolor: '#f8fafc' }}><Button onClick={() => setErrorModalOpen(false)} variant="contained" color="error" sx={{ fontWeight: 'bold', px: 3 }}>Megértettem</Button></DialogActions>
            </Dialog>
        </Container>
    );
}