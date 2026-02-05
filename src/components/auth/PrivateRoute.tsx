import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useStore } from '../../store/useStore';

interface PrivateRouteProps {
  children: React.ReactNode;
  roles?: string[];
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children, roles }) => {
  const { user, userProfile } = useStore();
  const location = useLocation();

  // Debug logging
  console.log('🔒 PrivateRoute check:', {
    hasUser: !!user,
    userEmail: user?.email,
    profileType: userProfile?.user_type,
    requiredRoles: roles,
    profileId: userProfile?.id
  });

  if (!user) {
    console.log('❌ No user - redirecting to login');
    // Store the current location as return URL
    const returnUrl = location.pathname + location.search;
    sessionStorage.setItem('returnUrl', returnUrl);
    return <Navigate to="/login" replace />;
  }

  if (roles && roles.length > 0) {
    if (!userProfile) {
      console.log('❌ No user profile - redirecting to home');
      return <Navigate to="/" replace />;
    }

    if (!userProfile.user_type || !roles.includes(userProfile.user_type)) {
      console.log('❌ Insufficient permissions:', {
        userType: userProfile.user_type,
        requiredRoles: roles
      });
      return <Navigate to="/" replace />;
    }
  }

  console.log('✅ Access granted');
  return <>{children}</>;
};

export default PrivateRoute;