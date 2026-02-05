import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Filter, ChevronDown, Search, X, Loader2, AlertCircle, Grid, List } from 'lucide-react';
import ArtistCard from '../components/ArtistCard';
import { supabase } from '../lib/supabaseClient';
import { Artist } from '../types';
import { COUNTRIES, filterCountries, getUniqueNormalizedCountries, normalizeCountryName } from '../utils/countries';

interface Category {
  name: string;
  type: 'region' | 'type' | 'genre' | 'country';
  event_count: number;
  icon?: string;
}

const Categories: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const genreParam = searchParams.get('genre');
  const countryParam = searchParams.get('country');
  const typeParam = searchParams.get('type');
  
  const [activeType, setActiveType] = useState<string>(typeParam || 'all');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(genreParam);
  const [categories, setCategories] = useState<Category[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countries, setCountries] = useState<string[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>(countryParam || 'all');
  
  // Also check for artist_type and region parameters (for backward compatibility with footer links)
  const artistTypeParam = searchParams.get('artist_type');
  const regionParam = searchParams.get('region');
  
  // Map artist_type and region params to category selection
  useEffect(() => {
    if (artistTypeParam) {
      // Map 'music' -> 'Music', 'comedy' -> 'Comedy'
      const categoryName = artistTypeParam.charAt(0).toUpperCase() + artistTypeParam.slice(1);
      setSelectedCategory(categoryName);
      setActiveType('type');
    } else if (regionParam) {
      // Map region param to category selection
      setSelectedCategory(regionParam);
      setActiveType('region');
    }
  }, [artistTypeParam, regionParam]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [countrySearch, setCountrySearch] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const countryInputRef = useRef<HTMLInputElement>(null);
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  
  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (
        countryDropdownRef.current &&
        !countryDropdownRef.current.contains(event.target as Node) &&
        countryInputRef.current &&
        !countryInputRef.current.contains(event.target as Node)
      ) {
        setShowCountryDropdown(false);
      }
    };

    if (isDropdownOpen || showCountryDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen, showCountryDropdown]);

  // Sync URL params with state
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedCategory) params.set('genre', selectedCategory);
    if (selectedCountry !== 'all') params.set('country', selectedCountry);
    if (activeType !== 'all') params.set('type', activeType);
    
    navigate(`/categories?${params.toString()}`, { replace: true });
  }, [selectedCategory, selectedCountry, activeType, navigate]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all data in parallel for better performance
      const [genresResult, artistsResult] = await Promise.all([
        supabase.from('genres').select('*').order('name'),
        supabase.from('profiles').select('*').eq('user_type', 'artist')
      ]);

      if (genresResult.error) throw genresResult.error;
      if (artistsResult.error) throw artistsResult.error;

      const genresData = genresResult.data || [];
      const artistsData = artistsResult.data || [];

      // Get unique countries from artists, normalized to standard format
      const artistCountries = artistsData
        .map(artist => artist.country)
        .filter(Boolean);
      
      // Normalize and get unique countries from artists
      const uniqueCountriesFromArtists = getUniqueNormalizedCountries(artistCountries);
      
      // Combine artist countries with all world countries, removing duplicates
      // Use Set to ensure no duplicates, then sort
      const allCountries = Array.from(new Set([
        ...uniqueCountriesFromArtists,
        ...COUNTRIES
      ])).sort();
      
      setCountries(allCountries);

      // Create categories with counts
      const categoryCounts = new Map<string, Category>();
      
      // Add regions (including Maghreb)
      const maghrebCountries = ['Morocco', 'Algeria', 'Tunisia', 'Libya', 'Mauritania'].map(c => c.toLowerCase());
      const regions = ['African', 'European', 'American', 'Asian', 'Maghreb'];
      regions.forEach(region => {
        let count = artistsData.filter(artist => artist.region === region).length;
        
        // For Maghreb, also check country field for backward compatibility
        // Count artists with Maghreb countries who don't already have region='Maghreb'
        if (region === 'Maghreb') {
          const maghrebByCountry = artistsData.filter(artist => {
            // Skip if already counted by region
            if (artist.region === 'Maghreb') return false;
            if (!artist.country) return false;
            const normalizedCountry = normalizeCountryName(artist.country);
            if (!normalizedCountry) return false;
            return maghrebCountries.includes(normalizedCountry.toLowerCase());
          }).length;
          count += maghrebByCountry; // Add to the count
        }
        
        if (count > 0) {
          categoryCounts.set(region, {
            name: region,
            type: 'region',
            event_count: count
          });
        }
      });

      // Add artist types
      ['music', 'comedy'].forEach(type => {
        const count = artistsData.filter(artist => artist.artist_type === type).length;
        if (count > 0) {
          const typeName = type.charAt(0).toUpperCase() + type.slice(1);
          categoryCounts.set(typeName, {
            name: typeName,
            type: 'type',
            event_count: count
          });
        }
      });

      // Add genres
      genresData.forEach(genre => {
        const count = artistsData.filter(artist => 
          artist.genres && artist.genres.includes(genre.name)
        ).length;
        if (count > 0) {
          categoryCounts.set(genre.name, {
            name: genre.name,
            type: 'genre',
            event_count: count
          });
        }
      });

      // Add countries as categories (only countries that have artists)
      uniqueCountriesFromArtists.forEach(country => {
        // Count artists with this country (normalized comparison)
        const count = artistsData.filter(artist => {
          const normalizedArtistCountry = getUniqueNormalizedCountries([artist.country])[0];
          return normalizedArtistCountry === country;
        }).length;
        if (count > 0) {
          categoryCounts.set(country, {
            name: country,
            type: 'country',
            event_count: count
          });
        }
      });

      setCategories(Array.from(categoryCounts.values()));

      // Format artists
      const formattedArtists: Artist[] = artistsData.map(profile => {
        // Check if artist has a Maghreb country (for backward compatibility)
        const normalizedCountry = normalizeCountryName(profile.country);
        const hasMaghrebCountry = normalizedCountry && maghrebCountries.includes(normalizedCountry.toLowerCase());
        const shouldIncludeMaghreb = profile.region === 'Maghreb' || hasMaghrebCountry;
        
        return {
          id: profile.id,
          name: profile.username || 'Unknown Artist', // Only show username to fans (full_name is confidential)
          imageUrl: profile.avatar_url || 'https://images.pexels.com/photos/1699161/pexels-photo-1699161.jpeg',
          genre: profile.genres?.[0] || 'Various',
          categories: [
            profile.region || '',
            shouldIncludeMaghreb ? 'Maghreb' : null, // Add Maghreb if applicable
            normalizeCountryName(profile.country) || '',
            profile.artist_type === 'music' ? 'Music' : 'Comedy',
            ...(profile.genres || [])
          ].filter(Boolean),
          bio: profile.bio || `${profile.username || 'Artist'} is a talented ${profile.artist_type || 'performing'} artist from ${profile.country || 'around the world'}.`, // Only show username to fans (full_name is confidential)
          socialLinks: {},
        };
      });

      setArtists(formattedArtists);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load categories and artists');
    } finally {
      setLoading(false);
    }
  };

  // Memoized filtered categories
  const filteredCategories = useMemo(() => {
    let filtered = activeType === 'all' 
      ? categories 
      : categories.filter(category => category.type === activeType);
    
    // Sort by count (descending) then by name
    return filtered.sort((a, b) => {
      if (b.event_count !== a.event_count) {
        return b.event_count - a.event_count;
      }
      return a.name.localeCompare(b.name);
    });
  }, [categories, activeType]);

  // Memoized filtered artists with search
  const filteredArtists = useMemo(() => {
    return artists.filter(artist => {
      // Category filter
      const matchesCategory = !selectedCategory || artist.categories.includes(selectedCategory);
      
      // Country filter
      const matchesCountry = selectedCountry === 'all' || artist.categories.includes(selectedCountry);
      
      // Search filter
      const matchesSearch = !searchQuery || 
        artist.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        artist.genre.toLowerCase().includes(searchQuery.toLowerCase()) ||
        artist.categories.some(cat => cat.toLowerCase().includes(searchQuery.toLowerCase()));
      
      return matchesCategory && matchesCountry && matchesSearch;
    });
  }, [artists, selectedCategory, selectedCountry, searchQuery]);

  // Get unique types from the categories array
  const types = useMemo(() => 
    Array.from(new Set(categories.map(category => category.type))),
    [categories]
  );

  const handleCategorySelect = useCallback((categoryName: string) => {
    setSelectedCategory(selectedCategory === categoryName ? null : categoryName);
    setIsDropdownOpen(false);
  }, [selectedCategory]);

  const clearAllFilters = useCallback(() => {
    setSelectedCategory(null);
    setSelectedCountry('all');
    setActiveType('all');
    setSearchQuery('');
    setCountrySearch('');
  }, []);

  // Filter countries for autocomplete
  const filteredCountryOptions = useMemo(() => {
    return filterCountries(countrySearch);
  }, [countrySearch]);

  const getSelectedCategoryText = () => {
    if (!selectedCategory) return 'Select Category';
    const category = categories.find(c => c.name === selectedCategory);
    return category ? `${category.name} (${category.event_count} artists)` : selectedCategory;
  };

  const hasActiveFilters = selectedCategory || selectedCountry !== 'all' || activeType !== 'all' || searchQuery;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 relative overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>
      
      <div className="container mx-auto px-4 sm:px-6 py-8 pt-24 relative z-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-300 via-pink-300 to-purple-300 bg-clip-text text-transparent mb-2">
              Categories
            </h1>
            <p className="text-gray-400 text-base">
              Discover artists by genre, region, type, or country
            </p>
          </div>
        
        {/* View Mode Toggle */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-3 rounded-xl transition-all duration-300 ${
              viewMode === 'grid'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-xl shadow-purple-500/30'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'
            }`}
            aria-label="Grid view"
          >
            <Grid size={20} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-3 rounded-xl transition-all duration-300 ${
              viewMode === 'list'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-xl shadow-purple-500/30'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'
            }`}
            aria-label="List view"
          >
            <List size={20} />
          </button>
        </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search artists by name, genre, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-3 bg-gradient-to-br from-gray-900/80 to-gray-800/60 backdrop-blur-xl border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500/50 shadow-xl"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
              aria-label="Clear search"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        {/* Country Autocomplete */}
        <div className="flex items-center space-x-2 relative">
          <label className="text-gray-300 text-sm whitespace-nowrap">Country:</label>
          <div className="relative">
            <div className="relative">
              <input
                ref={countryInputRef}
                type="text"
                value={selectedCountry === 'all' ? countrySearch : selectedCountry}
                onChange={(e) => {
                  const value = e.target.value;
                  setCountrySearch(value);
                  if (value === '') {
                    setSelectedCountry('all');
                  } else {
                    // Check if it matches a country exactly
                    const exactMatch = COUNTRIES.find(c => c.toLowerCase() === value.toLowerCase());
                    if (exactMatch) {
                      setSelectedCountry(exactMatch);
                      setCountrySearch('');
                    } else {
                      setSelectedCountry('all'); // Keep as 'all' until a country is selected
                    }
                  }
                  // Show dropdown if user has typed 2+ characters
                  if (value.length >= 2) {
                    setShowCountryDropdown(true);
                  } else {
                    setShowCountryDropdown(false);
                  }
                }}
                onFocus={() => {
                  if (countrySearch.length >= 2 && filteredCountryOptions.length > 0) {
                    setShowCountryDropdown(true);
                  }
                }}
                placeholder={selectedCountry === 'all' ? "Type 2+ letters to search..." : selectedCountry}
                className="bg-gray-800 text-white border border-gray-700 rounded-lg pl-4 pr-10 py-2 text-sm hover:bg-gray-700 hover:border-gray-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-500 min-w-[200px]"
                autoComplete="off"
              />
              {selectedCountry !== 'all' && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCountry('all');
                    setCountrySearch('');
                    setShowCountryDropdown(false);
                    countryInputRef.current?.focus();
                  }}
                  className="absolute right-8 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                  aria-label="Clear country"
                >
                  <X size={16} />
                </button>
              )}
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            </div>
            
            {showCountryDropdown && filteredCountryOptions.length > 0 && (
              <div
                ref={countryDropdownRef}
                className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-64 overflow-y-auto"
              >
                <div className="p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCountry('all');
                      setCountrySearch('');
                      setShowCountryDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded transition-colors ${
                      selectedCountry === 'all'
                        ? 'bg-purple-600 text-white'
                        : 'text-white hover:bg-gray-700'
                    }`}
                  >
                    All Countries
                  </button>
                  {filteredCountryOptions.map((country) => {
                    const index = country.toLowerCase().indexOf(countrySearch.toLowerCase());
                    const beforeMatch = country.substring(0, index);
                    const match = country.substring(index, index + countrySearch.length);
                    const afterMatch = country.substring(index + countrySearch.length);
                    
                    return (
                      <button
                        key={country}
                        type="button"
                        onClick={() => {
                          setSelectedCountry(country);
                          setCountrySearch('');
                          setShowCountryDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded transition-colors ${
                          selectedCountry === country
                            ? 'bg-purple-600 text-white'
                            : 'text-white hover:bg-gray-700'
                        }`}
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
                  {filteredCountryOptions.length === 20 && (
                    <div className="px-3 py-2 text-xs text-gray-400 text-center">
                      Showing first 20 results. Type more to refine.
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {showCountryDropdown && countrySearch.length >= 2 && filteredCountryOptions.length === 0 && (
              <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-3">
                <div className="text-gray-400 text-sm text-center">
                  No countries found matching "{countrySearch}"
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Type Filter */}
        <div className="flex items-center space-x-2">
          <Filter className="h-5 w-5 text-purple-400" />
          <select
            value={activeType}
            onChange={(e) => {
              setActiveType(e.target.value);
              setSelectedCategory(null);
            }}
            className="bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-2 text-sm hover:bg-gray-700 hover:border-gray-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">All Types</option>
            {types.map(type => (
              <option key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
          >
            <X size={16} />
            <span>Clear Filters</span>
          </button>
        )}
      </div>
      
      {/* Error State */}
      {error && (
        <div className="bg-red-500 bg-opacity-10 border border-red-500 text-red-500 px-4 py-3 rounded-lg mb-6 flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" />
          <span>{error}</span>
          <button
            onClick={fetchData}
            className="ml-auto text-red-400 hover:text-red-300 underline text-sm"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-6">
          {/* Skeleton Loaders */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-gray-800 rounded-lg p-6 animate-pulse">
                <div className="w-full h-48 bg-gray-700 rounded-lg mb-4"></div>
                <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-700 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Category Selection - Improved UI */}
          <div className="mb-8">
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full sm:w-auto min-w-[280px] bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-left text-white hover:bg-gray-700 hover:border-gray-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 flex items-center justify-between"
                aria-expanded={isDropdownOpen}
                aria-haspopup="true"
              >
                <span>{getSelectedCategoryText()}</span>
                <ChevronDown 
                  className={`h-5 w-5 text-purple-400 transition-transform duration-200 ${
                    isDropdownOpen ? 'rotate-180' : ''
                  }`} 
                />
              </button>
              
              {isDropdownOpen && (
                <div className="absolute z-50 w-full mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-96 overflow-y-auto">
                  <div className="p-2">
                    <button
                      onClick={() => handleCategorySelect('')}
                      className={`w-full text-left px-3 py-2 rounded transition-colors duration-150 ${
                        !selectedCategory
                          ? 'bg-purple-600 text-white'
                          : 'text-white hover:bg-gray-700'
                      }`}
                    >
                      All Categories
                    </button>
                    {filteredCategories.length === 0 ? (
                      <div className="px-3 py-4 text-gray-400 text-sm text-center">
                        No categories found
                      </div>
                    ) : (
                      filteredCategories.map((category) => (
                        <button
                          key={category.name}
                          onClick={() => handleCategorySelect(category.name)}
                          className={`w-full text-left px-3 py-2 rounded transition-colors duration-150 flex items-center justify-between ${
                            selectedCategory === category.name
                              ? 'bg-purple-600 text-white'
                              : 'text-white hover:bg-gray-700'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{category.name}</div>
                            <div className="text-sm text-gray-400 capitalize">{category.type}</div>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full ml-2 flex-shrink-0 ${
                            selectedCategory === category.name
                              ? 'bg-purple-500 text-white'
                              : 'bg-gray-700 text-gray-300'
                          }`}>
                            {category.event_count}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* Active Filters Display */}
            {(selectedCategory || selectedCountry !== 'all' || activeType !== 'all') && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-gray-400 text-sm">Active filters:</span>
                {selectedCategory && (
                  <span className="bg-purple-600 text-white px-3 py-1 rounded-full text-sm flex items-center">
                    {selectedCategory}
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className="ml-2 hover:text-purple-200"
                      aria-label="Remove category filter"
                    >
                      <X size={14} />
                    </button>
                  </span>
                )}
                {selectedCountry !== 'all' && (
                  <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm flex items-center">
                    {selectedCountry}
                    <button
                      onClick={() => setSelectedCountry('all')}
                      className="ml-2 hover:text-blue-200"
                      aria-label="Remove country filter"
                    >
                      <X size={14} />
                    </button>
                  </span>
                )}
                {activeType !== 'all' && (
                  <span className="bg-green-600 text-white px-3 py-1 rounded-full text-sm flex items-center">
                    {activeType}
                    <button
                      onClick={() => setActiveType('all')}
                      className="ml-2 hover:text-green-200"
                      aria-label="Remove type filter"
                    >
                      <X size={14} />
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Artists Results */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                {hasActiveFilters ? (
                  <>
                    {selectedCategory && selectedCountry !== 'all' 
                      ? `Artists in ${selectedCategory} from ${selectedCountry}`
                      : selectedCategory 
                        ? `Artists in ${selectedCategory}`
                        : selectedCountry !== 'all'
                          ? `Artists from ${selectedCountry}`
                          : searchQuery
                            ? `Search results for "${searchQuery}"`
                            : 'All Artists'}
                    <span className="text-purple-400 text-lg ml-2 font-normal">
                      ({filteredArtists.length} {filteredArtists.length === 1 ? 'artist' : 'artists'})
                    </span>
                  </>
                ) : (
                  <>
                    All Artists
                    <span className="text-gray-400 text-lg ml-2 font-normal">
                      ({filteredArtists.length} {filteredArtists.length === 1 ? 'artist' : 'artists'})
                    </span>
                  </>
                )}
              </h2>
            </div>

            {filteredArtists.length > 0 ? (
              <div className={
                viewMode === 'grid'
                  ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
                  : 'space-y-4'
              }>
                {filteredArtists.map((artist) => (
                  <ArtistCard key={artist.id} artist={artist} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 bg-gray-800 rounded-lg">
                <div className="text-gray-400 text-lg mb-2">
                  {searchQuery 
                    ? `No artists found matching "${searchQuery}"`
                    : 'No artists found with the selected filters'}
                </div>
                <p className="text-gray-500 text-sm mb-4">
                  {searchQuery
                    ? 'Try a different search term'
                    : 'Try adjusting your filters or clearing them to see all artists'}
                </p>
                {hasActiveFilters && (
                  <button
                    onClick={clearAllFilters}
                    className="text-purple-400 hover:text-purple-300 underline text-sm"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}
      </div>
    </div>
  );
};

export default Categories;