import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { SUPER_ADMIN_ID } from '../utils/constants';
import { Search, User, LogOut, Activity, Users, Heart, HelpCircle, MonitorPlay, Menu, X, UserCog, Settings, UserCircle, Music, Mic, Globe, ChevronRight, Calendar, Radio, MoreVertical, LayoutDashboard, Video, Ticket, BarChart3 } from 'lucide-react';
import VisitorCounter from './VisitorCounter';
import NotificationsPanel from './NotificationsPanel';
import CartIcon from './CartIcon';
import { supabase } from '../lib/supabaseClient';
import { normalizeCountryName } from '../utils/countries';

const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userProfile, signOut } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showCategoriesDropdown, setShowCategoriesDropdown] = useState(false);
  const [showArtistToolsMenu, setShowArtistToolsMenu] = useState(false);
  const [showAdminToolsMenu, setShowAdminToolsMenu] = useState(false);
  const [popularCategories, setPopularCategories] = useState<Array<{name: string; type: string; count: number}>>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [artistRecordingsVisible, setArtistRecordingsVisible] = useState(true);
  const [visitorCounterVisible, setVisitorCounterVisible] = useState(true);

  const categoriesDropdownRef = useRef<HTMLDivElement>(null);
  const artistToolsDropdownRef = useRef<HTMLDivElement>(null);
  const adminToolsDropdownRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuPanelRef = useRef<HTMLDivElement>(null);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setShowMobileMenu(false);
      navigate(`/search?query=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      setShowMobileMenu(false);
      navigate(`/search?query=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  // Fetch popular categories for dropdown
  useEffect(() => {
    const fetchPopularCategories = async () => {
      try {
        setCategoriesLoading(true);
        // Fetch artists to calculate category counts
        const { data: artistsData, error } = await supabase
          .from('profiles')
          .select('artist_type, region, genres, country')
          .eq('user_type', 'artist');

        if (error) throw error;

        const categories: Array<{name: string; type: string; count: number}> = [];

        // Maghreb countries list (normalized)
        const maghrebCountries = ['Morocco', 'Algeria', 'Tunisia', 'Libya', 'Mauritania'].map(c => c.toLowerCase());

        // Add regions with counts (including Maghreb)
        const regions = ['African', 'European', 'American', 'Asian', 'Maghreb'];
        regions.forEach(region => {
          let count = artistsData?.filter(artist => artist.region === region).length || 0;
          
          // For Maghreb, also check country field for backward compatibility
          // Count artists with Maghreb countries who don't already have region='Maghreb'
          if (region === 'Maghreb') {
            const maghrebByCountry = artistsData?.filter(artist => {
              // Skip if already counted by region
              if (artist.region === 'Maghreb') return false;
              if (!artist.country) return false;
              const normalizedCountry = normalizeCountryName(artist.country);
              if (!normalizedCountry) return false;
              return maghrebCountries.includes(normalizedCountry.toLowerCase());
            }).length || 0;
            count += maghrebByCountry; // Add to the count
          }
          
          if (count > 0) {
            categories.push({ name: region, type: 'region', count });
          }
        });

        // Add artist types with counts (genres)
        ['music', 'comedy'].forEach(type => {
          const count = artistsData?.filter(artist => artist.artist_type === type).length || 0;
          if (count > 0) {
            categories.push({ 
              name: type.charAt(0).toUpperCase() + type.slice(1), 
              type: 'type', 
              count 
            });
          }
        });

        // Sort: genres first (by count), then regions (by count)
        // Define region order
        const regionOrder = ['African', 'European', 'American', 'Asian', 'Maghreb'];
        
        const sorted = categories.sort((a, b) => {
          // First, separate by type: genres (type='type') come before regions (type='region')
          if (a.type !== b.type) {
            if (a.type === 'type') return -1; // Genres first
            if (b.type === 'type') return 1;
          }
          
          // If both are genres, sort by count (descending)
          if (a.type === 'type' && b.type === 'type') {
            return b.count - a.count;
          }
          
          // If both are regions, sort by predefined order, then by count
          if (a.type === 'region' && b.type === 'region') {
            const aIndex = regionOrder.indexOf(a.name);
            const bIndex = regionOrder.indexOf(b.name);
            
            // If both are in the predefined order, maintain that order
            if (aIndex !== -1 && bIndex !== -1) {
              return aIndex - bIndex;
            }
            // If only one is in the order, prioritize it
            if (aIndex !== -1) return -1;
            if (bIndex !== -1) return 1;
            // If neither is in the order, sort by count
            return b.count - a.count;
          }
          
          return 0;
        });
        
        // Get all categories (no limit, show all genres and regions)
        setPopularCategories(sorted);
      } catch (err) {
        console.error('Error fetching popular categories:', err);
        // Fallback to default categories (genres first, then regions in order)
        setPopularCategories([
          { name: 'Music', type: 'type', count: 0 },
          { name: 'Comedy', type: 'type', count: 0 },
          { name: 'African', type: 'region', count: 0 },
          { name: 'European', type: 'region', count: 0 },
          { name: 'American', type: 'region', count: 0 },
          { name: 'Asian', type: 'region', count: 0 },
          { name: 'Maghreb', type: 'region', count: 0 }
        ]);
      } finally {
        setCategoriesLoading(false);
      }
    };

    fetchPopularCategories();
  }, []);

  const isArtist = userProfile?.user_type === 'artist';
  const isAdmin = userProfile?.user_type === 'global_admin' || userProfile?.user_type === 'super_admin';
  const isSuperAdmin = userProfile?.user_type === 'super_admin' || userProfile?.id === SUPER_ADMIN_ID;

  // Fetch artist recordings visibility config (after isArtist is declared)
  useEffect(() => {
    const fetchRecordingsVisibility = async () => {
      try {
        const { data, error } = await supabase
          .from('app_config')
          .select('key, value')
          .eq('key', 'artist_recordings_visible')
          .single();

        if (!error && data) {
          setArtistRecordingsVisible(data.value === true || data.value === 'true');
        }
      } catch (err) {
        console.error('Error fetching recordings visibility config:', err);
        // Default to visible if error
        setArtistRecordingsVisible(true);
      }
    };

    if (isArtist) {
      fetchRecordingsVisibility();
    }
  }, [isArtist]);

  // Fetch visitor counter visibility config
  useEffect(() => {
    const fetchVisitorCounterVisibility = async () => {
      try {
        const { data, error } = await supabase
          .from('app_config')
          .select('key, value')
          .eq('key', 'visitor_counter_visible')
          .single();

        if (!error && data) {
          setVisitorCounterVisible(data.value === true || data.value === 'true');
        }
      } catch (err) {
        console.error('Error fetching visitor counter visibility config:', err);
        // Default to visible if error
        setVisitorCounterVisible(true);
      }
    };

    fetchVisitorCounterVisibility();
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (showMobileMenu) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [showMobileMenu]);

  // Close dropdowns when clicking/touching outside (works for mobile touch)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = (e.target as Node);
      if (categoriesDropdownRef.current && !categoriesDropdownRef.current.contains(target)) {
        setShowCategoriesDropdown(false);
      }
      if (artistToolsDropdownRef.current && !artistToolsDropdownRef.current.contains(target)) {
        setShowArtistToolsMenu(false);
      }
      if (adminToolsDropdownRef.current && !adminToolsDropdownRef.current.contains(target)) {
        setShowAdminToolsMenu(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setShowProfileMenu(false);
      }
      // Close mobile menu when tapping/clicking outside the hamburger button and the menu panel
      if (
        showMobileMenu &&
        !mobileMenuButtonRef.current?.contains(target) &&
        !mobileMenuPanelRef.current?.contains(target)
      ) {
        setShowMobileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showMobileMenu]);

  // Main navigation items (Help and Favorites moved to profile menu for smaller screens)
  const mainNavItems = [
    { to: '/', label: 'Home' },
    { to: '/live-events', label: 'Live Events', icon: Radio },
    { to: '/upcoming-concerts', label: 'Upcoming Concerts', icon: Calendar },
    { to: '/categories', label: 'Categories' }
  ];

  const desktopMainNavItems = mainNavItems;

  // Artist-specific items
  const artistNavItems = [
    { to: '/schedule', label: 'Schedule', icon: Calendar },
    { to: '/go-live', label: 'Go Live', icon: Radio },
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/followers', label: 'Followers', icon: Users },
    ...(artistRecordingsVisible ? [{ to: '/recordings', label: 'My Recordings', icon: Video }] : [])
  ];

  // Admin items (grouped in dropdown)
  const adminNavItems = isSuperAdmin ? [
    { to: '/schedule', label: 'Schedule', icon: Calendar },
    { to: '/monitoring', label: 'Monitoring', icon: Activity },
    { to: '/users', label: 'Users', icon: Users },
    { to: '/advertisements', label: 'Advertisements', icon: MonitorPlay },
    { to: '/artist-management', label: 'Artist Management', icon: UserCog },
    { to: '/recordings', label: 'Recordings', icon: Video },
    { to: '/tickets', label: 'Tickets', icon: Ticket },
    { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/help-management', label: 'Help Management', icon: Settings },
    { to: '/photo-management', label: 'Photo Management', icon: Settings }
  ] : isAdmin ? [
    { to: '/schedule', label: 'Schedule', icon: Calendar },
    { to: '/monitoring', label: 'Monitoring', icon: Activity },
    { to: '/users', label: 'Users', icon: Users },
    { to: '/advertisements', label: 'Advertisements', icon: MonitorPlay },
    { to: '/artist-management', label: 'Artist Management', icon: UserCog },
    { to: '/recordings', label: 'Recordings', icon: Video },
    { to: '/tickets', label: 'Tickets', icon: Ticket },
    { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/help-management', label: 'Help Management', icon: Settings }
  ] : [];

  // Mobile nav items in specified order: Home, Go Live, Schedule, Live Events, Upcoming Concert, Dashboard, Categories
  const mobileNavItems = [
    { to: '/', label: 'Home' },
    ...(isArtist ? [{ to: '/go-live', label: 'Go Live', icon: Radio }] : []),
    ...(isArtist || isAdmin || isSuperAdmin ? [{ to: '/schedule', label: 'Schedule', icon: Calendar }] : []),
    { to: '/live-events', label: 'Live Events', icon: Radio },
    { to: '/upcoming-concerts', label: 'Upcoming Concerts', icon: Calendar },
    ...(isArtist ? [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }] : []),
    { to: '/categories', label: 'Categories' },
    ...(adminNavItems.length > 0 ? adminNavItems : [])
  ];
  // For mobile: use ordered list; for other uses (e.g. future) keep combined items
  const allNavItems = [
    ...mainNavItems,
    ...(isArtist ? artistNavItems : []),
    ...adminNavItems
  ];

  return (
    <nav className="bg-gradient-to-b from-gray-900/95 via-gray-900/90 to-gray-900/95 backdrop-blur-xl text-white py-4 fixed w-full z-50 shadow-2xl border-b border-white/10 min-h-20">
      <div className="flex items-center">
        {/* Logo - Fixed left with minimal padding */}
        <div className="pl-4 flex-shrink-0">
          <Link to="/" className="flex items-center space-x-2 group">
            <div className="relative w-12 h-12 flex-shrink-0">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full blur-md opacity-50 group-hover:opacity-75 transition-opacity"></div>
              <div className="relative w-full h-full rounded-full overflow-hidden ring-2 ring-white/20 group-hover:ring-purple-500/50 transition-all duration-300">
                <img 
                  src="/logod.png" 
                  alt="DREEMYSTAR Logo" 
                  className="w-full h-full object-cover"
                  style={{ objectPosition: 'center' }}
                />
              </div>
            </div>
            <span className="text-lg font-bold hidden xl:block bg-gradient-to-r from-purple-300 via-pink-300 to-purple-300 bg-clip-text text-transparent group-hover:from-purple-200 group-hover:via-pink-200 group-hover:to-purple-200 transition-all duration-300 whitespace-nowrap">
              DREEMYSTAR LIVE CONCERT
            </span>
          </Link>
        </div>

        {/* Navigation Container - Takes remaining space; min-w-0 allows shrinking */}
        <div className="flex-1 min-w-0 max-w-7xl px-6 ml-8 xl:ml-10">
          <div className="flex items-center justify-between gap-4 min-w-0">
            {/* Desktop Navigation - Centered; no scroll (Favorites/My Profile in More dropdown) */}
            <div className="hidden xl:flex items-center space-x-2 flex-1 min-w-0 px-4 justify-center">
            {desktopMainNavItems.map(item => (
              item.label === 'Categories' ? (
                <div 
                  key={item.to}
                  ref={categoriesDropdownRef}
                  className="relative flex-shrink-0"
                >
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (popularCategories.length > 0) {
                          setShowCategoriesDropdown(prev => !prev);
                        } else {
                          navigate('/categories');
                          window.scrollTo(0, 0);
                        }
                      }}
                      className={`px-3 py-2 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center space-x-1.5 whitespace-nowrap ${
                        location.pathname === item.to 
                          ? 'bg-gradient-to-r from-purple-600/30 to-pink-600/30 text-white border border-purple-500/50 shadow-lg shadow-purple-500/20' 
                          : 'text-gray-300 hover:text-white hover:bg-white/5 border border-transparent'
                      }`}
                      aria-expanded={showCategoriesDropdown}
                      aria-haspopup="true"
                    >
                      {item.icon && <item.icon size={16} />}
                      <span>{item.label}</span>
                      <ChevronRight 
                        size={14} 
                        className={`transition-transform duration-300 ${
                          showCategoriesDropdown ? 'rotate-90' : ''
                        }`} 
                      />
                    </button>
                  </div>
                  {showCategoriesDropdown && popularCategories.length > 0 && (
                    <div 
                      className="absolute left-0 mt-2 w-72 bg-gradient-to-br from-gray-900/95 via-gray-800/95 to-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl py-3 border border-white/10 z-[100] animate-in fade-in slide-in-from-top-2 duration-300"
                    >
                      {/* View All Categories Link */}
                      <Link
                        to="/categories"
                        className="block px-4 py-3 mx-2 mb-2 text-white hover:bg-gradient-to-r hover:from-purple-600/30 hover:to-pink-600/30 transition-all duration-300 font-bold rounded-xl border border-white/10 hover:border-purple-500/50 group"
                        onClick={() => {
                          setShowCategoriesDropdown(false);
                          window.scrollTo(0, 0);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent group-hover:from-purple-200 group-hover:to-pink-200 transition-all">
                            View All Categories
                          </span>
                          <ChevronRight size={14} className="text-purple-400 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </Link>
                      
                      {/* Popular Categories */}
                      <div className="px-2 py-2">
                        <div className="px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                          <div className="w-1 h-4 bg-gradient-to-b from-purple-500 to-pink-500 rounded-full"></div>
                          Quick Access
                        </div>
                        {popularCategories.map((category) => {
                          const categoryUrl = `/categories?${category.type === 'region' ? 'genre' : 'genre'}=${encodeURIComponent(category.name)}`;
                          const isActive = location.search.includes(encodeURIComponent(category.name));
                          
                          return (
                            <Link
                              key={`${category.type}-${category.name}`}
                              to={categoryUrl}
                              className={`flex items-center justify-between px-3 py-2.5 mx-2 rounded-xl transition-all duration-300 group/item cursor-pointer mb-1 ${
                                isActive 
                                  ? 'bg-gradient-to-r from-purple-600/40 to-pink-600/40 text-white border border-purple-500/50 shadow-lg shadow-purple-500/20' 
                                  : 'text-white hover:bg-white/5 border border-transparent hover:border-white/10'
                              }`}
                              onClick={() => {
                                setShowCategoriesDropdown(false);
                                window.scrollTo(0, 0);
                              }}
                            >
                              <div className="flex items-center space-x-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                  isActive 
                                    ? 'bg-white/20' 
                                    : category.type === 'type' && category.name === 'Music'
                                    ? 'bg-purple-500/20'
                                    : category.type === 'type' && category.name === 'Comedy'
                                    ? 'bg-pink-500/20'
                                    : 'bg-blue-500/20'
                                }`}>
                                  {category.type === 'type' ? (
                                    category.name === 'Music' ? (
                                      <Music size={16} className={isActive ? "text-white" : "text-purple-400"} />
                                    ) : (
                                      <Mic size={16} className={isActive ? "text-white" : "text-pink-400"} />
                                    )
                                  ) : (
                                    <Globe size={16} className={isActive ? "text-white" : "text-blue-400"} />
                                  )}
                                </div>
                                <span className="text-sm font-semibold">{category.name}</span>
                              </div>
                              {category.count > 0 && (
                                <span className={`text-xs px-2.5 py-1 rounded-lg font-bold ${
                                  isActive 
                                    ? 'bg-white/20 text-white' 
                                    : 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 group-hover/item:from-purple-500/40 group-hover/item:to-pink-500/40'
                                }`}>
                                  {category.count}
                                </span>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`px-3 py-2 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center space-x-1.5 whitespace-nowrap flex-shrink-0 ${
                    location.pathname === item.to 
                      ? 'bg-gradient-to-r from-purple-600/30 to-pink-600/30 text-white border border-purple-500/50 shadow-lg shadow-purple-500/20' 
                      : 'text-gray-300 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                  onClick={() => window.scrollTo(0, 0)}
                >
                  {item.icon && <item.icon size={16} />}
                  <span>{item.label}</span>
                </Link>
              )
            ))}

            {/* Artist Tools Dropdown */}
            {isArtist && (
              <div 
                ref={artistToolsDropdownRef}
                className="relative flex-shrink-0"
              >
                <button
                  type="button"
                  onClick={() => setShowArtistToolsMenu(prev => !prev)}
                  className={`px-3 py-2 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center space-x-1.5 whitespace-nowrap ${
                    artistNavItems.some(item => location.pathname === item.to)
                      ? 'bg-gradient-to-r from-purple-600/30 to-pink-600/30 text-white border border-purple-500/50 shadow-lg shadow-purple-500/20' 
                      : 'text-gray-300 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <Radio size={16} />
                  <span>Artist Tools</span>
                  <ChevronRight 
                    size={14} 
                    className={`transition-transform duration-300 ${
                      showArtistToolsMenu ? 'rotate-90' : ''
                    }`} 
                  />
                </button>
                {showArtistToolsMenu && (
                  <div 
                    className="absolute left-0 mt-2 w-56 bg-gradient-to-br from-gray-900/95 via-gray-800/95 to-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl py-2 border border-white/10 z-[100] animate-in fade-in slide-in-from-top-2 duration-300"
                  >
                    {artistNavItems.map((item) => (
                      <Link
                        key={item.to}
                        to={item.to}
                        className={`flex items-center px-4 py-3 text-white hover:bg-gradient-to-r hover:from-purple-600/30 hover:to-pink-600/30 transition-all duration-300 mx-2 rounded-xl group ${
                          location.pathname === item.to ? 'bg-gradient-to-r from-purple-600/30 to-pink-600/30' : ''
                        }`}
                        onClick={() => {
                          setShowArtistToolsMenu(false);
                          window.scrollTo(0, 0);
                        }}
                      >
                        <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center mr-3 group-hover:bg-purple-500/30 transition-colors">
                          {item.icon && <item.icon size={16} className="text-purple-400" />}
                        </div>
                        <span className="font-semibold">{item.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Admin Tools Dropdown */}
            {(isAdmin || isSuperAdmin) && adminNavItems.length > 0 && (
              <div 
                ref={adminToolsDropdownRef}
                className="relative flex-shrink-0"
              >
                <button
                  type="button"
                  onClick={() => setShowAdminToolsMenu(prev => !prev)}
                  className={`px-3 py-2 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center space-x-1.5 whitespace-nowrap ${
                    adminNavItems.some(item => location.pathname === item.to)
                      ? 'bg-gradient-to-r from-purple-600/30 to-pink-600/30 text-white border border-purple-500/50 shadow-lg shadow-purple-500/20' 
                      : 'text-gray-300 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <LayoutDashboard size={16} />
                  <span>Admin Tools</span>
                  <ChevronRight 
                    size={14} 
                    className={`transition-transform duration-300 ${
                      showAdminToolsMenu ? 'rotate-90' : ''
                    }`} 
                  />
                </button>
                {showAdminToolsMenu && (
                  <div 
                    className="absolute left-0 mt-2 w-64 bg-gradient-to-br from-gray-900/95 via-gray-800/95 to-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl py-2 border border-white/10 z-[100] animate-in fade-in slide-in-from-top-2 duration-300"
                  >
                    <div className="px-3 py-2 mb-2">
                      <div className="px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <div className="w-1 h-4 bg-gradient-to-b from-purple-500 to-pink-500 rounded-full"></div>
                        {isSuperAdmin ? 'Super Admin' : 'Admin'} Panel
                      </div>
                    </div>
                    {adminNavItems.map((item) => (
                      <Link
                        key={item.to}
                        to={item.to}
                        className={`flex items-center px-4 py-3 text-white hover:bg-gradient-to-r hover:from-purple-600/30 hover:to-pink-600/30 transition-all duration-300 mx-2 rounded-xl group ${
                          location.pathname === item.to ? 'bg-gradient-to-r from-purple-600/30 to-pink-600/30' : ''
                        }`}
                        onClick={() => {
                          setShowAdminToolsMenu(false);
                          window.scrollTo(0, 0);
                        }}
                      >
                        <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center mr-3 group-hover:bg-purple-500/30 transition-colors">
                          {item.icon && <item.icon size={16} className="text-purple-400" />}
                        </div>
                        <span className="font-semibold">{item.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
            </div>

            {/* Search, Auth, and Visitor Counter - flex-shrink-0 so this block never shrinks and center nav scrolls instead of overlapping */}
            <div className="flex items-center space-x-2 ml-auto flex-shrink-0">
            <div className="relative hidden md:block min-w-0 flex-shrink">
              <form onSubmit={handleSearchSubmit} className="relative min-w-0">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 cursor-pointer hover:text-purple-400 transition-colors z-10" size={18} onClick={handleSearchSubmit} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearch}
                  onKeyPress={handleSearchKeyPress}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  placeholder="Search..."
                  className={`pl-10 pr-4 py-2 bg-gradient-to-br from-gray-800/80 to-gray-700/60 backdrop-blur-sm border border-white/10 rounded-full text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500/50 transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-purple-500/20 ${
                    searchFocused || searchQuery.length > 0 ? 'w-48 min-w-[8rem] max-w-[14rem]' : 'w-20 min-w-[5rem]'
                  }`}
                />
              </form>
            </div>

            {/* Visitor Counter */}
            {visitorCounterVisible && (
              <div className="hidden xl:block flex-shrink-0">
                <VisitorCounter />
              </div>
            )}

            {/* Cart Icon */}
            <div className="flex-shrink-0">
              <CartIcon />
            </div>

            {user && (
              <div className="flex-shrink-0">
                <NotificationsPanel />
              </div>
            )}

            {user ? (
              <div ref={profileMenuRef} className="relative flex-shrink-0">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center space-x-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all duration-300 group"
                >
                  {userProfile?.avatar_url ? (
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full blur-sm opacity-50 group-hover:opacity-75 transition-opacity"></div>
                      <img
                        src={userProfile.avatar_url}
                        alt="Profile"
                        className="h-8 w-8 rounded-full object-cover ring-2 ring-purple-500/50 relative z-10 group-hover:ring-purple-500 transition-all"
                        style={{ objectPosition: 'center top' }}
                      />
                    </div>
                  ) : (
                    <div className="h-8 w-8 bg-gradient-to-br from-purple-500/30 to-pink-500/30 rounded-full flex items-center justify-center ring-2 ring-purple-500/50 group-hover:ring-purple-500 transition-all">
                      <User className="h-5 w-5 text-purple-300" />
                    </div>
                  )}
                  <span className="hidden sm:inline font-semibold text-gray-300 group-hover:text-white transition-colors">
                    {userProfile?.full_name || 'User'}
                  </span>
                </button>
                
                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-gradient-to-br from-gray-900/95 via-gray-800/95 to-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl py-2 border border-white/10 z-[100] animate-in fade-in slide-in-from-top-2 duration-300">
                    <Link
                      to={`/artist/${user.id}`}
                      className="flex items-center px-4 py-3 text-white hover:bg-gradient-to-r hover:from-purple-600/30 hover:to-pink-600/30 transition-all duration-300 mx-2 rounded-xl group"
                      onClick={() => {
                        setShowProfileMenu(false);
                        window.scrollTo(0, 0);
                      }}
                    >
                      <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center mr-3 group-hover:bg-purple-500/30 transition-colors">
                        <UserCircle size={16} className="text-purple-400" />
                      </div>
                      <span className="font-semibold">My Profile</span>
                    </Link>
                    {!isAdmin && !isSuperAdmin && (
                      <>
                        <Link
                          to="/favorites"
                          className="flex items-center px-4 py-3 text-white hover:bg-gradient-to-r hover:from-purple-600/30 hover:to-pink-600/30 transition-all duration-300 mx-2 rounded-xl group"
                          onClick={() => {
                            setShowProfileMenu(false);
                            window.scrollTo(0, 0);
                          }}
                        >
                          <div className="w-8 h-8 rounded-lg bg-pink-500/20 flex items-center justify-center mr-3 group-hover:bg-pink-500/30 transition-colors">
                            <Heart size={16} className="text-pink-400" />
                          </div>
                          <span className="font-semibold">Favorites</span>
                        </Link>
                        <Link
                          to="/help"
                          className="flex items-center px-4 py-3 text-white hover:bg-gradient-to-r hover:from-purple-600/30 hover:to-pink-600/30 transition-all duration-300 mx-2 rounded-xl group"
                          onClick={() => {
                            setShowProfileMenu(false);
                            window.scrollTo(0, 0);
                          }}
                        >
                          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center mr-3 group-hover:bg-amber-500/30 transition-colors">
                            <HelpCircle size={16} className="text-amber-400" />
                          </div>
                          <span className="font-semibold">Help</span>
                        </Link>
                      </>
                    )}
                    {isArtist || isAdmin ? (
                      <Link
                        to="/dashboard"
                        className="flex items-center px-4 py-3 text-white hover:bg-gradient-to-r hover:from-blue-600/30 hover:to-cyan-600/30 transition-all duration-300 mx-2 rounded-xl group"
                        onClick={() => {
                          setShowProfileMenu(false);
                          window.scrollTo(0, 0);
                        }}
                      >
                        <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center mr-3 group-hover:bg-blue-500/30 transition-colors">
                          <Activity size={16} className="text-blue-400" />
                        </div>
                        <span className="font-semibold">Dashboard</span>
                      </Link>
                    ) : (
                      <Link
                        to="/profile"
                        className="flex items-center px-4 py-3 text-white hover:bg-gradient-to-r hover:from-gray-600/30 hover:to-gray-700/30 transition-all duration-300 mx-2 rounded-xl group"
                        onClick={() => {
                          setShowProfileMenu(false);
                          window.scrollTo(0, 0);
                        }}
                      >
                        <div className="w-8 h-8 rounded-lg bg-gray-500/20 flex items-center justify-center mr-3 group-hover:bg-gray-500/30 transition-colors">
                          <Settings size={16} className="text-gray-400" />
                        </div>
                        <span className="font-semibold">Settings</span>
                      </Link>
                    )}
                    <div className="border-t border-white/10 my-2"></div>
                    <button
                      onClick={() => {
                        handleSignOut();
                        setShowProfileMenu(false);
                      }}
                      className="flex items-center w-full text-left px-4 py-3 text-white hover:bg-gradient-to-r hover:from-red-600/30 hover:to-rose-600/30 transition-all duration-300 mx-2 rounded-xl group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center mr-3 group-hover:bg-red-500/30 transition-colors">
                        <LogOut size={16} className="text-red-400" />
                      </div>
                      <span className="font-semibold">Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/login"
                className="px-6 py-3 bg-gradient-to-r from-yellow-500 via-orange-500 to-yellow-500 hover:from-yellow-600 hover:via-orange-600 hover:to-yellow-600 text-white rounded-xl font-bold transition-all duration-300 shadow-xl shadow-yellow-500/40 hover:shadow-2xl hover:shadow-yellow-500/50 hover:scale-105 flex items-center space-x-2 border border-yellow-400/30 relative overflow-hidden group"
                onClick={() => window.scrollTo(0, 0)}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                <User className="w-5 h-5 relative z-10" />
                <span className="relative z-10">Sign In</span>
              </Link>
            )}

            {/* Mobile Menu Button (xl so it shows when desktop nav is hidden, keeping right buttons visible) */}
            <button
              ref={mobileMenuButtonRef}
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="xl:hidden w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all duration-300 flex items-center justify-center group flex-shrink-0"
            >
              {showMobileMenu ? <X size={20} className="group-hover:scale-110 transition-transform" /> : <Menu size={20} className="group-hover:scale-110 transition-transform" />}
            </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation (xl so it matches hamburger visibility) */}
      {showMobileMenu && (
        <div ref={mobileMenuPanelRef} className="xl:hidden mt-4 py-4 border-t border-white/10 animate-in slide-in-from-top duration-300 px-4 bg-gradient-to-b from-gray-900/95 via-gray-900/90 to-gray-900/95 backdrop-blur-xl relative z-[60] max-h-[calc(100vh-80px)] overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col space-y-4">
              {/* Mobile Search */}
              <form onSubmit={handleSearchSubmit} className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 cursor-pointer hover:text-purple-400 transition-colors z-10" size={20} onClick={handleSearchSubmit} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearch}
                  onKeyPress={handleSearchKeyPress}
                  placeholder="Search artists, events, genres..."
                  className="w-full pl-12 pr-4 py-3 bg-gradient-to-br from-gray-800/80 to-gray-700/60 backdrop-blur-sm border border-white/10 rounded-full text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500/50 shadow-xl"
                />
              </form>

              {/* Mobile Visitor Counter */}
              {visitorCounterVisible && (
                <div className="flex justify-center sm:hidden">
                  <VisitorCounter />
                </div>
              )}

              {/* Mobile Nav Items */}
              {mobileNavItems.map(item => (
                item.label === 'Categories' ? (
                  <div key={item.to} className="flex flex-col">
                    <Link
                      to={item.to}
                      onClick={() => {
                        setShowMobileMenu(false);
                        window.scrollTo(0, 0);
                      }}
                      className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 font-semibold ${
                        location.pathname === item.to 
                          ? 'bg-gradient-to-r from-purple-600/30 to-pink-600/30 text-white border border-purple-500/50 shadow-lg' 
                          : 'text-gray-300 hover:text-white hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      {item.icon && <item.icon size={20} />}
                      <span>{item.label}</span>
                    </Link>
                    <div className="ml-6 mt-2 flex flex-col space-y-2 bg-gray-800/95 backdrop-blur-sm rounded-xl p-3 border border-white/10 relative z-[70]">
                      {popularCategories.length > 0 ? (
                        <>
                          <Link
                            to="/categories"
                            onClick={() => {
                              setShowMobileMenu(false);
                              window.scrollTo(0, 0);
                            }}
                            className="px-3 py-2 rounded-lg hover:bg-gradient-to-r hover:from-purple-600/30 hover:to-pink-600/30 transition-all duration-300 font-bold text-purple-300 border border-purple-500/30"
                          >
                            View All Categories
                          </Link>
                          {popularCategories.map((category) => (
                            <Link
                              key={`${category.type}-${category.name}`}
                              to={`/categories?${category.type === 'region' ? 'genre' : 'genre'}=${encodeURIComponent(category.name)}`}
                              onClick={() => {
                                setShowMobileMenu(false);
                                window.scrollTo(0, 0);
                              }}
                              className={`px-3 py-2 rounded-lg hover:bg-white/5 transition-all duration-300 flex items-center justify-between ${
                                location.pathname === '/categories' ? 'text-gray-200' : 'text-gray-400'
                              }`}
                            >
                              <div className="flex items-center space-x-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                  category.type === 'type' && category.name === 'Music'
                                    ? 'bg-purple-500/20'
                                    : category.type === 'type' && category.name === 'Comedy'
                                    ? 'bg-pink-500/20'
                                    : 'bg-blue-500/20'
                                }`}>
                                  {category.type === 'type' ? (
                                    category.name === 'Music' ? (
                                      <Music size={14} className="text-purple-400" />
                                    ) : (
                                      <Mic size={14} className="text-pink-400" />
                                    )
                                  ) : (
                                    <Globe size={14} className="text-blue-400" />
                                  )}
                                </div>
                                <span className="font-semibold">{category.name}</span>
                              </div>
                              {category.count > 0 && (
                                <span className="text-xs px-2 py-1 rounded-lg bg-purple-500/20 text-purple-300 font-bold">({category.count})</span>
                              )}
                            </Link>
                          ))}
                        </>
                      ) : (
                        <>
                          <Link
                            to="/categories?genre=Music"
                            onClick={() => {
                              setShowMobileMenu(false);
                              window.scrollTo(0, 0);
                            }}
                            className="px-3 py-2 rounded-lg hover:bg-white/5 transition-all duration-300 flex items-center space-x-3"
                          >
                            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                              <Music size={14} className="text-purple-400" />
                            </div>
                            <span className="font-semibold">Music</span>
                          </Link>
                          <Link
                            to="/categories?genre=Comedy"
                            onClick={() => {
                              setShowMobileMenu(false);
                              window.scrollTo(0, 0);
                            }}
                            className="px-3 py-2 rounded-lg hover:bg-white/5 transition-all duration-300 flex items-center space-x-3"
                          >
                            <div className="w-8 h-8 rounded-lg bg-pink-500/20 flex items-center justify-center">
                              <Mic size={14} className="text-pink-400" />
                            </div>
                            <span className="font-semibold">Comedy</span>
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => {
                      setShowMobileMenu(false);
                      window.scrollTo(0, 0);
                    }}
                    className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 font-semibold ${
                      location.pathname === item.to 
                        ? 'bg-gradient-to-r from-purple-600/30 to-pink-600/30 text-white border border-purple-500/50 shadow-lg' 
                        : 'text-gray-300 hover:text-white hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    {item.icon && <item.icon size={20} />}
                    <span>{item.label}</span>
                  </Link>
                )
              ))}
            </div>
          </div>
        </div>
        )}
    </nav>
  );
};

export default Navbar;