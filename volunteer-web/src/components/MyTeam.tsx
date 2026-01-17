import { useEffect, useState } from 'react';
import {
    Container, Typography, Box, Paper, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Button, CircularProgress,
    Select, MenuItem, FormControl, Chip
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { isAxiosError } from 'axios';

interface User {
    id: number;
    username: string;
    email: string;
    role: string;
}

// SZÓTÁR
const roleLabels: { [key: string]: string } = {
    VOLUNTEER: "Önkéntes",
    COORDINATOR: "Koordinátor",
    ORGANIZER: "Szervező",
    SYS_ADMIN: "Rendszergazda"
};

// SZÍNKÓDOK
const roleColors: { [key: string]: "success" | "info" | "warning" | "error" | "default" } = {
    VOLUNTEER: "success",
    COORDINATOR: "info",
    ORGANIZER: "warning",
    SYS_ADMIN: "error"
};

export default function MyTeam() {
    const [users, setUsers] = useState<User[]>([]);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const navigate = useNavigate();

    // --- 1. JOGOSULTSÁG ELLENŐRZÉS ÉS ADATLEKÉRÉS ---
    useEffect(() => {
        const verifyAccessAndFetch = async () => {
            try {
                setLoading(true);

                // A. Megnézzük, KI próbál belépni
                const meResponse = await api.get('/users/me');
                const myRole = meResponse.data.role;

                // Beállítjuk a currentUsert
                setCurrentUser(meResponse.data);

                // B. VÉDELEM: Ha NEM Rendszergazda és NEM Szervező...
                if (myRole !== 'SYS_ADMIN' && myRole !== 'ORGANIZER') {
                    // ...visszadobjuk a főoldalra.
                    // (alert-et kiveheted, ha zavaró)
                    // alert("Nincs jogosultságod megtekinteni ezt az oldalt!");
                    navigate('/events');
                    return; // MEGÁLLÍTJUK a futást!
                }

                // C. Ha jogosult, lekérjük a csapatot
                const usersResponse = await api.get('/users');
                const dataToSet = Array.isArray(usersResponse.data) ? usersResponse.data : (usersResponse.data.content || []);
                setUsers(dataToSet);

            } catch (error) {
                console.error("Hiba az oldal betöltésekor:", error);
                navigate('/'); // Hiba esetén is biztonságosabb kidobni
            } finally {
                setLoading(false);
            }
        };

        verifyAccessAndFetch();
    }, [navigate]);

    // --- 2. SZEREPKÖR MÓDOSÍTÁS (ESLint FIX) ---
    const handleRoleChange = async (userId: number, newRole: string) => {
        try {
            await api.put(`/users/${userId}/role`, null, { params: { newRole } });

            setUsers(prevUsers => prevUsers.map(user =>
                user.id === userId ? { ...user, role: newRole } : user
            ));
        } catch (error) {
            console.error("Hiba:", error);

            let errorMessage = "Hiba történt a mentés során.";

            if (isAxiosError(error)) {
                const data = error.response?.data;

                // --- ESLINT FIX ITT ---
                // Az 'any' helyett pontos típust adunk meg: { message: string }
                if (data && typeof data === 'object' && 'message' in data) {
                    errorMessage = (data as { message: string }).message;
                } else if (typeof data === 'string') {
                    errorMessage = data;
                }
                // ----------------------

            } else if (error instanceof Error) {
                errorMessage = error.message;
            }

            // Tisztítás (RegEx)
            errorMessage = errorMessage.replace(/^\d{3}\s+[A-Z_]+\s+/, '');
            errorMessage = errorMessage.replace(/^"(.*)"$/, '$1');

            alert("HIBA: " + errorMessage);

            // Ha hiba volt, frissítjük az oldalt, hogy visszaálljanak a helyes értékek
            window.location.reload();
        }
    };

    const canAssignSysAdmin = currentUser?.role === 'SYS_ADMIN';

    return (
        <Container sx={{ mt: 4 }}>
            <Box display="flex" alignItems="center" mb={4}>
                <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/dashboard')} sx={{ mr: 2 }} variant="outlined">
                    Vissza a Dashboardra
                </Button>
                <Typography variant="h4">Csapat Kezelése</Typography>
            </Box>

            {loading ? (
                <Box display="flex" justifyContent="center"><CircularProgress /></Box>
            ) : (
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                                <TableCell><strong>ID</strong></TableCell>
                                <TableCell><strong>Név</strong></TableCell>
                                <TableCell><strong>Email</strong></TableCell>
                                <TableCell width="250px"><strong>Szerepkör</strong></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {users.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell>{user.id}</TableCell>
                                    <TableCell>{user.username}</TableCell>
                                    <TableCell>{user.email}</TableCell>
                                    <TableCell>
                                        <FormControl size="small" fullWidth>
                                            <Select
                                                value={user.role}
                                                onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                                variant="standard"
                                                disableUnderline
                                                renderValue={(selected) => (
                                                    <Chip
                                                        label={roleLabels[selected] || selected}
                                                        color={roleColors[selected] || "default"}
                                                        size="small"
                                                        sx={{ fontWeight: 'bold' }}
                                                    />
                                                )}
                                            >
                                                <MenuItem value="VOLUNTEER">Önkéntes</MenuItem>
                                                <MenuItem value="COORDINATOR">Koordinátor</MenuItem>
                                                <MenuItem value="ORGANIZER">Szervező</MenuItem>

                                                {canAssignSysAdmin && (
                                                    <MenuItem value="SYS_ADMIN" sx={{ color: 'error.main' }}>
                                                        Rendszergazda ⚠️
                                                    </MenuItem>
                                                )}

                                            </Select>
                                        </FormControl>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Container>
    );
}