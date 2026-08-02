import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useOutlet } from 'react-router-dom';
import {
    AppBar, Toolbar, Typography, IconButton, Box,
    Paper, useMediaQuery, useTheme, Avatar, Menu,
    MenuItem, Divider, Slide, Tabs, Tab
} from '@mui/material';

import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';

import DashboardIcon from '@mui/icons-material/Dashboard';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';
import SecurityIcon from '@mui/icons-material/Security';
import AccountCircle from '@mui/icons-material/AccountCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsIcon from '@mui/icons-material/Settings';
import BarChartIcon from '@mui/icons-material/BarChart';
import AssignmentIcon from '@mui/icons-material/Assignment';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';

import { useThemeToggle } from '../theme/ThemeContextProvider';
import GlobalQrFab from '../components/GlobalQrFab';

// ----------------------------------------------------------------------------------
import Dashboard from '../components/Dashboard';
import MyShifts from '../components/MyShifts';
import Statistics from '../components/Statistics';
import Logs from '../components/SystemLogs';
// ----------------------------------------------------------------------------------

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
    const currentOutlet = useOutlet();

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const { isDarkMode } = useThemeToggle();

    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [user, setUser] = useState<UserProfile | null>(null);

    const navContainerRef = useRef<HTMLDivElement>(null);
    const navTouchStartX = useRef<number | null>(null);
    const [pillDragOffset, setPillDragOffset] = useState<number | null>(null);

    // --- BÖNGÉSZŐ NATÍV LAPOZÁSÁNAK LETILTÁSA ---
    // Ez akadályozza meg, hogy a Chrome/Safari ellopja az ujjhúzást a back/forward funkcióhoz
    useEffect(() => {
        document.body.style.overscrollBehaviorX = 'none';
        document.documentElement.style.overscrollBehaviorX = 'none';
        return () => {
            document.body.style.overscrollBehaviorX = 'auto';
            document.documentElement.style.overscrollBehaviorX = 'auto';
        };
    }, []);
    // ---------------------------------------------

    useEffect(() => {
        const updateUserData = () => {
            const userData = localStorage.getItem('user');
            setUser(userData ? JSON.parse(userData) : null);
        };
        updateUserData();
        window.addEventListener('storage', updateUserData);
        window.addEventListener('userAvatarUpdated', updateUserData);
        return () => {
            window.removeEventListener('storage', updateUserData);
            window.removeEventListener('userAvatarUpdated', updateUserData);
        };
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
            { label: 'Hírfolyam', path: '/dashboard', icon: <DashboardIcon />, component: <Dashboard /> },
            { label: 'Műszakjaim', path: '/my-shifts', icon: <EventRepeatIcon />, component: <MyShifts /> },
            { label: 'Statisztikák', path: '/statistics', icon: <BarChartIcon />, component: <Statistics /> },
        ];
        if (canSeeAuditLog) {
            items.push({ label: 'Napló', path: '/logs', icon: <SecurityIcon />, component: <Logs /> });
        }
        return items;
    }, [canSeeAuditLog]);

    const routeIndex = navItems.findIndex(item => item.path === location.pathname);
    const isRootPage = routeIndex !== -1;

    const [tabState, setTabState] = useState({
        path: location.pathname,
        lastIndex: Math.max(0, routeIndex !== -1 ? routeIndex : 0)
    });

    const [frozenOutlet, setFrozenOutlet] = useState({
        path: location.pathname,
        outlet: currentOutlet
    });

    if (location.pathname !== tabState.path) {
        setTabState({
            path: location.pathname,
            lastIndex: isRootPage ? routeIndex : tabState.lastIndex
        });
    }

    if (location.pathname !== frozenOutlet.path) {
        setFrozenOutlet({
            path: location.pathname,
            outlet: isRootPage ? frozenOutlet.outlet : currentOutlet
        });
    }

    const activeTabIndex = isRootPage ? routeIndex : tabState.lastIndex;
    const displayOutlet = !isRootPage ? currentOutlet : frozenOutlet.outlet;

    const dragX = useMotionValue(0);
    const pillX = useTransform(
        dragX,
        navItems.map((_, i) => -i * (typeof window !== 'undefined' ? window.innerWidth : 400)),
        navItems.map((_, i) => `${i * 100}%`)
    );

    useEffect(() => {
        if (isRootPage) {
            animate(dragX, -activeTabIndex * window.innerWidth, { type: 'spring', damping: 30, stiffness: 300 });
        }
    }, [activeTabIndex, isRootPage, dragX]);

    const handleNavTouchStart = (e: React.TouchEvent) => {
        e.stopPropagation();
        navTouchStartX.current = e.targetTouches[0].clientX;
    };

    const handleNavTouchMove = (e: React.TouchEvent) => {
        if (navTouchStartX.current === null || !navContainerRef.current) return;
        const diffX = e.targetTouches[0].clientX - navTouchStartX.current;
        if (pillDragOffset === null && Math.abs(diffX) < 5) return;

        const rect = navContainerRef.current.getBoundingClientRect();
        const tabWidth = rect.width / navItems.length;
        const currentBaseX = activeTabIndex * tabWidth;
        let newX = currentBaseX + diffX;
        const maxX = rect.width - tabWidth;

        newX = Math.max(0, Math.min(newX, maxX));
        setPillDragOffset(newX);
    };

    const handleNavTouchEnd = () => {
        if (pillDragOffset !== null && navContainerRef.current) {
            const rect = navContainerRef.current.getBoundingClientRect();
            const tabWidth = rect.width / navItems.length;
            const pillCenter = pillDragOffset + (tabWidth / 2);
            let targetIndex = Math.floor(pillCenter / tabWidth);
            targetIndex = Math.max(0, Math.min(targetIndex, navItems.length - 1));

            if (targetIndex !== activeTabIndex) navigate(navItems[targetIndex].path);
        }
        navTouchStartX.current = null;
        setPillDragOffset(null);
    };

    const getAvatarUrl = () => {
        if (!user?.profileImageUrl) return undefined;
        const backendBaseUrl = 'http://localhost:8081';
        return user.profileImageUrl.startsWith('http') ? user.profileImageUrl : `${backendBaseUrl}${user.profileImageUrl}`;
    };

    return (
        <Box sx={{
            display: 'flex', flexDirection: 'column', minHeight: '100vh',
            bgcolor: theme.palette.background.default,
            overflowX: 'hidden', overscrollBehaviorX: 'none' // Dupla védelem a böngésző swipe ellen
        }}>

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
                    <Toolbar sx={{ display: 'flex', alignItems: 'center', px: { xs: 2, md: 4 }, minHeight: '64px', position: 'relative' }}>
                        <Box sx={{ width: '48px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', zIndex: 10 }}>
                            <IconButton
                                onClick={() => !isRootPage && navigate(-1)}
                                sx={{
                                    color: isDarkMode ? 'white' : 'primary.main',
                                    opacity: isRootPage ? 0 : 1,
                                    pointerEvents: isRootPage ? 'none' : 'auto',
                                    transform: isRootPage ? 'scale(0.8) translateX(-20px)' : 'scale(1) translateX(0)',
                                    transition: 'opacity 0.3s ease, transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                                    willChange: 'opacity, transform'
                                }}
                            >
                                <ArrowBackIosNewIcon fontSize="small" />
                            </IconButton>
                        </Box>

                        <Typography
                            variant="h6"
                            fontWeight="900"
                            onClick={() => navigate('/dashboard')}
                            sx={{
                                cursor: 'pointer', letterSpacing: '-1px', color: isDarkMode ? 'white' : 'primary.main',
                                position: 'absolute', left: '50%',
                                transform: isRootPage ? { xs: 'translateX(calc(16px - 50vw))', md: 'translateX(calc(32px - 50vw))' } : 'translateX(-50%)',
                                transition: 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                                fontSize: { xs: '1.2rem', sm: '1.25rem' }, whiteSpace: 'nowrap', zIndex: 5, willChange: 'transform'
                            }}
                        >
                            VOLUNTEER<span style={{ color: isDarkMode ? '#818cf8' : '#000000' }}>APP</span>
                        </Typography>

                        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: { xs: 0.5, sm: 1 }, ml: 'auto', zIndex: 10 }}>
                            {!isMobile && (
                                <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
                                    <Tabs
                                        value={isRootPage ? activeTabIndex : false}
                                        onChange={(_e, newValue) => navigate(navItems[newValue].path)}
                                        TabIndicatorProps={{ sx: { backgroundColor: isDarkMode ? '#818cf8' : 'primary.main', height: 3, borderTopLeftRadius: 3, borderTopRightRadius: 3 } }}
                                        sx={{ minHeight: 64 }}
                                    >
                                        {navItems.map((item) => (
                                            <Tab
                                                key={item.label}
                                                label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>{item.icon} {item.label}</Box>}
                                                sx={{ color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'text.secondary', '&.Mui-selected': { color: isDarkMode ? '#818cf8' : 'primary.main', fontWeight: '900' }, textTransform: 'none', fontSize: '0.9rem', minHeight: 64, transition: 'color 0.3s ease' }}
                                            />
                                        ))}
                                    </Tabs>
                                    <Divider orientation="vertical" flexItem sx={{ ml: 2, my: 2, bgcolor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }} />
                                </Box>
                            )}

                            <IconButton onClick={handleMenuOpen} color="inherit" size={isMobile ? "small" : "medium"} sx={{ transition: 'transform 0.3s ease', '&:hover': { transform: 'scale(1.05)' } }}>
                                <Avatar src={getAvatarUrl()} sx={{ width: { xs: 30, sm: 36 }, height: { xs: 30, sm: 36 }, border: '2px solid', borderColor: isDarkMode ? 'rgba(129, 140, 248, 0.5)' : 'primary.main' }}>
                                    {!user?.profileImageUrl && (user?.name?.charAt(0).toUpperCase() || <AccountCircle />)}
                                </Avatar>
                            </IconButton>
                        </Box>
                    </Toolbar>
                </AppBar>
            </Slide>

            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    position: 'relative',
                    width: '100vw',
                    overflowX: 'hidden',
                    touchAction: 'pan-y'
                }}
            >
                {/* --- 1. RÉTEG: A "FILMSZALAG" --- */}
                <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflowX: 'hidden' }}>
                    <motion.div
                        drag={isMobile ? "x" : false}
                        dragConstraints={{ left: -((navItems.length - 1) * window.innerWidth), right: 0 }}
                        dragElastic={0.15}
                        dragDirectionLock={true}
                        style={{
                            x: dragX,
                            display: 'flex',
                            flexWrap: 'nowrap',
                            width: `${navItems.length * 100}vw`,
                            height: '100%',
                            touchAction: 'pan-y'
                        }}
                        onDragEnd={(_e, { offset, velocity }) => {
                            const swipeThreshold = window.innerWidth * 0.15;
                            const swipeVelocity = 200;
                            let newIndex = activeTabIndex;

                            if (offset.x < -swipeThreshold || velocity.x < -swipeVelocity) {
                                if (activeTabIndex < navItems.length - 1) newIndex++;
                            } else if (offset.x > swipeThreshold || velocity.x > swipeVelocity) {
                                if (activeTabIndex > 0) newIndex--;
                            }

                            if (newIndex !== activeTabIndex) {
                                navigate(navItems[newIndex].path);
                            } else {
                                animate(dragX, -activeTabIndex * window.innerWidth, { type: 'spring', damping: 30, stiffness: 300 });
                            }
                        }}
                    >
                        {navItems.map((item) => (
                            <Box
                                key={item.path}
                                sx={{
                                    width: '100vw',
                                    flexShrink: 0,
                                    height: '100%',
                                    pt: '64px',
                                    pb: isMobile ? '100px' : '40px',
                                    overflowY: 'auto',
                                    WebkitOverflowScrolling: 'touch',
                                    boxSizing: 'border-box'
                                }}
                            >
                                {item.component}
                            </Box>
                        ))}
                    </motion.div>
                </Box>

                {/* --- 2. RÉTEG: BELSŐ OLDALAK (Visszatért animáció!) --- */}
                <AnimatePresence>
                    {!isRootPage && (
                        <motion.div
                            key={location.pathname} // <- EZ HIOZTA VISSZA AZ ANIMÁCIÓT!
                            initial={{ x: '100%', boxShadow: '-20px 0 40px rgba(0,0,0,0.3)' }}
                            animate={{ x: '0%', boxShadow: '0px 0 0px rgba(0,0,0,0)' }}
                            exit={{ x: '100%', boxShadow: '-20px 0 40px rgba(0,0,0,0.3)' }}
                            transition={{ type: 'tween', ease: [0.32, 0.72, 0, 1], duration: 0.35 }}
                            style={{
                                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                paddingTop: '64px', paddingBottom: isMobile ? '100px' : '40px',
                                backgroundColor: theme.palette.background.default,
                                zIndex: 50,
                                overflowY: 'auto', WebkitOverflowScrolling: 'touch'
                            }}
                        >
                            {displayOutlet}
                        </motion.div>
                    )}
                </AnimatePresence>
            </Box>

            {isMobile && (
                <Slide direction="up" in={true} timeout={400}>
                    <Paper
                        onTouchStart={handleNavTouchStart}
                        onTouchMove={handleNavTouchMove}
                        onTouchEnd={handleNavTouchEnd}
                        sx={{
                            position: 'fixed', bottom: 'calc(16px + env(safe-area-inset-bottom))', left: 16, right: 16, zIndex: 1200,
                            borderRadius: '24px', background: isDarkMode ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.9)',
                            backdropFilter: 'blur(20px)', border: '1px solid', borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255,255,255,0.6)',
                            boxShadow: isDarkMode ? '0 10px 40px rgba(0, 0, 0, 0.6)' : '0 10px 40px rgba(0, 0, 0, 0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', height: '70px',
                            touchAction: 'none'
                        }}
                        elevation={0}
                    >
                        <Box ref={navContainerRef} sx={{ position: 'relative', display: 'flex', width: '100%', px: 1, height: '60px', alignItems: 'center' }}>
                            <Box sx={{ position: 'absolute', left: 8, right: 8, height: '60px', pointerEvents: 'none', zIndex: 0 }}>
                                <motion.div style={{
                                    width: `${100 / navItems.length}%`, height: '100%',
                                    x: pillX,
                                    opacity: isRootPage ? 1 : 0, padding: '4px'
                                }}>
                                    <Box sx={{ width: '100%', height: '100%', borderRadius: '16px', background: isDarkMode ? 'rgba(129, 140, 248, 0.15)' : 'rgba(25, 118, 210, 0.12)', border: '1px solid', borderColor: isDarkMode ? 'rgba(129, 140, 248, 0.3)' : 'rgba(25, 118, 210, 0.2)' }} />
                                </motion.div>
                            </Box>

                            {navItems.map((item, index) => {
                                const isActive = activeTabIndex === index;
                                return (
                                    <Box
                                        key={item.label} onClick={() => navigate(item.path)}
                                        sx={{
                                            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                            zIndex: 1, cursor: 'pointer', height: '100%',
                                            color: isActive ? (isDarkMode ? '#818cf8' : 'primary.main') : (isDarkMode ? 'rgba(255,255,255,0.4)' : 'text.secondary'),
                                            transition: 'color 0.3s ease'
                                        }}
                                    >
                                        {item.icon}
                                        <Typography variant="caption" sx={{ fontWeight: isActive ? '800' : '500', fontSize: '0.65rem', mt: 0.5 }}>{item.label}</Typography>
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
                        mt: 1.5, borderRadius: 3, minWidth: 220, background: isDarkMode ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                        backdropFilter: 'blur(24px)', border: '1px solid', borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.5)',
                    }
                }}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}
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
                    <AccountCircle sx={{ mr: 1.5, fontSize: 20, color: 'text.secondary' }} /> Profil szerkesztése
                </MenuItem>
                <MenuItem onClick={() => { handleMenuClose(); navigate('/settings'); }} sx={{ py: 1.5 }}>
                    <SettingsIcon sx={{ mr: 1.5, fontSize: 20, color: 'text.secondary' }} /> Beállítások
                </MenuItem>
                <MenuItem onClick={handleLogout} sx={{ py: 1.5, color: 'error.main' }}>
                    <LogoutIcon sx={{ mr: 1.5, fontSize: 20 }} /> Kijelentkezés
                </MenuItem>
            </Menu>
            <GlobalQrFab />
        </Box>
    );
}