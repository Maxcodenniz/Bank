import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { supabase } from '../lib/supabaseClient';
import ArtistCard from '../components/ArtistCard';
import { Artist } from '../types';
import { Heart, Sparkles, Music } from 'lucide-react';

const MyFavorites: React.FC = () => {
  const { user } = useStore();
  const [favoriteArtists, setFavoriteArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFavoriteArtists();
  }, [user]);

  const fetchFavoriteArtists = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('favorite_artists')
        .select(`
          *,
          profiles:artist_id (
            id,
            username,
            full_name,
            avatar_url,
            genres,
            bio
          )
        `)
        .eq('user_id', user.id);

      if (error) throw error;

      const formattedArtists: Artist[] = (data || []).map(item => {
        // Handle case where profiles might be null (deleted artist)
        if (!item.profiles) {
          return null;
        }
        
        return {
          id: item.profiles.id,
          name: item.profiles.username || 'Unknown Artist', // Only show username to fans (full_name is confidential)
          imageUrl: item.profiles.avatar_url || 'https://images.pexels.com/photos/1699161/pexels-photo-1699161.jpeg',
          genre: item.profiles.genres?.[0] || 'Various',
          categories: [], // Initialize with empty array since categories are not stored in profiles
          bio: item.profiles.bio || 'No biography available.',
          socialLinks: {}
        };
      }).filter((artist): artist is Artist => artist !== null);

      setFavoriteArtists(formattedArtists);
    } catch (err) {
      console.error('Error fetching favorite artists:', err);
      setError('Failed to load favorite artists');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen relative overflow-hidden flex items-center justify-center">
        {/* Animated gradient background */}
        <div className="fixed inset-0 bg-gradient-to-br from-purple-900/20 via-pink-900/20 to-cyan-900/20 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(120,119,198,0.3),transparent_50%)]"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(219,39,119,0.3),transparent_50%)]"></div>
        </div>
        <div className="relative z-10">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-500/30 border-t-purple-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden pt-24 pb-12">
      {/* Animated gradient background */}
      <div className="fixed inset-0 bg-gradient-to-br from-purple-900/20 via-pink-900/20 to-cyan-900/20 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(120,119,198,0.3),transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(219,39,119,0.3),transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.2),transparent_50%)]"></div>
      </div>

      {/* Animated floating elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl animate-pulse delay-2000"></div>
      </div>

      <div className="container mx-auto px-6 py-8 relative z-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-purple-300 via-pink-300 to-cyan-300 bg-clip-text text-transparent flex items-center gap-3">
            <Heart className="w-8 h-8 text-pink-400 fill-pink-400" />
            My Favorite Artists
          </h1>
          <p className="text-gray-400 text-lg flex items-center gap-2">
            <Music className="w-5 h-5 text-purple-400" />
            {favoriteArtists.length > 0 
              ? `${favoriteArtists.length} ${favoriteArtists.length === 1 ? 'artist' : 'artists'} in your collection`
              : 'Discover and save your favorite artists'
            }
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/50 backdrop-blur-sm">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {favoriteArtists.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {favoriteArtists.map(artist => (
              <div key={artist.id} className="transform transition-all duration-300 hover:scale-105">
                <ArtistCard artist={artist} />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full blur-2xl"></div>
              <div className="relative w-32 h-32 bg-gradient-to-br from-purple-600/30 to-pink-600/30 rounded-full flex items-center justify-center border-2 border-white/20 backdrop-blur-sm">
                <Heart className="w-16 h-16 text-purple-300" />
              </div>
            </div>
            <div className="text-center max-w-md">
              <h3 className="text-2xl font-bold text-white mb-3 bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
                No favorites yet
              </h3>
              <p className="text-gray-400 text-lg mb-6">
                Start exploring artists and add them to your favorites collection!
              </p>
              <div className="flex items-center justify-center gap-2 text-purple-400">
                <Sparkles className="w-5 h-5" />
                <span className="text-sm">Browse artists to get started</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyFavorites;