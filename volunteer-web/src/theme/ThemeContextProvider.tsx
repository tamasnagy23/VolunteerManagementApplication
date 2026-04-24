/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useState, useMemo, useEffect, useContext } from 'react';
import { ThemeProvider, createTheme, useMediaQuery, CssBaseline, GlobalStyles, Box } from '@mui/material';

export const ThemeContext = createContext({
    isDarkMode: false,
    toggleTheme: () => {}
});

export const useThemeToggle = () => useContext(ThemeContext);

export default function ThemeContextProvider({ children }: { children: React.ReactNode }) {
    const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

    // JAVÍTÁS 1: "Lazy Initialization" a state-nél.
    // Ezzel eltűnik a "set-state-in-effect" hiba, és nincs dupla renderelés induláskor!
    const [mode, setMode] = useState<'light' | 'dark'>(() => {
        const savedMode = localStorage.getItem('themeMode');
        if (savedMode === 'light' || savedMode === 'dark') return savedMode;
        return prefersDarkMode ? 'dark' : 'light';
    });

    // Ha az oprendszer menet közben vált témát (és a user még nem kattintott a gombra), akkor lekövetjük
    useEffect(() => {
        const savedMode = localStorage.getItem('themeMode');
        if (!savedMode) {
            setMode(prefersDarkMode ? 'dark' : 'light');
        }
    }, [prefersDarkMode]);

    const toggleTheme = () => {
        setMode((prevMode) => {
            const newMode = prevMode === 'light' ? 'dark' : 'light';
            localStorage.setItem('themeMode', newMode);
            return newMode;
        });
    };

    const isDarkMode = mode === 'dark';

    // A TE egyedi témád átemelve!
    const theme = useMemo(() => createTheme({
        palette: {
            mode,
            primary: {
                main: isDarkMode ? '#818cf8' : '#4f46e5',
            },
            background: {
                default: isDarkMode ? '#020617' : '#f8fafc',
                paper: isDarkMode ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.8)',
            },
            text: {
                primary: isDarkMode ? '#f8fafc' : '#0f172a',
                secondary: isDarkMode ? '#94a3b8' : '#475569',
            },
        },
        shape: { borderRadius: 12 },
        components: {
            MuiPaper: {
                styleOverrides: {
                    root: {
                        backgroundImage: 'none',
                        backdropFilter: 'blur(20px) saturate(160%)',
                        border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'}`,
                        boxShadow: isDarkMode ? '0 4px 20px rgba(0,0,0,0.4)' : '0 4px 20px rgba(0,0,0,0.05)',
                    },
                },
            },
            MuiButton: {
                styleOverrides: {
                    root: {
                        borderRadius: 8,
                        textTransform: 'none',
                        fontWeight: 600,
                    }
                }
            }
        },
    }), [mode, isDarkMode]);

    return (
        <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
            <ThemeProvider theme={theme}>
                <GlobalStyles styles={{
                    'html, body, #root': {
                        backgroundColor: isDarkMode ? '#020617 !important' : '#f1f5f9 !important',
                        margin: 0,
                        padding: 0,
                        minHeight: '100vh',
                        // JAVÍTÁS 2: Erőszakos kilógás-gátló a legfelső szinten
                        width: '100%',
                        overflowX: 'hidden',
                        transition: 'background-color 0.3s ease'
                    }
                }} />
                <CssBaseline />

                {/* A te egyedi, gyönyörű radial-gradient háttered! */}
                <Box sx={{
                    minHeight: '100vh',
                    width: '100%',
                    // JAVÍTÁS 3: Ebből a dobozból sem folyhat ki semmi!
                    overflowX: 'hidden',
                    background: isDarkMode
                        ? 'radial-gradient(circle at 50% -20%, #1e1b4b 0%, #020617 80%)'
                        : 'radial-gradient(circle at 50% -20%, #e0e7ff 0%, #f1f5f9 80%)',
                    backgroundAttachment: 'fixed',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'background 0.3s ease'
                }}>
                    {children}
                </Box>
            </ThemeProvider>
        </ThemeContext.Provider>
    );
}