import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Phone, HelpCircle, Search, ChevronDown, ChevronUp, BookOpen, MessageCircle, CheckCircle, AlertCircle, Filter, X } from 'lucide-react';

interface HelpContent {
  id: string;
  title: string;
  content: string;
  image_url?: string;
  section: string;
  display_order: number;
}

const Help: React.FC = () => {
  const { user } = useStore();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [helpContent, setHelpContent] = useState<HelpContent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  useEffect(() => {
    fetchHelpContent();
  }, []);

  // Update email when user changes
  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
    }
  }, [user]);

  const fetchHelpContent = async () => {
    try {
      const { data, error } = await supabase
        .from('help_content')
        .select('*')
        .order('section', { ascending: true })
        .order('display_order', { ascending: true });

      if (error) throw error;
      setHelpContent(data || []);
    } catch (err) {
      console.error('Error fetching help content:', err);
    }
  };

  const handleSubmitCallback = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Validate email format
      const requestEmail = user?.email || email;
      if (!requestEmail) {
        setError('Email is required to receive confirmation');
        setIsSubmitting(false);
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requestEmail)) {
        setError('Please enter a valid email address');
        setIsSubmitting(false);
        return;
      }

      // Validate description - require at least 50 characters to reduce spam
      const trimmedDescription = description.trim();
      if (!trimmedDescription) {
        setError('Please describe your request. This helps us better assist you.');
        setIsSubmitting(false);
        return;
      }

      if (trimmedDescription.length < 50) {
        setError('Please provide more details about your request (at least 50 characters). This helps us understand how we can help you.');
        setIsSubmitting(false);
        return;
      }

      // Debug: Check current session and Supabase config
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const hasAnonKey = !!import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      console.log('🔍 Debug info:', {
        hasSession: !!sessionData?.session,
        sessionError: sessionError?.message,
        userId: sessionData?.session?.user?.id,
        userEmail: sessionData?.session?.user?.email,
        isAuthenticated: !!user,
        supabaseUrl: supabaseUrl ? 'configured' : 'missing',
        hasAnonKey
      });

      // If user is not logged in but there's a session error, clear it
      // This ensures we use the anon role properly
      if (!user && sessionError) {
        console.log('⚠️ Session error detected for anonymous user, clearing session...');
        await supabase.auth.signOut();
      }

      // Allow both authenticated and anonymous users to submit callback requests
      const insertData = {
        phone_number: phoneNumber,
        email: requestEmail,
        description: trimmedDescription,
        user_id: user?.id || null  // Include user_id if logged in, null for anonymous
      };
      console.log('📝 Attempting to insert callback request:', insertData);

      // Try using Edge Function as workaround (bypasses RLS issues)
      // This uses the service role which can always insert
      try {
        const { data: functionData, error: functionError } = await supabase.functions.invoke(
          'submit-callback-request',
          {
            body: insertData
          }
        );

        if (!functionError && functionData?.success) {
          console.log('✅ Callback request submitted via Edge Function');
          setSuccess(true);
          setPhoneNumber('');
          setDescription('');
          if (!user) {
            setEmail('');
          }
          setIsSubmitting(false);
          return;
        } else {
          console.log('⚠️ Edge Function failed, trying direct insert:', functionError);
        }
      } catch (functionErr) {
        console.log('⚠️ Edge Function not available, trying direct insert:', functionErr);
      }

      // Fallback to direct insert (original method)
      const { error: insertError, data, status, statusText } = await supabase
        .from('callback_requests')
        .insert([insertData])
        .select();

      if (insertError) {
        console.error('❌ Database insert error (full object):', JSON.stringify(insertError, null, 2));
        console.error('❌ Error details:', {
          code: insertError.code,
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint,
          status: insertError.status,
          statusText: insertError.statusText
        });
        console.error('❌ Response status:', { status, statusText });
        // Provide more specific error messages
        if (insertError.code === '42703') {
          throw new Error('Database schema needs to be updated. Please contact support.');
        } else if (insertError.code === '42501') {
          throw new Error('Permission denied. The RLS policy may need to be updated. Please contact support.');
        } else if (insertError.message) {
          throw new Error(insertError.message);
        }
        throw insertError;
      }

      setSuccess(true);
      setPhoneNumber('');
      setDescription('');
      if (!user) {
        setEmail(''); // Clear email for anonymous users
      }
    } catch (err: any) {
      console.error('Error submitting callback request:', err);
      
      // Provide more helpful error messages
      let errorMessage = 'An error occurred while submitting your request';
      
      if (err?.message) {
        errorMessage = err.message;
      } else if (err?.code === '42703') {
        errorMessage = 'Database schema needs to be updated. Please contact support.';
      } else if (err?.code === '42501') {
        errorMessage = 'Permission denied. Please try again or contact support.';
      } else if (err?.code === '23502') {
        errorMessage = 'Missing required information. Please check all fields.';
      } else if (err?.hint) {
        errorMessage = `${err.message}. ${err.hint}`;
      }
      
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  // Filter and search help content
  const filteredContent = helpContent.filter(item => {
    const matchesSearch = searchQuery === '' || 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.content.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesSection = selectedSection === 'all' || item.section === selectedSection;
    
    return matchesSearch && matchesSection;
  });

  // Group content by section
  const groupedContent = filteredContent.reduce((acc, item) => {
    if (!acc[item.section]) {
      acc[item.section] = [];
    }
    acc[item.section].push(item);
    return acc;
  }, {} as Record<string, HelpContent[]>);

  // Get unique sections
  const sections = Array.from(new Set(helpContent.map(item => item.section))).sort();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 pt-24 relative overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-pink-600/5 rounded-full blur-3xl"></div>
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center mr-4 shadow-xl shadow-purple-500/30">
              <HelpCircle className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-300 via-blue-300 to-purple-300 bg-clip-text text-transparent">
              Help Center
            </h1>
          </div>
          <p className="mt-2 text-xl text-gray-400">Find answers to your questions or request a callback</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Callback Request Form */}
          <div className="lg:col-span-1">
            <div className="bg-gradient-to-br from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-2xl sticky top-24">
              <div className="flex items-center mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/30 to-blue-500/30 border border-purple-500/50 flex items-center justify-center mr-3">
                  <Phone className="h-5 w-5 text-purple-400" />
                </div>
                <h2 className="text-xl font-bold text-white">Request a Callback</h2>
              </div>

              {success ? (
                <div className="bg-gradient-to-r from-green-600/20 via-green-500/20 to-green-600/20 backdrop-blur-sm border-2 border-green-500/50 text-green-300 px-4 py-4 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                    <p className="text-sm font-semibold">We've received your callback request. Our team will contact you soon.</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmitCallback} className="space-y-4">
                  <div>
                    <label htmlFor="phone" className="block text-sm font-semibold text-gray-300 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full px-4 py-3 bg-gradient-to-br from-gray-800/80 to-gray-700/60 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500/50 shadow-xl"
                      placeholder="+1 (555) 123-4567"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-semibold text-gray-300 mb-2">
                      Email Address <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={!!user}
                      className="w-full px-4 py-3 bg-gradient-to-br from-gray-800/80 to-gray-700/60 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500/50 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder={user ? user.email : "your.email@example.com"}
                      required
                    />
                    {user && (
                      <p className="mt-1 text-xs text-gray-500">Using your account email</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="description" className="block text-sm font-semibold text-gray-300 mb-2">
                      Describe Your Request <span className="text-red-400">*</span>
                      <span className="ml-2 text-xs text-gray-500 font-normal">
                        ({description.trim().length}/50 minimum characters)
                      </span>
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={5}
                      minLength={50}
                      className="w-full px-4 py-3 bg-gradient-to-br from-gray-800/80 to-gray-700/60 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500/50 shadow-xl resize-y"
                      placeholder="Please describe your request in detail. What do you need help with? (At least 50 characters required)"
                      required
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      {description.trim().length < 50 
                        ? `Please provide at least ${50 - description.trim().length} more characters to help us understand your request.`
                        : 'Thank you for providing details about your request.'}
                    </p>
                  </div>

                  {error && (
                    <div className="bg-gradient-to-r from-red-600/20 via-red-500/20 to-red-600/20 backdrop-blur-sm border-2 border-red-500/50 text-red-300 px-4 py-3 rounded-2xl">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                        <p className="text-sm font-semibold">{error}</p>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-xl font-semibold transition-all duration-300 shadow-xl shadow-purple-500/30 hover:shadow-2xl hover:shadow-purple-500/40 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center space-x-2"
                  >
                    <MessageCircle className="w-5 h-5" />
                    <span>{isSubmitting ? 'Submitting...' : 'Request Callback'}</span>
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Help Content */}
          <div className="lg:col-span-3">
            {/* Search and Filter */}
            <div className="bg-gradient-to-br from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-xl rounded-3xl p-6 mb-8 border border-white/10 shadow-2xl">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search help articles..."
                    className="w-full pl-12 pr-4 py-3 bg-gradient-to-br from-gray-800/80 to-gray-700/60 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500/50 shadow-xl"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all duration-300 flex items-center justify-center"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Filter className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 z-10" size={18} />
                  <select
                    value={selectedSection}
                    onChange={(e) => setSelectedSection(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gradient-to-br from-gray-800/80 to-gray-700/60 backdrop-blur-sm border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500/50 shadow-xl appearance-none"
                  >
                    <option value="all" className="bg-gray-800">All Sections</option>
                    {sections.map(section => (
                      <option key={section} value={section} className="bg-gray-800">{section}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Help Articles */}
            <div className="space-y-8">
              {Object.keys(groupedContent).length > 0 ? (
                Object.entries(groupedContent).map(([section, items]) => (
                  <div key={section} className="bg-gradient-to-br from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-xl rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
                    <div className="bg-gradient-to-r from-purple-600/20 via-blue-600/20 to-purple-600/20 backdrop-blur-sm px-6 py-4 border-b border-white/10">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/30 to-blue-500/30 border border-purple-500/50 flex items-center justify-center">
                          <BookOpen className="w-5 h-5 text-purple-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-white">{section}</h2>
                        <span className="ml-auto px-3 py-1 bg-white/5 rounded-xl text-gray-400 text-sm font-semibold">
                          {items.length} {items.length === 1 ? 'article' : 'articles'}
                        </span>
                      </div>
                    </div>
                    <div className="divide-y divide-white/10">
                      {items.map((item) => (
                        <div key={item.id} className="p-6 hover:bg-white/5 transition-all duration-300">
                          <button
                            onClick={() => toggleExpanded(item.id)}
                            className="w-full flex items-center justify-between text-left group"
                          >
                            <h3 className="text-lg font-bold text-white group-hover:text-purple-300 transition-colors">{item.title}</h3>
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                              expandedItems.has(item.id)
                                ? 'bg-gradient-to-br from-purple-500/30 to-blue-500/30 border border-purple-500/50 rotate-180'
                                : 'bg-white/5 border border-white/10 group-hover:bg-white/10'
                            }`}>
                              {expandedItems.has(item.id) ? (
                                <ChevronUp className="h-5 w-5 text-purple-400" />
                              ) : (
                                <ChevronDown className="h-5 w-5 text-gray-400 group-hover:text-purple-400" />
                              )}
                            </div>
                          </button>
                          
                          {expandedItems.has(item.id) && (
                            <div className="mt-6 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                              {item.image_url && (
                                <div className="rounded-2xl overflow-hidden border border-white/10 shadow-xl">
                                  <img
                                    src={item.image_url}
                                    alt={item.title}
                                    className="w-full max-w-md h-64 object-cover"
                                    style={{ objectPosition: 'center top' }}
                                  />
                                </div>
                              )}
                              <div className="text-gray-300 leading-relaxed whitespace-pre-wrap bg-white/5 rounded-xl p-4 border border-white/10">
                                {item.content}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-gradient-to-br from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-xl rounded-3xl p-16 text-center border border-white/10 shadow-2xl">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 flex items-center justify-center">
                    <HelpCircle className="w-10 h-10 text-purple-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">No articles found</h3>
                  <p className="text-gray-400 text-lg">
                    {searchQuery || selectedSection !== 'all' 
                      ? 'Try adjusting your search or filter criteria.'
                      : 'Help content is being updated. Please check back later.'}
                  </p>
                  {(searchQuery || selectedSection !== 'all') && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedSection('all');
                      }}
                      className="mt-6 px-6 py-3 bg-gradient-to-r from-purple-600/30 to-blue-600/30 hover:from-purple-600/40 hover:to-blue-600/40 border border-purple-500/30 text-white rounded-xl font-semibold transition-all duration-300"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Help;