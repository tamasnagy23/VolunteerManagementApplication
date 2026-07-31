import { QRCodeSVG } from 'qrcode.react';
import { Box, Typography, Paper, useTheme, alpha } from '@mui/material';
import { useThemeToggle } from '../theme/ThemeContextProvider';

interface VolunteerQrCodeProps {
    volunteerId: number;
    isModalMode?: boolean;
}

export default function VolunteerQrCode({ volunteerId, isModalMode = false }: VolunteerQrCodeProps) {
    const theme = useTheme();
    const { isDarkMode } = useThemeToggle();

    const qrData = JSON.stringify({
        u: volunteerId
    });

    // 1. Kiszervezzük magát a tartalmat (szöveg + QR kód) egy változóba,
    // hogy ne kelljen kétszer leírni a kódot.
    const qrContent = (
        <>
            <Typography variant="h6" fontWeight="900" gutterBottom align="center" color="primary.main">
                🍽️ Univerzális Ételkupon
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={3} align="center">
                Mutasd meg ezt a kódot bármelyik esemény büféjében, ahol be vagy osztva!
            </Typography>

            <Box
                sx={{
                    p: 2,
                    bgcolor: '#ffffff', // A QR kód alatti fehér négyzet marad
                    borderRadius: 3,
                    boxShadow: isDarkMode && !isModalMode ? `0 0 25px ${alpha(theme.palette.primary.main, 0.2)}` : '0 4px 15px rgba(0,0,0,0.05)',
                    display: 'flex',
                    justifyContent: 'center',
                    border: isDarkMode ? 'none' : '2px solid #e0e0e0',
                }}
            >
                <QRCodeSVG
                    value={qrData}
                    size={200}
                    level="L"
                    includeMargin={false}
                />
            </Box>

            <Typography variant="caption" color="text.secondary" mt={3} align="center" sx={{ px: 2 }}>
                Az azonosítód: #{volunteerId}
            </Typography>
        </>
    );

    // 2. HA MODALBAN VAN (A megoldás a kék doboz ellen)
    // Egy teljesen tiszta, formázatlan Box-ba tesszük, amin garantáltan NINCS MUI háttérszín.
    if (isModalMode) {
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', pt: 1 }}>
                {qrContent}
            </Box>
        );
    }

    // 3. HA NORMÁL OLDALON VAN
    // Megkapja a szépen formázott, keretes, hátteres Paper kártyát.
    return (
        <Paper
            elevation={0}
            sx={{
                p: { xs: 3, md: 4 },
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.5)' : '#ffffff',
                border: '1px solid',
                borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider',
                borderRadius: 4,
                maxWidth: 350,
                margin: '0 auto',
            }}
        >
            {qrContent}
        </Paper>
    );
}