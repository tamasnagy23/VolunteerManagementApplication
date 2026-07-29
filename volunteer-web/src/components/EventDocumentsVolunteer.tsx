import React, { useState, useEffect, useRef } from 'react';
import {
    Box, Typography, Paper, Button, List, ListItem, ListItemText,
    ListItemAvatar, Avatar, IconButton, Divider, CircularProgress,
    Fade, Chip, Alert
} from '@mui/material';

import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';

import api from '../api/axios';
import { useThemeToggle } from '../theme/ThemeContextProvider';

interface EventDocument {
    id: number;
    originalFileName: string;
    contentType: string;
    fileSize: number;
    documentType: string;
    userId?: number | null;
    uploadedAt: string;
}

interface Props {
    eventId: number;
    tenantId: string;
}

export default function EventDocumentsVolunteer({ eventId, tenantId }: Props) {
    const { isDarkMode } = useThemeToggle();

    const [officialDocs, setOfficialDocs] = useState<EventDocument[]>([]);
    const [myDocs, setMyDocs] = useState<EventDocument[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [uploading, setUploading] = useState<boolean>(false);
    const [currentUserId, setCurrentUserId] = useState<number | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const userRes = await api.get('/users/me');
            const userId = userRes.data.id;
            setCurrentUserId(userId);

            const eventDocsRes = await api.get(`/documents/event/${eventId}`);
            const official = eventDocsRes.data.filter((doc: EventDocument) => !doc.userId);
            setOfficialDocs(official);

            const myDocsRes = await api.get(`/documents/event/${eventId}/user/${userId}`);
            setMyDocs(myDocsRes.data);
        } catch (error) {
            console.error('Hiba a dokumentumok betöltésekor:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [eventId]);

    const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !currentUserId) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('documentType', 'SIGNED_DOCUMENT');
        formData.append('tenantId', tenantId);
        formData.append('eventId', eventId.toString());
        formData.append('userId', currentUserId.toString());

        try {
            await api.post(`/documents/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            fetchData();
        } catch (error) {
            console.error('Hiba feltöltés közben:', error);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDownload = async (documentId: number, fileName: string) => {
        try {
            const response = await api.get(`/documents/download/${documentId}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Hiba letöltéskor:", err);
        }
    };

    const handleDelete = async (documentId: number) => {
        if (!window.confirm("Biztosan törölni szeretnéd a feltöltött dokumentumodat?")) return;
        try {
            await api.delete(`/documents/${documentId}`);
            setMyDocs(myDocs.filter(doc => doc.id !== documentId));
        } catch (error) {
            console.error("Hiba törléskor:", error);
        }
    };

    const formatBytes = (bytes: number) => {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    };

    if (loading) {
        return <Box display="flex" justifyContent="center" p={5}><CircularProgress /></Box>;
    }

    return (
        <Fade in={true} timeout={500}>
            <Box>
                {/* --- 1. RÉSZ: HIVATALOS DOKUMENTUMOK --- */}
                <Typography variant="h6" fontWeight="800" mb={2} color={isDarkMode ? 'primary.light' : 'primary.main'}>
                    📥 Hivatalos Esemény Dokumentumok
                </Typography>

                <Paper elevation={0} sx={{ borderRadius: 3, overflow: 'hidden', mb: 5, border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider', bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.4)' : 'white' }}>
                    {officialDocs.length === 0 ? (
                        <Box p={4} textAlign="center">
                            <Typography color="text.secondary">A szervezők még nem töltöttek fel sablonokat ehhez az eseményhez.</Typography>
                        </Box>
                    ) : (
                        <List disablePadding>
                            {officialDocs.map((doc, index) => (
                                <React.Fragment key={doc.id}>
                                    <ListItem
                                        sx={{
                                            py: 2,
                                            px: { xs: 2, sm: 3 },
                                            flexDirection: { xs: 'column', sm: 'row' },
                                            alignItems: { xs: 'flex-start', sm: 'center' },
                                            gap: { xs: 1, sm: 2 },
                                            '&:hover': { bgcolor: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }
                                        }}
                                    >
                                        <Box display="flex" alignItems="center" width="100%">
                                            <ListItemAvatar>
                                                <Avatar sx={{ bgcolor: doc.originalFileName.endsWith('.pdf') ? '#ef4444' : '#3b82f6' }}>
                                                    {doc.originalFileName.endsWith('.pdf') ? <PictureAsPdfIcon /> : <InsertDriveFileIcon />}
                                                </Avatar>
                                            </ListItemAvatar>
                                            <ListItemText
                                                sx={{ pr: { sm: 2 } }}
                                                primary={<Typography fontWeight="bold" sx={{ wordBreak: 'break-word' }}>{doc.originalFileName}</Typography>}
                                                secondary={`Sablon • ${formatBytes(doc.fileSize)}`}
                                                secondaryTypographyProps={{ color: 'text.secondary' }}
                                            />
                                        </Box>
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            startIcon={<DownloadIcon />}
                                            onClick={() => handleDownload(doc.id, doc.originalFileName)}
                                            sx={{ alignSelf: { xs: 'flex-end', sm: 'center' }, mt: { xs: 1, sm: 0 } }}
                                        >
                                            Letöltés
                                        </Button>
                                    </ListItem>
                                    {index < officialDocs.length - 1 && <Divider />}
                                </React.Fragment>
                            ))}
                        </List>
                    )}
                </Paper>

                {/* --- 2. RÉSZ: SAJÁT FELTÖLTÉSEK --- */}
                <Typography variant="h6" fontWeight="800" mb={2} color={isDarkMode ? 'success.light' : 'success.main'}>
                    📤 Saját Feltöltött Dokumentumaim
                </Typography>

                <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
                    Ide töltheted fel a kitöltött, aláírt papírokat (pl. szülői beleegyező) beszkennelve vagy lefotózva.
                </Alert>

                <Paper elevation={0} sx={{ borderRadius: 3, overflow: 'hidden', border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider', bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.4)' : 'white' }}>
                    <Box p={3} borderBottom="1px solid" borderColor={isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider'} bgcolor={isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)'}>
                        <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleUpload} accept=".pdf,.doc,.docx,.jpg,.png" />
                        <Button variant="contained" color="success" startIcon={uploading ? <CircularProgress size={20} color="inherit" /> : <CloudUploadIcon />} onClick={() => fileInputRef.current?.click()} disabled={uploading} sx={{ borderRadius: 2, fontWeight: 'bold' }}>
                            {uploading ? 'Feltöltés folyamatban...' : 'Aláírt dokumentum feltöltése'}
                        </Button>
                    </Box>

                    {myDocs.length === 0 ? (
                        <Box p={4} textAlign="center">
                            <Typography color="text.secondary">Még nem töltöttél fel saját dokumentumot ehhez az eseményhez.</Typography>
                        </Box>
                    ) : (
                        <List disablePadding>
                            {myDocs.map((doc, index) => (
                                <React.Fragment key={doc.id}>
                                    <ListItem
                                        sx={{
                                            py: 2,
                                            px: { xs: 2, sm: 3 },
                                            flexDirection: { xs: 'column', sm: 'row' },
                                            alignItems: { xs: 'flex-start', sm: 'center' },
                                            gap: { xs: 1, sm: 2 },
                                            '&:hover': { bgcolor: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }
                                        }}
                                    >
                                        <Box display="flex" alignItems="center" width="100%">
                                            <ListItemAvatar>
                                                <Avatar sx={{ bgcolor: '#10b981' }}><AssignmentTurnedInIcon /></Avatar>
                                            </ListItemAvatar>
                                            <ListItemText
                                                sx={{ pr: { sm: 2 } }}
                                                primary={
                                                    <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                                                        <Typography fontWeight="bold" sx={{ wordBreak: 'break-word' }}>{doc.originalFileName}</Typography>
                                                        <Chip label="Saját feltöltés" size="small" color="success" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                                                    </Box>
                                                }
                                                secondary={`${formatBytes(doc.fileSize)} • Feltöltve: ${new Date(doc.uploadedAt).toLocaleDateString('hu-HU')}`}
                                                secondaryTypographyProps={{ color: 'text.secondary' }}
                                            />
                                        </Box>
                                        <Box display="flex" gap={1} sx={{ alignSelf: { xs: 'flex-end', sm: 'center' }, mt: { xs: 1, sm: 0 } }}>
                                            <IconButton color="primary" onClick={() => handleDownload(doc.id, doc.originalFileName)}><DownloadIcon /></IconButton>
                                            <IconButton color="error" onClick={() => handleDelete(doc.id)}><DeleteIcon /></IconButton>
                                        </Box>
                                    </ListItem>
                                    {index < myDocs.length - 1 && <Divider />}
                                </React.Fragment>
                            ))}
                        </List>
                    )}
                </Paper>
            </Box>
        </Fade>
    );
}