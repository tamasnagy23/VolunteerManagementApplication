import { Routes, Route } from 'react-router-dom';
import { CssBaseline } from '@mui/material';

// --- ITT VANNAK AZ IMPORTJAIK ---
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import CreateEvent from './components/CreateEvent'; // <--- EZ HIÁNYZOTT!

function App() {
    return (
        <>
            <CssBaseline />
            <Routes>
                {/* Bejelentkezés */}
                <Route path="/" element={<Login />} />

                {/* Esemény lista */}
                <Route path="/events" element={<Dashboard />} />

                {/* Új esemény létrehozása */}
                <Route path="/create-event" element={<CreateEvent />} />
            </Routes>
        </>
    );
}

export default App;