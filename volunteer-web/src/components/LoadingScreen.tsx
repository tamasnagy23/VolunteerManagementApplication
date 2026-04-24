import { Box, Typography, useTheme } from '@mui/material';

export default function LoadingScreen() {
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';

    // Dinamikus betűméret: Mobilon (xs) kisebb, Tableten (sm) közepes, Asztalin (md) nagy
    const titleFontSize = { xs: '2.2rem', sm: '3.5rem', md: '4.5rem' };

    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '80vh',
            width: '100%',
            bgcolor: 'transparent',
            px: 2 // Egy kis belső margó mobilon, hogy semmiképp se érjen a széléhez
        }}>

            <Box sx={{ position: 'relative', display: 'inline-block', textAlign: 'center' }}>

                {/* 1. Háttér / Körvonal szöveg */}
                <Typography
                    variant="h3"
                    fontWeight="900"
                    sx={{
                        fontSize: titleFontSize, // <--- Reszponzív méret!
                        letterSpacing: { xs: '-0.5px', md: '-1px' },
                        color: 'transparent',
                        WebkitTextStroke: isDarkMode ? '1px rgba(255,255,255,0.1)' : '1px rgba(0,0,0,0.1)',
                        userSelect: 'none',
                        lineHeight: 1.2
                    }}
                >
                    VOLUNTEER<Box component="span" sx={{ display: { xs: 'block', sm: 'inline' }, WebkitTextStroke: isDarkMode ? '1px rgba(255,255,255,0.1)' : '1px rgba(0,0,0,0.1)' }}>APP</Box>
                </Typography>

                {/* 2. Lézercsóva (Mozgó animáció) */}
                <Typography
                    variant="h3"
                    fontWeight="900"
                    sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        fontSize: titleFontSize, // <--- Ugyanaz a reszponzív méret
                        letterSpacing: { xs: '-0.5px', md: '-1px' },
                        userSelect: 'none',
                        lineHeight: 1.2,

                        backgroundImage: `linear-gradient(90deg, 
                            transparent 0%, 
                            ${theme.palette.primary.main} 40%, 
                            ${theme.palette.warning.main} 60%, 
                            transparent 100%)`,
                        backgroundSize: '200% auto',
                        color: 'transparent',
                        WebkitBackgroundClip: 'text',
                        backgroundClip: 'text',

                        animation: 'sweep 2.5s linear infinite',
                        filter: isDarkMode ? 'drop-shadow(0 0 8px rgba(129, 140, 248, 0.6))' : 'drop-shadow(0 0 8px rgba(25, 118, 210, 0.4))',

                        '@keyframes sweep': {
                            '0%': { backgroundPosition: '200% center' },
                            '100%': { backgroundPosition: '-200% center' }
                        }
                    }}
                >
                    {/* Mobilon (xs) az APP szót új sorba törjük (display: block), asztalin egy sorban marad (display: inline) */}
                    VOLUNTEER<Box component="span" sx={{ display: { xs: 'block', sm: 'inline' }, color: 'transparent' }}>APP</Box>
                </Typography>
            </Box>

            <Typography
                variant="subtitle2"
                color="text.secondary"
                sx={{
                    mt: { xs: 4, md: 3 }, // Mobilon kicsit távolabb tesszük, ha két sorba törik a logó
                    fontWeight: '900',
                    fontSize: { xs: '0.75rem', sm: '0.875rem' },
                    letterSpacing: '2px',
                    textTransform: 'uppercase',
                    animation: 'pulse 1.5s ease-in-out infinite',
                    '@keyframes pulse': {
                        '0%, 100%': { opacity: 0.4 },
                        '50%': { opacity: 1 }
                    }
                }}
            >
                Adatok betöltése...
            </Typography>
        </Box>
    );
}