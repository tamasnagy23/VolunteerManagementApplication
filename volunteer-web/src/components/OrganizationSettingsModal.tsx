import React, { useState, useRef, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, TextField, Box, Avatar, Typography, IconButton,
    CircularProgress, Badge, Tooltip, Alert
} from '@mui/material';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import BusinessIcon from '@mui/icons-material/Business';
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

    // JAVÍTÁS: Csak akkor írjuk felül a formot, amikor a Modal KINYÍLIK!
    // Különben a háttérfrissítés letörölné a beírt adatokat.
    useEffect(() => {
        if (open) {
            setEditForm({ ...organization });
            setError('');
            setSuccessMsg('');
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

            // Azonnal frissítjük a saját belső állapotunkat
            setEditForm(prev => ({ ...prev, logoUrl: newLogoUrl }));
            setSuccessMsg("Szervezeti logó sikeresen frissítve!");

            // Szólunk a Dashboardnak, hogy frissítsen CSENDESEN
            onUpdateSuccess();
        } catch (err: unknown) {
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
        } catch (err) {
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

            // Várunk 1.5 másodpercet, hogy a felhasználó elolvashassa a sikeres mentést, aztán zárjuk.
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

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
            <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 'bold' }}>
                Szervezet Beállításai
            </DialogTitle>

            <DialogContent dividers>
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
                    <TextField label="E-mail cím" fullWidth type="email" value={editForm.email || ''} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                    <TextField label="Telefonszám" fullWidth value={editForm.phone || ''} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                    <TextField
                        label="Szervezet leírása (Rólunk)"
                        fullWidth multiline rows={4}
                        value={editForm.description || ''}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        placeholder="Rövid bemutatkozás a szervezet céljairól, amit a jelentkezők fognak látni..."
                    />
                </Box>
            </DialogContent>

            <DialogActions sx={{ p: 2 }}>
                <Button onClick={onClose} startIcon={<CloseIcon />} color="inherit" disabled={savingDetails}>Bezárás</Button>
                <Button onClick={handleSaveDetails} variant="contained" startIcon={<SaveIcon />} disabled={savingDetails}>
                    {savingDetails ? 'Mentés...' : 'Változások Mentése'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}