import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    Box, Typography, Paper, Button, List, ListItem, ListItemText,
    ListItemAvatar, Avatar, IconButton, Divider, CircularProgress,
    FormControl, InputLabel, Select, MenuItem, Fade, Chip,
    Tabs, Tab, Accordion, AccordionSummary, AccordionDetails
} from '@mui/material';

import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PersonIcon from '@mui/icons-material/Person';

import { useThemeToggle } from '../theme/ThemeContextProvider';
import api from '../api/axios'; // <-- Véglegesen átálltunk erre!

interface EventDocument {
    id: number;
    originalFileName: string;
    contentType: string;
    fileSize: number;
    documentType: string;
    userId: number | null;
    uploaderName?: string;
    uploadedAt: string;
}

interface Props {
    eventId: number;
    tenantId: string;
}

export default function EventDocumentsAdmin({ eventId, tenantId }: Props) {
    const { isDarkMode } = useThemeToggle();

    const [documents, setDocuments] = useState<EventDocument[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [uploading, setUploading] = useState<boolean>(false);

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [docType, setDocType] = useState<string>('TEMPLATE');
    const [tabIndex, setTabIndex] = useState(0);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- FETCH HELYETT AXIOS ---
    const fetchDocuments = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/documents/event/${eventId}`);
            setDocuments(response.data);
        } catch (error) {
            console.error('Hiba a dokumentumok betöltésekor:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDocuments();
    }, [eventId]);

    const handleUpload = async () => {
        if (!selectedFile) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('documentType', docType);
        formData.append('tenantId', tenantId);
        formData.append('eventId', eventId.toString());

        try {
            await api.post(`/documents/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setSelectedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            fetchDocuments();
        } catch (error) {
            console.error('Hiba feltöltés közben:', error);
        } finally {
            setUploading(false);
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
        if (!window.confirm("Biztosan törölni szeretnéd ezt a dokumentumot?")) return;
        try {
            await api.delete(`/documents/${documentId}`);
            setDocuments(documents.filter(doc => doc.id !== documentId));
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

    const officialTemplates = documents.filter(doc => !doc.userId);
    const volunteerUploads = documents.filter(doc => !!doc.userId);

    const groupedVolunteerUploads = useMemo(() => {
        const groups: Record<string, EventDocument[]> = {};
        volunteerUploads.forEach(doc => {
            const groupKey = doc.uploaderName || `Felhasználó ID: ${doc.userId}`;
            if (!groups[groupKey]) groups[groupKey] = [];
            groups[groupKey].push(doc);
        });
        return groups;
    }, [volunteerUploads]);

    if (loading) return <Box display="flex" justifyContent="center" p={5}><CircularProgress /></Box>;

    return (
        <Fade in={true} timeout={500}>
            <Box>
                <Typography variant="h6" fontWeight="800" mb={3} color={isDarkMode ? 'primary.light' : 'primary.main'}>
                    🗂️ Dokumentum Központ
                </Typography>

                {/* BELSŐ TABS - Görgethető és Megállítja a globális Swipe-ot! */}
                <Box
                    sx={{ borderBottom: 1, borderColor: 'divider', mb: 4 }}
                    onTouchStart={(e) => e.stopPropagation()}
                    onMouseDownCapture={(e) => e.stopPropagation()}
                >
                    <Tabs
                        value={tabIndex}
                        onChange={(_, v) => setTabIndex(v)}
                        textColor="primary"
                        indicatorColor="primary"
                        variant="scrollable"
                        scrollButtons="auto"
                        allowScrollButtonsMobile
                    >
                        <Tab label={`Sablonok (${officialTemplates.length})`} sx={{ fontWeight: 'bold' }} />
                        <Tab label={`Beérkezett dokumentumok (${volunteerUploads.length})`} sx={{ fontWeight: 'bold' }} />
                    </Tabs>
                </Box>

                {tabIndex === 0 && (
                    <Box>
                        {/* Feltöltő doboz mobilon egymás alá ugró elemekkel */}
                        <Paper elevation={0} sx={{ p: 3, mb: 4, borderRadius: 3, border: '1px dashed', borderColor: isDarkMode ? 'rgba(255,255,255,0.2)' : 'primary.main', bgcolor: isDarkMode ? 'rgba(15, 23, 42, 0.4)' : 'rgba(25, 118, 210, 0.02)' }}>
                            <Typography variant="subtitle2" fontWeight="bold" mb={2}>Új hivatalos sablon / tájékoztató feltöltése</Typography>
                            <Box display="flex" gap={2} flexDirection={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }}>
                                <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={(e) => e.target.files && setSelectedFile(e.target.files[0])} accept=".pdf,.doc,.docx,.jpg,.png" />
                                <Button variant={selectedFile ? "outlined" : "contained"} color="primary" startIcon={<CloudUploadIcon />} onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                                    {selectedFile ? selectedFile.name : "Fájl kiválasztása"}
                                </Button>
                                <FormControl size="small" sx={{ flexGrow: 1, minWidth: { sm: 200 } }}>
                                    <InputLabel>Típus</InputLabel>
                                    <Select value={docType} label="Típus" onChange={(e) => setDocType(e.target.value)}>
                                        <MenuItem value="TEMPLATE">📄 Általános Sablon (Szerződés, GDPR)</MenuItem>
                                        <MenuItem value="INFO_SHEET">ℹ️ Tájékoztató / Térkép</MenuItem>
                                        <MenuItem value="PARENTAL_CONSENT">👨‍👩‍👧 Szülői beleegyező</MenuItem>
                                    </Select>
                                </FormControl>
                                <Button variant="contained" color="success" onClick={handleUpload} disabled={!selectedFile || uploading} sx={{ fontWeight: 'bold' }}>
                                    {uploading ? <CircularProgress size={24} color="inherit" /> : "Feltöltés"}
                                </Button>
                            </Box>
                        </Paper>

                        {/* Sablonok listája mobilos tördeléssel */}
                        <Paper elevation={0} sx={{ borderRadius: 3, overflow: 'hidden', border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider' }}>
                            {officialTemplates.length === 0 ? (
                                <Box p={4} textAlign="center"><Typography color="text.secondary">Nincsenek feltöltött sablonok.</Typography></Box>
                            ) : (
                                <List disablePadding>
                                    {officialTemplates.map((doc, index) => (
                                        <React.Fragment key={doc.id}>
                                            <ListItem
                                                sx={{
                                                    py: 2,
                                                    px: { xs: 2, sm: 3 },
                                                    flexDirection: { xs: 'column', sm: 'row' },
                                                    alignItems: { xs: 'flex-start', sm: 'center' },
                                                    gap: { xs: 1, sm: 2 }
                                                }}
                                            >
                                                <Box display="flex" alignItems="center" width="100%">
                                                    <ListItemAvatar><Avatar sx={{ bgcolor: doc.originalFileName.endsWith('.pdf') ? '#ef4444' : '#3b82f6' }}>{doc.originalFileName.endsWith('.pdf') ? <PictureAsPdfIcon /> : <InsertDriveFileIcon />}</Avatar></ListItemAvatar>
                                                    <ListItemText
                                                        sx={{ pr: { sm: 2 } }}
                                                        primary={
                                                            <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                                                                <Typography fontWeight="bold" sx={{ wordBreak: 'break-word' }}>{doc.originalFileName}</Typography>
                                                                <Chip label={doc.documentType} size="small" variant="outlined" color="primary" sx={{ height: 20, fontSize: '0.7rem' }}/>
                                                            </Box>
                                                        }
                                                        secondary={`${formatBytes(doc.fileSize)} • Feltöltve: ${new Date(doc.uploadedAt).toLocaleDateString('hu-HU')}`}
                                                    />
                                                </Box>
                                                <Box display="flex" gap={1} sx={{ alignSelf: { xs: 'flex-end', sm: 'center' }, mt: { xs: 1, sm: 0 } }}>
                                                    <IconButton color="primary" onClick={() => handleDownload(doc.id, doc.originalFileName)}><DownloadIcon /></IconButton>
                                                    <IconButton color="error" onClick={() => handleDelete(doc.id)}><DeleteIcon /></IconButton>
                                                </Box>
                                            </ListItem>
                                            {index < officialTemplates.length - 1 && <Divider />}
                                        </React.Fragment>
                                    ))}
                                </List>
                            )}
                        </Paper>
                    </Box>
                )}

                {tabIndex === 1 && (
                    <Box>
                        {Object.keys(groupedVolunteerUploads).length === 0 ? (
                            <Paper elevation={0} sx={{ p: 5, textAlign: 'center', borderRadius: 3, border: '1px dashed', borderColor: 'divider', bgcolor: 'transparent' }}>
                                <Typography color="text.secondary">Még egyetlen önkéntes sem töltött fel dokumentumot.</Typography>
                            </Paper>
                        ) : (
                            Object.entries(groupedVolunteerUploads).map(([userName, userDocs]) => (
                                <Accordion key={userName} sx={{ mb: 1, borderRadius: 2, '&:before': { display: 'none' }, border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'divider', bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.4)' : '#f8fafc', overflow: 'hidden' }} defaultExpanded={false}>
                                    <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: isDarkMode ? 'rgba(0,0,0,0.2)' : 'white' }}>
                                        <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
                                            <Avatar sx={{ bgcolor: 'secondary.main', width: 32, height: 32 }}><PersonIcon fontSize="small" /></Avatar>
                                            <Typography fontWeight="bold" fontSize="1.05rem" sx={{ wordBreak: 'break-word' }}>{userName}</Typography>
                                            <Chip label={`${userDocs.length} fájl`} size="small" color="info" sx={{ fontWeight: 'bold' }} />
                                        </Box>
                                    </AccordionSummary>
                                    <AccordionDetails sx={{ p: 0 }}>
                                        <List disablePadding>
                                            {userDocs.map((doc, idx) => (
                                                <React.Fragment key={doc.id}>
                                                    {idx > 0 && <Divider />}
                                                    <ListItem
                                                        sx={{
                                                            pl: { xs: 2, sm: 4 },
                                                            pr: { xs: 2, sm: 3 },
                                                            py: 1.5,
                                                            flexDirection: { xs: 'column', sm: 'row' },
                                                            alignItems: { xs: 'flex-start', sm: 'center' },
                                                            '&:hover': { bgcolor: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }
                                                        }}
                                                    >
                                                        <Box display="flex" alignItems="center" width="100%">
                                                            <ListItemAvatar><Avatar sx={{ width: 30, height: 30, bgcolor: 'transparent', color: 'text.secondary' }}><InsertDriveFileIcon /></Avatar></ListItemAvatar>
                                                            <ListItemText
                                                                primary={<Typography variant="body2" fontWeight="bold" sx={{ wordBreak: 'break-word' }}>{doc.originalFileName}</Typography>}
                                                                secondary={<Typography variant="caption" color="text.secondary">{formatBytes(doc.fileSize)} • {new Date(doc.uploadedAt).toLocaleString('hu-HU')}</Typography>}
                                                            />
                                                        </Box>
                                                        <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={() => handleDownload(doc.id, doc.originalFileName)} sx={{ borderRadius: 2, alignSelf: { xs: 'flex-end', sm: 'center' }, mt: { xs: 1, sm: 0 } }}>Letöltés</Button>
                                                    </ListItem>
                                                </React.Fragment>
                                            ))}
                                        </List>
                                    </AccordionDetails>
                                </Accordion>
                            ))
                        )}
                    </Box>
                )}
            </Box>
        </Fade>
    );
}