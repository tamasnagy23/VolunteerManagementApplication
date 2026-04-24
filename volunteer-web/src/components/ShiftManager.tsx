import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
    Container, Typography, Box, Paper, Button, CircularProgress,
    Alert, Avatar, IconButton, Collapse, Dialog, DialogTitle,
    DialogContent, DialogActions, Checkbox, Divider, TextField,
    MenuItem, Select, InputLabel, FormControl, ToggleButton, ToggleButtonGroup,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Chip, List, ListItem, ListItemButton, ListItemText, ListItemAvatar,
    useTheme, useMediaQuery, RadioGroup, FormControlLabel, Radio, alpha, Fade
} from '@mui/material';
import Grid from '@mui/material/Grid';

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
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LayersIcon from '@mui/icons-material/Layers';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import BlockIcon from '@mui/icons-material/Block';
import LockIcon from '@mui/icons-material/Lock';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';

import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { renderTimeViewClock } from '@mui/x-date-pickers/timeViewRenderers';
import { hu } from 'date-fns/locale';

import api from '../api/axios';
import CustomCalendar, { type CalendarEventData } from '../components/CustomCalendar';

interface AssignedUser {
    applicationId: number;
    userId: number;
    name: string;
    email: string;
    status?: 'PENDING' | 'CONFIRMED' | 'MODIFICATION_REQUESTED';
    message?: string;
    isBackup: boolean;
}

