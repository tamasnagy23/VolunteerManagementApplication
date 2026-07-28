import React, { useState, useRef, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, TextField, Box, Avatar, Typography, IconButton,
    CircularProgress, Badge, Tooltip, Alert, Grid, Divider, alpha
} from '@mui/material';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import BusinessIcon from '@mui/icons-material/Business';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import api from '../api/axios';
import axios from 'axios';

interface Organization {
    id: number;
    name: string;
    address: string;
    description?: string;
    email?: string;
    phone?: string;
    logoUrl?: string;
    cui?: string; // <-- ÚJ MEZŐ: Adószám (CUI)
}

interface Props {
    open: boolean;
    onClose: () => void;
    organization: Organization;
    onUpdateSuccess: () => void;
}

export default function OrganizationSettingsModal({ open, onClose, organization, onUpdateSuccess }: Props) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [savingDetails, setSavingDetails] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const [editForm, setEditForm] = useState<Organization>({ ...organization });

    // Törlés (Soft Delete) állapotok
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        if (open) {
            setEditForm({ ...organization });
            setError('');
            setSuccessMsg('');
            setDeleteModalOpen(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const getLogoUrl = () => {
        if (!editForm.logoUrl) return undefined;
        const backendBaseUrl = 'http://localhost:8081';
        return editForm.logoUrl.startsWith('http') ? editForm.logoUrl : `${backendBaseUrl}${editForm.logoUrl}`;
    };

    const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setError("Csak képfájlt tölthetsz fel!");
            return;
        }

        setUploadingImage(true);
        setError('');
        setSuccessMsg('');

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await api.post(`/organizations/${organization.id}/logo`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const newLogoUrl = `${response.data.imageUrl}?t=${new Date().getTime()}`;

            setEditForm(prev => ({ ...prev, logoUrl: newLogoUrl }));
            setSuccessMsg("Szervezeti logó sikeresen frissítve!");
            onUpdateSuccess();
        } catch {
            setError("Hiba történt a logó feltöltésekor.");
        } finally {
            setUploadingImage(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDeleteLogo = async () => {
        setUploadingImage(true);
        setError('');
        setSuccessMsg('');

        try {
            await api.delete(`/organizations/${organization.id}/logo`);
            setEditForm(prev => ({ ...prev, logoUrl: undefined }));
            setSuccessMsg("Logó sikeresen eltávolítva!");
            onUpdateSuccess();
        } catch {
            setError("Nem sikerült törölni a logót.");
        } finally {
            setUploadingImage(false);
        }
    };

    const handleSaveDetails = async () => {
        if (!editForm.name.trim() || !editForm.address.trim()) {
            setError("A név és a székhely kötelező mezők!");
            return;
        }

        setSavingDetails(true);
        setError('');
        setSuccessMsg('');

        try {
            await api.put(`/organizations/${organization.id}`, editForm);
            setSuccessMsg("Szervezeti adatok sikeresen mentve!");
            onUpdateSuccess();

            setTimeout(() => {
                onClose();
            }, 1500);
        } catch (err: unknown) {
            if (axios.isAxiosError(err)) setError(err.response?.data?.error || "Hiba a mentés során.");
            else setError("Váratlan hiba történt.");
        } finally {
            setSavingDetails(false);
        }
    };

    // =========================================================================
    // ÚJ: SZERVEZET TÖRLÉSE (SOFT DELETE) + FRONTEND SZINKRONIZÁCIÓ
    // =========================================================================
    const handleDeleteOrganization = async () => {
        setDeleting(true);
        try {
            const response = await api.delete(`/organizations/${organization.id}`);

            // 1. Lementjük a backendtől kapott frissített (jogok nélküli) tokent
            if (response.data && response.data.token) {
                localStorage.setItem('token', response.data.token);
            }

            // =====================================================================
            // 2. ITT A JAVÍTÁS: Lekérjük a profilod, hogy a menü tudja, már nem vagy vezető!
            // =====================================================================
            try {
                const userRes = await api.get('/users/me');
                localStorage.setItem('user', JSON.stringify(userRes.data));
                window.dispatchEvent(new Event('userAvatarUpdated'));
            } catch (userErr) {
                console.error("Nem sikerült frissíteni a felhasználói profilt:", userErr);
            }
            // =====================================================================

            // 3. Kiszedjük a memóriából az aktív szervezet azonosítóját
            localStorage.removeItem('activeOrgId');
            localStorage.removeItem('tenantId');

            // 4. Visszadobjuk a felhasználót a Dashboardra (az ablak újratöltésével)
            window.location.href = '/dashboard';
        } catch (err: unknown) {
            console.error(err);
            if (axios.isAxiosError(err)) {
                setError(err.response?.data?.error || err.response?.data?.message || 'Hiba történt a törlés során.');
            } else {
                setError('Ismeretlen hiba történt a törlés során.');
            }
            setDeleting(false);
            setDeleteModalOpen(false);
        }
    };

    return (
        <>
            <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
                <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 'bold' }}>
                    Szervezet Beállításai
                </DialogTitle>

                <DialogContent dividers sx={{ pb: 4 }}>
                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                    {successMsg && <Alert severity="success" sx={{ mb: 2 }}>{successMsg}</Alert>}

                    <Box display="flex" flexDirection="column" alignItems="center" mb={4} mt={2}>
                        <input
                            type="file" accept="image/*" ref={fileInputRef}
                            style={{ display: 'none' }} onChange={handleImageSelect}
                        />

                        <Box position="relative" display="inline-block">
                            <Badge
                                overlap="circular"
                                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                badgeContent={
                                    <Tooltip title="Logó módosítása">
                                        <IconButton
                                            sx={{ bgcolor: 'secondary.main', color: 'white', '&:hover': { bgcolor: 'secondary.dark' }, boxShadow: 2 }}
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={uploadingImage}
                                        >
                                            {uploadingImage ? <CircularProgress size={20} color="inherit" /> : <PhotoCameraIcon fontSize="small" />}
                                        </IconButton>
                                    </Tooltip>
                                }
                            >
                                <Avatar src={getLogoUrl()} sx={{ width: 100, height: 100, bgcolor: '#f0f0f0', color: 'primary.main', boxShadow: 3 }}>
                                    {!editForm.logoUrl && <BusinessIcon sx={{ fontSize: 50 }} />}
                                </Avatar>
                            </Badge>

                            {editForm.logoUrl && (
                                <Tooltip title="Logó törlése">
                                    <IconButton
                                        size="small" color="error" onClick={handleDeleteLogo} disabled={uploadingImage}
                                        sx={{ position: 'absolute', bottom: -10, left: -10, bgcolor: 'white', boxShadow: 2, '&:hover': { bgcolor: '#ffebee' } }}
                                    >
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            )}
                        </Box>
                        <Typography variant="caption" color="text.secondary" mt={2}>
                            Kattints a fényképezőre a szervezet logójának cseréjéhez (Max 5 MB).
                        </Typography>
                    </Box>

                    <Box display="flex" flexDirection="column" gap={2.5}>
                        <TextField label="Szervezet Neve *" fullWidth value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                        <TextField label="Székhely (Cím) *" fullWidth value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />

                        <Grid container spacing={2}>
                            <Grid size={{xs: 12, sm: 6}}>
                                <TextField label="E-mail cím" fullWidth type="email" value={editForm.email || ''} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                            </Grid>
                            <Grid size={{xs: 12, sm: 6}}>
                                {/* ÚJ MEZŐ: Adószám */}
                                <TextField label="Adószám (CUI/CFI)" placeholder="Opcionális" fullWidth value={editForm.cui || ''} onChange={(e) => setEditForm({ ...editForm, cui: e.target.value })} />
                            </Grid>
                        </Grid>

                        <TextField label="Telefonszám" fullWidth value={editForm.phone || ''} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                        <TextField
                            label="Szervezet leírása (Rólunk)"
                            fullWidth multiline rows={4}
                            value={editForm.description || ''}
                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                            placeholder="Rövid bemutatkozás a szervezet céljairól, amit a jelentkezők fognak látni..."
                        />
                    </Box>

                    <Divider sx={{ my: 4 }} />

                    {/* ========================================================================= */}
                    {/* VESZÉLYZÓNA */}
                    {/* ========================================================================= */}
                    <Box sx={{
                        p: 2.5, borderRadius: 3, bgcolor: (theme) => alpha(theme.palette.error.main, 0.05),
                        border: '1px solid', borderColor: (theme) => alpha(theme.palette.error.main, 0.2)
                    }}>
                        <Typography variant="subtitle1" color="error" fontWeight="900" gutterBottom display="flex" alignItems="center" gap={1}>
                            <WarningAmberIcon fontSize="medium" /> Veszélyzóna
                        </Typography>
                        <Typography variant="body2" color="text.secondary" mb={2}>
                            A szervezet törlése elrejti a csapatot és a tagjait a rendszerből. Ez a folyamat a felhasználói felületről nem visszavonható.
                        </Typography>
                        <Button
                            variant="outlined" color="error" fullWidth
                            startIcon={<DeleteForeverIcon />}
                            onClick={() => setDeleteModalOpen(true)}
                            sx={{ fontWeight: 'bold', borderRadius: 2, borderWidth: 2, '&:hover': { borderWidth: 2 } }}
                        >
                            Szervezet Törlése
                        </Button>
                    </Box>

                </DialogContent>

                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={onClose} startIcon={<CloseIcon />} color="inherit" disabled={savingDetails}>Bezárás</Button>
                    <Button onClick={handleSaveDetails} variant="contained" startIcon={<SaveIcon />} disabled={savingDetails}>
                        {savingDetails ? 'Mentés...' : 'Változások Mentése'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ========================================================================= */}
            {/* TÖRLÉS MEGERŐSÍTŐ MODAL */}
            {/* ========================================================================= */}
            <Dialog open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} PaperProps={{ sx: { borderRadius: 4, p: 1 } }}>
                <DialogTitle sx={{ fontWeight: '900', color: 'error.main' }}>Szervezet végleges törlése?</DialogTitle>
                <DialogContent>
                    <Typography color="text.secondary">
                        Biztosan törölni szeretnéd a(z) <strong>{organization.name}</strong> szervezetet? Ezzel minden ehhez tartozó adat és tagság rejtetté válik a rendszerben.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setDeleteModalOpen(false)} disabled={deleting} color="inherit" sx={{ fontWeight: 'bold' }}>Mégse</Button>
                    <Button onClick={handleDeleteOrganization} disabled={deleting} variant="contained" color="error" sx={{ borderRadius: 2, fontWeight: 'bold' }} disableElevation>
                        {deleting ? 'Törlés folyamatban...' : 'Igen, törlöm a szervezetet'}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}