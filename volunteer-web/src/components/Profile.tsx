import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Container, Typography, Box, Paper, CircularProgress, Alert,
    Button, Dialog, DialogTitle, DialogContent, DialogActions,
    Divider, Avatar, TextField, alpha, useTheme,
    Chip, Stack
} from '@mui/material';

// Ikonok
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import ShieldIcon from '@mui/icons-material/Shield';

import api from '../api/axios';
import axios from 'axios';

interface UserProfile {
    name: string;
    email: string;
    phoneNumber?: string;
    role: string;
    profileImageUrl?: string;
}

export default function Profile() {
    const navigate = useNavigate();
    const theme = useTheme();

    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ name: '', phoneNumber: '' });
    const [savingDetails, setSavingDetails] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingImage, setUploadingImage] = useState(false);

    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const response = await api.get('/users/me');
            setUser(response.data);
            setEditForm({
                name: response.data.name || '',
                phoneNumber: response.data.phoneNumber || ''
            });
        } catch {
            setError('Nem sikerült betölteni a profil adatait.');
        } finally {
            setLoading(false);
        }
    };

    const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { setError("Csak képfájlt tölthetsz fel!"); return; }
        if (file.size > 5 * 1024 * 1024) { setError("A fájl mérete nem haladhatja meg az 5 MB-ot!"); return; }

        setUploadingImage(true);
        setError('');
        setSuccessMsg('');

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await api.post('/users/me/avatar', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const newImageUrl = `${response.data.imageUrl}?t=${new Date().getTime()}`;
            setUser(prev => prev ? { ...prev, profileImageUrl: newImageUrl } : null);
            setSuccessMsg("A profilképed sikeresen frissült!");

            const storedUserStr = localStorage.getItem('user');
            if (storedUserStr) {
                const storedUser = JSON.parse(storedUserStr);
                storedUser.profileImageUrl = newImageUrl;
                localStorage.setItem('user', JSON.stringify(storedUser));
                window.dispatchEvent(new Event('userAvatarUpdated'));
            }
        } catch (err) {
            if (axios.isAxiosError(err)) setError(err.response?.data?.error || "Hiba a feltöltésnél.");
        } finally {
            setUploadingImage(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDeleteAvatar = async () => {
        setUploadingImage(true);
        try {
            await api.delete('/users/me/avatar');
            setUser(prev => prev ? { ...prev, profileImageUrl: undefined } : null);
            setSuccessMsg("Profilkép sikeresen törölve!");
            const storedUserStr = localStorage.getItem('user');
            if (storedUserStr) {
                const storedUser = JSON.parse(storedUserStr);
                delete storedUser.profileImageUrl;
                localStorage.setItem('user', JSON.stringify(storedUser));
                window.dispatchEvent(new Event('userAvatarUpdated'));
            }
        } catch { setError("Hiba a törlésnél."); }
        finally { setUploadingImage(false); }
    };

    const handleSaveDetails = async () => {
        if (!editForm.name.trim()) { setError("A név nem lehet üres!"); return; }
        setSavingDetails(true);
        try {
            await api.put('/users/me', editForm);
            setUser(prev => prev ? { ...prev, name: editForm.name, phoneNumber: editForm.phoneNumber } : null);
            setSuccessMsg("Személyes adatok sikeresen frissítve!");
            setIsEditing(false);
            const storedUserStr = localStorage.getItem('user');
            if (storedUserStr) {
                const storedUser = JSON.parse(storedUserStr);
                storedUser.name = editForm.name;
                localStorage.setItem('user', JSON.stringify(storedUser));
                window.dispatchEvent(new Event('userAvatarUpdated'));
            }
        } catch { setError("Hiba a mentésnél."); }
        finally { setSavingDetails(false); }
    };

    const handleDeleteAccount = async () => {
        setDeleting(true);
        try {
            await api.delete('/users/me');
            localStorage.clear();
            navigate('/');
        } catch {
            setDeleteModalOpen(false);
            setDeleting(false);
            setError("Hiba történt a fiók törlése közben.");
        }
    };

    const getAvatarUrl = () => {
        if (!user?.profileImageUrl) return undefined;
        const backendBaseUrl = 'http://localhost:8081';
        return user.profileImageUrl.startsWith('http') ? user.profileImageUrl : `${backendBaseUrl}${user.profileImageUrl}`;
    };

    if (loading) return <Box display="flex" justifyContent="center" mt={10}><CircularProgress /></Box>;

    return (
        // JAVÍTÁS: Kisebb margók (mt, mb), hogy kiférjen egy oldalra görgetés nélkül
        <Container maxWidth="sm" sx={{ mt: { xs: 2, sm: 4 }, pb: 4 }}>

            {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}
            {successMsg && <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>{successMsg}</Alert>}

            <Paper
                elevation={0}
                sx={{
                    borderRadius: 5,
                    overflow: 'hidden',
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.04)'
                }}
            >
                {/* PROFIL FEJLÉC (Kompaktabb padding és kisebb avatar) */}
                <Box sx={{
                    bgcolor: alpha(theme.palette.primary.main, 0.05),
                    p: { xs: 2, sm: 3 }, textAlign: 'center', position: 'relative',
                    borderBottom: '1px solid', borderColor: 'divider'
                }}>
                    <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImageSelect} />

                    <Avatar
                        src={getAvatarUrl()}
                        sx={{
                            width: 100, height: 100, margin: '0 auto',  // 120-ról 100-ra csökkentve
                            bgcolor: theme.palette.primary.main,
                            color: 'white', fontSize: '3rem', fontWeight: 'bold',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                            border: '3px solid', borderColor: 'background.paper'
                        }}
                    >
                        {!user?.profileImageUrl && (user?.name?.charAt(0).toUpperCase() || 'U')}
                    </Avatar>

                    {/* Profilkép vezérlő gombok */}
                    <Stack direction="row" spacing={1} justifyContent="center" mt={1.5}>
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={uploadingImage ? <CircularProgress size={16} /> : <PhotoCameraIcon />}
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingImage}
                            sx={{ borderRadius: 2, fontWeight: 'bold', textTransform: 'none', py: 0.2 }}
                        >
                            Kép cseréje
                        </Button>
                        {user?.profileImageUrl && (
                            <Button
                                size="small"
                                color="error"
                                variant="outlined"
                                startIcon={<DeleteIcon />}
                                onClick={handleDeleteAvatar}
                                disabled={uploadingImage}
                                sx={{ borderRadius: 2, fontWeight: 'bold', textTransform: 'none', py: 0.2 }}
                            >
                                Törlés
                            </Button>
                        )}
                    </Stack>

                    <Typography variant="h5" fontWeight="900" sx={{ mt: 2, letterSpacing: '-0.5px' }}>
                        {user?.name}
                    </Typography>
                    <Chip
                        icon={<ShieldIcon style={{ fontSize: 16 }} />}
                        label={user?.role === 'SYS_ADMIN' ? 'Globális Rendszergazda' : 'Önkéntes'}
                        size="small"
                        sx={{ mt: 1, fontWeight: 'bold', bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }}
                    />
                </Box>

                {/* ALSÓ RÉSZ (Kisebb térközökkel) */}
                <Box sx={{ p: { xs: 2.5, sm: 3 } }}>

                    {/* JAVÍTÁS: Ide került át a Szerkesztés gomb, egy vonalba a "Személyes Adatok" felirattal */}
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                        <Typography variant="subtitle2" color="text.secondary" fontWeight="800" textTransform="uppercase" letterSpacing={1}>
                            Személyes Adatok
                        </Typography>
                        {!isEditing && (
                            <Button
                                size="small"
                                variant="contained"
                                startIcon={<EditIcon />}
                                onClick={() => setIsEditing(true)}
                                sx={{ borderRadius: 2, fontWeight: 'bold', px: 2 }}
                                disableElevation
                            >
                                Szerkesztés
                            </Button>
                        )}
                    </Box>

                    {isEditing ? (
                        <Stack spacing={2}>
                            <TextField
                                label="Teljes név" fullWidth size="small" value={editForm.name}
                                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                variant="filled"
                            />
                            <TextField
                                label="Email cím" fullWidth size="small" disabled value={user?.email} variant="filled"
                                helperText="Az email cím nem módosítható."
                            />
                            <TextField
                                label="Telefonszám" fullWidth size="small" value={editForm.phoneNumber}
                                onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })}
                                placeholder="+36 30 123 4567" variant="filled"
                            />
                            <Box display="flex" gap={1.5} justifyContent="flex-end" mt={1}>
                                <Button size="small" color="inherit" startIcon={<CloseIcon />} onClick={() => setIsEditing(false)} disabled={savingDetails} sx={{ fontWeight: 'bold' }}>
                                    Mégse
                                </Button>
                                <Button size="small" variant="contained" startIcon={<SaveIcon />} onClick={handleSaveDetails} disabled={savingDetails} sx={{ borderRadius: 2, fontWeight: 'bold' }} disableElevation>
                                    {savingDetails ? 'Mentés...' : 'Mentés'}
                                </Button>
                            </Box>
                        </Stack>
                    ) : (
                        <Stack spacing={2}>
                            <Box display="flex" alignItems="center" gap={2}>
                                <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', width: 36, height: 36 }}>
                                    <EmailIcon fontSize="small" />
                                </Avatar>
                                <Box>
                                    <Typography variant="caption" color="text.secondary" fontWeight="bold">EMAIL CÍM</Typography>
                                    <Typography variant="body1" fontWeight="600">{user?.email}</Typography>
                                </Box>
                            </Box>

                            <Box display="flex" alignItems="center" gap={2}>
                                <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', width: 36, height: 36 }}>
                                    <PhoneIcon fontSize="small" />
                                </Avatar>
                                <Box>
                                    <Typography variant="caption" color="text.secondary" fontWeight="bold">TELEFONSZÁM</Typography>
                                    <Typography variant="body1" fontWeight="600">{user?.phoneNumber || 'Nincs megadva'}</Typography>
                                </Box>
                            </Box>
                        </Stack>
                    )}

                    <Divider sx={{ my: 2.5 }} />

                    {/* VESZÉLYZÓNA (Kompaktabb szövegezés és padding) */}
                    <Box
                        sx={{
                            p: 2,
                            borderRadius: 3,
                            bgcolor: alpha(theme.palette.error.main, 0.05),
                            border: '1px solid',
                            borderColor: alpha(theme.palette.error.main, 0.1)
                        }}
                    >
                        <Typography variant="subtitle2" color="error" fontWeight="900" gutterBottom display="flex" alignItems="center" gap={1}>
                            <WarningAmberIcon fontSize="small" /> VESZÉLYZÓNA
                        </Typography>
                        <Typography variant="caption" color="text.secondary" mb={1.5} display="block">
                            A fiók törlése végleges. Minden adatod anonimizálásra kerül.
                        </Typography>
                        <Button
                            size="small"
                            variant="outlined" color="error" startIcon={<DeleteForeverIcon />} fullWidth
                            onClick={() => setDeleteModalOpen(true)} sx={{ fontWeight: 'bold', borderRadius: 2 }}
                        >
                            Fiók törlése
                        </Button>
                    </Box>
                </Box>
            </Paper>

            {/* DELETE MODAL */}
            <Dialog open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} PaperProps={{ sx: { borderRadius: 4, p: 1 } }}>
                <DialogTitle sx={{ fontWeight: '900', color: 'error.main' }}>Fiók törlése?</DialogTitle>
                <DialogContent>
                    <Typography color="text.secondary">Ez a folyamat megállíthatatlan. Biztosan törölni szeretnéd a VolunteerApp profilodat?</Typography>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setDeleteModalOpen(false)} disabled={deleting} color="inherit" sx={{ fontWeight: 'bold' }}>Mégse</Button>
                    <Button onClick={handleDeleteAccount} disabled={deleting} variant="contained" color="error" sx={{ borderRadius: 2, fontWeight: 'bold' }} disableElevation>
                        {deleting ? 'Törlés folyamatban...' : 'Törlés'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
}