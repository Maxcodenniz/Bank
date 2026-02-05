import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { supabase } from '../lib/supabaseClient';
import { Users, User, Music, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface FollowerRow {
  user_id: string;
  created_at: string;
  profiles: {
    id: string;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

const ArtistFollowers: React.FC = () => {
  const { user, userProfile } = useStore();
  const [followers, setFollowers] = useState<FollowerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFollowers();
  }, [user?.id]);

  const fetchFollowers = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('favorite_artists')
        .select(`
          user_id,
          created_at,
          profiles:user_id (
            id,
            username,
            full_name,
            avatar_url
          )
        `)
        .eq('artist_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setFollowers((data as FollowerRow[]) || []);
    } catch (err) {
      console.error('Error fetching followers:', err);
      setError('Failed to load followers');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen relative overflow-hidden flex items-center justify-center pt-24">
        <div className="fixed inset-0 bg-gradient-to-br from-purple-900/20 via-pink-900/20 to-cyan-900/20 -z-10" />
        <div className="relative z-10">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-500/30 border-t-purple-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden pt-24 pb-12">
      <div className="fixed inset-0 bg-gradient-to-br from-purple-900/20 via-pink-900/20 to-cyan-900/20 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(120,119,198,0.3),transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(219,39,119,0.3),transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.2),transparent_50%)]"></div>
      </div>

      <div className="container mx-auto px-6 py-8 relative z-10">
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-purple-300 via-pink-300 to-cyan-300 bg-clip-text text-transparent flex items-center gap-3">
            <Users className="w-8 h-8 text-purple-400" />
            My Followers
          </h1>
          <p className="text-gray-400 text-lg flex items-center gap-2">
            <Music className="w-5 h-5 text-purple-400" />
            {followers.length > 0
              ? `${followers.length} ${followers.length === 1 ? 'follower' : 'followers'}`
              : 'People who follow you will appear here'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/50 backdrop-blur-sm">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {followers.length > 0 ? (
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden backdrop-blur-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-4 px-4 text-gray-400 font-medium">Follower</th>
                    <th className="text-left py-4 px-4 text-gray-400 font-medium hidden sm:table-cell">Since</th>
                  </tr>
                </thead>
                <tbody>
                  {followers.map((row) => {
                    const profile = row.profiles;
                    const displayName = profile?.username || profile?.full_name || 'Unknown';
                    return (
                      <tr key={row.user_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3 text-white">
                            <div className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden flex-shrink-0">
                              {profile?.avatar_url ? (
                                <img
                                  src={profile.avatar_url}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <User className="w-5 h-5 text-gray-500" />
                                </div>
                              )}
                            </div>
                            <span className="font-medium">{displayName}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-gray-400 hidden sm:table-cell flex items-center gap-2">
                          <Calendar className="w-4 h-4 flex-shrink-0" />
                          {format(new Date(row.created_at), 'MMM d, yyyy')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full blur-2xl"></div>
              <div className="relative w-32 h-32 bg-gradient-to-br from-purple-600/30 to-pink-600/30 rounded-full flex items-center justify-center border-2 border-white/20 backdrop-blur-sm">
                <Users className="w-16 h-16 text-purple-300" />
              </div>
            </div>
            <div className="text-center max-w-md">
              <h3 className="text-2xl font-bold text-white mb-3 bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
                No followers yet
              </h3>
              <p className="text-gray-400 text-lg">
                When fans follow you from your artist profile, they’ll show up here. Share your profile to grow your audience.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ArtistFollowers;
