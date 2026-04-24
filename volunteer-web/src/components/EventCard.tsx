import {
    Card, CardContent, Typography, Box,
    Chip, LinearProgress, CardActionArea, useTheme
} from '@mui/material';
import {
    Business as BusinessIcon,
    LocationOn as LocationOnIcon,
    CalendarToday as CalendarTodayIcon,
    People as PeopleIcon,
    Security as SecurityIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

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
    bannerUrl?: string;
    shifts: Shift[];
    organization?: {
        name: string;
    };
}

interface EventCardProps {
    event: Event;
    isLeader: boolean;
    onClick?: () => void;
}

export default function EventCard({ event, isLeader, onClick }: EventCardProps) {
    const navigate = useNavigate();
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';

    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString('hu-HU', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    const getBannerUrl = (url?: string) => {
        if (!url) return undefined;
        const backendBaseUrl = 'http://localhost:8081';
        return url.startsWith('http') ? url : `${backendBaseUrl}${url}`;
    };

    const totalMax = event.shifts?.reduce((sum, s) => sum + (s.maxVolunteers || 0), 0) || 0;
    const totalCurrent = event.shifts?.reduce((sum, s) => sum + (s.currentVolunteers || 0), 0) || 0;
    const isFull = totalMax > 0 && totalCurrent >= totalMax;

    return (
        <Card
            elevation={0}
            sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.25s ease-in-out',
                position: 'relative',
                borderRadius: 1.5, // 12px - Felnőttebb megjelenés
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                overflow: 'hidden',
                '&:hover': {
                    boxShadow: isDarkMode ? '0 8px 24px rgba(0,0,0,0.5)' : '0 8px 24px rgba(0,0,0,0.08)',
                    transform: 'translateY(-4px)',
                    borderColor: 'primary.main'
                }
            }}
        >
            <CardActionArea
                onClick={() => onClick ? onClick() : navigate(`/events/${event.id}`)}
                sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
            >
                {/* --- LEBEGŐ PLECSNIK --- */}
                <Box sx={{ position: 'absolute', top: 10, right: 10, zIndex: 2, display: 'flex', gap: 1 }}>
                    {isLeader && !isFull && (
                        <Chip
                            icon={<SecurityIcon fontSize="small" style={{ color: 'inherit' }} />}
                            label="Kezelés"
                            size="small"
                            sx={{
                                bgcolor: isDarkMode ? 'primary.main' : 'white',
                                color: isDarkMode ? 'white' : 'primary.main',
                                fontWeight: 'bold',
                                fontSize: '0.7rem',
                                boxShadow: 2,
                                border: isDarkMode ? 'none' : '1px solid',
                                borderColor: 'primary.light'
                            }}
                        />
                    )}
                    {isFull && (
                        <Chip
                            label="BETELT"
                            color="error"
                            size="small"
                            sx={{ fontWeight: '900', fontSize: '0.7rem', boxShadow: 2 }}
                        />
                    )}
                </Box>

                {/* --- BORÍTÓKÉP (BANNER) --- */}
                <Box
                    sx={{
                        height: 130,
                        width: '100%',
                        bgcolor: 'action.hover',
                        backgroundImage: event.bannerUrl
                            ? `url(${getBannerUrl(event.bannerUrl)})`
                            : `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        flexShrink: 0,
                        position: 'relative',
                        '&::after': { // Egy enyhe sötétítés a kép tetejére, hogy a plecsnik jobban látszódjanak
                            content: '""',
                            position: 'absolute',
                            top: 0, left: 0, right: 0, bottom: 0,
                            background: 'linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, transparent 40%)'
                        }
                    }}
                />

                {/* --- TARTALOM --- */}
                <CardContent sx={{ flexGrow: 1, pt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {event.organization && (
                        <Typography
                            variant="caption"
                            color="primary.main"
                            sx={{
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                letterSpacing: 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5
                            }}
                        >
                            <BusinessIcon sx={{ fontSize: 14 }} />
                            {event.organization.name}
                        </Typography>
                    )}

                    <Typography variant="h6" fontWeight="800" color="text.primary" sx={{ lineHeight: 1.2, mb: 0.5 }}>
                        {event.title}
                    </Typography>

                    <Box display="flex" alignItems="center" color="text.secondary">
                        <LocationOnIcon sx={{ fontSize: 16, mr: 0.5, color: 'primary.light' }} />
                        <Typography variant="body2" noWrap>{event.location}</Typography>
                    </Box>

                    {event.shifts && event.shifts.length > 0 && (
                        <Box display="flex" alignItems="center" flexWrap="wrap" gap={1} my={1}>
                            <Chip
                                icon={<CalendarTodayIcon fontSize="small" />}
                                label={formatDate(event.shifts[0].startTime)}
                                size="small"
                                sx={{ bgcolor: 'action.hover', color: 'text.primary', fontSize: '0.75rem' }}
                            />
                            <Chip
                                icon={<PeopleIcon fontSize="small" />}
                                label={`${totalMax} hely`}
                                size="small"
                                variant={isFull ? "filled" : "outlined"}
                                color={isFull ? "error" : "primary"}
                                sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}
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
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            lineHeight: 1.5,
                            flexGrow: 1
                        }}
                    >
                        {event.description}
                    </Typography>

                    {/* --- TELÍTETTSÉG SÁV --- */}
                    {totalMax > 0 && (
                        <Box sx={{ mt: 1 }}>
                            <Box display="flex" justifyContent="space-between" mb={0.5}>
                                <Typography variant="caption" color="text.secondary" fontWeight="600">Telítettség</Typography>
                                <Typography variant="caption" fontWeight="800" color={isFull ? 'error.main' : 'primary.main'}>
                                    {totalCurrent} / {totalMax}
                                </Typography>
                            </Box>
                            <LinearProgress
                                variant="determinate"
                                value={Math.min((totalCurrent / totalMax) * 100, 100)}
                                color={isFull ? "error" : "primary"}
                                sx={{
                                    height: 6,
                                    borderRadius: 3,
                                    bgcolor: 'divider',
                                    '& .MuiLinearProgress-bar': { borderRadius: 3 }
                                }}
                            />
                        </Box>
                    )}
                </CardContent>
            </CardActionArea>
        </Card>
    );
}