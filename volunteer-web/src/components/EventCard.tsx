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

// --- INTERFÉSZEK ---
interface Shift {
    id: number;
    startTime: string;
    endTime: string;
    maxVolunteers: number;
    // Feltételezzük, hogy a backend küldi a jelenlegi létszámot is,
    // ha nem, ideiglenesen 0-val számolunk
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
                '&:hover': { boxShadow: 6, transform: 'translateY(-4px)' }
            }}
        >
            {isFull && (
                <Chip
                    label="BETELT"
                    color="error"
                    size="small"
                    sx={{ position: 'absolute', top: 10, right: 10, fontWeight: 'bold', zIndex: 1 }}
                />
            )}

            <CardContent sx={{ flexGrow: 1 }}>
                {event.organization && (
                    <Box display="flex" alignItems="center" mb={1}>
                        <BusinessIcon sx={{ fontSize: 16, mr: 0.5, color: 'primary.main' }} />
                        <Typography variant="caption" fontWeight="bold" color="primary" sx={{ textTransform: 'uppercase' }}>
                            {event.organization.name}
                        </Typography>
                    </Box>
                )}

                <Typography variant="h6" component="div" gutterBottom fontWeight="bold">
                    {event.title}
                </Typography>

                <Box display="flex" alignItems="center" color="text.secondary" mb={1}>
                    <LocationOnIcon sx={{ fontSize: 18, mr: 0.5 }} />
                    <Typography variant="body2">{event.location}</Typography>
                </Box>

                {event.shifts && event.shifts.length > 0 && (
                    <Box display="flex" alignItems="center" gap={1} mb={2}>
                        <Chip
                            icon={<CalendarTodayIcon />}
                            label={formatDate(event.shifts[0].startTime)}
                            size="small"
                            sx={{ bgcolor: '#f0f0f0' }}
                        />
                        <Chip
                            icon={<PeopleIcon />}
                            label={`${totalMax} férőhely`}
                            size="small"
                            variant="outlined"
                            color={isFull ? "error" : "primary"}
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
                        mb: 2
                    }}
                >
                    {event.description}
                </Typography>

                {/* Kapacitás jelző csík (ProgressBar) */}
                {totalMax > 0 && (
                    <Box sx={{ mt: 'auto' }}>
                        <Box display="flex" justifyContent="space-between" mb={0.5}>
                            <Typography variant="caption" color="text.secondary">Telítettség</Typography>
                            <Typography variant="caption" fontWeight="bold">
                                {totalCurrent} / {totalMax}
                            </Typography>
                        </Box>
                        <LinearProgress
                            variant="determinate"
                            value={Math.min((totalCurrent / totalMax) * 100, 100)}
                            sx={{ height: 6, borderRadius: 3, bgcolor: '#eee' }}
                        />
                    </Box>
                )}
            </CardContent>

            <Divider />

            <CardActions sx={{ p: 2, flexDirection: 'column', gap: 1 }}>
                <Button
                    fullWidth
                    variant="contained"
                    onClick={() => navigate(`/events/${event.id}`)}
                    sx={{ borderRadius: 1.5 }}
                >
                    Részletek
                </Button>

                {isLeader && (
                    <Button
                        color="warning"
                        variant="outlined"
                        fullWidth
                        onClick={() => navigate(`/edit-event/${event.id}`)}
                        sx={{ borderRadius: 1.5 }}
                    >
                        Szerkesztés
                    </Button>
                )}

                {canManageApplications && (
                    <Button
                        color="secondary"
                        variant="text"
                        fullWidth
                        startIcon={<GroupIcon />}
                        onClick={() => navigate(`/events/${event.id}/applications`)}
                        sx={{ borderRadius: 1.5 }}
                    >
                        Jelentkezők
                    </Button>
                )}
            </CardActions>
        </Card>
    );
}