import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
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
import Navbar from './components/Navbar';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import IncomingCallAlert from './components/IncomingCallAlert';
import NotificationPermissionBanner from './components/NotificationPermissionBanner';
import { getSocket } from './lib/socket';

// ── Inner app — has access to AuthContext ─────────────────────────────────────
function AppInner() {
  const { user } = useAuth();
  const socket   = getSocket();

  // Register user with socket when logged in so friends can call you
  useEffect(() => {
    if (!user?.id) return;

    // Connect socket if not connected
    if (!socket.connected) socket.connect();

    // Register this user so backend knows their socketId
    socket.emit('register-user', { userId: user.id });

    // Re-register on reconnect (e.g. after network drop)
    const onReconnect = () => socket.emit('register-user', { userId: user.id });
    socket.on('connect', onReconnect);

    return () => socket.off('connect', onReconnect);
  }, [user?.id, socket]);

  return (
    <div className="noise-overlay min-h-screen">
      <Routes>
        <Route path="/login"           element={<LoginPage />} />
        <Route path="/signup"          element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="/room/:roomId"    element={<ProtectedRoute><RoomPage /></ProtectedRoute>} />
        <Route path="/group/:roomId"   element={<ProtectedRoute><GroupRoomPage /></ProtectedRoute>} />
        <Route path="/profile"         element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/profile/web3"    element={<ProtectedRoute><DecentralizedProfilePage /></ProtectedRoute>} />
        <Route path="/history"         element={<ProtectedRoute><CallHistoryPage /></ProtectedRoute>} />
        <Route path="/friends"         element={<ProtectedRoute><FriendsPage /></ProtectedRoute>} />
        <Route path="/admin"           element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
        <Route path="*"                element={<Navigate to="/" replace />} />
      </Routes>

      {/* Global banners and alerts — visible on all pages */}
      <NotificationBanner />

      {/* Shows incoming call popup when a friend calls you */}
      <IncomingCallAlert />

      {/* Shows "Enable notifications" banner to allow push notifications */}
      <NotificationPermissionBanner />
    </div>
  );
}

// ── Root app — provides context ───────────────────────────────────────────────
export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </ThemeProvider>
  );
}
