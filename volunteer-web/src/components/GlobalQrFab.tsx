import { useState, useEffect, useRef } from 'react';
import { Fab, Dialog, DialogContent, Slide, Box, Typography } from '@mui/material';
import QrCodeIcon from '@mui/icons-material/QrCode';
import { type TransitionProps } from '@mui/material/transitions';
import React from 'react';
import api from '../api/axios';

import VolunteerQrCode from './VolunteerQrCode';
import MealScanner from '../components/MealScanner';
import { useThemeToggle } from '../theme/ThemeContextProvider';

interface UserProfile {
    id: number;
    name: string;
    email: string;
    role: 'USER' | 'SYS_ADMIN';
}

// ITT DEFINIÁLJUK, HOGY A TS NE DOBJON HIBÁT
export interface EventOption {
    id: number;
    title: string;
}

const Transition = React.forwardRef(function Transition(
    props: TransitionProps & { children: React.ReactElement<unknown> },
    ref: React.Ref<unknown>,
) {
    return <Slide direction="up" ref={ref} {...props} />;
});

export default function GlobalQrFab() {
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState<'qr' | 'scan'>('qr');
    const { isDarkMode } = useThemeToggle();
    const [containerHeight, setContainerHeight] = useState<number | 'auto'>('auto');

    const [scannerEvents, setScannerEvents] = useState<EventOption[]>([]);
    const [isLoadingEvents, setIsLoadingEvents] = useState(false);

    const qrRef = useRef<HTMLDivElement>(null);
    const scanRef = useRef<HTMLDivElement>(null);

    const [user] = useState<UserProfile | null>(() => {
        try {
            const userData = localStorage.getItem('user');
            return userData ? JSON.parse(userData) : null;
        } catch {
            return null;
        }
    });

    useEffect(() => {
        if (!open || !user) return;

        const fetchAllowedEvents = async () => {
            setIsLoadingEvents(true);
            try {
                const res = await api.get('/meals/scanner-events');

                const validEvents: EventOption[] = Array.isArray(res.data)
                    ? res.data
                    : (res.data?.content || []);

                setScannerEvents(validEvents);

                if (validEvents.length === 0 && mode === 'scan') {
                    setMode('qr');
                }

            } catch (error) {
                console.error("Nem sikerült betölteni a szkennerhez engedélyezett eseményeket", error);
                setScannerEvents([]);
            } finally {
                setIsLoadingEvents(false);
            }
        };

        fetchAllowedEvents();
    }, [open, user]);

    useEffect(() => {
        if (!open) return;
        const updateHeight = () => {
            const activeRef = mode === 'qr' ? qrRef.current : scanRef.current;
            if (activeRef) setContainerHeight(activeRef.scrollHeight);
        };
        const timeoutId = setTimeout(updateHeight, 10);
        const observer = new ResizeObserver(() => updateHeight());
        if (qrRef.current) observer.observe(qrRef.current);
        if (scanRef.current) observer.observe(scanRef.current);

        return () => {
            clearTimeout(timeoutId);
            observer.disconnect();
        };
    }, [mode, open]);

    const handleOpenFab = () => {
        setMode('qr');
        setOpen(true);
    };

    if (!user) return null;

    const canScanMeals = scannerEvents.length > 0;

    return (
        <>
            <Fab
                color="primary" aria-label="qr-code" onClick={handleOpenFab}
                sx={{
                    position: 'fixed', bottom: { xs: 110, md: 30 }, right: { xs: 16, md: 30 },
                    zIndex: 1300, transition: 'transform 0.2s ease',
                    boxShadow: isDarkMode ? '0 8px 25px rgba(129, 140, 248, 0.4)' : '0 8px 25px rgba(25, 118, 210, 0.4)',
                    '&:hover': { transform: 'scale(1.05)' }
                }}
            >
                <QrCodeIcon />
            </Fab>

            <Dialog
                open={open} TransitionComponent={Transition} keepMounted maxWidth="sm" fullWidth
                onClose={() => {
                    setOpen(false);
                    setTimeout(() => setMode('qr'), 300);
                }}
                PaperProps={{
                    elevation: 24,
                    sx: { bgcolor: isDarkMode ? '#0f172a' : '#ffffff', backgroundImage: 'none', borderRadius: 4, overflow: 'hidden' }
                }}
            >
                <DialogContent sx={{ p: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

                    {canScanMeals && !isLoadingEvents && (
                        <Box sx={{
                            p: { xs: 2, sm: 3 }, pb: 1, zIndex: 10, borderBottom: '1px solid',
                            borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'
                        }}>
                            <Box sx={{
                                display: 'flex', position: 'relative', p: '6px',
                                bgcolor: isDarkMode ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.04)', borderRadius: '9999px',
                                border: '1px solid', borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'
                            }}>
                                <Box sx={{
                                    position: 'absolute', top: 6, bottom: 6, width: 'calc(50% - 6px)',
                                    left: mode === 'qr' ? '6px' : 'calc(50%)', borderRadius: '9999px',
                                    bgcolor: isDarkMode ? '#334155' : 'white',
                                    boxShadow: isDarkMode ? 'none' : '0 2px 10px rgba(0,0,0,0.08)',
                                    transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                }} />

                                <Typography onClick={() => setMode('qr')} sx={{
                                    flex: 1, textAlign: 'center', zIndex: 1, cursor: 'pointer', py: 1, fontWeight: '900', fontSize: '0.9rem',
                                    color: mode === 'qr' ? (isDarkMode ? 'white' : 'primary.main') : 'text.secondary', transition: 'color 0.3s'
                                }}>
                                    Saját Kuponom
                                </Typography>
                                <Typography onClick={() => setMode('scan')} sx={{
                                    flex: 1, textAlign: 'center', zIndex: 1, cursor: 'pointer', py: 1, fontWeight: '900', fontSize: '0.9rem',
                                    color: mode === 'scan' ? (isDarkMode ? 'white' : 'success.main') : 'text.secondary', transition: 'color 0.3s'
                                }}>
                                    Pultos Szkenner
                                </Typography>
                            </Box>
                        </Box>
                    )}

                    <Box sx={{
                        position: 'relative', overflow: 'hidden',
                        height: containerHeight === 'auto' ? 'auto' : `${containerHeight}px`,
                        transition: 'height 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}>
                        <Box sx={{
                            display: 'flex', width: '200%', alignItems: 'flex-start',
                            transform: mode === 'qr' ? 'translateX(0)' : 'translateX(-50%)',
                            transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}>
                            <Box ref={qrRef} sx={{ width: '50%', flexShrink: 0, pb: { xs: 3, sm: 4 }, pt: 2, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                <VolunteerQrCode volunteerId={user.id} isModalMode={true} />
                            </Box>

                            <Box ref={scanRef} sx={{ width: '50%', flexShrink: 0, pb: { xs: 4, sm: 5 } }}>
                                {/* ÍME A LÉNYEG: ITT ADJUK ÁT AZ ÚJ PARAMÉTEREKET A SZKENNERNEK */}
                                {mode === 'scan' && (
                                    <MealScanner
                                        isModalMode={true}
                                        events={scannerEvents}
                                        isLoading={isLoadingEvents}
                                    />
                                )}
                            </Box>
                        </Box>
                    </Box>

                </DialogContent>
            </Dialog>
        </>
    );
}