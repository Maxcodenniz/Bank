import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import LoadingScreen from './components/LoadingScreen.tsx';
import './index.css';
import { supabase } from './lib/supabaseClient';
import { useStore } from './store/useStore';
import { useState, useEffect } from 'react';

// Console override disabled – in-app log console removed.
// To re-enable for debugging: set ?console=true or localStorage mobileConsoleEnabled=true
// and render <MobileConsole /> in App.tsx

const AppWithLoading = () => {
  const [showLoading, setShowLoading] = useState(true);
  const [appInitialized, setAppInitialized] = useState(false);

  // Initialize auth state
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const initializeAuth = async () => {
      try {
        // Check if this is an email confirmation redirect
        // If so, let SignInForm handle it - don't block here
        const hasHashFragment = window.location.hash.includes('access_token') || window.location.hash.includes('type=signup');
        const urlParams = new URLSearchParams(window.location.search);
        const isEmailConfirmation = hasHashFragment || urlParams.get('confirmed') === 'true';
        
        // For email confirmation, skip blocking auth check - let SignInForm handle it
        if (isEmailConfirmation) {
          console.log('Email confirmation detected - letting SignInForm handle it');
          useStore.getState().setInitialized(true);
          setAppInitialized(true);
          return;
        }
        
        // Add failsafe timeout to prevent infinite loading
        timeoutId = setTimeout(() => {
          console.warn('Auth initialization timeout - proceeding anyway');
          useStore.getState().setInitialized(true);
          setAppInitialized(true);
        }, 3000); // Shorter timeout for normal flow

        // Quick session check (non-blocking)
        const { data: { session } } = await supabase.auth.getSession();
        const store = useStore.getState();
        
        if (session?.user) {
          store.setUser(session.user);
          
          // Try to fetch profile, but don't block if it doesn't exist
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();
              
            if (profile) {
              store.setUserProfile(profile);
            }
          } catch (profileError) {
            // Profile might not exist - that's okay, will be fetched later
            console.log('Profile not found during init, will be fetched later if needed');
          }
        }
        
        store.setInitialized(true);
        clearTimeout(timeoutId);
        setAppInitialized(true);
      } catch (error) {
        console.error('Error initializing auth:', error);
        useStore.getState().setInitialized(true);
        if (timeoutId) clearTimeout(timeoutId);
        setAppInitialized(true);
      }
    };

    initializeAuth();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const handleLoadingComplete = () => {
    setShowLoading(false);
  };

  // Add a maximum loading time to prevent infinite loading
  useEffect(() => {
    const maxLoadingTimer = setTimeout(() => {
      console.warn('Maximum loading time reached - forcing app to render');
      setShowLoading(false);
      if (!appInitialized) {
        useStore.getState().setInitialized(true);
        setAppInitialized(true);
      }
    }, 10000); // 10 seconds maximum

    return () => clearTimeout(maxLoadingTimer);
  }, []);

  // Show loading screen until both auth is initialized and loading animation completes
  if (showLoading || !appInitialized) {
    return <LoadingScreen onLoadingComplete={handleLoadingComplete} />;
  }

  return <App />;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppWithLoading />
  </StrictMode>
);
