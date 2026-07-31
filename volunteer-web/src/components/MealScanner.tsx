import { useState, useEffect } from 'react';
import { Scanner, type IDetectedBarcode } from '@yudiel/react-qr-scanner';
import {
    Box, Typography, Button, Paper, Container, CircularProgress,
    FormControl, InputLabel, Select, MenuItem, type SelectChangeEvent, Alert,
    Stack
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import api from '../api/axios';
import axios from 'axios';

interface ScanResult {
    success: boolean;
    message: string;
    dietaryPreference?: string;
}

export interface EventOption {
    id: number;
    title: string;
}

interface MealScannerProps {
    isModalMode?: boolean;
    events: EventOption[];
    isLoading: boolean;
}

export default function MealScanner({ isModalMode = false, events, isLoading }: MealScannerProps) {
    const [result, setResult] = useState<ScanResult | null>(null);
    const [scanningLoading, setScanningLoading] = useState(false);

    const [selectedEventId, setSelectedEventId] = useState<number | ''>('');
    const [selectedMealType, setSelectedMealType] = useState<string>('');

    // --- MEMÓRIA KEZELÉSE A KIVÁLASZTOTT ÉRTÉKEKRE ---
    useEffect(() => {
        // Esemény betöltése
        if (events.length > 0) {
            const savedId = localStorage.getItem('lastMealScannerEventId');
            if (savedId) {
                const parsedId = Number(savedId);
                if (events.some(e => e.id === parsedId)) {
                    setSelectedEventId(parsedId);
                } else {
                    setSelectedEventId(events[0].id);
                }
            } else {
                setSelectedEventId(events[0].id);
            }
        }

        // Étel típus betöltése
        const savedMealType = localStorage.getItem('lastMealScannerType');
        if (savedMealType && ['BREAKFAST', 'LUNCH', 'DINNER'].includes(savedMealType)) {
            setSelectedMealType(savedMealType);
        }
    }, [events]);

    const handleEventChange = (event: SelectChangeEvent<number>) => {
        const newId = Number(event.target.value);
        setSelectedEventId(newId);
        setResult(null);
        localStorage.setItem('lastMealScannerEventId', newId.toString());
    };

    const handleMealTypeChange = (event: SelectChangeEvent<string>) => {
        const newVal = event.target.value;
        setSelectedMealType(newVal);
        setResult(null);
        localStorage.setItem('lastMealScannerType', newVal);
    };

    const handleDecode = async (text: string) => {
        if (scanningLoading || result || !selectedEventId || !selectedMealType) return;
        setScanningLoading(true);
        try {
            const qrData = JSON.parse(text);
            if (!qrData.u) throw new Error("Érvénytelen (régi) QR kód formátum! Használd az új, univerzális kódot.");

            // --- JAVÍTVA: Elküldjük a kért étel típusát is a backendnek! ---
            const response = await api.post('/meals/scan', {
                volunteerId: qrData.u,
                eventId: selectedEventId,
                mealType: selectedMealType
            });

            setResult({
                success: true,
                message: response.data.message,
                dietaryPreference: response.data.dietaryPreference
            });
        } catch (err: unknown) {
            if (axios.isAxiosError(err)) {
                setResult({
                    success: false,
                    message: err.response?.data?.message || "Hiba történt a kommunikáció során."
                });
            } else {
                setResult({ success: false, message: "Érvénytelen vagy olvashatatlan QR kód!" });
            }
        } finally {
            setScanningLoading(false);
        }
    };

    const resetScanner = () => setResult(null);

    if (isLoading) {
        return (
            <Container maxWidth="sm" sx={{
                mt: isModalMode ? 1 : 10, mb: isModalMode ? 1 : 4,
                px: isModalMode ? { xs: '24px !important', sm: '32px !important' } : undefined,
                textAlign: 'center', minHeight: isModalMode ? '450px' : 'auto',
                display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center'
            }}>
                <CircularProgress size={50} />
                <Typography mt={3} color="text.secondary" fontWeight="bold">Jogosultságok ellenőrzése...</Typography>
            </Container>
        );
    }

    return (
        <Container
            maxWidth="sm"
            sx={{
                mt: isModalMode ? 1 : 4, mb: isModalMode ? 1 : 4,
                px: isModalMode ? { xs: '24px !important', sm: '32px !important' } : undefined,
                textAlign: 'center'
            }}
        >
            <Typography variant="h4" fontWeight="900" gutterBottom sx={{ fontSize: isModalMode ? '1.5rem' : undefined }}>
                🍽️ Étel Kiadás
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" mb={isModalMode ? 2 : 4}>
                Válaszd ki az eseményt és a menüt!
            </Typography>

            <Stack spacing={2} sx={{ mb: isModalMode ? 3 : 4 }}>
                <FormControl fullWidth>
                    <InputLabel id="event-select-label">Kiválasztott Esemény</InputLabel>
                    <Select
                        labelId="event-select-label"
                        value={selectedEventId as number | ''}
                        label="Kiválasztott Esemény"
                        onChange={handleEventChange}
                        sx={{
                            textAlign: 'left', fontWeight: 'bold', borderRadius: '50px',
                            '& .MuiOutlinedInput-notchedOutline': { borderRadius: '50px' }
                        }}
                    >
                        {events.map((event) => (
                            <MenuItem key={event.id} value={event.id}>
                                {event.title}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <FormControl fullWidth>
                    <InputLabel id="meal-type-label">Kiadandó Étkezés</InputLabel>
                    <Select
                        labelId="meal-type-label"
                        value={selectedMealType}
                        label="Kiadandó Étkezés"
                        onChange={handleMealTypeChange}
                        sx={{
                            textAlign: 'left', fontWeight: 'bold', borderRadius: '50px',
                            '& .MuiOutlinedInput-notchedOutline': { borderRadius: '50px' }
                        }}
                    >
                        <MenuItem value="BREAKFAST">🥐 Reggeli</MenuItem>
                        <MenuItem value="LUNCH">🍲 Ebéd</MenuItem>
                        <MenuItem value="DINNER">🍕 Vacsora</MenuItem>
                    </Select>
                </FormControl>
            </Stack>

            {!result ? (
                <Paper
                    elevation={isModalMode ? 0 : 4}
                    sx={{
                        overflow: 'hidden', borderRadius: 6, border: '4px solid',
                        borderColor: (selectedEventId && selectedMealType) ? '#1976d2' : 'divider',
                        position: 'relative', opacity: (selectedEventId && selectedMealType) ? 1 : 0.5,
                        transition: 'all 0.3s', maxWidth: '350px', margin: '0 auto',
                        minHeight: '300px', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', bgcolor: 'background.paper'
                    }}
                >
                    {(!selectedEventId || !selectedMealType) && (
                        <Box sx={{
                            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            bgcolor: 'rgba(255,255,255,0.7)', zIndex: 10, p: 2
                        }}>
                            <Typography variant="h6" color="primary.main" fontWeight="bold">
                                Kérlek, előbb válassz eseményt és menüt!
                            </Typography>
                        </Box>
                    )}

                    {scanningLoading && (
                        <Box sx={{
                            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            bgcolor: 'rgba(255,255,255,0.8)', zIndex: 10
                        }}>
                            <CircularProgress size={60} />
                        </Box>
                    )}

                    {(selectedEventId && selectedMealType) && (
                        <Scanner
                            onScan={(detectedCodes: IDetectedBarcode[]) => {
                                if (detectedCodes && detectedCodes.length > 0) handleDecode(detectedCodes[0].rawValue);
                            }}
                            onError={(error: unknown) => {
                                if (error instanceof Error) console.log(error.message);
                            }}
                        />
                    )}
                </Paper>
            ) : (
                <Paper
                    elevation={0}
                    sx={{
                        p: isModalMode ? 2 : 4, borderRadius: 4,
                        bgcolor: result.success ? '#e8f5e9' : '#ffebee',
                        border: '2px solid', borderColor: result.success ? '#4caf50' : '#f44336',
                        minHeight: '300px', display: 'flex', flexDirection: 'column',
                        justifyContent: 'center'
                    }}
                >
                    <Box>
                        {result.success ? (
                            <CheckCircleIcon color="success" sx={{ fontSize: 60, mb: 1 }} />
                        ) : (
                            <ErrorIcon color="error" sx={{ fontSize: 60, mb: 1 }} />
                        )}
                    </Box>

                    <Typography variant="h5" fontWeight="bold" color={result.success ? 'success.dark' : 'error.dark'} gutterBottom>
                        {result.success ? 'Sikeres csekkolás!' : 'Elutasítva!'}
                    </Typography>

                    <Alert severity={result.success ? 'success' : 'error'} sx={{ mt: 1, mb: 2, justifyContent: 'center' }}>
                        {result.message}
                    </Alert>

                    {result.success && result.dietaryPreference && (
                        <Box sx={{ p: 2, bgcolor: 'white', borderRadius: 2, mb: 2, boxShadow: 1 }}>
                            <Typography variant="overline" color="text.secondary">Kért Menü:</Typography>
                            <Typography variant="h6" fontWeight="bold" color="primary">{result.dietaryPreference}</Typography>
                        </Box>
                    )}

                    <Button
                        variant="contained" color={result.success ? 'success' : 'error'} size="large" fullWidth
                        onClick={resetScanner} startIcon={<QrCodeScannerIcon />}
                        sx={{ py: 1.5, borderRadius: 2, fontWeight: 'bold', mt: 'auto' }}
                    >
                        Új beolvasás
                    </Button>
                </Paper>
            )}
        </Container>
    );
}