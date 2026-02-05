import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { Lock, Mail, User, UserCircle, Music, Mic, Search, Eye, EyeOff, X, Phone } from 'lucide-react';
import { COUNTRIES, filterCountries } from '../../utils/countries';
import { getRegionForCountry } from '../../utils/countryToRegion';
import PhoneInput, { type PhoneValue } from '../PhoneInput';
import OTPVerification from '../OTPVerification';
import { formatFullPhone } from '../../utils/phoneCountryCodes';

const SignUpForm: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [genres, setGenres] = useState<any[]>([]);
  const [countrySearch, setCountrySearch] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [artistLoginEnabled, setArtistLoginEnabled] = useState(true);
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
  const [showOTP, setShowOTP] = useState(false);
  const [otpPhone, setOtpPhone] = useState<string>('');
  const countryInputRef = useRef<HTMLInputElement>(null);
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    fullName: '',
    userType: 'fan',
    artistType: 'music',
    selectedGenres: [] as string[],
    country: '',
    region: 'European',
    phone: { dialCode: '+33', localNumber: '' } as PhoneValue,
  });

  useEffect(() => {
    // Fetch artist login config
    const fetchConfig = async () => {
      try {
        const { data } = await supabase
          .from('app_config')
          .select('value')
          .eq('key', 'artist_login_enabled')
          .single();
        
        if (data) {
          setArtistLoginEnabled(data.value === true || data.value === 'true');
        }
      } catch (err) {
        console.error('Error fetching config:', err);
        // Default to enabled if error
        setArtistLoginEnabled(true);
      }
    };
    fetchConfig();
  }, []);

  // Filter countries - only show results after typing 2+ characters
  const filteredCountries = filterCountries(countrySearch);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        countryDropdownRef.current &&
        !countryDropdownRef.current.contains(event.target as Node) &&
        countryInputRef.current &&
        !countryInputRef.current.contains(event.target as Node)
      ) {
        setShowCountryDropdown(false);
      }
    };

    if (showCountryDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCountryDropdown]);

  useEffect(() => {
    if (formData.userType === 'artist') {
      fetchGenres();
    }
  }, [formData.userType, formData.artistType]);

  const fetchGenres = async () => {
    try {
      const { data, error } = await supabase
        .from('genres')
        .select('*')
        .eq('category', formData.artistType)
        .order('name');

      if (error) throw error;
      setGenres(data || []);
    } catch (err) {
      console.error('Error fetching genres:', err);
    }
  };

  const checkUsernameAvailability = async (username: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', username)
      .maybeSingle();

    return data === null && !error;
  };

  const handlePhoneOTPSignup = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!formData.username || formData.username.trim().length === 0) {
        throw new Error('Username is required');
      }

      if (!formData.fullName || formData.fullName.trim().length === 0) {
        throw new Error('Full name is required');
      }

      const fullPhone = formatFullPhone(formData.phone.dialCode, formData.phone.localNumber);
      if (!fullPhone || formData.phone.localNumber.trim().length < 6) {
        throw new Error('Please enter a valid phone number');
      }

      if (formData.userType === 'artist') {
        if (!formData.country || formData.country.trim().length === 0) {
          throw new Error('Country is required for artist accounts');
        }
        if (!formData.artistType) {
          throw new Error('Please select an artist type (Music or Comedy)');
        }
        const allowedRegions = ['African', 'European', 'American', 'Asian', 'Maghreb', 'Other'];
        if (!formData.region || !allowedRegions.includes(formData.region)) {
          throw new Error('Please select a valid region');
        }
      }

      const isUsernameAvailable = await checkUsernameAvailability(formData.username);
      if (!isUsernameAvailable) {
        throw new Error('This username is already taken. Please choose a different username.');
      }

      // Send OTP to phone
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

      if (!authData.user) {
        throw new Error('Verification failed. Please try again.');
      }

      // Prepare profile data
      const profileData = {
        username: formData.username.trim(),
        full_name: formData.fullName.trim(),
        user_type: formData.userType,
        artist_type: formData.userType === 'artist' ? formData.artistType : null,
        genres: formData.userType === 'artist' ? formData.selectedGenres : null,
        country: formData.userType === 'artist' ? formData.country.trim() : null,
        region: formData.userType === 'artist' ? formData.region : null,
        phone: otpPhone,
      };

      if (profileData.region && !['African', 'European', 'American', 'Asian', 'Maghreb', 'Other'].includes(profileData.region)) {
        profileData.region = 'Other';
      }

      // Create profile
      const { error: profileError } = await supabase.from('profiles').insert({
        id: authData.user.id,
        username: profileData.username,
        full_name: profileData.full_name,
        user_type: profileData.user_type,
        artist_type: profileData.artist_type,
        genres: profileData.genres,
        country: profileData.country,
        region: profileData.region,
        phone: profileData.phone,
      });

      if (profileError) {
        console.error('Profile creation error:', profileError);
        throw new Error('Failed to create profile. Please try again.');
      }

      // Success - redirect
      if (formData.userType === 'artist') {
        navigate('/dashboard');
      } else {
        navigate('/');
      }
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
    setSuccess(null);

    // When in phone mode, submit triggers phone OTP flow (e.g. user pressed Enter in phone field)
    if (authMethod === 'phone') {
      handlePhoneOTPSignup();
      return;
    }

    setLoading(true);
    try {
      // Validate required fields
      if (!formData.username || formData.username.trim().length === 0) {
        throw new Error('Username is required');
      }

      if (!formData.fullName || formData.fullName.trim().length === 0) {
        throw new Error('Full name is required');
      }

      if (authMethod === 'email') {
        if (!formData.email || formData.email.trim().length === 0) {
          throw new Error('Email is required');
        }

        if (!formData.password || formData.password.length < 6) {
          throw new Error('Password must be at least 6 characters long');
        }
      }

      // Validate artist-specific required fields
      if (formData.userType === 'artist') {
        if (!formData.country || formData.country.trim().length === 0) {
          throw new Error('Country is required for artist accounts');
        }
        if (!formData.artistType) {
          throw new Error('Please select an artist type (Music or Comedy)');
        }
        // Validate region is one of the allowed values
        const allowedRegions = ['African', 'European', 'American', 'Asian', 'Maghreb', 'Other'];
        if (!formData.region || !allowedRegions.includes(formData.region)) {
          throw new Error('Please select a valid region (African, European, American, Asian, Maghreb, or Other)');
        }
      }

      // First check if username is available
      const isUsernameAvailable = await checkUsernameAvailability(formData.username);
      if (!isUsernameAvailable) {
        throw new Error('This username is already taken. Please choose a different username.');
      }

      const fullPhone =
        formData.phone.localNumber.trim() !== ''
          ? formatFullPhone(formData.phone.dialCode, formData.phone.localNumber) || null
          : null;

      // Prepare profile data to store in metadata
      const profileData = {
        username: formData.username.trim(),
        full_name: formData.fullName.trim(),
        user_type: formData.userType,
        artist_type: formData.userType === 'artist' ? formData.artistType : null,
        genres: formData.userType === 'artist' ? formData.selectedGenres : null,
        country: formData.userType === 'artist' ? formData.country.trim() : null,
        region: formData.userType === 'artist' ? formData.region : null,
        phone: fullPhone,
      };
      
      // Ensure region is valid
      if (profileData.region && !['African', 'European', 'American', 'Asian', 'Maghreb', 'Other'].includes(profileData.region)) {
        profileData.region = 'Other';
      }

      // Get site URL for email confirmation redirect
      const siteUrl = import.meta.env.VITE_SITE_URL || window.location.origin;
      const redirectTo = `${siteUrl}/login?confirmed=true`;

      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            pending_profile: profileData
          },
          emailRedirectTo: redirectTo
        }
      });

      if (signUpError) {
        if (signUpError.message === 'User already registered') {
          throw new Error('This email address is already registered. Please sign in or use a different email address.');
        }
        throw signUpError;
      }

      if (authData.user) {
        // Profile data is already stored in metadata during signup
        // Prepare profile data for immediate insertion (if session is available)
        const profileDataForInsert = {
          id: authData.user.id,
          username: profileData.username,
          full_name: profileData.full_name,
          user_type: profileData.user_type,
          artist_type: profileData.artist_type,
          genres: profileData.genres,
          country: profileData.country,
          region: profileData.region,
          phone: profileData.phone,
        };

        // Check if we have a session (email confirmation might be required)
        let session = authData.session;
        if (!session) {
          // Wait a moment for session to be established
          await new Promise(resolve => setTimeout(resolve, 500));
          const { data: { session: newSession } } = await supabase.auth.getSession();
          session = newSession;
        }

        // If no session, email confirmation is required
        if (!session) {
          // Show success message instead of error
          // The profile will be created automatically when email is confirmed
          setSuccess('Account created successfully! Please check your email to confirm your account. Once confirmed, your profile will be created automatically.');
          // Reset form after showing success message
          setFormData({
            email: '',
            password: '',
            username: '',
            fullName: '',
            userType: 'fan',
            artistType: 'music',
            selectedGenres: [],
            country: '',
            region: 'European',
            phone: { dialCode: '+33', localNumber: '' },
          });
          // Don't throw an error - this is expected behavior
          return;
        }

        // If we have a session, try to create the profile immediately
        const { error: profileError } = await supabase
          .from('profiles')
          .insert(profileDataForInsert);

        if (profileError) {
          // Check if it's an RLS error (which is expected if email confirmation is required)
          if (profileError.message.includes('row-level security') || profileError.message.includes('RLS')) {
            // This is expected when email confirmation is required
            setSuccess('Account created successfully! Please check your email to confirm your account. Once confirmed, your profile will be created automatically.');
            // Reset form after showing success message
            setFormData({
              email: '',
              password: '',
              username: '',
              fullName: '',
              userType: 'fan',
              artistType: 'music',
              selectedGenres: [],
              country: '',
              region: 'European',
              phone: { dialCode: '+33', localNumber: '' },
            });
            return;
          }

          // For other errors, show the actual error
          console.error('Profile creation error:', profileError);
          await supabase.auth.signOut();
          
          let errorMessage = 'Error creating user profile. ';
          if (profileError.message.includes('duplicate') || profileError.message.includes('unique')) {
            errorMessage += 'This username or email may already be in use.';
          } else if (profileError.message.includes('null') || profileError.message.includes('required')) {
            errorMessage += 'Please fill in all required fields.';
          } else {
            errorMessage += profileError.message || 'Please try again or contact support.';
          }
          
          throw new Error(errorMessage);
        }

        // Profile created successfully, reset form and redirect based on user type
        setFormData({
          email: '',
          password: '',
          username: '',
          fullName: '',
          userType: 'fan',
          artistType: 'music',
          selectedGenres: [],
          country: '',
          region: 'European',
          phone: { dialCode: '+33', localNumber: '' },
        });
        
        if (formData.userType === 'artist') {
          navigate('/dashboard');
        } else {
          navigate('/');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during sign up');
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
      <h2 className="text-2xl font-bold mb-6 text-white">Create Account</h2>

      {/* Success message - sticky at top of form */}
      {success && (
        <div className="bg-green-500 bg-opacity-10 border border-green-500 text-green-500 px-4 py-3 rounded-lg mb-4 sticky top-4 z-10 shadow-lg">
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0 mt-0.5">✓</div>
            <div className="flex-1">{success}</div>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="bg-red-500 bg-opacity-10 border border-red-500 text-red-500 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-gray-300 mb-2">Sign Up With</label>
          <div className="grid grid-cols-2 gap-2 mb-4">
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

        <div>
          <label className="block text-gray-300 mb-2">Account Type</label>
          <div className={`grid gap-2 ${artistLoginEnabled ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, userType: 'fan' })}
              className={`p-3 rounded-lg flex flex-col items-center justify-center transition-colors ${
                formData.userType === 'fan'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              <User className="h-6 w-6 mb-1" />
              <span className="text-sm">Fan</span>
            </button>
            {artistLoginEnabled && (
              <button
                type="button"
                onClick={() => setFormData({ ...formData, userType: 'artist' })}
                className={`p-3 rounded-lg flex flex-col items-center justify-center transition-colors ${
                  formData.userType === 'artist'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                <UserCircle className="h-6 w-6 mb-1" />
                <span className="text-sm">Artist</span>
              </button>
            )}
          </div>
        </div>

        {formData.userType === 'artist' && (
          <>
            <div>
              <label className="block text-gray-300 mb-2">Artist Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, artistType: 'music', selectedGenres: [] })}
                  className={`p-3 rounded-lg flex flex-col items-center justify-center transition-colors ${
                    formData.artistType === 'music'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  <Music className="h-6 w-6 mb-1" />
                  <span className="text-sm">Music</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, artistType: 'comedy', selectedGenres: [] })}
                  className={`p-3 rounded-lg flex flex-col items-center justify-center transition-colors ${
                    formData.artistType === 'comedy'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  <Mic className="h-6 w-6 mb-1" />
                  <span className="text-sm">Comedy</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-gray-300 mb-2">Genres</label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {genres.map((genre) => (
                  <button
                    key={genre.id}
                    type="button"
                    onClick={() => {
                      const isSelected = formData.selectedGenres.includes(genre.name);
                      setFormData({
                        ...formData,
                        selectedGenres: isSelected
                          ? formData.selectedGenres.filter(g => g !== genre.name)
                          : [...formData.selectedGenres, genre.name]
                      });
                    }}
                    className={`p-2 rounded-lg text-sm transition-colors ${
                      formData.selectedGenres.includes(genre.name)
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {genre.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-gray-300 mb-2">
                Country {formData.userType === 'artist' && <span className="text-red-400">*</span>}
              </label>
              <div className="relative">
                <div className="relative">
                  <input
                    ref={countryInputRef}
                    type="text"
                    value={formData.country}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFormData({ ...formData, country: value });
                      setCountrySearch(value);
                      // Show dropdown only if user has typed 2+ characters
                      if (value.length >= 2) {
                        setShowCountryDropdown(true);
                      } else {
                        setShowCountryDropdown(false);
                      }
                    }}
                    onFocus={() => {
                      // Show dropdown if there's a search query with 2+ characters
                      if (countrySearch.length >= 2 && filteredCountries.length > 0) {
                        setShowCountryDropdown(true);
                      }
                    }}
                    className="w-full pl-4 pr-10 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 placeholder-gray-500"
                    placeholder="Type 2+ letters to search countries..."
                    required={formData.userType === 'artist'}
                    autoComplete="off"
                  />
                  {formData.country && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, country: '' });
                        setCountrySearch('');
                        setShowCountryDropdown(false);
                        countryInputRef.current?.focus();
                      }}
                      className="absolute right-10 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                      aria-label="Clear country"
                    >
                      <X size={18} />
                    </button>
                  )}
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                </div>
                
                {showCountryDropdown && filteredCountries.length > 0 && (
                  <div
                    ref={countryDropdownRef}
                    className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-64 overflow-y-auto"
                  >
                    <div className="p-1">
                      {filteredCountries.map((country) => {
                        // Highlight matching text
                        const index = country.toLowerCase().indexOf(countrySearch.toLowerCase());
                        const beforeMatch = country.substring(0, index);
                        const match = country.substring(index, index + countrySearch.length);
                        const afterMatch = country.substring(index + countrySearch.length);
                        
                        return (
                          <button
                            key={country}
                            type="button"
                            className="w-full px-4 py-2.5 text-left text-white hover:bg-purple-600 transition-colors rounded"
                            onClick={() => {
                              // Always auto-detect region based on selected country using the mapping utility
                              const newRegion = getRegionForCountry(country);
                              
                              setFormData({ ...formData, country, region: newRegion });
                              setShowCountryDropdown(false);
                              setCountrySearch('');
                            }}
                          >
                            {index >= 0 ? (
                              <>
                                {beforeMatch}
                                <span className="font-semibold bg-purple-500/30">{match}</span>
                                {afterMatch}
                              </>
                            ) : (
                              country
                            )}
                          </button>
                        );
                      })}
                      {filteredCountries.length === 20 && (
                        <div className="px-4 py-2 text-xs text-gray-400 text-center">
                          Showing first 20 results. Type more letters to refine.
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {showCountryDropdown && countrySearch.length >= 2 && filteredCountries.length === 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-4">
                    <div className="text-gray-400 text-sm text-center">
                      No countries found matching "{countrySearch}"
                    </div>
                  </div>
                )}
              </div>
              {countrySearch.length === 1 && (
                <p className="mt-1 text-xs text-gray-500">Type at least 2 letters to see country suggestions</p>
              )}
            </div>

            <div>
              <label className="block text-gray-300 mb-2">Region</label>
              <select
                value={formData.region}
                onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                required={formData.userType === 'artist'}
              >
                <option value="">Select a region</option>
                <option value="African">African</option>
                <option value="European">European</option>
                <option value="American">American</option>
                <option value="Asian">Asian</option>
                <option value="Maghreb">Maghreb</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </>
        )}

        <div>
          <label className="block text-gray-300 mb-2">Username</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-gray-300 mb-2">Full Name</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
              required
            />
          </div>
        </div>

        {authMethod === 'phone' ? (
          <div>
            <label className="block text-gray-300 mb-2">Phone Number <span className="text-red-400">*</span></label>
            <PhoneInput
              value={formData.phone}
              onChange={(val) => setFormData({ ...formData, phone: val })}
              placeholder="Phone number"
              required
              className="mb-0"
            />
          </div>
        ) : (
          <>
            <div>
              <label className="block text-gray-300 mb-2">Phone (optional)</label>
              <PhoneInput
                value={formData.phone}
                onChange={(val) => setFormData({ ...formData, phone: val })}
                placeholder="Phone number"
                className="mb-0"
              />
            </div>

            <div>
              <label className="block text-gray-300 mb-2">Email <span className="text-red-400">*</span></label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  required
                />
              </div>
            </div>

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
          </>
        )}

        <button
          type={authMethod === 'phone' ? 'button' : 'submit'}
          onClick={authMethod === 'phone' ? handlePhoneOTPSignup : undefined}
          disabled={loading}
          className={`w-full bg-purple-600 text-white py-2 rounded-lg font-semibold
            ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-purple-700'}`}
        >
          {loading
            ? authMethod === 'phone'
              ? 'Sending Code...'
              : 'Creating Account...'
            : authMethod === 'phone'
            ? 'Send Verification Code'
            : 'Create Account'}
        </button>
      </form>

      <p className="mt-4 text-gray-400 text-center">
        Already have an account?{' '}
        <a href="/login" className="text-purple-400 hover:text-purple-300">
          Sign in
        </a>
      </p>
    </div>
  );
};

export default SignUpForm;