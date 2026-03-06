import { useState, useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
    AppBar, Toolbar, Typography, Button, IconButton, Box,
    BottomNavigation, BottomNavigationAction, Paper, useMediaQuery, useTheme,
    Avatar, Menu, MenuItem, Divider
} from '@mui/material';

// Ikonok
import DashboardIcon from '@mui/icons-material/Dashboard';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';
import SecurityIcon from '@mui/icons-material/Security';
import AccountCircle from '@mui/icons-material/AccountCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsIcon from '@mui/icons-material/Settings';

// Feltételezzük, hogy van egy hookod vagy contexted a userhez,
// ha nincs, ideiglenesen egy prop-ból vagy lokális tárolóból vesszük.
// Itt most egy példa interfészt használok.
interface UserProfile {
    name: string;
    email: string;
    role: 'USER' | 'SYS_ADMIN';
    memberships: Membership[];
}

interface Membership {
    orgId?: number;
    orgName?: string;
    orgRole?: 'OWNER' | 'ORGANIZER' | 'COORDINATOR' | 'VOLUNTEER';
    role?: string; // Néha a backendről simán 'role' kulccsal jön
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'LEFT' | 'REMOVED';
}

export default function Layout() {
    const navigate = useNavigate();
    const location = useLocation();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

    // TODO: Itt kérd le a valós user adataidat a context-ből!
    // Példa statikus adatra a logika teszteléséhez:
    const user = useMemo(() => {
        const userData = localStorage.getItem('user');
        return userData ? (JSON.parse(userData) as UserProfile) : null;
    }, []);

    const handleLogout = () => {
        handleMenuClose();
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/');
    };

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
    const handleMenuClose = () => setAnchorEl(null);

    // --- LOGIKA: KI LÁTHATJA A NAPLÓT? ---
    const canSeeAuditLog = useMemo(() => {
        if (!user) return false;
        if (user.role === 'SYS_ADMIN') return true;
        return user.memberships?.some(m =>
            m.status === 'APPROVED' && (m.orgRole === 'OWNER' || m.orgRole === 'ORGANIZER' || m.role === 'OWNER' || m.role === 'ORGANIZER')
        );
    }, [user]);

    // Dinamikus menüpontok összeállítása
    const navItems = useMemo(() => {
        const items = [
            { label: 'Események', path: '/dashboard', icon: <DashboardIcon /> },
            { label: 'Műszakjaim', path: '/my-shifts', icon: <EventRepeatIcon /> },
        ];

        // Ha vezető, bekerül a Napló is
        if (canSeeAuditLog) {
            items.push({ label: 'Napló', path: '/logs', icon: <SecurityIcon /> });
        }

        return items;
    }, [canSeeAuditLog]);

    const currentTabIndex = navItems.findIndex(item => item.path === location.pathname);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#f5f7fa' }}>

            {/* --- FELSŐ NAVBAR --- */}
            <AppBar
                position="sticky"
                elevation={0}
                sx={{ bgcolor: 'white', color: 'text.primary', borderBottom: '1px solid #e0e0e0', zIndex: 1201 }}
            >
                <Toolbar sx={{ justifyContent: 'space-between' }}>
                    <Typography
                        variant="h6"
                        fontWeight="900"
                        color="primary"
                        sx={{ cursor: 'pointer', letterSpacing: '-1px' }}
                        onClick={() => navigate('/dashboard')}
                    >
                        VOLUNTEER<span style={{ color: '#ff9800' }}>APP</span>
                    </Typography>

                    {/* ASZTALI MENÜ */}
                    {!isMobile && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {navItems.map((item) => (
                                <Button
                                    key={item.label}
                                    color={location.pathname === item.path ? 'primary' : 'inherit'}
                                    onClick={() => navigate(item.path)}
                                    startIcon={item.icon}
                                    sx={{ fontWeight: location.pathname === item.path ? 'bold' : 'normal', borderRadius: 2 }}
                                >
                                    {item.label}
                                </Button>
                            ))}
                            <Divider orientation="vertical" flexItem sx={{ mx: 1, my: 1.5 }} />
                            <IconButton onClick={handleMenuOpen} color="inherit">
                                <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.9rem' }}>
                                    {user?.name?.charAt(0).toUpperCase() || <AccountCircle />}
                                </Avatar>
                            </IconButton>
                        </Box>
                    )}

                    {/* MOBIL PROFIL IKON */}
                    {isMobile && (
                        <IconButton onClick={handleMenuOpen} color="inherit">
                            <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.9rem' }}>
                                {user?.name?.charAt(0).toUpperCase() || <AccountCircle />}
                            </Avatar>
                        </IconButton>
                    )}
                </Toolbar>
            </AppBar>

            {/* --- FŐ TARTALOM --- */}
            <Box component="main" sx={{ flexGrow: 1, pb: isMobile ? '90px' : '30px' }}>
                <Outlet />
            </Box>

            {/* --- MOBIL ALSÓ NAVIGÁCIÓ --- */}
            {isMobile && (
                <Paper
                    sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1200, borderRadius: '20px 20px 0 0', boxShadow: '0 -4px 12px rgba(0,0,0,0.1)' }}
                    elevation={3}
                >
                    <BottomNavigation
                        showLabels
                        value={currentTabIndex !== -1 ? currentTabIndex : false}
                        onChange={(_e, newValue) => navigate(navItems[newValue].path)}
                        sx={{ height: 75, pb: 1 }}
                    >
                        {navItems.map((item) => (
                            <BottomNavigationAction
                                key={item.label}
                                label={item.label}
                                icon={item.icon}
                                sx={{
                                    '&.Mui-selected': { color: 'primary.main' },
                                    color: 'text.secondary'
                                }}
                            />
                        ))}
                    </BottomNavigation>
                </Paper>
            )}

            {/* PROFIL MENÜ */}
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                PaperProps={{ sx: { mt: 1, borderRadius: 3, minWidth: 200, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' } }}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <Box sx={{ px: 2, py: 1.5 }}>
                    <Typography variant="subtitle2" fontWeight="bold">{user?.name || 'Felhasználó'}</Typography>
                    <Typography variant="caption" color="text.secondary">Önkéntes profil</Typography>
                </Box>
                <Divider />
                <MenuItem onClick={() => { handleMenuClose(); navigate('/profile'); }} sx={{ py: 1.2 }}>
                    <SettingsIcon sx={{ mr: 1.5, fontSize: 20, color: 'text.secondary' }} /> Profil szerkesztése
                </MenuItem>
                <MenuItem onClick={handleLogout} sx={{ py: 1.2, color: 'error.main' }}>
                    <LogoutIcon sx={{ mr: 1.5, fontSize: 20 }} /> Kijelentkezés
                </MenuItem>
            </Menu>
        </Box>
    );
}