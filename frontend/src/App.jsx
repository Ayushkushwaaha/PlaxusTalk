import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './lib/AuthContext';
import { ThemeProvider } from './lib/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import NotificationBanner from './components/NotificationBanner';
import HomePage from './pages/HomePage';
import RoomPage from './pages/RoomPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ProfilePage from './pages/ProfilePage';
import CallHistoryPage from './pages/CallHistoryPage';
import FriendsPage from './pages/FriendsPage';
import AdminPage from './pages/AdminPage';
import DecentralizedProfilePage from './pages/DecentralizedProfilePage';
import GroupRoomPage from './pages/GroupRoomPage';


export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <div className="noise-overlay min-h-screen">
          <Routes>
            <Route path="/login"   element={<LoginPage />} />
            <Route path="/signup"  element={<SignupPage />} />
            <Route path="/"        element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
            <Route path="/room/:roomId" element={<ProtectedRoute><RoomPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/profile/web3" element={<ProtectedRoute><DecentralizedProfilePage /></ProtectedRoute>} />
            <Route path="/history" element={<ProtectedRoute><CallHistoryPage /></ProtectedRoute>} />
            <Route path="/friends" element={<ProtectedRoute><FriendsPage /></ProtectedRoute>} />
            <Route path="/admin"   element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
            <Route path="*"        element={<Navigate to="/" replace />} />
            <Route path="/group/:roomId" element={<ProtectedRoute><GroupRoomPage /></ProtectedRoute>
} />
          </Routes>
          <NotificationBanner />
        </div>
      </AuthProvider>
    </ThemeProvider>
  );
}
