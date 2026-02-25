import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import {
    AppBar, Toolbar, Typography, Button, IconButton, Box,
    Drawer, List, ListItem, ListItemButton, ListItemText
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import AccountCircle from '@mui/icons-material/AccountCircle';

export default function Layout() {
    const navigate = useNavigate();
    const [mobileOpen, setMobileOpen] = useState(false);

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/');
    };

    // Itt definiáljuk a menüpontokat
    const navItems = [
        { label: 'Események', path: '/dashboard' },
        { label: 'Szervezetek', path: '/organizations' },
        { label: 'Saját Műszakjaim', path: '/my-shifts' },
        // Később ide jön a 'Profil' is
    ];

    const drawer = (
        <Box onClick={() => setMobileOpen(false)} sx={{ textAlign: 'center' }}>
            <Typography variant="h6" sx={{ my: 2 }}>
                Önkéntes App
            </Typography>
            <List>
                {navItems.map((item) => (
                    <ListItem key={item.label} disablePadding>
                        <ListItemButton onClick={() => navigate(item.path)}>
                            <ListItemText primary={item.label} />
                        </ListItemButton>
                    </ListItem>
                ))}
                <ListItem disablePadding>
                    <ListItemButton onClick={handleLogout}>
                        <ListItemText primary="Kijelentkezés" sx={{ color: 'error.main' }} />
                    </ListItemButton>
                </ListItem>
            </List>
        </Box>
    );

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <AppBar component="nav" position="sticky">
                <Toolbar>
                    {/* HAMBURGER MENÜ (Csak mobilon: xs) */}
                    <IconButton
                        color="inherit"
                        edge="start"
                        onClick={() => setMobileOpen(!mobileOpen)}
                        sx={{ mr: 2, display: { sm: 'none' } }}
                    >
                        <MenuIcon />
                    </IconButton>

                    <Typography
                        variant="h6"
                        component="div"
                        sx={{ flexGrow: 1, cursor: 'pointer' }}
                        onClick={() => navigate('/dashboard')}
                    >
                        Önkéntes Menedzsment
                    </Typography>

                    {/* ASZTALI MENÜ (Mobilon eltűnik) */}
                    <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                        {navItems.map((item) => (
                            <Button key={item.label} sx={{ color: '#fff' }} onClick={() => navigate(item.path)}>
                                {item.label}
                            </Button>
                        ))}

                        {/* Profil ikon (még nem vezet sehova, de ott a helye) */}
                        <IconButton color="inherit" onClick={() => navigate('/profile')}>
                            <AccountCircle />
                        </IconButton>

                        <IconButton color="inherit" onClick={handleLogout} title="Kijelentkezés">
                            <LogoutIcon />
                        </IconButton>
                    </Box>
                </Toolbar>
            </AppBar>

            {/* MOBIL DRAWER (Kicsúszó menü) */}
            <nav>
                <Drawer
                    variant="temporary"
                    open={mobileOpen}
                    onClose={() => setMobileOpen(false)}
                    ModalProps={{ keepMounted: true }}
                    sx={{
                        display: { xs: 'block', sm: 'none' },
                        '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 240 },
                    }}
                >
                    {drawer}
                </Drawer>
            </nav>

            {/* ITT JELENIK MEG AZ AKTUÁLIS OLDAL TARTALMA (Outlet) */}
            <Box component="main" sx={{ flexGrow: 1, p: 0 }}>
                <Outlet />
            </Box>
        </Box>
    );
}