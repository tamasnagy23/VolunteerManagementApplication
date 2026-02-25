import { useEffect, useState } from 'react';
import {
    Container, Typography, Button, Box,
    CircularProgress, Divider, Paper, Alert
} from '@mui/material';
import api from '../api/axios';
import { useNavigate } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import GroupIcon from '@mui/icons-material/Group';
import EventCard from "./EventCard";

// --- INTERFÉSZEK ---
interface Shift {
    id: number;
    startTime: string;
    endTime: string;
    maxVolunteers: number;
}

interface Event {
    id: number;
    title: string;
    description: string;
    location: string;
    shifts: Shift[];
    organization?: {
        id: number;
        name: string;
    };
}

interface UserProfile {
    name: string;
    role: string;
    memberships: {
        orgId?: number;                // A DTO ezt küldi
        orgName?: string;              // A DTO ezt küldi
        orgRole?: string;              // <--- A DTO EZT KÜLDI (Ez hiányzott!)
        organization?: { id: number; name: string }; // Megtartjuk a biztonság kedvéért
        role?: string;                 // Régi mező
        status: string;
    }[];
}

export default function Dashboard() {
    const [events, setEvents] = useState<Event[]>([]);
    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const [eventsResponse, userResponse] = await Promise.all([
                    api.get('/events'),
                    api.get('/users/me')
                ]);
                const eventData = eventsResponse.data.content || eventsResponse.data || [];
                setEvents(eventData);
                setUser(userResponse.data);
            } catch (error) {
                console.error("Hiba az adatok betöltésekor:", error);
                setError('Nem sikerült betölteni az adatokat.');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Jogosultságok
    const isLeader = !!user && (user.role === 'SYS_ADMIN' ||
        user.memberships?.some(m =>
            ['OWNER', 'ORGANIZER'].includes(m.orgRole || m.role || '') &&
            m.status === 'APPROVED'
        ));

    const canManageApplications = !!user && (user.role === 'SYS_ADMIN' ||
        user.memberships?.some(m =>
            ['OWNER', 'ORGANIZER', 'COORDINATOR'].includes(m.orgRole || m.role || '') &&
            m.status === 'APPROVED'
        ));

    // --- CSOPORTOSÍTÓ LOGIKA ---
    const groupedEvents = events.reduce((acc, event) => {
        const orgName = event.organization?.name || 'Egyéb';
        if (!acc[orgName]) acc[orgName] = [];
        acc[orgName].push(event);
        return acc;
    }, {} as Record<string, Event[]>);

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
            <Box mb={4}>
                <Typography variant="h4" fontWeight="bold" gutterBottom>
                    Szia, {user?.name}! 👋
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    {isLeader
                        ? "Kezeld a szervezeted eseményeit és önkénteseit egy helyen."
                        : "Böngészd a szervezetid aktuális eseményeit!"}
                </Typography>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

            {/* --- VEZETŐI GOMBOK: Kikerültek a feltétel elé, mindig látszanak a vezetőnek --- */}
            {isLeader && (
                <Box display="flex" gap={2} mb={4}>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => navigate('/create-event')}
                        sx={{ borderRadius: 2, px: 3 }}
                    >
                        Új Esemény Létrehozása
                    </Button>
                    <Button
                        variant="outlined"
                        startIcon={<GroupIcon />}
                        onClick={() => navigate('/team')}
                        sx={{ borderRadius: 2, px: 3 }}
                    >
                        Csapat és Jelentkezők
                    </Button>
                </Box>
            )}

            <Divider sx={{ mb: 4 }} />

            {/* --- ESEMÉNYEK LISTÁZÁSA --- */}
            {events.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: 'center', bgcolor: '#f9f9f9', mt: 2 }}>
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                        {isLeader
                            ? "Még nem hoztál létre eseményt."
                            : "Még nincsenek itt események."}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {isLeader
                            ? "Kattints az 'Új Esemény' gombra a kezdéshez!"
                            : "Csatlakozz egy szervezethez a Szervezetek menüpontban, vagy várj a jóváhagyásra!"}
                    </Typography>
                </Paper>
            ) : (
                // Itt jön a csoportosított listázás (Object.entries(groupedEvents)...)
                Object.entries(groupedEvents).map(([orgName, orgEvents]) => (
                    <Box key={orgName} sx={{ mb: 6 }}>
                        <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold', borderBottom: '2px solid #1976d2', display: 'inline-block', pb: 1 }}>
                            {orgName}
                        </Typography>

                        <Box
                            display="grid"
                            gridTemplateColumns={{ xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }}
                            gap={3}
                        >
                            {orgEvents.map((event) => (
                                <EventCard
                                    key={event.id}
                                    event={event}
                                    isLeader={isLeader}
                                    canManageApplications={canManageApplications}
                                />
                            ))}
                        </Box>
                    </Box>
                ))
            )}
        </Container>
    );
}