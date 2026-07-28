import React, { useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Button, Alert, CircularProgress, Box, Typography, useTheme, Grid
} from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import api from '../api/axios';
import axios from 'axios';

interface CreateOrganizationModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function CreateOrganizationModal({ open, onClose, onSuccess }: CreateOrganizationModalProps) {
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        email: '',
        phone: '',
        address: '',
        cui: ''
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleInitialSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        executeSubmit();
    };

    const executeSubmit = async (forceCreateNew?: boolean) => {
        setError('');

        if (!formData.name.trim()) {
            setError('A szervezet neve kötelező!');
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('/organizations', formData, {
                params: forceCreateNew !== undefined ? { forceCreateNew } : {}
            });

            const { organization, token } = response.data;

            if (organization && organization.id) {
                localStorage.setItem('activeOrgId', organization.id.toString());
            }

            if (token) {
                localStorage.setItem('token', token);
            }

            // =========================================================================
            // JAVÍTÁS: Frissítjük a memóriában lévő user objektumot is, majd szólunk a Layoutnak!
            // =========================================================================
            try {
                const userRes = await api.get('/users/me');
                localStorage.setItem('user', JSON.stringify(userRes.data));
                window.dispatchEvent(new Event('userAvatarUpdated'));
            } catch (userErr) {
                console.error("Nem sikerült frissíteni a felhasználói profilt:", userErr);
            }
            // =========================================================================

            setRestoreDialogOpen(false);
            onSuccess();
            onClose();

            // A window.location.reload() már nem kell, mert a React state-ek és eventek lekezelik a frissítést!
        } catch (err: unknown) {
            console.error("Backend hiba történt:", err);

            setRestoreDialogOpen(false);

            let rawErrorString = "";
            if (axios.isAxiosError(err)) {
                const data = err.response?.data;
                rawErrorString = typeof data === 'string' ? data : JSON.stringify(data || {});
            } else {
                rawErrorString = String(err);
            }

            if (rawErrorString.includes('ORG_EXISTS_DELETED_OWNER')) {
                setRestoreDialogOpen(true);
            }
            else if (rawErrorString.includes('aktív szervezet már létezik')) {
                setError('Ilyen nevű aktív szervezet már létezik!');
            }
            else if (rawErrorString.includes('zárolás alatt áll')) {
                setError('Ez a szervezetnév jelenleg zárolás alatt áll (felülvizsgálati időszak).');
            }
            else {
                let displayMessage = 'Ismeretlen hiba történt a szervezet létrehozásakor.';
                if (axios.isAxiosError(err) && err.response?.data) {
                    const errorData = err.response.data;
                    displayMessage = errorData.message || errorData.error || displayMessage;

                    displayMessage = displayMessage.replace(/business error logic[\s.:]*/gi, '');
                    displayMessage = displayMessage.replace(/Üzleti hiba[\s.:]*/gi, '').trim();

                    if (displayMessage.length > 0) {
                        displayMessage = displayMessage.charAt(0).toUpperCase() + displayMessage.slice(1);
                    }
                }
                setError(displayMessage);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Dialog
                open={open}
                onClose={!loading ? onClose : undefined}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: 4,
                        bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.95)' : 'white',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid',
                        borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'transparent'
                    }
                }}
            >
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: '900', color: 'primary.main', pb: 1 }}>
                    <BusinessIcon fontSize="medium" /> Új Szervezet Alapítása
                </DialogTitle>

                <form onSubmit={handleInitialSubmit}>
                    <DialogContent>
                        <Typography variant="body2" color="text.secondary" mb={3}>
                            Hozd létre a saját csapatodat! A rendszer automatikusan legenerál egy biztonságos, dedikált adatbázist a szervezeted számára.
                        </Typography>

                        {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

                        <Box display="flex" flexDirection="column" gap={2.5}>
                            <TextField label="Szervezet Neve *" name="name" value={formData.name} onChange={handleChange} fullWidth disabled={loading} />

                            <Grid container spacing={2}>
                                <Grid size={{ xs: 12, sm: 6 }}>
                                    <TextField label="Hivatalos E-mail cím" name="email" type="email" value={formData.email} onChange={handleChange} fullWidth disabled={loading} />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6 }}>
                                    <TextField label="Adószám (CUI/CFI)" name="cui" value={formData.cui} onChange={handleChange} fullWidth disabled={loading} placeholder="pl. 12345678" />
                                </Grid>
                            </Grid>

                            <TextField label="Telefonszám" name="phone" value={formData.phone} onChange={handleChange} fullWidth disabled={loading} />
                            <TextField label="Cím / Székhely" name="address" value={formData.address} onChange={handleChange} fullWidth disabled={loading} />
                            <TextField label="Rövid leírás" name="description" value={formData.description} onChange={handleChange} fullWidth multiline rows={3} disabled={loading} />
                        </Box>
                    </DialogContent>

                    <DialogActions sx={{ p: 3, pt: 1 }}>
                        <Button onClick={onClose} disabled={loading} sx={{ fontWeight: 'bold', borderRadius: 2 }}>
                            Mégse
                        </Button>
                        <Button type="submit" variant="contained" color="primary" disabled={loading} startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null} sx={{ fontWeight: 'bold', borderRadius: 2, px: 4 }} disableElevation>
                            {loading ? 'Adatbázis építése...' : 'Létrehozás'}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>

            {/* ========================================================================= */}
            {/* DÖNTÉSHOZÓ (VISSZAÁLLÍTÁS) DIALÓGUS AZ ALAPÍTÓNAK */}
            {/* ========================================================================= */}
            <Dialog open={restoreDialogOpen} onClose={() => !loading && setRestoreDialogOpen(false)} PaperProps={{ sx: { borderRadius: 4, p: 1 } }}>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: '900', color: 'primary.main' }}>
                    <InfoOutlinedIcon /> Törölt Szervezet Felismerve
                </DialogTitle>
                <DialogContent>
                    <Typography color="text.secondary" mb={2}>
                        A rendszer észlelte, hogy korábban te voltál az alapítója egy <strong>"{formData.name}"</strong> nevű csapatnak, amelyet töröltél.
                    </Typography>
                    <Typography color="text.secondary">
                        Szeretnéd visszaállítani a régi csapatodat (a most beírt adatokkal frissítve), vagy egy teljesen új szervezetet akarsz indítani tiszta lappal?
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'stretch' }}>
                    <Button onClick={() => executeSubmit(false)} disabled={loading} variant="contained" color="primary" sx={{ borderRadius: 2, fontWeight: 'bold' }} disableElevation>
                        {loading ? 'Folyamatban...' : 'Régi Szervezet Visszaállítása'}
                    </Button>
                    <Button onClick={() => executeSubmit(true)} disabled={loading} variant="outlined" color="secondary" sx={{ borderRadius: 2, fontWeight: 'bold' }}>
                        Teljesen Új Létrehozása
                    </Button>
                    <Button onClick={() => setRestoreDialogOpen(false)} disabled={loading} color="inherit" sx={{ fontWeight: 'bold' }}>
                        Mégse
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}