interface Shift {
    id: number;
    workAreaId: number | null;
    workAreaName: string | null;
    name?: string;
    startTime: string;
    endTime: string;
    maxVolunteers: number;
    maxBackupVolunteers: number;
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

const combineDateAndTime = (date: Date | null, time: Date | null): string | null => {
    if (!date || !time) return null;
    const result = new Date(date);
    result.setHours(time.getHours(), time.getMinutes(), 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${result.getFullYear()}-${pad(result.getMonth() + 1)}-${pad(result.getDate())}T${pad(result.getHours())}:${pad(result.getMinutes())}:00`;
};

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

function ArrowBackIcon() {
    return null;
}

export default function ShiftManager() {
    const { id } = useParams<{ id: string }>();
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';
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
    const [calendarView, setCalendarView] = useState<'month' | 'week' | 'day'>('month');

    const [assignModalOpen, setAssignModalOpen] = useState(false);
    const [selectedShiftForAssign, setSelectedShiftForAssign] = useState<Shift | null>(null);
    const [selectedApplicantIds, setSelectedApplicantIds] = useState<number[]>([]);
    const [selectedBackupIds, setSelectedBackupIds] = useState<number[]>([]);
    const [assignMode, setAssignMode] = useState<'NORMAL' | 'BACKUP'>('NORMAL');

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

    const [newShiftData, setNewShiftData] = useState({ name: '', maxVolunteers: 5, maxBackupVolunteers: 0, type: 'WORK', description: '' });

    const [shiftStartDate, setShiftStartDate] = useState<Date | null>(null);
    const [shiftStartTime, setShiftStartTime] = useState<Date | null>(null);
    const [shiftEndDate, setShiftEndDate] = useState<Date | null>(null);
    const [shiftEndTime, setShiftEndTime] = useState<Date | null>(null);

    const [openShiftStartDate, setOpenShiftStartDate] = useState(false);
    const [openShiftStartTime, setOpenShiftStartTime] = useState(false);
    const [openShiftEndDate, setOpenShiftEndDate] = useState(false);
    const [openShiftEndTime, setOpenShiftEndTime] = useState(false);

    const [autoAssignApplicationId, setAutoAssignApplicationId] = useState<number | null>(null);

    const [deletePersonalModalOpen, setDeletePersonalModalOpen] = useState(false);
    const [personalDeleteMessage, setPersonalDeleteMessage] = useState('');
    const [shiftToDelete, setShiftToDelete] = useState<Shift | null>(null);

    const [deleteShiftConfirmOpen, setDeleteShiftConfirmOpen] = useState(false);
    const [removeUserConfirmOpen, setRemoveUserConfirmOpen] = useState(false);
    const [userToRemove, setUserToRemove] = useState<{ shiftId: number, appId: number, name: string } | null>(null);

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

    // =======================================================================
    // SZIGORÍTOTT JOGOSULTSÁGKEZELÉS (Kiskapu bezárva)
    // =======================================================================

    const canCreateGlobal = useMemo(() => {
        if (!myPermissions) return false;
        // SZIGORÍTÁS: Csak Főszervező és Rendszergazda hozhat létre Globális Gyűlést! (MANAGE_SHIFTS jog nem elég)
        return myPermissions.globalAdmin || myPermissions.eventRole === 'ORGANIZER';
    }, [myPermissions]);

    const canManageArea = (areaId: number | string | null) => {
        if (areaId === 'global' || areaId === null) return canCreateGlobal;
        if (canCreateGlobal) return true; // A Főszervezők mindenhez is hozzáférnek
        if (!myPermissions) return false;

        // Ha van általános műszak-szervező joga, akkor az összes területet kezelheti
        if (myPermissions.permissions.includes('MANAGE_SHIFTS')) return true;

        // Egyébként megvizsgáljuk, hogy Koordinátora-e az adott területnek
        return myPermissions.coordinatedWorkAreas.includes(Number(areaId));
    };

    const hasAnyManagePermission = canCreateGlobal || workAreas.some(wa => canManageArea(wa.id));

    const canManageShift = (shift: Shift) => {
        if (shift.type === 'PERSONAL') return true;
        return canManageArea(shift.workAreaId || 'global');
    };
    // =======================================================================

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

    const customCalendarEvents = useMemo<CalendarEventData[]>(() => {
        return activeShifts.map(shift => {
            let color = theme.palette.primary.main;
            const assignedData = selectedVolunteerForCalendar ? shift.assignedUsers.find(u => u.email === selectedVolunteerForCalendar) : null;

            if (shift.type === 'PERSONAL') color = '#64748b';
            else if (shift.type === 'MEETING') color = theme.palette.secondary.main;
            else if (selectedVolunteerForCalendar && assignedData) {
                if (assignedData.status === 'CONFIRMED') color = theme.palette.success.main;
                else if (assignedData.status === 'MODIFICATION_REQUESTED') color = theme.palette.error.main;
                else color = theme.palette.warning.main;
            } else {
                const normalCount = shift.assignedUsers?.filter(u => !u.isBackup).length || 0;
                const isFull = normalCount >= shift.maxVolunteers;
                color = isFull ? theme.palette.success.main : theme.palette.warning.main;
            }

            const normalCount = shift.assignedUsers?.filter(u => !u.isBackup).length || 0;
            const title = selectedVolunteerForCalendar
                ? (shift.type === 'PERSONAL' ? `[Személyes] ${shift.description}` : `${shift.workAreaName || 'Globális'} ${shift.name ? `(${shift.name})` : ''}`)
                : `${shift.workAreaName || 'Globális'} ${shift.name ? `(${shift.name})` : ''} (${normalCount}/${shift.type === 'MEETING' ? '∞' : shift.maxVolunteers})`;

            return {
                id: shift.id.toString(),
                title: title,
                start: new Date(shift.startTime),
                end: new Date(shift.endTime),
                color: color,
                originalData: { shift, assignedData: assignedData || null }
            };
        });
    }, [activeShifts, selectedVolunteerForCalendar, theme.palette]);

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
        let defaultWaId = waId;

        if (defaultWaId === null) {
            if (canCreateGlobal) {
                defaultWaId = 'global';
            } else {
                const firstManaged = workAreas.find(wa => canManageArea(wa.id));
                defaultWaId = firstManaged ? firstManaged.id : '';
            }
        }

        setTargetWorkAreaId(defaultWaId);
        setAutoAssignApplicationId(null);
        setEditMode(false);
        setNewShiftData({ name: '', maxVolunteers: 5, maxBackupVolunteers: 0, type: 'WORK', description: '' });

        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0);
        const end = new Date(start);
        end.setHours(16, 0);

        setShiftStartDate(start);
        setShiftStartTime(start);
        setShiftEndDate(end);
        setShiftEndTime(end);

        setCreateModalOpen(true);
    };

    const handleSelectSlot = (date: Date) => {
        const start = new Date(date);
        const end = new Date(start);

        if (start.getHours() === 0 && start.getMinutes() === 0) {
            start.setHours(8, 0, 0, 0);
            end.setHours(16, 0, 0, 0);
        } else {
            end.setHours(start.getHours() + 1);
        }

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
            let defaultWaId: number | string | null = null;
            if (canCreateGlobal) {
                defaultWaId = 'global';
            } else {
                const firstManaged = workAreas.find(wa => canManageArea(wa.id));
                defaultWaId = firstManaged ? firstManaged.id : '';
            }
            setTargetWorkAreaId(defaultWaId);
            setAutoAssignApplicationId(null);
        }

        setEditMode(false);
        setNewShiftData({ name: '', maxVolunteers: 5, maxBackupVolunteers: 0, type: 'WORK', description: '' });

        setShiftStartDate(start);
        setShiftStartTime(start);
        setShiftEndDate(end);
        setShiftEndTime(end);

        setCreateModalOpen(true);
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
            maxVolunteers: shift.maxVolunteers,
            maxBackupVolunteers: shift.maxBackupVolunteers || 0,
            type: shift.type,
            description: shift.description || ''
        });

        setShiftStartDate(new Date(shift.startTime));
        setShiftStartTime(new Date(shift.startTime));
        setShiftEndDate(new Date(shift.endTime));
        setShiftEndTime(new Date(shift.endTime));

        setCreateModalOpen(true);
    };

    const getStatusColor = (shiftType: string, status?: string) => {
        if (shiftType === 'PERSONAL') return '#64748b';
        if (shiftType === 'MEETING') return theme.palette.secondary.main;

        if (status === 'CONFIRMED') return theme.palette.success.main;
        if (status === 'MODIFICATION_REQUESTED') return theme.palette.error.main;
        return theme.palette.warning.main;
    };

    const getStatusDot = (shiftType: string, status?: string) => {
        return <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: getStatusColor(shiftType, status), display: 'inline-block' }} />;
    };

    const handleSaveShift = async () => {
        const finalStartISO = combineDateAndTime(shiftStartDate, shiftStartTime);
        const finalEndISO = combineDateAndTime(shiftEndDate, shiftEndTime);

        if (!finalStartISO || !finalEndISO) {
            setErrorMessage("A kezdés és befejezés időpontja kötelező!");
            setErrorModalOpen(true);
            return;
        }

        setActionLoading(true);
        try {
            const payload = { ...newShiftData, startTime: finalStartISO, endTime: finalEndISO };

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

    const handleDeleteShift = (shift: Shift) => {
        setShiftToDelete(shift);
        if (shift.type === 'PERSONAL') {
            setPersonalDeleteMessage('');
            setDeletePersonalModalOpen(true);
        } else {
            setDeleteShiftConfirmOpen(true);
        }
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
            setDeleteShiftConfirmOpen(false);
            setShiftToDelete(null);
            fetchData();
        }
        catch { setErrorMessage("Hiba törléskor."); setErrorModalOpen(true); }
        finally { setActionLoading(false); }
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

    const handleRemoveUser = (shiftId: number, appId: number, name: string) => {
        setUserToRemove({ shiftId, appId, name });
        setRemoveUserConfirmOpen(true);
    };

    const executeRemoveUser = async () => {
        if (!userToRemove) return;
        setActionLoading(true);
        try {
            await api.delete(`/shifts/${userToRemove.shiftId}/remove/${userToRemove.appId}`);
            setRemoveUserConfirmOpen(false);
            setUserToRemove(null);
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

    if (loading) return <Box display="flex" justifyContent="center" mt={10}><CircularProgress size={60} /></Box>;

    return (
        <>
            <Fade in={true} timeout={500}>
                <Container maxWidth="xl" sx={{ mt: { xs: 2, md: 4 }, mb: 10 }}>

                    <Box mb={4} display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap">
                        <Box>
                            <Typography variant="h4" fontWeight="900" color="primary.main">{event?.title}</Typography>
                            <Typography variant="h6" color="text.secondary">Beosztás, Gyűlések és Naptár kezelése</Typography>
                        </Box>
                        <Box display="flex" gap={1} flexWrap="wrap" mt={{ xs: 2, sm: 0 }}>
                            <Chip label="Műszak" sx={{ bgcolor: isDarkMode ? alpha(theme.palette.primary.main, 0.2) : '#e3f2fd', color: 'primary.main', fontWeight: 'bold' }} />
                            <Chip label="Gyűlés" sx={{ bgcolor: isDarkMode ? alpha(theme.palette.secondary.main, 0.2) : '#f3e5f5', color: 'secondary.main', fontWeight: 'bold' }} icon={<RecordVoiceOverIcon />} />
                            <Chip label="Személyes" sx={{ bgcolor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#f1f5f9', color: isDarkMode ? '#cbd5e1' : '#64748b', fontWeight: 'bold' }} icon={<BlockIcon />} />
                            <Chip label="Beugró" sx={{ bgcolor: isDarkMode ? alpha(theme.palette.warning.main, 0.2) : '#fff8e1', color: 'warning.main', fontWeight: 'bold' }} />
                        </Box>
                    </Box>

                    {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

                    <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, mb: 4, bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.4)' : '#f8fafc', border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider', borderRadius: 4 }}>
                        <Box display="flex" flexWrap="wrap" gap={2} alignItems="center">

                            <ToggleButtonGroup
                                value={viewMode} exclusive onChange={(_, newView) => newView && setViewMode(newView)} size="small"
                                sx={{
                                    bgcolor: isDarkMode ? 'rgba(0,0,0,0.4)' : '#f1f5f9',
                                    p: 0.5, borderRadius: 8, display: 'flex',
                                    width: { xs: '100%', md: 'auto' },
                                    '& .MuiToggleButton-root': {
                                        flex: 1, border: 'none', borderRadius: 8, textTransform: 'none', fontWeight: 'bold', color: 'text.secondary', mx: 0.5,
                                        '&.Mui-selected': { bgcolor: isDarkMode ? 'primary.main' : 'white', color: isDarkMode ? 'white' : 'primary.main', boxShadow: isDarkMode ? 'none' : '0 2px 4px rgba(0,0,0,0.1)' },
                                        '&:hover': { bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }
                                    }
                                }}
                            >
                                <ToggleButton value="cards"><ViewModuleIcon sx={{ mr: 1, fontSize: 20 }}/> Kártyák</ToggleButton>
                                <ToggleButton value="table"><ViewListIcon sx={{ mr: 1, fontSize: 20 }}/> Táblázat</ToggleButton>
                                <ToggleButton value="calendar"><CalendarMonthIcon sx={{ mr: 1, fontSize: 20 }}/> Naptár</ToggleButton>
                            </ToggleButtonGroup>

                            <FormControl size="small" sx={{ minWidth: 150, flexGrow: { xs: 1, sm: 0 }, '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'white', borderRadius: 2 } }}>
                                <InputLabel>Munkaterület</InputLabel>
                                <Select value={filterArea} label="Munkaterület" onChange={(e) => setFilterArea(e.target.value)}>
                                    <MenuItem value="all">Minden Terület/Globális</MenuItem>
                                    {workAreas.map(wa => <MenuItem key={wa.id} value={wa.id.toString()}>{wa.name}</MenuItem>)}
                                </Select>
                            </FormControl>

                            <Collapse in={viewMode !== 'calendar'} orientation="horizontal" unmountOnExit>
                                <Box sx={{ width: 150 }}>
                                    <FormControl fullWidth size="small" sx={{ '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'white', borderRadius: 2 } }}>
                                        <InputLabel>Melyik Nap?</InputLabel>
                                        <Select value={filterDate} label="Melyik Nap?" onChange={(e) => setFilterDate(e.target.value)}>
                                            <MenuItem value="all">Minden nap</MenuItem>
                                            {uniqueDates.map(date => <MenuItem key={date} value={date}>{date}</MenuItem>)}
                                        </Select>
                                    </FormControl>
                                </Box>
                            </Collapse>

                            <FormControl size="small" sx={{ minWidth: 150, flexGrow: { xs: 1, sm: 0 }, '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'white', borderRadius: 2 } }}>
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
                                sx={{ minWidth: 150, flexGrow: { xs: 1, md: 0 }, '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'white', borderRadius: 2 } }}
                            />

                            <Button variant="outlined" color="primary" startIcon={<DownloadIcon />} onClick={exportToExcel} sx={{ ml: { xs: 0, lg: 'auto' }, width: { xs: '100%', lg: 'auto' }, bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'white', borderRadius: 2, fontWeight: 'bold' }}>
                                Excel Letöltés
                            </Button>
                        </Box>
                    </Paper>

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
                                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} sx={{ borderBottom: '2px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider', pb: 1.5, flexWrap: 'wrap', gap: 2 }}>
                                        <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
                                            <Typography variant="h5" fontWeight="900" color={isDarkMode ? 'secondary.light' : 'secondary.main'}>{area.name}</Typography>

                                            {!hasAccess && <Chip icon={<LockIcon fontSize="small"/>} label="Csak megtekintés" size="small" sx={{ bgcolor: isDarkMode ? 'rgba(255,255,255,0.1)' : undefined }}/>}

                                            {displayCoordinators.length > 0 && (
                                                <Box display="flex" gap={0.5} flexWrap="wrap">
                                                    {displayCoordinators.map(c => (
                                                        <Chip key={c.userId} icon={<SupervisorAccountIcon />} label={c.userName} size="small" variant="outlined" color="info" />
                                                    ))}
                                                </Box>
                                            )}
                                        </Box>

                                        {hasAccess && (
                                            <Button size="small" variant="contained" color="secondary" startIcon={<AddIcon />} onClick={() => handleOpenCreateModal(area.id)} disabled={actionLoading} sx={{ borderRadius: 2, fontWeight: 'bold' }}>
                                                Új esemény ide
                                            </Button>
                                        )}
                                    </Box>

                                    {Object.keys(groupedShifts).length === 0 ? (
                                        <Paper elevation={0} sx={{ p: 4, mb: 3, textAlign: 'center', borderRadius: 4, bgcolor: isDarkMode ? 'rgba(255,255,255,0.02)' : '#f8fafc', border: '1px dashed', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider' }}>
                                            <Typography variant="h6" color="text.secondary" fontWeight="bold" mb={1}>Üres Munkaterület</Typography>
                                            <Typography variant="body2" color="text.secondary" mb={2}>Még nem hoztál létre beosztást ezen a területen.</Typography>
                                            {/* JAVÍTÁS: Itt zártuk be a kiskaput az üres állapotnál is! */}
                                            {hasAccess && (
                                                <Button variant="outlined" color="primary" startIcon={<AddIcon />} onClick={() => handleOpenCreateModal(area.id)}>
                                                    Első műszak létrehozása
                                                </Button>
                                            )}
                                        </Paper>
                                    ) : (
                                        Object.entries(groupedShifts).map(([dateLabel, dayShifts]) => (
                                            <Box key={dateLabel} sx={{ mb: 4, ml: 1, pl: 2, borderLeft: '3px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#cbd5e1' }}>
                                                <Typography variant="subtitle1" fontWeight="bold" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                                    <CalendarTodayIcon fontSize="small" /> {dateLabel}
                                                </Typography>

                                                <Box display="flex" flexWrap="wrap" gap={2}>
                                                    {dayShifts.map((shift) => {
                                                        const normalCount = shift.assignedUsers?.filter(u => !u.isBackup).length || 0;
                                                        const backupCount = shift.assignedUsers?.filter(u => u.isBackup).length || 0;
                                                        const isFull = shift.type === 'WORK' ? normalCount >= shift.maxVolunteers : false;
                                                        const isExpanded = expandedShifts.includes(shift.id);

                                                        let borderColor = theme.palette.warning.main;
                                                        let icon = <AccessTimeIcon />;
                                                        let avatarColor = { bg: isDarkMode ? alpha(theme.palette.warning.main, 0.2) : '#fff3e0', text: theme.palette.warning.main };

                                                        if (shift.type === 'MEETING') {
                                                            borderColor = theme.palette.secondary.main; icon = <RecordVoiceOverIcon />; avatarColor = { bg: isDarkMode ? alpha(theme.palette.secondary.main, 0.2) : '#f3e5f5', text: theme.palette.secondary.main };
                                                        } else if (isFull) {
                                                            borderColor = theme.palette.success.main; avatarColor = { bg: isDarkMode ? alpha(theme.palette.success.main, 0.2) : '#e8f5e9', text: theme.palette.success.main };
                                                        }

                                                        return (
                                                            <Paper key={shift.id} elevation={0} sx={{ width: { xs: '100%', sm: 'calc(50% - 16px)', lg: 'calc(33.333% - 16px)' }, borderRadius: 3, bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.4)' : 'white', border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'divider', borderLeft: '6px solid', borderLeftColor: borderColor, overflow: 'hidden' }}>
                                                                <Box onClick={() => toggleShiftExpand(shift.id)} sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'background-color 0.2s', '&:hover': { bgcolor: isDarkMode ? 'rgba(255,255,255,0.02)' : '#f8fafc' } }}>
                                                                    <Box display="flex" alignItems="center" gap={1.5}>
                                                                        <Avatar sx={{ bgcolor: avatarColor.bg, color: avatarColor.text }}>{icon}</Avatar>
                                                                        <Box>
                                                                            <Typography variant="subtitle1" fontWeight="bold" color="text.primary">
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
                                                                        <IconButton size="small" sx={{ color: 'text.secondary' }}>{isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}</IconButton>
                                                                    </Box>
                                                                </Box>

                                                                <Collapse in={isExpanded}>
                                                                    <Divider sx={{ borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider' }} />
                                                                    <Box sx={{ p: 2, bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : '#f8fafc' }}>
                                                                        {shift.assignedUsers?.map(user => (
                                                                            <Paper
                                                                                key={user.applicationId} elevation={0}
                                                                                sx={{ p: 1, mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid', borderColor: getStatusColor(shift.type, user.status) + '80', borderRadius: 2, cursor: 'pointer', bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'white', '&:hover': { bgcolor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#f1f5f9' } }}
                                                                                onClick={() => openVolunteerDetails(user, shift)}
                                                                            >
                                                                                <Box display="flex" alignItems="center" gap={1}>
                                                                                    {getStatusDot(shift.type, user.status)}
                                                                                    <Typography variant="body2" fontWeight="500" color="text.primary">{user.name}</Typography>
                                                                                    {user.isBackup && <Chip label="Beugró" size="small" color="warning" sx={{ height: 20, fontSize: '0.65rem' }} />}
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
                                                                            }} sx={{ mt: 1, borderRadius: 2, bgcolor: isDarkMode ? 'rgba(255,255,255,0.02)' : 'white' }}>
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

                    {viewMode === 'table' && (
                        <Box mb={5}>
                            {hasAnyManagePermission && (
                                <Box display="flex" justifyContent="flex-end" mb={2}>
                                    <Button variant="contained" color="secondary" startIcon={<AddIcon />} onClick={() => handleOpenCreateModal()} disabled={actionLoading} sx={{ borderRadius: 2, fontWeight: 'bold' }}>
                                        Új esemény létrehozása
                                    </Button>
                                </Box>
                            )}

                            <TableContainer
                                component={Paper}
                                elevation={0}
                                onTouchStart={(e) => e.stopPropagation()}
                                onTouchMove={(e) => e.stopPropagation()}
                                onTouchEnd={(e) => e.stopPropagation()}
                                onPointerDown={(e) => e.stopPropagation()}
                                sx={{ borderRadius: 4, bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.4)' : 'white', border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider' }}
                            >
                                <Table size="medium">
                                    <TableHead sx={{ bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : '#f8fafc' }}>
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
                                            <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary' }}>Nincs a szűrésnek megfelelő idősáv.</TableCell></TableRow>
                                        ) : (
                                            filteredShifts.filter(s => s.type !== 'PERSONAL' || searchQuery !== '').map((shift) => {
                                                const hasAccess = canManageShift(shift);
                                                const normalCount = shift.assignedUsers?.filter(u => !u.isBackup).length || 0;
                                                const backupCount = shift.assignedUsers?.filter(u => u.isBackup).length || 0;

                                                return (
                                                    <TableRow key={shift.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                                                        <TableCell>
                                                            {shift.type === 'MEETING' && <Chip size="small" icon={<RecordVoiceOverIcon />} label="Gyűlés" sx={{ bgcolor: isDarkMode ? alpha(theme.palette.secondary.main, 0.2) : '#f3e5f5', color: 'secondary.main', fontWeight: 'bold' }} />}
                                                            {shift.type === 'PERSONAL' && <Chip size="small" icon={<BlockIcon />} label="Személyes" sx={{ bgcolor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#f1f5f9', color: isDarkMode ? '#cbd5e1' : '#64748b', fontWeight: 'bold' }} />}
                                                            {shift.type === 'WORK' && <Chip size="small" label="Műszak" color="primary" variant="outlined" sx={{ fontWeight: 'bold' }} />}
                                                            {!hasAccess && <LockIcon fontSize="small" color="disabled" sx={{ ml: 1, verticalAlign: 'middle' }} />}
                                                        </TableCell>
                                                        <TableCell><Typography variant="body2" fontWeight="bold">{shift.workAreaName || 'Globális'}</Typography></TableCell>
                                                        <TableCell><Typography variant="body2" color="text.secondary">{formatDateWithDay(shift.startTime)}</Typography></TableCell>
                                                        <TableCell>
                                                            <Typography variant="body2">
                                                                {shift.name ? <strong>{shift.name} </strong> : ''}
                                                                ({formatTimeOnly(shift.startTime)} - {formatTimeOnly(shift.endTime)})
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Typography variant="body2">
                                                                {shift.type === 'PERSONAL' ? '-' : `${normalCount} / ${shift.type === 'MEETING' ? '∞' : shift.maxVolunteers}`}
                                                            </Typography>
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
                                                                        <Chip key={u.applicationId} label={u.name} size="small" variant={u.isBackup ? "filled" : "outlined"} color={u.isBackup ? "warning" : "default"} onClick={() => openVolunteerDetails(u, shift)} sx={{ bgcolor: u.isBackup ? alpha(theme.palette.warning.main, 0.2) : undefined, color: u.isBackup ? 'warning.main' : undefined, fontWeight: 'bold' }} />
                                                                    ))}
                                                                    {shift.assignedUsers.length > 3 && (
                                                                        <Chip label={`+${shift.assignedUsers.length - 3} fő`} size="small" color="primary" sx={{ cursor: 'pointer', fontWeight: 'bold' }} onClick={() => { setSelectedShiftForUsersList(shift); setUsersListModalOpen(true); }}/>
                                                                    )}
                                                                </Box>
                                                            )}
                                                        </TableCell>
                                                        <TableCell align="right">
                                                            {hasAccess ? (
                                                                <Box display="flex" justifyContent="flex-end" gap={0.5}>
                                                                    {shift.type !== 'PERSONAL' && <Button size="small" variant="contained" disabled={actionLoading} onClick={() => { setSelectedShiftForAssign(shift); setSelectedApplicantIds([]); setSelectedBackupIds([]); setAssignMode('NORMAL'); setAssignModalOpen(true); }} sx={{ borderRadius: 2 }}>Beoszt</Button>}
                                                                    {shift.type !== 'PERSONAL' && <IconButton size="small" color="primary" onClick={() => handleOpenEditModal(shift)} sx={{ bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }}><EditIcon fontSize="small" /></IconButton>}
                                                                    <IconButton size="small" color="error" onClick={() => handleDeleteShift(shift)} sx={{ bgcolor: isDarkMode ? alpha(theme.palette.error.main, 0.1) : '#ffebee' }}><DeleteIcon fontSize="small" /></IconButton>
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

                    {viewMode === 'calendar' && (
                        <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={2} mb={4}>
                            {isMobile && (
                                <FormControl fullWidth size="small" sx={{ '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'white', borderRadius: 2 } }}>
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
                                <Paper elevation={0} sx={{ width: 300, display: 'flex', flexDirection: 'column', borderRadius: 4, overflow: 'hidden', bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.4)' : 'white', border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider', height: 'auto' }}>
                                    <Box p={2} bgcolor={isDarkMode ? 'rgba(0,0,0,0.2)' : '#f8fafc'} borderBottom="1px solid" borderColor={isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider'}>
                                        <Typography variant="subtitle1" fontWeight="bold" color="primary.main">Kinek a Naptára?</Typography>
                                    </Box>
                                    <List sx={{ flexGrow: 1, overflowY: 'auto', p: 0 }}>
                                        <ListItem disablePadding divider sx={{ borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'divider' }}>
                                            <ListItemButton selected={selectedVolunteerForCalendar === null} onClick={() => setSelectedVolunteerForCalendar(null)} sx={{ '&.Mui-selected': { bgcolor: isDarkMode ? alpha(theme.palette.secondary.main, 0.2) : 'secondary.light', color: isDarkMode ? 'secondary.light' : 'white', '&:hover': { bgcolor: isDarkMode ? alpha(theme.palette.secondary.main, 0.3) : 'secondary.main' } } }}>
                                                <ListItemAvatar><Avatar sx={{ width: 32, height: 32, bgcolor: selectedVolunteerForCalendar === null ? (isDarkMode ? 'rgba(255,255,255,0.1)' : 'white') : 'secondary.main', color: selectedVolunteerForCalendar === null ? 'secondary.main' : 'white' }}><LayersIcon fontSize="small" /></Avatar></ListItemAvatar>
                                                <ListItemText primary={<Typography variant="body2" fontWeight="bold">Összesített Nézet</Typography>} />
                                            </ListItemButton>
                                        </ListItem>

                                        {uniqueVolunteers.map(user => {
                                            const isSelected = selectedVolunteerForCalendar === user.email;
                                            return (
                                                <ListItem key={user.email} disablePadding divider sx={{ borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'divider' }}>
                                                    <ListItemButton selected={isSelected} onClick={() => setSelectedVolunteerForCalendar(user.email)} sx={{ '&.Mui-selected': { bgcolor: isDarkMode ? alpha(theme.palette.primary.main, 0.2) : 'primary.light', color: isDarkMode ? 'primary.light' : 'white', '&:hover': { bgcolor: isDarkMode ? alpha(theme.palette.primary.main, 0.3) : 'primary.main' } } }}>
                                                        <ListItemAvatar><Avatar sx={{ width: 32, height: 32, bgcolor: isSelected ? 'white' : (isDarkMode ? 'rgba(255,255,255,0.1)' : 'primary.main'), color: isSelected ? 'primary.main' : (isDarkMode ? 'white' : 'white') }}><PersonIcon fontSize="small" /></Avatar></ListItemAvatar>
                                                        <ListItemText primary={<Typography variant="body2" fontWeight="bold">{user.name}</Typography>} />
                                                    </ListItemButton>
                                                </ListItem>
                                            );
                                        })}
                                    </List>
                                </Paper>
                            )}

                            <Box sx={{ flexGrow: 1, minWidth: 0, minHeight: 0 }}>
                                <Typography variant="caption" color="text.secondary" display="flex" alignItems="center" gap={0.5} mb={1}>
                                    <InfoOutlinedIcon fontSize="small" /> {selectedVolunteerForCalendar ? "Tipp: Kattints egy napra/órára az önkéntes automatikus beosztásához!" : "Tipp: Kattints egy napra/órára új műszak létrehozásához!"}
                                </Typography>

                                <CustomCalendar
                                    currentDate={calendarDate}
                                    events={customCalendarEvents}
                                    view={calendarView}
                                    onViewChange={(v) => setCalendarView(v)}
                                    onDateChange={setCalendarDate}
                                    onSelectSlot={handleSelectSlot}
                                    isMobile={isMobile}
                                    onSelectEvent={(eventData) => {
                                        const { shift, assignedData } = eventData.originalData;
                                        if (shift.type === 'PERSONAL') handleDeleteShift(shift);
                                        else if (selectedVolunteerForCalendar && assignedData) openVolunteerDetails(assignedData, shift);
                                        else { setSelectedShiftForUsersList(shift); setUsersListModalOpen(true); }
                                    }}
                                />
                            </Box>
                        </Box>
                    )}
                </Container>
            </Fade>

            {/* --- MODALS --- */}
            <Dialog open={createModalOpen} onClose={() => setCreateModalOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.95)' : 'white', backdropFilter: 'blur(20px)', border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'transparent' } }}>
                <DialogTitle sx={{ fontWeight: '900', color: 'text.primary', borderBottom: '1px solid', borderColor: 'divider' }}>{editMode ? 'Esemény módosítása' : 'Új esemény létrehozása'}</DialogTitle>
                <DialogContent sx={{ p: 3, mt: 1 }}>
                    <FormControl component="fieldset" sx={{ mb: 3, width: '100%', border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.2)' : '#e2e8f0', borderRadius: 3, p: 1.5, bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : '#f8fafc' }}>
                        <RadioGroup row value={newShiftData.type} onChange={(e) => {
                            const newType = e.target.value as 'WORK' | 'MEETING';
                            setNewShiftData({...newShiftData, type: newType});
                            if (newType === 'WORK' && targetWorkAreaId === 'global') {
                                const firstManaged = workAreas.find(wa => canManageArea(wa.id));
                                setTargetWorkAreaId(firstManaged ? firstManaged.id : '');
                            }
                        }}>
                            <FormControlLabel value="WORK" control={<Radio color="primary"/>} label={<Typography fontWeight={newShiftData.type === 'WORK' ? 'bold' : 'normal'} color={newShiftData.type === 'WORK' ? 'primary.main' : 'text.primary'}>Műszak</Typography>} />
                            <FormControlLabel value="MEETING" control={<Radio color="secondary"/>} label={<Typography fontWeight={newShiftData.type === 'MEETING' ? 'bold' : 'normal'} color={newShiftData.type === 'MEETING' ? 'secondary.main' : 'text.primary'}>Gyűlés / Eligazítás</Typography>} />
                        </RadioGroup>
                    </FormControl>

                    <FormControl fullWidth margin="normal" sx={{ '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'white', borderRadius: 2 } }}>
                        <InputLabel>Munkaterület *</InputLabel>
                        <Select value={targetWorkAreaId || ''} label="Munkaterület *" onChange={(e) => setTargetWorkAreaId(e.target.value === 'global' ? 'global' : Number(e.target.value))} disabled={actionLoading || editMode}>
                            {newShiftData.type === 'MEETING' && canCreateGlobal && <MenuItem value="global" sx={{ fontWeight: 'bold', color: 'secondary.main' }}>🌐 Globális (Mindenkinek)</MenuItem>}
                            {workAreas.filter(wa => canManageArea(wa.id)).map(wa => <MenuItem key={wa.id} value={wa.id}>{wa.name}</MenuItem>)}
                        </Select>
                    </FormControl>

                    {autoAssignApplicationId && !editMode && (
                        <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>Mentés után a kiválasztott önkéntes automatikusan be lesz osztva erre az eseményre!</Alert>
                    )}

                    <TextField margin="normal" label="Megnevezés (pl. Délelőtt, VIP Bejárás)" fullWidth value={newShiftData.name} onChange={(e) => setNewShiftData({...newShiftData, name: e.target.value})} disabled={actionLoading} sx={{ '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'white', borderRadius: 2 } }} />

                    <Box sx={{ mt: 3, mb: 1, p: 2, borderRadius: 3, border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider', bgcolor: isDarkMode ? 'rgba(255,255,255,0.02)' : '#f8fafc' }}>
                        <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" mb={2}>Időpont kiválasztása</Typography>
                        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={hu}>
                            <Grid container spacing={2}>
                                <Grid size={{xs:12, sm:7}}>
                                    <DatePicker
                                        label="Kezdés Napja *" value={shiftStartDate}
                                        open={openShiftStartDate} onClose={() => setOpenShiftStartDate(false)} onOpen={() => setOpenShiftStartDate(true)}
                                        onChange={setShiftStartDate}
                                        slotProps={{ textField: { fullWidth: true, required: true, onClick: () => setOpenShiftStartDate(true), sx: { '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? 'rgba(0,0,0,0.4)' : 'white', borderRadius: 2 } } } }}
                                        disabled={actionLoading}
                                    />
                                </Grid>
                                <Grid size={{xs:12, sm:5}}>
                                    <TimePicker
                                        label="Kezdés Óra *" value={shiftStartTime}
                                        open={openShiftStartTime} onClose={() => setOpenShiftStartTime(false)} onOpen={() => setOpenShiftStartTime(true)}
                                        onChange={setShiftStartTime}
                                        ampm={false} timeSteps={{ minutes: 5 }}
                                        viewRenderers={{ hours: renderTimeViewClock, minutes: renderTimeViewClock, seconds: renderTimeViewClock }}
                                        slotProps={{ textField: { fullWidth: true, required: true, onClick: () => setOpenShiftStartTime(true), sx: { '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? 'rgba(0,0,0,0.4)' : 'white', borderRadius: 2 } } } }}
                                        disabled={actionLoading}
                                    />
                                </Grid>
                                <Grid size={{xs:12, sm:7}}>
                                    <DatePicker
                                        label="Befejezés Napja *" value={shiftEndDate} minDate={shiftStartDate || undefined}
                                        open={openShiftEndDate} onClose={() => setOpenShiftEndDate(false)} onOpen={() => setOpenShiftEndDate(true)}
                                        onChange={setShiftEndDate}
                                        slotProps={{ textField: { fullWidth: true, required: true, onClick: () => setOpenShiftEndDate(true), sx: { '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? 'rgba(0,0,0,0.4)' : 'white', borderRadius: 2 } } } }}
                                        disabled={actionLoading}
                                    />
                                </Grid>
                                <Grid size={{xs:12, sm:5}}>
                                    <TimePicker
                                        label="Vége Óra *" value={shiftEndTime}
                                        open={openShiftEndTime} onClose={() => setOpenShiftEndTime(false)} onOpen={() => setOpenShiftEndTime(true)}
                                        onChange={setShiftEndTime}
                                        ampm={false} timeSteps={{ minutes: 5 }}
                                        viewRenderers={{ hours: renderTimeViewClock, minutes: renderTimeViewClock, seconds: renderTimeViewClock }}
                                        slotProps={{ textField: { fullWidth: true, required: true, onClick: () => setOpenShiftEndTime(true), sx: { '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? 'rgba(0,0,0,0.4)' : 'white', borderRadius: 2 } } } }}
                                        disabled={actionLoading}
                                    />
                                </Grid>
                            </Grid>
                        </LocalizationProvider>
                    </Box>

                    {newShiftData.type === 'WORK' && (
                        <Box display="flex" gap={2} mt={2}>
                            <TextField type="number" label="Létszám (Max fő)" fullWidth value={newShiftData.maxVolunteers} onChange={(e) => setNewShiftData({...newShiftData, maxVolunteers: parseInt(e.target.value) || 0})} disabled={actionLoading} sx={{ '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'white', borderRadius: 2 } }} />
                            <TextField type="number" label="Beugrók (Max fő)" fullWidth value={newShiftData.maxBackupVolunteers} onChange={(e) => setNewShiftData({...newShiftData, maxBackupVolunteers: parseInt(e.target.value) || 0})} disabled={actionLoading} sx={{ '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'white', borderRadius: 2 } }} />
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 2, px: 3, borderTop: '1px solid', borderColor: 'divider', bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : '#f8fafc' }}>
                    <Button onClick={() => setCreateModalOpen(false)} color="inherit" disabled={actionLoading} sx={{ fontWeight: 'bold' }}>Mégse</Button>
                    <Button onClick={handleSaveShift} variant="contained" disabled={actionLoading || !shiftStartDate || !shiftStartTime || !shiftEndDate || !shiftEndTime || targetWorkAreaId === '' || targetWorkAreaId === null} sx={{ borderRadius: 2, fontWeight: 'bold', px: 4 }}>Mentés</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={deletePersonalModalOpen} onClose={() => setDeletePersonalModalOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 4, bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.95)' : 'white', backdropFilter: 'blur(20px)', border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'transparent' } }}>
                <DialogTitle sx={{ color: theme.palette.error.main, fontWeight: '900', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <BlockIcon /> Személyes Esemény Törlése
                </DialogTitle>
                <DialogContent sx={{ mt: 1 }}>
                    <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>Ez az esemény <b>{shiftToDelete?.assignedUsers[0]?.name}</b> személyes naptárbejegyzése: <br/><br/><i>"{shiftToDelete?.description}"</i></Alert>
                    <Typography variant="body2" mb={1} fontWeight="bold" color="text.primary">Kérlek, indokold meg a törlést (ezt az önkéntes látni fogja):</Typography>
                    <TextField fullWidth multiline rows={3} placeholder="Pl.: Bocsánat, de ebben az időszakban elengedhetetlen a jelenléted..." value={personalDeleteMessage} onChange={(e) => setPersonalDeleteMessage(e.target.value)} disabled={actionLoading} sx={{ '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'white', borderRadius: 2 } }} />
                </DialogContent>
                <DialogActions sx={{ p: 2, px: 3, borderTop: '1px solid', borderColor: 'divider', bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : '#f8fafc' }}>
                    <Button onClick={() => setDeletePersonalModalOpen(false)} color="inherit" disabled={actionLoading} sx={{ fontWeight: 'bold' }}>Mégse</Button>
                    <Button variant="contained" color="error" onClick={executeDeleteShift} disabled={actionLoading || !personalDeleteMessage.trim()} sx={{ borderRadius: 2, fontWeight: 'bold' }}>Törlés</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={assignModalOpen} onClose={() => setAssignModalOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.95)' : 'white', backdropFilter: 'blur(20px)', border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'transparent' } }}>
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid', borderColor: 'divider', pb: 2 }}>
                    <Typography variant="h6" fontWeight="900" color="primary.main">Önkéntesek beosztása</Typography>
                    {selectedShiftForAssign?.type === 'MEETING' && (
                        <Button size="small" variant="outlined" sx={{ borderRadius: 2, fontWeight: 'bold' }} onClick={() => setSelectedApplicantIds(assignableApplicants.map(a => a.applicationId))}>
                            Mindenkit kijelöl
                        </Button>
                    )}
                </DialogTitle>
                <DialogContent sx={{ mt: 3, p: { xs: 2, sm: 3 } }}>
                    {selectedShiftForAssign?.type === 'WORK' && (
                        <ToggleButtonGroup
                            value={assignMode}
                            exclusive
                            onChange={(_, val) => val && setAssignMode(val)}
                            fullWidth
                            sx={{ mb: 3, '& .MuiToggleButton-root': { borderRadius: 2, mx: 0.5, border: '1px solid', borderColor: 'divider' } }}
                            size="small"
                        >
                            <ToggleButton value="NORMAL" color="primary" sx={{ fontWeight: 'bold', '&.Mui-selected': { bgcolor: alpha(theme.palette.primary.main, 0.1) } }}>Normál Beosztás</ToggleButton>
                            <ToggleButton value="BACKUP" color="warning" sx={{ fontWeight: 'bold', '&.Mui-selected': { bgcolor: alpha(theme.palette.warning.main, 0.1) } }}>Beugró / Készenléti</ToggleButton>
                        </ToggleButtonGroup>
                    )}

                    <Box sx={{ maxHeight: 400, overflowY: 'auto', pr: 1 }}>
                        {assignableApplicants.map(app => {
                            const isNormal = selectedApplicantIds.includes(app.applicationId);
                            const isBackup = selectedBackupIds.includes(app.applicationId);

                            return (
                                <Paper key={app.applicationId} elevation={0} sx={{ p: 1.5, mb: 1, display: 'flex', alignItems: 'center', gap: 2, border: '2px solid', borderColor: isNormal ? 'primary.main' : isBackup ? 'warning.main' : (isDarkMode ? 'rgba(255,255,255,0.1)' : '#e2e8f0'), borderRadius: 3, cursor: 'pointer', bgcolor: isNormal ? alpha(theme.palette.primary.main, 0.05) : isBackup ? alpha(theme.palette.warning.main, 0.05) : (isDarkMode ? 'rgba(0,0,0,0.2)' : 'white'), transition: 'all 0.2s', '&:hover': { transform: 'translateX(4px)' } }}
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
                                    <Checkbox checked={isNormal || isBackup} color={isBackup ? "warning" : "primary"} disabled={actionLoading} />
                                    <Typography fontWeight="bold" color="text.primary">{app.userName}</Typography>
                                    {isNormal && <Chip label="Normálnak jelölve" size="small" color="primary" sx={{ ml: 'auto', fontWeight: 'bold' }}/>}
                                    {isBackup && <Chip label="Beugrónak jelölve" size="small" color="warning" sx={{ ml: 'auto', fontWeight: 'bold' }}/>}
                                </Paper>
                            );
                        })}
                        {assignableApplicants.length === 0 && <Alert severity="info" sx={{ borderRadius: 2 }}>Nincs beosztható önkéntes ezen a területen (vagy már mindenkit beosztottál).</Alert>}
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 2, px: 3, borderTop: '1px solid', borderColor: 'divider', bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : '#f8fafc' }}>
                    <Button onClick={() => setAssignModalOpen(false)} color="inherit" sx={{ fontWeight: 'bold' }}>Mégse</Button>
                    <Button onClick={handleAssignUsers} variant="contained" disabled={actionLoading || (selectedApplicantIds.length === 0 && selectedBackupIds.length === 0)} sx={{ borderRadius: 2, fontWeight: 'bold', px: 4 }}>Beosztás ({selectedApplicantIds.length + selectedBackupIds.length} fő)</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={usersListModalOpen} onClose={() => setUsersListModalOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.95)' : 'white', backdropFilter: 'blur(20px)', border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'transparent' } }}>
                <DialogTitle sx={{ fontWeight: '900', color: 'primary.main', borderBottom: '1px solid', borderColor: 'divider', pb: 2 }}>Érintett Önkéntesek</DialogTitle>
                <DialogContent sx={{ p: 2, mt: 1, maxHeight: 400, overflowY: 'auto' }}>
                    {selectedShiftForUsersList?.assignedUsers.map(user => (
                        <Paper key={user.applicationId} elevation={0} sx={{ p: 1.5, mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#e2e8f0', borderRadius: 2, cursor: 'pointer', bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'white', '&:hover': { bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f8fafc' } }} onClick={() => { setUsersListModalOpen(false); openVolunteerDetails(user, selectedShiftForUsersList, true); }}>
                            <Box display="flex" alignItems="center" gap={1.5}>
                                {getStatusDot(selectedShiftForUsersList.type, user.status)}
                                <Typography fontWeight="bold" color="text.primary">{user.name}</Typography>
                                {user.isBackup && <Chip label="Beugró" size="small" color="warning" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 'bold' }} />}
                            </Box>
                        </Paper>
                    ))}
                </DialogContent>
                <DialogActions sx={{ p: 2, px: 3, borderTop: '1px solid', borderColor: 'divider', bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : '#f8fafc', display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5, justifyContent: 'space-between' }}>
                    {selectedShiftForUsersList && canManageShift(selectedShiftForUsersList) ? (
                        <Box display="flex" gap={1} width={{ xs: '100%', sm: 'auto' }}>
                            <Button fullWidth={isMobile} onClick={() => { setUsersListModalOpen(false); handleOpenEditModal(selectedShiftForUsersList); }} color="primary" variant="outlined" startIcon={<EditIcon />} sx={{ borderRadius: 2, fontWeight: 'bold' }}>Szerkesztés</Button>
                            <Button fullWidth={isMobile} onClick={() => { setUsersListModalOpen(false); handleDeleteShift(selectedShiftForUsersList); }} color="error" variant="outlined" startIcon={<DeleteOutlineIcon />} sx={{ borderRadius: 2, fontWeight: 'bold' }}>Törlés</Button>
                        </Box>
                    ) : (
                        <Box />
                    )}
                    <Box display="flex" gap={1} width={{ xs: '100%', sm: 'auto' }}>
                        {selectedShiftForUsersList && canManageShift(selectedShiftForUsersList) && (
                            <Button fullWidth={isMobile} onClick={() => { setUsersListModalOpen(false); setSelectedShiftForAssign(selectedShiftForUsersList); setSelectedApplicantIds([]); setSelectedBackupIds([]); setAssignMode('NORMAL'); setAssignModalOpen(true); }} color="primary" variant="contained" disableElevation startIcon={<GroupAddIcon />} sx={{ borderRadius: 2, fontWeight: 'bold' }}>Új beosztás</Button>
                        )}
                        <Button fullWidth={isMobile} onClick={() => setUsersListModalOpen(false)} variant="contained" color="inherit" disableElevation sx={{ borderRadius: 2, fontWeight: 'bold' }}>Bezárás</Button>
                    </Box>
                </DialogActions>
            </Dialog>

            <Dialog open={volunteerDetailsModalOpen} onClose={() => setVolunteerDetailsModalOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.95)' : 'white', backdropFilter: 'blur(20px)', border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'transparent' } }}>
                <DialogTitle sx={{ color: selectedVolunteerDetails?.user.status === 'MODIFICATION_REQUESTED' ? theme.palette.error.main : theme.palette.primary.main, fontWeight: '900', borderBottom: '1px solid', borderColor: 'divider', pb: 2 }}>
                    {selectedVolunteerDetails?.user.name} beosztása {selectedVolunteerDetails?.user.isBackup ? '(Beugró)' : ''}
                </DialogTitle>
                <DialogContent sx={{ mt: 3 }}>
                    {selectedVolunteerDetails && (
                        <Box>
                            <Paper elevation={0} sx={{ p: 2.5, mb: 3, borderRadius: 3, bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : '#f8fafc', border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'divider', borderLeft: '4px solid', borderLeftColor: theme.palette.primary.main }}>
                                <Typography variant="h6" color="primary.main" fontWeight="bold">{selectedVolunteerDetails.shift.workAreaName || 'Globális'} {selectedVolunteerDetails.shift.name ? `(${selectedVolunteerDetails.shift.name})` : ''}</Typography>
                                <Typography variant="body1" color="text.secondary" sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1, fontWeight: '500' }}><CalendarTodayIcon fontSize="small" /> {formatDateWithDay(selectedVolunteerDetails.shift.startTime)}</Typography>
                                <Typography variant="body1" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, fontWeight: '500' }}><AccessTimeIcon fontSize="small" /> {formatTimeOnly(selectedVolunteerDetails.shift.startTime)} - {formatTimeOnly(selectedVolunteerDetails.shift.endTime)}</Typography>
                            </Paper>
                            {selectedVolunteerDetails.user.message && (
                                <Alert severity="warning" icon={<EmailIcon />} sx={{ borderRadius: 3, mb: 2, '& .MuiAlert-message': { width: '100%' } }}>
                                    <Typography variant="caption" fontWeight="bold" display="block" mb={0.5}>Üzenet az önkéntestől:</Typography>
                                    <Typography variant="body2" sx={{ fontStyle: 'italic' }}>"{selectedVolunteerDetails.user.message}"</Typography>
                                </Alert>
                            )}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 2, px: 3, bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : '#f8fafc', borderTop: '1px solid', borderColor: 'divider', justifyContent: 'space-between' }}>
                    <Box display="flex" gap={1}>
                        {openedFromList ? <Button onClick={() => { setVolunteerDetailsModalOpen(false); setUsersListModalOpen(true); }} color="inherit" startIcon={<ArrowBackIcon />} sx={{ fontWeight: 'bold' }}>Vissza a listához</Button> : <Button onClick={() => setVolunteerDetailsModalOpen(false)} color="inherit" sx={{ fontWeight: 'bold' }}>Bezárás</Button>}
                    </Box>
                    {selectedVolunteerDetails && canManageShift(selectedVolunteerDetails.shift) && (
                        <Button variant="outlined" color="error" startIcon={<DeleteOutlineIcon />} onClick={() => handleRemoveUser(selectedVolunteerDetails!.shift.id, selectedVolunteerDetails!.user.applicationId, selectedVolunteerDetails!.user.name)} sx={{ borderRadius: 2, fontWeight: 'bold' }}>Beosztás Törlése</Button>
                    )}
                </DialogActions>
            </Dialog>

            <Dialog open={deleteShiftConfirmOpen} onClose={() => setDeleteShiftConfirmOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 4, bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.95)' : 'white', backdropFilter: 'blur(20px)', border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' } }}>
                <DialogTitle sx={{ fontWeight: '900', color: theme.palette.error.main, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <DeleteOutlineIcon /> Esemény Törlése
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body1">Biztosan törlöd ezt az eseményt / idősávot?</Typography>
                </DialogContent>
                <DialogActions sx={{ p: 2, px: 3 }}>
                    <Button onClick={() => setDeleteShiftConfirmOpen(false)} color="inherit" sx={{ fontWeight: 'bold' }} disabled={actionLoading}>Mégse</Button>
                    <Button onClick={executeDeleteShift} variant="contained" color="error" sx={{ borderRadius: 2, fontWeight: 'bold' }} disableElevation disabled={actionLoading}>Törlés</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={removeUserConfirmOpen} onClose={() => setRemoveUserConfirmOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 4, bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.95)' : 'white', backdropFilter: 'blur(20px)', border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' } }}>
                <DialogTitle sx={{ fontWeight: '900', color: theme.palette.error.main, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <DeleteOutlineIcon /> Önkéntes eltávolítása
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body1">Biztosan eltávolítod <b>{userToRemove?.name}</b> nevű önkéntest a beosztásból?</Typography>
                </DialogContent>
                <DialogActions sx={{ p: 2, px: 3 }}>
                    <Button onClick={() => setRemoveUserConfirmOpen(false)} color="inherit" sx={{ fontWeight: 'bold' }} disabled={actionLoading}>Mégse</Button>
                    <Button onClick={executeRemoveUser} variant="contained" color="error" sx={{ borderRadius: 2, fontWeight: 'bold' }} disableElevation disabled={actionLoading}>Eltávolítás</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={errorModalOpen} onClose={() => setErrorModalOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.95)' : 'white', backdropFilter: 'blur(20px)', border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'transparent' } }}>
                <DialogTitle sx={{ color: theme.palette.error.main, display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: '900', borderBottom: '1px solid', borderColor: 'divider', pb: 2 }}><WarningAmberIcon fontSize="large"/> Figyelmeztetés</DialogTitle>
                <DialogContent sx={{ mt: 3, mb: 1 }}><Typography variant="body1" color="text.primary" sx={{ fontSize: '1.1rem', whiteSpace: 'pre-wrap' }}>{errorMessage}</Typography></DialogContent>
                <DialogActions sx={{ p: 2, px: 3, bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : '#f8fafc', borderTop: '1px solid', borderColor: 'divider' }}><Button onClick={() => setErrorModalOpen(false)} variant="contained" color="error" sx={{ borderRadius: 2, fontWeight: 'bold', px: 3 }}>Megértettem</Button></DialogActions>
            </Dialog>
        </>
    );
}