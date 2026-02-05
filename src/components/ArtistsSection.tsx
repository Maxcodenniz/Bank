import React, { useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import { Artist } from '../types';
import ArtistCard from './ArtistCard';
import SectionHeader from './SectionHeader';
import CategoryFilter from './CategoryFilter';
import { supabase } from '../lib/supabaseClient';
import { normalizeCountryName } from '../utils/countries';

interface ArtistsSectionProps {
  searchQuery: string;
}

const ArtistsSection: React.FC<ArtistsSectionProps> = ({ searchQuery }) => {
  const [activeCategory, setActiveCategory] = useState('all');
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>(['all']);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Test Supabase connection first
        const { data: testData, error: testError } = await supabase
          .from('genres')
          .select('count', { count: 'exact', head: true });

        if (testError) {
          throw new Error(`Connection test failed: ${testError.message}`);
        }

        await Promise.all([fetchArtists(), fetchCategories()]);
      } catch (err) {
        console.error('Error initializing data:', err);
        const errorMessage = err instanceof Error 
          ? `Connection error: ${err.message}. Please check your Supabase configuration.`
          : 'Failed to initialize data. Please check your connection.';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    initializeData();
  }, []);

  const fetchCategories = async () => {
    try {
      setError(null);
      
      // Fetch artists to determine available categories
      const { data: artistsData, error: artistsError } = await supabase
        .from('profiles')
        .select('artist_type, region')
        .eq('user_type', 'artist');

      if (artistsError) {
        console.error('Supabase fetch error:', {
          message: artistsError.message,
          details: artistsError.details,
          hint: artistsError.hint
        });
        throw new Error(`Database error: ${artistsError.message}`);
      }

      const categoriesList: string[] = ['all'];

      // Add genres (Music, Comedy) first
      const artistTypes = new Set<string>();
      artistsData?.forEach(artist => {
        if (artist.artist_type) {
          artistTypes.add(artist.artist_type.charAt(0).toUpperCase() + artist.artist_type.slice(1));
        }
      });
      
      // Add genres in order: Music, Comedy
      if (artistTypes.has('Music')) categoriesList.push('music');
      if (artistTypes.has('Comedy')) categoriesList.push('comedy');

      // Add regions in order: African, European, American, Asian, Maghreb
      const regionOrder = ['African', 'European', 'American', 'Asian', 'Maghreb'];
      const regions = new Set<string>();
      artistsData?.forEach(artist => {
        if (artist.region) {
          regions.add(artist.region);
        }
      });

      // Add regions in the specified order
      regionOrder.forEach(region => {
        if (regions.has(region)) {
          categoriesList.push(region.toLowerCase());
        }
      });

      setCategories(categoriesList);
    } catch (err) {
      const errorMessage = err instanceof Error 
        ? `Failed to fetch categories: ${err.message}`
        : 'Failed to fetch categories';
      console.error('Error fetching categories:', err);
      setError(errorMessage);
      // Set default categories in case of error (genres first, then regions)
      setCategories(['all', 'music', 'comedy', 'african', 'european', 'american', 'asian', 'maghreb']);
    }
  };

  const fetchArtists = async () => {
    try {
      setError(null);
      const { data, error: supabaseError, status } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_type', 'artist');

      if (supabaseError) {
        console.error('Supabase fetch error:', {
          message: supabaseError.message,
          details: supabaseError.details,
          hint: supabaseError.hint,
          status
        });
        throw new Error(`Database error: ${supabaseError.message}`);
      }

      if (!data) {
        throw new Error('No data received from database');
      }

      const formattedArtists: Artist[] = data.map(profile => ({
        id: profile.id,
        name: profile.username || '',
        imageUrl: profile.avatar_url || 'https://images.pexels.com/photos/1699161/pexels-photo-1699161.jpeg',
        genre: profile.genres?.[0] || 'Various',
        categories: [
          profile.region || '',
          normalizeCountryName(profile.country) || '',
          profile.artist_type === 'music' ? 'Music' : 'Comedy',
          ...(profile.genres || [])
        ].filter(Boolean),
        bio: profile.bio || 'No biography available.',
        socialLinks: {},
      }));

      setArtists(formattedArtists);
    } catch (err) {
      const errorMessage = err instanceof Error 
        ? `Failed to fetch artists: ${err.message}`
        : 'Failed to fetch artists';
      console.error('Error fetching artists:', err);
      setError(errorMessage);
      setArtists([]);
    }
  };

  // Maghreb countries list (normalized)
  const maghrebCountries = ['Morocco', 'Algeria', 'Tunisia', 'Libya', 'Mauritania'].map(c => c.toLowerCase());

  const filteredArtists = artists.filter(artist => {
    const artistCategories = artist.categories || [];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const artistName = (artist.name || '').toLowerCase();
      const artistGenre = (artist.genre || '').toLowerCase();
      
      return (
        artistName.includes(query) ||
        artistGenre.includes(query) ||
        artistCategories.some(cat => 
          cat && cat.toLowerCase().includes(query)
        )
      );
    }

    if (activeCategory !== 'all') {
      const activeCategoryLower = activeCategory.toLowerCase();
      
      // Handle genre filters (Music, Comedy)
      if (activeCategoryLower === 'music' || activeCategoryLower === 'comedy') {
        return artistCategories.some(cat => 
          cat && cat.toLowerCase() === activeCategoryLower
        );
      }
      
      // Handle region filters
      if (['african', 'european', 'american', 'asian', 'maghreb'].includes(activeCategoryLower)) {
        // Special handling for Maghreb region
        if (activeCategoryLower === 'maghreb') {
          // Check if artist's region is Maghreb or country is in the Maghreb region
          return artistCategories.some(cat => {
            if (!cat) return false;
            // Check if region is Maghreb
            if (cat.toLowerCase() === 'maghreb') return true;
            // Check if country is in the Maghreb region
            const normalizedCountry = normalizeCountryName(cat);
            if (!normalizedCountry) return false;
            return maghrebCountries.includes(normalizedCountry.toLowerCase());
          });
        }
        
        // Standard region matching
        return artistCategories.some(cat => 
          cat && cat.toLowerCase() === activeCategoryLower
        );
      }
      
      // Fallback: standard category matching
      return artistCategories.some(cat => 
        cat && cat.toLowerCase() === activeCategoryLower
      );
    }

    return true;
  });

  return (
    <section className="relative py-20 bg-gradient-to-br from-gray-950 via-black to-gray-950 overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-600/5 rounded-full blur-3xl"></div>
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <SectionHeader 
          title="Featured Artists" 
          icon={<Users className="h-6 w-6" />} 
        />
        
        <CategoryFilter 
          categories={categories} 
          activeCategory={activeCategory} 
          onCategoryChange={setActiveCategory} 
        />
        
        {error && (
          <div className="text-center py-4 mb-4">
            <div className="inline-block bg-gradient-to-r from-red-600/20 via-red-500/20 to-red-600/20 backdrop-blur-sm border-2 border-red-500/50 text-red-300 px-6 py-4 rounded-2xl">
              <p className="font-semibold">{error}</p>
              <span className="text-sm opacity-75 block mt-2">
                Please check your Supabase connection and try again.
              </span>
            </div>
          </div>
        )}
        
        {loading ? (
          <div className="flex flex-col justify-center items-center py-16">
            <div className="relative">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-500/30 border-t-purple-500"></div>
              <div className="absolute inset-0 animate-ping rounded-full h-16 w-16 border-2 border-purple-500/20"></div>
            </div>
            <p className="mt-6 text-gray-400 font-medium">Loading artists...</p>
          </div>
        ) : filteredArtists.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {filteredArtists.map((artist, index) => (
              <div
                key={artist.id}
                style={{ animationDelay: `${index * 50}ms` }}
                className="animate-fade-in"
              >
                <ArtistCard artist={artist} />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="bg-gradient-to-br from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-xl rounded-3xl p-12 max-w-md mx-auto border border-white/10 shadow-2xl">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center">
                <Users className="w-10 h-10 text-purple-400" />
              </div>
              <p className="text-gray-300 text-xl font-semibold mb-2">No Artists Found</p>
              <p className="text-gray-500 text-sm">
                {searchQuery 
                  ? `No artists found matching "${searchQuery}". Try using the search page for better results.`
                  : `No artists found in the "${activeCategory}" category`}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default ArtistsSection;