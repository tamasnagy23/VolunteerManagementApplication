import { useState, useEffect } from 'react';
import { Scanner, type IDetectedBarcode } from '@yudiel/react-qr-scanner';
import {
    Box, Typography, Button, Paper, Container, CircularProgress,
    FormControl, InputLabel, Select, MenuItem, type SelectChangeEvent, Alert,
    Stack, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import UndoIcon from '@mui/icons-material/Undo';
import api from '../api/axios';
import axios from 'axios';

interface ScanResult {
    success: boolean;
    message: string;
    dietaryPreference?: string;
}

interface EventTimes {
    breakfastStartTime?: string;
    breakfastEndTime?: string;
    lunchStartTime?: string;
    lunchEndTime?: string;
    dinnerStartTime?: string;
    dinnerEndTime?: string;
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
    const [undoLoading, setUndoLoading] = useState(false);

    const [undoDialogOpen, setUndoDialogOpen] = useState(false);

    const [selectedEventId, setSelectedEventId] = useState<number | ''>('');
    const [selectedMealType, setSelectedMealType] = useState<string>('');

    const [lastScannedVolunteerId, setLastScannedVolunteerId] = useState<number | null>(null);

    // --- ÚJ: Az aktuális esemény idősávjainak tárolása ---
    const [activeEventTimes, setActiveEventTimes] = useState<EventTimes | null>(null);

    useEffect(() => {
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

        const savedMealType = localStorage.getItem('lastMealScannerType');
        if (savedMealType && ['BREAKFAST', 'LUNCH', 'DINNER'].includes(savedMealType)) {
            setSelectedMealType(savedMealType);
        }
    }, [events]);

    // --- ÚJ: A kiválasztott esemény időpontjainak lekérése dinamikusan ---
    useEffect(() => {
        if (!selectedEventId) return;
        const fetchEventDetails = async () => {
            try {
                const response = await api.get(`/events/${selectedEventId}`);
                setActiveEventTimes(response.data);
            } catch (err) {
                console.error("Nem sikerült betölteni az esemény időpontjait", err);
            }
        };
        fetchEventDetails();
    }, [selectedEventId]);

    const handleEventChange = (event: SelectChangeEvent<number>) => {
        const newId = Number(event.target.value);
        setSelectedEventId(newId);
        setResult(null);
        setLastScannedVolunteerId(null);
        localStorage.setItem('lastMealScannerEventId', newId.toString());
    };

    const handleMealTypeChange = (event: SelectChangeEvent<string>) => {
        const newVal = event.target.value;
        setSelectedMealType(newVal);
        setResult(null);
        setLastScannedVolunteerId(null);
        localStorage.setItem('lastMealScannerType', newVal);
    };

    // --- ÚJ: Időpont-ellenőrző logika ---
    const isMealActive = (mealType: string) => {
        if (!activeEventTimes) return true; // Ha nincs adat, alapból engedjük

        const now = new Date();
        const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

        const checkRange = (startStr?: string, endStr?: string) => {
            if (!startStr || !endStr) return true; // Ha a szervező nem állított be határidőt, akkor végig aktív
            const [sh, sm] = startStr.split(':').map(Number);
            const [eh, em] = endStr.split(':').map(Number);
            const startTotal = sh * 60 + sm;
            const endTotal = eh * 60 + em;

            if (startTotal <= endTotal) {
                return currentTotalMinutes >= startTotal && currentTotalMinutes <= endTotal;
            } else {
                // Ha átlóg éjfélbe (pl. 22:00 - 02:00)
                return currentTotalMinutes >= startTotal || currentTotalMinutes <= endTotal;
            }
        };

        switch(mealType) {
            case 'BREAKFAST': return checkRange(activeEventTimes.breakfastStartTime, activeEventTimes.breakfastEndTime);
            case 'LUNCH': return checkRange(activeEventTimes.lunchStartTime, activeEventTimes.lunchEndTime);
            case 'DINNER': return checkRange(activeEventTimes.dinnerStartTime, activeEventTimes.dinnerEndTime);
            default: return true;
        }
    };

    const handleDecode = async (text: string) => {
        if (scanningLoading || result || !selectedEventId || !selectedMealType) return;
        setScanningLoading(true);
        try {
            const qrData = JSON.parse(text);
            if (!qrData.u) throw new Error("Érvénytelen (régi) QR kód formátum! Használd az új, univerzális kódot.");

            setLastScannedVolunteerId(qrData.u);

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

    const confirmUndoScan = async () => {
        setUndoDialogOpen(false);
        if (!lastScannedVolunteerId || !selectedEventId || !selectedMealType) return;

        setUndoLoading(true);
        try {
            const response = await api.post('/meals/undo', {
                volunteerId: lastScannedVolunteerId,
                eventId: selectedEventId,
                mealType: selectedMealType
            });

            setResult({
                success: true,
                message: response.data.message,
            });
            setLastScannedVolunteerId(null);
        } catch (err: unknown) {
            if (axios.isAxiosError(err)) {
                alert(err.response?.data?.message || "Hiba a visszavonás során.");
            } else {
                alert("Ismeretlen hiba történt a visszavonás során.");
            }
        } finally {
            setUndoLoading(false);
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
                mt: isModalMode ? 0 : 4,
                mb: isModalMode ? 0 : 4,
                pb: isModalMode ? 3 : 0,
                px: isModalMode ? { xs: '16px !important', sm: '24px !important' } : undefined,
                textAlign: 'center'
            }}
        >
            <Typography variant="h4" fontWeight="900" gutterBottom sx={{ fontSize: isModalMode ? '1.4rem' : undefined, mt: isModalMode ? 1 : 0 }}>
                🍽️ Étel Kiadás
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" mb={isModalMode ? 1.5 : 4}>
                Válaszd ki az eseményt és a menüt!
            </Typography>

            <Stack spacing={isModalMode ? 1.5 : 2} sx={{ mb: isModalMode ? 2 : 4 }}>
                <FormControl fullWidth size={isModalMode ? "small" : "medium"}>
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

                <FormControl fullWidth size={isModalMode ? "small" : "medium"} disabled={!selectedEventId}>
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
                        {/* --- ÚJ: Itt szürkítjük ki és tiltjuk le, ami inaktív --- */}
                        <MenuItem value="BREAKFAST" disabled={!isMealActive('BREAKFAST')}>
                            🥐 Reggeli {!isMealActive('BREAKFAST') && '(Inaktív)'}
                        </MenuItem>
                        <MenuItem value="LUNCH" disabled={!isMealActive('LUNCH')}>
                            🍲 Ebéd {!isMealActive('LUNCH') && '(Inaktív)'}
                        </MenuItem>
                        <MenuItem value="DINNER" disabled={!isMealActive('DINNER')}>
                            🍕 Vacsora {!isMealActive('DINNER') && '(Inaktív)'}
                        </MenuItem>
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
                        minHeight: isModalMode ? 'auto' : '300px',
                        display: 'flex', alignItems: 'center',
                        justifyContent: 'center', bgcolor: 'background.paper',
                        aspectRatio: isModalMode ? '1 / 1' : 'auto'
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
                        minHeight: isModalMode ? 'auto' : '300px',
                        display: 'flex', flexDirection: 'column',
                        justifyContent: 'center',
                        boxSizing: 'border-box'
                    }}
                >
                    <Box>
                        {result.success ? (
                            <CheckCircleIcon color="success" sx={{ fontSize: isModalMode ? 48 : 60, mb: 0.5 }} />
                        ) : (
                            <ErrorIcon color="error" sx={{ fontSize: isModalMode ? 48 : 60, mb: 0.5 }} />
                        )}
                    </Box>

                    <Typography variant={isModalMode ? "h6" : "h5"} fontWeight="bold" color={result.success ? 'success.dark' : 'error.dark'} gutterBottom>
                        {result.success ? 'Sikeres csekkolás!' : 'Elutasítva!'}
                    </Typography>

                    <Alert
                        severity={result.success ? 'success' : 'error'}
                        sx={{ mt: 0.5, mb: 1.5, justifyContent: 'center', whiteSpace: 'pre-line', textAlign: 'center', py: 0 }}
                    >
                        {result.message}
                    </Alert>

                    {result.success && result.dietaryPreference && (
                        <Box sx={{ p: 1.5, bgcolor: 'white', borderRadius: 2, mb: 1.5, boxShadow: 1 }}>
                            <Typography variant="caption" color="text.secondary" display="block">KÉRT MENÜ:</Typography>
                            <Typography variant="h6" fontWeight="bold" color="primary">{result.dietaryPreference}</Typography>
                        </Box>
                    )}

                    <Stack spacing={1} sx={{ mt: 'auto' }}>
                        <Button
                            variant="contained" color={result.success ? 'success' : 'error'} size={isModalMode ? "medium" : "large"} fullWidth
                            onClick={resetScanner} startIcon={<QrCodeScannerIcon />}
                            sx={{ py: isModalMode ? 1 : 1.5, borderRadius: 2, fontWeight: 'bold' }}
                        >
                            Új beolvasás
                        </Button>

                        {/* --- ÚJ: Itt van a Téves beolvasás gomb --- */}
                        {lastScannedVolunteerId && (
                            <Button
                                variant="outlined" color="inherit" size="small" fullWidth
                                onClick={() => setUndoDialogOpen(true)}
                                startIcon={undoLoading ? <CircularProgress size={16} /> : <UndoIcon fontSize="small"/>}
                                disabled={undoLoading}
                                sx={{ py: 0.8, borderRadius: 2, fontWeight: 'bold', color: 'text.secondary', borderColor: 'divider' }}
                            >
                                Téves beolvasás visszavonása
                            </Button>
                        )}
                    </Stack>
                </Paper>
            )}

            <Dialog
                open={undoDialogOpen}
                onClose={() => setUndoDialogOpen(false)}
                PaperProps={{
                    sx: { borderRadius: 3, p: 1, maxWidth: '400px' }
                }}
            >
                <DialogTitle sx={{ fontWeight: 'bold', color: 'error.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ErrorIcon color="error" />
                    Visszavonás megerősítése
                </DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ fontWeight: 'medium' }}>
                        Biztosan vissza akarod vonni az utolsó ételkiadást ennek a személynek?
                        <br /><br />
                        Ez a művelet törli az adatbázisból a beolvasást, így a személy újra jogosult lesz felvenni az ételt.
                    </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setUndoDialogOpen(false)} color="inherit" sx={{ fontWeight: 'bold' }}>
                        Mégsem
                    </Button>
                    <Button onClick={confirmUndoScan} color="error" variant="contained" disableElevation sx={{ fontWeight: 'bold', borderRadius: 2 }}>
                        Igen, visszavonom
                    </Button>
                </DialogActions>
            </Dialog>

        </Container>
    );
}