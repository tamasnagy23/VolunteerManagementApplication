import { Routes, Route } from 'react-router-dom';
import { CssBaseline } from '@mui/material';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import CreateEvent from './components/CreateEvent';
import Register from './components/Register';
import EventDetails from "./components/EventDetails.tsx";
import MyShifts from "./components/MyShifts.tsx";
import MyTeam from "./components/MyTeam.tsx";
import ManageApplications from "./components/ManageApplications.tsx";
import Layout from './components/Layout';
import Profile from "./components/Profile.tsx";
import SystemLogs from "./components/SystemLogs.tsx";
import ShiftManager from "./components/ShiftManager.tsx";
import EventTeamManager from "./components/EventTeamManager.tsx"; // <--- 1. ÚJ IMPORT (Ellenőrizd az elérési utat!)

function App() {
    return (
        <>
            <CssBaseline />
            <Routes>
                {/* --- PUBLIKUS OLDALAK (Nincs menüsor) --- */}
                <Route path="/" element={<Login />} />
                <Route path="/register" element={<Register />} />

                {/* --- VÉDETT OLDALAK (Van menüsor - Layout) --- */}
                {/* Minden, ami ezen belül van, megkapja a felső menüt */}
                <Route element={<Layout />}>

                    {/* Fontos: A Layout-ban '/dashboard'-ra linkeltünk, ezért itt is átírtam '/events'-ről */}
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/create-event" element={<CreateEvent />} />
                    <Route path="/edit-event/:id" element={<CreateEvent />} />
                    <Route path="/events/:id" element={<EventDetails />} />
                    <Route path="/my-shifts" element={<MyShifts />} />
                    <Route path="/team" element={<MyTeam />} />
                    <Route path="/events/:id/applications" element={<ManageApplications />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/logs" element={<SystemLogs />} />
                    <Route path="/events/:id/shifts" element={<ShiftManager />} />
                    <Route path="/events/:id/team" element={<EventTeamManager />} />
                </Route>

            </Routes>
        </>
    );
}

export default App;