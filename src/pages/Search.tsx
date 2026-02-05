import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Search as SearchIcon, User, Calendar, MapPin, Music, Mic } from 'lucide-react';
import ArtistCard from '../components/ArtistCard';
import ConcertCard from '../components/ConcertCard';
import { Artist, Concert } from '../types';

interface SearchResults {
  artists: Artist[];
  events: Concert[];
  genres: string[];
  countries: string[];
}

const Search: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('query') || '';
  const [searchQuery, setSearchQuery] = useState(query);
  const [results, setResults] = useState<SearchResults>({
    artists: [],
    events: [],
    genres: [],
    countries: []
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'artists' | 'events' | 'genres' | 'countries'>('all');
  const [totalResults, setTotalResults] = useState(0);

  useEffect(() => {
    if (query) {
      setSearchQuery(query);
      performSearch(query);
    }
  }, [query]);

  const performSearch = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setResults({ artists: [], events: [], genres: [], countries: [] });
      setTotalResults(0);
      return;
    }

    setLoading(true);
    try {
      const searchResults = await Promise.all([
        searchArtists(searchTerm),
        searchEvents(searchTerm),
        searchGenres(searchTerm),
        searchCountries(searchTerm)
      ]);

      const [artists, events, genres, countries] = searchResults;
      
      setResults({ artists, events, genres, countries });
      setTotalResults(artists.length + events.length + genres.length + countries.length);
    } catch (error) {
      console.error('Search error:', error);
      setResults({ artists: [], events: [], genres: [], countries: [] });
      setTotalResults(0);
    } finally {
      setLoading(false);
    }
  };

  const searchArtists = async (searchTerm: string): Promise<Artist[]> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_type', 'artist')
        .or(`full_name.ilike.%${searchTerm}%,username.ilike.%${searchTerm}%,bio.ilike.%${searchTerm}%,country.ilike.%${searchTerm}%,region.ilike.%${searchTerm}%`);

      if (error) throw error;

      return (data || []).map(profile => ({
        id: profile.id,
        name: profile.username || 'Unknown Artist',
        imageUrl: profile.avatar_url || 'https://images.pexels.com/photos/1699161/pexels-photo-1699161.jpeg',
        genre: profile.genres?.[0] || 'Various',
        categories: [
          profile.region || '',
          profile.country || '',
          profile.artist_type === 'music' ? 'Music' : 'Comedy',
          ...(profile.genres || [])
        ].filter(Boolean),
        bio: profile.bio || 'No biography available.',
        socialLinks: {}
      }));
    } catch (error) {
      console.error('Error searching artists:', error);
      return [];
    }
  };

  const searchEvents = async (searchTerm: string): Promise<Concert[]> => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          profiles:artist_id (
            id,
            username,
            full_name,
            avatar_url,
            artist_type,
            genres
          )
        `)
        .or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,unregistered_artist_name.ilike.%${searchTerm}%`)
        .order('start_time', { ascending: false });

      if (error) throw error;

      return (data || []).map(event => ({
        id: event.id,
        artistId: event.artist_id || event.id,
        title: event.title,
        date: event.start_time,
        time: new Date(event.start_time).toLocaleTimeString(),
        imageUrl: event.image_url || 'https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg',
        description: event.description,
        categories: event.profiles?.genres || [event.artist_type || 'Music'],
        duration: event.duration,
        isLive: event.status === 'live',
        price: event.price,
        maxTickets: 1000,
        soldTickets: 0,
        streamUrl: event.stream_url
      }));
    } catch (error) {
      console.error('Error searching events:', error);
      return [];
    }
  };

  const searchGenres = async (searchTerm: string): Promise<string[]> => {
    try {
      const { data, error } = await supabase
        .from('genres')
        .select('name')
        .ilike('name', `%${searchTerm}%`);

      if (error) throw error;
      return (data || []).map(genre => genre.name);
    } catch (error) {
      console.error('Error searching genres:', error);
      return [];
    }
  };

  const searchCountries = async (searchTerm: string): Promise<string[]> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('country')
        .not('country', 'is', null)
        .ilike('country', `%${searchTerm}%`);

      if (error) throw error;
      
      const uniqueCountries = Array.from(new Set((data || []).map(item => item.country).filter(Boolean)));
      return uniqueCountries;
    } catch (error) {
      console.error('Error searching countries:', error);
      return [];
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setSearchParams({ query: searchQuery.trim() });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const getTabCount = (tab: string) => {
    switch (tab) {
      case 'artists': return results.artists.length;
      case 'events': return results.events.length;
      case 'genres': return results.genres.length;
      case 'countries': return results.countries.length;
      default: return totalResults;
    }
  };

  const renderResults = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
        </div>
      );
    }

    if (totalResults === 0 && query) {
      return (
        <div className="text-center py-12">
          <SearchIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No results found</h3>
          <p className="text-gray-400">
            No results found for "{query}". Try searching for artists, events, genres, or countries.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        {/* Artists Results */}
        {(activeTab === 'all' || activeTab === 'artists') && results.artists.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
              <User className="h-6 w-6 mr-2 text-purple-400" />
              Artists ({results.artists.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {results.artists.map(artist => (
                <ArtistCard key={artist.id} artist={artist} />
              ))}
            </div>
          </div>
        )}

        {/* Events Results */}
        {(activeTab === 'all' || activeTab === 'events') && results.events.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
              <Calendar className="h-6 w-6 mr-2 text-purple-400" />
              Events ({results.events.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {results.events.map(event => {
                const artist: Artist = {
                  id: event.artistId,
                  name: 'Artist',
                  imageUrl: 'https://images.pexels.com/photos/1699161/pexels-photo-1699161.jpeg',
                  genre: 'Music',
                  categories: [],
                  bio: '',
                  socialLinks: {}
                };
                return <ConcertCard key={event.id} concert={event} artist={artist} />;
              })}
            </div>
          </div>
        )}

        {/* Genres Results */}
        {(activeTab === 'all' || activeTab === 'genres') && results.genres.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
              <Music className="h-6 w-6 mr-2 text-purple-400" />
              Genres ({results.genres.length})
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {results.genres.map(genre => (
                <Link
                  key={genre}
                  to={`/categories?genre=${encodeURIComponent(genre)}`}
                  className="bg-gray-800 hover:bg-gray-700 p-4 rounded-lg transition-colors text-center"
                >
                  <Music className="h-8 w-8 text-purple-400 mx-auto mb-2" />
                  <span className="text-white font-medium">{genre}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Countries Results */}
        {(activeTab === 'all' || activeTab === 'countries') && results.countries.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
              <MapPin className="h-6 w-6 mr-2 text-purple-400" />
              Countries ({results.countries.length})
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {results.countries.map(country => (
                <Link
                  key={country}
                  to={`/categories?country=${encodeURIComponent(country)}`}
                  className="bg-gray-800 hover:bg-gray-700 p-4 rounded-lg transition-colors text-center"
                >
                  <MapPin className="h-8 w-8 text-purple-400 mx-auto mb-2" />
                  <span className="text-white font-medium">{country}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 pt-24">
      <div className="container mx-auto px-6 py-8">
        {/* Search Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-4">Search Results</h1>
          
          {/* Search Form */}
          <form onSubmit={handleSearch} className="max-w-2xl mx-auto mb-6">
            <div className="relative">
              <SearchIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={searchQuery}
                onChange={handleInputChange}
                placeholder="Search artists, events, genres, countries..."
                className="w-full pl-12 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-full text-white focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500 transition-all"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-full transition-colors"
              >
                <SearchIcon size={16} />
              </button>
            </div>
          </form>

          {query && (
            <p className="text-gray-400">
              {loading ? 'Searching...' : `${totalResults} results found for "${query}"`}
            </p>
          )}
        </div>

        {/* Filter Tabs */}
        {totalResults > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {[
              { key: 'all', label: 'All', count: totalResults },
              { key: 'artists', label: 'Artists', count: results.artists.length },
              { key: 'events', label: 'Events', count: results.events.length },
              { key: 'genres', label: 'Genres', count: results.genres.length },
              { key: 'countries', label: 'Countries', count: results.countries.length }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
        )}

        {/* Results */}
        {renderResults()}
      </div>
    </div>
  );
};

export default Search;