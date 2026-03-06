import {
    Card, CardContent, CardActions, Typography, Box,
    Button, Chip, Divider, LinearProgress
} from '@mui/material';
import {
    Business as BusinessIcon,
    LocationOn as LocationOnIcon,
    CalendarToday as CalendarTodayIcon,
    People as PeopleIcon,
    Group as GroupIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import AccessTimeIcon from "@mui/icons-material/AccessTime";

// --- INTERFÉSZEK ---
interface Shift {
    id: number;
    startTime: string;
    endTime: string;
    maxVolunteers: number;
    currentVolunteers?: number;
}

interface Event {
    id: number;
    title: string;
    description: string;
    location: string;
    shifts: Shift[];
    organization?: {
        name: string;
    };
}

interface EventCardProps {
    event: Event;
    isLeader: boolean;
    canManageApplications: boolean;
}

export default function EventCard({ event, isLeader, canManageApplications }: EventCardProps) {
    const navigate = useNavigate();

    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString('hu-HU', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    // Összesített létszám számítása az eseményhez
    const totalMax = event.shifts?.reduce((sum, s) => sum + (s.maxVolunteers || 0), 0) || 0;
    const totalCurrent = event.shifts?.reduce((sum, s) => sum + (s.currentVolunteers || 0), 0) || 0;
    const isFull = totalMax > 0 && totalCurrent >= totalMax;

    return (
        <Card
            elevation={2}
            sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: '0.3s',
                position: 'relative',
                borderRadius: 3, // Kicsit modernebb, kerekebb sarkok
                '&:hover': { boxShadow: 6, transform: 'translateY(-4px)' }
            }}
        >
            {isFull && (
                <Chip
                    label="BETELT"
                    color="error"
                    size="small"
                    sx={{ position: 'absolute', top: 12, right: 12, fontWeight: 'bold', zIndex: 1, boxShadow: 2 }}
                />
            )}

            <CardContent sx={{ flexGrow: 1, pt: 3 }}>
                {event.organization && (
                    <Box display="flex" alignItems="center" mb={1.5}>
                        <BusinessIcon sx={{ fontSize: 18, mr: 0.5, color: 'primary.main' }} />
                        <Typography variant="caption" fontWeight="bold" color="primary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            {event.organization.name}
                        </Typography>
                    </Box>
                )}

                <Typography variant="h6" component="div" gutterBottom fontWeight="900" sx={{ lineHeight: 1.2 }}>
                    {event.title}
                </Typography>

                <Box display="flex" alignItems="center" color="text.secondary" mb={2}>
                    <LocationOnIcon sx={{ fontSize: 18, mr: 0.5 }} />
                    <Typography variant="body2">{event.location}</Typography>
                </Box>

                {event.shifts && event.shifts.length > 0 && (
                    <Box display="flex" alignItems="center" flexWrap="wrap" gap={1} mb={2.5}>
                        <Chip
                            icon={<CalendarTodayIcon fontSize="small" />}
                            label={formatDate(event.shifts[0].startTime)}
                            size="small"
                            sx={{ bgcolor: '#f4f6f8', fontWeight: 500 }}
                        />
                        <Chip
                            icon={<PeopleIcon fontSize="small" />}
                            label={`${totalMax} férőhely`}
                            size="small"
                            variant={isFull ? "filled" : "outlined"}
                            color={isFull ? "error" : "primary"}
                            sx={{ fontWeight: 'bold' }}
                        />
                    </Box>
                )}

                <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        mb: 3
                    }}
                >
                    {event.description}
                </Typography>

                {/* Kapacitás jelző csík (ProgressBar) */}
                {totalMax > 0 && (
                    <Box sx={{ mt: 'auto' }}>
                        <Box display="flex" justifyContent="space-between" mb={0.5}>
                            <Typography variant="caption" color="text.secondary" fontWeight="500">Telítettség</Typography>
                            <Typography variant="caption" fontWeight="bold" color={isFull ? 'error.main' : 'text.primary'}>
                                {totalCurrent} / {totalMax}
                            </Typography>
                        </Box>
                        <LinearProgress
                            variant="determinate"
                            value={Math.min((totalCurrent / totalMax) * 100, 100)}
                            color={isFull ? "error" : "primary"}
                            sx={{ height: 8, borderRadius: 4, bgcolor: '#edf2f7' }}
                        />
                    </Box>
                )}
            </CardContent>

            <Divider />

            {/* JAVÍTOTT GOMBSOR: Eltünteti a CardActions okozta elcsúszást */}
            <CardActions sx={{ p: 2, bgcolor: '#fbfbfb' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2, width: '100%' }}>
                    <Button
                        fullWidth
                        variant="contained"
                        onClick={() => navigate(`/events/${event.id}`)}
                        sx={{ borderRadius: 2, py: 1, fontWeight: 'bold', textTransform: 'none', fontSize: '0.95rem' }}
                    >
                        Részletek
                    </Button>

                    {isLeader && (
                        <Button
                            color="warning"
                            variant="outlined"
                            fullWidth
                            onClick={() => navigate(`/edit-event/${event.id}`)}
                            sx={{
                                borderRadius: 2,
                                py: 1,
                                fontWeight: 'bold',
                                textTransform: 'none',
                                fontSize: '0.95rem',
                                borderWidth: 2,
                                '&:hover': { borderWidth: 2 }
                            }}
                        >
                            Szerkesztés
                        </Button>
                    )}

                    {/* --- ÚJ GOMB: BEOSZTÁS KEZELÉSE --- */}
                    {canManageApplications && (
                        <Button
                            color="primary"
                            variant="outlined"
                            fullWidth
                            startIcon={<AccessTimeIcon />} // Ne felejtsd el importálni az AccessTime ikont!
                            onClick={() => navigate(`/events/${event.id}/shifts`)}
                            sx={{ borderRadius: 2, py: 1, fontWeight: 'bold', textTransform: 'none', borderWidth: 2 }}
                        >
                            Beosztás készítése
                        </Button>
                    )}

                    {canManageApplications && (
                        <Button
                            color="secondary"
                            variant="text"
                            fullWidth
                            startIcon={<GroupIcon />}
                            onClick={() => navigate(`/events/${event.id}/applications`)}
                            sx={{ borderRadius: 2, py: 1, fontWeight: 'bold', textTransform: 'none', fontSize: '0.95rem' }}
                        >
                            Jelentkezők
                        </Button>
                    )}
                </Box>
            </CardActions>
        </Card>
    );
}