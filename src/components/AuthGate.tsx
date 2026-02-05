import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { supabase } from '../lib/supabaseClient';
import { LogIn, UserPlus } from 'lucide-react';

const AUTH_PATHS = ['/login', '/signup', '/reset-password'];
const DISMISSED_KEY = 'authGateDismissed';

export default function AuthGate() {
  const { user } = useStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [authGateEnabled, setAuthGateEnabled] = useState<boolean | null>(null);
  const [showModal, setShowModal] = useState(false);

  const pathname = location.pathname;
  const isAuthPath = AUTH_PATHS.some((p) => pathname.startsWith(p));
  const dismissed = typeof window !== 'undefined' && sessionStorage.getItem(DISMISSED_KEY) === 'true';
  const prevUserRef = useRef(user);

  // Clear dismissed flag only when user signs out so gate can show again for next guest session
  useEffect(() => {
    if (prevUserRef.current && !user && typeof window !== 'undefined') {
      sessionStorage.removeItem(DISMISSED_KEY);
    }
    prevUserRef.current = user;
  }, [user]);

  useEffect(() => {
    if (user || isAuthPath || dismissed) {
      setAuthGateEnabled(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'auth_gate_enabled')
        .single();
      if (!cancelled) {
        const enabled = data?.value === true || data?.value === 'true';
        setAuthGateEnabled(enabled);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, isAuthPath, dismissed]);

  const handleOverlayClick = () => {
    setShowModal(true);
  };

  const handleSignIn = () => {
    sessionStorage.setItem('returnUrl', pathname + location.search);
    navigate('/login');
    setShowModal(false);
  };

  const handleSignUp = () => {
    sessionStorage.setItem('returnUrl', pathname + location.search);
    navigate('/signup');
    setShowModal(false);
  };

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, 'true');
    setShowModal(false);
  };

  if (user || authGateEnabled === false || authGateEnabled === null || isAuthPath || dismissed) {
    return null;
  }

  if (showModal) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="auth-gate-title">
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={handleDismiss}
          aria-hidden="true"
        />
        <div
          className="relative z-10 w-full max-w-md rounded-2xl bg-gray-900 border border-gray-700 shadow-xl p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id="auth-gate-title" className="text-xl font-bold text-white mb-2 text-center">
            Sign in or create an account
          </h2>
          <p className="text-gray-400 text-sm text-center mb-6">
            Create an account to get the most out of the platform.
          </p>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handleSignIn}
              className="w-full py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <LogIn className="w-5 h-5" />
              Sign In
            </button>
            <button
              type="button"
              onClick={handleSignUp}
              className="w-full py-3 px-4 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-semibold flex items-center justify-center gap-2 transition-colors border border-gray-600"
            >
              <UserPlus className="w-5 h-5" />
              Create account
            </button>
          </div>
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={handleDismiss}
              className="text-gray-500 hover:text-gray-400 text-xs transition-colors py-2 px-3 rounded"
              aria-label="Continue without signing in"
            >
              Ignore or Later
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[99] cursor-pointer"
      onClick={handleOverlayClick}
      aria-hidden="true"
    />
  );
}
