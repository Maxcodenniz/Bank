import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { Lock, Mail, Eye, EyeOff, Phone } from 'lucide-react';
import PhoneInput, { type PhoneValue } from '../PhoneInput';
import { formatFullPhone } from '../../utils/phoneCountryCodes';
import { AuthError } from '@supabase/supabase-js';
import { useStore } from '../../store/useStore';
import { logAuthEvent } from '../../utils/authLogger';
import OTPVerification from '../OTPVerification';

const SignInForm: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { setUser, setUserProfile } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
  const [showOTP, setShowOTP] = useState(false);
  const [otpPhone, setOtpPhone] = useState<string>('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    phone: { dialCode: '+33', localNumber: '' } as PhoneValue,
  });

  // Listen for auth state changes (to detect session creation from email confirmation)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.email);
      
      if (event === 'SIGNED_IN' && session?.user) {
        // User was signed in (possibly from email confirmation)
        const confirmed = searchParams.get('confirmed');
        
        // Always update user state when signed in
        setUser(session.user);
        
        // Fetch profile with retry
        let profile = null;
        let retries = 0;
        const maxRetries = 10;
        
        while (!profile && retries < maxRetries) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          if (profileData) {
            profile = profileData;
            break;
          }
          
          await new Promise(resolve => setTimeout(resolve, 500 * (retries + 1)));
          retries++;
        }
        
        if (profile) {
          setUserProfile(profile);
          
          // If this was from email confirmation, redirect
          if (confirmed === 'true') {
            const userType = profile.user_type;
            const isAdmin = userType === 'global_admin' || userType === 'super_admin';
            const isArtist = userType === 'artist';
            const redirectTo = (isAdmin || isArtist) ? '/dashboard' : '/';
            navigate(redirectTo, { replace: true });
          }
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [searchParams, setUser, setUserProfile, navigate]);

  useEffect(() => {
    const handleEmailConfirmation = async () => {
      const confirmed = searchParams.get('confirmed');
      const token = searchParams.get('token');
      const type = searchParams.get('type');

      // Handle email confirmation token from Supabase
      if (token && type === 'signup') {
        try {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: 'signup'
          });

          if (error) {
            console.error('Email confirmation error:', error);
            setError('Failed to confirm email. Please try again or request a new confirmation link.');
          } else if (data.user && data.session) {
            // Session created automatically - sign user in
            setUser(data.user);
            
            // Fetch profile
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', data.user.id)
              .single();
            
            if (profile) {
              setUserProfile(profile);
              
              // Redirect based on user type
              const userType = profile.user_type;
              const isAdmin = userType === 'global_admin' || userType === 'super_admin';
              const isArtist = userType === 'artist';
              
              const redirectTo = (isAdmin || isArtist) ? '/dashboard' : '/';
              navigate(redirectTo, { replace: true });
            } else {
              // Profile not created yet, retry with exponential backoff
              let retries = 0;
              const maxRetries = 10;
              
              const retryProfileFetch = async () => {
                while (retries < maxRetries) {
                  await new Promise(resolve => setTimeout(resolve, 500 * (retries + 1)));
                  
                  const { data: retryProfile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', data.user.id)
                    .single();
                  
                  if (retryProfile) {
                    setUserProfile(retryProfile);
                    const userType = retryProfile.user_type;
                    const isAdmin = userType === 'global_admin' || userType === 'super_admin';
                    const isArtist = userType === 'artist';
                    const redirectTo = (isAdmin || isArtist) ? '/dashboard' : '/';
                    navigate(redirectTo, { replace: true });
                    return;
                  }
                  
                  retries++;
                }
                
                // After all retries, show message
                setSuccess('Email confirmed successfully! Your profile is being created. Please wait a moment and refresh, or sign in manually.');
              };
              
              retryProfileFetch();
            }
            
            // Clear URL parameters
            const newParams = new URLSearchParams(searchParams);
            newParams.delete('token');
            newParams.delete('type');
            setSearchParams(newParams, { replace: true });
          }
        } catch (err) {
          console.error('Email confirmation error:', err);
          setError('Failed to confirm email. Please try again.');
        }
        return;
      }

      // Handle confirmed parameter (from redirect URL)
      if (confirmed === 'true') {
        // Supabase email confirmation uses hash fragments (#access_token=...)
        // Process hash fragment immediately - Supabase should handle it automatically
        // But we'll also check and wait for it to be processed
        
        // Check hash fragment first
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const hasAccessToken = hashParams.has('access_token') || window.location.hash.includes('access_token');
        
        // Wait a moment for Supabase to process hash fragment (if present)
        if (hasAccessToken) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Check if session exists (email confirmation should have created one)
        let session = null;
        let retries = 0;
        const maxSessionRetries = 5;
        
        // Retry getting session if hash fragment was present (it might take a moment to process)
        while (!session && retries < maxSessionRetries) {
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          if (currentSession) {
            session = currentSession;
            break;
          }
          if (hasAccessToken && retries < maxSessionRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
          retries++;
        }
        
        if (session && session.user) {
          // Session exists - automatically sign user in
          setUser(session.user);
          
          // Fetch profile with retry logic (profile might take a moment to be created by trigger)
          let profile = null;
          let profileRetries = 0;
          const maxProfileRetries = 15; // More retries for profile (trigger might be slow)
          
          while (!profile && profileRetries < maxProfileRetries) {
            const { data: profileData, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();
            
            if (profileData) {
              profile = profileData;
              break;
            }
            
            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 500 * (profileRetries + 1)));
            profileRetries++;
          }
          
          if (profile) {
            setUserProfile(profile);
            
            // Redirect based on user type (same logic for both artists and fans)
            const userType = profile.user_type;
            const isAdmin = userType === 'global_admin' || userType === 'super_admin';
            const isArtist = userType === 'artist';
            
            const redirectTo = (isAdmin || isArtist) ? '/dashboard' : '/';
            navigate(redirectTo, { replace: true });
          } else {
            // Profile not created after retries - but session exists, so user is confirmed
            // Redirect to home page - profile will be created by trigger or fetched on next load
            console.warn('Profile not found yet, but user is confirmed. Redirecting...');
            navigate('/', { replace: true });
          }
        } else {
          // No session - check if email is actually confirmed
          const { data: { user } } = await supabase.auth.getUser();
          if (user && user.email_confirmed_at) {
            // Email is confirmed but no session - user needs to sign in manually
            setSuccess('Email confirmed successfully! You can now sign in with your password.');
          } else {
            // Email not confirmed yet - might still be processing
            // Wait a bit more and check again
            await new Promise(resolve => setTimeout(resolve, 1000));
            const { data: { session: retrySession } } = await supabase.auth.getSession();
            if (retrySession && retrySession.user) {
              // Session appeared - handle it
              setUser(retrySession.user);
              // Try to get profile, but don't block
              const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', retrySession.user.id)
                .single();
              if (profileData) {
                setUserProfile(profileData);
                const userType = profileData.user_type;
                const isAdmin = userType === 'global_admin' || userType === 'super_admin';
                const isArtist = userType === 'artist';
                navigate((isAdmin || isArtist) ? '/dashboard' : '/', { replace: true });
              } else {
                navigate('/', { replace: true });
              }
            } else {
              setError('Email confirmation failed. Please try clicking the link again or request a new confirmation email.');
            }
          }
        }
        
        // Remove the confirmed parameter and hash from URL
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('confirmed');
        setSearchParams(newParams, { replace: true });
        
        // Clear hash fragment
        if (window.location.hash) {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
      }
    };

    handleEmailConfirmation();
  }, [searchParams, setSearchParams, setUser, setUserProfile, navigate]);

  // Client-side validation
  const validateForm = () => {
    if (authMethod === 'email') {
      if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        setError('Please enter a valid email address.');
        return false;
      }
      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters long.');
        return false;
      }
    }
    return true;
  };

  const handlePhoneOTPSignIn = async () => {
    setLoading(true);
    setError(null);

    try {
      const fullPhone = formatFullPhone(formData.phone.dialCode, formData.phone.localNumber);
      if (!fullPhone || formData.phone.localNumber.trim().length < 6) {
        throw new Error('Please enter a valid phone number');
      }

      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: fullPhone,
      });

      if (otpError) {
        throw new Error(otpError.message || 'Failed to send verification code. Please try again.');
      }

      setOtpPhone(fullPhone);
      setShowOTP(true);
      setSuccess('Verification code sent to your phone!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleOTPVerify = async (otp: string) => {
    setLoading(true);
    setError(null);

    try {
      const { data: authData, error: verifyError } = await supabase.auth.verifyOtp({
        phone: otpPhone,
        token: otp,
        type: 'sms',
      });

      if (verifyError) {
        throw new Error(verifyError.message || 'Invalid verification code. Please try again.');
      }

      if (!authData.user || !authData.session) {
        throw new Error('Verification failed. Please try again.');
      }

      setUser(authData.user);

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (profileError) {
        throw new Error('Failed to fetch user profile. Please try again.');
      }

      setUserProfile(profile);

      // Get return URL
      const returnUrl = sessionStorage.getItem('returnUrl') || 
                      (location.state as any)?.from?.pathname || 
                      null;
      
      if (returnUrl) {
        sessionStorage.removeItem('returnUrl');
      }

      let redirectTo = '/';
      if (returnUrl && returnUrl !== '/login' && returnUrl !== '/signup') {
        redirectTo = returnUrl;
      } else {
        const userType = profile?.user_type;
        const isAdmin = userType === 'global_admin' || userType === 'super_admin';
        const isArtist = userType === 'artist';
        redirectTo = (isAdmin || isArtist) ? '/dashboard' : '/';
      }

      // Log successful login
      await logAuthEvent({
        email: authData.user.email || otpPhone,
        action: 'login_success',
        success: true,
        userId: authData.user.id,
        metadata: {
          user_type: profile?.user_type || 'unknown',
          redirect_to: redirectTo,
          method: 'phone'
        }
      });

      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOTPResend = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: otpPhone,
      });
      if (otpError) {
        setError(otpError.message || 'Failed to resend code');
      } else {
        setSuccess('Verification code resent!');
      }
    } catch (err) {
      setError('Failed to resend code');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // When in phone mode, submit triggers phone OTP flow (e.g. user pressed Enter in phone field)
    if (authMethod === 'phone' && !isResettingPassword) {
      handlePhoneOTPSignIn();
      return;
    }

    // Validate form before submission
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email.trim(),
        password: formData.password,
      });

      if (signInError) {
        // Log failed login attempt
        const errorMessage = signInError instanceof AuthError ? signInError.message : 'Unknown error';
        await logAuthEvent({
          email: formData.email.trim(),
          action: 'login_failed',
          success: false,
          failureReason: errorMessage,
          metadata: {
            error_type: signInError instanceof AuthError ? signInError.status : 'unknown'
          }
        });

        if (signInError instanceof AuthError) {
          switch (signInError.message) {
            case 'Invalid login credentials':
              throw new Error('The email or password you entered is incorrect. Please try again.');
            case 'Email not confirmed':
              throw new Error('Please verify your email address before signing in.');
            default:
              throw new Error(signInError.message);
          }
        }
        throw signInError;
      }

      if (authData.user) {
        setUser(authData.user);
        
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .single();

        if (profileError) {
          throw new Error('Failed to fetch user profile. Please try again.');
        }

        setUserProfile(profile);

        // If user provided phone and profile doesn't have it, update profile
        const fullPhone =
          formData.phone.localNumber.trim() !== ''
            ? formatFullPhone(formData.phone.dialCode, formData.phone.localNumber)
            : null;
        if (fullPhone && !profile?.phone) {
          await supabase
            .from('profiles')
            .update({ phone: fullPhone, updated_at: new Date().toISOString() })
            .eq('id', authData.user.id);
          setUserProfile({ ...profile, phone: fullPhone });
        }

        // Get return URL from sessionStorage or location state
        const returnUrl = sessionStorage.getItem('returnUrl') || 
                        (location.state as any)?.from?.pathname || 
                        null;
        
        // Clear the return URL
        if (returnUrl) {
          sessionStorage.removeItem('returnUrl');
        }

        // Determine redirect destination
        let redirectTo = '/'; // Default to home page
        
        if (returnUrl && returnUrl !== '/login' && returnUrl !== '/signup') {
          // User was trying to access a specific page - redirect there
          redirectTo = returnUrl;
        } else {
          // Check user type for default redirect
          const userType = profile?.user_type;
          const isAdmin = userType === 'global_admin' || userType === 'super_admin';
          const isArtist = userType === 'artist';
          
          if (isAdmin || isArtist) {
            // Artists and admins go to dashboard by default
            redirectTo = '/dashboard';
          } else {
            // Regular users (fans) go to home page for discovery
            redirectTo = '/';
          }
        }

        // Log successful login
        await logAuthEvent({
          email: formData.email.trim(),
          action: 'login_success',
          success: true,
          userId: authData.user.id,
          metadata: {
            user_type: profile?.user_type || 'unknown',
            redirect_to: redirectTo
          }
        });

        navigate(redirectTo, { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.');
      // Only clear password on error, keeping email for convenience
      setFormData(prev => ({
        ...prev,
        password: '',
      }));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setError('Please enter a valid email address.');
      setLoading(false);
      return;
    }

    try {
      const siteURL = window.location.origin;
      
      const { error } = await supabase.auth.resetPasswordForEmail(formData.email.trim(), {
        redirectTo: `${siteURL}/reset-password`,
      });

      if (error) {
        // Log failed password reset request
        await logAuthEvent({
          email: formData.email.trim(),
          action: 'password_reset_request',
          success: false,
          failureReason: error.message
        });
        throw error;
      }

      // Log successful password reset request
      await logAuthEvent({
        email: formData.email.trim(),
        action: 'password_reset_request',
        success: true
      });

      setSuccess('Password reset instructions have been sent to your email.');
      setIsResettingPassword(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset instructions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (showOTP) {
    return (
      <OTPVerification
        phone={otpPhone}
        onVerify={handleOTPVerify}
        onResend={handleOTPResend}
        onCancel={() => {
          setShowOTP(false);
          setOtpPhone('');
          setError(null);
        }}
        loading={loading}
        error={error}
      />
    );
  }

  return (
    <div className="bg-gray-900 p-8 rounded-lg shadow-xl max-w-md w-full">
      <h2 className="text-2xl font-bold mb-6 text-white">
        {isResettingPassword ? 'Reset Password' : 'Sign In'}
      </h2>

      {success && (
        <div className="bg-green-500 bg-opacity-10 border border-green-500 text-green-500 px-4 py-3 rounded-lg mb-4">
          {success}
        </div>
      )}

      {error && (
        <div className="bg-red-500 bg-opacity-10 border border-red-500 text-red-500 px-4 py-3 rounded-lg mb-6 flex flex-col items-center text-center">
          <p className="font-medium">{error}</p>
          {error.includes('incorrect') && (
            <button
              onClick={() => setIsResettingPassword(true)}
              className="text-sm text-red-400 hover:text-red-300 mt-2 underline"
            >
              Forgot your password?
            </button>
          )}
        </div>
      )}

      {!isResettingPassword && (
        <div className="mb-4">
          <label className="block text-gray-300 mb-2">Sign In With</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAuthMethod('email')}
              className={`p-3 rounded-lg flex flex-col items-center justify-center transition-colors ${
                authMethod === 'email'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              <Mail className="h-5 w-5 mb-1" />
              <span className="text-sm">Email</span>
            </button>
            <button
              type="button"
              onClick={() => setAuthMethod('phone')}
              className={`p-3 rounded-lg flex flex-col items-center justify-center transition-colors ${
                authMethod === 'phone'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              <Phone className="h-5 w-5 mb-1" />
              <span className="text-sm">Phone</span>
            </button>
          </div>
        </div>
      )}

      <form onSubmit={isResettingPassword ? handlePasswordReset : handleSubmit} className="space-y-4">
        {authMethod === 'phone' && !isResettingPassword ? (
          <div>
            <label className="block text-gray-300 mb-2">Phone Number <span className="text-red-400">*</span></label>
            <PhoneInput
              value={formData.phone}
              onChange={(val) => setFormData({ ...formData, phone: val })}
              placeholder="Phone number"
              required
            />
          </div>
        ) : (
          <>
            <div>
              <label className="block text-gray-300 mb-2">Email {isResettingPassword && <span className="text-red-400">*</span>}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  required={isResettingPassword}
                  placeholder="Enter your email"
                />
              </div>
            </div>

            {!isResettingPassword && (
              <div>
                <label className="block text-gray-300 mb-2">Password <span className="text-red-400">*</span></label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full pl-10 pr-12 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    required
                    placeholder="Enter your password"
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        <button
          type={authMethod === 'phone' && !isResettingPassword ? 'button' : 'submit'}
          onClick={authMethod === 'phone' && !isResettingPassword ? handlePhoneOTPSignIn : undefined}
          disabled={loading}
          className={`w-full bg-purple-600 text-white py-3 rounded-lg font-semibold transition-colors
            ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-purple-700'}`}
        >
          {loading 
            ? (isResettingPassword ? 'Sending Instructions...' : authMethod === 'phone' ? 'Sending Code...' : 'Signing in...') 
            : (isResettingPassword ? 'Send Reset Instructions' : authMethod === 'phone' ? 'Send Verification Code' : 'Sign In')}
        </button>
      </form>

      <div className="mt-4 text-gray-400 text-center space-y-2">
        {!isResettingPassword ? (
          <>
            <button
              onClick={() => setIsResettingPassword(true)}
              className="text-purple-400 hover:text-purple-300 text-sm"
            >
              Forgot your password?
            </button>
            <p>
              Don't have an account?{' '}
              <a href="/signup" className="text-purple-400 hover:text-purple-300">
                Create account
              </a>
            </p>
          </>
        ) : (
          <button
            onClick={() => setIsResettingPassword(false)}
            className="text-purple-400 hover:text-purple-300 text-sm"
          >
            Back to Sign In
          </button>
        )}
      </div>
    </div>
  );
};

export default SignInForm;