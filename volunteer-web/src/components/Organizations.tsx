import { useEffect, useState } from 'react';
import {
    Container, Typography, Box, Card, CardContent, CardActions,
    Button, CircularProgress, Alert, Dialog, DialogTitle,
    DialogContent, DialogActions, Divider
} from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import InfoIcon from '@mui/icons-material/Info';
import api from '../api/axios';

// --- INTERFÉSZEK ---
interface Organization {
    id: number;
    name: string;
    address: string;
    description?: string; // Új mező
    email?: string;       // Új mező
    phone?: string;       // Új mező
}

interface UserProfile {
    memberships: {
        orgId?: number;                // <-- EZT ADD HOZZÁ (ha flat a DTO)
        organization?: { id: number }; // <-- Ez marad a biztonság kedvéért
        status: string;
    }[];
}

export default function Organizations() {
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [joiningId, setJoiningId] = useState<number | null>(null);

    // Állapot a felugró ablakhoz (melyik szervezet részleteit nézzük)
    const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [orgsRes, userRes] = await Promise.all([
                api.get<Organization[]>('/organizations'),
                api.get<UserProfile>('/users/me')
            ]);
            setOrganizations(orgsRes.data);
            setUser(userRes.data);
        } catch (err) {
            console.error(err);
            setError('Hiba történt az adatok betöltésekor.');
        } finally {
            setLoading(false);
        }
    };

    const handleJoin = async (orgId: number) => {
        try {
            setJoiningId(orgId);
            setError('');
            await api.post(`/organizations/${orgId}/join`);
            await fetchData();
        } catch (err: unknown) { // <--- any helyett unknown
            let errorMessage = 'Nem sikerült csatlakozni a szervezethez.';
            if (err && typeof err === 'object' && 'response' in err) {
                const axiosError = err as { response: { data: { message?: string } } };
                if (axiosError.response?.data?.message) {
                    errorMessage = axiosError.response.data.message;
                }
            }
            setError(errorMessage);
        } finally {
            setJoiningId(null);
        }
    };

    const getMembershipStatus = (orgId: number) => {
        const membership = user?.memberships?.find(m =>
            m.orgId === orgId || m.organization?.id === orgId
        );

        if (!membership) return 'NONE';
        return membership.status;
    };

    if (loading) return <Box display="flex" justifyContent="center" mt={10}><CircularProgress /></Box>;

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
            <Typography variant="h4" fontWeight="bold" gutterBottom color="primary">
                Szervezetek Katalógusa
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                Böngéssz a regisztrált szervezetek között, és csatlakozz ahhoz, amelyik a leginkább tetszik!
            </Typography>

            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

            <Box
                display="grid"
                gridTemplateColumns={{ xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }}
                gap={4}
            >
                {organizations.map((org) => {
                    const status = getMembershipStatus(org.id);

                    return (
                        <Box key={org.id} sx={{ height: '100%' }}>
                            <Card elevation={3} sx={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 3, transition: '0.3s', '&:hover': { transform: 'translateY(-5px)', boxShadow: 6 } }}>
                                <CardContent sx={{ flexGrow: 1, textAlign: 'center', pt: 4 }}>
                                    <Box display="flex" justifyContent="center" mb={2}>
                                        <BusinessIcon sx={{ fontSize: 60, color: '#1976d2', opacity: 0.8 }} />
                                    </Box>
                                    <Typography variant="h5" fontWeight="bold" gutterBottom>
                                        {org.name}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                        <LocationOnIcon sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} />
                                        {org.address}
                                    </Typography>
                                </CardContent>

                                {/* GOMBOK: Egymás alá rendezve (column) */}
                                <CardActions sx={{ p: 2, flexDirection: 'column', gap: 1.5, bgcolor: '#fbfbfb', borderTop: '1px solid #eee' }}>

                                    {/* 1. Státusz Gomb */}
                                    {status === 'NONE' && (
                                        <Button variant="contained" fullWidth onClick={() => handleJoin(org.id)} disabled={joiningId === org.id}>
                                            {joiningId === org.id ? <CircularProgress size={24} color="inherit" /> : 'Csatlakozom'}
                                        </Button>
                                    )}
                                    {status === 'PENDING' && (
                                        <Button variant="contained" fullWidth disabled sx={{ bgcolor: 'warning.light', color: 'warning.dark', '&.Mui-disabled': { bgcolor: '#ffe0b2', color: '#e65100' } }}>
                                            Jelentkezés elbírálás alatt
                                        </Button>
                                    )}
                                    {status === 'APPROVED' && (
                                        <Button variant="contained" fullWidth disabled sx={{ bgcolor: 'success.light', color: 'success.dark', '&.Mui-disabled': { bgcolor: '#c8e6c9', color: '#1b5e20' } }}>
                                            Már tag vagy
                                        </Button>
                                    )}
                                    {status === 'REJECTED' && (
                                        <Button variant="contained" fullWidth disabled sx={{ bgcolor: 'error.light', color: 'error.dark', '&.Mui-disabled': { bgcolor: '#ffcdd2', color: '#b71c1c' } }}>
                                            Elutasítva
                                        </Button>
                                    )}

                                    {/* 2. Részletek Gomb */}
                                    <Button
                                        variant="outlined"
                                        fullWidth
                                        startIcon={<InfoIcon />}
                                        onClick={() => setSelectedOrg(org)}
                                    >
                                        Részletek
                                    </Button>

                                </CardActions>
                            </Card>
                        </Box>
                    );
                })}
            </Box>

            {/* --- FELUGRÓ ABLAK A RÉSZLETEKHEZ --- */}
            <Dialog
                open={!!selectedOrg}
                onClose={() => setSelectedOrg(null)}
                maxWidth="sm"
                fullWidth
                PaperProps={{ sx: { borderRadius: 3 } }}
            >
                <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 'bold' }}>
                    {selectedOrg?.name}
                </DialogTitle>
                <DialogContent dividers sx={{ p: 3 }}>
                    <Box mb={3}>
                        <Typography variant="h6" fontWeight="bold" gutterBottom color="primary">
                            Rólunk
                        </Typography>
                        <Typography variant="body1" sx={{ textAlign: 'justify' }}>
                            {selectedOrg?.description || 'A szervezet még nem adott meg bővebb leírást magáról.'}
                        </Typography>
                    </Box>

                    <Divider sx={{ mb: 3 }} />

                    <Box mb={1} display="flex" alignItems="center" gap={1.5}>
                        <LocationOnIcon color="action" />
                        <Typography variant="body1"><strong>Székhely:</strong> {selectedOrg?.address || 'Nincs megadva'}</Typography>
                    </Box>

                    <Box mb={1} display="flex" alignItems="center" gap={1.5}>
                        <EmailIcon color="action" />
                        <Typography variant="body1"><strong>Email:</strong> {selectedOrg?.email || 'Nincs adat'}</Typography>
                    </Box>

                    <Box display="flex" alignItems="center" gap={1.5}>
                        <PhoneIcon color="action" />
                        <Typography variant="body1"><strong>Telefon:</strong> {selectedOrg?.phone || 'Nincs adat'}</Typography>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setSelectedOrg(null)} variant="contained" color="inherit" sx={{ fontWeight: 'bold' }}>
                        Bezárás
                    </Button>
                </DialogActions>
            </Dialog>

        </Container>
    );
}