import { useState } from 'react';
import { Scanner, type IDetectedBarcode } from '@yudiel/react-qr-scanner';
import { Box, Typography, Button, Paper, Alert, Container, CircularProgress } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import api from '../api/axios'; // Cseréld le a saját axios importodra!
import axios from 'axios';

interface ScanResult {
    success: boolean;
    message: string;
    dietaryPreference?: string;
}

export default function MealScanner() {
    const [result, setResult] = useState<ScanResult | null>(null);
    const [loading, setLoading] = useState(false);

    // Ez fut le, amikor a kamera észrevesz egy QR kódot
    const handleDecode = async (text: string) => {
        // Ha épp töltünk (ne szkenneljen másodpercenként 10-szer)
        if (loading || result) return;

        setLoading(true);
        try {
            // Feltételezzük, hogy a QR kód egy ilyen JSON-t rejt: {"volunteerId": 1, "eventId": 5}
            const qrData = JSON.parse(text);

            if (!qrData.volunteerId || !qrData.eventId) {
                throw new Error("Érvénytelen QR kód formátum!");
            }

            // Backend hívás
            const response = await api.post('/meals/scan', {
                volunteerId: qrData.volunteerId,
                eventId: qrData.eventId
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
                    message: err.response?.data?.message || "Hiba történt a szerverrel való kommunikáció során."
                });
            } else {
                setResult({
                    success: false,
                    message: "Érvénytelen vagy olvashatatlan QR kód!"
                });
            }
        } finally {
            setLoading(false);
        }
    };

    // Visszaállítja a kamerát a következő emberhez
    const resetScanner = () => {
        setResult(null);
    };

    return (
        <Container maxWidth="sm" sx={{ mt: 4, mb: 4, textAlign: 'center' }}>
            <Typography variant="h4" fontWeight="900" gutterBottom>
                🍽️ Étel Kiadás
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" mb={4}>
                Olvasd be az önkéntes QR kódját!
            </Typography>

            {!result ? (
                <Paper
                    elevation={4}
                    sx={{
                        overflow: 'hidden',
                        borderRadius: 4,
                        border: '4px solid #1976d2',
                        position: 'relative'
                    }}
                >
                    {loading && (
                        <Box sx={{
                            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            bgcolor: 'rgba(255,255,255,0.8)', zIndex: 10
                        }}>
                            <CircularProgress size={60} />
                        </Box>
                    )}

                    {/* QR Kamera Komponens */}
                    <Scanner
                        onScan={(detectedCodes: IDetectedBarcode[]) => {
                            if (detectedCodes && detectedCodes.length > 0) {
                                handleDecode(detectedCodes[0].rawValue);
                            }
                        }}
                        onError={(error: unknown) => {
                            if (error instanceof Error) {
                                console.log(error.message);
                            }
                        }}
                    />
                </Paper>
            ) : (
                <Paper
                    elevation={0}
                    sx={{
                        p: 4,
                        borderRadius: 4,
                        bgcolor: result.success ? '#e8f5e9' : '#ffebee',
                        border: '2px solid',
                        borderColor: result.success ? '#4caf50' : '#f44336'
                    }}
                >
                    {result.success ? (
                        <CheckCircleIcon color="success" sx={{ fontSize: 80, mb: 2 }} />
                    ) : (
                        <ErrorIcon color="error" sx={{ fontSize: 80, mb: 2 }} />
                    )}

                    <Typography variant="h5" fontWeight="bold" color={result.success ? 'success.dark' : 'error.dark'} gutterBottom>
                        {result.success ? 'Sikeres csekkolás!' : 'Elutasítva!'}
                    </Typography>

                    <Alert
                        severity={result.success ? 'success' : 'error'}
                        sx={{ mt: 2, mb: 3, justifyContent: 'center', fontSize: '1.1rem' }}
                    >
                        {result.message}
                    </Alert>

                    {result.success && result.dietaryPreference && (
                        <Box sx={{ p: 2, bgcolor: 'white', borderRadius: 2, mb: 3, boxShadow: 1 }}>
                            <Typography variant="overline" color="text.secondary">
                                Kért Menü:
                            </Typography>
                            <Typography variant="h6" fontWeight="bold" color="primary">
                                {result.dietaryPreference}
                            </Typography>
                        </Box>
                    )}

                    <Button
                        variant="contained"
                        color={result.success ? 'success' : 'error'}
                        size="large"
                        fullWidth
                        onClick={resetScanner}
                        startIcon={<QrCodeScannerIcon />}
                        sx={{ py: 2, fontSize: '1.1rem', borderRadius: 2, fontWeight: 'bold' }}
                    >
                        Következő szkennelése
                    </Button>
                </Paper>
            )}
        </Container>
    );
}