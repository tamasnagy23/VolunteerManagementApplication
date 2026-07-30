import { QRCodeSVG } from 'qrcode.react';
import { Box, Typography, Paper, useTheme, alpha } from '@mui/material';
import { useThemeToggle } from '../theme/ThemeContextProvider';

interface VolunteerQrCodeProps {
    volunteerId: number;
    eventId: number;
    eventName: string;
}

export default function VolunteerQrCode({ volunteerId, eventId, eventName }: VolunteerQrCodeProps) {
    const theme = useTheme();
    const { isDarkMode } = useThemeToggle();

    // Ugyanaz a JSON formátum
    const qrData = JSON.stringify({
        volunteerId: volunteerId,
        eventId: eventId
    });

    return (
        <Paper
            elevation={0}
            sx={{
                p: { xs: 3, md: 4 },
                borderRadius: 4,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                // Sötét módban beleolvad a háttérbe, világosban sima fehér
                bgcolor: isDarkMode ? 'rgba(30, 41, 59, 0.5)' : '#ffffff',
                border: '1px solid',
                borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider',
                maxWidth: 350,
                margin: '0 auto',
                transition: 'all 0.3s ease'
            }}
        >
            <Typography variant="h6" fontWeight="900" gutterBottom align="center" color="primary.main">
                🍽️ Ételkupon
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={3} align="center">
                Mutasd meg ezt a kódot a büfében!<br/>
                <Typography component="span" fontWeight="bold" sx={{ color: 'text.primary', mt: 0.5, display: 'block' }}>
                    {eventName}
                </Typography>
            </Typography>

            <Box
                sx={{
                    p: 2,
                    // A QR kódnak KÖTELEZŐ a fehér háttér a megbízható szkenneléshez
                    bgcolor: '#ffffff',
                    borderRadius: 3,
                    // Sötét módban adunk neki egy finom, a főszínnel megegyező aurát/ragyogást
                    boxShadow: isDarkMode ? `0 0 25px ${alpha(theme.palette.primary.main, 0.2)}` : '0 4px 15px rgba(0,0,0,0.05)',
                    display: 'flex',
                    justifyContent: 'center',
                    border: isDarkMode ? 'none' : '2px solid #e0e0e0',
                }}
            >
                <QRCodeSVG
                    value={qrData}
                    size={200}
                    level="H"
                    includeMargin={false} // Kikapcsolva, mert a Box paddingja adja a margót szebben
                />
            </Box>

            <Typography variant="caption" color="text.secondary" mt={3} align="center" sx={{ px: 2 }}>
                A kód automatikusan érvényesíti a mai műszakjaidat.
            </Typography>
        </Paper>
    );
}