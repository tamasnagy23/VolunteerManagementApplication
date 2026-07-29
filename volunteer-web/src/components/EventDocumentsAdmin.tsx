import React, { useState, useEffect, useRef } from 'react';
import {
    Box, Typography, Paper, Button, List, ListItem, ListItemText,
    ListItemAvatar, Avatar, IconButton, Divider, CircularProgress,
    FormControl, InputLabel, Select, MenuItem, Fade, Chip
} from '@mui/material';

import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';

import { useThemeToggle } from '../theme/ThemeContextProvider';

// Document típus definiálása a backend válasz alapján
interface EventDocument {
    id: number;
    originalFileName: string;
    contentType: string;
    fileSize: number;
    documentType: string;
    uploadedAt: string;
}

interface Props {
    eventId: number;
    tenantId: string; // pl. "netpositive"
}

export default function EventDocumentsAdmin({ eventId, tenantId }: Props) {
    const { isDarkMode } = useThemeToggle();

    const [documents, setDocuments] = useState<EventDocument[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [uploading, setUploading] = useState<boolean>(false);

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [docType, setDocType] = useState<string>('TEMPLATE');

    const fileInputRef = useRef<HTMLInputElement>(null);

    // API Alap URL (cseréld le a sajátodra, ha kell)
    const API_BASE_URL = 'http://localhost:8081/api/documents';

    // Autentikációs token a hívásokhoz
    const token = localStorage.getItem('token');

    // 1. Dokumentumok betöltése
    const fetchDocuments = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/event/${eventId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setDocuments(data);
            }
        } catch (error) {
            console.error('Hiba a dokumentumok betöltésekor:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDocuments();
    }, [eventId]);

    // 2. Fájl kiválasztása
    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            setSelectedFile(event.target.files[0]);
        }
    };

    // 3. Feltöltés a backendre
    const handleUpload = async () => {
        if (!selectedFile) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('documentType', docType);
        formData.append('tenantId', tenantId);
        formData.append('eventId', eventId.toString());

        try {
            const response = await fetch(`${API_BASE_URL}/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }, // A multipart/form-data fejécet a böngésző automatikusan hozzáadja!
                body: formData,
            });

            if (response.ok) {
                setSelectedFile(null); // Reset
                if (fileInputRef.current) fileInputRef.current.value = '';
                fetchDocuments(); // Lista frissítése
            } else {
                console.error("Feltöltés sikertelen");
            }
        } catch (error) {
            console.error('Hiba feltöltés közben:', error);
        } finally {
            setUploading(false);
        }
    };

    // 4. Letöltés
    const handleDownload = (documentId: number, fileName: string) => {
        // Közvetlen link megnyitása a token átadásával picit trükkös beépített browser funkciókkal,
        // a legstabilabb, ha lekéred blobként, majd letöltöd:
        fetch(`${API_BASE_URL}/download/${documentId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(response => response.blob())
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
            })
            .catch(err => console.error("Hiba letöltéskor:", err));
    };

    // 5. Törlés
    const handleDelete = async (documentId: number) => {
        if (!window.confirm("Biztosan törölni szeretnéd ezt a dokumentumot?")) return;

        try {
            const response = await fetch(`${API_BASE_URL}/${documentId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                setDocuments(documents.filter(doc => doc.id !== documentId));
            }
        } catch (error) {
            console.error("Hiba törléskor:", error);
        }
    };

    // Segédfüggvény a fájlméret formázására
    const formatBytes = (bytes: number, decimals = 2) => {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    };

    return (
        <Fade in={true} timeout={500}>
            <Box>
                <Typography variant="h6" fontWeight="800" mb={3} color={isDarkMode ? 'primary.light' : 'primary.main'}>
                    📄 Esemény Dokumentumok
                </Typography>

                {/* --- FELTÖLTŐ RÉSZ --- */}
                <Paper
                    elevation={0}
                    sx={{
                        p: 3, mb: 4, borderRadius: 3,
                        border: '1px dashed',
                        borderColor: isDarkMode ? 'rgba(255,255,255,0.2)' : 'primary.main',
                        bgcolor: isDarkMode ? 'rgba(15, 23, 42, 0.4)' : 'rgba(25, 118, 210, 0.02)'
                    }}
                >
                    <Typography variant="subtitle2" fontWeight="bold" mb={2}>
                        Új sablon / dokumentum feltöltése az önkénteseknek
                    </Typography>

                    <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
                        {/* Rejtett fájl input */}
                        <input
                            type="file"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            onChange={handleFileSelect}
                            accept=".pdf,.doc,.docx,.jpg,.png"
                        />

                        <Button
                            variant={selectedFile ? "outlined" : "contained"}
                            color="primary"
                            startIcon={<CloudUploadIcon />}
                            onClick={() => fileInputRef.current?.click()}
                            sx={{ borderRadius: 2 }}
                            disabled={uploading}
                        >
                            {selectedFile ? selectedFile.name : "Fájl kiválasztása"}
                        </Button>

                        <FormControl size="small" sx={{ minWidth: 200 }}>
                            <InputLabel>Dokumentum típusa</InputLabel>
                            <Select
                                value={docType}
                                label="Dokumentum típusa"
                                onChange={(e) => setDocType(e.target.value)}
                                sx={{ borderRadius: 2 }}
                            >
                                <MenuItem value="TEMPLATE">📄 Általános Sablon (Szerződés, GDPR)</MenuItem>
                                <MenuItem value="INFO_SHEET">ℹ️ Tájékoztató anyag / Térkép</MenuItem>
                                <MenuItem value="PARENTAL_CONSENT">👨‍👩‍👧 Szülői beleegyező</MenuItem>
                            </Select>
                        </FormControl>

                        <Button
                            variant="contained"
                            color="success"
                            onClick={handleUpload}
                            disabled={!selectedFile || uploading}
                            sx={{ borderRadius: 2, fontWeight: 'bold' }}
                        >
                            {uploading ? <CircularProgress size={24} color="inherit" /> : "Feltöltés"}
                        </Button>
                    </Box>
                </Paper>

                {/* --- LISTÁZÓ RÉSZ --- */}
                <Paper elevation={0} sx={{
                    borderRadius: 3, overflow: 'hidden',
                    border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider',
                    bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.4)' : 'white',
                }}>
                    {loading ? (
                        <Box display="flex" justifyContent="center" p={5}><CircularProgress /></Box>
                    ) : documents.length === 0 ? (
                        <Box p={5} textAlign="center">
                            <Typography color="text.secondary">Nincsenek feltöltött dokumentumok ehhez az eseményhez.</Typography>
                        </Box>
                    ) : (
                        <List disablePadding>
                            {documents.map((doc, index) => (
                                <React.Fragment key={doc.id}>
                                    <ListItem
                                        sx={{
                                            py: 2, px: 3,
                                            '&:hover': { bgcolor: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }
                                        }}
                                        secondaryAction={
                                            <Box display="flex" gap={1}>
                                                <IconButton edge="end" color="primary" onClick={() => handleDownload(doc.id, doc.originalFileName)}>
                                                    <DownloadIcon />
                                                </IconButton>
                                                <IconButton edge="end" color="error" onClick={() => handleDelete(doc.id)}>
                                                    <DeleteIcon />
                                                </IconButton>
                                            </Box>
                                        }
                                    >
                                        <ListItemAvatar>
                                            <Avatar sx={{ bgcolor: doc.originalFileName.endsWith('.pdf') ? '#ef4444' : '#3b82f6' }}>
                                                {doc.originalFileName.endsWith('.pdf') ? <PictureAsPdfIcon /> : <InsertDriveFileIcon />}
                                            </Avatar>
                                        </ListItemAvatar>
                                        <ListItemText
                                            primary={
                                                <Box display="flex" alignItems="center" gap={1}>
                                                    <Typography fontWeight="bold">{doc.originalFileName}</Typography>
                                                    <Chip
                                                        label={doc.documentType === 'TEMPLATE' ? 'Sablon' : doc.documentType}
                                                        size="small"
                                                        variant="outlined"
                                                        color="primary"
                                                        sx={{ height: 20, fontSize: '0.7rem' }}
                                                    />
                                                </Box>
                                            }
                                            secondary={`${formatBytes(doc.fileSize)} • Feltöltve: ${new Date(doc.uploadedAt).toLocaleDateString('hu-HU')}`}
                                            secondaryTypographyProps={{ color: 'text.secondary' }}
                                        />
                                    </ListItem>
                                    {index < documents.length - 1 && <Divider sx={{ borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'divider' }}/>}
                                </React.Fragment>
                            ))}
                        </List>
                    )}
                </Paper>
            </Box>
        </Fade>
    );
}