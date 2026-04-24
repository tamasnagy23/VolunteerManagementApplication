import { useState, useMemo, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
    AppBar, Toolbar, Typography, IconButton, Box,
    Paper, useMediaQuery, useTheme, Avatar, Menu,
    MenuItem, Divider, Slide, Tabs, Tab
} from '@mui/material';

import DashboardIcon from '@mui/icons-material/Dashboard';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';
import SecurityIcon from '@mui/icons-material/Security';
import AccountCircle from '@mui/icons-material/AccountCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsIcon from '@mui/icons-material/Settings';
import BarChartIcon from '@mui/icons-material/BarChart';
import AssignmentIcon from '@mui/icons-material/Assignment';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';

import { useThemeToggle } from '../theme/ThemeContextProvider';

interface UserProfile {
    name: string;
    email: string;
    role: 'USER' | 'SYS_ADMIN';
    profileImageUrl?: string;
    memberships: Membership[];
}

interface Membership {
    orgId?: number;
    orgName?: string;
    orgRole?: 'OWNER' | 'ORGANIZER' | 'COORDINATOR' | 'VOLUNTEER';
    role?: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'LEFT' | 'REMOVED';
}

export default function Layout() {
    const navigate = useNavigate();
    const location = useLocation();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const { isDarkMode, toggleTheme } = useThemeToggle();

    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [user, setUser] = useState<UserProfile | null>(() => {
        const userData = localStorage.getItem('user');
        return userData ? (JSON.parse(userData) as UserProfile) : null;
    });

    useEffect(() => {
        const handleUserUpdate = () => {
            const userData = localStorage.getItem('user');
            setUser(userData ? JSON.parse(userData) : null);
        };
        window.addEventListener('userAvatarUpdated', handleUserUpdate);
        return () => window.removeEventListener('userAvatarUpdated', handleUserUpdate);
    }, []);

    const handleLogout = () => {
        handleMenuClose();
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/');
    };

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
    const handleMenuClose = () => setAnchorEl(null);

    const canSeeAuditLog = useMemo(() => {
        if (!user) return false;
        if (user.role === 'SYS_ADMIN') return true;
        return user.memberships?.some(m =>
            m.status === 'APPROVED' && (m.orgRole === 'OWNER' || m.orgRole === 'ORGANIZER' || m.role === 'OWNER' || m.role === 'ORGANIZER')
        );
    }, [user]);

    const navItems = useMemo(() => {
        const items = [
            { label: 'Események', path: '/dashboard', icon: <DashboardIcon /> },
            { label: 'Műszakjaim', path: '/my-shifts', icon: <EventRepeatIcon /> },
            { label: 'Statisztikák', path: '/statistics', icon: <BarChartIcon /> },
        ];
        if (canSeeAuditLog) {
            items.push({ label: 'Napló', path: '/logs', icon: <SecurityIcon /> });
        }
        return items;
    }, [canSeeAuditLog]);

    const currentTabIndex = navItems.findIndex(item => item.path === location.pathname);

    const rootPaths = ['/dashboard', '/my-shifts', '/statistics', '/logs'];
    const isRootPage = rootPaths.includes(location.pathname);

    const [dragX, setDragX] = useState(0);
    const [swipeState, setSwipeState] = useState<'idle' | 'dragging' | 'out' | 'preparing_in' | 'in'>('idle');

    const touchStartX = useRef<number | null>(null);
    const touchStartY = useRef<number | null>(null);

    const onTouchStart = (e: React.TouchEvent) => {
        if (swipeState !== 'idle') return;
        touchStartX.current = e.targetTouches[0].clientX;
        touchStartY.current = e.targetTouches[0].clientY;
        setSwipeState('dragging');
    };

    const onTouchMove = (e: React.TouchEvent) => {
        if (swipeState !== 'dragging' || !touchStartX.current || !touchStartY.current) return;

        const currentX = e.targetTouches[0].clientX;
        const currentY = e.targetTouches[0].clientY;
        const diffX = currentX - touchStartX.current;
        const diffY = currentY - touchStartY.current;

        if (Math.abs(diffY) > Math.abs(diffX)) {
            setSwipeState('idle');
            setDragX(0);
            return;
        }

        setDragX(diffX);
    };

    const onTouchEnd = () => {
        if (swipeState !== 'dragging') return;
        const threshold = window.innerWidth * 0.25;

        if (Math.abs(dragX) > threshold) {
            const isLeftSwipe = dragX < 0;
            let newIndex = currentTabIndex;

            if (isLeftSwipe && currentTabIndex < navItems.length - 1) newIndex++;
            if (!isLeftSwipe && currentTabIndex > 0) newIndex--;

            if (newIndex !== currentTabIndex) {
                setSwipeState('out');
                setDragX(isLeftSwipe ? -window.innerWidth : window.innerWidth);

                setTimeout(() => {
                    setSwipeState('preparing_in');
                    setDragX(isLeftSwipe ? window.innerWidth : -window.innerWidth);
                    navigate(navItems[newIndex].path);

                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            setSwipeState('in');
                            setDragX(0);
                            setTimeout(() => setSwipeState('idle'), 300);
                        });
                    });
                }, 250);
                return;
            }
        }

        setSwipeState('in');
        setDragX(0);
        setTimeout(() => setSwipeState('idle'), 300);
    };

    const getAvatarUrl = () => {
        if (!user?.profileImageUrl) return undefined;
        const backendBaseUrl = 'http://localhost:8081';
        return user.profileImageUrl.startsWith('http') ? user.profileImageUrl : `${backendBaseUrl}${user.profileImageUrl}`;
    };

    const getTransitionStyle = () => {
        if (swipeState === 'dragging' || swipeState === 'preparing_in') return 'none';
        if (swipeState === 'out') return 'transform 0.25s ease-in';
        if (swipeState === 'in') return 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)';
        return 'none';
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'transparent', scrollbarGutter: 'stable', overflowX: 'hidden' }}>

            <Slide direction="down" in={true} timeout={400}>
                <AppBar
                    position="fixed"
                    elevation={0}
                    sx={{
                        width: '100vw', left: 0, right: 0,
                        background: isDarkMode
                            ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 41, 59, 0.65) 100%)'
                            : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.75) 100%)',
                        backdropFilter: 'blur(24px)',
                        borderBottom: '1px solid',
                        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.6)',
                        zIndex: 1201,
                        color: isDarkMode ? 'white' : 'text.primary'
                    }}
                >
                    <Toolbar sx={{
                        display: 'flex',
                        alignItems: 'center',
                        px: { xs: 2, md: 4 },
                        minHeight: '64px',
                        position: 'relative'
                    }}>

                        {/* --- BAL OLDAL: Vissza gomb konténer --- */}
                        <Box sx={{ width: '48px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', zIndex: 10 }}>
                            <IconButton
                                onClick={() => !isRootPage && navigate(-1)}
                                sx={{
                                    color: isDarkMode ? 'white' : 'primary.main',
                                    opacity: isRootPage ? 0 : 1,
                                    pointerEvents: isRootPage ? 'none' : 'auto',
                                    // JAVÍTÁS: Szép "beúszó" effekt a nyílnak
                                    transform: isRootPage ? 'scale(0.8) translateX(-20px)' : 'scale(1) translateX(0)',
                                    transition: 'opacity 0.3s ease, transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                                    willChange: 'opacity, transform'
                                }}
                            >
                                <ArrowBackIosNewIcon fontSize="small" />
                            </IconButton>
                        </Box>

                        {/* --- KÖZÉP: Cím (SZIGORÚAN CSAK GPU ANIMÁCIÓ) --- */}
                        <Typography
                            variant="h6"
                            fontWeight="900"
                            onClick={() => navigate('/dashboard')}
                            sx={{
                                cursor: 'pointer',
                                letterSpacing: '-1px',
                                color: isDarkMode ? 'white' : 'primary.main',
                                // Fixen lerögzítjük középre
                                position: 'absolute',
                                left: '50%',
                                // A Varázslat: Ha a gyökér oldalon van, a videókártya segítségével eltoljuk a bal szélre (16px a mobil margin). Ha aloldalon, akkor a saját szélességének felével (-50%) pontosan középre igazítjuk.
                                transform: isRootPage
                                    ? { xs: 'translateX(calc(16px - 50vw))', md: 'translateX(calc(32px - 50vw))' }
                                    : 'translateX(-50%)',
                                transition: 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                                fontSize: { xs: '1.2rem', sm: '1.25rem' },
                                whiteSpace: 'nowrap',
                                zIndex: 5,
                                willChange: 'transform' // Megtiltjuk a layout újraszámolást, csak GPU-t használ
                            }}
                        >
                            VOLUNTEER<span style={{ color: isDarkMode ? '#818cf8' : '#f59e0b' }}>APP</span>
                        </Typography>

                        {/* --- JOBB OLDAL: Ikonok és Asztali Menü --- */}
                        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: { xs: 0.5, sm: 1 }, ml: 'auto', zIndex: 10 }}>
                            <IconButton
                                onClick={toggleTheme}
                                color="inherit"
                                size={isMobile ? "small" : "medium"}
                                sx={{
                                    transition: 'transform 0.4s ease',
                                    '&:hover': { transform: 'rotate(180deg)' }
                                }}
                            >
                                <Brightness4Icon fontSize={isMobile ? "small" : "medium"} />
                            </IconButton>

                            {!isMobile && (
                                <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
                                    <Tabs
                                        value={currentTabIndex !== -1 ? currentTabIndex : false}
                                        onChange={(_e, newValue) => navigate(navItems[newValue].path)}
                                        TabIndicatorProps={{
                                            sx: {
                                                backgroundColor: isDarkMode ? '#818cf8' : 'primary.main',
                                                height: 3, borderTopLeftRadius: 3, borderTopRightRadius: 3,
                                            }
                                        }}
                                        sx={{ minHeight: 64 }}
                                    >
                                        {navItems.map((item) => (
                                            <Tab
                                                key={item.label}
                                                label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>{item.icon} {item.label}</Box>}
                                                sx={{
                                                    color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'text.secondary',
                                                    '&.Mui-selected': { color: isDarkMode ? '#818cf8' : 'primary.main', fontWeight: '900' },
                                                    textTransform: 'none', fontSize: '0.9rem', minHeight: 64, transition: 'color 0.3s ease',
                                                }}
                                            />
                                        ))}
                                    </Tabs>
                                    <Divider orientation="vertical" flexItem sx={{ ml: 2, my: 2, bgcolor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }} />
                                </Box>
                            )}

                            <IconButton
                                onClick={handleMenuOpen}
                                color="inherit"
                                size={isMobile ? "small" : "medium"}
                                sx={{ transition: 'transform 0.3s ease', '&:hover': { transform: 'scale(1.05)' } }}
                            >
                                <Avatar
                                    src={getAvatarUrl()}
                                    sx={{
                                        width: { xs: 30, sm: 36 },
                                        height: { xs: 30, sm: 36 },
                                        border: '2px solid',
                                        borderColor: isDarkMode ? 'rgba(129, 140, 248, 0.5)' : 'primary.main',
                                    }}
                                >
                                    {!user?.profileImageUrl && (user?.name?.charAt(0).toUpperCase() || <AccountCircle />)}
                                </Avatar>
                            </IconButton>
                        </Box>
                    </Toolbar>
                </AppBar>
            </Slide>

            <Box
                component="main"
                onTouchStart={isMobile ? onTouchStart : undefined}
                onTouchMove={isMobile ? onTouchMove : undefined}
                onTouchEnd={isMobile ? onTouchEnd : undefined}
                sx={{
                    flexGrow: 1,
                    pt: '64px',
                    pb: isMobile ? '100px' : '40px',
                    bgcolor: 'transparent',
                    transform: isMobile ? `translateX(${dragX}px)` : 'none',
                    transition: isMobile ? getTransitionStyle() : 'none',
                    animation: isMobile ? 'none' : 'fadeIn 0.3s ease-out forwards',
                    '@keyframes fadeIn': { '0%': { opacity: 0 }, '100%': { opacity: 1 } }
                }}
            >
                <Outlet />
            </Box>

            {isMobile && (
                <Slide direction="up" in={true} timeout={400}>
                    <Paper
                        sx={{
                            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1200,
                            borderRadius: '24px 24px 0 0',
                            background: isDarkMode
                                ? 'rgba(10, 15, 30, 0.85)'
                                : 'rgba(255, 255, 255, 0.9)',
                            backdropFilter: 'blur(20px)',
                            borderTop: '1px solid',
                            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255,255,255,0.6)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            height: '75px', pb: 'env(safe-area-inset-bottom)',
                        }}
                        elevation={0}
                    >
                        <Box sx={{ position: 'relative', display: 'flex', width: '100%', px: 1, height: '60px', alignItems: 'center' }}>
                            <Box sx={{
                                position: 'absolute',
                                left: 8, right: 8,
                                height: '60px',
                                pointerEvents: 'none',
                                zIndex: 0
                            }}>
                                <Box sx={{
                                    width: `${100 / navItems.length}%`,
                                    height: '100%',
                                    transform: `translateX(${currentTabIndex * 100}%)`,
                                    transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease',
                                    opacity: currentTabIndex === -1 ? 0 : 1,
                                    p: '4px'
                                }}>
                                    <Box sx={{
                                        width: '100%', height: '100%',
                                        borderRadius: '16px',
                                        background: isDarkMode ? 'rgba(129, 140, 248, 0.15)' : 'rgba(25, 118, 210, 0.12)',
                                        border: '1px solid',
                                        borderColor: isDarkMode ? 'rgba(129, 140, 248, 0.3)' : 'rgba(25, 118, 210, 0.2)',
                                    }} />
                                </Box>
                            </Box>

                            {navItems.map((item, index) => {
                                const isActive = currentTabIndex === index;
                                return (
                                    <Box
                                        key={item.label}
                                        onClick={() => navigate(item.path)}
                                        sx={{
                                            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                            zIndex: 1, cursor: 'pointer', height: '100%',
                                            color: isActive
                                                ? (isDarkMode ? '#818cf8' : 'primary.main')
                                                : (isDarkMode ? 'rgba(255,255,255,0.4)' : 'text.secondary'),
                                            transition: 'all 0.3s ease'
                                        }}
                                    >
                                        {item.icon}
                                        <Typography variant="caption" sx={{
                                            fontWeight: isActive ? '800' : '500',
                                            fontSize: '0.65rem',
                                            mt: 0.5,
                                        }}>
                                            {item.label}
                                        </Typography>
                                    </Box>
                                );
                            })}
                        </Box>
                    </Paper>
                </Slide>
            )}

            <Menu
                anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}
                PaperProps={{
                    sx: {
                        mt: 1.5, borderRadius: 3, minWidth: 220,
                        background: isDarkMode ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                        backdropFilter: 'blur(24px)',
                        border: '1px solid',
                        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.5)',
                    }
                }}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <Box sx={{ px: 2, py: 1.5 }}>
                    <Typography variant="subtitle2" fontWeight="800" color="text.primary">{user?.name || 'Felhasználó'}</Typography>
                    <Typography variant="caption" color="text.secondary">{user?.role === 'SYS_ADMIN' ? 'Rendszergazda' : 'Önkéntes profil'}</Typography>
                </Box>

                <Divider sx={{ borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'divider' }} />

                <MenuItem onClick={() => { handleMenuClose(); navigate('/my-applications'); }} sx={{ py: 1.5 }}>
                    <AssignmentIcon sx={{ mr: 1.5, fontSize: 20, color: 'text.secondary' }} /> Jelentkezéseim
                </MenuItem>

                <MenuItem onClick={() => { handleMenuClose(); navigate('/profile'); }} sx={{ py: 1.5 }}>
                    <SettingsIcon sx={{ mr: 1.5, fontSize: 20, color: 'text.secondary' }} /> Profil szerkesztése
                </MenuItem>

                <MenuItem onClick={handleLogout} sx={{ py: 1.5, color: 'error.main' }}>
                    <LogoutIcon sx={{ mr: 1.5, fontSize: 20 }} /> Kijelentkezés
                </MenuItem>
            </Menu>
        </Box>
    );
}