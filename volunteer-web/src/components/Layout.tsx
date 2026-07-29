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

    // Itt már csak az isDarkMode kell a stílusok miatt, a toggleTheme kikerült
    const { isDarkMode } = useThemeToggle();

    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [user, setUser] = useState<UserProfile | null>(null);

    const navContainerRef = useRef<HTMLDivElement>(null);
    const navTouchStartX = useRef<number | null>(null);
    const [pillDragOffset, setPillDragOffset] = useState<number | null>(null);

    // --- Dinamikus felhasználó figyelő ---
    useEffect(() => {
        const updateUserData = () => {
            const userData = localStorage.getItem('user');
            setUser(userData ? JSON.parse(userData) : null);
        };

        updateUserData(); // Kezdeti betöltés
        window.addEventListener('storage', updateUserData); // Más tabon történő változás
        window.addEventListener('userAvatarUpdated', updateUserData); // Saját esemény

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
            { label: 'Hírfolyam', path: '/dashboard', icon: <DashboardIcon /> },
            { label: 'Műszakjaim', path: '/my-shifts', icon: <EventRepeatIcon /> },
            { label: 'Statisztikák', path: '/statistics', icon: <BarChartIcon /> },
        ];
        if (canSeeAuditLog) {
            items.push({ label: 'Napló', path: '/logs', icon: <SecurityIcon /> });
        }
        return items;
    }, [canSeeAuditLog]);

    const currentTabIndex = navItems.findIndex(item => item.path === location.pathname);
    // --- IDE KERÜLJÖN AZ ÚJ LOGIKA ---
    const [slideDirection, setSlideDirection] = useState(1);
    const prevTabIndex = useRef(currentTabIndex); // Itt már ismeri a currentTabIndex-et!

    useEffect(() => {
        if (currentTabIndex !== -1 && prevTabIndex.current !== -1) {
            if (currentTabIndex > prevTabIndex.current) setSlideDirection(1);
            else if (currentTabIndex < prevTabIndex.current) setSlideDirection(-1);
        }
        prevTabIndex.current = currentTabIndex;
    }, [currentTabIndex]);
    // ---------------------------------

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

    // --- ÚJ: KAPSZULA VALÓS IDEJŰ HÚZÁSA ---
    const handleNavTouchStart = (e: React.TouchEvent) => {
        e.stopPropagation();
        navTouchStartX.current = e.targetTouches[0].clientX;
    };

    const handleNavTouchMove = (e: React.TouchEvent) => {
        if (navTouchStartX.current === null || !navContainerRef.current) return;

        const diffX = e.targetTouches[0].clientX - navTouchStartX.current;

        // Csak akkor lépünk "húzás" módba, ha legalább 5 pixelt elmozdult az ujj
        // (Így a sima rákattintás a gombokra továbbra is hibátlanul működik)
        if (pillDragOffset === null && Math.abs(diffX) < 5) return;

        // Kiszámoljuk a menüsáv és egy gomb pontos pixelszélességét
        const rect = navContainerRef.current.getBoundingClientRect();
        const tabWidth = rect.width / navItems.length;

        // A kapszula eredeti pozíciója (ahonnan a húzást kezdtük)
        const currentBaseX = currentTabIndex * tabWidth;

        let newX = currentBaseX + diffX;

        // Megakadályozzuk, hogy a kapszulát kihúzzuk a képernyőről (Clamp)
        const maxX = rect.width - tabWidth;
        newX = Math.max(0, Math.min(newX, maxX));

        // Beállítjuk a kapszula új, valós idejű pozícióját
        setPillDragOffset(newX);
    };

    const handleNavTouchEnd = () => {
        if (pillDragOffset !== null && navContainerRef.current) {
            const rect = navContainerRef.current.getBoundingClientRect();
            const tabWidth = rect.width / navItems.length;

            // Megnézzük, hol engedte el a felhasználó a kapszulát (a közepe alapján)
            const pillCenter = pillDragOffset + (tabWidth / 2);
            let targetIndex = Math.floor(pillCenter / tabWidth);

            // Biztonsági határok beállítása
            targetIndex = Math.max(0, Math.min(targetIndex, navItems.length - 1));

            // Ha másik fülre húzta, navigálunk
            if (targetIndex !== currentTabIndex) {
                navigate(navItems[targetIndex].path);
            }
        }

        // Húzás befejezése, változók törlése
        navTouchStartX.current = null;
        setPillDragOffset(null);
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
                                    transform: isRootPage ? 'scale(0.8) translateX(-20px)' : 'scale(1) translateX(0)',
                                    transition: 'opacity 0.3s ease, transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                                    willChange: 'opacity, transform'
                                }}
                            >
                                <ArrowBackIosNewIcon fontSize="small" />
                            </IconButton>
                        </Box>

                        {/* --- KÖZÉP: Cím --- */}
                        <Typography
                            variant="h6"
                            fontWeight="900"
                            onClick={() => navigate('/dashboard')}
                            sx={{
                                cursor: 'pointer',
                                letterSpacing: '-1px',
                                color: isDarkMode ? 'white' : 'primary.main',
                                position: 'absolute',
                                left: '50%',
                                transform: isRootPage
                                    ? { xs: 'translateX(calc(16px - 50vw))', md: 'translateX(calc(32px - 50vw))' }
                                    : 'translateX(-50%)',
                                transition: 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                                fontSize: { xs: '1.2rem', sm: '1.25rem' },
                                whiteSpace: 'nowrap',
                                zIndex: 5,
                                willChange: 'transform'
                            }}
                        >
                            VOLUNTEER<span style={{ color: isDarkMode ? '#818cf8' : '#000000' }}>APP</span>
                        </Typography>

                        {/* --- JOBB OLDAL: Ikonok és Asztali Menü --- */}
                        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: { xs: 0.5, sm: 1 }, ml: 'auto', zIndex: 10 }}>
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
                onTouchStart={(isMobile && isRootPage) ? onTouchStart : undefined}
                onTouchMove={(isMobile && isRootPage) ? onTouchMove : undefined}
                onTouchEnd={(isMobile && isRootPage) ? onTouchEnd : undefined}
                sx={{
                    flexGrow: 1,
                    pt: '64px',
                    pb: isMobile ? '100px' : '40px',
                    bgcolor: 'transparent',
                    transform: (isMobile && isRootPage) ? `translateX(${dragX}px)` : 'none',
                    transition: (isMobile && isRootPage) ? getTransitionStyle() : 'none',
                }}
            >
                {/* --- ÚJ: FINOM OLDALVÁLTÁS ANIMÁCIÓ --- */}
                <Box
                    key={location.pathname}
                    sx={{
                        // Gyorsabb, "snappy" animáció
                        animation: 'dynamicSlideIn 0.25s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
                        willChange: 'opacity, transform',
                        '@keyframes dynamicSlideIn': {
                            '0%': {
                                opacity: 0,
                                // A varázslat: az iránytól függően pozitív (jobb) vagy negatív (bal) pixelről indul!
                                transform: `translateX(${slideDirection * 30}px)`
                            },
                            '100%': {
                                opacity: 1,
                                transform: 'translateX(0)'
                            }
                        },
                        height: '100%'
                    }}
                >
                    <Outlet />
                </Box>
            </Box>

            {isMobile && (
                <Slide direction="up" in={true} timeout={400}>
                    <Paper
                        onTouchStart={handleNavTouchStart}
                        onTouchMove={handleNavTouchMove}
                        onTouchEnd={handleNavTouchEnd}
                        sx={{
                            position: 'fixed',
                            bottom: 'calc(16px + env(safe-area-inset-bottom))',
                            left: 16,
                            right: 16,
                            zIndex: 1200,
                            borderRadius: '24px',
                            background: isDarkMode ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.9)',
                            backdropFilter: 'blur(20px)',
                            border: '1px solid',
                            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255,255,255,0.6)',
                            boxShadow: isDarkMode ? '0 10px 40px rgba(0, 0, 0, 0.6)' : '0 10px 40px rgba(0, 0, 0, 0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            height: '70px',
                        }}
                        elevation={0}
                    >
                        {/* IDE KERÜLT A REF: Ez a doboz méri le a szélességet */}
                        <Box ref={navContainerRef} sx={{ position: 'relative', display: 'flex', width: '100%', px: 1, height: '60px', alignItems: 'center' }}>

                            {/* EZ MAGA A HÁTTÉRBEN MOZGÓ KAPSZULA */}
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
                                    // --- VARÁZSLAT ITT ---
                                    // Ha húzzuk (nem null), akkor pixelben követ, különben százalékosan a fülön marad
                                    transform: pillDragOffset !== null
                                        ? `translateX(${pillDragOffset}px)`
                                        : `translateX(${currentTabIndex * 100}%)`,

                                    // Ha húzzuk, kikapcsoljuk az animációt (instant), elengedéskor visszakapcsoljuk (smooth)
                                    transition: pillDragOffset !== null
                                        ? 'none'
                                        : 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease',

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

                            {/* GOMBOK (Ezek maradnak egy helyben a kapszula felett) */}
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
                                            transition: 'color 0.3s ease'
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
                    {/* Profil ikon (lecseréltük, hogy ne fogaskerék legyen) */}
                    <AccountCircle sx={{ mr: 1.5, fontSize: 20, color: 'text.secondary' }} /> Profil szerkesztése
                </MenuItem>

                {/* --- ÚJ GOMB: BEÁLLÍTÁSOK --- */}
                <MenuItem onClick={() => { handleMenuClose(); navigate('/settings'); }} sx={{ py: 1.5 }}>
                    <SettingsIcon sx={{ mr: 1.5, fontSize: 20, color: 'text.secondary' }} /> Beállítások
                </MenuItem>

                <MenuItem onClick={handleLogout} sx={{ py: 1.5, color: 'error.main' }}>
                    <LogoutIcon sx={{ mr: 1.5, fontSize: 20 }} /> Kijelentkezés
                </MenuItem>
            </Menu>
        </Box>
    );
}