import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Categories from './pages/Categories';
import GoLive from './pages/GoLive';
import Schedule from './pages/Schedule';
import Watch from './pages/Watch';
import Stream from './pages/Stream';
import Profile from './pages/Profile';
import Monitoring from './pages/Monitoring';
import UserManagement from './pages/UserManagement';
import MyFavorites from './pages/MyFavorites';
import MyTickets from './pages/MyTickets';
import Help from './pages/Help';
import HelpManagement from './pages/HelpManagement';
import Advertisements from './pages/Advertisements';
import ArtistProfile from './pages/ArtistProfile';
import ArtistManagement from './pages/ArtistManagement';
import CameraTestPage from './pages/CameraTest';
import Search from './pages/Search';
import PhotoManagement from './pages/PhotoManagement';
import RecordingsManagement from './pages/RecordingsManagement';
import TicketsManagement from './pages/TicketsManagement';
import ArtistFollowers from './pages/ArtistFollowers';
import Analytics from './pages/Analytics';
import Cart from './pages/Cart';
import TicketConfirmation from './pages/TicketConfirmation';
import UpcomingConcertsPage from './pages/UpcomingConcerts';
import LiveEvents from './pages/LiveEvents';
import PrivateRoute from './components/auth/PrivateRoute';
import FloatingActions from './components/FloatingActions';
import AuthGate from './components/AuthGate';
import { useStore } from './store/useStore';
import { StreamingProvider } from './contexts/StreamingContext';

// Scroll to top component
function ScrollToTop() {
  const { pathname } = useLocation();
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  
  return null;
}

// Component to conditionally render footer based on location
function ConditionalFooter() {
  const location = useLocation();
  const hideFooter = ['/go-live'].includes(location.pathname);
  
  if (hideFooter) {
    return null;
  }
  
  return <Footer />;
}

function AppContent() {
  const { initialized } = useStore();

  // Show minimal loading if not initialized (fallback)
  if (!initialized) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
          <p className="text-gray-400">Initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <ScrollToTop />
      <AuthGate />
      <div className="min-h-screen bg-gray-900 flex flex-col">
        <Navbar />
        <main className="flex-grow pt-20">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/help" element={<Help />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/ticket-confirmation" element={<TicketConfirmation />} />
            <Route path="/upcoming-concerts" element={<UpcomingConcertsPage />} />
            <Route path="/live-events" element={<LiveEvents />} />
            <Route path="/watch/:id" element={<Watch />} />
            <Route path="/stream/:id" element={<Stream />} />
            <Route path="/artist/:id" element={<ArtistProfile />} />
            <Route path="/camera-test" element={<CameraTestPage />} />
            <Route path="/search" element={<Search />} />
            
            {/* Protected Routes */}
            <Route
              path="/favorites"
              element={
                <PrivateRoute>
                  <MyFavorites />
                </PrivateRoute>
              }
            />
            <Route
              path="/my-tickets"
              element={
                <PrivateRoute>
                  <MyTickets />
                </PrivateRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <PrivateRoute>
                  <Profile />
                </PrivateRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <PrivateRoute roles={['artist', 'global_admin', 'super_admin']}>
                  <Dashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/schedule"
              element={
                <PrivateRoute roles={['artist', 'global_admin', 'super_admin']}>
                  <Schedule />
                </PrivateRoute>
              }
            />
            <Route
              path="/go-live"
              element={
                <PrivateRoute roles={['artist', 'global_admin', 'super_admin']}>
                  <GoLive />
                </PrivateRoute>
              }
            />
            <Route
              path="/followers"
              element={
                <PrivateRoute roles={['artist', 'global_admin', 'super_admin']}>
                  <ArtistFollowers />
                </PrivateRoute>
              }
            />
            <Route
              path="/monitoring"
              element={
                <PrivateRoute roles={['global_admin', 'super_admin']}>
                  <Monitoring />
                </PrivateRoute>
              }
            />
            <Route
              path="/users"
              element={
                <PrivateRoute roles={['global_admin', 'super_admin']}>
                  <UserManagement />
                </PrivateRoute>
              }
            />
            <Route
              path="/advertisements"
              element={
                <PrivateRoute roles={['global_admin', 'super_admin']}>
                  <Advertisements />
                </PrivateRoute>
              }
            />
            <Route
              path="/artist-management"
              element={
                <PrivateRoute roles={['global_admin', 'super_admin']}>
                  <ArtistManagement />
                </PrivateRoute>
              }
            />
            <Route
              path="/help-management"
              element={
                <PrivateRoute roles={['global_admin', 'super_admin']}>
                  <HelpManagement />
                </PrivateRoute>
              }
            />
            <Route
              path="/photo-management"
              element={
                <PrivateRoute roles={['super_admin']}>
                  <PhotoManagement />
                </PrivateRoute>
              }
            />
            <Route
              path="/recordings"
              element={
                <PrivateRoute roles={['global_admin', 'super_admin', 'artist']}>
                  <RecordingsManagement />
                </PrivateRoute>
              }
            />
            <Route
              path="/tickets"
              element={
                <PrivateRoute roles={['global_admin', 'super_admin']}>
                  <TicketsManagement />
                </PrivateRoute>
              }
            />
            <Route
              path="/analytics"
              element={
                <PrivateRoute roles={['global_admin', 'super_admin']}>
                  <Analytics />
                </PrivateRoute>
              }
            />
          </Routes>
        </main>
        <ConditionalFooter />
        <FloatingActions />
      </div>
    </Router>
  );
}

function App() {
  return (
    <StreamingProvider>
      <AppContent />
    </StreamingProvider>
  );
}

export default App;