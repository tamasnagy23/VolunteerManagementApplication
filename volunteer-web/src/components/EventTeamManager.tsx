import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
    Container, Typography, Box, Paper, Button, Alert,
    TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
    Dialog, DialogTitle, DialogContent, DialogActions, FormControl,
    InputLabel, Select, MenuItem, Checkbox, FormControlLabel, FormGroup,
    Chip, Avatar, useMediaQuery, useTheme, Card, CardContent, Divider,
    TextField, InputAdornment, Pagination, Fade, alpha, Tooltip
} from '@mui/material';
import Grid from '@mui/material/Grid';

// Ikonok
import EditIcon from '@mui/icons-material/Edit';
import SecurityIcon from '@mui/icons-material/Security';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import SearchIcon from '@mui/icons-material/Search';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import PhoneIcon from '@mui/icons-material/Phone';
import StarIcon from '@mui/icons-material/Star'; // ÚJ IKON AZ ALAPÍTÓNAK
import ShieldIcon from '@mui/icons-material/Shield'; // ÚJ IKON A SYS ADMINNAK

import api from '../api/axios';
import LoadingScreen from "./LoadingScreen.tsx";

// --- JAVÍTÁS: Új mezők a Backendből (isSysAdmin, orgRole) ---
interface EventTeamMember {
    userId: number;
    userName: string;
    userEmail: string;
    phoneNumber?: string;
    profileImageUrl?: string | null;
    eventRole: string | null;
    permissions: string[];
    coordinatedWorkAreaIds: number[];
    isSysAdmin?: boolean; // <-- ÚJ
    orgRole?: string;     // <-- ÚJ ('OWNER', 'ORGANIZER', 'VOLUNTEER')
}

interface WorkArea {
    id: number;
    name: string;
}

interface EventData {
    id: number;
    title: string;
    workAreas: WorkArea[];
}

const AVAILABLE_PERMISSIONS = [
    { value: 'MANAGE_APPLICATIONS', label: 'Jelentkezések elbírálása' },
    { value: 'MANAGE_SHIFTS', label: 'Műszakok és Naptár kezelése' },
    { value: 'ASSIGN_VOLUNTEERS', label: 'Önkéntesek beosztása' },
    { value: 'EDIT_EVENT_DETAILS', label: 'Esemény adatainak szerkesztése' }
];

const getAvatarUrl = (url?: string | null) => {
    if (!url || url.trim() === '') return undefined;
    const backendBaseUrl = 'http://localhost:8081';
    return url.startsWith('http') ? url : `${backendBaseUrl}${url}`;
};

