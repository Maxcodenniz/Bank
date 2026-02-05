import React from 'react';
import { Navigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import SignInForm from '../components/auth/SignInForm';

const SignIn: React.FC = () => {
  const { user, userProfile } = useStore();

  // If user is already logged in, redirect appropriately
  if (user) {
    // Check for return URL
    const returnUrl = sessionStorage.getItem('returnUrl');
    if (returnUrl && returnUrl !== '/login' && returnUrl !== '/signup') {
      sessionStorage.removeItem('returnUrl');
      return <Navigate to={returnUrl} replace />;
    }
    
    // Default redirects based on user type
    const userType = userProfile?.user_type;
    const isAdmin = userType === 'global_admin' || userType === 'super_admin';
    const isArtist = userType === 'artist';
    
    if (isAdmin || isArtist) {
      return <Navigate to="/dashboard" replace />;
    }
    
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 flex items-center justify-center px-4 pt-24 relative overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>
      <div className="relative z-10 w-full max-w-md">
        <SignInForm />
      </div>
    </div>
  );
};

export default SignIn;