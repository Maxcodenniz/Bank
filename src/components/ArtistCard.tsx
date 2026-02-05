import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Music, Heart } from 'lucide-react';
import { Artist } from '../types';
import { supabase } from '../lib/supabaseClient';
import { useStore } from '../store/useStore';

interface ArtistCardProps {
  artist: Artist;
}

const ArtistCard: React.FC<ArtistCardProps> = ({ artist }) => {
  const { user } = useStore();
  const [isLiked, setIsLiked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      checkIfLiked();
    }
  }, [user, artist.id]);

  const checkIfLiked = async () => {
    try {
      const { data, error } = await supabase
        .from('favorite_artists')
        .select('*')
        .eq('user_id', user?.id)
        .eq('artist_id', artist.id)
        .maybeSingle();

      if (error) throw error;
      setIsLiked(!!data);
    } catch (err) {
      console.error('Error checking favorite status:', err);
    }
  };

  const toggleLike = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation when clicking like button
    e.stopPropagation();
    
    if (!user) {
      window.location.href = '/login';
      return;
    }

    try {
      setLoading(true);

      if (isLiked) {
        const { error } = await supabase
          .from('favorite_artists')
          .delete()
          .eq('user_id', user.id)
          .eq('artist_id', artist.id);

        if (error) throw error;
        
        // Decrement likes
        await supabase.rpc('decrement_profile_likes', { artist_id: artist.id });
      } else {
        const { error } = await supabase
          .from('favorite_artists')
          .insert({
            user_id: user.id,
            artist_id: artist.id
          });

        if (error) throw error;
        
        // Increment likes
        await supabase.rpc('increment_profile_likes', { artist_id: artist.id });
      }

      setIsLiked(!isLiked);
    } catch (err) {
      console.error('Error toggling favorite:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Link to={`/artist/${artist.id}`} className="block group">
      <div className="relative h-full bg-gradient-to-br from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-xl rounded-2xl overflow-hidden border border-white/10 shadow-xl hover:shadow-2xl hover:shadow-purple-500/20 transition-all duration-500 hover:-translate-y-2 hover:scale-[1.02]">
        {/* Gradient Overlay on Hover */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600/0 via-pink-600/0 to-cyan-600/0 group-hover:from-purple-600/10 group-hover:via-pink-600/10 group-hover:to-cyan-600/10 transition-all duration-500 z-0"></div>
        
        {/* Image Section */}
        <div className="relative h-64 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10"></div>
          <img 
            src={artist.imageUrl} 
            alt={artist.name} 
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            style={{ objectPosition: 'center top' }}
          />
          
          {/* Upcoming Badge */}
          {artist.upcoming && (
            <div className="absolute top-3 right-3 z-20 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg backdrop-blur-sm border border-white/20">
              Upcoming
            </div>
          )}
          
          {/* Follow Button */}
          <button
            onClick={toggleLike}
            disabled={loading}
            title={isLiked ? "Unfollow to stop receiving notifications" : "Follow to get notifications for new events and live streams"}
            className={`absolute top-3 left-3 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md border transition-all duration-300 shadow-lg hover:scale-110 ${
              isLiked 
                ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white border-red-400/50' 
                : 'bg-white/20 hover:bg-white/30 text-white border-white/30 hover:border-white/50'
            }`}
          >
            <Heart 
              className={`h-3.5 w-3.5 ${isLiked ? 'fill-current' : ''} ${loading ? 'animate-pulse' : ''} transition-all duration-300`} 
            />
            <span className="text-xs font-semibold">{isLiked ? 'Following' : 'Follow'}</span>
          </button>
          
          {/* Category Tags Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
            <div className="flex flex-wrap gap-2">
              {artist.categories.slice(0, 3).map((category, index) => (
                <span 
                  key={index} 
                  className="backdrop-blur-md bg-gradient-to-r from-purple-600/80 to-pink-600/80 text-white text-xs font-semibold px-2.5 py-1 rounded-full border border-white/20 shadow-lg"
                >
                  {category}
                </span>
              ))}
              {artist.categories.length > 3 && (
                <span className="backdrop-blur-md bg-white/20 text-white text-xs font-semibold px-2.5 py-1 rounded-full border border-white/20">
                  +{artist.categories.length - 3}
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* Content Section */}
        <div className="p-5 relative z-10">
          <h3 className="font-bold text-xl mb-1.5 text-white group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-purple-300 group-hover:to-pink-300 transition-all duration-300">
            {artist.name}
          </h3>
          <p className="text-purple-400 font-semibold mb-3 flex items-center gap-2">
            <Music className="h-4 w-4" />
            {artist.genre}
          </p>
          
          <p className="text-gray-400 line-clamp-2 text-sm leading-relaxed">{artist.bio}</p>
        </div>
      </div>
    </Link>
  );
};

export default ArtistCard;