export default function EventTeamManager() {
    const { id } = useParams<{ id: string }>();
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const [event, setEvent] = useState<EventData | null>(null);
    const [team, setTeam] = useState<EventTeamMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('ALL');

    const [page, setPage] = useState(1);
    const ITEMS_PER_PAGE = isMobile ? 5 : 10;

    const [editModalOpen, setEditModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    const [editingUserId, setEditingUserId] = useState<number | null>(null);
    const [editingName, setEditingName] = useState('');
    const [draftRole, setDraftRole] = useState<string>('NONE');
    const [draftPermissions, setDraftPermissions] = useState<string[]>([]);
    const [draftAreas, setDraftAreas] = useState<number[]>([]);

    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [detailsModalTitle, setDetailsModalTitle] = useState('');
    const [detailsModalItems, setDetailsModalItems] = useState<string[]>([]);

    useEffect(() => {
        if (id) fetchData();
    }, [id]);

    useEffect(() => {
        setPage(1);
    }, [searchTerm, roleFilter]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [eventRes, teamRes] = await Promise.all([
                api.get(`/events/${id}`),
                api.get(`/events/${id}/team`)
            ]);
            setEvent(eventRes.data);

            const activeTeam = (teamRes.data as EventTeamMember[]).filter(
                member => !member.userEmail.endsWith('@anonymized.local')
            );
            setTeam(activeTeam);
        } catch {
            setError("Hiba történt az adatok betöltésekor. Lehet, hogy nincs jogosultságod ehhez a felülethez.");
        } finally {
            setLoading(false);
        }
    };

    const handleOpenEdit = (member: EventTeamMember) => {
        setEditingUserId(member.userId);
        setEditingName(member.userName);
        setDraftRole(member.eventRole || 'NONE');
        setDraftPermissions(member.permissions || []);
        setDraftAreas(member.coordinatedWorkAreaIds || []);
        setEditModalOpen(true);
    };

    const handlePermissionToggle = (permValue: string) => {
        setDraftPermissions(prev =>
            prev.includes(permValue) ? prev.filter(p => p !== permValue) : [...prev, permValue]
        );
    };

    const handleSave = async () => {
        if (!editingUserId) return;
        setSaving(true);
        try {
            const payload = {
                eventRole: draftRole === 'NONE' ? null : draftRole,
                permissions: draftRole === 'COORDINATOR' ? draftPermissions : [],
                coordinatedWorkAreaIds: draftRole === 'COORDINATOR' ? draftAreas : []
            };

            await api.put(`/events/${id}/team/${editingUserId}`, payload);
            setEditModalOpen(false);
            await fetchData();
        } catch {
            alert("Hiba történt a jogosultságok mentésekor.");
        } finally {
            setSaving(false);
        }
    };

    const handleOpenDetails = (title: string, items: string[]) => {
        setDetailsModalTitle(title);
        setDetailsModalItems(items);
        setDetailsModalOpen(true);
    };

    const getColorHex = (c: 'default' | 'primary' | 'secondary' | 'info') => {
        if (c === 'primary') return theme.palette.primary.main;
        if (c === 'secondary') return theme.palette.secondary.main;
        if (c === 'info') return theme.palette.info.main;
        return isDarkMode ? theme.palette.grey[400] : theme.palette.grey[600];
    };

    const getRoleColor = (member: EventTeamMember): 'default' | 'primary' | 'secondary' | 'info' => {
        if (member.isSysAdmin) return 'primary';
        if (member.orgRole === 'OWNER' || member.orgRole === 'ORGANIZER') return 'secondary';
        if (member.eventRole === 'ORGANIZER') return 'secondary';
        if (member.eventRole === 'COORDINATOR') return 'info';
        return 'default';
    };

    const renderChipGroup = (items: string[], title: string, color: 'default' | 'primary' | 'secondary' | 'info' = 'default', limit: number = 2) => {
        if (items.length === 0) return <Typography variant="caption" color="text.secondary">-</Typography>;

        const hexColor = getColorHex(color);
        const textColor = isDarkMode ? (color === 'primary' ? '#93c5fd' : color === 'secondary' ? '#f9a8d4' : color === 'info' ? '#67e8f9' : '#f8fafc') : 'inherit';

        const chipStyle = {
            bgcolor: isDarkMode ? alpha(hexColor, 0.15) : 'transparent',
            borderColor: isDarkMode ? alpha(hexColor, 0.3) : 'inherit',
            color: textColor,
            fontWeight: 600,
        };

        if (items.length <= limit) {
            return (
                <Box display="flex" flexWrap="wrap" gap={0.5}>
                    {items.map((item, idx) => (
                        <Chip key={idx} label={item} size="small" color={color} variant={isDarkMode ? 'filled' : 'outlined'} sx={chipStyle} />
                    ))}
                </Box>
            );
        }

        const visible = items.slice(0, limit - 1);
        const hiddenCount = items.length - visible.length;

        return (
            <Box display="flex" flexWrap="wrap" gap={0.5}>
                {visible.map((item, idx) => (
                    <Chip key={idx} label={item} size="small" color={color} variant={isDarkMode ? 'filled' : 'outlined'} sx={chipStyle} />
                ))}
                <Chip
                    label={`+ ${hiddenCount} további...`}
                    size="small"
                    color={color}
                    onClick={() => handleOpenDetails(title, items)}
                    sx={{
                        ...chipStyle,
                        cursor: 'pointer',
                        bgcolor: isDarkMode ? alpha(hexColor, 0.25) : alpha(hexColor, 0.1),
                        border: '1px solid',
                        borderColor: isDarkMode ? alpha(hexColor, 0.4) : 'transparent',
                        transition: 'transform 0.2s', '&:hover': { transform: 'scale(1.05)' }
                    }}
                />
            </Box>
        );
    };

    // --- ÚJ: Komponens a Jogosultság plecsni rendereléséhez ---
    const renderRoleBadge = (member: EventTeamMember) => {
        if (member.isSysAdmin) {
            return <Chip icon={<ShieldIcon />} label="Rendszergazda" color="primary" size="small" sx={{ fontWeight: 'bold', borderRadius: 1.5 }} />;
        }
        if (member.orgRole === 'OWNER') {
            return <Chip icon={<StarIcon />} label="Szervezet Alapító" color="secondary" size="small" sx={{ fontWeight: 'bold', borderRadius: 1.5 }} />;
        }
        if (member.orgRole === 'ORGANIZER') {
            return <Chip icon={<SecurityIcon />} label="Globális Szervező" color="secondary" size="small" sx={{ fontWeight: 'bold', borderRadius: 1.5 }} />;
        }
        if (member.eventRole === 'ORGANIZER') {
            return <Chip icon={<SecurityIcon />} label="Főszervező" color="secondary" size="small" sx={{ fontWeight: 'bold', borderRadius: 1.5 }} />;
        }
        if (member.eventRole === 'COORDINATOR') {
            return <Chip icon={<SupervisorAccountIcon />} label="Koordinátor" color="info" size="small" sx={{ fontWeight: 'bold', borderRadius: 1.5 }} />;
        }
        return <Chip label="Sima Önkéntes" variant="outlined" size="small" sx={{ borderRadius: 1.5, color: 'text.secondary' }} />;
    };

    const filteredTeam = useMemo(() => {
        return team.filter(member => {
            const matchesSearch = member.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                member.userEmail.toLowerCase().includes(searchTerm.toLowerCase());

            let matchesRole = true;
            if (roleFilter === 'ORGANIZER') {
                matchesRole = member.eventRole === 'ORGANIZER' || member.orgRole === 'OWNER' || member.orgRole === 'ORGANIZER' || Boolean(member.isSysAdmin);
            }
            if (roleFilter === 'COORDINATOR') {
                matchesRole = member.eventRole === 'COORDINATOR';
            }
            if (roleFilter === 'VOLUNTEER') {
                matchesRole = !member.eventRole && member.orgRole !== 'OWNER' && member.orgRole !== 'ORGANIZER' && !member.isSysAdmin;
            }

            return matchesSearch && matchesRole;
        }).sort((a, b) => {
            const roleWeight = (m: EventTeamMember) => {
                if (m.isSysAdmin) return 5;
                if (m.orgRole === 'OWNER') return 4;
                if (m.orgRole === 'ORGANIZER') return 3;
                if (m.eventRole === 'ORGANIZER') return 3;
                if (m.eventRole === 'COORDINATOR') return 2;
                return 1;
            };
            const weightA = roleWeight(a);
            const weightB = roleWeight(b);

            if (weightA !== weightB) return weightB - weightA;
            return a.userName.localeCompare(b.userName, 'hu');
        });
    }, [team, searchTerm, roleFilter]);

    const totalPages = Math.ceil(filteredTeam.length / ITEMS_PER_PAGE);
    const paginatedTeam = filteredTeam.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    if (loading) return <LoadingScreen />;
    if (!event) return <Container><Alert severity="error">Esemény nem található.</Alert></Container>;

    return (
        <Fade in={true} timeout={600}>
            <Container maxWidth="lg" sx={{ mt: { xs: 2, md: 4 }, mb: 10 }}>

                <Typography variant="h4" fontWeight="900" color="text.primary" mb={1} sx={{ fontSize: { xs: '1.8rem', sm: '2.125rem' }, letterSpacing: '-0.5px' }}>
                    Csapat és Jogosultságok
                </Typography>
                <Typography variant="subtitle1" color="text.secondary" mb={4}>
                    <Box component="span" fontWeight="bold" color="primary.main">{event.title}</Box> - Oszd ki a szervezői és koordinátori feladatokat!
                </Typography>

                {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

                <Paper
                    elevation={0}
                    sx={{
                        p: { xs: 2, sm: 3 }, mb: 4,
                        display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap',
                        borderRadius: 3,
                        bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid', borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                        boxShadow: isDarkMode ? '0 10px 30px rgba(0,0,0,0.2)' : '0 10px 30px rgba(0,0,0,0.03)'
                    }}
                >
                    <TextField
                        size="small"
                        placeholder="Keresés név vagy email alapján..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        sx={{ flex: 1, minWidth: { xs: '100%', sm: 250 }, '& .MuiOutlinedInput-root': { bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'white', borderRadius: 2 } }}
                        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon color="primary" /></InputAdornment> }}
                    />
                    <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 220 } }}>
                        <InputLabel>Szerepkör szűrő</InputLabel>
                        <Select
                            value={roleFilter} label="Szerepkör szűrő" onChange={(e) => setRoleFilter(e.target.value)}
                            sx={{ bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'white', borderRadius: 2 }}
                        >
                            <MenuItem value="ALL">Összes résztvevő</MenuItem>
                            <MenuItem value="ORGANIZER">Főszervezők (Adminek is)</MenuItem>
                            <MenuItem value="COORDINATOR">Koordinátorok</MenuItem>
                            <MenuItem value="VOLUNTEER">Sima Önkéntesek</MenuItem>
                        </Select>
                    </FormControl>
                </Paper>

                {filteredTeam.length === 0 ? (
                    <Paper elevation={0} sx={{ p: 6, textAlign: 'center', color: 'text.secondary', borderRadius: 3, border: '1px dashed', borderColor: 'divider', bgcolor: 'transparent' }}>
                        <PersonOutlineIcon sx={{ fontSize: 60, opacity: 0.5, mb: 2 }} />
                        <Typography variant="h6" fontWeight="bold">Nincs a keresésnek megfelelő személy.</Typography>
                    </Paper>
                ) : (
                    <Box sx={{ animation: 'fadeInUp 0.5s ease-out', '@keyframes fadeInUp': { '0%': { opacity: 0, transform: 'translateY(20px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } } }}>

                        {isMobile ? (
                            <Grid container spacing={2}>
                                {paginatedTeam.map(member => {
                                    const permLabels = member.permissions.map(p => AVAILABLE_PERMISSIONS.find(ap => ap.value === p)?.label || p);
                                    const areaLabels = member.coordinatedWorkAreaIds.map(areaId => ` ${event.workAreas.find(wa => wa.id === areaId)?.name || 'Ismeretlen terület'}`);
                                    const rColorName = getRoleColor(member);
                                    const rColorHex = getColorHex(rColorName);
                                    const uPhone = member.phoneNumber || 'Nincs adat';

                                    // JAVÍTÁS: Ezt az embert tilos szerkeszteni, mert amúgy is "Isten" a rendszerben
                                    const isUneditable = Boolean(member.isSysAdmin) || member.orgRole === 'OWNER' || member.orgRole === 'ORGANIZER';

                                    return (
                                        <Grid size={{xs:12}} key={member.userId}>
                                            <Card
                                                elevation={0}
                                                sx={{
                                                    borderRadius: 3,
                                                    bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.5)' : 'white',
                                                    border: '1px solid',
                                                    borderColor: member.eventRole || isUneditable ? alpha(rColorHex, 0.4) : 'divider',
                                                    transition: 'all 0.3s ease',
                                                    '&:hover': { transform: 'translateY(-3px)', boxShadow: isDarkMode ? `0 8px 20px ${alpha(rColorHex, 0.15)}` : '0 8px 20px rgba(0,0,0,0.08)' }
                                                }}
                                            >
                                                <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
                                                    <Box display="flex" alignItems="center" gap={2} mb={2}>
                                                        <Avatar
                                                            src={getAvatarUrl(member.profileImageUrl)}
                                                            sx={{
                                                                bgcolor: (member.eventRole || isUneditable) ? rColorHex : (isDarkMode ? 'grey.800' : 'grey.300'),
                                                                color: (member.eventRole || isUneditable) ? 'white' : 'text.primary',
                                                                width: 48, height: 48, fontWeight: 'bold'
                                                            }}
                                                        >
                                                            {member.userName.charAt(0).toUpperCase()}
                                                        </Avatar>
                                                        <Box>
                                                            <Typography variant="subtitle1" fontWeight="900" color="text.primary">{member.userName}</Typography>
                                                            <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-all' }}>{member.userEmail}</Typography>
                                                            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                                                                <PhoneIcon fontSize="small"/> {uPhone}
                                                            </Typography>
                                                        </Box>
                                                    </Box>

                                                    <Divider sx={{ my: 2, borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'divider' }} />

                                                    <Box mb={3}>
                                                        <Typography variant="caption" color="text.secondary" fontWeight="bold" display="block" mb={1} sx={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                            Szerepkör
                                                        </Typography>

                                                        {renderRoleBadge(member)}

                                                        {member.eventRole === 'COORDINATOR' && !isUneditable && member.permissions.length > 0 && (
                                                            <Box mt={2.5}>
                                                                <Typography variant="caption" color="text.secondary" fontWeight="bold" display="block" mb={1} sx={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                                    Jogosultságok
                                                                </Typography>
                                                                {renderChipGroup(permLabels, `${member.userName} - Jogosultságok`, 'default', 2)}
                                                            </Box>
                                                        )}

                                                        {member.eventRole === 'COORDINATOR' && !isUneditable && member.coordinatedWorkAreaIds.length > 0 && (
                                                            <Box mt={2.5}>
                                                                <Typography variant="caption" color="text.secondary" fontWeight="bold" display="block" mb={1} sx={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                                    Kezelt Területek
                                                                </Typography>
                                                                {renderChipGroup(areaLabels, `${member.userName} - Kezelt Területek`, 'primary', 2)}
                                                            </Box>
                                                        )}
                                                    </Box>

                                                    <Tooltip title={isUneditable ? "Globális / Szervezeti vezetők jogait itt nem lehet csökkenteni." : ""}>
                                                        <span>
                                                            <Button
                                                                fullWidth
                                                                variant={member.eventRole ? "contained" : "outlined"}
                                                                color={rColorName === 'default' ? 'primary' : rColorName}
                                                                startIcon={<EditIcon />}
                                                                onClick={() => handleOpenEdit(member)}
                                                                disabled={isUneditable}
                                                                sx={{ borderRadius: 2, py: 1.2, fontWeight: 'bold' }}
                                                                disableElevation
                                                            >
                                                                {isUneditable ? 'Fix Jogosultság' : 'Kinevezés / Szerkesztés'}
                                                            </Button>
                                                        </span>
                                                    </Tooltip>
                                                </CardContent>
                                            </Card>
                                        </Grid>
                                    )})}
                            </Grid>
                        ) : (
                            <TableContainer
                                component={Paper}
                                elevation={0}
                                sx={{
                                    borderRadius: 3,
                                    bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.4)' : 'white',
                                    border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'divider',
                                    overflow: 'hidden'
                                }}
                            >
                                <Table>
                                    <TableHead sx={{ bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(248, 250, 252, 1)' }}>
                                        <TableRow>
                                            <TableCell><Typography variant="subtitle2" fontWeight="800" color="text.secondary" sx={{ textTransform: 'uppercase' }}>Szervezet Tagja</Typography></TableCell>
                                            <TableCell><Typography variant="subtitle2" fontWeight="800" color="text.secondary" sx={{ textTransform: 'uppercase' }}>Szerepkör</Typography></TableCell>
                                            <TableCell width="30%"><Typography variant="subtitle2" fontWeight="800" color="text.secondary" sx={{ textTransform: 'uppercase' }}>Jogosultságok</Typography></TableCell>
                                            <TableCell width="25%"><Typography variant="subtitle2" fontWeight="800" color="text.secondary" sx={{ textTransform: 'uppercase' }}>Kezelt Területek</Typography></TableCell>
                                            <TableCell align="center"><Typography variant="subtitle2" fontWeight="800" color="text.secondary" sx={{ textTransform: 'uppercase' }}>Művelet</Typography></TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {paginatedTeam.map(member => {
                                            const permLabels = member.permissions.map(p => AVAILABLE_PERMISSIONS.find(ap => ap.value === p)?.label || p);
                                            const areaLabels = member.coordinatedWorkAreaIds.map(areaId => ` ${event.workAreas.find(wa => wa.id === areaId)?.name || 'Ismeretlen'}`);

                                            const rColorName = getRoleColor(member);
                                            const rColorHex = getColorHex(rColorName);
                                            const uPhone = member.phoneNumber || 'Nincs adat';
                                            const isUneditable = Boolean(member.isSysAdmin) || member.orgRole === 'OWNER' || member.orgRole === 'ORGANIZER';

                                            return (
                                                <TableRow
                                                    key={member.userId}
                                                    sx={{
                                                        bgcolor: (member.eventRole || isUneditable) ? alpha(rColorHex, isDarkMode ? 0.05 : 0.02) : 'transparent',
                                                        transition: 'background-color 0.2s',
                                                        '&:hover': { bgcolor: alpha(rColorHex, isDarkMode ? 0.1 : 0.05) }
                                                    }}
                                                >
                                                    <TableCell>
                                                        <Box display="flex" alignItems="center" gap={2}>
                                                            <Avatar
                                                                src={getAvatarUrl(member.profileImageUrl)}
                                                                sx={{ bgcolor: (member.eventRole || isUneditable) ? rColorHex : (isDarkMode ? 'grey.800' : 'grey.200'), color: (member.eventRole || isUneditable) ? 'white' : 'text.primary', width: 40, height: 40, fontWeight: 'bold' }}
                                                            >
                                                                {member.userName.charAt(0).toUpperCase()}
                                                            </Avatar>
                                                            <Box>
                                                                <Typography fontWeight="900" color="text.primary">{member.userName}</Typography>
                                                                <Typography variant="body2" color="text.secondary">{member.userEmail}</Typography>
                                                                <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                                                                    <PhoneIcon fontSize="inherit"/> {uPhone}
                                                                </Typography>
                                                            </Box>
                                                        </Box>
                                                    </TableCell>

                                                    <TableCell>
                                                        {renderRoleBadge(member)}
                                                    </TableCell>

                                                    <TableCell>
                                                        {(member.eventRole === 'ORGANIZER' || isUneditable) ? (
                                                            <Typography variant="caption" sx={{ color: isDarkMode ? '#f9a8d4' : 'secondary.main', fontWeight: 'bold' }}>Minden jogosultság</Typography>
                                                        ) : member.eventRole === 'COORDINATOR' ? (
                                                            renderChipGroup(permLabels, `${member.userName} - Jogosultságok`, 'default', 2)
                                                        ) : (
                                                            <Typography variant="caption" color="text.secondary">-</Typography>
                                                        )}
                                                    </TableCell>

                                                    <TableCell>
                                                        {(member.eventRole === 'ORGANIZER' || isUneditable) ? (
                                                            <Typography variant="caption" sx={{ color: isDarkMode ? '#f9a8d4' : 'secondary.main', fontWeight: 'bold' }}>Minden terület</Typography>
                                                        ) : member.eventRole === 'COORDINATOR' ? (
                                                            renderChipGroup(areaLabels, `${member.userName} - Kezelt Területek`, 'primary', 2)
                                                        ) : (
                                                            <Typography variant="caption" color="text.secondary">-</Typography>
                                                        )}
                                                    </TableCell>

                                                    <TableCell align="center">
                                                        <Tooltip title={isUneditable ? "Globális / Szervezeti vezetők jogait itt nem lehet csökkenteni." : ""}>
                                                            <span>
                                                                <Button
                                                                    variant={member.eventRole ? "contained" : "outlined"}
                                                                    color={rColorName === 'default' ? 'primary' : rColorName}
                                                                    size="small" startIcon={<EditIcon />}
                                                                    onClick={() => handleOpenEdit(member)}
                                                                    disabled={isUneditable}
                                                                    sx={{ borderRadius: 2, fontWeight: 'bold', boxShadow: 'none' }}
                                                                >
                                                                    {isUneditable ? 'Fix Jog.' : 'Szerkesztés'}
                                                                </Button>
                                                            </span>
                                                        </Tooltip>
                                                    </TableCell>
                                                </TableRow>
                                            )})}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}

                        {totalPages > 1 && (
                            <Box display="flex" justifyContent="center" mt={5}>
                                <Pagination count={totalPages} page={page} onChange={(_, value) => setPage(value)} color="primary" size={isMobile ? "small" : "medium"} />
                            </Box>
                        )}
                    </Box>
                )}

                {/* MODALOK RÉSZE VÁLTOZATLAN MARAD, KIVÉVE A SZÍNEKET EGY PICSIT */}
                <Dialog
                    open={detailsModalOpen} onClose={() => setDetailsModalOpen(false)} maxWidth="xs" fullWidth
                    PaperProps={{
                        sx: {
                            borderRadius: 4, m: { xs: 2, sm: 3 },
                            bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                            backdropFilter: 'blur(20px)',
                            border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'transparent'
                        }
                    }}
                >
                    <DialogTitle sx={{ fontWeight: '900', color: 'text.primary', borderBottom: '1px solid', borderColor: 'divider', pb: 2 }}>
                        {detailsModalTitle}
                    </DialogTitle>
                    <DialogContent sx={{ mt: 2, p: { xs: 2, sm: 3 } }}>
                        <Box display="flex" flexDirection="column" gap={1.5}>
                            {detailsModalItems.map((item, idx) => (
                                <Box key={idx} sx={{ p: 1.5, borderRadius: 2, bgcolor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f8fafc', border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider' }}>
                                    <Typography variant="body2" fontWeight="bold">{item}</Typography>
                                </Box>
                            ))}
                        </Box>
                    </DialogContent>
                    <DialogActions sx={{ p: 2, px: 3 }}>
                        <Button onClick={() => setDetailsModalOpen(false)} variant="contained" color="primary" disableElevation sx={{ borderRadius: 2, fontWeight: 'bold' }}>Bezárás</Button>
                    </DialogActions>
                </Dialog>

                <Dialog
                    open={editModalOpen} onClose={() => !saving && setEditModalOpen(false)} maxWidth="sm" fullWidth
                    PaperProps={{
                        sx: {
                            m: { xs: 2, sm: 3 }, borderRadius: 4,
                            bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                            backdropFilter: 'blur(20px)',
                            border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'transparent'
                        }
                    }}
                >
                    <DialogTitle sx={{
                        background: isDarkMode ? 'linear-gradient(135deg, #3730a3 0%, #312e81 100%)' : 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                        color: 'white', fontWeight: '900', fontSize: { xs: '1.1rem', sm: '1.25rem' }
                    }}>
                        {editingName} kinevezése
                    </DialogTitle>
                    <DialogContent sx={{ mt: 2, p: { xs: 2, sm: 3 } }}>
                        <FormControl fullWidth sx={{ mt: 1, mb: 4 }}>
                            <InputLabel id="event-role-label">Esemény Szerepkör</InputLabel>
                            <Select
                                labelId="event-role-label" label="Esemény Szerepkör" value={draftRole} onChange={(e) => setDraftRole(e.target.value)}
                                sx={{ borderRadius: 2, bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'white' }}
                            >
                                <MenuItem value="NONE"><Typography fontWeight={draftRole === 'NONE' ? 'bold' : 'normal'}>Sima Önkéntes (Nincs szervezői joga)</Typography></MenuItem>
                                <MenuItem value="COORDINATOR"><Typography fontWeight={draftRole === 'COORDINATOR' ? 'bold' : 'normal'} color="info.main">Koordinátor (Korlátozott jogok)</Typography></MenuItem>
                                <MenuItem value="ORGANIZER"><Typography fontWeight={draftRole === 'ORGANIZER' ? 'bold' : 'normal'} color="secondary.main">Főszervező (Mindenhez van joga)</Typography></MenuItem>
                            </Select>
                        </FormControl>

                        {draftRole === 'COORDINATOR' && (
                            <Box sx={{
                                p: { xs: 2, sm: 3 }, borderRadius: 3,
                                bgcolor: isDarkMode ? 'rgba(56, 189, 248, 0.05)' : '#f0f9ff',
                                border: '1px solid', borderColor: isDarkMode ? 'rgba(56, 189, 248, 0.2)' : '#bae6fd'
                            }}>
                                <Typography variant="subtitle2" color={isDarkMode ? '#38bdf8' : 'info.main'} fontWeight="900" mb={1} sx={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Globális Jogosultságok
                                </Typography>
                                <FormGroup sx={{ mb: 4 }}>
                                    {AVAILABLE_PERMISSIONS.map(perm => (
                                        <FormControlLabel
                                            key={perm.value}
                                            control={<Checkbox size="small" checked={draftPermissions.includes(perm.value)} onChange={() => handlePermissionToggle(perm.value)} color="info" />}
                                            label={<Typography variant="body2" fontWeight="500">{perm.label}</Typography>}
                                        />
                                    ))}
                                </FormGroup>

                                <Divider sx={{ my: 3, borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#bae6fd' }} />

                                <Typography variant="subtitle2" color={isDarkMode ? '#38bdf8' : 'info.main'} fontWeight="900" mb={2} sx={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Kezelt Munkaterületek
                                </Typography>
                                <FormControl fullWidth size="small">
                                    <InputLabel id="areas-select-label">Munkaterületek kijelölése</InputLabel>
                                    <Select
                                        labelId="areas-select-label"
                                        multiple
                                        label="Munkaterületek kijelölése"
                                        value={draftAreas}
                                        onChange={(e) => setDraftAreas(typeof e.target.value === 'string' ? e.target.value.split(',').map(Number) : e.target.value as number[])}
                                        sx={{ borderRadius: 2, bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'white' }}
                                        renderValue={(selected) => (
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                {selected.map((value) => {
                                                    const areaName = event.workAreas.find(wa => wa.id === value)?.name;
                                                    return <Chip key={value} label={areaName} size="small" color="info" variant="outlined" />;
                                                })}
                                            </Box>
                                        )}
                                    >
                                        {event.workAreas.map((area) => (
                                            <MenuItem key={area.id} value={area.id}>
                                                <Checkbox checked={draftAreas.includes(area.id)} size="small" color="info" />
                                                <Typography variant="body2" fontWeight="500">{area.name}</Typography>
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Box>
                        )}

                        {draftRole === 'ORGANIZER' && (
                            <Alert severity="info" sx={{ mt: 2, borderRadius: 2, bgcolor: isDarkMode ? 'rgba(192, 132, 252, 0.1)' : '#f3e8ff', color: isDarkMode ? '#e879f9' : 'secondary.dark', '& .MuiAlert-icon': { color: 'inherit' } }}>
                                A Főszervező automatikusan minden Munkaterülethez és funkcióhoz (Jelentkezések, Naptár) teljes hozzáférést kap, ezzel tehermentesítve téged!
                            </Alert>
                        )}
                    </DialogContent>
                    <DialogActions sx={{ p: { xs: 2, sm: 3 }, bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : '#f8fafc', borderTop: '1px solid', borderColor: 'divider' }}>
                        <Button onClick={() => setEditModalOpen(false)} color="inherit" disabled={saving} sx={{ fontWeight: 'bold' }}>Mégse</Button>
                        <Button onClick={handleSave} variant="contained" color="primary" disabled={saving} sx={{ borderRadius: 2, fontWeight: 'bold', px: 3 }} disableElevation>
                            {saving ? 'Mentés...' : 'Jogosultságok Mentése'}
                        </Button>
                    </DialogActions>
                </Dialog>
            </Container>
        </Fade>
    );
}